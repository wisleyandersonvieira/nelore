import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, Ban, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Grupo {
  id: string;
  name: string;
  account_type: string;
  brand_id: string | null;
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
  authorized_group_users: string[];
}

interface GrupoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const GrupoModal = ({ open, onOpenChange, canEdit = true, canDelete = true }: GrupoModalProps) => {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'account_type' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterAccountType, setFilterAccountType] = useState<string>("all");
  const [userBrand, setUserBrand] = useState<Brand | null>(null);
  const [userBrandName, setUserBrandName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    account_type: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUserBrandAndGroups();
    }
  }, [open]);

  const fetchUserBrandAndGroups = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Get user's matrix_id from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.matrix_id) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível identificar a matriz do usuário.",
        });
        setLoading(false);
        return;
      }

      // Get the brand linked to user's matrix
      const { data: matrix, error: matrixError } = await supabase
        .from("matrices")
        .select("brand_id")
        .eq("id", profile.matrix_id)
        .single();

      if (matrixError || !matrix?.brand_id) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível identificar a marca vinculada à matriz.",
        });
        setLoading(false);
        return;
      }

      // Get brand details using security definer function to bypass RLS
      const { data: brandData, error: brandError } = await supabase
        .rpc("get_brand_by_id", { p_brand_id: matrix.brand_id });
      
      const brand = brandData?.[0];

      if (brandError || !brand) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os dados da marca.",
        });
        setLoading(false);
        return;
      }

      setUserBrand(brand);
      setUserBrandName(brand.name);
      
      // Check if user is authorized to create/edit groups
      const authorizedUsers = brand.authorized_group_users || [];
      setIsAuthorized(authorizedUsers.includes(user.id));

      // Fetch groups filtered by brand_id
      const { data: gruposData, error: gruposError } = await supabase
        .from("account_groups")
        .select("id, name, account_type, brand_id, created_at")
        .is("parent_id", null)
        .eq("brand_id", brand.id)
        .order("name");

      if (gruposError) throw gruposError;
      setGrupos(gruposData || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os grupos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.account_type) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e classe são obrigatórios.",
      });
      return;
    }

    // Validate authorization
    if (!isAuthorized && !editingGrupo) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para criar grupos nesta marca.",
      });
      return;
    }

    if (!isAuthorized && editingGrupo) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para editar grupos nesta marca.",
      });
      return;
    }

    if (!userBrand) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Marca não identificada.",
      });
      return;
    }

    // Verificar se já existe um grupo com esse nome
    const nameExists = grupos.some(
      grupo => grupo.name.toLowerCase() === formData.name.toLowerCase() &&
      grupo.id !== editingGrupo?.id
    );

    if (nameExists) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe um grupo com esse nome.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingGrupo) {
        // Editar grupo existente
        const { error } = await supabase
          .from("account_groups")
          .update({
            name: formData.name,
            account_type: formData.account_type as "receita" | "despesa" | "ativo" | "passivo",
          })
          .eq("id", editingGrupo.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Grupo atualizado com sucesso!" });
      } else {
        // Criar novo grupo
        const { error } = await supabase
          .from("account_groups")
          .insert({
            name: formData.name,
            account_type: formData.account_type as "receita" | "despesa" | "ativo" | "passivo",
            code: `${Date.now()}`,
            brand_id: userBrand.id,
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Grupo criado com sucesso!" });
      }

      setFormData({ name: "", account_type: "" });
      setEditingGrupo(null);
      setShowForm(false);
      await fetchUserBrandAndGroups();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível salvar o grupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (grupo: Grupo) => {
    if (!isAuthorized) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para editar grupos nesta marca.",
      });
      return;
    }
    
    setEditingGrupo(grupo);
    setFormData({
      name: grupo.name,
      account_type: grupo.account_type,
    });
    setShowForm(true);
  };

  const handleDelete = async (grupo: Grupo) => {
    if (!isAuthorized) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para excluir grupos nesta marca.",
      });
      return;
    }

    setLoading(true);
    try {
      // Verificar se existem contas a pagar vinculadas (através do chart_of_accounts)
      const { data: chartAccounts, error: chartError } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("group_id", grupo.id)
        .limit(1);

      if (chartError) throw chartError;

      if (chartAccounts && chartAccounts.length > 0) {
        // Verificar se alguma conta está vinculada a contas a pagar
        const { data: payables, error: payablesError } = await supabase
          .from("accounts_payable")
          .select("id")
          .in("account_id", chartAccounts.map(c => c.id))
          .limit(1);

        if (payablesError) throw payablesError;

        if (payables && payables.length > 0) {
          toast({
            variant: "destructive",
            title: "Exclusão não permitida",
            description: "Este grupo possui contas a pagar vinculadas e não pode ser excluído.",
          });
          setLoading(false);
          return;
        }

        // Verificar se alguma conta está vinculada a contas a receber
        const { data: receivables, error: receivablesError } = await supabase
          .from("accounts_receivable")
          .select("id")
          .in("account_id", chartAccounts.map(c => c.id))
          .limit(1);

        if (receivablesError) throw receivablesError;

        if (receivables && receivables.length > 0) {
          toast({
            variant: "destructive",
            title: "Exclusão não permitida",
            description: "Este grupo possui contas a receber vinculadas e não pode ser excluído.",
          });
          setLoading(false);
          return;
        }
      }

      // Verificar se existem subgrupos vinculados
      const { data: subgroups, error: subgroupsError } = await supabase
        .from("account_groups")
        .select("id")
        .eq("parent_id", grupo.id)
        .limit(1);

      if (subgroupsError) throw subgroupsError;

      if (subgroups && subgroups.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este grupo possui subgrupos vinculados e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      // Verificar se existem produtos vinculados ao grupo
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("group_id", grupo.id)
        .limit(1);

      if (productsError) throw productsError;

      if (products && products.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este grupo possui produtos vinculados e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      // Verificar se existem contas ATIVAS associadas a este grupo
      const { data: accounts, error: checkError } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("group_id", grupo.id)
        .eq("is_active", true)
        .limit(1);

      if (checkError) throw checkError;

      if (accounts && accounts.length > 0) {
        const { data: accountDetails } = await supabase
          .from("chart_of_accounts")
          .select("name")
          .eq("group_id", grupo.id)
          .eq("is_active", true)
          .limit(3);

        const accountNames = accountDetails?.map(acc => acc.name).join(", ") || "";
        
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: `Este grupo possui contas ativas associadas: ${accountNames}. Remova as contas antes de excluir o grupo.`,
        });
        setLoading(false);
        return;
      }

      // Verificar se o grupo está sendo usado na estrutura do DRE
      const { data: dreItems, error: dreError } = await supabase
        .from("dre_structure_items")
        .select(`
          id, 
          name,
          dre_structures!inner(name)
        `)
        .eq("account_group_id", grupo.id)
        .limit(3);

      if (dreError) throw dreError;

      if (dreItems && dreItems.length > 0) {
        const dreItemNames = dreItems.map(item => `"${item.name}" (${item.dre_structures.name})`).join(", ");
        
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: `Este grupo está sendo usado na estrutura DRE: ${dreItemNames}. Remova essas referências antes de excluir o grupo.`,
        });
        setLoading(false);
        return;
      }

      if (!confirm(`Tem certeza que deseja excluir o grupo ${grupo.name}?`)) {
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("account_groups")
        .delete()
        .eq("id", grupo.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Grupo excluído com sucesso!" });
      await fetchUserBrandAndGroups();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível excluir o grupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (grupo: Grupo) => {
    toast({
      variant: "destructive",
      title: "Funcionalidade não disponível",
      description: "A funcionalidade de bloquear/desbloquear não está implementada.",
    });
  };

  const handleSort = (field: 'name' | 'account_type') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Filtrar e ordenar grupos
  const filteredGrupos = grupos.filter((grupo) => {
    const matchesSearch = searchTerm === "" || 
      grupo.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccountType = filterAccountType === "all" || 
      grupo.account_type === filterAccountType;
    
    return matchesSearch && matchesAccountType;
  });

  const sortedGrupos = [...filteredGrupos].sort((a, b) => {
    if (!sortBy) return 0;
    
    let aValue = '';
    let bValue = '';
    
    if (sortBy === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortBy === 'account_type') {
      aValue = (a.account_type || '').toLowerCase();
      bValue = (b.account_type || '').toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  const getSortIcon = (field: 'name' | 'account_type') => {
    if (sortBy !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const resetForm = () => {
    setFormData({ name: "", account_type: "" });
    setEditingGrupo(null);
    setShowForm(false);
  };

  const handleNewGroup = () => {
    if (!isAuthorized) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para criar grupos nesta marca.",
      });
      return;
    }
    setShowForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 sm:p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <DialogTitle className="text-2xl font-bold text-primary">Grupos</DialogTitle>
              <DialogDescription className="text-base">
                Gerencie os grupos de contas financeiras {userBrandName && `- Marca: ${userBrandName}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
          {/* Controles superiores */}
          <div className="flex flex-wrap gap-4 items-center">
            {canEdit && (
              <Button
                onClick={handleNewGroup}
                disabled={loading || !isAuthorized}
                title={!isAuthorized ? "Você não tem permissão para criar grupos" : ""}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Grupo
              </Button>
            )}
            
            {/* Busca */}
            <div className="flex-1 max-w-xs">
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Filtro por Classe */}
            <Select value={filterAccountType} onValueChange={setFilterAccountType}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classes</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Formulário */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingGrupo ? "Editar Grupo" : "Novo Grupo"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do grupo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Classe</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a classe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="investimento">Investimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={userBrandName}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={loading}>
                    {editingGrupo ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Grupos */}
          <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-card min-h-0">
            <div className="border-b px-4 py-3 shrink-0">
              <h3 className="font-semibold">Grupos Cadastrados ({sortedGrupos.length})</h3>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <div className="h-full flex flex-col">
                {/* Cabeçalho fixo */}
                <Table>
                  <TableHeader className="bg-card">
                    <TableRow className="hover:bg-transparent">
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2 w-[30%]"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Nome
                          {getSortIcon('name')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2 w-[20%]"
                        onClick={() => handleSort('account_type')}
                      >
                        <div className="flex items-center">
                          Classe
                          {getSortIcon('account_type')}
                        </div>
                      </TableHead>
                      <TableHead className="h-10 py-2 w-[20%]">Marca</TableHead>
                      <TableHead className="h-10 py-2 w-[10%]">Status</TableHead>
                      <TableHead className="text-right h-10 py-2 w-[20%]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                {/* Corpo com scroll */}
                <ScrollArea className="flex-1">
                  <Table>
                    <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-20">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : sortedGrupos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground h-20">
                        {searchTerm ? "Nenhum grupo encontrado com os filtros aplicados" : "Nenhum grupo encontrado"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedGrupos.map((grupo) => (
                      <TableRow key={grupo.id} className="h-12">
                        <TableCell className="font-medium py-2 w-[30%]">{grupo.name}</TableCell>
                        <TableCell className="capitalize py-2 w-[20%]">{grupo.account_type}</TableCell>
                        <TableCell className="py-2 w-[20%]">{userBrandName}</TableCell>
                        <TableCell className="py-2 w-[10%]">
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Ativo
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-2 w-[20%]">
                          <div className="flex gap-1 justify-end">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(grupo)}
                                title={isAuthorized ? "Editar" : "Você não tem permissão para editar"}
                                disabled={!isAuthorized}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(grupo)}
                                title="Bloquear/Desbloquear"
                                disabled
                                className="h-8 w-8 p-0"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(grupo)}
                                title={isAuthorized ? "Excluir" : "Você não tem permissão para excluir"}
                                disabled={!isAuthorized}
                                className="text-destructive hover:text-destructive h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
