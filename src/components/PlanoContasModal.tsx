import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountGroup {
  id: string;
  name: string;
  code: string;
  account_type: string;
  parent_id: string | null;
  created_at: string;
  children?: AccountGroup[];
}

interface PlanoContasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanoContasModal = ({ open, onOpenChange }: PlanoContasModalProps) => {
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [editingAccount, setEditingAccount] = useState<{ id?: string; parentId?: string; siblingCode?: string } | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const { toast } = useToast();

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
        .order("code");

      if (error) throw error;
      
      // Organizar em árvore hierárquica
      const groupsTree = buildTree(data || []);
      setAccountGroups(groupsTree);
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

  const buildTree = (groups: AccountGroup[]): AccountGroup[] => {
    const groupMap = new Map<string, AccountGroup>();
    const rootGroups: AccountGroup[] = [];

    // Primeiro, criar o mapa de todos os grupos
    groups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [] });
    });

    // Depois, organizar a hierarquia
    groups.forEach(group => {
      const groupWithChildren = groupMap.get(group.id)!;
      if (group.parent_id && groupMap.has(group.parent_id)) {
        groupMap.get(group.parent_id)!.children!.push(groupWithChildren);
      } else {
        rootGroups.push(groupWithChildren);
      }
    });

    // Ordenar por código
    const sortByCode = (a: AccountGroup, b: AccountGroup) => {
      const aCode = a.code.split('.').map(n => parseInt(n) || 0);
      const bCode = b.code.split('.').map(n => parseInt(n) || 0);
      
      for (let i = 0; i < Math.max(aCode.length, bCode.length); i++) {
        const aVal = aCode[i] || 0;
        const bVal = bCode[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    };

    rootGroups.sort(sortByCode);
    rootGroups.forEach(group => {
      if (group.children) {
        group.children.sort(sortByCode);
      }
    });

    return rootGroups;
  };

  const generateNextCode = (parentCode?: string, siblingCode?: string): string => {
    if (siblingCode) {
      // Criar conta no mesmo nível (abaixo da atual)
      const parts = siblingCode.split('.');
      const lastPart = parseInt(parts[parts.length - 1]) + 1;
      return [...parts.slice(0, -1), lastPart.toString()].join('.');
    }
    
    if (parentCode) {
      // Criar subconta
      return `${parentCode}.1`;
    }
    
    // Criar conta raiz (não deveria acontecer, pois já temos as 3 principais)
    return "4";
  };

  const getAccountType = (code: string): 'receita' | 'despesa' | 'ativo' | 'passivo' => {
    const rootCode = code.split('.')[0];
    switch (rootCode) {
      case '1': return 'receita';
      case '2': return 'despesa';
      case '3': return 'ativo';
      default: return 'ativo';
    }
  };

  const handleCreateAccount = (type: 'below' | 'sub', parentAccount: AccountGroup) => {
    setEditingAccount({ 
      parentId: type === 'sub' ? parentAccount.id : parentAccount.parent_id,
      siblingCode: type === 'below' ? parentAccount.code : undefined
    });
    setNewAccountName("");
  };

  const handleSaveAccount = async () => {
    if (!editingAccount || !newAccountName.trim()) return;

    setLoading(true);
    try {
      const newCode = editingAccount.siblingCode 
        ? generateNextCode(undefined, editingAccount.siblingCode)
        : generateNextCode(
            accountGroups.find(g => g.id === editingAccount.parentId)?.code ||
            accountGroups.flatMap(g => g.children || []).find(c => c.id === editingAccount.parentId)?.code
          );

      const formData = {
        name: newAccountName,
        code: newCode,
        account_type: getAccountType(newCode),
        parent_id: editingAccount.parentId || null,
      };

      if (editingAccount.id) {
        // Editar conta existente
        const { error } = await supabase
          .from("account_groups")
          .update({ name: newAccountName })
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Conta atualizada com sucesso!" });
      } else {
        // Criar nova conta
        const { error } = await supabase
          .from("account_groups")
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Conta criada com sucesso!" });
      }

      setEditingAccount(null);
      setNewAccountName("");
      await fetchAccountGroups();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a conta.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (account: AccountGroup) => {
    if (!confirm(`Tem certeza que deseja excluir a conta ${account.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("account_groups")
        .delete()
        .eq("id", account.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Conta excluída com sucesso!" });
      await fetchAccountGroups();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a conta.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const renderAccountItem = (account: AccountGroup, level: number = 0) => {
    const isExpanded = expandedGroups.has(account.id);
    const hasChildren = account.children && account.children.length > 0;
    const isEditing = editingAccount?.id === account.id;

    return (
      <div key={account.id} className="border-b border-border/50">
        <div 
          className={`flex items-center justify-between p-3 hover:bg-muted/50`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(account.id)}
                className="p-1 h-6 w-6"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
            
            <span className="font-mono text-sm font-medium w-20">{account.code}</span>
            
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="flex-1"
                  placeholder="Nome da conta"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveAccount} disabled={loading}>
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingAccount(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <span className="flex-1">{account.name}</span>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingAccount({ id: account.id });
                  setNewAccountName(account.name);
                }}
                className="p-1 h-8 w-8"
                title="Editar conta"
              >
                <span className="text-xs">✏️</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCreateAccount('below', account)}
                className="p-1 h-8 w-8"
                title="Criar conta abaixo (mesmo nível)"
              >
                <Plus className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCreateAccount('sub', account)}
                className="p-1 h-8 w-8"
                title="Criar subconta"
              >
                <span className="text-xs">📁</span>
              </Button>
              
              {account.parent_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAccount(account)}
                  className="p-1 h-8 w-8 text-destructive hover:text-destructive"
                  title="Excluir conta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Renderizar filhos se expandido */}
        {isExpanded && hasChildren && (
          <div>
            {account.children!.map(child => renderAccountItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Plano de Contas</DialogTitle>
          <DialogDescription>
            Estrutura hierárquica das contas financeiras
          </DialogDescription>
        </DialogHeader>

        <Card className="flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle>Estrutura das Contas</CardTitle>
            <CardDescription>
              Use os botões ao lado de cada conta para gerenciar a estrutura
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border rounded-md bg-background">
              <div className="grid grid-cols-[1fr_auto] gap-4 p-3 bg-muted/50 border-b font-medium text-sm">
                <div className="flex gap-2">
                  <span className="w-20">Código</span>
                  <span>Descrição</span>
                </div>
                <span className="text-center">Ações</span>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : accountGroups.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhuma conta encontrada
                  </div>
                ) : (
                  accountGroups.map(group => renderAccountItem(group))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};