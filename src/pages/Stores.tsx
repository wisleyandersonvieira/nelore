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

interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  created_at: string;
  updated_at: string;
}

const Stores = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState("register");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    manager_name: "",
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as lojas.",
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
        description: "Nome da loja é obrigatório.",
      });
      return;
    }

    if (!formData.code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código da loja é obrigatório.",
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
        description: "Erro ao verificar código da loja.",
      });
      return;
    }

    if (existingStore && (!editingStore || existingStore.id !== editingStore.id)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe uma loja cadastrada com este código.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingStore) {
        const { error } = await supabase
          .from("stores")
          .update(formData)
          .eq("id", editingStore.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Loja atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("stores")
          .insert([formData]);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Loja cadastrada com sucesso!",
        });
      }

      resetForm();
      await fetchStores();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a loja.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (store: Store) => {
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address || "",
      phone: store.phone || "",
      manager_name: store.manager_name || "",
    });
    setEditingStore(store);
    setActiveTab("register");
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`Tem certeza que deseja excluir a loja ${store.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Loja excluída com sucesso!",
      });
      
      await fetchStores();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a loja.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      phone: "",
      manager_name: "",
    });
    setEditingStore(null);
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.code.includes(searchTerm)
  );

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
            <h1 className="text-2xl font-bold text-primary">Lojas</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de lojas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register">Cadastro</TabsTrigger>
            <TabsTrigger value="list">Exibir Cadastros</TabsTrigger>
          </TabsList>

          {/* Register Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingStore ? "Editar Loja" : "Nova Loja"}
                </CardTitle>
                <CardDescription>
                  {editingStore 
                    ? "Atualize as informações da loja" 
                    : "Preencha os dados da nova loja"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Código *</Label>
                      <Input
                        id="code"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Código único da loja"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Loja *</Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome da loja"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
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

                  <div className="flex space-x-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : (editingStore ? "Atualizar" : "Cadastrar")}
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
                <CardTitle>Lista de Lojas</CardTitle>
                <CardDescription>
                  Gerencie todas as lojas cadastradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Gerente</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredStores.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Nenhuma loja encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStores.map((store) => (
                          <TableRow key={store.id}>
                            <TableCell className="font-medium">
                              {store.name}
                            </TableCell>
                            <TableCell>
                              {store.code}
                            </TableCell>
                            <TableCell>
                              {store.phone || "-"}
                            </TableCell>
                            <TableCell>
                              {store.manager_name || "-"}
                            </TableCell>
                            <TableCell>
                              {store.address || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(store)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(store)}
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