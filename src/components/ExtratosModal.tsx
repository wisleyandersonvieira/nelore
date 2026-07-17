import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Download, FileDown, Loader2 } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { fetchAllPaginated } from "@/utils/supabasePagination";

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
  initial_balance?: number;
  initial_balance_date?: string;
}

interface ExtratoItem {
  date: Date;
  description: string;
  number?: string;
  installment?: string;
  entrada: number;
  saida: number;
  saldo: number;
  type: 'payable' | 'receivable' | 'cash_control' | 'transfer' | 'partner_transaction';
}

interface ExtratosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Cache para nomes de contas (evita queries repetidas)
const accountNamesCache: Record<string, string> = {};

export function ExtratosModal({ open, onOpenChange }: ExtratosModalProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [extratoItems, setExtratoItems] = useState<ExtratoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchStores();
      fetchAccountsWithDetails();
    }
  }, [open]);

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
        const { data } = await supabase
          .from('stores')
          .select('id, name')
          .order('name');
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
          const { data } = await supabase
            .from('stores')
            .select('id, name')
            .in('id', storeIds)
            .order('name');
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  // Buscar contas com saldo inicial já incluído (otimização)
  const fetchAccountsWithDetails = async () => {
    try {
      const [currentResult, cashResult, cardResult, deliveryResult] = await Promise.all([
        supabase
          .from('current_accounts')
          .select(`id, name, initial_balance, initial_balance_date, current_account_stores!inner(store_id, stores!inner(name))`)
          .eq('is_active', true),
        supabase
          .from('cash_accounts')
          .select(`id, name, initial_balance, initial_balance_date, cash_account_stores!inner(store_id, stores!inner(name))`)
          .eq('is_active', true),
        supabase
          .from('card_accounts')
          .select(`id, name, initial_balance, initial_balance_date, card_account_stores!inner(store_id, stores!inner(name))`)
          .eq('is_active', true),
        supabase
          .from('delivery_accounts')
          .select(`id, name, initial_balance, initial_balance_date, delivery_account_stores!inner(store_id, stores!inner(name))`)
          .eq('is_active', true)
      ]);

      const allAccounts: Account[] = [];

      // Processar e cachear nomes
      (currentResult.data || []).forEach(acc => {
        accountNamesCache[acc.id] = acc.name;
        acc.current_account_stores?.forEach((store_rel: any) => {
          allAccounts.push({
            id: acc.id, 
            name: acc.name, 
            type: 'current',
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id,
            initial_balance: acc.initial_balance,
            initial_balance_date: acc.initial_balance_date
          });
        });
      });

      (cashResult.data || []).forEach(acc => {
        accountNamesCache[acc.id] = acc.name;
        acc.cash_account_stores?.forEach((store_rel: any) => {
          allAccounts.push({
            id: acc.id, 
            name: acc.name, 
            type: 'cash',
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id,
            initial_balance: acc.initial_balance,
            initial_balance_date: acc.initial_balance_date
          });
        });
      });

      (cardResult.data || []).forEach(acc => {
        accountNamesCache[acc.id] = acc.name;
        acc.card_account_stores?.forEach((store_rel: any) => {
          allAccounts.push({
            id: acc.id, 
            name: acc.name, 
            type: 'card',
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id,
            initial_balance: acc.initial_balance,
            initial_balance_date: acc.initial_balance_date
          });
        });
      });

      (deliveryResult.data || []).forEach(acc => {
        accountNamesCache[acc.id] = acc.name;
        acc.delivery_account_stores?.forEach((store_rel: any) => {
          allAccounts.push({
            id: acc.id, 
            name: acc.name, 
            type: 'delivery',
            store_name: store_rel.stores?.name || '',
            store_id: store_rel.store_id,
            initial_balance: acc.initial_balance,
            initial_balance_date: acc.initial_balance_date
          });
        });
      });

      setAccounts(allAccounts);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      current: 'Conta Corrente',
      cash: 'Conta Caixa',
      card: 'Conta Cartão',
      delivery: 'Delivery'
    };
    return labels[type] || type;
  };

  const filteredAccounts = useMemo(() => 
    selectedStore ? accounts.filter(acc => acc.store_id === selectedStore) : accounts
  , [selectedStore, accounts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  const getAccountName = (accountId: string): string => {
    return accountNamesCache[accountId] || 'Conta não identificada';
  };

  const generateExtrato = useCallback(async () => {
    if (!selectedStore || !selectedAccount || !startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    
    try {
      const account = accounts.find(acc => acc.id === selectedAccount);
      if (!account) return;

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      const dayBefore = subDays(startDate, 1);
      const dayBeforeStr = format(dayBefore, 'yyyy-MM-dd');
      const initialBalance = account.initial_balance || 0;
      const initialBalanceDate = account.initial_balance_date;

      setLoadingProgress(10);

      // ========== ETAPA 1: Buscar todos os dados em paralelo ==========
      
      // Buscar todas as lojas vinculadas à conta selecionada
      // O extrato deve mostrar TODAS as movimentações da conta, independente da loja
      let linkedStoreIds: string[] = [];
      
      if (account.type === 'delivery') {
        const { data: deliveryStores } = await supabase
          .from('delivery_account_stores')
          .select('store_id')
          .eq('account_id', selectedAccount);
        if (deliveryStores && deliveryStores.length > 0) {
          linkedStoreIds = deliveryStores.map(s => s.store_id);
        }
      } else if (account.type === 'current') {
        const { data: currentStores } = await supabase
          .from('current_account_stores')
          .select('store_id')
          .eq('account_id', selectedAccount);
        if (currentStores && currentStores.length > 0) {
          linkedStoreIds = currentStores.map(s => s.store_id);
        }
      } else if (account.type === 'cash') {
        const { data: cashStores } = await supabase
          .from('cash_account_stores')
          .select('store_id')
          .eq('account_id', selectedAccount);
        if (cashStores && cashStores.length > 0) {
          linkedStoreIds = cashStores.map(s => s.store_id);
        }
      } else if (account.type === 'card') {
        const { data: cardStores } = await supabase
          .from('card_account_stores')
          .select('store_id')
          .eq('account_id', selectedAccount);
        if (cardStores && cardStores.length > 0) {
          linkedStoreIds = cardStores.map(s => s.store_id);
        }
      }
      
      // Fallback: se não encontrou lojas vinculadas, usa a loja selecionada
      if (linkedStoreIds.length === 0) {
        linkedStoreIds = [selectedStore];
      }

      const movementStartDateStr = initialBalanceDate || undefined;
      
      // Transferências - busca todas as transferências da conta (sem filtro de loja)
      const transfersPromise = fetchAllPaginated(() => {
        let query = supabase
          .from('transfers')
          .select('*')
          .or(`source_account_id.eq.${selectedAccount},destination_account_id.eq.${selectedAccount}`)
          .lte('transfer_date', endDateStr)
          .order('transfer_date', { ascending: true })
          .order('id', { ascending: true });

        if (movementStartDateStr) {
          query = query.gte('transfer_date', movementStartDateStr);
        }

        return query;
      });

      // Financial transactions - busca todas as transações da conta em TODAS as lojas vinculadas
      const financialTransPromise = fetchAllPaginated(() => {
        let query = supabase
          .from('financial_transactions')
          .select('id, amount, transaction_date, description, reference_id, reference_type, transaction_type')
          .in('store_id', linkedStoreIds)
          .eq('account_id', selectedAccount)
          .lte('transaction_date', endDateStr)
          .order('transaction_date', { ascending: true })
          .order('id', { ascending: true });

        if (movementStartDateStr) {
          query = query.gte('transaction_date', movementStartDateStr);
        }

        return query;
      });

      // Cash control items baseado no tipo de conta - busca com o cash_control para obter a data diretamente
      let cashControlItemPromise: Promise<any[]>;
      if (account.type === 'cash') {
        cashControlItemPromise = fetchAllPaginated(() =>
          supabase
            .from('cash_control_cash_items')
            .select('id, valor, cash_control_id, cash_control:cash_control_id(id, date, store_id)')
            .eq('cash_account_id', selectedAccount)
            .order('id', { ascending: true })
        );
      } else if (account.type === 'card') {
        cashControlItemPromise = fetchAllPaginated(() =>
          supabase
            .from('cash_control_card_items')
            .select('id, valor, cash_control_id, cash_control:cash_control_id(id, date, store_id)')
            .eq('card_account_id', selectedAccount)
            .order('id', { ascending: true })
        );
      } else if (account.type === 'delivery') {
        cashControlItemPromise = fetchAllPaginated(() =>
          supabase
            .from('cash_control_delivery_items')
            .select('id, valor, cash_control_id, cash_control:cash_control_id(id, date, store_id)')
            .eq('delivery_account_id', selectedAccount)
            .order('id', { ascending: true })
        );
      } else if (account.type === 'current') {
        cashControlItemPromise = fetchAllPaginated(() =>
          supabase
            .from('cash_control_account_items')
            .select('id, valor, cash_control_id, cash_control:cash_control_id(id, date, store_id)')
            .eq('current_account_id', selectedAccount)
            .order('id', { ascending: true })
        );
      } else {
        cashControlItemPromise = Promise.resolve([]);
      }

      // Partner transactions - busca de TODAS as lojas vinculadas à conta
      const partnerTransPromise = fetchAllPaginated(() => {
        let query = supabase
          .from('partner_transactions')
          .select('id, amount, payment_date, transaction_type, notes, partners:partner_id(name)')
          .in('store_id', linkedStoreIds)
          .eq('account_id', selectedAccount)
          .lte('payment_date', endDateStr)
          .order('payment_date', { ascending: true })
          .order('id', { ascending: true });

        if (movementStartDateStr) {
          query = query.gte('payment_date', movementStartDateStr);
        }

        return query;
      });

      // Dados de referência para validação - busca de TODAS as lojas vinculadas
      const payableInstallmentsPromise = fetchAllPaginated(() =>
        supabase
          .from('accounts_payable_installments')
          .select('id, installment_number, payment_date, account_payable_id')
          .order('id', { ascending: true })
      );

      const payablesPromise = fetchAllPaginated(() =>
        supabase
          .from('accounts_payable')
          .select('id, document_number, description, payment_date, status, employee_id, supplier_id, store_id')
          .in('store_id', linkedStoreIds)
          .order('id', { ascending: true })
      );

      const receivableInstallmentsPromise = fetchAllPaginated(() =>
        supabase
          .from('accounts_receivable_installments')
          .select('id, installment_number, payment_date, account_receivable_id')
          .order('id', { ascending: true })
      );

      const receivablesPromise = fetchAllPaginated(() =>
        supabase
          .from('accounts_receivable')
          .select('id, document_number, description, payment_date, status, creditor_id, store_id')
          .in('store_id', linkedStoreIds)
          .order('id', { ascending: true })
      );

      // Fornecedores, credores e funcionários
      const suppliersPromise = fetchAllPaginated(() =>
        supabase.from('suppliers').select('id, name').order('id', { ascending: true })
      );
      const creditorsPromise = fetchAllPaginated(() =>
        supabase.from('creditors').select('id, name').order('id', { ascending: true })
      );
      const employeesPromise = fetchAllPaginated(() =>
        supabase.from('employees').select('id, name').order('id', { ascending: true })
      );

      setLoadingProgress(20);

      const [
        transfersData,
        financialTransactionsData,
        cashControlItemsData,
        partnerTransactionsData,
        payableInstallmentsData,
        payablesData,
        receivableInstallmentsData,
        receivablesData,
        suppliersData,
        creditorsData,
        employeesData
      ] = await Promise.all([
        transfersPromise,
        financialTransPromise,
        cashControlItemPromise,
        partnerTransPromise,
        payableInstallmentsPromise,
        payablesPromise,
        receivableInstallmentsPromise,
        receivablesPromise,
        suppliersPromise,
        creditorsPromise,
        employeesPromise
      ]);

      setLoadingProgress(50);


      // ========== ETAPA 2: Criar mapas de lookup para processamento rápido ==========
      // Nota: cashControlMap não é mais necessário pois a data vem no join do cashControlItemsData

      const payableInstallmentsMap = new Map<string, any>();
      payableInstallmentsData.forEach((inst: any) => {
        payableInstallmentsMap.set(inst.id, inst);
      });

      const payablesMap = new Map<string, any>();
      payablesData.forEach((p: any) => {
        payablesMap.set(p.id, p);
      });

      const receivableInstallmentsMap = new Map<string, any>();
      receivableInstallmentsData.forEach((inst: any) => {
        receivableInstallmentsMap.set(inst.id, inst);
      });

      const receivablesMap = new Map<string, any>();
      receivablesData.forEach((r: any) => {
        receivablesMap.set(r.id, r);
      });

      const suppliersMap = new Map<string, string>();
      suppliersData.forEach((s: any) => {
        suppliersMap.set(s.id, s.name);
      });

      const creditorsMap = new Map<string, string>();
      creditorsData.forEach((c: any) => {
        creditorsMap.set(c.id, c.name);
      });

      const employeesMap = new Map<string, string>();
      employeesData.forEach((e: any) => {
        employeesMap.set(e.id, e.name);
      });

      // Calcular total de parcelas por conta a pagar
      const payableInstallmentCounts = new Map<string, number>();
      payableInstallmentsData.forEach((inst: any) => {
        const current = payableInstallmentCounts.get(inst.account_payable_id) || 0;
        payableInstallmentCounts.set(inst.account_payable_id, Math.max(current, inst.installment_number));
      });

      const receivableInstallmentCounts = new Map<string, number>();
      receivableInstallmentsData.forEach((inst: any) => {
        const current = receivableInstallmentCounts.get(inst.account_receivable_id) || 0;
        receivableInstallmentCounts.set(inst.account_receivable_id, Math.max(current, inst.installment_number));
      });

      setLoadingProgress(60);

      // ========== ETAPA 3: Calcular saldo anterior (antes do período) ==========
      let saldoDiaAnterior = initialBalance;
      
      if (initialBalanceDate && dayBefore > new Date(initialBalanceDate)) {
        const inicialDateStr = initialBalanceDate;
        
        // Processar transferências anteriores
        transfersData.forEach((transfer: any) => {
          if (transfer.transfer_date >= inicialDateStr && transfer.transfer_date <= dayBeforeStr) {
            if (transfer.source_account_id === selectedAccount) {
              saldoDiaAnterior -= transfer.amount;
            } else if (transfer.destination_account_id === selectedAccount) {
              saldoDiaAnterior += transfer.amount;
            }
          }
        });

        // Processar financial transactions anteriores
        financialTransactionsData.forEach((trans: any) => {
          if (trans.transaction_date >= inicialDateStr && trans.transaction_date <= dayBeforeStr) {
            // Validar se a transação ainda é válida
            if (trans.reference_type === 'accounts_payable_installments') {
              const inst = payableInstallmentsMap.get(trans.reference_id);
              if (inst?.payment_date === trans.transaction_date) {
                saldoDiaAnterior -= trans.amount;
              }
            } else if (trans.reference_type === 'accounts_payable') {
              const payable = payablesMap.get(trans.reference_id);
              if (payable?.payment_date === trans.transaction_date && payable?.status !== 'pending') {
                saldoDiaAnterior -= trans.amount;
              }
            } else if (trans.reference_type === 'accounts_receivable_installments') {
              const inst = receivableInstallmentsMap.get(trans.reference_id);
              if (inst?.payment_date === trans.transaction_date) {
                saldoDiaAnterior += trans.amount;
              }
            } else if (trans.reference_type === 'accounts_receivable') {
              const receivable = receivablesMap.get(trans.reference_id);
              if (receivable?.payment_date === trans.transaction_date && receivable?.status !== 'pending') {
                saldoDiaAnterior += trans.amount;
              }
            }
          }
        });

        // Processar cash control items anteriores (data vem do join)
        cashControlItemsData.forEach((item: any) => {
          const ccDate = (item.cash_control as any)?.date;
          if (ccDate && ccDate >= inicialDateStr && ccDate <= dayBeforeStr) {
            saldoDiaAnterior += item.valor;
          }
        });

        // Processar partner transactions anteriores
        partnerTransactionsData.forEach((trans: any) => {
          if (trans.payment_date >= inicialDateStr && trans.payment_date <= dayBeforeStr) {
            if (trans.transaction_type === 'aporte') {
              saldoDiaAnterior += Number(trans.amount);
            } else {
              saldoDiaAnterior -= Number(trans.amount);
            }
          }
        });
      }

      setSaldoAnterior(saldoDiaAnterior);
      setLoadingProgress(70);

      // ========== ETAPA 4: Gerar itens do extrato (período selecionado) ==========
      const items: ExtratoItem[] = [];

      // Transferências do período
      transfersData.forEach((transfer: any) => {
        if (transfer.transfer_date >= startDateStr && transfer.transfer_date <= endDateStr) {
          const isSource = transfer.source_account_id === selectedAccount;
          const otherAccountId = isSource ? transfer.destination_account_id : transfer.source_account_id;
          const otherAccountName = getAccountName(otherAccountId);

          items.push({
            date: parseISO(transfer.transfer_date + 'T12:00:00'),
            description: `TRANSF. ${isSource ? 'PARA' : 'DE'} ${otherAccountName}`,
            number: '',
            installment: '',
            entrada: isSource ? 0 : transfer.amount,
            saida: isSource ? transfer.amount : 0,
            saldo: 0,
            type: 'transfer'
          });
        }
      });

      setLoadingProgress(80);

      // Financial transactions do período
      financialTransactionsData.forEach((trans: any) => {
        if (trans.transaction_date >= startDateStr && trans.transaction_date <= endDateStr) {
          let isValid = false;
          let documentNumber = '';
          let installmentInfo = '';
          let description = trans.description || '';

          if (trans.reference_type === 'accounts_payable_installments') {
            const inst = payableInstallmentsMap.get(trans.reference_id);
            if (inst?.payment_date === trans.transaction_date) {
              isValid = true;
              const payable = payablesMap.get(inst.account_payable_id);
              if (payable) {
                documentNumber = payable.document_number || '';
                if (payable.employee_id) {
                  description = employeesMap.get(payable.employee_id) || 'Funcionário';
                } else if (payable.supplier_id) {
                  description = suppliersMap.get(payable.supplier_id) || 'Fornecedor';
                }
                const maxInst = payableInstallmentCounts.get(inst.account_payable_id) || 1;
                installmentInfo = `${inst.installment_number}/${maxInst}`;
              }
            }
          } else if (trans.reference_type === 'accounts_payable') {
            const payable = payablesMap.get(trans.reference_id);
            if (payable?.payment_date === trans.transaction_date && payable?.status !== 'pending') {
              isValid = true;
              documentNumber = payable.document_number || '';
              if (payable.employee_id) {
                description = employeesMap.get(payable.employee_id) || 'Funcionário';
              } else if (payable.supplier_id) {
                description = suppliersMap.get(payable.supplier_id) || 'Fornecedor';
              }
              installmentInfo = 'Integral';
            }
          } else if (trans.reference_type === 'accounts_receivable_installments') {
            const inst = receivableInstallmentsMap.get(trans.reference_id);
            if (inst?.payment_date === trans.transaction_date) {
              isValid = true;
              const receivable = receivablesMap.get(inst.account_receivable_id);
              if (receivable) {
                documentNumber = receivable.document_number || '';
                if (receivable.creditor_id) {
                  // creditor_id passou a referenciar suppliers(id) (migration 20260221121040);
                  // resolve pelo suppliersMap e mantém creditorsMap como fallback p/ registros antigos
                  description = suppliersMap.get(receivable.creditor_id)
                    || creditorsMap.get(receivable.creditor_id)
                    || 'Cliente';
                }
                const maxInst = receivableInstallmentCounts.get(inst.account_receivable_id) || 1;
                installmentInfo = `${inst.installment_number}/${maxInst}`;
              }
            }
          } else if (trans.reference_type === 'accounts_receivable') {
            const receivable = receivablesMap.get(trans.reference_id);
            if (receivable?.payment_date === trans.transaction_date && receivable?.status !== 'pending') {
              isValid = true;
              documentNumber = receivable.document_number || '';
              if (receivable.creditor_id) {
                // creditor_id passou a referenciar suppliers(id) (migration 20260221121040);
                // resolve pelo suppliersMap e mantém creditorsMap como fallback p/ registros antigos
                description = suppliersMap.get(receivable.creditor_id)
                  || creditorsMap.get(receivable.creditor_id)
                  || 'Cliente';
              }
              installmentInfo = 'Integral';
            }
          }

          if (isValid) {
            const isEntrada = trans.transaction_type === 'entrada';
            items.push({
              date: parseISO(trans.transaction_date + 'T12:00:00'),
              description,
              number: documentNumber,
              installment: installmentInfo,
              entrada: isEntrada ? trans.amount : 0,
              saida: isEntrada ? 0 : trans.amount,
              saldo: 0,
              type: isEntrada ? 'receivable' : 'payable'
            });
          }
        }
      });

      setLoadingProgress(85);

      // Cash control items do período
      const cashControlLabels: Record<string, string> = {
        cash: 'Faturamento: Dinheiro - Fechamento de Caixa',
        card: 'Faturamento: Cartão - Fechamento de Caixa',
        delivery: 'Faturamento: Delivery - Fechamento de Caixa',
        current: 'Faturamento: Conta - Fechamento de Caixa'
      };

      cashControlItemsData.forEach((item: any) => {
        const ccDate = (item.cash_control as any)?.date;
        if (ccDate && ccDate >= startDateStr && ccDate <= endDateStr) {
          items.push({
            date: parseISO(ccDate + 'T12:00:00'),
            description: cashControlLabels[account.type] || 'Fechamento de Caixa',
            number: '',
            installment: '',
            entrada: item.valor,
            saida: 0,
            saldo: 0,
            type: 'cash_control'
          });
        }
      });

      // Partner transactions do período
      partnerTransactionsData.forEach((trans: any) => {
        if (trans.payment_date >= startDateStr && trans.payment_date <= endDateStr) {
          const partnerName = (trans.partners as any)?.name || 'Sócio não informado';
          const isAporte = trans.transaction_type === 'aporte';
          
          items.push({
            date: parseISO(trans.payment_date + 'T12:00:00'),
            description: `${isAporte ? 'APORTE' : 'RETIRADA'}: ${partnerName}`,
            number: '',
            installment: '',
            entrada: isAporte ? Number(trans.amount) : 0,
            saida: isAporte ? 0 : Number(trans.amount),
            saldo: 0,
            type: 'partner_transaction'
          });
        }
      });

      setLoadingProgress(90);

      // ========== ETAPA 5: Ordenar e calcular saldos ==========
      items.sort((a, b) => a.date.getTime() - b.date.getTime());

      let saldoAtual = saldoDiaAnterior;
      const itemsWithSaldo = items.map(item => {
        saldoAtual += item.entrada - item.saida;
        return { ...item, saldo: saldoAtual };
      });

      setExtratoItems(itemsWithSaldo);
      setLoadingProgress(100);

    } catch (error) {
      console.error('Erro ao gerar extrato:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar extrato",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  }, [selectedStore, selectedAccount, startDate, endDate, accounts, toast]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const accountName = accounts.find(acc => acc.id === selectedAccount)?.name || '';
    const periodText = startDate && endDate 
      ? `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}` 
      : '';

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE CONTA", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(accountName, 105, 28, { align: "center" });
    doc.text(`Período: ${periodText}`, 105, 35, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Saldo Anterior: ${formatCurrency(saldoAnterior)}`, 20, 45);

    const tableData = extratoItems.map(item => [
      format(item.date, 'dd/MM/yyyy'),
      item.description,
      item.number || '',
      item.installment || '',
      item.entrada > 0 ? formatCurrency(item.entrada) : '-',
      item.saida > 0 ? formatCurrency(item.saida) : '-',
      item.saldo < 0 ? `-${formatCurrency(item.saldo)}` : formatCurrency(item.saldo)
    ]);

    const totalEntrada = extratoItems.reduce((total, item) => total + item.entrada, 0);
    const totalSaida = extratoItems.reduce((total, item) => total + item.saida, 0);
    const saldoFinal = extratoItems.length > 0 ? extratoItems[extratoItems.length - 1].saldo : saldoAnterior;
    
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
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' }
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save(`extrato-${accountName.replace(/\s+/g, '-').toLowerCase()}-${format(startDate!, 'yyyy-MM-dd')}.pdf`);
    toast({ title: "PDF exportado", description: "O extrato foi exportado com sucesso" });
  };

  const exportToExcel = () => {
    const accountName = accounts.find(acc => acc.id === selectedAccount)?.name || '';
    const periodText = startDate && endDate 
      ? `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}` 
      : '';

    const excelData = extratoItems.map(item => ({
      Data: format(item.date, 'dd/MM/yyyy'),
      Descrição: item.description,
      Número: item.number || '',
      Parcela: item.installment || '',
      Entrada: item.entrada > 0 ? item.entrada : 0,
      Saída: item.saida > 0 ? item.saida : 0,
      Saldo: item.saldo
    }));

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

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    XLSX.utils.sheet_add_aoa(ws, [
      [`Extrato de Conta: ${accountName}`],
      [`Período: ${periodText}`],
      [`Saldo Anterior: ${formatCurrency(saldoAnterior)}`],
      []
    ], { origin: 'A1' });

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

    toast({ title: "Excel exportado", description: "O extrato foi exportado com sucesso" });
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
                  <SelectItem key={`${account.id}-${account.store_id}`} value={account.id}>
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

        <div className="flex flex-col items-center gap-2">
          <Button 
            onClick={generateExtrato} 
            disabled={loading || !selectedStore || !selectedAccount || !startDate || !endDate}
            className="px-8"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : "Gerar Extrato"}
          </Button>
          {loading && loadingProgress > 0 && (
            <div className="w-64">
              <Progress value={loadingProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-1">
                Processando dados... {loadingProgress}%
              </p>
            </div>
          )}
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
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4} className="text-center">TOTAIS</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(extratoItems.reduce((t, i) => t + i.entrada, 0))}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(extratoItems.reduce((t, i) => t + i.saida, 0))}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right",
                    (extratoItems.length > 0 ? extratoItems[extratoItems.length - 1].saldo : saldoAnterior) < 0 && "text-red-600"
                  )}>
                    {(() => {
                      const final = extratoItems.length > 0 ? extratoItems[extratoItems.length - 1].saldo : saldoAnterior;
                      return final < 0 ? `-${formatCurrency(final)}` : formatCurrency(final);
                    })()}
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
