import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  MoreHorizontal, 
  Calendar as CalendarIcon, 
  Users, 
  Store, 
  CheckSquare, 
  MessageSquare,
  Plus,
  X,
  Trash2,
  Archive,
  CheckCircle,
  Send,
  Paperclip,
  Download,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  column_id: string;
  position_order: number;
  status: string;
  created_by: string;
  created_at: string;
  stores: { id: string; name: string }[];
  members: { id: string; name: string }[];
  comments_count: number;
  checklist_progress: { completed: number; total: number };
}

interface ChecklistItem {
  id: string;
  text: string;
  is_completed: boolean;
  position_order: number;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user_name?: string;
}

interface Activity {
  id: string;
  action_type: string;
  action_description: string;
  created_at: string;
  user_name?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task;
  currentUserId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

const TaskDetailModal = ({ task, currentUserId, onClose, onUpdate }: TaskDetailModalProps) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined
  );
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState("");
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [allStores, setAllStores] = useState<{ id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStorePopover, setShowStorePopover] = useState(false);
  const [showMemberPopover, setShowMemberPopover] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar se o usuário atual é o criador da tarefa
  const isTaskCreator = task.created_by === currentUserId;

  useEffect(() => {
    fetchTaskDetails();
    fetchAllStores();
  }, [task.id]);

  // Carregar membros quando as lojas selecionadas mudarem
  useEffect(() => {
    fetchMembersForSelectedStores();
  }, [stores]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const [storesResult, membersResult, checklistResult, commentsResult, activitiesResult, attachmentsResult] = await Promise.all([
        supabase.from("task_stores").select("store_id, stores(id, name)").eq("task_id", task.id),
        supabase.from("task_members").select("user_id, profiles(id, name)").eq("task_id", task.id),
        supabase.from("task_checklist_items").select("*").eq("task_id", task.id).order("position_order"),
        supabase.from("task_comments").select("*, profiles(name)").eq("task_id", task.id).order("created_at", { ascending: false }),
        supabase.from("task_activities").select("*, profiles(name)").eq("task_id", task.id).order("created_at", { ascending: false }),
        supabase.from("task_attachments").select("*").eq("task_id", task.id).order("created_at", { ascending: false })
      ]);

      setStores(storesResult.data?.map(s => ({ id: (s.stores as any)?.id, name: (s.stores as any)?.name })) || []);
      setMembers(membersResult.data?.map(m => ({ id: (m.profiles as any)?.id, name: (m.profiles as any)?.name })) || []);
      setChecklistItems(checklistResult.data || []);
      setComments(commentsResult.data?.map(c => ({ ...c, user_name: (c.profiles as any)?.name })) || []);
      setActivities(activitiesResult.data?.map(a => ({ ...a, user_name: (a.profiles as any)?.name })) || []);
      setAttachments(attachmentsResult.data || []);
      if (attachmentsResult.data && attachmentsResult.data.length > 0) {
        setShowAttachments(true);
      }
    } catch (error) {
      console.error("Error fetching task details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStores = async () => {
    // Buscar apenas as lojas que o usuário tem vínculo
    const { data: userStores } = await supabase
      .from("user_stores")
      .select("store_id, stores(id, name)")
      .order("stores(name)");

    // Remover duplicatas de lojas
    const uniqueStores = new Map<string, { id: string; name: string }>();
    userStores?.forEach(us => {
      const store = us.stores as any;
      if (store?.id && !uniqueStores.has(store.id)) {
        uniqueStores.set(store.id, { id: store.id, name: store.name });
      }
    });

    setAllStores(Array.from(uniqueStores.values()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const fetchMembersForSelectedStores = async () => {
    // Se não há lojas selecionadas, limpar membros disponíveis
    if (stores.length === 0) {
      setAllUsers([]);
      return;
    }

    // Buscar membros baseado nas lojas SELECIONADAS na tarefa usando a função SECURITY DEFINER
    const selectedStoreIds = stores.map(s => s.id);

    const { data: members, error } = await supabase
      .rpc("get_store_members", { store_ids: selectedStoreIds });

    if (error) {
      console.error("Erro ao buscar membros:", error);
      setAllUsers([]);
      return;
    }

    // Mapear para o formato esperado
    const formattedMembers = members?.map((m: { user_id: string; user_name: string }) => ({
      id: m.user_id,
      name: m.user_name
    })) || [];

    setAllUsers(formattedMembers);
  };

  const saveTitle = async () => {
    if (title.trim() === task.title) return;
    
    const { error } = await supabase
      .from("tasks")
      .update({ title: title.trim() })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao salvar título");
      return;
    }

    await logActivity("title_change", `Alterou o título para "${title.trim()}"`);
    onUpdate();
  };

  const saveDescription = async () => {
    const { error } = await supabase
      .from("tasks")
      .update({ description: description.trim() || null })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao salvar descrição");
      return;
    }

    await logActivity("description_change", "Atualizou a descrição");
    onUpdate();
  };

  const saveDueDate = async (date: Date | undefined) => {
    setDueDate(date);
    setShowDatePicker(false);

    const { error } = await supabase
      .from("tasks")
      .update({ due_date: date?.toISOString() || null })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao salvar data");
      return;
    }

    await logActivity(
      "due_date_change", 
      date ? `Definiu a data de entrega para ${format(date, "dd/MM/yyyy", { locale: ptBR })}` : "Removeu a data de entrega"
    );
    onUpdate();
  };

  const addStore = async (storeId: string) => {
    if (stores.some(s => s.id === storeId)) return;

    const { error } = await supabase
      .from("task_stores")
      .insert({ task_id: task.id, store_id: storeId });

    if (error) {
      toast.error("Erro ao adicionar loja");
      return;
    }

    const store = allStores.find(s => s.id === storeId);
    if (store) {
      setStores([...stores, store]);
      await logActivity("store_added", `Adicionou a loja "${store.name}"`);
    }
    onUpdate();
  };

  const removeStore = async (storeId: string) => {
    if (!isTaskCreator) {
      toast.error("Apenas o criador da tarefa pode remover lojas");
      return;
    }

    if (stores.length <= 1) {
      toast.error("A tarefa deve ter pelo menos uma loja");
      return;
    }

    const { error } = await supabase
      .from("task_stores")
      .delete()
      .eq("task_id", task.id)
      .eq("store_id", storeId);

    if (error) {
      toast.error("Erro ao remover loja");
      return;
    }

    const store = stores.find(s => s.id === storeId);
    setStores(stores.filter(s => s.id !== storeId));
    if (store) {
      await logActivity("store_removed", `Removeu a loja "${store.name}"`);
    }
    onUpdate();
  };

  const addMember = async (userId: string) => {
    if (!isTaskCreator) {
      toast.error("Apenas o criador da tarefa pode adicionar membros");
      return;
    }
    if (members.some(m => m.id === userId)) return;

    const { error } = await supabase
      .from("task_members")
      .insert({ task_id: task.id, user_id: userId });

    if (error) {
      toast.error("Erro ao adicionar membro");
      return;
    }

    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setMembers([...members, user]);
      await logActivity("member_added", `Adicionou "${user.name}" como membro`);
    }
    onUpdate();
  };

  const removeMember = async (userId: string) => {
    if (!isTaskCreator) {
      toast.error("Apenas o criador da tarefa pode remover membros");
      return;
    }

    const { error } = await supabase
      .from("task_members")
      .delete()
      .eq("task_id", task.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao remover membro");
      return;
    }

    const user = members.find(m => m.id === userId);
    setMembers(members.filter(m => m.id !== userId));
    if (user) {
      await logActivity("member_removed", `Removeu "${user.name}" dos membros`);
    }
    onUpdate();
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;

    const maxOrder = checklistItems.length > 0 ? Math.max(...checklistItems.map(c => c.position_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("task_checklist_items")
      .insert({
        task_id: task.id,
        text: newChecklistItem.trim(),
        position_order: maxOrder
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao adicionar item");
      return;
    }

    setChecklistItems([...checklistItems, data]);
    setNewChecklistItem("");
    await logActivity("checklist_item_added", `Adicionou item à checklist: "${newChecklistItem.trim()}"`);
    onUpdate();
  };

  const toggleChecklistItem = async (item: ChecklistItem) => {
    const { error } = await supabase
      .from("task_checklist_items")
      .update({ is_completed: !item.is_completed })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao atualizar item");
      return;
    }

    setChecklistItems(checklistItems.map(c => 
      c.id === item.id ? { ...c, is_completed: !c.is_completed } : c
    ));
    await logActivity(
      "checklist_item_toggled", 
      `${!item.is_completed ? "Concluiu" : "Desmarcou"} item: "${item.text}"`
    );
    onUpdate();
  };

  const deleteChecklistItem = async (itemId: string) => {
    const item = checklistItems.find(c => c.id === itemId);
    
    const { error } = await supabase
      .from("task_checklist_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Erro ao excluir item");
      return;
    }

    setChecklistItems(checklistItems.filter(c => c.id !== itemId));
    if (item) {
      await logActivity("checklist_item_deleted", `Removeu item da checklist: "${item.text}"`);
    }
    onUpdate();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        user_id: user.id,
        content: newComment.trim()
      })
      .select("*, profiles(name)")
      .single();

    if (error) {
      toast.error("Erro ao adicionar comentário");
      return;
    }

    setComments([{ ...data, user_name: (data.profiles as any)?.name }, ...comments]);
    setNewComment("");
    await logActivity("comment_added", "Adicionou um comentário");
    onUpdate();
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      toast.error("Erro ao excluir comentário");
      return;
    }

    setComments(comments.filter(c => c.id !== commentId));
    toast.success("Comentário excluído");
  };

  const archiveTask = async () => {
    if (task.created_by !== currentUserId) {
      toast.error("Apenas o criador pode arquivar a tarefa");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "archived" })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao arquivar tarefa");
      return;
    }

    await logActivity("task_archived", "Arquivou a tarefa");
    toast.success("Tarefa arquivada");
    onClose();
    onUpdate();
  };

  const completeTask = async () => {
    if (task.created_by !== currentUserId) {
      toast.error("Apenas o criador pode concluir a tarefa");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao concluir tarefa");
      return;
    }

    await logActivity("task_completed", "Concluiu a tarefa");
    toast.success("Tarefa concluída");
    onClose();
    onUpdate();
  };

  const logActivity = async (actionType: string, description: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("task_activities").insert({
      task_id: task.id,
      user_id: user.id,
      action_type: actionType,
      action_description: description
    });
  };

  const checklistProgress = checklistItems.length > 0
    ? Math.round((checklistItems.filter(c => c.is_completed).length / checklistItems.length) * 100)
    : 0;

  const handleSaveAndClose = async () => {
    await saveTitle();
    await saveDescription();
    toast.success("Tarefa salva com sucesso");
    onClose();
  };

  const handleUploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!currentUserId) {
      toast.error("Usuário não autenticado");
      return;
    }

    setUploadingAttachment(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${task.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data, error: insertError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: task.id,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          content_type: file.type,
          uploaded_by: currentUserId
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setAttachments([data, ...attachments]);
      setShowAttachments(true);
      await logActivity("attachment_added", `Adicionou o anexo "${file.name}"`);
      toast.success("Anexo adicionado com sucesso");
      onUpdate();
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error("Erro ao fazer upload do anexo");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      toast.error("Erro ao baixar anexo");
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (attachment.uploaded_by !== currentUserId) {
      toast.error("Você só pode excluir seus próprios anexos");
      return;
    }

    try {
      await supabase.storage
        .from('task-attachments')
        .remove([attachment.file_path]);

      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      setAttachments(attachments.filter(a => a.id !== attachment.id));
      await logActivity("attachment_deleted", `Removeu o anexo "${attachment.file_name}"`);
      toast.success("Anexo excluído");
      onUpdate();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao excluir anexo");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-hidden p-0 sm:p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveAndClose} size="sm" className="bg-primary text-primary-foreground">
                Salvar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
                  <DropdownMenuItem onClick={archiveTask}>
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={completeTask}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Concluído
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-[calc(90vh-80px)]">
          {/* Left Panel - Task Details */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dueDate ? format(dueDate, "dd MMM yyyy", { locale: ptBR }) : "Data Entrega"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={saveDueDate}
                    locale={ptBR}
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-destructive"
                        onClick={() => saveDueDate(undefined)}
                      >
                        Remover data
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover open={showStorePopover} onOpenChange={setShowStorePopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Store className="h-4 w-4 mr-2" />
                    Lojas ({stores.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-background" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Lojas vinculadas</p>
                    {stores.map(store => (
                      <div key={store.id} className="flex items-center justify-between">
                        <span className="text-sm">{store.name}</span>
                        {isTaskCreator && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => removeStore(store.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Separator />
                    <p className="text-sm font-medium">Adicionar loja</p>
                    <ScrollArea className="h-40">
                      <div className="space-y-1">
                        {allStores.filter(s => !stores.some(st => st.id === s.id)).map(store => (
                          <Button
                            key={store.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => addStore(store.id)}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            {store.name}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={showMemberPopover} onOpenChange={setShowMemberPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="max-w-xs">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">
                      {members.length > 0 
                        ? members.map(m => m.name).join(', ')
                        : "Membros"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-background" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Membros</p>
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between">
                        <span className="text-sm">{member.name}</span>
                        {isTaskCreator && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => removeMember(member.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Separator />
                    <p className="text-sm font-medium">Adicionar membro</p>
                    <ScrollArea className="h-40">
                      <div className="space-y-1">
                        {allUsers.filter(u => !members.some(m => m.id === u.id)).map(user => (
                          <Button
                            key={user.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => addMember(user.id)}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            {user.name}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Botão de Anexos */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAttachments(!showAttachments)}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Anexos ({attachments.length})
              </Button>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Descrição
              </h3>
              <Textarea
                placeholder="Adicione uma descrição mais detalhada..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                className="min-h-[100px]"
              />
            </div>

            {/* Checklist */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Checklist
                </h3>
                <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
              </div>
              
              {checklistItems.length > 0 && (
                <div className="w-full bg-muted rounded-full h-2 mb-3">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 mb-3">
                {checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.is_completed}
                      onCheckedChange={() => toggleChecklistItem(item)}
                    />
                    <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                      {item.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteChecklistItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar um item"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addChecklistItem();
                  }}
                />
                <Button size="sm" onClick={addChecklistItem}>
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Seção de Anexos */}
            {showAttachments && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between mb-2 gap-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Anexos
                  </h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUploadAttachment}
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                  >
                    {uploadingAttachment ? "Enviando..." : "Adicionar"}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum anexo</p>
                  ) : (
                    attachments.map(attachment => (
                      <div 
                        key={attachment.id} 
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg group"
                      >
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {attachment.uploaded_by === currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => handleDeleteAttachment(attachment)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Comments & Activity */}
          <div className="w-full md:w-96 border-t md:border-t-0 md:border-l overflow-y-auto">
            <div className="p-4">
              <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentários e atividade
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowActivityDetails(!showActivityDetails)}
                >
                  {showActivityDetails ? "Ocultar Detalhes" : "Mostrar Detalhes"}
                </Button>
              </div>

              {/* New Comment */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Escrever um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                />
                <Button size="icon" onClick={addComment}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Comments & Activities List */}
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4">
                  {/* Comments */}
                  {comments.map(comment => (
                    <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                      {comment.user_id === currentUserId && (
                        <div className="flex gap-2 mt-2 text-xs">
                          <button 
                            className="text-destructive hover:underline"
                            onClick={() => deleteComment(comment.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Activities (shown when showActivityDetails is true) */}
                  {showActivityDetails && activities.map(activity => (
                    <div key={activity.id} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <p>
                          <span className="font-medium">{activity.user_name}</span>{" "}
                          <span className="text-muted-foreground">{activity.action_description}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {comments.length === 0 && (!showActivityDetails || activities.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum comentário ainda
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;
