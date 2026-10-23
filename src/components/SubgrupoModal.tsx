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
}

interface Brand {
  id: string;
  name: string;
  authorized_subgroup_users: string[] | null;
}

interface Subgrupo {
  id: string;
  name: string;
  parent_id: string;
  brand_id: string | null;
  created_at: string;
  parent?: {
    name: string;
  };
  brand?: {
    name: string;
  };
}

interface SubgrupoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SubgrupoModal = ({ open, onOpenChange, canEdit = true, canDelete = true }: SubgrupoModalProps) => {
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSubgrupo, setEditingSubgrupo] = useState<Subgrupo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'parent' | 'brand' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    parent_id: ""
  });
  
  // Brand authorization state
  const [userBrand, setUserBrand] = useState<Brand | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const { toast } = useToast();

  // Fetch user's brand and check authorization
  useEffect(() => {
    if (open) {
      fetchUserBrandAndAuthorization();
    }
  }, [open]);

  useEffect(() => {
    if (open && userBrand) {
      fetchGrupos();
      fetchSubgrupos();
    }
  }, [open, userBrand]);

  const fetchUserBrandAndAuthorization = async () => {
    setAuthLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Usuário não autenticado.",
        });
        setAuthLoading(false);
        return;
      }

      // Get user's profile to find matrix_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.matrix_id) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível encontrar a matriz do usuário.",
        });
        setAuthLoading(false);
        return;
      }

      // Get matrix to find brand_id
      const { data: matrix, error: matrixError } = await supabase
        .from("matrices")
        .select("brand_id")
        .eq("id", profile.matrix_id)
        .single();

      if (matrixError || !matrix?.brand_id) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível encontrar a marca vinculada à matriz.",
        });
        setAuthLoading(false);
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
        setAuthLoading(false);
        return;
      }

      setUserBrand({
        id: brand.id,
        name: brand.name,
        authorized_subgroup_users: brand.authorized_subgroup_users
      });

      // Check if user is authorized to create/edit subgroups
      const authorized = brand.authorized_subgroup_users?.includes(user.id) || false;
      setIsAuthorized(authorized);

    } catch (error) {
      console.error("Error fetching brand authorization:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao verificar autorização.",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchGrupos = async () => {
    if (!userBrand) return;
    
    try {
      // Fetch only groups linked to user's brand
      const { data, error } = await supabase
        .from("account_groups")
        .select("id, name, account_type, brand_id")
        .is("parent_id", null)
        .eq("brand_id", userBrand.id)
        .order("name");

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os grupos.",
      });
    }
  };

  const fetchSubgrupos = async () => {
    if (!userBrand) return;
    
    setLoading(true);
    try {
      // Fetch only subgroups linked to user's brand
      const { data: subgruposData, error } = await supabase
        .from("account_groups")
        .select("id, name, parent_id, brand_id, created_at")
        .not("parent_id", "is", null)
        .eq("brand_id", userBrand.id)
        .order("name");

      if (error) throw error;

      // Fetch parent group names and brand names
      if (subgruposData && subgruposData.length > 0) {
        const parentIds = [...new Set(subgruposData.map(s => s.parent_id))];
        const { data: gruposData } = await supabase
          .from("account_groups")
          .select("id, name")
          .in("id", parentIds);

        // Combine data with parent names and brand name
        const subgruposComGrupo = subgruposData.map(subgrupo => ({
          ...subgrupo,
          parent: gruposData?.find(g => g.id === subgrupo.parent_id),
          brand: { name: userBrand.name }
        }));

        setSubgrupos(subgruposComGrupo);
      } else {
        setSubgrupos([]);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os subgrupos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.parent_id) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e grupo são obrigatórios.",
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

    // Check name uniqueness within the brand
    const nameExists = subgrupos.some(
      subgrupo => subgrupo.name.toLowerCase() === formData.name.toLowerCase() &&
      subgrupo.id !== editingSubgrupo?.id
    );

    if (nameExists) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe um subgrupo com esse nome.",
      });
      return;
    }

    setLoading(true);
    try {
      // Get parent group's account_type
      const { data: grupoData, error: grupoError } = await supabase
        .from("account_groups")
        .select("account_type")
        .eq("id", formData.parent_id)
        .single();

      if (grupoError) throw grupoError;

      if (editingSubgrupo) {
        // Update existing subgroup
        const { error } = await supabase
          .from("account_groups")
          .update({
            name: formData.name,
            parent_id: formData.parent_id,
            account_type: grupoData.account_type,
            brand_id: userBrand.id,
          })
          .eq("id", editingSubgrupo.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Subgrupo atualizado com sucesso!" });
      } else {
        // Create new subgroup with brand_id
        const { error } = await supabase
          .from("account_groups")
          .insert({
            name: formData.name,
            parent_id: formData.parent_id,
            account_type: grupoData.account_type,
            brand_id: userBrand.id,
            code: `${formData.parent_id}-${Date.now()}`,
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Subgrupo criado com sucesso!" });
      }

      setFormData({ name: "", parent_id: "" });
      setEditingSubgrupo(null);
      setShowForm(false);
      await fetchSubgrupos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível salvar o subgrupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subgrupo: Subgrupo) => {
    setEditingSubgrupo(subgrupo);
    setFormData({
      name: subgrupo.name,
      parent_id: subgrupo.parent_id,
    });
    setShowForm(true);
  };

  const handleDelete = async (subgrupo: Subgrupo) => {
    // Verificar autorização do usuário
    if (!isAuthorized) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você não tem permissão para excluir subgrupos nesta marca.",
      });
      return;
    }

    setLoading(true);
    try {
      // Check for linked chart_of_accounts
      const { data: chartAccounts, error: chartError } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("group_id", subgrupo.id)
        .limit(1);

      if (chartError) throw chartError;

      if (chartAccounts && chartAccounts.length > 0) {
        // Check accounts_payable
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
            description: "Este subgrupo possui contas a pagar vinculadas e não pode ser excluído.",
          });
          setLoading(false);
          return;
        }

        // Check accounts_receivable
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
            description: "Este subgrupo possui contas a receber vinculadas e não pode ser excluído.",
          });
          setLoading(false);
          return;
        }
      }

      // Check for linked products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("subgroup_id", subgrupo.id)
        .limit(1);

      if (productsError) throw productsError;

      if (products && products.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Este subgrupo possui produtos vinculados e não pode ser excluído.",
        });
        setLoading(false);
        return;
      }

      // Verificar se o subgrupo está sendo usado na estrutura do DRE
      const { data: dreItems, error: dreError } = await supabase
        .from("dre_structure_items")
        .select(`
          id, 
          name,
          dre_structures!inner(name)
        `)
        .eq("account_group_id", subgrupo.id)
        .limit(3);

      if (dreError) throw dreError;

      if (dreItems && dreItems.length > 0) {
        const dreItemNames = dreItems.map(item => `"${item.name}" (${(item.dre_structures as any).name})`).join(", ");
        
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: `Este subgrupo está sendo usado na estrutura DRE: ${dreItemNames}. Remova essas referências antes de excluir o subgrupo.`,
        });
        setLoading(false);
        return;
      }

      if (!confirm(`Tem certeza que deseja excluir o subgrupo ${subgrupo.name}?`)) {
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("account_groups")
        .delete()
        .eq("id", subgrupo.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Subgrupo excluído com sucesso!" });
      await fetchSubgrupos();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o subgrupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (subgrupo: Subgrupo) => {
    toast({
      variant: "destructive",
      title: "Funcionalidade não disponível",
      description: "A funcionalidade de bloquear/desbloquear não está implementada.",
    });
  };

  const handleSort = (field: 'name' | 'parent' | 'brand') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort subgroups
  const filteredSubgrupos = subgrupos.filter((subgrupo) => {
    const matchesSearch = searchTerm === "" || 
      subgrupo.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = filterGroup === "" || filterGroup === "all" || 
      subgrupo.parent_id === filterGroup;
    
    return matchesSearch && matchesGroup;
  });

  const sortedSubgrupos = [...filteredSubgrupos].sort((a, b) => {
    if (!sortBy) return 0;
    
    let aValue = '';
    let bValue = '';
    
    if (sortBy === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortBy === 'parent') {
      aValue = (a.parent?.name || '').toLowerCase();
      bValue = (b.parent?.name || '').toLowerCase();
    } else if (sortBy === 'brand') {
      aValue = (a.brand?.name || '').toLowerCase();
      bValue = (b.brand?.name || '').toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  const getSortIcon = (field: 'name' | 'parent' | 'brand') => {
    if (sortBy !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const resetForm = () => {
    setFormData({ name: "", parent_id: "" });
    setEditingSubgrupo(null);
    setShowForm(false);
  };

  // Determine if user can perform actions based on authorization
  const canCreate = canEdit && isAuthorized;
  const canModify = canEdit && isAuthorized;
  const canRemove = canDelete && isAuthorized;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95dvh] flex flex-col p-0 sm:p-0">
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
              <DialogTitle className="text-2xl font-bold text-primary">Subgrupos</DialogTitle>
              <DialogDescription className="text-base">
                Gerencie os subgrupos de contas financeiras
                {userBrand && <span className="ml-2 text-muted-foreground">• Marca: {userBrand.name}</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
          {authLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-muted-foreground">Carregando...</span>
            </div>
          ) : (
            <>
              {/* Top controls */}
              <div className="flex flex-wrap gap-4 items-center">
                {canCreate && (
                  <Button
                    onClick={() => setShowForm(true)}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Subgrupo
                  </Button>
                )}
                
                {!isAuthorized && canEdit && (
                  <span className="text-sm text-muted-foreground">
                    Você não tem permissão para criar/editar subgrupos nesta marca.
                  </span>
                )}
                
                {/* Filters */}
                <div className="flex gap-4 items-center flex-1">
                  <div className="flex-1 max-w-xs">
                    <Input
                      placeholder="Buscar por nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                      <SelectValue placeholder="Filtrar por grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os grupos</SelectItem>
                      {grupos.map((grupo) => (
                        <SelectItem key={grupo.id} value={grupo.id}>
                          {grupo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Form */}
              {showForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingSubgrupo ? "Editar Subgrupo" : "Novo Subgrupo"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="brand">Marca</Label>
                        <Input
                          id="brand"
                          value={userBrand?.name || ""}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nome do subgrupo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parent_id">Grupo</Label>
                        <Select
                          value={formData.parent_id}
                          onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            {grupos.map((grupo) => (
                              <SelectItem key={grupo.id} value={grupo.id}>
                                {grupo.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={loading}>
                        {editingSubgrupo ? "Atualizar" : "Salvar"}
                      </Button>
                      <Button variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subgroups List */}
              <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-card min-h-0">
                <div className="border-b px-4 py-3 shrink-0">
                  <h3 className="font-semibold">Subgrupos Cadastrados ({sortedSubgrupos.length})</h3>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <div className="h-full flex flex-col">
                    {/* Fixed header */}
                    <Table>
                      <TableHeader className="bg-card">
                        <TableRow className="hover:bg-transparent">
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2 w-[25%]"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center">
                              Nome
                              {getSortIcon('name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2 w-[20%]"
                            onClick={() => handleSort('parent')}
                          >
                            <div className="flex items-center">
                              Grupo
                              {getSortIcon('parent')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2 w-[20%]"
                            onClick={() => handleSort('brand')}
                          >
                            <div className="flex items-center">
                              Marca
                              {getSortIcon('brand')}
                            </div>
                          </TableHead>
                          <TableHead className="h-10 py-2 w-[15%]">Status</TableHead>
                          <TableHead className="text-right h-10 py-2 w-[20%]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                    </Table>
                    {/* Scrollable body */}
                    <ScrollArea className="flex-1">
                      <Table>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center h-20">
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : sortedSubgrupos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground h-20">
                                {searchTerm || filterGroup ? "Nenhum subgrupo encontrado com os filtros aplicados" : "Nenhum subgrupo encontrado"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            sortedSubgrupos.map((subgrupo) => (
                              <TableRow key={subgrupo.id} className="h-12">
                                <TableCell className="font-medium py-2 w-[25%]">{subgrupo.name}</TableCell>
                                <TableCell className="py-2 w-[20%]">{subgrupo.parent?.name || 'N/A'}</TableCell>
                                <TableCell className="py-2 w-[20%]">{subgrupo.brand?.name || 'N/A'}</TableCell>
                                <TableCell className="py-2 w-[15%]">
                                  <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Ativo
                                  </span>
                                </TableCell>
                                <TableCell className="text-right py-2 w-[20%]">
                                  <div className="flex gap-1 justify-end">
                                    {canModify && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(subgrupo)}
                                        title="Editar"
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canModify && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleStatus(subgrupo)}
                                        title="Bloquear/Desbloquear"
                                        disabled
                                        className="h-8 w-8 p-0"
                                      >
                                        <Ban className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canRemove && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(subgrupo)}
                                        title="Excluir"
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
