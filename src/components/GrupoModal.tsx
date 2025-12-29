import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, Ban, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Grupo {
  id: string;
  name: string;
  account_type: string;
  created_at: string;
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
  const [formData, setFormData] = useState({
    name: "",
    account_type: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchGrupos();
    }
  }, [open]);

  const fetchGrupos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_groups")
        .select("id, name, account_type, created_at")
        .is("parent_id", null) // Apenas grupos principais (não subgrupos)
        .order("name");

      if (error) throw error;
      setGrupos(data || []);
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
            code: `${Date.now()}`, // Código temporário único
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Grupo criado com sucesso!" });
      }

      setFormData({ name: "", account_type: "" });
      setEditingGrupo(null);
      setShowForm(false);
      await fetchGrupos();
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
    setEditingGrupo(grupo);
    setFormData({
      name: grupo.name,
      account_type: grupo.account_type,
    });
    setShowForm(true);
  };

  const handleDelete = async (grupo: Grupo) => {
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
      await fetchGrupos();
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
    // Funcionalidade removida pois a tabela não tem campo is_active
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
    
    return matchesSearch;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Cadastro de Grupos</DialogTitle>
          <DialogDescription>
            Gerencie os grupos de contas financeiras
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
          {/* Controles superiores */}
          <div className="flex flex-wrap gap-4 items-center">
            {canEdit && (
              <Button
                onClick={() => setShowForm(true)}
                disabled={loading}
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
                <div className="grid grid-cols-2 gap-4">
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
          <div className="flex-1 border rounded-md overflow-hidden bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Grupos Cadastrados ({sortedGrupos.length})</h3>
            </div>
            <ScrollArea className="flex-1 h-[calc(100vh-400px)]">
              <Table>
                <TableHeader className="sticky top-0 bg-card border-b shadow-sm z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Nome
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none h-10 py-2"
                      onClick={() => handleSort('account_type')}
                    >
                      <div className="flex items-center">
                        Classe
                        {getSortIcon('account_type')}
                      </div>
                    </TableHead>
                    <TableHead className="h-10 py-2">Status</TableHead>
                    <TableHead className="text-right h-10 py-2">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-20">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : sortedGrupos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground h-20">
                        {searchTerm ? "Nenhum grupo encontrado com os filtros aplicados" : "Nenhum grupo encontrado"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedGrupos.map((grupo) => (
                      <TableRow key={grupo.id} className="h-12">
                        <TableCell className="font-medium py-2">{grupo.name}</TableCell>
                        <TableCell className="capitalize py-2">{grupo.account_type}</TableCell>
                        <TableCell className="py-2">
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Ativo
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex gap-1 justify-end">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(grupo)}
                                title="Editar"
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
      </DialogContent>
    </Dialog>
  );
};