import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, Plus, MoreHorizontal, MessageSquare, Calendar, GripVertical, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskDetailModal from "@/components/TaskDetailModal";

interface TaskColumn {
  id: string;
  name: string;
  position_order: number;
  created_by: string;
  matrix_id: string;
}

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

const Tasks = () => {
  const navigate = useNavigate();
  const { matrixId, isLoading: isLoadingMatrix } = useUserMatrix();
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumn, setEditingColumn] = useState<TaskColumn | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [allStores, setAllStores] = useState<{ id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (matrixId) {
      fetchData();
      getCurrentUser();
      fetchFiltersData();
    }
  }, [matrixId]);

  useEffect(() => {
    if (matrixId) {
      fetchTasks();
    }
  }, [statusFilter, matrixId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchFiltersData = async () => {
    const [storesResult, usersResult] = await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("profiles").select("id, name").eq("is_active", true).order("name")
    ]);
    setAllStores(storesResult.data || []);
    setAllUsers(usersResult.data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchColumns(), fetchTasks()]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    if (!matrixId) return;
    
    const { data, error } = await supabase
      .from("task_columns")
      .select("*")
      .eq("matrix_id", matrixId)
      .order("position_order", { ascending: true });

    if (error) {
      console.error("Error fetching columns:", error);
      return;
    }

    setColumns(data || []);
  };

  const fetchTasks = async () => {
    // Fetch tasks with their related data based on status filter
    let query = supabase.from("tasks").select("*").order("position_order", { ascending: true });
    
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: tasksData, error: tasksError } = await query;

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return;
    }

    if (!tasksData || tasksData.length === 0) {
      setTasks([]);
      return;
    }

    // Fetch related data for each task
    const taskIds = tasksData.map(t => t.id);
    
    const [storesResult, membersResult, commentsResult, checklistResult] = await Promise.all([
      supabase
        .from("task_stores")
        .select("task_id, store_id, stores(id, name)")
        .in("task_id", taskIds),
      supabase
        .from("task_members")
        .select("task_id, user_id, profiles(id, name)")
        .in("task_id", taskIds),
      supabase
        .from("task_comments")
        .select("task_id")
        .in("task_id", taskIds),
      supabase
        .from("task_checklist_items")
        .select("task_id, is_completed")
        .in("task_id", taskIds)
    ]);

    const enrichedTasks: Task[] = tasksData.map(task => {
      const taskStores = storesResult.data?.filter(s => s.task_id === task.id) || [];
      const taskMembers = membersResult.data?.filter(m => m.task_id === task.id) || [];
      const taskComments = commentsResult.data?.filter(c => c.task_id === task.id) || [];
      const taskChecklist = checklistResult.data?.filter(c => c.task_id === task.id) || [];

      return {
        ...task,
        stores: taskStores.map(s => ({ id: (s.stores as any)?.id, name: (s.stores as any)?.name })),
        members: taskMembers.map(m => ({ id: (m.profiles as any)?.id, name: (m.profiles as any)?.name })),
        comments_count: taskComments.length,
        checklist_progress: {
          completed: taskChecklist.filter(c => c.is_completed).length,
          total: taskChecklist.length
        }
      };
    });

    setTasks(enrichedTasks);
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) {
      toast.error("Digite um nome para a coluna");
      return;
    }

    if (!matrixId) {
      toast.error("Matriz do usuário não identificada");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.position_order)) + 1 : 0;

    const { error } = await supabase.from("task_columns").insert({
      name: newColumnName.trim(),
      position_order: maxOrder,
      created_by: user.id,
      matrix_id: matrixId
    });

    if (error) {
      toast.error("Erro ao criar coluna");
      console.error(error);
      return;
    }

    toast.success("Coluna criada com sucesso");
    setShowColumnModal(false);
    setNewColumnName("");
    fetchColumns();
  };

  const handleUpdateColumn = async () => {
    if (!editingColumn || !newColumnName.trim()) return;

    const { error } = await supabase
      .from("task_columns")
      .update({ name: newColumnName.trim() })
      .eq("id", editingColumn.id);

    if (error) {
      toast.error("Erro ao atualizar coluna");
      return;
    }

    toast.success("Coluna atualizada");
    setEditingColumn(null);
    setNewColumnName("");
    setShowColumnModal(false);
    fetchColumns();
  };

  const handleDeleteColumn = async (columnId: string) => {
    const columnTasks = tasks.filter(t => t.column_id === columnId);
    if (columnTasks.length > 0) {
      toast.error("Não é possível excluir uma coluna com tarefas");
      return;
    }

    const { error } = await supabase.from("task_columns").delete().eq("id", columnId);
    
    if (error) {
      toast.error("Erro ao excluir coluna");
      return;
    }

    toast.success("Coluna excluída");
    fetchColumns();
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedColumnId) {
      toast.error("Digite um título para a tarefa");
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log("=== DEBUG CREATE TASK ===");
    console.log("User:", user);
    console.log("Auth Error:", authError);
    console.log("Selected Column ID:", selectedColumnId);
    
    if (!user) {
      toast.error("Usuário não autenticado");
      console.error("No user found");
      return;
    }

    const columnTasks = tasks.filter(t => t.column_id === selectedColumnId);
    const maxOrder = columnTasks.length > 0 ? Math.max(...columnTasks.map(t => t.position_order)) + 1 : 0;

    const insertData = {
      title: newTaskTitle.trim(),
      column_id: selectedColumnId,
      position_order: maxOrder,
      created_by: user.id
    };
    
    console.log("Insert Data:", insertData);

    // Inserir sem SELECT para evitar conflito com RLS
    const { error: taskError } = await supabase
      .from("tasks")
      .insert(insertData);

    console.log("Task Error:", taskError);

    if (taskError) {
      toast.error("Erro ao criar tarefa: " + taskError.message);
      console.error("Full error:", taskError);
      return;
    }

    toast.success("Tarefa criada com sucesso!");
    setShowTaskModal(false);
    setNewTaskTitle("");
    setSelectedColumnId(null);
    
    // Recarregar tarefas
    await fetchTasks();
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.column_id === targetColumnId) {
      setDraggedTask(null);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const oldColumnName = columns.find(c => c.id === draggedTask.column_id)?.name || "Desconhecido";
    const newColumnName = columns.find(c => c.id === targetColumnId)?.name || "Desconhecido";

    // Update task column
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ column_id: targetColumnId })
      .eq("id", draggedTask.id);

    if (updateError) {
      toast.error("Erro ao mover tarefa");
      console.error(updateError);
      setDraggedTask(null);
      return;
    }

    // Log activity
    await supabase.from("task_activities").insert({
      task_id: draggedTask.id,
      user_id: user.id,
      action_type: "column_change",
      action_description: `Moveu a tarefa de "${oldColumnName}" para "${newColumnName}"`,
      old_value: oldColumnName,
      new_value: newColumnName
    });

    toast.success("Tarefa movida");
    setDraggedTask(null);
    fetchTasks();
  };

  const openAddTaskModal = (columnId: string) => {
    setSelectedColumnId(columnId);
    setShowTaskModal(true);
  };

  const openEditColumnModal = (column: TaskColumn) => {
    setEditingColumn(column);
    setNewColumnName(column.name);
    setShowColumnModal(true);
  };

  const getColumnTasks = (columnId: string) => {
    let filteredTasks = tasks.filter(t => t.column_id === columnId);
    
    // Apply store filter
    if (storeFilter !== "all") {
      filteredTasks = filteredTasks.filter(t => 
        t.stores.some(s => s.id === storeFilter)
      );
    }
    
    // Apply user filter
    if (userFilter !== "all") {
      filteredTasks = filteredTasks.filter(t => 
        t.members.some(m => m.id === userFilter)
      );
    }
    
    return filteredTasks;
  };

  if (loading || isLoadingMatrix) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-4">
              <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-primary">Tarefas</h1>
                <p className="text-sm text-muted-foreground">Gerencie suas tarefas e projetos</p>
              </div>
            </div>
            <Button onClick={() => { setEditingColumn(null); setNewColumnName(""); setShowColumnModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Cadastrar Coluna</span>
              <span className="sm:hidden">Coluna</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-0 flex-1 sm:flex-none sm:w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="active">Em Aberto</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="min-w-0 flex-1 sm:flex-none sm:w-[160px]">
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {allStores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="min-w-0 flex-1 sm:flex-none sm:w-[160px]">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">Todos os Usuários</SelectItem>
                {allUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="p-4">
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
            {columns.map((column) => (
              <div
                key={column.id}
                className={`w-72 sm:w-80 flex-shrink-0 ${dragOverColumn === column.id ? "ring-2 ring-primary rounded-lg" : ""}`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <Card className="bg-muted/50">
                  <CardHeader className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-sm font-medium">{column.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 md:h-8 w-10 md:w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background">
                          <DropdownMenuItem onClick={() => openEditColumnModal(column)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteColumn(column.id)}
                            className="text-destructive"
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[calc(100vh-280px)]">
                      <div className="space-y-2 pr-3">
                        {getColumnTasks(column.id).map((task) => (
                          <Card
                            key={task.id}
                            className="cursor-pointer hover:shadow-md transition-shadow bg-card"
                            draggable
                            onDragStart={(e) => handleDragStart(e, task)}
                            onClick={() => setSelectedTask(task)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 cursor-grab" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{task.title}</p>
                                  
                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    {task.due_date && (
                                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                        new Date(task.due_date) < new Date() ? "bg-destructive/10 text-destructive" : "bg-muted"
                                      }`}>
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(task.due_date), "dd MMM", { locale: ptBR })}
                                      </span>
                                    )}
                                    
                                    {task.comments_count > 0 && (
                                      <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {task.comments_count}
                                      </span>
                                    )}
                                    
                                    {task.checklist_progress.total > 0 && (
                                      <span className={`flex items-center gap-1 ${
                                        task.checklist_progress.completed === task.checklist_progress.total 
                                          ? "text-green-600" 
                                          : ""
                                      }`}>
                                        ☑ {task.checklist_progress.completed}/{task.checklist_progress.total}
                                      </span>
                                    )}
                                  </div>

                                  {task.stores.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.stores.slice(0, 2).map(store => (
                                        <span key={store.id} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                          {store.name}
                                        </span>
                                      ))}
                                      {task.stores.length > 2 && (
                                        <span className="text-xs text-muted-foreground">
                                          +{task.stores.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>

                    <Button
                      variant="ghost"
                      className="w-full mt-2 justify-start text-muted-foreground"
                      onClick={() => openAddTaskModal(column.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar um cartão
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}

            {columns.length === 0 && (
              <div className="flex items-center justify-center w-full min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <p className="mb-2">Nenhuma coluna criada</p>
                  <Button onClick={() => setShowColumnModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira coluna
                  </Button>
                </div>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Column Modal */}
      <Dialog open={showColumnModal} onOpenChange={setShowColumnModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingColumn ? "Editar Coluna" : "Nova Coluna"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da coluna"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  editingColumn ? handleUpdateColumn() : handleCreateColumn();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowColumnModal(false); setEditingColumn(null); setNewColumnName(""); }}>
              Cancelar
            </Button>
            <Button onClick={editingColumn ? handleUpdateColumn : handleCreateColumn}>
              {editingColumn ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Task Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título da tarefa"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateTask();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTaskModal(false); setNewTaskTitle(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          currentUserId={currentUserId}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
};

export default Tasks;
