import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Laboratory {
  id: string;
  code: number;
  name: string;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  observations: string | null;
  store_id: string;
  is_active: boolean;
}

const initialForm = { code: 0, name: "", city: "", state: "", contact_name: "", phone: "", email: "", observations: "" };

const AnimaisLaboratorios = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Laboratory | null>(null);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchItems(); }, []);

  const getStoreId = async (): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userData.user.id).maybeSingle();
    if (profile?.store_id) return profile.store_id;
    const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1);
    return userStores?.[0]?.store_id || null;
  };

  const fetchItems = async () => {
    try {
      const storeId = await getStoreId();
      if (!storeId) return;
      const { data, error } = await supabase.from("laboratories").select("*").eq("store_id", storeId).eq("is_active", true).order("code", { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching laboratories:", error);
      toast({ title: "Erro", description: "Erro ao carregar laboratórios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (item?: Laboratory, viewMode = false) => {
    setIsViewMode(viewMode);
    if (item) {
      setSelected(item);
      setFormData({ code: item.code, name: item.name, city: item.city || "", state: item.state || "", contact_name: item.contact_name || "", phone: item.phone || "", email: item.email || "", observations: item.observations || "" });
    } else {
      setSelected(null);
      try {
        const storeId = await getStoreId();
        if (!storeId) return;
        const { data } = await supabase.rpc("get_next_laboratory_code", { store_uuid: storeId });
        setFormData({ ...initialForm, code: data || 1 });
      } catch (error) { console.error("Error getting next code:", error); }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setSelected(null); setIsViewMode(false); setFormData(initialForm); };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "O nome é obrigatório", variant: "destructive" });
      return;
    }
    try {
      const storeId = await getStoreId();
      if (!storeId) return;
      const payload = { name: formData.name, city: formData.city || null, state: formData.state || null, contact_name: formData.contact_name || null, phone: formData.phone || null, email: formData.email || null, observations: formData.observations || null };
      if (selected) {
        const { error } = await supabase.from("laboratories").update(payload).eq("id", selected.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Laboratório atualizado com sucesso" });
      } else {
        const { error } = await supabase.from("laboratories").insert({ ...payload, code: formData.code, store_id: storeId });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Laboratório cadastrado com sucesso" });
      }
      handleCloseModal();
      fetchItems();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao salvar", variant: "destructive" });
    }
  };

  const openDeleteDialog = (item: Laboratory) => { setSelected(item); setIsDeleteDialogOpen(true); };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.from("laboratories").update({ is_active: false }).eq("id", selected.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Laboratório excluído com sucesso" });
      setIsDeleteDialogOpen(false); setSelected(null); fetchItems();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao excluir", variant: "destructive" });
    }
  };

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/animais/cadastros-gerais")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Laboratórios</h1>
        </div>
        <div className="mb-4">
          <Button onClick={() => handleOpenModal()} className="bg-blue-500 hover:bg-blue-600">
            <Plus className="h-4 w-4 mr-2" /> Cadastrar
          </Button>
        </div>
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-4">Carregando...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum laboratório cadastrado</TableCell></TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id} className="h-10">
                  <TableCell className="py-2">{item.code}</TableCell>
                  <TableCell className="font-medium py-2">{item.name}</TableCell>
                  <TableCell className="py-2">{item.city || "-"}</TableCell>
                  <TableCell className="py-2">{item.state || "-"}</TableCell>
                  <TableCell className="py-2">{item.contact_name || "-"}</TableCell>
                  <TableCell className="py-2">{item.phone || "-"}</TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="icon" className="h-10 md:h-8 w-10 md:w-8" onClick={() => handleOpenModal(item, true)}><Eye className="h-3 w-3" /></Button>
                      <Button variant="outline" size="icon" className="h-10 md:h-8 w-10 md:w-8" onClick={() => handleOpenModal(item)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="icon" className="h-10 md:h-8 w-10 md:w-8" onClick={() => openDeleteDialog(item)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isViewMode ? "Visualizar Laboratório" : selected ? "Editar Laboratório" : "Cadastrar Laboratório"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input type="number" value={formData.code} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={formData.name} onChange={e => set("name", e.target.value)} disabled={isViewMode} placeholder="Nome do laboratório" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={formData.city} onChange={e => set("city", e.target.value)} disabled={isViewMode} placeholder="Cidade" />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={formData.state} onChange={e => set("state", e.target.value)} disabled={isViewMode} placeholder="UF" maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contato (Nome)</Label>
                <Input value={formData.contact_name} onChange={e => set("contact_name", e.target.value)} disabled={isViewMode} placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.phone} onChange={e => set("phone", e.target.value)} disabled={isViewMode} placeholder="Telefone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => set("email", e.target.value)} disabled={isViewMode} placeholder="Email" />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={formData.observations} onChange={e => set("observations", e.target.value)} disabled={isViewMode} placeholder="Observações" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>{isViewMode ? "Fechar" : "Cancelar"}</Button>
            {!isViewMode && <Button onClick={handleSave} className="bg-blue-500 hover:bg-blue-600">Salvar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o laboratório "{selected?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisLaboratorios;
