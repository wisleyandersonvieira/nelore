import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Eye, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface ObligationAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  completionId: string;
  obligationName: string;
  employeeName: string;
  onAttachmentsChange?: (count: number) => void;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
  is_active: boolean;
}

const parseLocalDate = (dateString: string) => {
  const datePart = dateString.split('T')[0];
  return parseISO(datePart + 'T12:00:00');
};

const ObligationAttachmentsModal = ({
  isOpen,
  onClose,
  completionId,
  obligationName,
  employeeName,
  onAttachmentsChange
}: ObligationAttachmentsModalProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_obligation_attachments")
        .select("id, file_path, file_name, uploaded_at, is_active")
        .eq("completion_id", completionId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
      // Count only active attachments
      const activeCount = data?.filter(a => a.is_active).length || 0;
      onAttachmentsChange?.(activeCount);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar anexos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && completionId) {
      fetchAttachments();
    }
  }, [isOpen, completionId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");
      
      // Get store_id for RLS-compliant file path
      const { data: profileData } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.user.id)
        .single();
      
      if (!profileData?.store_id) throw new Error("Loja não encontrada");

      const fileExt = file.name.split('.').pop();
      // Use store_id as the first path segment for RLS compliance
      const fileName = `${profileData.store_id}/${completionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("obligation-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("employee_obligation_attachments")
        .insert({
          completion_id: completionId,
          file_path: fileName,
          file_name: file.name,
          uploaded_by: user.user.id
        });

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: "Anexo enviado"
      });

      fetchAttachments();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleViewAttachment = async (filePath: string) => {
    try {
      let path = filePath;
      if (filePath.includes('/storage/v1/object/public/obligation-attachments/')) {
        path = filePath.split('/storage/v1/object/public/obligation-attachments/')[1];
      }

      const { data, error } = await supabase.storage
        .from("obligation-attachments")
        .createSignedUrl(path, 60);

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

  const handleToggleActive = async (attachment: Attachment) => {
    try {
      const { error } = await supabase
        .from("employee_obligation_attachments")
        .update({ is_active: !attachment.is_active })
        .eq("id", attachment.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: attachment.is_active ? "Anexo inabilitado" : "Anexo habilitado"
      });

      fetchAttachments();
    } catch (error) {
      console.error("Error toggling attachment:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do anexo",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexos - {obligationName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Funcionário: {employeeName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              className="hidden"
              id="attachment-upload"
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <Button
              onClick={() => document.getElementById("attachment-upload")?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Adicionar Anexo
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum anexo cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((attachment) => (
                  <TableRow key={attachment.id} className={!attachment.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {attachment.file_name}
                    </TableCell>
                    <TableCell>
                      {format(parseLocalDate(attachment.uploaded_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={attachment.is_active}
                        onCheckedChange={() => handleToggleActive(attachment)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttachment(attachment.file_path)}
                        className="text-primary"
                      >
                        <Eye className="w-4 h-4" />
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

export default ObligationAttachmentsModal;
