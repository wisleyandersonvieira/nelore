import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Check,
  X,
  Store,
  Settings,
  UserCog,
  UserPlus,
  ShieldAlert,
  KeyRound,
  Loader2,
  Users as UsersIcon,
  Building2,
  Tag,
  Search,
  MoreVertical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateUserModal from "@/components/CreateUserModal";
import { ResetPasswordModal } from "@/components/ResetPasswordModal";

import MatricesTab from "@/components/MatricesTab";
import BrandsTab from "@/components/BrandsTab";

interface Matrix {
  id: string;
  name: string;
  code: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  store_id: string | null;
  profile_id: string | null;
  matrix_id: string | null;
  created_at: string;
  user_stores?: { store_id: string }[];
  user_profiles?: { name: string };
  matrices?: { name: string; code: number };
}

interface Store {
  id: string;
  name: string;
  code: string;
  matrix_id: string;
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isMasterUser, setIsMasterUser] = useState(false);
  const [isMatrixUser, setIsMatrixUser] = useState(false);
  const [currentUserMatrixId, setCurrentUserMatrixId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("users");

  // Filtros
  const [filterMatrixId, setFilterMatrixId] = useState<string>("all");
  const [filterProfileId, setFilterProfileId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterName, setFilterName] = useState<string>("");

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchStores();
    fetchProfiles();
    fetchMatrices();
    checkAdminStatus();
  }, []);

  // Recarregar matrizes ao voltar para aba de usuários (caso tenha criado nova matriz)
  useEffect(() => {
    if (activeTab === "users") {
      fetchMatrices();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          name,
          email,
          is_active,
          store_id,
          profile_id,
          matrix_id,
          created_at,
          user_stores (
            store_id
          ),
          user_profiles (
            name
          ),
          matrices (
            name,
            code
          )
        `,
        )
        .order("created_at", { ascending: false });

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
      const { data, error } = await supabase.from("stores").select("id, name, code, matrix_id").order("name");

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

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar perfis: " + error.message,
      });
    }
  };

  const fetchMatrices = async () => {
    try {
      const { data, error } = await supabase
        .from("matrices")
        .select("id, name, code")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setMatrices(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar matrizes: " + error.message,
      });
    }
  };

  const checkAdminStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, email, matrix_id, profile_id")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
      // setIsMasterUser(profile?.email === "wisley_anderson@hotmail.com"); alterar
      setIsMasterUser(profile?.role === "admin");
      setCurrentUserEmail(profile?.email);
      setCurrentUserMatrixId(profile?.matrix_id || null);

      // Verificar se o usuário tem perfil "Matriz"
      if (profile?.profile_id) {
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("id", profile.profile_id)
          .maybeSingle();

        setIsMatrixUser(userProfile?.name === "Matriz");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const openResetPasswordModal = (user: User) => {
    setResetPasswordUser({ id: user.id, name: user.name, email: user.email });
    setIsResetPasswordOpen(true);
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", userId);

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
      const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);

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
      await supabase.from("user_stores").delete().eq("user_id", selectedUser.id);

      // Add new store assignments
      const userStoresData = selectedStoreIds.map((storeId) => ({
        user_id: selectedUser.id,
        store_id: storeId,
      }));

      const { error } = await supabase.from("user_stores").insert(userStoresData);

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
    const userStoreIds = user.user_stores?.map((us) => us.store_id) || [];
    setSelectedStoreIds(userStoreIds);
    setIsStoreDialogOpen(true);
  };

  const handleStoreToggle = (storeId: string) => {
    setSelectedStoreIds((prev) => (prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]));
  };

  const openProfileDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedProfileId(user.profile_id || "");
    setIsProfileDialogOpen(true);
  };

  const handleAssignProfile = async () => {
    if (!selectedUser || !selectedProfileId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ profile_id: selectedProfileId })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast({
        title: "Perfil vinculado",
        description: "Perfil foi vinculado ao usuário com sucesso.",
      });

      setIsProfileDialogOpen(false);
      setSelectedUser(null);
      setSelectedProfileId("");
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao vincular perfil: " + error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Somente usuário mestre ou com perfil Matriz podem acessar esta página
  if (!isMasterUser && !isMatrixUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <ShieldAlert className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-semibold">Acesso Negado</h2>
              <p className="text-muted-foreground">Somente usuários com perfil Matriz podem acessar esta página.</p>
              <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
              <p className="text-muted-foreground">Gerenciar usuários, perfis e matrizes do sistema</p>
            </div>
          </div>

          <div className="flex gap-2">
            {activeTab === "users" && (
              <Button onClick={() => setIsCreateUserOpen(true)} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Novo Usuário
              </Button>
            )}
            <Button onClick={() => navigate("/profiles")} variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Gestão de Perfis
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            {isMasterUser && (
              <TabsTrigger value="matrices" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Matriz
              </TabsTrigger>
            )}
            {isMasterUser && (
              <TabsTrigger value="brands" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Marca
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users">
            {/* Quadro de Filtros */}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Filtro por Matriz - apenas para usuário mestre */}
                  {isMasterUser && (
                    <div className="space-y-2">
                      <Label>Matriz</Label>
                      <Select value={filterMatrixId} onValueChange={setFilterMatrixId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as matrizes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as matrizes</SelectItem>
                          {matrices.map((matrix) => (
                            <SelectItem key={matrix.id} value={matrix.id}>
                              {matrix.code} - {matrix.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Filtro por Perfil */}
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Select value={filterProfileId} onValueChange={setFilterProfileId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os perfis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os perfis</SelectItem>
                        <SelectItem value="none">Sem perfil</SelectItem>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="active">Aprovado</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Busca por Nome */}
                  <div className="space-y-2">
                    <Label>Buscar por nome</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite o nome..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                      <TableHead>Matriz</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Data Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter((user) => {
                      // Primeiro: filtro por matriz (visibilidade)
                      if (!isMasterUser) {
                        if (isMatrixUser && currentUserMatrixId) {
                          if (user.matrix_id !== currentUserMatrixId) return false;
                        } else {
                          if (user.matrix_id !== currentUserMatrixId) return false;
                        }
                      }

                      // Filtro por matriz (selecionado no dropdown) - apenas para usuário mestre
                      if (isMasterUser && filterMatrixId !== "all" && user.matrix_id !== filterMatrixId) {
                        return false;
                      }

                      // Filtro por perfil
                      if (filterProfileId !== "all") {
                        if (filterProfileId === "none" && user.profile_id !== null) return false;
                        if (filterProfileId !== "none" && user.profile_id !== filterProfileId) return false;
                      }

                      // Filtro por status
                      if (filterStatus !== "all") {
                        if (filterStatus === "active" && !user.is_active) return false;
                        if (filterStatus === "pending" && user.is_active) return false;
                      }

                      // Filtro por nome
                      if (filterName.trim() !== "") {
                        if (!user.name.toLowerCase().includes(filterName.toLowerCase())) return false;
                      }

                      return true;
                    }).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      users
                        .filter((user) => {
                          // Primeiro: filtro por matriz (visibilidade)
                          if (!isMasterUser) {
                            if (isMatrixUser && currentUserMatrixId) {
                              if (user.matrix_id !== currentUserMatrixId) return false;
                            } else {
                              if (user.matrix_id !== currentUserMatrixId) return false;
                            }
                          }

                          // Filtro por matriz (selecionado no dropdown) - apenas para usuário mestre
                          if (isMasterUser && filterMatrixId !== "all" && user.matrix_id !== filterMatrixId) {
                            return false;
                          }

                          // Filtro por perfil
                          if (filterProfileId !== "all") {
                            if (filterProfileId === "none" && user.profile_id !== null) return false;
                            if (filterProfileId !== "none" && user.profile_id !== filterProfileId) return false;
                          }

                          // Filtro por status
                          if (filterStatus !== "all") {
                            if (filterStatus === "active" && !user.is_active) return false;
                            if (filterStatus === "pending" && user.is_active) return false;
                          }

                          // Filtro por nome
                          if (filterName.trim() !== "") {
                            if (!user.name.toLowerCase().includes(filterName.toLowerCase())) return false;
                          }

                          return true;
                        })
                        .map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.is_active ? "default" : "secondary"}>
                                {user.is_active ? "Aprovado" : "Pendente"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.matrices ? `${user.matrices.code} - ${user.matrices.name}` : "-"}
                            </TableCell>
                            <TableCell>{user.user_profiles?.name || "Nenhum perfil"}</TableCell>
                            <TableCell>{new Date(user.created_at).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end items-center">
                                {!user.is_active ? (
                                  <>
                                    <Button size="sm" onClick={() => handleApproveUser(user.id)} className="h-8">
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
                                ) : null}

                                {/* Dropdown de Configurações */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-8">
                                      <Settings className="h-4 w-4 mr-1" />
                                      Configurações
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    {user.is_active && (
                                      <DropdownMenuItem onClick={() => handleRejectUser(user.id)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Desativar
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => openProfileDialog(user)}>
                                      <UserCog className="h-4 w-4 mr-2" />
                                      Perfil
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openStoreDialog(user)}>
                                      <Store className="h-4 w-4 mr-2" />
                                      Fazenda
                                    </DropdownMenuItem>
                                    {(isMasterUser || isMatrixUser) && (
                                      <DropdownMenuItem onClick={() => openResetPasswordModal(user)}>
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        Redefinir Senha
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matrices">
            <MatricesTab />
          </TabsContent>

          <TabsContent value="brands">
            <BrandsTab />
          </TabsContent>
        </Tabs>

        {/* Dialog para vincular fazenda */}
        <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Fazendas ao Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-sm font-medium">Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.name} ({selectedUser?.email})
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stores">Fazendas</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  {stores
                    .filter((store) => {
                      // Filtrar fazendas pela matriz do usuário selecionado
                      if (selectedUser?.matrix_id) {
                        return store.matrix_id === selectedUser.matrix_id;
                      }
                      return true;
                    })
                    .length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhuma fazenda cadastrada para esta matriz. Cadastre uma fazenda primeiro.
                      </p>
                    ) : (
                    stores
                    .filter((store) => {
                      if (selectedUser?.matrix_id) {
                        return store.matrix_id === selectedUser.matrix_id;
                      }
                      return true;
                    })
                    .map((store) => (
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
                    ))
                  )}
                </div>
                {selectedStoreIds.length === 0 && stores.filter(s => selectedUser?.matrix_id ? s.matrix_id === selectedUser.matrix_id : true).length > 0 && (
                  <p className="text-sm text-muted-foreground">Selecione pelo menos uma fazenda</p>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAssignStores} className="flex-1" disabled={selectedStoreIds.length === 0}>
                  Vincular Fazendas
                </Button>
                <Button variant="outline" onClick={() => setIsStoreDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog para vincular perfil */}
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Perfil ao Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-sm font-medium">Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.name} ({selectedUser?.email})
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile">Perfil</Label>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                        {profile.description && (
                          <span className="text-muted-foreground ml-2">- {profile.description}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAssignProfile} className="flex-1" disabled={!selectedProfileId}>
                  Vincular Perfil
                </Button>
                <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para criar usuário */}
        <CreateUserModal
          isOpen={isCreateUserOpen}
          onClose={() => setIsCreateUserOpen(false)}
          onSuccess={fetchUsers}
          stores={stores}
          profiles={profiles}
          matrices={matrices}
          currentUserEmail={currentUserEmail}
        />

        {/* Modal para redefinir senha */}
        <ResetPasswordModal open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen} user={resetPasswordUser} />
      </div>
    </div>
  );
};

export default Users;
