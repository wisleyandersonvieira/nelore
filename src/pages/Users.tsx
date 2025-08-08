import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  store_id: string | null;
  created_at: string;
  user_stores?: { store_id: string }[];
}

interface Store {
  id: string;
  name: string;
  code: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          is_active,
          store_id,
          created_at,
          user_stores (
            store_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar usuários: " + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar lojas: " + error.message,
      });
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Usuário aprovado",
        description: "O usuário foi aprovado e pode acessar o sistema.",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao aprovar usuário: " + error.message,
      });
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Usuário rejeitado",
        description: "O acesso do usuário foi negado.",
        variant: "destructive",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao rejeitar usuário: " + error.message,
      });
    }
  };

  const handleAssignStores = async () => {
    if (!selectedUser || selectedStoreIds.length === 0) return;

    try {
      // Remove existing store assignments
      await supabase
        .from('user_stores')
        .delete()
        .eq('user_id', selectedUser.id);

      // Add new store assignments
      const userStoresData = selectedStoreIds.map(storeId => ({
        user_id: selectedUser.id,
        store_id: storeId
      }));

      const { error } = await supabase
        .from('user_stores')
        .insert(userStoresData);

      if (error) throw error;

      toast({
        title: "Lojas vinculadas",
        description: "Lojas foram vinculadas ao usuário com sucesso.",
      });

      setIsStoreDialogOpen(false);
      setSelectedUser(null);
      setSelectedStoreIds([]);
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao vincular lojas: " + error.message,
      });
    }
  };

  const openStoreDialog = (user: User) => {
    setSelectedUser(user);
    const userStoreIds = user.user_stores?.map(us => us.store_id) || [];
    setSelectedStoreIds(userStoreIds);
    setIsStoreDialogOpen(true);
  };

  const getStoreNames = (user: User) => {
    const userStoreIds = user.user_stores?.map(us => us.store_id) || [];
    if (userStoreIds.length === 0) return "Nenhuma";
    
    const storeNames = userStoreIds.map(storeId => {
      const store = stores.find(s => s.id === storeId);
      return store ? `${store.name} (${store.code})` : "Loja não encontrada";
    });
    
    return storeNames.join(", ");
  };

  const handleStoreToggle = (storeId: string) => {
    setSelectedStoreIds(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            onClick={() => navigate("/dashboard")}
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
            <p className="text-muted-foreground">
              Aprovar novos usuários e gerenciar lojas vinculadas
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Loja Vinculada</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Aprovado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStoreNames(user)}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {!user.is_active ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveUser(user.id)}
                                className="h-8"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectUser(user.id)}
                                className="h-8"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectUser(user.id)}
                              className="h-8"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Desativar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStoreDialog(user)}
                            className="h-8"
                          >
                            <Store className="h-4 w-4 mr-1" />
                            Loja
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

        {/* Dialog para vincular loja */}
        <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Lojas ao Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-sm font-medium">Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.name} ({selectedUser?.email})
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stores">Lojas</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id={store.id}
                        checked={selectedStoreIds.includes(store.id)}
                        onChange={() => handleStoreToggle(store.id)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={store.id} className="text-sm cursor-pointer">
                        {store.name} ({store.code})
                      </label>
                    </div>
                  ))}
                </div>
                {selectedStoreIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selecione pelo menos uma loja
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleAssignStores} 
                  className="flex-1"
                  disabled={selectedStoreIds.length === 0}
                >
                  Vincular Lojas
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsStoreDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Users;