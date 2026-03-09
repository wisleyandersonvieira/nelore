import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Category {
  id: string;
  code: number;
  name: string;
  store_id: string;
  is_active: boolean;
}

const AnimaisCategorias = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const getStoreId = async (): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.store_id) return profile.store_id;
    const { data: userStores } = await supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", userData.user.id)
      .limit(1);
    return userStores?.[0]?.store_id || null;
  };

  const fetchCategories = async () => {
    try {
      const storeId = await getStoreId();
      if (!storeId) return;

      const { data, error } = await supabase
        .from("animal_categories")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextCode = async (storeId: string): Promise<number> => {
    const { data, error } = await supabase.rpc("get_next_animal_category_code", {
      store_uuid: storeId,
    });
    if (error) throw error;
    return data;
  };

  const handleOpenModal = async (category?: Category, viewMode = false) => {
    setIsViewMode(viewMode);
    if (category) {
      setSelectedCategory(category);
      setFormData({
        code: category.code,
        name: category.name,
      });
    } else {
      setSelectedCategory(null);
      try {
        const storeId = await getStoreId();
        if (!storeId) return;

        const nextCode = await getNextCode(storeId);
        setFormData({
          code: nextCode,
          name: "",
        });
      } catch (error) {
        console.error("Error getting next code:", error);
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setIsViewMode(false);
    setFormData({ code: 0, name: "" });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.store_id) return;

      if (selectedCategory) {
        const { error } = await supabase
          .from("animal_categories")
          .update({ name: formData.name })
          .eq("id", selectedCategory.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("animal_categories").insert({
          code: formData.code,
          name: formData.name,
          store_id: profile.store_id,
        });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria cadastrada com sucesso" });
      }

      handleCloseModal();
      fetchCategories();
    } catch (error: any) {
      console.error("Error saving category:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar categoria",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = async (category: Category) => {
    // Check if there are linked animals
    const { count } = await supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("category_id", category.id)
      .eq("is_active", true);

    if (count && count > 0) {
      toast({
        title: "Erro",
        description: `Não é possível excluir. Existem ${count} animal(is) vinculado(s) a esta categoria.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from("animal_categories")
        .update({ is_active: false })
        .eq("id", selectedCategory.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Categoria excluída com sucesso" });
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/animais/cadastros-gerais")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
        </div>

        <div className="mb-4">
          <Button onClick={() => handleOpenModal()} className="bg-teal-500 hover:bg-teal-600">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    Nenhuma categoria cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} className="h-10">
                    <TableCell className="py-2">{category.code}</TableCell>
                    <TableCell className="font-medium py-2">{category.name}</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenModal(category, true)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenModal(category)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDeleteDialog(category)}
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

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isViewMode ? "Visualizar Categoria" : selectedCategory ? "Editar Categoria" : "Cadastrar Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                type="number"
                value={formData.code}
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
                disabled={isViewMode}
                placeholder="Digite o nome da categoria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button onClick={handleSave} className="bg-teal-500 hover:bg-teal-600">
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{selectedCategory?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisCategorias;
