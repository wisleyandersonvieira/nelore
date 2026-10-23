import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, Loader2, X, Upload, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceOrder, Store, Supplier } from "@/types/serviceOrder";

interface ServiceOrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder | null;
  isEditing: boolean;
  stores: Store[];
  onSuccess: () => void;
}

export const ServiceOrderFormModal = ({
  open,
  onOpenChange,
  order,
  isEditing,
  stores,
  onSuccess
}: ServiceOrderFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  
  // Form state
  const [storeId, setStoreId] = useState("");
  const [osDate, setOsDate] = useState<Date | undefined>(new Date());
  const [osNumber, setOsNumber] = useState("");
  const [nfNumber, setNfNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<'aberta' | 'em_andamento' | 'fechada'>("aberta");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (isEditing && order) {
        // Populate form with existing data
        setStoreId(order.store_id);
        setOsDate(parseISO(order.os_date));
        setOsNumber(order.os_number);
        setNfNumber(order.nf_number || "");
        setSupplierId(order.supplier_id || "");
        setDescription(order.description);
        setValue(order.value?.toString() || "");
        setStatus(order.status as 'aberta' | 'em_andamento' | 'fechada');
        setAttachments(order.attachments || []);
        
        // Fetch supplier name if exists
        if (order.supplier_id) {
          fetchSupplierName(order.supplier_id);
        }
      } else {
        // Reset form for new order
        setStoreId("");
        setOsDate(new Date());
        setOsNumber("");
        setNfNumber("");
        setSupplierId("");
        setSupplierName("");
        setDescription("");
        setValue("");
        setStatus("aberta");
        setAttachments([]);
      }
    }
  }, [open, isEditing, order]);

  const fetchSupplierName = async (id: string) => {
    const { data } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', id)
      .single();
    if (data) {
      setSupplierName(data.name);
    }
  };

  const searchSuppliers = async (search: string) => {
    if (search.length < 2) {
      setSuppliers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .ilike('name', `%${search}%`)
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error searching suppliers:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchSuppliers(supplierSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [supplierSearch]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `service-orders/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        newAttachments.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }

      setAttachments([...attachments, ...newAttachments]);
      toast.success(`${newAttachments.length} arquivo(s) anexado(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Erro ao fazer upload dos arquivos');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (index: number) => {
    const attachment = attachments[index];
    
    try {
      await supabase.storage
        .from('attachments')
        .remove([attachment.path]);
    } catch (error) {
      console.error('Error removing file:', error);
    }

    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!storeId) {
      toast.error('Selecione uma loja');
      return;
    }
    if (!osDate) {
      toast.error('Selecione a data da OS');
      return;
    }
    if (!osNumber.trim()) {
      toast.error('Informe o número da OS');
      return;
    }
    if (!description.trim()) {
      toast.error('Informe a descrição');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const orderData = {
        store_id: storeId,
        os_date: format(osDate, 'yyyy-MM-dd'),
        os_number: osNumber.trim(),
        nf_number: nfNumber.trim() || null,
        supplier_id: supplierId || null,
        description: description.trim(),
        value: value ? parseFloat(value.replace(',', '.')) : null,
        status,
        attachments
      };

      if (isEditing && order) {
        const { error } = await supabase
          .from('service_orders')
          .update({
            ...orderData,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (error) throw error;
        toast.success('OS atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('service_orders')
          .insert({
            ...orderData,
            created_by: user.id
          });

        if (error) throw error;
        toast.success('OS cadastrada com sucesso');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving service order:', error);
      toast.error(error.message || 'Erro ao salvar OS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar OS' : 'Cadastrar OS'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Store Selection */}
          <div className="grid gap-2">
            <Label htmlFor="store">Loja *</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Data da OS *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !osDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {osDate ? format(osDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={osDate}
                    onSelect={setOsDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Data do Cadastro</Label>
              <Input 
                value={format(new Date(), "dd/MM/yyyy")} 
                disabled 
                className="bg-muted"
              />
            </div>
          </div>

          {/* OS and NF Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="osNumber">Número da OS *</Label>
              <Input
                id="osNumber"
                value={osNumber}
                onChange={(e) => setOsNumber(e.target.value)}
                placeholder="Digite o número da OS"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nfNumber">Número da NF</Label>
              <Input
                id="nfNumber"
                value={nfNumber}
                onChange={(e) => setNfNumber(e.target.value)}
                placeholder="Digite o número da NF"
              />
            </div>
          </div>

          {/* Supplier Search */}
          <div className="grid gap-2">
            <Label>Fornecedor</Label>
            <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {supplierName || "Buscar fornecedor..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Digite para buscar..."
                    value={supplierSearch}
                    onValueChange={setSupplierSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum fornecedor encontrado</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.name}
                          onSelect={() => {
                            setSupplierId(supplier.id);
                            setSupplierName(supplier.name);
                            setSupplierPopoverOpen(false);
                          }}
                        >
                          {supplier.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {supplierId && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setSupplierId("");
                  setSupplierName("");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar fornecedor
              </Button>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a ordem de serviço"
              rows={3}
            />
          </div>

          {/* Value */}
          <div className="grid gap-2">
            <Label htmlFor="value">Valor</Label>
            <Input
              id="value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Status */}
          <div className="grid gap-2">
            <Label>Situação</Label>
            <Select value={status} onValueChange={(val: 'aberta' | 'em_andamento' | 'fechada') => setStatus(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          <div className="grid gap-2">
            <Label>Anexos</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Adicionar Anexos
              </Button>
            </div>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm truncate max-w-[200px]">{attachment.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
