import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft, Lock, Unlock, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface CardAccount {
  id: string;
  name: string;
  bank: string;
  account_number: string;
  initial_balance: number;
  initial_balance_date: string;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  matrix_id: string;
  card_account_stores?: { store_id: string }[];
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface CardAccountsModalProps {
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

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  bank: z.string().min(1, "Banco é obrigatório"),
  account_number: z.string().min(1, "Número da conta é obrigatório"),
  initial_balance: z.number().min(0, "Saldo inicial deve ser positivo"),
  initial_balance_date: z.string().min(1, "Data do saldo inicial é obrigatória"),
  store_ids: z.array(z.string()).min(1, "Selecione pelo menos uma loja"),
});

export const CardAccountsModal = ({ open, onOpenChange, canEdit = true, canDelete = true }: CardAccountsModalProps) => {
  const [accounts, setAccounts] = useState<CardAccount[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [editingAccount, setEditingAccount] = useState<CardAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [filterStoreId, setFilterStoreId] = useState<string>("all");
  const { matrixId, matrixName, isLoading: matrixLoading } = useUserMatrix();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      bank: "",
      account_number: "",
      initial_balance: 0,
      initial_balance_date: new Date().toISOString().split('T')[0],
      store_ids: [],
    },
  });

  const fetchUserStoreIds = async (): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') return [];

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
        .from('card_accounts')
        .select(`
          *,
          card_account_stores (
            store_id
          )
        `)
        .order('name');

      if (error) throw error;
      
      let filteredData = data || [];
      if (userStoreIds.length > 0) {
        filteredData = filteredData.filter(account => 
          account.card_account_stores?.some(cas => userStoreIds.includes(cas.store_id))
        );
      }
      
      setAccounts(filteredData);
    } catch (error) {
      console.error('Erro ao buscar contas cartão:', error);
      toast.error('Erro ao carregar contas cartão');
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
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

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

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      if (editingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('card_accounts')
          .update({
            name: data.name,
            bank: data.bank,
            account_number: data.account_number,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date,
          })
          .eq('id', editingAccount.id);

        if (updateError) throw updateError;

        // Delete existing store associations
        const { error: deleteError } = await supabase
          .from('card_account_stores')
          .delete()
          .eq('account_id', editingAccount.id);

        if (deleteError) throw deleteError;

        // Insert new store associations
        if (data.store_ids.length > 0) {
          const storeAssociations = data.store_ids.map(storeId => ({
            account_id: editingAccount.id,
            store_id: storeId,
          }));

          const { error: insertError } = await supabase
            .from('card_account_stores')
            .insert(storeAssociations);

          if (insertError) throw insertError;
        }

        toast.success('Conta cartão atualizada com sucesso!');
      } else {
        // Create new account with matrix_id
        if (!matrixId) {
          toast.error('Matriz do usuário não encontrada');
          return;
        }

        const { data: newAccount, error: insertError } = await supabase
          .from('card_accounts')
          .insert({
            name: data.name,
            bank: data.bank,
            account_number: data.account_number,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date,
            matrix_id: matrixId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert store associations
        if (data.store_ids.length > 0) {
          const storeAssociations = data.store_ids.map(storeId => ({
            account_id: newAccount.id,
            store_id: storeId,
          }));

          const { error: associationError } = await supabase
            .from('card_account_stores')
            .insert(storeAssociations);

          if (associationError) throw associationError;
        }

        toast.success('Conta cartão criada com sucesso!');
      }

      await fetchAccounts();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar conta cartão:', error);
      toast.error('Erro ao salvar conta cartão');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: CardAccount) => {
    setEditingAccount(account);
    const storeIds = account.card_account_stores?.map(s => s.store_id) || [];
    
    form.reset({
      name: account.name,
      bank: account.bank,
      account_number: account.account_number,
      initial_balance: Number(account.initial_balance),
      initial_balance_date: account.initial_balance_date,
      store_ids: storeIds,
    });
    
    setShowForm(true);
  };

  const handleToggleBlock = async (account: CardAccount) => {
    try {
      const { error } = await supabase
        .from('card_accounts')
        .update({ is_blocked: !account.is_blocked })
        .eq('id', account.id);

      if (error) throw error;

      toast.success(`Conta ${!account.is_blocked ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
      await fetchAccounts();
    } catch (error) {
      console.error('Erro ao alterar status da conta:', error);
      toast.error('Erro ao alterar status da conta');
    }
  };

  const handleDelete = async (account: CardAccount) => {
    try {
      // Verificar se existem transações financeiras vinculadas
      const { data: financialTransactions, error: financialTransactionsError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('account_id', account.id)
        .limit(1);

      if (financialTransactionsError) throw financialTransactionsError;

      if (financialTransactions && financialTransactions.length > 0) {
        toast.error('Esta conta cartão possui transações financeiras vinculadas e não pode ser excluída.');
        return;
      }

      // Verificar se existem registros de controle de caixa vinculados
      const { data: cashControlItems, error: cashControlError } = await supabase
        .from('cash_control_card_items')
        .select('id')
        .eq('card_account_id', account.id)
        .limit(1);

      if (cashControlError) throw cashControlError;

      if (cashControlItems && cashControlItems.length > 0) {
        toast.error('Esta conta cartão possui registros de controle de caixa vinculados e não pode ser excluída.');
        return;
      }

      if (!confirm('Tem certeza que deseja excluir esta conta cartão?')) return;

      // Delete store associations first
      const { error: deleteAssociationsError } = await supabase
        .from('card_account_stores')
        .delete()
        .eq('account_id', account.id);

      if (deleteAssociationsError) throw deleteAssociationsError;

      // Delete the account
      const { error } = await supabase
        .from('card_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Conta cartão excluída com sucesso!');
      await fetchAccounts();
    } catch (error) {
      console.error('Erro ao excluir conta cartão:', error);
      toast.error('Erro ao excluir conta cartão');
    }
  };

  const resetForm = () => {
    form.reset();
    setEditingAccount(null);
    setShowForm(false);
  };

  const getStoreNames = (account: CardAccount) => {
    if (!account.card_account_stores) return '';
    
    const accountStoreIds = account.card_account_stores.map(s => s.store_id);
    const accountStores = stores.filter(store => accountStoreIds.includes(store.id));
    
    return accountStores.map(store => store.name).join(', ');
  };

  // Filtered accounts
  const filteredAccounts = accounts.filter(account => {
    const nameMatch = account.name.toLowerCase().includes(searchName.toLowerCase());
    const storeMatch = filterStoreId === "all" || 
      account.card_account_stores?.some(cas => cas.store_id === filterStoreId);
    return nameMatch && storeMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showForm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Gestão de Contas Cartão
          </DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              {canEdit && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conta Cartão
                </Button>
              )}

              <div className="min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[200px]">
                <Label htmlFor="searchNameCard" className="text-sm mb-1 block">Filtrar por Nome</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchNameCard"
                    placeholder="Buscar por nome..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <Label htmlFor="filterStoreCard" className="text-sm mb-1 block">Filtrar por Loja</Label>
                <Select value={filterStoreId} onValueChange={setFilterStoreId}>
                  <SelectTrigger id="filterStoreCard">
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

            <div className="rounded-md border">
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
                        Nenhuma conta cartão encontrada
                      </TableCell>
                    </TableRow>
                  ) : filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>{account.bank}</TableCell>
                      <TableCell>{account.account_number}</TableCell>
                      <TableCell>R$ {Number(account.initial_balance).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(account.initial_balance_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{getStoreNames(account)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          account.is_blocked 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {account.is_blocked ? 'Bloqueada' : 'Ativa'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(account)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
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
                              variant="ghost"
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
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editingAccount ? 'Editar Conta Cartão' : 'Nova Conta Cartão'}
            </h3>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da conta cartão" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do banco" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Conta</FormLabel>
                        <FormControl>
                          <Input placeholder="Número da conta" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initial_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initial_balance_date"
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

                  <FormField
                    control={form.control}
                    name="store_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lojas Vinculadas</FormLabel>
                        <FormControl>
                          <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                            {stores.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma loja disponível</p>
                            ) : (
                              stores.map(store => (
                                <div key={store.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`card-store-${store.id}`}
                                    checked={field.value.includes(store.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, store.id]);
                                      } else {
                                        field.onChange(field.value.filter((id: string) => id !== store.id));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`card-store-${store.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {store.name} ({store.code})
                                  </label>
                                </div>
                              ))
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : editingAccount ? 'Atualizar' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};