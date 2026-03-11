import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
  is_supplier: boolean;
  is_creditor: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

interface SuppliersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SuppliersModal = ({ open, onOpenChange, canEdit = true, canDelete = true }: SuppliersModalProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState(canEdit ? "register" : "list");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { matrixId, matrixName } = useUserMatrix();
  
  const ITEMS_PER_PAGE = 10;

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
    is_supplier: true,
    is_creditor: false,
    is_owner: false,
  });

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  // Função removida - fornecedores são globais agora

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
        const updateData = {
          name: formData.name,
          trade_name: formData.trade_name || null,
          cnpj_cpf: formData.cnpj_cpf || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          is_supplier: formData.is_supplier,
          is_creditor: formData.is_creditor,
          is_owner: formData.is_owner,
        };
        const { error } = await supabase
          .from("suppliers")
          .update(updateData)
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

        const insertData = {
          name: formData.name,
          trade_name: formData.trade_name || null,
          cnpj_cpf: formData.cnpj_cpf || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null,
          email: formData.email || null,
          contact_person: formData.contact_person || null,
          is_supplier: formData.is_supplier,
          is_creditor: formData.is_creditor,
          is_owner: formData.is_owner,
          matrix_id: matrixId,
        };

        console.log("Inserting supplier:", insertData);

        const { error } = await supabase
          .from("suppliers")
          .insert([insertData]);

        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
        toast({
          title: "Sucesso",
          description: "Fornecedor cadastrado com sucesso!",
        });
      }

      resetForm();
      await fetchSuppliers();
      setActiveTab("list");
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
      is_supplier: supplier.is_supplier ?? true,
      is_creditor: supplier.is_creditor ?? false,
      is_owner: supplier.is_owner ?? false,
    });
    setEditingSupplier(supplier);
    setActiveTab("register");
  };

  const handleDelete = async (supplier: Supplier) => {
    setLoading(true);
    try {
      // Verificar se existem contas a pagar relacionadas ao fornecedor
      const { data: relatedAccounts, error: checkError } = await supabase
        .from("accounts_payable")
        .select("id")
        .eq("supplier_id", supplier.id)
        .limit(1);

      if (checkError) throw checkError;

      if (relatedAccounts && relatedAccounts.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este fornecedor possui contas a pagar vinculadas e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      if (!confirm(`Tem certeza que deseja excluir o fornecedor ${supplier.name}?`)) {
        setLoading(false);
        return;
      }

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
      is_supplier: true,
      is_creditor: false,
      is_owner: false,
    });
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.cnpj_cpf && supplier.cnpj_cpf.includes(searchTerm))
  );

  // Pagination
  const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
         <DialogTitle>Cadastros</DialogTitle>
          <DialogDescription>
            Cadastro e gestão de fornecedores, credores e proprietários
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={canEdit ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            {canEdit && (
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            )}
            <TabsTrigger value="list">Exibir Cadastros</TabsTrigger>
          </TabsList>

          {/* Register Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
               <CardTitle>
                  {editingSupplier ? "Editar Cadastro" : "Novo Cadastro"}
                </CardTitle>
                <CardDescription>
                  {editingSupplier 
                    ? "Atualize as informações do cadastro" 
                    : "Preencha os dados do novo cadastro"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Campo Matriz e Tipo de Cadastro */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Matriz</Label>
                        <Input 
                          value={matrixName || 'Carregando...'} 
                          disabled 
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Cadastro</Label>
                        <div className="flex items-center gap-6 h-10">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="is_supplier"
                              checked={formData.is_supplier}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_supplier: !!checked })}
                            />
                            <Label htmlFor="is_supplier" className="cursor-pointer font-normal">Fornecedor</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="is_creditor"
                              checked={formData.is_creditor}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_creditor: !!checked })}
                            />
                            <Label htmlFor="is_creditor" className="cursor-pointer font-normal">Credor</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="is_owner"
                              checked={formData.is_owner}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_owner: !!checked })}
                            />
                            <Label htmlFor="is_owner" className="cursor-pointer font-normal">Proprietário</Label>
                          </div>
                        </div>
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
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Cadastros</CardTitle>
                <CardDescription>
                  Gerencie todos os cadastros
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

                <ScrollArea className="h-[400px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade</TableHead>
                        {(canEdit || canDelete) && (
                          <TableHead className="text-right">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : paginatedSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Nenhum cadastro encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSuppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium">
                              {supplier.name}
                            </TableCell>
                            <TableCell>
                              {supplier.cnpj_cpf || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {supplier.is_supplier && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Fornecedor</span>}
                                {supplier.is_creditor && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Credor</span>}
                                {supplier.is_owner && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Proprietário</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {supplier.phone || "-"}
                            </TableCell>
                            <TableCell>
                              {supplier.city || "-"}
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {canEdit && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(supplier)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(supplier)}
                                    >
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
                </ScrollArea>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages} ({filteredSuppliers.length} cadastros)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};