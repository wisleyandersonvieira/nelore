import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Download, FileDown } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setStores(data || []);
      } else {
        const storeIds: string[] = [];
        if (profile?.store_id) storeIds.push(profile.store_id);
        
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);
        
        userStores?.forEach(us => {
          if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
        });

        if (storeIds.length > 0) {
          const { data, error } = await supabase
            .from('stores')
            .select('id, name')
            .in('id', storeIds)
            .order('name');

          if (error) throw error;
          setStores(data || []);
        } else {
          setStores([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lojas",
        variant: "destructive",
      });
    }
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
              .from('financial_transactions')
              .select('amount')
              .eq('store_id', selectedStore)
              .eq('account_id', selectedAccount)
              .eq('reference_type', 'accounts_payable')
              .eq('transaction_type', 'saida')
              .gte('transaction_date', format(inicialDate, 'yyyy-MM-dd'))
              .lte('transaction_date', format(dayBefore, 'yyyy-MM-dd'));

            if (payableInstallmentsAnteriores) {
              for (const transaction of payableInstallmentsAnteriores) {
                saldoDiaAnterior -= transaction.amount; // Saída
              }
            }

            // Buscar contas a receber recebidas até o dia anterior
            const { data: receivableTransactionsAnteriores } = await supabase
              .from('financial_transactions')
              .select('amount')
              .eq('store_id', selectedStore)
              .eq('account_id', selectedAccount)
              .in('reference_type', ['accounts_receivable', 'accounts_receivable_installments'])
              .eq('transaction_type', 'entrada')
              .gte('transaction_date', format(inicialDate, 'yyyy-MM-dd'))
              .lte('transaction_date', format(dayBefore, 'yyyy-MM-dd'));

            if (receivableTransactionsAnteriores) {
              for (const transaction of receivableTransactionsAnteriores) {
                saldoDiaAnterior += transaction.amount; // Entrada
              }
            }
          }

          // Buscar fechamentos de caixa até o dia anterior para conta caixa específica
          if (account.type === 'cash') {
            // Buscar apenas itens específicos da conta caixa selecionada
            const { data: cashItemsAnteriores } = await supabase
              .from('cash_control_cash_items')
              .select(`
                valor,
                cash_control_id
              `)
              .eq('cash_account_id', selectedAccount);

            if (cashItemsAnteriores) {
              for (const item of cashItemsAnteriores) {
                // Buscar detalhes do cash_control
                const { data: cashControl } = await supabase
                  .from('cash_control')
                  .select('date')
                  .eq('id', item.cash_control_id)
                  .eq('store_id', selectedStore)
                  .gte('date', format(inicialDate, 'yyyy-MM-dd'))
                  .lte('date', format(dayBefore, 'yyyy-MM-dd'))
                  .maybeSingle();

                if (cashControl) {
                  saldoDiaAnterior += item.valor; // Entrada
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

      // 3. Buscar contas a pagar (saídas) - Para todas as contas que podem fazer pagamentos
      if (account.type === 'current' || account.type === 'cash' || account.type === 'card') {
        // 3.1. Buscar pagamentos usando financial_transactions (tanto integrais quanto parcelas)
        const { data: payableTransactions } = await supabase
          .from('financial_transactions')
          .select(`
            id,
            amount,
            transaction_date,
            description,
            reference_id,
            reference_type
          `)
          .eq('store_id', selectedStore)
          .eq('account_id', selectedAccount)
          .in('reference_type', ['accounts_payable', 'accounts_payable_installments'])
          .eq('transaction_type', 'saida')
          .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
          .lte('transaction_date', format(endDate, 'yyyy-MM-dd'));

        if (payableTransactions && payableTransactions.length > 0) {
          for (const transaction of payableTransactions) {
            // Verificar se a transação ainda é válida (não foi estornada)
            let isValidTransaction = false;
            let documentNumber = '';
            let installmentInfo = '';
            let description = transaction.description || 'Pagamento de Conta';

            // Se for uma parcela, verificar se ainda está paga
            if (transaction.reference_type === 'accounts_payable_installments') {
              const { data: installmentData } = await supabase
                .from('accounts_payable_installments')
                .select(`
                  installment_number,
                  payment_date,
                  account_payable_id,
                  accounts_payable!inner (
                    document_number,
                    description,
                    employee_id,
                    suppliers (
                      name
                    )
                  )
                `)
                .eq('id', transaction.reference_id)
                .maybeSingle();

              // Só incluir se a parcela ainda tem payment_date E a data de pagamento corresponde à data da transação
              // Isso evita mostrar transações de pagamentos que foram estornados e pagos novamente
              if (installmentData && installmentData.payment_date !== null && 
                  installmentData.payment_date === transaction.transaction_date) {
                isValidTransaction = true;
                documentNumber = installmentData.accounts_payable?.document_number || '';
                
                // Verificar se é funcionário ou fornecedor
                const employeeId = installmentData.accounts_payable?.employee_id;
                if (employeeId) {
                  // Buscar nome do funcionário
                  const { data: employeeData } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('id', employeeId)
                    .maybeSingle();
                  description = employeeData?.name || 'Funcionário não informado';
                } else {
                  const supplierName = installmentData.accounts_payable?.suppliers?.name || 'Fornecedor não informado';
                  description = supplierName;
                }
                
                // Buscar total de parcelas para mostrar "1/3" formato
                const { data: totalInstallments } = await supabase
                  .from('accounts_payable_installments')
                  .select('installment_number')
                  .eq('account_payable_id', installmentData.account_payable_id)
                  .order('installment_number', { ascending: false })
                  .limit(1);

                const maxInstallment = totalInstallments?.[0]?.installment_number || 1;
                installmentInfo = `${installmentData.installment_number}/${maxInstallment}`;
              }
            } else if (transaction.reference_type === 'accounts_payable') {
              // Se for pagamento integral, verificar se ainda está pago E se a data de pagamento atual corresponde à transação
              const { data: payableData } = await supabase
                .from('accounts_payable')
                .select(`
                  document_number, 
                  description,
                  payment_date,
                  status,
                  employee_id,
                  suppliers (
                    name
                  )
                `)
                .eq('id', transaction.reference_id)
                .maybeSingle();

              // Só incluir se a conta ainda está paga E a data de pagamento corresponde à data da transação
              // Isso evita mostrar transações de pagamentos que foram estornados e pagos novamente
              if (payableData && payableData.payment_date !== null && payableData.status !== 'pending' &&
                  payableData.payment_date === transaction.transaction_date) {
                isValidTransaction = true;
                documentNumber = payableData.document_number || '';
                
                // Verificar se é funcionário ou fornecedor
                if (payableData.employee_id) {
                  // Buscar nome do funcionário
                  const { data: employeeData } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('id', payableData.employee_id)
                    .maybeSingle();
                  description = employeeData?.name || 'Funcionário não informado';
                } else {
                  const supplierName = payableData.suppliers?.name || 'Fornecedor não informado';
                  description = supplierName;
                }
                installmentInfo = 'Integral';
              }
            }

            // Só adicionar ao extrato se a transação ainda for válida
            if (isValidTransaction) {
              items.push({
                date: parseISO(transaction.transaction_date + 'T12:00:00'),
                description: description,
                number: documentNumber,
                installment: installmentInfo,
                entrada: 0,
                saida: transaction.amount,
                saldo: 0,
                type: 'payable' as const
              });
            }
          }
        }
      }

      // 4. Buscar contas a receber (entradas) - Para contas que podem receber pagamentos
      if (account.type === 'current' || account.type === 'cash' || account.type === 'card') {
        // 4.1. Buscar recebimentos usando financial_transactions
        const { data: receivableTransactions } = await supabase
          .from('financial_transactions')
          .select(`
            id,
            amount,
            transaction_date,
            description,
            reference_id,
            reference_type
          `)
          .eq('store_id', selectedStore)
          .eq('account_id', selectedAccount)
          .in('reference_type', ['accounts_receivable', 'accounts_receivable_installments'])
          .eq('transaction_type', 'entrada')
          .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
          .lte('transaction_date', format(endDate, 'yyyy-MM-dd'));

        if (receivableTransactions && receivableTransactions.length > 0) {
          for (const transaction of receivableTransactions) {
            let isValidTransaction = false;
            let documentNumber = '';
            let installmentInfo = '';
            let description = transaction.description || 'Recebimento de Conta';

            // Se for uma parcela, verificar se ainda está paga
            if (transaction.reference_type === 'accounts_receivable_installments') {
              const { data: installmentData } = await supabase
                .from('accounts_receivable_installments')
                .select(`
                  installment_number,
                  payment_date,
                  account_receivable_id,
                  accounts_receivable!inner (
                    document_number,
                    description,
                    creditor_id,
                    creditors (
                      name
                    )
                  )
                `)
                .eq('id', transaction.reference_id)
                .maybeSingle();

              // Só incluir se a parcela ainda tem payment_date E a data de pagamento corresponde à data da transação
              if (installmentData && installmentData.payment_date !== null && 
                  installmentData.payment_date === transaction.transaction_date) {
                isValidTransaction = true;
                documentNumber = installmentData.accounts_receivable?.document_number || '';
                
                // Verificar se tem credor associado
                const creditorName = installmentData.accounts_receivable?.creditors?.name || 'Cliente não informado';
                description = creditorName;
                
                // Buscar total de parcelas para mostrar "1/3" formato
                const { data: totalInstallments } = await supabase
                  .from('accounts_receivable_installments')
                  .select('installment_number')
                  .eq('account_receivable_id', installmentData.account_receivable_id)
                  .order('installment_number', { ascending: false })
                  .limit(1);

                const maxInstallment = totalInstallments?.[0]?.installment_number || 1;
                installmentInfo = `${installmentData.installment_number}/${maxInstallment}`;
              }
            } else if (transaction.reference_type === 'accounts_receivable') {
              // Se for recebimento integral, verificar se ainda está pago
              const { data: receivableData } = await supabase
                .from('accounts_receivable')
                .select(`
                  document_number, 
                  description,
                  payment_date,
                  status,
                  creditor_id,
                  creditors (
                    name
                  )
                `)
                .eq('id', transaction.reference_id)
                .maybeSingle();

              // Só incluir se a conta ainda está paga E a data de pagamento corresponde à data da transação
              if (receivableData && receivableData.payment_date !== null && receivableData.status !== 'pending' &&
                  receivableData.payment_date === transaction.transaction_date) {
                isValidTransaction = true;
                documentNumber = receivableData.document_number || '';
                
                const creditorName = receivableData.creditors?.name || 'Cliente não informado';
                description = creditorName;
                installmentInfo = 'Integral';
              }
            }

            // Só adicionar ao extrato se a transação ainda for válida
            if (isValidTransaction) {
              items.push({
                date: parseISO(transaction.transaction_date + 'T12:00:00'),
                description: description,
                number: documentNumber,
                installment: installmentInfo,
                entrada: transaction.amount,
                saida: 0,
                saldo: 0,
                type: 'receivable' as const
              });
            }
          }
        }
      }

      // 5. Buscar fechamentos de caixa para conta caixa específica
      if (account.type === 'cash') {
        // Buscar apenas itens específicos da conta caixa selecionada
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const accountName = accounts.find(acc => acc.id === selectedAccount)?.name || '';
    const periodText = startDate && endDate 
      ? `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}` 
      : '';

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE CONTA", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(accountName, 105, 28, { align: "center" });
    doc.text(`Período: ${periodText}`, 105, 35, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Saldo Anterior: ${formatCurrency(saldoAnterior)}`, 20, 45);

    // Table data
    const tableData = extratoItems.map(item => [
      format(item.date, 'dd/MM/yyyy'),
      item.description,
      item.number || '',
      item.installment || '',
      item.entrada > 0 ? formatCurrency(item.entrada) : '-',
      item.saida > 0 ? formatCurrency(item.saida) : '-',
      item.saldo < 0 ? `-${formatCurrency(item.saldo)}` : formatCurrency(item.saldo)
    ]);

    // Calculate totals
    const totalEntrada = extratoItems.reduce((total, item) => total + item.entrada, 0);
    const totalSaida = extratoItems.reduce((total, item) => total + item.saida, 0);
    const saldoFinal = extratoItems.length > 0 ? extratoItems[extratoItems.length - 1].saldo : saldoAnterior;
    
    // Add total row
    tableData.push([
      { content: "TOTAIS", colSpan: 4, styles: { fontStyle: "bold", halign: "center" } } as any,
      { content: formatCurrency(totalEntrada), styles: { fontStyle: "bold" } } as any,
      { content: formatCurrency(totalSaida), styles: { fontStyle: "bold" } } as any,
      { content: saldoFinal < 0 ? `-${formatCurrency(saldoFinal)}` : formatCurrency(saldoFinal), styles: { fontStyle: "bold" } } as any
    ]);

    autoTable(doc, {
      head: [["Data", "Descrição", "Número", "Parcela", "Entrada", "Saída", "Saldo"]],
      body: tableData,
      startY: 52,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 10, right: 10 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save(`extrato-${accountName.replace(/\s+/g, '-').toLowerCase()}-${format(startDate!, 'yyyy-MM-dd')}.pdf`);
    
    toast({
      title: "PDF exportado",
      description: "O extrato foi exportado com sucesso",
    });
  };

  const exportToExcel = () => {
    const accountName = accounts.find(acc => acc.id === selectedAccount)?.name || '';
    const periodText = startDate && endDate 
      ? `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}` 
      : '';

    // Create data for Excel
    const excelData = extratoItems.map(item => ({
      Data: format(item.date, 'dd/MM/yyyy'),
      Descrição: item.description,
      Número: item.number || '',
      Parcela: item.installment || '',
      Entrada: item.entrada > 0 ? item.entrada : 0,
      Saída: item.saida > 0 ? item.saida : 0,
      Saldo: item.saldo
    }));

    // Add totals row
    const totalEntrada = extratoItems.reduce((total, item) => total + item.entrada, 0);
    const totalSaida = extratoItems.reduce((total, item) => total + item.saida, 0);
    const saldoFinal = extratoItems.length > 0 ? extratoItems[extratoItems.length - 1].saldo : saldoAnterior;

    excelData.push({
      Data: 'TOTAIS',
      Descrição: '',
      Número: '',
      Parcela: '',
      Entrada: totalEntrada,
      Saída: totalSaida,
      Saldo: saldoFinal
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Add header info
    XLSX.utils.sheet_add_aoa(ws, [
      [`Extrato de Conta: ${accountName}`],
      [`Período: ${periodText}`],
      [`Saldo Anterior: ${formatCurrency(saldoAnterior)}`],
      []
    ], { origin: 'A1' });

    // Shift data down
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.e.r; R >= 0; --R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const oldCell = XLSX.utils.encode_cell({ r: R, c: C });
        const newCell = XLSX.utils.encode_cell({ r: R + 4, c: C });
        if (ws[oldCell]) {
          ws[newCell] = ws[oldCell];
          delete ws[oldCell];
        }
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r + 4, c: range.e.c } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    XLSX.writeFile(wb, `extrato-${accountName.replace(/\s+/g, '-').toLowerCase()}-${format(startDate!, 'yyyy-MM-dd')}.xlsx`);

    toast({
      title: "Excel exportado",
      description: "O extrato foi exportado com sucesso",
    });
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
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <Button onClick={exportToPDF} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button onClick={exportToExcel} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Saldo Anterior</p>
                  <p className="text-lg font-semibold">{formatCurrency(saldoAnterior)}</p>
                </div>
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
                    <TableCell className={cn(
                      "text-right font-medium",
                      item.saldo < 0 && "text-red-600"
                    )}>
                      {item.saldo < 0 ? `-${formatCurrency(item.saldo)}` : formatCurrency(item.saldo)}
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
                  <TableCell className={cn(
                    "text-right font-bold",
                    extratoItems.length > 0 && extratoItems[extratoItems.length - 1].saldo < 0 && "text-red-600"
                  )}>
                    {extratoItems.length > 0 
                      ? (extratoItems[extratoItems.length - 1].saldo < 0 
                          ? `-${formatCurrency(extratoItems[extratoItems.length - 1].saldo)}` 
                          : formatCurrency(extratoItems[extratoItems.length - 1].saldo))
                      : formatCurrency(saldoAnterior)}
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