import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Pencil, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface Partner {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  matrix_id: string;
  is_active: boolean;
  created_at: string;
}

interface PartnersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const PartnersModal = ({ 
  open, 
  onOpenChange,
  canEdit = true,
  canDelete = true
}: PartnersModalProps) => {
  // Debug log to track canEdit prop
  console.log('PartnersModal permissions:', { canEdit, canDelete, open });

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("lista");
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const { matrixId, matrixName } = useUserMatrix();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    email: "",
  });

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar sócios",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPartners();
    }
  }, [open]);

  // Update activeTab based on canEdit permission - always go to lista if user can't edit
  useEffect(() => {
    if (!canEdit) {
      setActiveTab("lista");
    }
  }, [canEdit]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    if (formatted.length <= 14) {
      setFormData({ ...formData, cpf: formatted });
    }
  };

  const resetForm = () => {
    setFormData({ name: "", cpf: "", email: "" });
    setBirthDate(undefined);
    setEditingPartner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "O nome é obrigatório.",
      });
      return;
    }

    setLoading(true);
    try {
      const partnerData = {
        name: formData.name.trim(),
        cpf: formData.cpf || null,
        email: formData.email || null,
        birth_date: birthDate ? format(birthDate, "yyyy-MM-dd") : null,
      };

      if (editingPartner) {
        const { error } = await supabase
          .from("partners")
          .update(partnerData)
          .eq("id", editingPartner.id);

        if (error) throw error;
        toast({
          title: "Sócio atualizado",
          description: "Os dados do sócio foram atualizados com sucesso.",
        });
      } else {
        if (!matrixId) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Usuário não associado a uma matriz.",
          });
          return;
        }

        const { error } = await supabase
          .from("partners")
          .insert({ ...partnerData, matrix_id: matrixId } as any);

        if (error) throw error;
        toast({
          title: "Sócio cadastrado",
          description: "O sócio foi cadastrado com sucesso.",
        });
      }

      resetForm();
      fetchPartners();
      setActiveTab("lista");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (partner: Partner) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Você não tem permissão para editar.",
      });
      return;
    }
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      cpf: partner.cpf || "",
      email: partner.email || "",
    });
    setBirthDate(partner.birth_date ? new Date(partner.birth_date) : undefined);
    setActiveTab("cadastro");
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast({
        variant: "destructive",
        title: "Sem permissão",
        description: "Você não tem permissão para excluir.",
      });
      return;
    }

    setLoading(true);
    try {
      // Verificar se o sócio está vinculado a alguma loja
      const { data: storePartners, error: storePartnersError } = await supabase
        .from("store_partners")
        .select("id")
        .eq("partner_id", id)
        .limit(1);

      if (storePartnersError) throw storePartnersError;

      if (storePartners && storePartners.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este sócio está vinculado a uma ou mais lojas e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      // Verificar se existem movimentações de aportes/retiradas vinculadas ao sócio
      const { data: transactions, error: transactionsError } = await supabase
        .from("partner_transactions")
        .select("id")
        .eq("partner_id", id)
        .limit(1);

      if (transactionsError) throw transactionsError;

      if (transactions && transactions.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este sócio possui movimentações de aportes ou retiradas cadastradas e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      if (!confirm("Tem certeza que deseja excluir este sócio?")) {
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("partners")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Sócio excluído",
        description: "O sócio foi excluído com sucesso.",
      });
      fetchPartners();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter(partner =>
    partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (partner.cpf && partner.cpf.includes(searchTerm)) ||
    (partner.email && partner.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro de Sócios</DialogTitle>
        </DialogHeader>

        <Tabs value={canEdit ? activeTab : "lista"} onValueChange={(value) => canEdit && setActiveTab(value)}>
          {canEdit ? (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>
              <TabsTrigger value="lista">Listar</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="lista">Listar</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="cadastro" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Matriz (somente leitura) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matriz</Label>
                  <Input 
                    value={matrixName || 'Carregando...'} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do sócio"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={handleCPFChange}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !birthDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthDate ? format(birthDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthDate}
                        onSelect={setBirthDate}
                        locale={ptBR}
                        captionLayout="dropdown-buttons"
                        fromYear={1930}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                {editingPartner && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : editingPartner ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="lista" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum sócio encontrado.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table className="table-sticky-first table-sticky-last">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Data Nascimento</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPartners.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>{partner.cpf || "-"}</TableCell>
                        <TableCell>
                          {partner.birth_date 
                            ? format(new Date(partner.birth_date), "dd/MM/yyyy") 
                            : "-"}
                        </TableCell>
                        <TableCell>{partner.email || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(partner)}
                              disabled={!canEdit}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(partner.id)}
                              disabled={!canDelete}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
