import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";

interface Store {
  id: string;
  name: string;
  code: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  opening_date: string | null;
  matrix_id: string;
  created_at: string;
  updated_at: string;
}

const Stores = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [userStoreIds, setUserStoreIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [userMatrixId, setUserMatrixId] = useState<string>("");
  const [userMatrixName, setUserMatrixName] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, canDelete, loading: permissionsLoading } = useCadastrosPermissions();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    cnpj: "",
    address: "",
    phone: "",
    manager_name: "",
    opening_date: "",
    matrix_id: "",
  });

  useEffect(() => {
    fetchUserMatrix();
    fetchStores();
    fetchUserStores();
  }, []);

  const fetchUserMatrix = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase.from("profiles").select("matrix_id").eq("id", user.id).single();

      if (error || !profile?.matrix_id) {
        console.error("Error fetching user matrix:", error);
        return;
      }

      const { data: matrix, error: matrixError } = await supabase
        .from("matrices")
        .select("id, code, name")
        .eq("id", profile.matrix_id)
        .single();

      if (matrixError || !matrix) {
        console.error("Error fetching matrix:", matrixError);
        return;
      }

      setUserMatrixId(matrix.id);
      setUserMatrixName(`${matrix.code} - ${matrix.name}`);
      setFormData((prev) => ({ ...prev, matrix_id: matrix.id }));
    } catch (error) {
      console.error("Error in fetchUserMatrix:", error);
    }
  };

  // Adicionar useEffect para atualizar quando mudar de aba
  useEffect(() => {
    if (activeTab === "list") {
      fetchStores();
      fetchUserStores();
    }
  }, [activeTab]);

  const fetchUserStores = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from("user_stores").select("store_id").eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user stores:", error);
        return;
      }

      setUserStoreIds((data || []).map((us) => us.store_id));
    } catch (error) {
      console.error("Error in fetchUserStores:", error);
    }
  };

  const fetchStores = async () => {
    setLoading(true);
    try {
      console.log("Fetching stores...");
      const { data, error } = await supabase.from("stores").select("*").order("name");

      console.log("Stores data:", data);
      if (error) {
        console.error("Error fetching stores:", error);
        throw error;
      }
      setStores(data || []);
    } catch (error) {
      console.error("Error in fetchStores:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as fazendas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da fazenda é obrigatório.",
      });
      return;
    }

    if (!formData.code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código da fazenda é obrigatório.",
      });
      return;
    }

    // Validar código duplicado
    const { data: existingStore, error: checkError } = await supabase
      .from("stores")
      .select("id")
      .eq("code", formData.code)
      .maybeSingle();

    if (checkError) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao verificar código da fazenda.",
      });
      return;
    }

    if (existingStore && (!editingStore || existingStore.id !== editingStore.id)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe uma fazenda cadastrada com este código.",
      });
      return;
    }

    // Validar CNPJ duplicado se preenchido
    if (formData.cnpj.trim()) {
      const { data: existingCnpj, error: cnpjError } = await supabase
        .from("stores")
        .select("id")
        .eq("cnpj", formData.cnpj)
        .maybeSingle();

      if (cnpjError) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Erro ao verificar CNPJ da fazenda.",
        });
        return;
      }

      if (existingCnpj && (!editingStore || existingCnpj.id !== editingStore.id)) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Já existe uma fazenda cadastrada com este CNPJ.",
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (editingStore) {
        const { error } = await supabase.from("stores").update(formData).eq("id", editingStore.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fazenda atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase.from("stores").insert([formData]);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fazenda cadastrada com sucesso!",
        });
      }

      resetForm();
      setActiveTab("list"); // Muda para a aba de listagem
      await fetchStores();
    } catch (error) {
      console.error("Error saving store:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a fazenda.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (store: Store) => {
    setFormData({
      name: store.name,
      code: store.code,
      cnpj: store.cnpj || "",
      address: store.address || "",
      phone: store.phone || "",
      manager_name: store.manager_name || "",
      opening_date: store.opening_date || "",
      matrix_id: store.matrix_id,
    });
    setEditingStore(store);
    setActiveTab("register");
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`Tem certeza que deseja excluir a fazenda ${store.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      console.log("Deleting store:", store.id);
      const { error } = await supabase.from("stores").delete().eq("id", store.id);

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }

      console.log("Store deleted successfully");
      toast({
        title: "Sucesso",
        description: "Fazenda excluída com sucesso!",
      });

      await fetchStores();
    } catch (error) {
      console.error("Error deleting store:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a fazenda.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      cnpj: "",
      address: "",
      phone: "",
      manager_name: "",
      opening_date: "",
      matrix_id: userMatrixId,
    });
    setEditingStore(null);
  };

  const formatCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, "");

    if (cleaned.length <= 14) {
      const formatted = formatCnpj(cleaned);
      setFormData({ ...formData, cnpj: formatted });
    }
  };

  const filteredStores = stores.filter((store) => {
    // Se não tem permissão de edição, filtra apenas as fazendas vinculadas ao usuário
    if (!canEdit && !userStoreIds.includes(store.id)) {
      return false;
    }

    if (!searchTerm.trim()) return true; // Se não há termo de busca, mostra todos

    const searchLower = searchTerm.toLowerCase();
    return (
      store.name.toLowerCase().includes(searchLower) ||
      store.code.toLowerCase().includes(searchLower) ||
      (store.cnpj && store.cnpj.includes(searchTerm))
    );
  });

  console.log("All stores:", stores);
  console.log("Search term:", searchTerm);
  console.log("Filtered stores:", filteredStores);

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Fazendas</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de fazendas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={canEdit ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            {canEdit && <TabsTrigger value="register">Cadastro</TabsTrigger>}
            <TabsTrigger value="list">Exibir Cadastros</TabsTrigger>
          </TabsList>

          {/* Register Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>{editingStore ? "Editar Fazenda" : "Nova Fazenda"}</CardTitle>
                <CardDescription>
                  {editingStore ? "Atualize as informações da fazenda" : "Preencha os dados da nova fazeda"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Campo Matriz - sempre visível mas não editável */}
                  <div className="space-y-2">
                    <Label htmlFor="matrix">Matriz *</Label>
                    <Input id="matrix" value={userMatrixName} disabled className="bg-muted" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Código *</Label>
                      <Input
                        id="code"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Código único da fazenda"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <Input
                        id="cnpj"
                        required
                        value={formData.cnpj}
                        onChange={handleCnpjChange}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Fazenda *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome da fazenda"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="opening_date">Data de Abertura</Label>
                      <Input
                        id="opening_date"
                        type="date"
                        value={formData.opening_date}
                        onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manager_name">Gerente</Label>
                      <Input
                        id="manager_name"
                        value={formData.manager_name}
                        onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                        placeholder="Nome do gerente"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Endereço completo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : editingStore ? "Atualizar" : "Cadastrar"}
                    </Button>
                    {editingStore && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Fazendas</CardTitle>
                <CardDescription>Gerencie todas as fazendas cadastradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, código ou CNPJ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table className="table-sticky-first table-sticky-last">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Gerente</TableHead>
                        <TableHead>Data Abertura</TableHead>
                        {(canEdit || canDelete) && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredStores.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            {stores.length === 0
                              ? "Nenhuma fazenda cadastrada"
                              : "Nenhuma fazenda encontrada para a busca"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStores.map((store) => (
                          <TableRow key={store.id}>
                            <TableCell className="font-medium">{store.name}</TableCell>
                            <TableCell>{store.code}</TableCell>
                            <TableCell>{store.cnpj || "-"}</TableCell>
                            <TableCell>{store.phone || "-"}</TableCell>
                            <TableCell>{store.manager_name || "-"}</TableCell>
                            <TableCell>
                              {store.opening_date ? new Date(store.opening_date).toLocaleDateString("pt-BR") : "-"}
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {canEdit && (
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(store)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button variant="outline" size="sm" onClick={() => handleDelete(store)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Stores;
