import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
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
  const [saldoAnterior, setSaldoAnterior] = useState(0);
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

      // Buscar dados da conta para obter saldo inicial
      let initialBalance = 0;
      let initialBalanceDate = null;

      if (account.type === 'current') {
        const { data: accountData } = await supabase
          .from('current_accounts')
          .select('initial_balance, initial_balance_date')
          .eq('id', selectedAccount)
          .maybeSingle();
        if (accountData) {
          initialBalance = accountData.initial_balance;
          initialBalanceDate = accountData.initial_balance_date;
        }
      } else if (account.type === 'cash') {
        const { data: accountData } = await supabase
          .from('cash_accounts')
          .select('initial_balance, initial_balance_date')
          .eq('id', selectedAccount)
          .maybeSingle();
        if (accountData) {
          initialBalance = accountData.initial_balance;
          initialBalanceDate = accountData.initial_balance_date;
        }
      } else if (account.type === 'card') {
        const { data: accountData } = await supabase
          .from('card_accounts')
          .select('initial_balance, initial_balance_date')
          .eq('id', selectedAccount)
          .maybeSingle();
        if (accountData) {
          initialBalance = accountData.initial_balance;
          initialBalanceDate = accountData.initial_balance_date;
        }
      } else if (account.type === 'delivery') {
        const { data: accountData } = await supabase
          .from('delivery_accounts')
          .select('initial_balance, initial_balance_date')
          .eq('id', selectedAccount)
          .maybeSingle();
        if (accountData) {
          initialBalance = accountData.initial_balance;
          initialBalanceDate = accountData.initial_balance_date;
        }
      }

      const items: ExtratoItem[] = [];

      // 1. Calcular saldo anterior (dia anterior ao período)
      const dayBefore = subDays(startDate, 1);
      let saldoDiaAnterior = initialBalance;

      // Buscar todas as movimentações desde a data do saldo inicial até o dia anterior
      if (initialBalanceDate) {
        const inicialDate = new Date(initialBalanceDate);
        
        // Se o dia anterior for depois da data inicial da conta, calcular movimentações
        if (dayBefore > inicialDate) {
          // Buscar transferências desde a data inicial até o dia anterior
          const { data: transfersAnteriores } = await supabase
            .from('transfers')
            .select('*')
            .gte('transfer_date', format(inicialDate, 'yyyy-MM-dd'))
            .lte('transfer_date', format(dayBefore, 'yyyy-MM-dd'))
            .or(`source_account_id.eq.${selectedAccount},destination_account_id.eq.${selectedAccount}`)
            .order('transfer_date');

          if (transfersAnteriores) {
            for (const transfer of transfersAnteriores) {
              const isSource = transfer.source_account_id === selectedAccount;
              if (isSource) {
                saldoDiaAnterior -= transfer.amount; // Saída
              } else {
                saldoDiaAnterior += transfer.amount; // Entrada
              }
            }
          }

          // Buscar contas a pagar pagas até o dia anterior
          if (account.type === 'current' || account.type === 'cash') {
            const { data: payableInstallmentsAnteriores } = await supabase
              .from('accounts_payable_installments')
              .select(`
                amount,
                account_payable_id
              `)
              .not('payment_date', 'is', null)
              .gte('payment_date', format(inicialDate, 'yyyy-MM-dd'))
              .lte('payment_date', format(dayBefore, 'yyyy-MM-dd'));

            if (payableInstallmentsAnteriores) {
              for (const installment of payableInstallmentsAnteriores) {
                const { data: accountPayable } = await supabase
                  .from('accounts_payable')
                  .select('store_id')
                  .eq('id', installment.account_payable_id)
                  .eq('store_id', selectedStore)
                  .maybeSingle();

                if (accountPayable) {
                  saldoDiaAnterior -= installment.amount; // Saída
                }
              }
            }
          }

          // Buscar fechamentos de caixa até o dia anterior
          if (account.type === 'cash') {
            const { data: cashControlsAnteriores } = await supabase
              .from('cash_control')
              .select('faturamento_dinheiro')
              .eq('store_id', selectedStore)
              .gte('date', format(inicialDate, 'yyyy-MM-dd'))
              .lte('date', format(dayBefore, 'yyyy-MM-dd'));

            if (cashControlsAnteriores) {
              for (const cashControl of cashControlsAnteriores) {
                if (cashControl.faturamento_dinheiro > 0) {
                  saldoDiaAnterior += cashControl.faturamento_dinheiro; // Entrada
                }
              }
            }
          }
        }
      }

      setSaldoAnterior(saldoDiaAnterior);

      // 2. Buscar transferências - busca onde a conta participa, independente da loja
      const { data: transfers } = await supabase
        .from('transfers')
        .select('*')
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

          const extratoItem = {
            date: parseISO(transfer.transfer_date + 'T12:00:00'),
            description: `TRANSF. ${isSource ? 'PARA' : 'DE'} ${otherAccountName}`,
            number: '',
            installment: '',
            entrada: isSource ? 0 : transfer.amount,
            saida: isSource ? transfer.amount : 0,
            saldo: 0, // Será calculado depois
            type: 'transfer' as const
          };
          
          items.push(extratoItem);
        }
      }

      // 3. Buscar contas a pagar (saídas)
      if (account.type === 'current' || account.type === 'cash') {
        // 3.1 Buscar contas parceladas (accounts_payable_installments)
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

        if (payableInstallments && payableInstallments.length > 0) {
          for (const installment of payableInstallments) {
            // Buscar dados da conta a pagar
            const { data: accountPayable } = await supabase
              .from('accounts_payable')
              .select(`
                store_id,
                supplier_id,
                document_number,
                suppliers (name)
              `)
              .eq('id', installment.account_payable_id)
              .maybeSingle();

            // Só processar se a conta pertence à loja selecionada
            if (accountPayable && accountPayable.store_id === selectedStore) {
              // Buscar total de parcelas para esta conta a pagar
              const { count: totalInstallments } = await supabase
                .from('accounts_payable_installments')
                .select('*', { count: 'exact', head: true })
                .eq('account_payable_id', installment.account_payable_id);

              const documentNumber = accountPayable.document_number || installment.account_payable_id.toString().slice(-6);
              
              // Se tem mais de 1 parcela, mostrar número da parcela
              let installmentText = '';
              if (totalInstallments && totalInstallments > 1) {
                installmentText = `${installment.installment_number}/${totalInstallments}`;
              }
              
              items.push({
                date: parseISO(installment.payment_date + 'T12:00:00'),
                description: accountPayable.suppliers?.name || 'Fornecedor',
                number: documentNumber,
                installment: installmentText,
                entrada: 0,
                saida: installment.amount,
                saldo: 0,
                type: 'payable' as const
              });
            }
          }
        }

        // 3.2 Buscar contas SEM parcelamento (accounts_payable diretamente)
        const { data: directPayables } = await supabase
          .from('accounts_payable')
          .select(`
            id,
            document_number,
            total_amount,
            payment_date,
            store_id,
            suppliers (name)
          `)
          .eq('store_id', selectedStore)
          .not('payment_date', 'is', null)
          .gte('payment_date', format(startDate, 'yyyy-MM-dd'))
          .lte('payment_date', format(endDate, 'yyyy-MM-dd'));

        if (directPayables && directPayables.length > 0) {
          for (const payable of directPayables) {
            const documentNumber = payable.document_number || payable.id.toString().slice(-6);
            
            items.push({
              date: parseISO(payable.payment_date + 'T12:00:00'),
              description: payable.suppliers?.name || 'Fornecedor',
              number: documentNumber,
              installment: '', // Sem parcelamento
              entrada: 0,
              saida: payable.total_amount,
              saldo: 0,
              type: 'payable' as const
            });
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

      // 5. Buscar fechamentos de caixa para contas específicas
      if (account.type === 'cash') {
        const { data: cashItems } = await supabase
          .from('cash_control_cash_items')
          .select(`
            valor,
            cash_control_id
          `)
          .eq('cash_account_id', selectedAccount);

        if (cashItems) {
          for (const item of cashItems) {
            // Buscar detalhes do cash_control
            const { data: cashControl } = await supabase
              .from('cash_control')
              .select('date, store_id')
              .eq('id', item.cash_control_id)
              .eq('store_id', selectedStore)
              .gte('date', format(startDate, 'yyyy-MM-dd'))
              .lte('date', format(endDate, 'yyyy-MM-dd'))
              .maybeSingle();

            if (cashControl) {
              items.push({
                date: parseISO(cashControl.date + 'T12:00:00'),
                description: 'Faturamento: Dinheiro - Fechamento de Caixa',
                number: '',
                installment: '',
                entrada: item.valor,
                saida: 0,
                saldo: 0,
                type: 'cash_control'
              });
            }
          }
        }
      }

      // 6. Buscar faturamentos do fechamento de caixa para contas específicas
      if (account.type === 'card') {
        const { data: cardItems } = await supabase
          .from('cash_control_card_items')
          .select(`
            valor,
            cash_control_id
          `)
          .eq('card_account_id', selectedAccount);

        if (cardItems) {
          for (const item of cardItems) {
            // Buscar detalhes do cash_control
            const { data: cashControl } = await supabase
              .from('cash_control')
              .select('date, store_id')
              .eq('id', item.cash_control_id)
              .eq('store_id', selectedStore)
              .gte('date', format(startDate, 'yyyy-MM-dd'))
              .lte('date', format(endDate, 'yyyy-MM-dd'))
              .maybeSingle();

            if (cashControl) {
              items.push({
                date: parseISO(cashControl.date + 'T12:00:00'),
                description: 'Faturamento: Cartão - Fechamento de Caixa',
                number: '',
                installment: '',
                entrada: item.valor,
                saida: 0,
                saldo: 0,
                type: 'cash_control'
              });
            }
          }
        }
      } else if (account.type === 'delivery') {
        const { data: deliveryItems } = await supabase
          .from('cash_control_delivery_items')
          .select(`
            valor,
            cash_control_id
          `)
          .eq('delivery_account_id', selectedAccount);

        if (deliveryItems) {
          for (const item of deliveryItems) {
            // Buscar detalhes do cash_control
            const { data: cashControl } = await supabase
              .from('cash_control')
              .select('date, store_id')
              .eq('id', item.cash_control_id)
              .eq('store_id', selectedStore)
              .gte('date', format(startDate, 'yyyy-MM-dd'))
              .lte('date', format(endDate, 'yyyy-MM-dd'))
              .maybeSingle();

            if (cashControl) {
              items.push({
                date: parseISO(cashControl.date + 'T12:00:00'),
                description: 'Faturamento: Delivery - Fechamento de Caixa',
                number: '',
                installment: '',
                entrada: item.valor,
                saida: 0,
                saldo: 0,
                type: 'cash_control'
              });
            }
          }
        }
      } else if (account.type === 'current') {
        const { data: cashItems } = await supabase
          .from('cash_control_account_items')
          .select(`
            valor,
            cash_control_id
          `)
          .eq('current_account_id', selectedAccount);

        if (cashItems) {
          for (const item of cashItems) {
            // Buscar detalhes do cash_control
            const { data: cashControl } = await supabase
              .from('cash_control')
              .select('date, store_id')
              .eq('id', item.cash_control_id)
              .eq('store_id', selectedStore)
              .gte('date', format(startDate, 'yyyy-MM-dd'))
              .lte('date', format(endDate, 'yyyy-MM-dd'))
              .maybeSingle();

            if (cashControl) {
              items.push({
                date: parseISO(cashControl.date + 'T12:00:00'),
                description: 'Faturamento: Conta - Fechamento de Caixa',
                number: '',
                installment: '',
                entrada: item.valor,
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
      let saldoAtual = saldoDiaAnterior;
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
            <div className="p-4 border-b bg-muted/50 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">Extrato da Conta</h3>
                <p className="text-sm text-muted-foreground">
                  {accounts.find(acc => acc.id === selectedAccount)?.name} - 
                  {startDate && endDate && ` ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo Anterior</p>
                <p className="text-lg font-semibold">{formatCurrency(saldoAnterior)}</p>
              </div>
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
                {/* Linha de Totais */}
                <TableRow className="border-t-2 bg-muted/30">
                  <TableCell colSpan={4} className="font-semibold text-center">
                    TOTAIS
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatCurrency(extratoItems.reduce((total, item) => total + item.entrada, 0))}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {formatCurrency(extratoItems.reduce((total, item) => total + item.saida, 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {extratoItems.length > 0 ? formatCurrency(extratoItems[extratoItems.length - 1].saldo) : formatCurrency(saldoAnterior)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}