import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Paperclip, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isAfter, isBefore, subDays } from "date-fns";

// Helper to parse date strings without timezone issues
const parseLocalDate = (dateString: string) => {
  // Extract just the date part (YYYY-MM-DD) and treat as local date
  const datePart = dateString.split('T')[0];
  return parseISO(datePart + 'T12:00:00');
};

interface PeriodicObligationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  obligationId: string;
  obligationName: string;
}

interface ObligationEntry {
  id: string;
  completed_at: string;
  due_date: string | null;
  attachment_url: string | null;
}

const PeriodicObligationModal = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  obligationId,
  obligationName
}: PeriodicObligationModalProps) => {
  const [entries, setEntries] = useState<ObligationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    completed_at: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    attachment_url: null as string | null
  });

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_obligation_completions")
        .select("id, completed_at, due_date, attachment_url, created_at")
        .eq("employee_id", employeeId)
        .eq("obligation_id", obligationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar movimentações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employeeId && obligationId) {
      fetchEntries();
    }
  }, [isOpen, employeeId, obligationId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get store_id for RLS-compliant file path
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', userData.user.id)
        .single();
      
      let storeId = profileData?.store_id;

      // Se não tiver store_id no profile, buscar de user_stores
      if (!storeId) {
        const { data: userStoresData } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .single();
        
        storeId = userStoresData?.store_id;
      }
      
      if (!storeId) throw new Error("Loja não encontrada. Verifique se você tem uma loja atribuída.");
      
      // Keep original filename with timestamp prefix to avoid collisions
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Use store_id as the first path segment for RLS compliance
      const fileName = `${storeId}/${employeeId}/${obligationId}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("obligation-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Store just the file path for private bucket
      setFormData(prev => ({ ...prev, attachment_url: fileName }));

      toast({
        title: "Sucesso",
        description: "Arquivo anexado"
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewAttachment = async (filePath: string) => {
    try {
      // Handle old format (full URL) vs new format (just path)
      let path = filePath;
      if (filePath.includes('/storage/v1/object/public/obligation-attachments/')) {
        path = filePath.split('/storage/v1/object/public/obligation-attachments/')[1];
      }

      const { data, error } = await supabase.storage
        .from("obligation-attachments")
        .download(path);

      if (error) throw error;

      // Create blob URL and download
      const blob = new Blob([data], { type: data.type });
      const url = URL.createObjectURL(blob);
      
      // Extract original filename (remove timestamp prefix)
      const fullName = path.split('/').pop() || 'arquivo';
      const underscoreIndex = fullName.indexOf('_');
      const fileName = (underscoreIndex > 0 && /^\d+$/.test(fullName.substring(0, underscoreIndex)))
        ? fullName.substring(underscoreIndex + 1)
        : fullName;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error viewing attachment:", error);
      toast({
        title: "Erro",
        description: "Erro ao abrir anexo",
        variant: "destructive"
      });
    }
  };

  const handleSave = async () => {
    if (!formData.due_date) {
      toast({
        title: "Erro",
        description: "Informe a data de vencimento",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("employee_obligation_completions")
        .insert({
          employee_id: employeeId,
          obligation_id: obligationId,
          completed_by: user.user.id,
          completed_at: formData.completed_at,
          due_date: formData.due_date,
          attachment_url: formData.attachment_url
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Movimentação cadastrada"
      });

      setFormData({
        completed_at: format(new Date(), "yyyy-MM-dd"),
        due_date: "",
        attachment_url: null
      });
      setShowForm(false);
      fetchEntries();
    } catch (error) {
      console.error("Error saving entry:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar movimentação",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir esta movimentação?")) return;

    try {
      const { error } = await supabase
        .from("employee_obligation_completions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Movimentação excluída"
      });
      fetchEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obligationName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Funcionário: {employeeName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} size="sm" className="w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Movimentação
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Cadastro</Label>
                  <Input
                    type="date"
                    value={formData.completed_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, completed_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Anexo do Documento</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    className="hidden"
                    id="periodic-file-upload"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("periodic-file-upload")?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Paperclip className="w-4 h-4 mr-2" />
                    )}
                    {formData.attachment_url ? "Alterar Anexo" : "Anexar Documento"}
                  </Button>
                  {formData.attachment_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewAttachment(formData.attachment_url!)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação cadastrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">Seq</TableHead>
                    <TableHead className="w-[100px]">Cadastro</TableHead>
                    <TableHead className="w-[100px]">Vencimento</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Anexo</TableHead>
                    <TableHead className="w-[70px] text-center">Ações</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => {
                  // Extract file name from attachment_url (remove timestamp prefix)
                  const getFileName = (url: string | null) => {
                    if (!url) return null;
                    const parts = url.split('/');
                    const fullName = parts[parts.length - 1];
                    // Remove timestamp prefix (format: timestamp_filename)
                    const underscoreIndex = fullName.indexOf('_');
                    if (underscoreIndex > 0 && /^\d+$/.test(fullName.substring(0, underscoreIndex))) {
                      return fullName.substring(underscoreIndex + 1);
                    }
                    return fullName;
                  };
                  const fileName = getFileName(entry.attachment_url);
                  
                  // Calculate status
                  const getStatus = () => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    // If not the first entry (most recent), it's renewed
                    if (index > 0) {
                      return { label: "Renovado", variant: "secondary" as const, className: "" };
                    }
                    
                    // First entry - check due date
                    if (!entry.due_date) {
                      return { label: "Vigente", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
                    }
                    
                    const dueDate = parseLocalDate(entry.due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    
                    // If due date is after or equal to today, it's active
                    if (isAfter(dueDate, subDays(today, 1))) {
                      return { label: "Vigente", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
                    }
                    
                    // If due date passed, it's expired
                    return { label: "Vencido", variant: "destructive" as const, className: "" };
                  };
                  
                  const status = getStatus();
                  
                  // Calculate sequence number (oldest = 1, newest = total)
                  const sequenceNumber = entries.length - index;
                  
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-center">
                          {sequenceNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(parseLocalDate(entry.completed_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.due_date 
                            ? format(parseLocalDate(entry.due_date), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className={`${status.className} text-xs`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <div className="flex items-center gap-1">
                            {entry.attachment_url ? (
                              <>
                                <span className="truncate text-sm" title={fileName || undefined}>
                                  {fileName}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewAttachment(entry.attachment_url!)}
                                  className="text-primary h-7 w-7 flex-shrink-0"
                                  title="Ver anexo"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(entry.id)}
                            className="text-destructive hover:text-destructive h-7 w-7"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PeriodicObligationModal;
