import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ArrowLeft, Plus, Pencil, Trash2, FileText, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BreedingAnimal {
  id: string;
  name: string;
  sex: string;
  registration: string | null;
  store_id: string;
  sire_id: string | null;
  dam_id: string | null;
}

interface BreedingAnimalWithCounts extends BreedingAnimal {
  offspringCount: number;
  grandchildrenCount: number;
}

interface ActiveAnimalSummary {
  id: string;
  code: number | null;
  name: string;
  ear_tag: number | null;
  sex: string;
  sire_id: string | null;
  dam_id: string | null;
}

const AnimaisMatrizes = () => {
  const navigate = useNavigate();
  const [breedingAnimals, setBreedingAnimals] = useState<BreedingAnimalWithCounts[]>([]);
  const [allBreedingAnimals, setAllBreedingAnimals] = useState<BreedingAnimal[]>([]);
  const [activeAnimals, setActiveAnimals] = useState<ActiveAnimalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<BreedingAnimalWithCounts | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sex: "",
    registration: "",
    sire_id: "",
    dam_id: "",
  });
  const [filters, setFilters] = useState({
    name: "",
    sex: "",
  });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchBreedingAnimals();
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

  const buildBreedingAnimalsWithCounts = (
    allAnimals: BreedingAnimal[],
    activeAnimalRows: ActiveAnimalSummary[],
  ): BreedingAnimalWithCounts[] => {
    const offspringByParentId = new Map<string, Set<string>>();

    activeAnimalRows.forEach((animal) => {
      if (animal.sire_id) {
        if (!offspringByParentId.has(animal.sire_id)) {
          offspringByParentId.set(animal.sire_id, new Set());
        }
        offspringByParentId.get(animal.sire_id)!.add(animal.id);
      }

      if (animal.dam_id) {
        if (!offspringByParentId.has(animal.dam_id)) {
          offspringByParentId.set(animal.dam_id, new Set());
        }
        offspringByParentId.get(animal.dam_id)!.add(animal.id);
      }
    });

    const breedingChildrenByParentId = new Map<string, string[]>();
    allAnimals.forEach((animal) => {
      if (animal.sire_id) {
        const current = breedingChildrenByParentId.get(animal.sire_id) || [];
        current.push(animal.id);
        breedingChildrenByParentId.set(animal.sire_id, current);
      }

      if (animal.dam_id) {
        const current = breedingChildrenByParentId.get(animal.dam_id) || [];
        current.push(animal.id);
        breedingChildrenByParentId.set(animal.dam_id, current);
      }
    });

    return allAnimals.map((animal) => {
      const offspringCount = offspringByParentId.get(animal.id)?.size || 0;
      const childrenBreedingIds = breedingChildrenByParentId.get(animal.id) || [];
      const grandchildrenIds = new Set<string>();

      childrenBreedingIds.forEach((childId) => {
        const grandchildren = offspringByParentId.get(childId);
        if (!grandchildren) return;
        grandchildren.forEach((grandchildId) => grandchildrenIds.add(grandchildId));
      });

      return {
        ...animal,
        offspringCount,
        grandchildrenCount: grandchildrenIds.size,
      };
    });
  };

  const fetchBreedingAnimals = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        setIsLoading(false);
        return;
      }

      const storeId = await getUserStoreId(user.id);
      if (!storeId) {
        toast.error("Loja não encontrada");
        setIsLoading(false);
        return;
      }

      const [{ data: breedingData, error: breedingError }, { data: activeAnimalsData, error: animalsError }] = await Promise.all([
        supabase
          .from("breeding_animals")
          .select("id, name, sex, registration, store_id, sire_id, dam_id")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("animals")
          .select("id, code, name, ear_tag, sex, sire_id, dam_id")
          .eq("store_id", storeId)
          .eq("is_active", true),
      ]);

      if (breedingError) throw breedingError;
      if (animalsError) throw animalsError;

      const allAnimals = (breedingData || []) as BreedingAnimal[];
      const activeAnimalRows = (activeAnimalsData || []) as ActiveAnimalSummary[];

      setAllBreedingAnimals(allAnimals);
      setActiveAnimals(activeAnimalRows);
      setBreedingAnimals(buildBreedingAnimalsWithCounts(allAnimals, activeAnimalRows));
    } catch (error: any) {
      toast.error("Erro ao carregar matrizes e genitores: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (animal?: BreedingAnimalWithCounts) => {
    if (animal) {
      setSelectedAnimal(animal);
      setFormData({
        name: animal.name,
        sex: animal.sex,
        registration: animal.registration || "",
        sire_id: animal.sire_id || "",
        dam_id: animal.dam_id || "",
      });
    } else {
      setSelectedAnimal(null);
      setFormData({
        name: "",
        sex: "",
        registration: "",
        sire_id: "",
        dam_id: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.sex) {
      toast.error("Sexo é obrigatório");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const storeId = await getUserStoreId(user.id);
      if (!storeId) {
        toast.error("Loja não encontrada");
        return;
      }

      // Fetch user's matrix_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", user.id)
        .maybeSingle();

      // Check for duplicate name
      const { data: existingAnimal } = await supabase
        .from("breeding_animals")
        .select("id")
        .eq("store_id", storeId)
        .eq("name", formData.name.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (existingAnimal && (!selectedAnimal || existingAnimal.id !== selectedAnimal.id)) {
        toast.error("Já existe uma matriz/genitor com este nome");
        return;
      }

      const animalData: any = {
        name: formData.name.trim(),
        sex: formData.sex,
        registration: formData.registration.trim() || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        store_id: storeId,
        matrix_id: profileData?.matrix_id || null,
      };

      if (selectedAnimal) {
        const { error } = await supabase.from("breeding_animals").update(animalData).eq("id", selectedAnimal.id);

        if (error) throw error;
        toast.success("Matriz/Genitor atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("breeding_animals").insert(animalData);

        if (error) throw error;
        toast.success("Matriz/Genitor cadastrado com sucesso!");
      }

      setIsModalOpen(false);
      fetchBreedingAnimals();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedAnimal) return;

    try {
      const { error } = await supabase
        .from("breeding_animals")
        .update({ is_active: false })
        .eq("id", selectedAnimal.id);

      if (error) throw error;
      toast.success("Matriz/Genitor excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setSelectedAnimal(null);
      fetchBreedingAnimals();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const openDeleteDialog = async (animal: BreedingAnimalWithCounts) => {
    const totalLinked = animal.offspringCount;

    if (totalLinked > 0) {
      toast.error(`Não é possível excluir. Existem ${totalLinked} animal(is) vinculado(s) a esta matriz/genitor.`);
      return;
    }

    setSelectedAnimal(animal);
    setIsDeleteDialogOpen(true);
  };

  const generateOffspringReport = async (animal: BreedingAnimalWithCounts) => {
    try {
      const offspringData = activeAnimals
        .filter((offspring) => (animal.sex === "macho" ? offspring.sire_id === animal.id : offspring.dam_id === animal.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      if (offspringData.length === 0) {
        toast.info("Não há animais filhos ativos para este registro.");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Animais Filhos", pageWidth / 2, 20, { align: "center" });

      // Parent info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${animal.sex === "macho" ? "Reprodutor" : "Matriz"}: ${animal.name}`, 14, 35);
      if (animal.registration) {
        doc.text(`Registro: ${animal.registration}`, 14, 42);
      }
      doc.text(`Total de Filhos Ativos: ${offspringData.length}`, 14, animal.registration ? 49 : 42);

      // Table with offspring
      const tableData = offspringData.map((offspring) => [
        offspring.code?.toString() || "-",
        offspring.name,
        offspring.ear_tag?.toString() || "-",
        offspring.sex === "macho" ? "Macho" : "Fêmea",
      ]);

      autoTable(doc, {
        startY: animal.registration ? 55 : 48,
        head: [["Código", "Nome", "Brinco", "Sexo"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [236, 72, 153] },
      });

      // Footer with date
      const today = new Date().toLocaleDateString("pt-BR");
      doc.setFontSize(10);
      doc.text(`Gerado em: ${today}`, 14, doc.internal.pageSize.getHeight() - 10);

      doc.save(`relatorio_filhos_${animal.name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar relatório: " + error.message);
    }
  };

  const generateGrandchildrenReport = async (animal: BreedingAnimalWithCounts) => {
    try {
      // Get offspring breeding animals (filhos que são reprodutores/matrizes)
      const offspringBreedingIds = allBreedingAnimals
        .filter((ba) => ba.sire_id === animal.id || ba.dam_id === animal.id)
        .map((ba) => ba.id);

      if (offspringBreedingIds.length === 0) {
        toast.info("Não há animais netos ativos para este registro.");
        return;
      }

      const offspringBreedingSet = new Set(offspringBreedingIds);
      const uniqueGrandchildren = activeAnimals
        .filter(
          (grandchild) =>
            (grandchild.sire_id && offspringBreedingSet.has(grandchild.sire_id)) ||
            (grandchild.dam_id && offspringBreedingSet.has(grandchild.dam_id)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      if (uniqueGrandchildren.length === 0) {
        toast.info("Não há animais netos ativos para este registro.");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Animais Netos", pageWidth / 2, 20, { align: "center" });

      // Parent info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${animal.sex === "macho" ? "Reprodutor" : "Matriz"}: ${animal.name}`, 14, 35);
      if (animal.registration) {
        doc.text(`Registro: ${animal.registration}`, 14, 42);
      }
      doc.text(`Total de Netos Ativos: ${uniqueGrandchildren.length}`, 14, animal.registration ? 49 : 42);

      // Get parent names for the table
      const breedingAnimalNameById = new Map(allBreedingAnimals.map((breedingAnimal) => [breedingAnimal.id, breedingAnimal.name]));

      // Table with grandchildren
      const tableData = uniqueGrandchildren.map((gc) => [
        gc.code?.toString() || "-",
        gc.name,
        gc.ear_tag?.toString() || "-",
        gc.sex === "macho" ? "Macho" : "Fêmea",
        gc.sire_id ? breedingAnimalNameById.get(gc.sire_id) || "-" : "-",
        gc.dam_id ? breedingAnimalNameById.get(gc.dam_id) || "-" : "-",
      ]);

      autoTable(doc, {
        startY: animal.registration ? 55 : 48,
        head: [["Código", "Nome", "Brinco", "Sexo", "Pai", "Mãe"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [236, 72, 153] },
      });

      // Footer with date
      const today = new Date().toLocaleDateString("pt-BR");
      doc.setFontSize(10);
      doc.text(`Gerado em: ${today}`, 14, doc.internal.pageSize.getHeight() - 10);

      doc.save(`relatorio_netos_${animal.name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar relatório: " + error.message);
    }
  };

  const getSexLabel = (sex: string) => {
    return sex === "macho" ? "Macho" : "Fêmea";
  };

  // Get available sires (males) for dropdown, excluding the current animal being edited
  const availableSires = useMemo(
    () => allBreedingAnimals.filter((a) => a.sex === "macho" && (!selectedAnimal || a.id !== selectedAnimal.id)),
    [allBreedingAnimals, selectedAnimal],
  );

  // Get available dams (females) for dropdown, excluding the current animal being edited
  const availableDams = useMemo(
    () => allBreedingAnimals.filter((a) => a.sex === "femea" && (!selectedAnimal || a.id !== selectedAnimal.id)),
    [allBreedingAnimals, selectedAnimal],
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const filteredAnimals = useMemo(
    () =>
      breedingAnimals.filter((animal) => {
        const matchesName = animal.name.toLowerCase().includes(filters.name.toLowerCase());
        const matchesSex = !filters.sex || filters.sex === "todos" || animal.sex === filters.sex;
        return matchesName && matchesSex;
      }),
    [breedingAnimals, filters.name, filters.sex],
  );

  const sortedAnimals = useMemo(() => {
    const items = [...filteredAnimals];
    items.sort((a, b) => {
      if (!sortColumn) return 0;
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortColumn === "name") return a.name.localeCompare(b.name) * dir;
      if (sortColumn === "sex") return a.sex.localeCompare(b.sex) * dir;
      if (sortColumn === "offspringCount") return (a.offspringCount - b.offspringCount) * dir;
      if (sortColumn === "grandchildrenCount") return (a.grandchildrenCount - b.grandchildrenCount) * dir;
      return 0;
    });
    return items;
  }, [filteredAnimals, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedAnimals.length / itemsPerPage);
  const paginatedAnimals = useMemo(
    () => sortedAnimals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [currentPage, itemsPerPage, sortedAnimals],
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Matrizes & Genitores</h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <Button onClick={() => handleOpenModal()} className="bg-pink-500 hover:bg-pink-600">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filtrar por nome"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              className="w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={filters.sex} onValueChange={(value) => setFilters({ ...filters, sex: value })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="macho">Macho</SelectItem>
                <SelectItem value="femea">Fêmea</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">Nome <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("sex")}>
                  <div className="flex items-center gap-1">Sexo <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("offspringCount")}>
                  <div className="flex items-center gap-1">Animais Filhos Ativos <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("grandchildrenCount")}>
                  <div className="flex items-center gap-1">Animais Netos Ativos <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : paginatedAnimals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    Nenhuma matriz ou genitor encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAnimals.map((animal) => (
                  <TableRow key={animal.id} className="h-10">
                    <TableCell className="font-medium py-2">{animal.name}</TableCell>
                    <TableCell className="py-2">{getSexLabel(animal.sex)}</TableCell>
                    <TableCell className="py-2">{animal.registration || "-"}</TableCell>
                    <TableCell className="py-2">{animal.offspringCount}</TableCell>
                    <TableCell className="py-2">{animal.grandchildrenCount}</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                              <FileText className="h-3 w-3 mr-1" />
                              Relatório
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background">
                            <DropdownMenuItem onClick={() => generateOffspringReport(animal)}>
                              PDF - Animais Filhos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateGrandchildrenReport(animal)}>
                              PDF - Animais Netos
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenModal(animal)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDeleteDialog(animal)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({sortedAnimals.length} registros)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAnimal ? "Editar Matriz/Genitor" : "Cadastrar Matriz/Genitor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do animal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sexo *</Label>
              <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registro</Label>
              <Input
                id="registration"
                value={formData.registration}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                placeholder="Número de registro"
              />
            </div>

            {/* Genealogy Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-3">Genealogia</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sire_id">Nome do Reprodutor (Pai)</Label>
                  <Select
                    value={formData.sire_id || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, sire_id: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o reprodutor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {availableSires.map((sire) => (
                        <SelectItem key={sire.id} value={sire.id}>
                          {sire.name} {sire.registration ? `(${sire.registration})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dam_id">Nome da Matriz (Mãe)</Label>
                  <Select
                    value={formData.dam_id || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, dam_id: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a matriz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {availableDams.map((dam) => (
                        <SelectItem key={dam.id} value={dam.id}>
                          {dam.name} {dam.registration ? `(${dam.registration})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedAnimal?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisMatrizes;
