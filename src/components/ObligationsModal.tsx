import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Upload, X, FileText } from "lucide-react";

interface Obligation {
  id: string;
  name: string;
  recurrence_type: string;
  recurrence_months: number | null;
  attachments: { name: string; url: string }[];
  store_id: string;
  is_active: boolean;
  created_at: string;
}

interface ObligationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ObligationsModal = ({ isOpen, onClose }: ObligationsModalProps) => {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<string>("unica");
  const [recurrenceMonths, setRecurrenceMonths] = useState<string>("");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_obligations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      setObligations((data || []).map(item => ({
        ...item,
        attachments: Array.isArray(item.attachments) 
          ? (item.attachments as unknown as { name: string; url: string }[])
          : []
      })));
    } catch (error: any) {
      toast.error("Erro ao carregar obrigações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchObligations();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName("");
    setRecurrenceType("unica");
    setRecurrenceMonths("");
    setAttachments([]);
    setEditingObligation(null);
    setShowForm(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newAttachments: { name: string; url: string }[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `obligations/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('obligation-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('obligation-attachments')
          .getPublicUrl(filePath);

        newAttachments.push({
          name: file.name,
          url: filePath
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success("Arquivo(s) enviado(s) com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar arquivo: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = async (index: number) => {
    const attachment = attachments[index];
    try {
      await supabase.storage
        .from('obligation-attachments')
        .remove([attachment.url]);
      
      setAttachments(prev => prev.filter((_, i) => i !== index));
    } catch (error: any) {
      toast.error("Erro ao remover arquivo: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Nome da obrigação é obrigatório");
      return;
    }

    if (recurrenceType === 'periodica' && (!recurrenceMonths || parseInt(recurrenceMonths) <= 0)) {
      toast.error("Informe o prazo em meses para obrigações periódicas");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: profileData } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', userData.user.id)
        .single();

      if (!profileData?.store_id) throw new Error("Loja não encontrada");

      const obligationData = {
        name: name.trim(),
        recurrence_type: recurrenceType,
        recurrence_months: recurrenceType === 'periodica' ? parseInt(recurrenceMonths) : null,
        attachments: attachments,
        store_id: profileData.store_id
      };

      if (editingObligation) {
        const { error } = await supabase
          .from('employee_obligations')
          .update(obligationData)
          .eq('id', editingObligation.id);

        if (error) throw error;
        toast.success("Obrigação atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('employee_obligations')
          .insert(obligationData);

        if (error) throw error;
        toast.success("Obrigação cadastrada com sucesso!");
      }

      resetForm();
      fetchObligations();
    } catch (error: any) {
      toast.error("Erro ao salvar obrigação: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setName(obligation.name);
    setRecurrenceType(obligation.recurrence_type);
    setRecurrenceMonths(obligation.recurrence_months?.toString() || "");
    setAttachments(obligation.attachments || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta obrigação?")) return;

    try {
      const { error } = await supabase
        .from('employee_obligations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success("Obrigação excluída com sucesso!");
      fetchObligations();
    } catch (error: any) {
      toast.error("Erro ao excluir obrigação: " + error.message);
    }
  };

  const downloadAttachment = async (attachment: { name: string; url: string }) => {
    try {
      const { data, error } = await supabase.storage
        .from('obligation-attachments')
        .download(attachment.url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Erro ao baixar arquivo: " + error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Cadastro de Obrigações
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showForm ? (
            <>
              <div className="flex justify-end">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Obrigação
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Recorrência</TableHead>
                    <TableHead>Prazo (meses)</TableHead>
                    <TableHead>Arquivos</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : obligations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma obrigação cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    obligations.map((obligation) => (
                      <TableRow key={obligation.id}>
                        <TableCell className="font-medium">{obligation.name}</TableCell>
                        <TableCell>
                          {obligation.recurrence_type === 'unica' ? 'Única' : 'Periódica'}
                        </TableCell>
                        <TableCell>
                          {obligation.recurrence_months || '-'}
                        </TableCell>
                        <TableCell>
                          {obligation.attachments?.length || 0} arquivo(s)
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(obligation)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(obligation.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingObligation ? 'Editar Obrigação' : 'Nova Obrigação'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Obrigação *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Exame Admissional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrence">Recorrência *</Label>
                    <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a recorrência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unica">Única</SelectItem>
                        <SelectItem value="periodica">Periódica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {recurrenceType === 'periodica' && (
                    <div className="space-y-2">
                      <Label htmlFor="months">Prazo em Meses *</Label>
                      <Input
                        id="months"
                        type="number"
                        min="1"
                        value={recurrenceMonths}
                        onChange={(e) => setRecurrenceMonths(e.target.value)}
                        placeholder="Ex: 12"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Arquivos Modelo</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        disabled={uploading}
                      />
                      <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center cursor-pointer"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          {uploading ? 'Enviando...' : 'Clique para enviar arquivos'}
                        </span>
                      </label>
                    </div>

                    {attachments.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded-md"
                          >
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:text-primary"
                              onClick={() => downloadAttachment(attachment)}
                            >
                              <FileText className="w-4 h-4" />
                              <span className="text-sm">{attachment.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ObligationsModal;
