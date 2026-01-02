import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BreedingAnimal {
  id: string;
  name: string;
  sex: string;
  registration: string | null;
  store_id: string;
}

const AnimaisMatrizes = () => {
  const navigate = useNavigate();
  const [breedingAnimals, setBreedingAnimals] = useState<BreedingAnimal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<BreedingAnimal | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sex: "",
    registration: "",
  });
  const [filters, setFilters] = useState({
    name: "",
    sex: "",
  });

  useEffect(() => {
    fetchBreedingAnimals();
  }, []);

  const fetchBreedingAnimals = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!profile?.store_id) {
        toast.error("Loja não encontrada");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("breeding_animals")
        .select("*")
        .eq("store_id", profile.store_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setBreedingAnimals(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar matrizes e genitores: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (animal?: BreedingAnimal) => {
    if (animal) {
      setSelectedAnimal(animal);
      setFormData({
        name: animal.name,
        sex: animal.sex,
        registration: animal.registration || "",
      });
    } else {
      setSelectedAnimal(null);
      setFormData({
        name: "",
        sex: "",
        registration: "",
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!profile?.store_id) {
        toast.error("Loja não encontrada");
        return;
      }

      // Check for duplicate name
      const { data: existingAnimal } = await supabase
        .from("breeding_animals")
        .select("id")
        .eq("store_id", profile.store_id)
        .eq("name", formData.name.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (existingAnimal && (!selectedAnimal || existingAnimal.id !== selectedAnimal.id)) {
        toast.error("Já existe uma matriz/genitor com este nome");
        return;
      }

      const animalData = {
        name: formData.name.trim(),
        sex: formData.sex,
        registration: formData.registration.trim() || null,
        store_id: profile.store_id,
      };

      if (selectedAnimal) {
        const { error } = await supabase
          .from("breeding_animals")
          .update(animalData)
          .eq("id", selectedAnimal.id);

        if (error) throw error;
        toast.success("Matriz/Genitor atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("breeding_animals")
          .insert(animalData);

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

  const openDeleteDialog = (animal: BreedingAnimal) => {
    setSelectedAnimal(animal);
    setIsDeleteDialogOpen(true);
  };

  const getSexLabel = (sex: string) => {
    return sex === "macho" ? "Macho" : "Fêmea";
  };

  const filteredAnimals = breedingAnimals.filter((animal) => {
    const matchesName = animal.name.toLowerCase().includes(filters.name.toLowerCase());
    const matchesSex = !filters.sex || filters.sex === "todos" || animal.sex === filters.sex;
    return matchesName && matchesSex;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/animais")}>
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
            <Select
              value={filters.sex}
              onValueChange={(value) => setFilters({ ...filters, sex: value })}
            >
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
                <TableHead>Nome</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Animais Filhos Ativos</TableHead>
                <TableHead>Animais Netos Ativos</TableHead>
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
              ) : filteredAnimals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    Nenhuma matriz ou genitor encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAnimals.map((animal) => (
                  <TableRow key={animal.id} className="h-10">
                    <TableCell className="font-medium py-2">{animal.name}</TableCell>
                    <TableCell className="py-2">{getSexLabel(animal.sex)}</TableCell>
                    <TableCell className="py-2">{animal.registration || "-"}</TableCell>
                    <TableCell className="text-muted-foreground py-2">-</TableCell>
                    <TableCell className="text-muted-foreground py-2">-</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex justify-end gap-1">
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
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAnimal ? "Editar Matriz/Genitor" : "Cadastrar Matriz/Genitor"}
            </DialogTitle>
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
              <Select
                value={formData.sex}
                onValueChange={(value) => setFormData({ ...formData, sex: value })}
              >
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
              Tem certeza que deseja excluir "{selectedAnimal?.name}"? Esta ação não pode ser
              desfeita.
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
