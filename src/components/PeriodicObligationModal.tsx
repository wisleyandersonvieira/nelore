import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Paperclip, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

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
        .select("id, completed_at, due_date, attachment_url")
        .eq("employee_id", employeeId)
        .eq("obligation_id", obligationId)
        .order("due_date", { ascending: false });

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/${obligationId}/${Date.now()}.${fileExt}`;

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
        .createSignedUrl(path, 60); // 60 seconds expiry

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
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
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obligationName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Funcionário: {employeeName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} className="w-full">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead>Data Vencimento</TableHead>
                  <TableHead>Anexo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(parseLocalDate(entry.completed_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {entry.due_date 
                        ? format(parseLocalDate(entry.due_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.attachment_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAttachment(entry.attachment_url!)}
                          className="text-primary"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PeriodicObligationModal;
