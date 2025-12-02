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

interface DeliveryAccount {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  initial_balance: number;
  initial_balance_date: string;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  delivery_account_stores?: { store_id: string }[] | null;
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface DeliveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  initial_balance: number;
  initial_balance_date: string;
  store_ids: string[];
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  initial_balance: z.number().min(0, "Saldo inicial deve ser positivo"),
  initial_balance_date: z.string().min(1, "Data do saldo inicial é obrigatória"),
  store_ids: z.array(z.string()).min(1, "Selecione pelo menos uma loja"),
});

export const DeliveryModal = ({ open, onOpenChange }: DeliveryModalProps) => {
  const [accounts, setAccounts] = useState<DeliveryAccount[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [editingAccount, setEditingAccount] = useState<DeliveryAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [filterStoreId, setFilterStoreId] = useState<string>("all");

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      initial_balance: 0,
      initial_balance_date: new Date().toISOString().split('T')[0],
      store_ids: [],
    },
  });

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_accounts')
        .select(`
          *,
          delivery_account_stores (
            store_id
          )
        `)
        .order('name');

      if (error) throw error;
      setAccounts((data as any) || []);
    } catch (error) {
      console.error('Erro ao buscar contas delivery:', error);
      toast.error('Erro ao carregar contas delivery');
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  useEffect(() => {
    if (open) {
      fetchAccounts();
      fetchStores();
    }
  }, [open]);

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      if (editingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('delivery_accounts')
          .update({
            name: data.name,
            contact_person: data.contact_person || null,
            phone: data.phone || null,
            email: data.email || null,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date,
          })
          .eq('id', editingAccount.id);

        if (updateError) throw updateError;

        // Delete existing store associations
        const { error: deleteError } = await supabase
          .from('delivery_account_stores')
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
            .from('delivery_account_stores')
            .insert(storeAssociations);

          if (insertError) throw insertError;
        }

        toast.success('Conta delivery atualizada com sucesso!');
      } else {
        // Create new account
        const { data: newAccount, error: insertError } = await supabase
          .from('delivery_accounts')
          .insert({
            name: data.name,
            contact_person: data.contact_person || null,
            phone: data.phone || null,
            email: data.email || null,
            initial_balance: data.initial_balance,
            initial_balance_date: data.initial_balance_date,
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
            .from('delivery_account_stores')
            .insert(storeAssociations);

          if (associationError) throw associationError;
        }

        toast.success('Conta delivery criada com sucesso!');
      }

      await fetchAccounts();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar conta delivery:', error);
      toast.error('Erro ao salvar conta delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: DeliveryAccount) => {
    setEditingAccount(account);
    const storeIds = account.delivery_account_stores?.map(s => s.store_id) || [];
    
    form.reset({
      name: account.name,
      contact_person: account.contact_person || "",
      phone: account.phone || "",
      email: account.email || "",
      initial_balance: Number(account.initial_balance),
      initial_balance_date: account.initial_balance_date,
      store_ids: storeIds,
    });
    
    setShowForm(true);
  };

  const handleToggleBlock = async (account: DeliveryAccount) => {
    try {
      const { error } = await supabase
        .from('delivery_accounts')
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

  const handleDelete = async (account: DeliveryAccount) => {
    if (!confirm('Tem certeza que deseja excluir esta conta delivery?')) return;

    try {
      // Delete store associations first
      const { error: deleteAssociationsError } = await supabase
        .from('delivery_account_stores')
        .delete()
        .eq('account_id', account.id);

      if (deleteAssociationsError) throw deleteAssociationsError;

      // Delete the account
      const { error } = await supabase
        .from('delivery_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Conta delivery excluída com sucesso!');
      await fetchAccounts();
    } catch (error) {
      console.error('Erro ao excluir conta delivery:', error);
      toast.error('Erro ao excluir conta delivery');
    }
  };

  const resetForm = () => {
    form.reset();
    setEditingAccount(null);
    setShowForm(false);
  };

  const getStoreNames = (account: DeliveryAccount) => {
    if (!account.delivery_account_stores) return '';
    
    const accountStoreIds = account.delivery_account_stores.map(s => s.store_id);
    const accountStores = stores.filter(store => accountStoreIds.includes(store.id));
    
    return accountStores.map(store => store.name).join(', ');
  };

  // Filtered accounts
  const filteredAccounts = accounts.filter(account => {
    const nameMatch = account.name.toLowerCase().includes(searchName.toLowerCase());
    const storeMatch = filterStoreId === "all" || 
      account.delivery_account_stores?.some(das => das.store_id === filterStoreId);
    return nameMatch && storeMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
            Gestão de Contas Delivery
          </DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta Delivery
              </Button>

              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="searchNameDelivery" className="text-sm mb-1 block">Filtrar por Nome</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchNameDelivery"
                    placeholder="Buscar por nome..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="min-w-[200px]">
                <Label htmlFor="filterStoreDelivery" className="text-sm mb-1 block">Filtrar por Loja</Label>
                <Select value={filterStoreId} onValueChange={setFilterStoreId}>
                  <SelectTrigger id="filterStoreDelivery">
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
                    <TableHead>Pessoa de Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
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
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Nenhuma conta delivery encontrada
                      </TableCell>
                    </TableRow>
                  ) : filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>{account.contact_person || '-'}</TableCell>
                      <TableCell>{account.phone || '-'}</TableCell>
                      <TableCell>{account.email || '-'}</TableCell>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(account)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
              {editingAccount ? 'Editar Conta Delivery' : 'Nova Conta Delivery'}
            </h3>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da conta delivery" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_person"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pessoa de Contato</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do responsável" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="Telefone de contato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Email de contato" type="email" {...field} />
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
                          <Select 
                            value={field.value.join(',')} 
                            onValueChange={(value) => {
                              const ids = value ? value.split(',') : [];
                              field.onChange(ids);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione as lojas" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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