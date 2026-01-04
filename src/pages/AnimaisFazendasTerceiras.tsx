import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Home } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ThirdPartyFarm {
  id: string;
  code: number;
  name: string;
  city: string | null;
  owner: string | null;
  phone: string | null;
  is_active: boolean;
}

const AnimaisFazendasTerceiras = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [farms, setFarms] = useState<ThirdPartyFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<ThirdPartyFarm | null>(null);
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    city: "",
    owner: "",
    phone: "",
  });

  const fetchFarms = async () => {
    try {
      const { data, error } = await supabase
        .from("third_party_farms")
        .select("id, code, name, city, owner, phone, is_active")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) throw error;
      setFarms(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar fazendas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleOpenModal = async (farm?: ThirdPartyFarm) => {
    if (farm) {
      setSelectedFarm(farm);
      setFormData({
        code: farm.code,
        name: farm.name,
        city: farm.city || "",
        owner: farm.owner || "",
        phone: farm.phone || "",
      });
    } else {
      setSelectedFarm(null);
      try {
        const { data: nextCode } = await supabase.rpc(
          "get_next_third_party_farm_code"
        );
        setFormData({
          code: nextCode || 1,
          name: "",
          city: "",
          owner: "",
          phone: "",
        });
      } catch (error) {
        setFormData({
          code: 1,
          name: "",
          city: "",
          owner: "",
          phone: "",
        });
      }
    }
    setModalOpen(true);
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
      if (selectedFarm) {
        const { error } = await supabase
          .from("third_party_farms")
          .update({
            name: formData.name.trim(),
            city: formData.city.trim() || null,
            owner: formData.owner.trim() || null,
            phone: formData.phone.trim() || null,
          })
          .eq("id", selectedFarm.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fazenda atualizada com sucesso",
        });
      } else {
        const { error } = await supabase.from("third_party_farms").insert({
          code: formData.code,
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          owner: formData.owner.trim() || null,
          phone: formData.phone.trim() || null,
        });

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fazenda cadastrada com sucesso",
        });
      }

      setModalOpen(false);
      fetchFarms();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedFarm) return;

    try {
      const { error } = await supabase
        .from("third_party_farms")
        .update({ is_active: false })
        .eq("id", selectedFarm.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fazenda excluída com sucesso",
      });
      setDeleteDialogOpen(false);
      setSelectedFarm(null);
      fetchFarms();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/animais/cadastros-gerais")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Home className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Fazendas Terceiras
              </h1>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fazenda
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : farms.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhuma fazenda cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                farms.map((farm) => (
                  <TableRow key={farm.id}>
                    <TableCell className="font-medium">{farm.code}</TableCell>
                    <TableCell>{farm.name}</TableCell>
                    <TableCell>{farm.city || "-"}</TableCell>
                    <TableCell>{farm.owner || "-"}</TableCell>
                    <TableCell>{farm.phone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(farm)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedFarm(farm);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modal de Cadastro/Edição */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {selectedFarm ? "Editar Fazenda" : "Nova Fazenda"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  type="number"
                  value={formData.code}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Nome da fazenda"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Cidade"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner">Proprietário</Label>
                <Input
                  id="owner"
                  value={formData.owner}
                  onChange={(e) =>
                    setFormData({ ...formData, owner: e.target.value })
                  }
                  placeholder="Nome do proprietário"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a fazenda "{selectedFarm?.name}"?
                Esta ação não pode ser desfeita.
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
    </div>
  );
};

export default AnimaisFazendasTerceiras;
