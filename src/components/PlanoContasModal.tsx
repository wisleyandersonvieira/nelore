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
import { Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountGroup {
  id: string;
  name: string;
  code: string;
  account_type: string;
  parent_id: string | null;
  created_at: string;
}

interface PlanoContasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanoContasModal = ({ open, onOpenChange }: PlanoContasModalProps) => {
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingAccountGroup, setEditingAccountGroup] = useState<AccountGroup | null>(null);
  const [activeTab, setActiveTab] = useState("register");
  const { toast } = useToast();

  const [accountGroupForm, setAccountGroupForm] = useState({
    name: "",
    code: "",
    account_type: "",
    parent_id: "none",
  });

  useEffect(() => {
    if (open) {
      fetchAccountGroups();
    }
  }, [open]);

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
        parent_id: accountGroupForm.parent_id === "none" ? null : accountGroupForm.parent_id || null,
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
      setActiveTab("list");
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

  const resetAccountGroupForm = () => {
    setAccountGroupForm({
      name: "",
      code: "",
      account_type: "",
      parent_id: "none",
    });
    setEditingAccountGroup(null);
  };

  const handleEditAccountGroup = (accountGroup: AccountGroup) => {
    setAccountGroupForm({
      name: accountGroup.name,
      code: accountGroup.code,
      account_type: accountGroup.account_type,
      parent_id: accountGroup.parent_id || "none",
    });
    setEditingAccountGroup(accountGroup);
    setActiveTab("register");
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plano de Contas</DialogTitle>
          <DialogDescription>
            Configuração das categorias e subcategorias financeiras
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                          <SelectItem value="none">Nenhuma (categoria principal)</SelectItem>
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
      </DialogContent>
    </Dialog>
  );
};