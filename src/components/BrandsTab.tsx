import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, ChevronsUpDown, X, Check } from "lucide-react";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { cn } from "@/lib/utils";

interface Brand {
  id: string;
  name: string;
  contact: string | null;
  is_active: boolean;
  created_at: string;
  authorized_group_users: string[] | null;
  authorized_subgroup_users: string[] | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const BrandsTab = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [viewingBrand, setViewingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    contact: "",
    authorized_group_users: [] as string[],
    authorized_subgroup_users: [] as string[]
  });
  const [groupUsersOpen, setGroupUsersOpen] = useState(false);
  const [subgroupUsersOpen, setSubgroupUsersOpen] = useState(false);
  const { matrixId } = useUserMatrix();

  useEffect(() => {
    fetchBrands();
    fetchUsers();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error('Error fetching brands:', error);
      toast.error("Erro ao carregar marcas");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("O nome da marca é obrigatório");
      return;
    }

    if (!matrixId) {
      toast.error("Erro ao identificar a matriz do usuário");
      return;
    }

    try {
      if (editingBrand) {
        const { error } = await supabase
          .from('brands')
          .update({
            name: formData.name.trim(),
            contact: formData.contact.trim() || null,
            authorized_group_users: formData.authorized_group_users,
            authorized_subgroup_users: formData.authorized_subgroup_users
          })
          .eq('id', editingBrand.id);

        if (error) throw error;
        toast.success("Marca atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('brands')
          .insert({
            name: formData.name.trim(),
            contact: formData.contact.trim() || null,
            matrix_id: matrixId,
            authorized_group_users: formData.authorized_group_users,
            authorized_subgroup_users: formData.authorized_subgroup_users
          });

        if (error) throw error;
        toast.success("Marca cadastrada com sucesso!");
      }

      setIsFormOpen(false);
      setEditingBrand(null);
      setFormData({ name: "", contact: "", authorized_group_users: [], authorized_subgroup_users: [] });
      fetchBrands();
    } catch (error: any) {
      console.error('Error saving brand:', error);
      toast.error("Erro ao salvar marca: " + error.message);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      contact: brand.contact || "",
      authorized_group_users: brand.authorized_group_users || [],
      authorized_subgroup_users: brand.authorized_subgroup_users || []
    });
    setIsFormOpen(true);
  };

  const handleView = (brand: Brand) => {
    setViewingBrand(brand);
    setIsViewOpen(true);
  };

  const handleDelete = async (brandId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta marca?")) return;

    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;
      toast.success("Marca excluída com sucesso!");
      fetchBrands();
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error("Erro ao excluir marca: " + error.message);
    }
  };

  const openNewForm = () => {
    setEditingBrand(null);
    setFormData({ name: "", contact: "", authorized_group_users: [], authorized_subgroup_users: [] });
    setIsFormOpen(true);
  };

  const toggleUserSelection = (userId: string, field: 'authorized_group_users' | 'authorized_subgroup_users') => {
    setFormData(prev => {
      const currentUsers = prev[field];
      const isSelected = currentUsers.includes(userId);
      return {
        ...prev,
        [field]: isSelected
          ? currentUsers.filter(id => id !== userId)
          : [...currentUsers, userId]
      };
    });
  };

  const removeUser = (userId: string, field: 'authorized_group_users' | 'authorized_subgroup_users') => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(id => id !== userId)
    }));
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || user?.email || 'Usuário não encontrado';
  };

  const getSelectedUserNames = (userIds: string[] | null) => {
    if (!userIds || userIds.length === 0) return "Nenhum usuário selecionado";
    return userIds.map(id => getUserName(id)).join(", ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Marcas Cadastradas</CardTitle>
          <Button onClick={openNewForm} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Marca
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhuma marca cadastrada. Clique em "Nova Marca" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>{brand.contact || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(brand)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(brand)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(brand.id)}
                          className="text-destructive hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Editar Marca" : "Nova Marca"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da marca"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contato</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="Telefone, email ou responsável"
              />
            </div>

            {/* Multi-select para usuários autorizados - Grupo */}
            <div className="space-y-2">
              <Label>Usuários autorizados criar/editar grupo</Label>
              <Popover open={groupUsersOpen} onOpenChange={setGroupUsersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={groupUsersOpen}
                    className="w-full justify-between h-auto min-h-10"
                  >
                    <span className="text-left truncate">
                      {formData.authorized_group_users.length > 0
                        ? `${formData.authorized_group_users.length} usuário(s) selecionado(s)`
                        : "Selecionar usuários..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-50" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name || user.email}
                            onSelect={() => toggleUserSelection(user.id, 'authorized_group_users')}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.authorized_group_users.includes(user.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{user.name || "Sem nome"}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formData.authorized_group_users.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.authorized_group_users.map((userId) => (
                    <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                      {getUserName(userId)}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeUser(userId, 'authorized_group_users')}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-select para usuários autorizados - Subgrupo */}
            <div className="space-y-2">
              <Label>Usuários autorizados criar/editar subgrupo</Label>
              <Popover open={subgroupUsersOpen} onOpenChange={setSubgroupUsersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={subgroupUsersOpen}
                    className="w-full justify-between h-auto min-h-10"
                  >
                    <span className="text-left truncate">
                      {formData.authorized_subgroup_users.length > 0
                        ? `${formData.authorized_subgroup_users.length} usuário(s) selecionado(s)`
                        : "Selecionar usuários..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-50" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name || user.email}
                            onSelect={() => toggleUserSelection(user.id, 'authorized_subgroup_users')}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.authorized_subgroup_users.includes(user.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{user.name || "Sem nome"}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formData.authorized_subgroup_users.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.authorized_subgroup_users.map((userId) => (
                    <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                      {getUserName(userId)}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeUser(userId, 'authorized_subgroup_users')}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                {editingBrand ? "Salvar" : "Cadastrar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Nome</Label>
              <p className="text-lg font-medium">{viewingBrand?.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Contato</Label>
              <p className="text-lg">{viewingBrand?.contact || "-"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Usuários autorizados criar/editar grupo</Label>
              <p className="text-sm">{getSelectedUserNames(viewingBrand?.authorized_group_users)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Usuários autorizados criar/editar subgrupo</Label>
              <p className="text-sm">{getSelectedUserNames(viewingBrand?.authorized_subgroup_users)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Data de Cadastro</Label>
              <p className="text-lg">
                {viewingBrand?.created_at
                  ? new Date(viewingBrand.created_at).toLocaleDateString('pt-BR')
                  : "-"}
              </p>
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => setIsViewOpen(false)}
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BrandsTab;
