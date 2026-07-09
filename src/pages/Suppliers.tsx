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
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface Supplier {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj_cpf: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  store_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState("register");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { matrixId, matrixName } = useUserMatrix();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    trade_name: "",
    cnpj_cpf: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    contact_person: "",
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);


  const formatCnpjCpf = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    
    if (cleaned.length <= 11) {
      // CPF format: 000.000.000-00
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else {
      // CNPJ format: 00.000.000/0000-00
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
  };

  const handleCnpjCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, "");
    
    if (cleaned.length <= 14) {
      const formatted = formatCnpjCpf(cleaned);
      setFormData({ ...formData, cnpj_cpf: formatted });
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Razão Social é obrigatória.",
      });
      return;
    }

    // Validar CNPJ/CPF duplicado
    if (formData.cnpj_cpf.trim()) {
      const { data: existingSupplier, error: checkError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("cnpj_cpf", formData.cnpj_cpf)
        .eq("matrix_id", matrixId)
        .eq("is_active", true)
        .maybeSingle();

      if (checkError) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Erro ao verificar CNPJ/CPF.",
        });
        return;
      }

      if (existingSupplier && (!editingSupplier || existingSupplier.id !== editingSupplier.id)) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Já existe um fornecedor cadastrado com este CNPJ/CPF.",
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(formData)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fornecedor atualizado com sucesso!",
        });
      } else {
        if (!matrixId) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Matriz do usuário não encontrada.",
          });
          return;
        }
        
        const { error } = await supabase
          .from("suppliers")
          .insert([{ ...formData, matrix_id: matrixId }]);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fornecedor cadastrado com sucesso!",
        });
      }

      resetForm();
      await fetchSuppliers();
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

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      trade_name: supplier.trade_name || "",
      cnpj_cpf: supplier.cnpj_cpf || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      contact_person: supplier.contact_person || "",
    });
    setEditingSupplier(supplier);
    setActiveTab("register");
  };

  const handleDelete = async (supplier: Supplier) => {
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

      toast({
        title: "Sucesso",
        description: "Fornecedor excluído com sucesso!",
      });
      
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

  const resetForm = () => {
    setFormData({
      name: "",
      trade_name: "",
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

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.trade_name && supplier.trade_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.cnpj_cpf && supplier.cnpj_cpf.includes(searchTerm))
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
            <h1 className="text-2xl font-bold text-primary">Fornecedores</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de fornecedores</p>
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
                  {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
                </CardTitle>
                <CardDescription>
                  {editingSupplier 
                    ? "Atualize as informações do fornecedor" 
                    : "Preencha os dados do novo fornecedor"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Campo Matriz (somente leitura) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Matriz</Label>
                      <Input 
                        value={matrixName || 'Carregando...'} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnpj_cpf">CNPJ</Label>
                       <Input
                         id="cnpj_cpf"
                         value={formData.cnpj_cpf}
                         onChange={handleCnpjCpfChange}
                         placeholder="00.000.000/0000-00"
                       />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="name">Razão Social *</Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome da empresa"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trade_name">Nome Fantasia</Label>
                    <Input
                      id="trade_name"
                      value={formData.trade_name}
                      onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                      placeholder="Nome fantasia da empresa"
                    />
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
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Cidade"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="Estado"
                      />
                    </div>
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
                      <Label htmlFor="contact_person">Pessoa de Contato</Label>
                      <Input
                        id="contact_person"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@empresa.com"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : (editingSupplier ? "Atualizar" : "Cadastrar")}
                    </Button>
                    {editingSupplier && (
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
                <CardTitle>Lista de Fornecedores</CardTitle>
                <CardDescription>
                  Gerencie todos os fornecedores cadastrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CNPJ..."
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
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Última Compra</TableHead>
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
                      ) : filteredSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Nenhum fornecedor encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSuppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium">
                              {supplier.name}
                            </TableCell>
                            <TableCell>
                              {supplier.cnpj_cpf || "-"}
                            </TableCell>
                            <TableCell>
                              {supplier.phone || "-"}
                            </TableCell>
                            <TableCell>
                              {supplier.city || "-"}
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">
                                Não disponível
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(supplier)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(supplier)}
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

export default Suppliers;