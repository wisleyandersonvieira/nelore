import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { Pencil, Trash2, Lock, Unlock, Plus, Search } from "lucide-react";

interface CurrentAccount {
  id: string;
  name: string;
  bank: string;
  account_number: string;
  initial_balance: number;
  initial_balance_date: string;
  is_active: boolean;
  is_blocked: boolean;
  matrix_id: string;
  current_account_stores: { store_id: string }[];
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface CurrentAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface FormData {
  name: string;
  bank: string;
  account_number: string;
  initial_balance: number;
  initial_balance_date: string;
  store_ids: string[];
}

export function CurrentAccountsModal({ open, onOpenChange, canEdit = true, canDelete = true }: CurrentAccountsModalProps) {
  // Debug log to verify permissions are received correctly
  console.log('CurrentAccountsModal permissions:', { canEdit, canDelete, open });
  
  const [accounts, setAccounts] = useState<CurrentAccount[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [editingAccount, setEditingAccount] = useState<CurrentAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [filterStoreId, setFilterStoreId] = useState<string>("all");
  const { toast } = useToast();
  const { matrixId, matrixName, isLoading: matrixLoading } = useUserMatrix();

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      bank: "",
      account_number: "",
      initial_balance: 0,
      initial_balance_date: new Date().toISOString().split('T')[0],
      store_ids: []
    }
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  useEffect(() => {
    if (open && matrixId) {
      fetchStores();
    }
  }, [open, matrixId]);

  const fetchUserStoreIds = async (): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single();

    // Admin sees all stores
    if (profile?.role === 'admin') {
      return [];
    }

    const storeIds: string[] = [];
    if (profile?.store_id) storeIds.push(profile.store_id);

    const { data: userStores } = await supabase
      .from('user_stores')
      .select('store_id')
      .eq('user_id', user.id);

    userStores?.forEach(us => {
      if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
    });

    return storeIds;
  };

  const fetchAccounts = async () => {
    try {
      const userStoreIds = await fetchUserStoreIds();
      
      const { data, error } = await supabase
        .from('current_accounts')
        .select(`
          *,
          current_account_stores(store_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter accounts to only show those linked to user's stores
      let filteredData = data || [];
      if (userStoreIds.length > 0) {
        filteredData = filteredData.filter(account => 
          account.current_account_stores?.some(cas => userStoreIds.includes(cas.store_id))
        );
      }
      
      setAccounts(filteredData);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contas correntes",
        variant: "destructive",
      });
    }
  };

  const fetchStores = async () => {
    try {
      const userStoreIds = await fetchUserStoreIds();
      
      // Build query filtering by matrix
      let query = supabase
        .from('stores')
        .select('id, name, code, matrix_id')
        .order('name');
      
      // Filter by user's matrix
      if (matrixId) {
        query = query.eq('matrix_id', matrixId);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      
      // If user has specific stores (non-admin), filter by them as well
      let filteredStores = data || [];
      if (userStoreIds.length > 0) {
        filteredStores = filteredStores.filter(store => userStoreIds.includes(store.id));
      }
      
      setStores(filteredStores);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (editingAccount) {
        // Update account
        const { error: updateError } = await supabase
          .from('current_accounts')
          .update({
            name: data.name,
            bank: data.bank,
            account_number: data.account_number,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date
          })
          .eq('id', editingAccount.id);

        if (updateError) throw updateError;

        // Update store associations
        await supabase
          .from('current_account_stores')
          .delete()
          .eq('account_id', editingAccount.id);

        if (data.store_ids.length > 0) {
          const storeAssociations = data.store_ids.map(storeId => ({
            account_id: editingAccount.id,
            store_id: storeId
          }));

          const { error: storeError } = await supabase
            .from('current_account_stores')
            .insert(storeAssociations);

          if (storeError) throw storeError;
        }

        toast({
          title: "Sucesso",
          description: "Conta corrente atualizada com sucesso",
        });
      } else {
        // Create new account with matrix_id
        if (!matrixId) {
          toast({
            title: "Erro",
            description: "Matriz do usuário não encontrada",
            variant: "destructive",
          });
          return;
        }

        const { data: accountData, error: insertError } = await supabase
          .from('current_accounts')
          .insert({
            name: data.name,
            bank: data.bank,
            account_number: data.account_number,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date,
            matrix_id: matrixId
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert store associations
        if (data.store_ids.length > 0) {
          const storeAssociations = data.store_ids.map(storeId => ({
            account_id: accountData.id,
            store_id: storeId
          }));

          const { error: storeError } = await supabase
            .from('current_account_stores')
            .insert(storeAssociations);

          if (storeError) throw storeError;
        }

        toast({
          title: "Sucesso",
          description: "Conta corrente criada com sucesso",
        });
      }

      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar conta corrente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: CurrentAccount) => {
    setEditingAccount(account);
    form.reset({
      name: account.name,
      bank: account.bank,
      account_number: account.account_number,
      initial_balance: account.initial_balance,
      initial_balance_date: account.initial_balance_date,
      store_ids: account.current_account_stores.map(cas => cas.store_id)
    });
    setShowForm(true);
  };

  const handleToggleBlock = async (account: CurrentAccount) => {
    try {
      const { error } = await supabase
        .from('current_accounts')
        .update({ is_blocked: !account.is_blocked })
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Conta ${account.is_blocked ? 'desbloqueada' : 'bloqueada'} com sucesso`,
      });

      fetchAccounts();
    } catch (error) {
      console.error('Error toggling block:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status da conta",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (account: CurrentAccount) => {
    try {
      // Verificar se existem transações financeiras vinculadas
      const { data: financialTransactions, error: financialTransactionsError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('account_id', account.id)
        .limit(1);

      if (financialTransactionsError) throw financialTransactionsError;

      if (financialTransactions && financialTransactions.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Esta conta corrente possui transações financeiras vinculadas e não pode ser excluída.",
        });
        return;
      }

      // Verificar se existem registros de controle de caixa vinculados
      const { data: cashControlItems, error: cashControlError } = await supabase
        .from('cash_control_account_items')
        .select('id')
        .eq('current_account_id', account.id)
        .limit(1);

      if (cashControlError) throw cashControlError;

      if (cashControlItems && cashControlItems.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Esta conta corrente possui registros de controle de caixa vinculados e não pode ser excluída.",
        });
        return;
      }

      if (!confirm('Tem certeza que deseja excluir esta conta corrente?')) return;

      const { error } = await supabase
        .from('current_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conta corrente excluída com sucesso",
      });

      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta corrente",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    form.reset({
      name: "",
      bank: "",
      account_number: "",
      initial_balance: 0,
      initial_balance_date: new Date().toISOString().split('T')[0],
      store_ids: []
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const getStoreNames = (storeIds: string[]) => {
    return stores
      .filter(store => storeIds.includes(store.id))
      .map(store => store.name)
      .join(', ');
  };

  // Filtered accounts
  const filteredAccounts = accounts.filter(account => {
    const nameMatch = account.name.toLowerCase().includes(searchName.toLowerCase());
    const storeMatch = filterStoreId === "all" || 
      account.current_account_stores.some(cas => cas.store_id === filterStoreId);
    return nameMatch && storeMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão de Contas Correntes</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showForm ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                {canEdit === true && (
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Conta Corrente
                  </Button>
                )}

                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="searchName" className="text-sm mb-1 block">Filtrar por Nome</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="searchName"
                      placeholder="Buscar por nome..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="min-w-[200px]">
                  <Label htmlFor="filterStore" className="text-sm mb-1 block">Filtrar por Loja</Label>
                  <Select value={filterStoreId} onValueChange={setFilterStoreId}>
                    <SelectTrigger id="filterStore">
                      <SelectValue placeholder="Todas as lojas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as lojas</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} ({store.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Número da Conta</TableHead>
                    <TableHead>Saldo Inicial</TableHead>
                    <TableHead>Data Saldo</TableHead>
                    <TableHead>Lojas Vinculadas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhuma conta corrente encontrada
                      </TableCell>
                    </TableRow>
                  ) : filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>{account.bank}</TableCell>
                      <TableCell>{account.account_number}</TableCell>
                      <TableCell>
                        {account.initial_balance.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(account.initial_balance_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {getStoreNames(account.current_account_stores.map(cas => cas.store_id))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {account.is_blocked && (
                            <Badge variant="destructive">Bloqueada</Badge>
                          )}
                          {!account.is_active && (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                          {account.is_active && !account.is_blocked && (
                            <Badge variant="default">Ativa</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(account)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleBlock(account)}
                            >
                              {account.is_blocked ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(account)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Campo Matriz (somente leitura) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Matriz</Label>
                    <Input 
                      value={matrixName || 'Carregando...'} 
                      disabled 
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{ required: "Nome é obrigatório" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank"
                    rules={{ required: "Banco é obrigatório" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_number"
                    rules={{ required: "Número da conta é obrigatório" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Conta</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initial_balance"
                    rules={{ required: "Saldo inicial é obrigatório" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initial_balance_date"
                    rules={{ required: "Data do saldo inicial é obrigatória" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data do Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="store_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lojas Vinculadas</FormLabel>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                        {stores.map((store) => (
                          <div key={store.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={store.id}
                              checked={field.value.includes(store.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, store.id]);
                                } else {
                                  field.onChange(field.value.filter(id => id !== store.id));
                                }
                              }}
                            />
                            <Label htmlFor={store.id} className="text-sm">
                              {store.name} ({store.code})
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : editingAccount ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}