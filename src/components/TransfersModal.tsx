import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Edit, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TransferFormModal } from "./TransferFormModal";

interface Transfer {
  id: string;
  store_id: string;
  transfer_date: string;
  source_account_id: string;
  destination_account_id: string;
  source_account_type: 'current' | 'cash' | 'card' | 'delivery';
  destination_account_type: 'current' | 'cash' | 'card' | 'delivery';
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  source_account_name?: string;
  destination_account_name?: string;
}

interface Store {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
}

interface TransfersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransfersModal({ open, onOpenChange }: TransfersModalProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [viewingTransfer, setViewingTransfer] = useState<Transfer | null>(null);
  const { toast } = useToast();

  // Filtros
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  useEffect(() => {
    if (open) {
      fetchStores();
      fetchAccounts();
      fetchTransfers();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchTransfers();
    }
  }, [selectedStore, selectedAccount, startDate, endDate]);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .order('name');

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar lojas",
        variant: "destructive",
      });
      return;
    }

    setStores(data || []);
  };

  const fetchAccounts = async () => {
    const accountsData: Account[] = [];

    // Buscar contas correntes
    const { data: currentAccounts } = await supabase
      .from('current_accounts')
      .select('id, name')
      .eq('is_active', true);

    // Buscar contas caixa
    const { data: cashAccounts } = await supabase
      .from('cash_accounts')
      .select('id, name')
      .eq('is_active', true);

    // Buscar contas cartão
    const { data: cardAccounts } = await supabase
      .from('card_accounts')
      .select('id, name')
      .eq('is_active', true);

    // Buscar contas delivery
    const { data: deliveryAccounts } = await supabase
      .from('delivery_accounts')
      .select('id, name')
      .eq('is_active', true);

    if (currentAccounts) {
      accountsData.push(...currentAccounts.map(acc => ({ ...acc, type: 'current' as const })));
    }
    if (cashAccounts) {
      accountsData.push(...cashAccounts.map(acc => ({ ...acc, type: 'cash' as const })));
    }
    if (cardAccounts) {
      accountsData.push(...cardAccounts.map(acc => ({ ...acc, type: 'card' as const })));
    }
    if (deliveryAccounts) {
      accountsData.push(...deliveryAccounts.map(acc => ({ ...acc, type: 'delivery' as const })));
    }

    setAccounts(accountsData);
  };

  const fetchTransfers = async () => {
    setLoading(true);
    let query = supabase
      .from('transfers')
      .select('*')
      .order('transfer_date', { ascending: false });

    if (selectedStore) {
      query = query.eq('store_id', selectedStore);
    }

    if (startDate) {
      query = query.gte('transfer_date', format(startDate, 'yyyy-MM-dd'));
    }

    if (endDate) {
      query = query.lte('transfer_date', format(endDate, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar transferências",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Enriquecer com nomes das contas
    const enrichedTransfers = data?.map(transfer => {
      const sourceAccount = accounts.find(acc => 
        acc.id === transfer.source_account_id && acc.type === transfer.source_account_type
      );
      const destinationAccount = accounts.find(acc => 
        acc.id === transfer.destination_account_id && acc.type === transfer.destination_account_type
      );

      return {
        ...transfer,
        source_account_name: sourceAccount?.name || 'Conta não encontrada',
        destination_account_name: destinationAccount?.name || 'Conta não encontrada',
      } as Transfer;
    }) || [];

    // Filtrar por conta se selecionada
    let filteredTransfers = enrichedTransfers;
    if (selectedAccount) {
      filteredTransfers = enrichedTransfers.filter(transfer => 
        transfer.source_account_id === selectedAccount || transfer.destination_account_id === selectedAccount
      );
    }

    setTransfers(filteredTransfers);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transferência?")) return;

    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir transferência",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Transferência excluída com sucesso",
    });

    fetchTransfers();
  };

  const handleEdit = (transfer: Transfer) => {
    setEditingTransfer(transfer);
    setShowForm(true);
  };

  const handleView = (transfer: Transfer) => {
    setViewingTransfer(transfer);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTransfer(null);
    setViewingTransfer(null);
    fetchTransfers();
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      current: 'Conta Corrente',
      cash: 'Conta Caixa',
      card: 'Conta Cartão',
      delivery: 'Delivery'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transferências</DialogTitle>
            <DialogDescription>
              Gerencie as transferências entre suas contas financeiras
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="space-y-4 border-b pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Loja</label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as lojas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Conta</label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as contas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({getAccountTypeLabel(account.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Botão Cadastrar */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Transferência
            </Button>
          </div>

          {/* Tabela */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta Origem</TableHead>
                  <TableHead>Conta Destino</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Nenhuma transferência encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{format(new Date(transfer.transfer_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transfer.source_account_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getAccountTypeLabel(transfer.source_account_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transfer.destination_account_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getAccountTypeLabel(transfer.destination_account_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transfer.amount)}
                      </TableCell>
                      <TableCell>{transfer.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(transfer)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(transfer)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transfer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <TransferFormModal
        open={showForm}
        onOpenChange={handleFormClose}
        transfer={editingTransfer || viewingTransfer}
        readonly={!!viewingTransfer}
        stores={stores}
        accounts={accounts}
      />
    </>
  );
}