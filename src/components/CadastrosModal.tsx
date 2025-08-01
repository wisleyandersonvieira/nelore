import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Store {
  id: string;
  name: string;
  code: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  opening_date: string | null;
  created_at: string;
  updated_at: string;
}

interface AccountGroup {
  id: string;
  name: string;
  code: string;
  account_type: string;
  parent_id: string | null;
  created_at: string;
}

interface CadastrosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CadastrosModal = ({ open, onOpenChange }: CadastrosModalProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingAccountGroup, setEditingAccountGroup] = useState<AccountGroup | null>(null);
  const [activeMainTab, setActiveMainTab] = useState("suppliers");
  const [activeSubTab, setActiveSubTab] = useState("register");
  const { toast } = useToast();

  // Form states
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    cnpj_cpf: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    contact_person: "",
  });

  const [storeForm, setStoreForm] = useState({
    name: "",
    code: "",
    cnpj: "",
    address: "",
    phone: "",
    manager_name: "",
    opening_date: "",
  });

  const [accountGroupForm, setAccountGroupForm] = useState({
    name: "",
    code: "",
    account_type: "",
    parent_id: "",
  });

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchStores();
      fetchAccountGroups();
    }
  }, [open]);

  useEffect(() => {
    if (activeMainTab === "suppliers") {
      fetchSuppliers();
    } else if (activeMainTab === "stores") {
      fetchStores();
    } else if (activeMainTab === "plano-contas") {
      fetchAccountGroups();
    }
  }, [activeMainTab]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os fornecedores.",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const fetchAccountGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_groups")
        .select("*")
        .order("account_type", { ascending: true })
        .order("code");

      if (error) throw error;
      setAccountGroups(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar o plano de contas.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Supplier functions
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Razão Social é obrigatória.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(supplierForm)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Fornecedor atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert([supplierForm]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Fornecedor cadastrado com sucesso!" });
      }

      resetSupplierForm();
      await fetchSuppliers();
      setActiveSubTab("list");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar o fornecedor.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Store functions
  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da loja é obrigatório.",
      });
      return;
    }

    if (!storeForm.code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código da loja é obrigatório.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingStore) {
        const { error } = await supabase
          .from("stores")
          .update(storeForm)
          .eq("id", editingStore.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Loja atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("stores")
          .insert([storeForm]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Loja cadastrada com sucesso!" });
      }

      resetStoreForm();
      await fetchStores();
      setActiveSubTab("list");
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

  // Account Group functions
  const handleAccountGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountGroupForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da categoria é obrigatório.",
      });
      return;
    }

    if (!accountGroupForm.code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código é obrigatório.",
      });
      return;
    }

    if (!accountGroupForm.account_type) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Tipo da conta é obrigatório.",
      });
      return;
    }

    setLoading(true);
    try {
      const formData = {
        name: accountGroupForm.name,
        code: accountGroupForm.code,
        account_type: accountGroupForm.account_type as "receita" | "despesa" | "ativo" | "passivo",
        parent_id: accountGroupForm.parent_id || null,
      };

      if (editingAccountGroup) {
        const { error } = await supabase
          .from("account_groups")
          .update(formData)
          .eq("id", editingAccountGroup.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("account_groups")
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria cadastrada com sucesso!" });
      }

      resetAccountGroupForm();
      await fetchAccountGroups();
      setActiveSubTab("list");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a categoria.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset functions
  const resetSupplierForm = () => {
    setSupplierForm({
      name: "",
      cnpj_cpf: "",
      address: "",
      city: "",
      state: "",
      phone: "",
      email: "",
      contact_person: "",
    });
    setEditingSupplier(null);
  };

  const resetStoreForm = () => {
    setStoreForm({
      name: "",
      code: "",
      cnpj: "",
      address: "",
      phone: "",
      manager_name: "",
      opening_date: "",
    });
    setEditingStore(null);
  };

  const resetAccountGroupForm = () => {
    setAccountGroupForm({
      name: "",
      code: "",
      account_type: "",
      parent_id: "",
    });
    setEditingAccountGroup(null);
  };

  // Edit functions
  const handleEditSupplier = (supplier: Supplier) => {
    setSupplierForm({
      name: supplier.name,
      cnpj_cpf: supplier.cnpj_cpf || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      contact_person: supplier.contact_person || "",
    });
    setEditingSupplier(supplier);
    setActiveSubTab("register");
  };

  const handleEditStore = (store: Store) => {
    setStoreForm({
      name: store.name,
      code: store.code,
      cnpj: store.cnpj || "",
      address: store.address || "",
      phone: store.phone || "",
      manager_name: store.manager_name || "",
      opening_date: store.opening_date || "",
    });
    setEditingStore(store);
    setActiveSubTab("register");
  };

  const handleEditAccountGroup = (accountGroup: AccountGroup) => {
    setAccountGroupForm({
      name: accountGroup.name,
      code: accountGroup.code,
      account_type: accountGroup.account_type,
      parent_id: accountGroup.parent_id || "",
    });
    setEditingAccountGroup(accountGroup);
    setActiveSubTab("register");
  };

  // Delete functions
  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Tem certeza que deseja excluir o fornecedor ${supplier.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", supplier.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Fornecedor excluído com sucesso!" });
      await fetchSuppliers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o fornecedor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStore = async (store: Store) => {
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
      toast({ title: "Sucesso", description: "Loja excluída com sucesso!" });
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

  const handleDeleteAccountGroup = async (accountGroup: AccountGroup) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria ${accountGroup.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("account_groups")
        .delete()
        .eq("id", accountGroup.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Categoria excluída com sucesso!" });
      await fetchAccountGroups();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a categoria.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter functions
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.cnpj_cpf && supplier.cnpj_cpf.includes(searchTerm))
  );

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.cnpj && store.cnpj.includes(searchTerm))
  );

  const filteredAccountGroups = accountGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.account_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get parent categories for subcategory selection
  const parentCategories = accountGroups.filter(group => !group.parent_id);

  // Get account type display name
  const getAccountTypeDisplay = (type: string) => {
    const types: { [key: string]: string } = {
      'receita': 'Receita',
      'despesa': 'Despesa',
      'ativo': 'Ativo',
      'passivo': 'Passivo',
      'patrimonio': 'Patrimônio',
    };
    return types[type] || type;
  };

  // Get parent name
  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = accountGroups.find(group => group.id === parentId);
    return parent ? parent.name : '-';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Cadastros</DialogTitle>
          <DialogDescription>
            Gerencie todos os cadastros do sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            <TabsTrigger value="stores">Lojas</TabsTrigger>
            <TabsTrigger value="plano-contas">Plano de Contas</TabsTrigger>
          </TabsList>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="mt-4">
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="register">Cadastro</TabsTrigger>
                <TabsTrigger value="list">Listagem</TabsTrigger>
              </TabsList>

              <TabsContent value="register" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSupplierSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplier-cnpj">CNPJ</Label>
                          <Input
                            id="supplier-cnpj"
                            value={supplierForm.cnpj_cpf}
                            onChange={(e) => setSupplierForm({ ...supplierForm, cnpj_cpf: e.target.value })}
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-name">Razão Social *</Label>
                          <Input
                            id="supplier-name"
                            required
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            placeholder="Nome da empresa"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplier-address">Endereço</Label>
                          <Input
                            id="supplier-address"
                            value={supplierForm.address}
                            onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                            placeholder="Endereço completo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-phone">Telefone</Label>
                          <Input
                            id="supplier-phone"
                            value={supplierForm.phone}
                            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={loading}>
                          {loading ? "Salvando..." : (editingSupplier ? "Atualizar" : "Cadastrar")}
                        </Button>
                        {editingSupplier && (
                          <Button type="button" variant="outline" onClick={resetSupplierForm}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="list" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Lista de Fornecedores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar fornecedores..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div className="rounded-md border max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : filteredSuppliers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                Nenhum fornecedor encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSuppliers.map((supplier) => (
                              <TableRow key={supplier.id}>
                                <TableCell className="font-medium">{supplier.name}</TableCell>
                                <TableCell>{supplier.cnpj_cpf || "-"}</TableCell>
                                <TableCell>{supplier.phone || "-"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditSupplier(supplier)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteSupplier(supplier)}
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
          </TabsContent>

          {/* Stores Tab */}
          <TabsContent value="stores" className="mt-4">
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="register">Cadastro</TabsTrigger>
                <TabsTrigger value="list">Listagem</TabsTrigger>
              </TabsList>

              <TabsContent value="register" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingStore ? "Editar Loja" : "Nova Loja"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleStoreSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="store-code">Código *</Label>
                          <Input
                            id="store-code"
                            required
                            value={storeForm.code}
                            onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                            placeholder="Código único da loja"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="store-name">Nome da Loja *</Label>
                          <Input
                            id="store-name"
                            required
                            value={storeForm.name}
                            onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                            placeholder="Nome da loja"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="store-cnpj">CNPJ</Label>
                          <Input
                            id="store-cnpj"
                            value={storeForm.cnpj}
                            onChange={(e) => setStoreForm({ ...storeForm, cnpj: e.target.value })}
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="store-phone">Telefone</Label>
                          <Input
                            id="store-phone"
                            value={storeForm.phone}
                            onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={loading}>
                          {loading ? "Salvando..." : (editingStore ? "Atualizar" : "Cadastrar")}
                        </Button>
                        {editingStore && (
                          <Button type="button" variant="outline" onClick={resetStoreForm}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="list" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Lista de Lojas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar lojas..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div className="rounded-md border max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : filteredStores.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                Nenhuma loja encontrada
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredStores.map((store) => (
                              <TableRow key={store.id}>
                                <TableCell className="font-medium">{store.name}</TableCell>
                                <TableCell>{store.code}</TableCell>
                                <TableCell>{store.cnpj || "-"}</TableCell>
                                <TableCell>{store.phone || "-"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditStore(store)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteStore(store)}
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
          </TabsContent>

          {/* Chart of Accounts Tab */}
          <TabsContent value="plano-contas" className="mt-4">
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="register">Cadastro</TabsTrigger>
                <TabsTrigger value="list">Listagem</TabsTrigger>
              </TabsList>

              <TabsContent value="register" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingAccountGroup ? "Editar Categoria" : "Nova Categoria"}
                    </CardTitle>
                    <CardDescription>
                      Configure as categorias e subcategorias do plano de contas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAccountGroupSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="account-code">Código *</Label>
                          <Input
                            id="account-code"
                            required
                            value={accountGroupForm.code}
                            onChange={(e) => setAccountGroupForm({ ...accountGroupForm, code: e.target.value })}
                            placeholder="Ex: 1.1, 2.1.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="account-name">Nome da Categoria *</Label>
                          <Input
                            id="account-name"
                            required
                            value={accountGroupForm.name}
                            onChange={(e) => setAccountGroupForm({ ...accountGroupForm, name: e.target.value })}
                            placeholder="Nome da categoria"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="account-type">Tipo de Conta *</Label>
                          <Select 
                            value={accountGroupForm.account_type} 
                            onValueChange={(value) => setAccountGroupForm({ ...accountGroupForm, account_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receita">Receita</SelectItem>
                              <SelectItem value="despesa">Despesa</SelectItem>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="passivo">Passivo</SelectItem>
                              <SelectItem value="patrimonio">Patrimônio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="parent-category">Categoria Pai (para subcategorias)</Label>
                          <Select 
                            value={accountGroupForm.parent_id} 
                            onValueChange={(value) => setAccountGroupForm({ ...accountGroupForm, parent_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria pai" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Nenhuma (categoria principal)</SelectItem>
                              {parentCategories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={loading}>
                          {loading ? "Salvando..." : (editingAccountGroup ? "Atualizar" : "Cadastrar")}
                        </Button>
                        {editingAccountGroup && (
                          <Button type="button" variant="outline" onClick={resetAccountGroupForm}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="list" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Plano de Contas</CardTitle>
                    <CardDescription>
                      Estrutura hierárquica das categorias financeiras
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar categorias..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div className="rounded-md border max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Categoria Pai</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : filteredAccountGroups.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                Nenhuma categoria encontrada
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredAccountGroups.map((group) => (
                              <TableRow key={group.id}>
                                <TableCell className="font-mono">{group.code}</TableCell>
                                <TableCell className="font-medium">{group.name}</TableCell>
                                <TableCell>{getAccountTypeDisplay(group.account_type)}</TableCell>
                                <TableCell>{getParentName(group.parent_id)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditAccountGroup(group)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteAccountGroup(group)}
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

                    {/* Plano de Contas Example Table */}
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-4">Estrutura Sugerida do Plano de Contas</h3>
                      <div className="rounded-md border p-4 bg-muted/50">
                        <div className="grid grid-cols-3 gap-4 font-medium border-b pb-2 mb-2">
                          <div>Grupo</div>
                          <div>Categoria</div>
                          <div>Subcategoria</div>
                        </div>
                        
                        {/* Receitas */}
                        <div className="space-y-1 mb-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="font-medium text-green-600">Receita</div>
                            <div>Vendas</div>
                            <div>Vendas à Vista</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div></div>
                            <div>Vendas a Prazo</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div>Serviços</div>
                            <div>Prestação de Serviços</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div>Outras Receitas</div>
                            <div>Juros Recebidos</div>
                          </div>
                        </div>

                        {/* Despesas */}
                        <div className="space-y-1 mb-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="font-medium text-red-600">Despesa</div>
                            <div>Operacionais</div>
                            <div>Salários e Encargos</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div></div>
                            <div>Aluguel</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div></div>
                            <div>Energia Elétrica</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div>Comerciais</div>
                            <div>Compra de Mercadorias</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div></div>
                            <div>Frete e Carreto</div>
                          </div>
                        </div>

                        {/* Transferências */}
                        <div className="space-y-1 mb-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="font-medium text-blue-600">Ativo</div>
                            <div>Circulante</div>
                            <div>Caixa</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div></div>
                            <div>Bancos</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div>Não Circulante</div>
                            <div>Imobilizado</div>
                          </div>
                        </div>

                        {/* Investimentos */}
                        <div className="space-y-1">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="font-medium text-purple-600">Patrimônio</div>
                            <div>Capital Social</div>
                            <div>Capital Integralizado</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div></div>
                            <div>Lucros/Prejuízos</div>
                            <div>Lucros Acumulados</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};