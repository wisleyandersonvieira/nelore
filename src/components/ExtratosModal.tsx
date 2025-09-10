import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Store {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
  store_name?: string;
  store_id?: string;
}

interface ExtratoItem {
  date: Date;
  description: string;
  number?: string;
  installment?: string;
  entrada: number;
  saida: number;
  saldo: number;
  type: 'payable' | 'receivable' | 'cash_control' | 'transfer';
}

interface ExtratosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtratosModal({ open, onOpenChange }: ExtratosModalProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [extratoItems, setExtratoItems] = useState<ExtratoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchStores();
      fetchAccounts();
    }
  }, [open]);

  // Limpar conta selecionada quando trocar de loja
  useEffect(() => {
    setSelectedAccount("");
  }, [selectedStore]);

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
    try {
      const accountPromises = [
        // Buscar current accounts com lojas
        supabase
          .from('current_accounts')
          .select(`
            id, name,
            current_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar cash accounts com lojas
        supabase
          .from('cash_accounts')
          .select(`
            id, name,
            cash_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar card accounts com lojas
        supabase
          .from('card_accounts')
          .select(`
            id, name,
            card_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar delivery accounts com lojas
        supabase
          .from('delivery_accounts')
          .select(`
            id, name,
            delivery_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true)
      ];

      const [currentResult, cashResult, cardResult, deliveryResult] = await Promise.all(accountPromises);

      const allAccounts = [
        ...(currentResult.data || []).flatMap(acc => 
          acc.current_account_stores?.map(store_rel => ({
            id: acc.id, 
            name: acc.name, 
            type: 'current' as const,
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id
          })) || []
        ),
        ...(cashResult.data || []).flatMap(acc => 
          acc.cash_account_stores?.map(store_rel => ({
            id: acc.id, 
            name: acc.name, 
            type: 'cash' as const,
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id
          })) || []
        ),
        ...(cardResult.data || []).flatMap(acc => 
          acc.card_account_stores?.map(store_rel => ({
            id: acc.id, 
            name: acc.name, 
            type: 'card' as const,
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id
          })) || []
        ),
        ...(deliveryResult.data || []).flatMap(acc => 
          acc.delivery_account_stores?.map(store_rel => ({
            id: acc.id, 
            name: acc.name, 
            type: 'delivery' as const,
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id
          })) || []
        )
      ];

      setAccounts(allAccounts);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
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

  // Filtrar contas por loja selecionada
  const filteredAccounts = selectedStore 
    ? accounts.filter(acc => acc.store_id === selectedStore)
    : accounts;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  const generateExtrato = async () => {
    if (!selectedStore || !selectedAccount || !startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const account = accounts.find(acc => acc.id === selectedAccount);
      if (!account) return;

      const items: ExtratoItem[] = [];

      // 1. Buscar saldo inicial (dia anterior)
      const dayBefore = subDays(startDate, 1);
      let saldoAnterior = 0;

      // TODO: Implementar cálculo do saldo anterior baseado em todas as movimentações até o dia anterior

      // 2. Buscar transferências
      const { data: transfers } = await supabase
        .from('transfers')
        .select('*')
        .eq('store_id', selectedStore)
        .gte('transfer_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transfer_date', format(endDate, 'yyyy-MM-dd'))
        .or(`source_account_id.eq.${selectedAccount},destination_account_id.eq.${selectedAccount}`)
        .order('transfer_date');

      // Processar transferências
      if (transfers) {
        for (const transfer of transfers) {
          const isSource = transfer.source_account_id === selectedAccount;
          const otherAccountId = isSource ? transfer.destination_account_id : transfer.source_account_id;
          const otherAccountType = isSource ? transfer.destination_account_type : transfer.source_account_type;
          
          // Buscar nome da outra conta
          let otherAccountName = '';
          
          // Buscar baseado no tipo da conta
          if (otherAccountType === 'current') {
            const { data: otherAccount } = await supabase
              .from('current_accounts')
              .select('name')
              .eq('id', otherAccountId)
              .maybeSingle();
            if (otherAccount) otherAccountName = otherAccount.name;
          } else if (otherAccountType === 'cash') {
            const { data: otherAccount } = await supabase
              .from('cash_accounts')
              .select('name')
              .eq('id', otherAccountId)
              .maybeSingle();
            if (otherAccount) otherAccountName = otherAccount.name;
          } else if (otherAccountType === 'card') {
            const { data: otherAccount } = await supabase
              .from('card_accounts')
              .select('name')
              .eq('id', otherAccountId)
              .maybeSingle();
            if (otherAccount) otherAccountName = otherAccount.name;
          } else if (otherAccountType === 'delivery') {
            const { data: otherAccount } = await supabase
              .from('delivery_accounts')
              .select('name')
              .eq('id', otherAccountId)
              .maybeSingle();
            if (otherAccount) otherAccountName = otherAccount.name;
          }

          items.push({
            date: new Date(transfer.transfer_date + 'T00:00:00'),
            description: `TRANSF. ${isSource ? otherAccountName : otherAccountName}`,
            number: '',
            installment: '',
            entrada: isSource ? 0 : transfer.amount,
            saida: isSource ? transfer.amount : 0,
            saldo: 0, // Será calculado depois
            type: 'transfer'
          });
        }
      }

      // 3. Buscar contas a pagar (saídas)
      if (account.type === 'current' || account.type === 'cash') {
        const { data: payableInstallments } = await supabase
          .from('accounts_payable_installments')
          .select(`
            id,
            installment_number,
            amount,
            payment_date,
            account_payable_id
          `)
          .not('payment_date', 'is', null)
          .gte('payment_date', format(startDate, 'yyyy-MM-dd'))
          .lte('payment_date', format(endDate, 'yyyy-MM-dd'));

        if (payableInstallments) {
          // Buscar dados das contas a pagar relacionadas
          for (const installment of payableInstallments) {
            const { data: accountPayable } = await supabase
              .from('accounts_payable')
              .select(`
                store_id,
                supplier_id,
                document_number,
                suppliers (name)
              `)
              .eq('id', installment.account_payable_id)
              .eq('store_id', selectedStore)
              .maybeSingle();

            // Buscar total de parcelas para esta conta a pagar
            const { count: totalInstallments } = await supabase
              .from('accounts_payable_installments')
              .select('*', { count: 'exact', head: true })
              .eq('account_payable_id', installment.account_payable_id);

            if (accountPayable) {
              const documentNumber = accountPayable.document_number || installment.account_payable_id.toString().slice(-6);
              const installmentText = totalInstallments ? `${installment.installment_number}/${totalInstallments}` : `${installment.installment_number}`;
              
              items.push({
                date: new Date(installment.payment_date),
                description: accountPayable.suppliers?.name || 'Fornecedor',
                number: documentNumber,
                installment: installmentText,
                entrada: 0,
                saida: installment.amount,
                saldo: 0,
                type: 'payable'
              });
            }
          }
        }
      }

      // 4. Buscar contas a receber (entradas) - DESABILITADO - Tabela não existe
      // TODO: Implementar quando a tabela accounts_receivable_installments for criada
      /*
      if (account.type === 'current' || account.type === 'cash') {
        // Código comentado até tabela ser criada
      }
      */

      // 5. Buscar fechamentos de caixa (apenas para contas específicas)
      if (account.type === 'cash') {
        const { data: cashControls } = await supabase
          .from('cash_control')
          .select('*')
          .eq('store_id', selectedStore)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'));

        if (cashControls) {
          for (const cashControl of cashControls) {
            // Faturamento Dinheiro
            if (cashControl.faturamento_dinheiro > 0) {
              items.push({
                date: new Date(cashControl.date),
                description: 'Faturamento: Dinheiro',
                number: '',
                installment: '',
                entrada: cashControl.faturamento_dinheiro,
                saida: 0,
                saldo: 0,
                type: 'cash_control'
              });
            }
          }
        }
      }

      // Ordenar por data
      items.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calcular saldos
      let saldoAtual = saldoAnterior;
      const itemsWithSaldo = items.map(item => {
        saldoAtual += item.entrada - item.saida;
        return {
          ...item,
          saldo: saldoAtual
        };
      });

      setExtratoItems(itemsWithSaldo);

    } catch (error) {
      console.error('Erro ao gerar extrato:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar extrato",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extratos de Contas
          </DialogTitle>
          <DialogDescription>
            Gere extratos detalhados das movimentações das suas contas
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <label className="text-sm font-medium mb-2 block">Loja *</label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Conta *</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({getAccountTypeLabel(account.type)}){account.store_name ? ` - ${account.store_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Início *</label>
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
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Selecionar data"}
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
            <label className="text-sm font-medium mb-2 block">Data Fim *</label>
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
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Selecionar data"}
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

        <div className="flex justify-center">
          <Button 
            onClick={generateExtrato} 
            disabled={loading || !selectedStore || !selectedAccount || !startDate || !endDate}
            className="px-8"
          >
            {loading ? "Gerando..." : "Gerar Extrato"}
          </Button>
        </div>

        {/* Tabela de Extrato */}
        {extratoItems.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-4 border-b bg-muted/50">
              <h3 className="text-lg font-semibold">Extrato da Conta</h3>
              <p className="text-sm text-muted-foreground">
                {accounts.find(acc => acc.id === selectedAccount)?.name} - 
                {startDate && endDate && ` ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`}
              </p>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extratoItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(item.date, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.number}</TableCell>
                    <TableCell>{item.installment}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {item.entrada > 0 ? formatCurrency(item.entrada) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {item.saida > 0 ? formatCurrency(item.saida) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.saldo)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}