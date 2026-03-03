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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Batch {
  id: string;
  code: number;
  name: string;
  description: string | null;
  store_id: string;
  created_at: string;
  updated_at: string;
}

interface BatchWithCount extends Batch {
  animalCount: number;
}

interface Animal {
  id: string;
  name: string;
  code: number;
  batch_id: string | null;
}

const AnimaisLotes = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [nextCode, setNextCode] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
  }, []);

  const getUserStoreId = async (userId: string): Promise<string | null> => {
    const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userId).single();
    if (profile?.store_id) return profile.store_id;

    const { data: userStore } = await supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return userStore?.store_id || null;
  };

  const fetchBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        setIsLoading(false);
        return;
      }

      const activeStoreId = await getUserStoreId(user.id);
      if (!activeStoreId) {
        toast.error("Usuário não está vinculado a uma fazenda");
        setIsLoading(false);
        return;
      }

      setStoreId(activeStoreId);

      const { data, error } = await supabase
        .from("animal_batches")
        .select("*")
        .eq("store_id", activeStoreId)
        .order("code", { ascending: true });

      if (error) throw error;

      // Fetch animal counts for each batch
      const batchesWithCounts: BatchWithCount[] = await Promise.all(
        (data || []).map(async (batch) => {
          const { count } = await supabase
            .from("animals")
            .select("*", { count: "exact", head: true })
            .eq("batch_id", batch.id)
            .eq("is_active", true);

          return {
            ...batch,
            animalCount: count || 0,
          };
        })
      );

      setBatches(batchesWithCounts);

      // Get next code
      const { data: nextCodeData } = await supabase.rpc("get_next_animal_batch_code", {
        store_uuid: activeStoreId,
      });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const activeStoreId = await getUserStoreId(user.id);
      if (!activeStoreId) {
        toast.error("Usuário não está vinculado a uma fazenda");
        return;
      }

      // Check if name already exists (for a different batch)
      const { data: existingBatch } = await supabase
        .from("animal_batches")
        .select("id")
        .eq("store_id", activeStoreId)
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
          store_id: activeStoreId,
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

  const fetchAnimalsForBatch = async (batchId: string): Promise<Animal[]> => {
    const { data, error } = await supabase
      .from("animals")
      .select("id, name, code, batch_id")
      .eq("batch_id", batchId)
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) {
      console.error("Error fetching animals:", error);
      return [];
    }
    return data || [];
  };

  const generatePDFReport = async (batch: BatchWithCount) => {
    try {
      const animals = await fetchAnimalsForBatch(batch.id);

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text("Relatório de Lote", 14, 22);

      // Batch info
      doc.setFontSize(12);
      doc.text(`Código: ${batch.code}`, 14, 35);
      doc.text(`Nome: ${batch.name}`, 14, 42);
      if (batch.description) {
        doc.text(`Descrição: ${batch.description}`, 14, 49);
      }
      doc.text(`Total de Animais: ${batch.animalCount}`, 14, batch.description ? 56 : 49);

      // Animals table
      if (animals.length > 0) {
        const startY = batch.description ? 65 : 58;
        doc.setFontSize(14);
        doc.text("Animais Vinculados", 14, startY);

        autoTable(doc, {
          startY: startY + 5,
          head: [["Código", "Nome"]],
          body: animals.map((animal) => [animal.code.toString(), animal.name]),
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246] },
        });
      } else {
        const startY = batch.description ? 65 : 58;
        doc.setFontSize(12);
        doc.text("Nenhum animal vinculado a este lote.", 14, startY);
      }

      doc.save(`lote_${batch.code}_${batch.name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Relatório PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar relatório PDF");
    }
  };

  const generateExcelReport = async (batch: BatchWithCount) => {
    try {
      const animals = await fetchAnimalsForBatch(batch.id);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();

      // Batch info data
      const batchInfo = [
        ["Relatório de Lote"],
        [],
        ["Código", batch.code],
        ["Nome", batch.name],
        ["Descrição", batch.description || "-"],
        ["Total de Animais", batch.animalCount],
        [],
        ["Animais Vinculados"],
        ["Código", "Nome"],
      ];

      // Add animals data
      animals.forEach((animal) => {
        batchInfo.push([animal.code.toString(), animal.name]);
      });

      if (animals.length === 0) {
        batchInfo.push(["Nenhum animal vinculado a este lote.", ""]);
      }

      const ws = XLSX.utils.aoa_to_sheet(batchInfo);

      // Set column widths
      ws["!cols"] = [{ wch: 15 }, { wch: 40 }];

      XLSX.utils.book_append_sheet(wb, ws, "Lote");

      XLSX.writeFile(wb, `lote_${batch.code}_${batch.name.replace(/\s+/g, "_")}.xlsx`);
      toast.success("Relatório Excel gerado com sucesso!");
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Erro ao gerar relatório Excel");
    }
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
                  <TableHead className="w-32 text-center">Ações</TableHead>
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
                    <TableCell className="text-center">
                      <span className={batch.animalCount > 0 ? "font-medium" : "text-muted-foreground"}>
                        {batch.animalCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="Relatório">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => generatePDFReport(batch)}>
                              <FileText className="h-4 w-4 mr-2" />
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateExcelReport(batch)}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(batch)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(batch)}>
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
            <DialogTitle>{selectedBatch ? "Editar Lote" : "Cadastrar Lote"}</DialogTitle>
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
              Tem certeza que deseja excluir o lote "{selectedBatch?.name}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisLotes;
