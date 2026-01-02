import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Batch {
  id: string;
  code: number;
  name: string;
  description: string | null;
  store_id: string;
  created_at: string;
  updated_at: string;
}

const AnimaisLotes = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [nextCode, setNextCode] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.store_id) {
        toast.error("Usuário não está vinculado a uma fazenda");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("animal_batches")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("code", { ascending: true });

      if (error) throw error;

      setBatches(data || []);
      
      // Get next code
      const { data: nextCodeData } = await supabase
        .rpc("get_next_animal_batch_code", { store_uuid: profile.store_id });
      
      setNextCode(nextCodeData || 1);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      toast.error("Erro ao carregar lotes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (batch?: Batch) => {
    if (batch) {
      setSelectedBatch(batch);
      setFormData({ name: batch.name, description: batch.description || "" });
    } else {
      setSelectedBatch(null);
      setFormData({ name: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBatch(null);
    setFormData({ name: "", description: "" });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSaving(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.store_id) {
        toast.error("Usuário não está vinculado a uma fazenda");
        return;
      }

      // Check if name already exists (for a different batch)
      const { data: existingBatch } = await supabase
        .from("animal_batches")
        .select("id")
        .eq("store_id", profile.store_id)
        .eq("name", formData.name.trim())
        .maybeSingle();

      if (existingBatch && existingBatch.id !== selectedBatch?.id) {
        toast.error("Já existe um lote com este nome");
        setIsSaving(false);
        return;
      }

      if (selectedBatch) {
        // Update
        const { error } = await supabase
          .from("animal_batches")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq("id", selectedBatch.id);

        if (error) throw error;
        toast.success("Lote atualizado com sucesso");
      } else {
        // Insert
        const { error } = await supabase.from("animal_batches").insert({
          code: nextCode,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          store_id: profile.store_id,
        });

        if (error) throw error;
        toast.success("Lote cadastrado com sucesso");
      }

      handleCloseModal();
      fetchBatches();
    } catch (error: any) {
      console.error("Error saving batch:", error);
      toast.error("Erro ao salvar lote");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBatch) return;

    try {
      const { error } = await supabase
        .from("animal_batches")
        .delete()
        .eq("id", selectedBatch.id);

      if (error) throw error;

      toast.success("Lote excluído com sucesso");
      setIsDeleteDialogOpen(false);
      setSelectedBatch(null);
      fetchBatches();
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      toast.error("Erro ao excluir lote");
    }
  };

  const openDeleteDialog = async (batch: Batch) => {
    // Check if there are linked animals
    const { count } = await supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .eq("is_active", true);

    if (count && count > 0) {
      toast.error(`Não é possível excluir. Existem ${count} animal(is) vinculado(s) a este lote.`);
      return;
    }

    setSelectedBatch(batch);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Lotes</h1>
            <p className="text-sm text-muted-foreground">Gestão de lotes de animais</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Lotes Cadastrados</h2>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Lote
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum lote cadastrado</p>
            <p className="text-sm mt-2">Clique em "Cadastrar Lote" para adicionar o primeiro</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Cód</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Animais</TableHead>
                  <TableHead className="text-right">Peso Total</TableHead>
                  <TableHead className="w-24 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.code}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{batch.name}</span>
                        {batch.description && (
                          <p className="text-sm text-muted-foreground">{batch.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">-</TableCell>
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(batch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(batch)}
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
      </main>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedBatch ? "Editar Lote" : "Cadastrar Lote"}
            </DialogTitle>
            <DialogDescription>
              {selectedBatch
                ? "Edite as informações do lote"
                : "Preencha os dados para cadastrar um novo lote"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={selectedBatch ? selectedBatch.code : nextCode}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome do lote"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Digite uma descrição (opcional)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lote "{selectedBatch?.name}"? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisLotes;
