import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CalendarIcon, Loader2, FileDown, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
  store_id: string;
  store_name: string;
  initial_balance?: number;
  initial_balance_date?: string;
}

interface BalanceResult {
  accountId: string;
  accountName: string;
  accountType: string;
  storeName: string;
  balance: number;
}

const BalancePositionReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [balanceResults, setBalanceResults] = useState<BalanceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStores.length > 0) {
      fetchAccounts();
    } else {
      setAccounts([]);
      setSelectedAccounts([]);
    }
  }, [selectedStores]);

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
          .select('id, name, code')
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
            .select('id, name, code')
            .in('id', storeIds)
            .order('name');
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const allAccounts: Account[] = [];

      // Fetch all account types in parallel with initial balance data
      const [currentResult, cashResult, cardResult, deliveryResult] = await Promise.all([
        supabase
          .from('current_accounts')
          .select(`
            id, name, initial_balance, initial_balance_date,
            current_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        supabase
          .from('cash_accounts')
          .select(`
            id, name, initial_balance, initial_balance_date,
            cash_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        supabase
          .from('card_accounts')
          .select(`
            id, name, initial_balance, initial_balance_date,
            card_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        supabase
          .from('delivery_accounts')
          .select(`
            id, name, initial_balance, initial_balance_date,
            delivery_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true)
      ]);

      // Process current accounts
      currentResult.data?.forEach(acc => {
        acc.current_account_stores?.forEach((store_rel: any) => {
          if (selectedStores.includes(store_rel.store_id)) {
            allAccounts.push({
              id: acc.id,
              name: acc.name,
              type: 'current',
              store_id: store_rel.store_id,
              store_name: store_rel.stores?.name || '',
              initial_balance: acc.initial_balance || 0,
              initial_balance_date: acc.initial_balance_date
            });
          }
        });
      });

      // Process cash accounts
      cashResult.data?.forEach(acc => {
        acc.cash_account_stores?.forEach((store_rel: any) => {
          if (selectedStores.includes(store_rel.store_id)) {
            allAccounts.push({
              id: acc.id,
              name: acc.name,
              type: 'cash',
              store_id: store_rel.store_id,
              store_name: store_rel.stores?.name || '',
              initial_balance: acc.initial_balance || 0,
              initial_balance_date: acc.initial_balance_date
            });
          }
        });
      });

      // Process card accounts
      cardResult.data?.forEach(acc => {
        acc.card_account_stores?.forEach((store_rel: any) => {
          if (selectedStores.includes(store_rel.store_id)) {
            allAccounts.push({
              id: acc.id,
              name: acc.name,
              type: 'card',
              store_id: store_rel.store_id,
              store_name: store_rel.stores?.name || '',
              initial_balance: acc.initial_balance || 0,
              initial_balance_date: acc.initial_balance_date
            });
          }
        });
      });

      // Process delivery accounts
      deliveryResult.data?.forEach(acc => {
        acc.delivery_account_stores?.forEach((store_rel: any) => {
          if (selectedStores.includes(store_rel.store_id)) {
            allAccounts.push({
              id: acc.id,
              name: acc.name,
              type: 'delivery',
              store_id: store_rel.store_id,
              store_name: store_rel.stores?.name || '',
              initial_balance: acc.initial_balance || 0,
              initial_balance_date: acc.initial_balance_date
            });
          }
        });
      });

      // Remove duplicates (same account in multiple stores)
      const uniqueAccounts = allAccounts.filter((acc, index, self) =>
        index === self.findIndex(a => a.id === acc.id && a.store_id === acc.store_id)
      );

      setAccounts(uniqueAccounts);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generateReport = async () => {
    if (!selectedDate) {
      toast({
        title: "Erro",
        description: "Selecione uma data",
        variant: "destructive",
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma conta",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setShowResults(false);
    setLoadingProgress(0);

    try {
      const selectedAccountsData = accounts.filter(a => selectedAccounts.includes(a.id));
      const formattedTargetDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Get all unique account IDs by type
      const currentAccountIds = [...new Set(selectedAccountsData.filter(a => a.type === 'current').map(a => a.id))];
      const cashAccountIds = [...new Set(selectedAccountsData.filter(a => a.type === 'cash').map(a => a.id))];
      const cardAccountIds = [...new Set(selectedAccountsData.filter(a => a.type === 'card').map(a => a.id))];
      const deliveryAccountIds = [...new Set(selectedAccountsData.filter(a => a.type === 'delivery').map(a => a.id))];
      const allAccountIds = [...new Set(selectedAccountsData.map(a => a.id))];
      const allStoreIds = [...new Set(selectedAccountsData.map(a => a.store_id))];

      setLoadingMessage("Buscando transferências...");
      setLoadingProgress(10);

      // Buscar todas as lojas vinculadas às contas selecionadas (para todas os tipos de conta)
      // O saldo deve considerar movimentações de TODAS as lojas vinculadas à conta
      let allLinkedStoreIds = [...allStoreIds];
      
      const linkedStoresPromises = [];
      
      if (currentAccountIds.length > 0) {
        linkedStoresPromises.push(
          supabase.from('current_account_stores').select('account_id, store_id').in('account_id', currentAccountIds)
        );
      } else {
        linkedStoresPromises.push(Promise.resolve({ data: [] }));
      }
      
      if (cashAccountIds.length > 0) {
        linkedStoresPromises.push(
          supabase.from('cash_account_stores').select('account_id, store_id').in('account_id', cashAccountIds)
        );
      } else {
        linkedStoresPromises.push(Promise.resolve({ data: [] }));
      }
      
      if (cardAccountIds.length > 0) {
        linkedStoresPromises.push(
          supabase.from('card_account_stores').select('account_id, store_id').in('account_id', cardAccountIds)
        );
      } else {
        linkedStoresPromises.push(Promise.resolve({ data: [] }));
      }
      
      if (deliveryAccountIds.length > 0) {
        linkedStoresPromises.push(
          supabase.from('delivery_account_stores').select('account_id, store_id').in('account_id', deliveryAccountIds)
        );
      } else {
        linkedStoresPromises.push(Promise.resolve({ data: [] }));
      }
      
      const [currentStoresResult, cashStoresResult, cardStoresResult, deliveryStoresResult] = await Promise.all(linkedStoresPromises);
      
      // Criar mapas de lojas vinculadas para cada tipo de conta
      const currentAccountStoresMap = new Map<string, string[]>();
      const cashAccountStoresMap = new Map<string, string[]>();
      const cardAccountStoresMap = new Map<string, string[]>();
      const deliveryAccountStoresMap = new Map<string, string[]>();
      
      (currentStoresResult.data || []).forEach((s: any) => {
        const existing = currentAccountStoresMap.get(s.account_id) || [];
        existing.push(s.store_id);
        currentAccountStoresMap.set(s.account_id, existing);
        if (!allLinkedStoreIds.includes(s.store_id)) allLinkedStoreIds.push(s.store_id);
      });
      
      (cashStoresResult.data || []).forEach((s: any) => {
        const existing = cashAccountStoresMap.get(s.account_id) || [];
        existing.push(s.store_id);
        cashAccountStoresMap.set(s.account_id, existing);
        if (!allLinkedStoreIds.includes(s.store_id)) allLinkedStoreIds.push(s.store_id);
      });
      
      (cardStoresResult.data || []).forEach((s: any) => {
        const existing = cardAccountStoresMap.get(s.account_id) || [];
        existing.push(s.store_id);
        cardAccountStoresMap.set(s.account_id, existing);
        if (!allLinkedStoreIds.includes(s.store_id)) allLinkedStoreIds.push(s.store_id);
      });
      
      (deliveryStoresResult.data || []).forEach((s: any) => {
        const existing = deliveryAccountStoresMap.get(s.account_id) || [];
        existing.push(s.store_id);
        deliveryAccountStoresMap.set(s.account_id, existing);
        if (!allLinkedStoreIds.includes(s.store_id)) allLinkedStoreIds.push(s.store_id);
      });

      // Step 1: Fetch all transfers for all accounts in one query
      const transfersPromise = allAccountIds.length > 0 
        ? supabase
            .from('transfers')
            .select('*')
            .lte('transfer_date', formattedTargetDate)
        : Promise.resolve({ data: [] });

      setLoadingMessage("Buscando transações financeiras...");
      setLoadingProgress(20);

      // Step 2: Fetch all financial transactions
      // Inclui todas as lojas vinculadas (especialmente importante para contas delivery)
      const financialTransSaidaPromise = allAccountIds.length > 0
        ? supabase
            .from('financial_transactions')
            .select('amount, account_id, store_id, transaction_date, transaction_type')
            .in('account_id', allAccountIds)
            .in('store_id', allLinkedStoreIds)
            .lte('transaction_date', formattedTargetDate)
        : Promise.resolve({ data: [] });

      setLoadingMessage("Buscando itens de caixa...");
      setLoadingProgress(30);

      // Step 3: Fetch all cash control items in parallel
      const cashControlItemsPromise = cashAccountIds.length > 0
        ? supabase
            .from('cash_control_cash_items')
            .select('valor, cash_control_id, cash_account_id')
            .in('cash_account_id', cashAccountIds)
        : Promise.resolve({ data: [] });

      const deliveryItemsPromise = deliveryAccountIds.length > 0
        ? supabase
            .from('cash_control_delivery_items')
            .select('valor, cash_control_id, delivery_account_id')
            .in('delivery_account_id', deliveryAccountIds)
        : Promise.resolve({ data: [] });

      const cardItemsPromise = cardAccountIds.length > 0
        ? supabase
            .from('cash_control_card_items')
            .select('valor, cash_control_id, card_account_id')
            .in('card_account_id', cardAccountIds)
        : Promise.resolve({ data: [] });

      const accountItemsPromise = currentAccountIds.length > 0
        ? supabase
            .from('cash_control_account_items')
            .select('valor, cash_control_id, current_account_id')
            .in('current_account_id', currentAccountIds)
        : Promise.resolve({ data: [] });

      setLoadingMessage("Buscando transações de sócios...");
      setLoadingProgress(40);

      // Step 4: Fetch partner transactions - usa todas as lojas vinculadas às contas
      const partnerTransPromise = allAccountIds.length > 0
        ? supabase
            .from('partner_transactions')
            .select('amount, transaction_type, account_id, store_id, payment_date')
            .in('account_id', allAccountIds)
            .in('store_id', allLinkedStoreIds)
            .lte('payment_date', formattedTargetDate)
        : Promise.resolve({ data: [] });

      setLoadingMessage("Processando dados...");
      setLoadingProgress(50);

      // Execute all queries in parallel
      const [
        transfersResult,
        financialTransResult,
        cashControlItemsResult,
        deliveryItemsResult,
        cardItemsResult,
        accountItemsResult,
        partnerTransResult
      ] = await Promise.all([
        transfersPromise,
        financialTransSaidaPromise,
        cashControlItemsPromise,
        deliveryItemsPromise,
        cardItemsPromise,
        accountItemsPromise,
        partnerTransPromise
      ]);

      setLoadingProgress(60);

      // Collect all cash_control_ids to fetch dates in one query
      const allCashControlIds = new Set<string>();
      (cashControlItemsResult.data || []).forEach((item: any) => allCashControlIds.add(item.cash_control_id));
      (deliveryItemsResult.data || []).forEach((item: any) => allCashControlIds.add(item.cash_control_id));
      (cardItemsResult.data || []).forEach((item: any) => allCashControlIds.add(item.cash_control_id));
      (accountItemsResult.data || []).forEach((item: any) => allCashControlIds.add(item.cash_control_id));

      setLoadingMessage("Buscando datas de controle de caixa...");
      setLoadingProgress(70);

      // Fetch all cash control dates in one query
      let cashControlMap = new Map<string, { date: string; store_id: string }>();
      if (allCashControlIds.size > 0) {
        const { data: cashControlData } = await supabase
          .from('cash_control')
          .select('id, date, store_id')
          .in('id', Array.from(allCashControlIds))
          .lte('date', formattedTargetDate);
        
        (cashControlData || []).forEach((cc: any) => {
          cashControlMap.set(cc.id, { date: cc.date, store_id: cc.store_id });
        });
      }

      setLoadingMessage("Calculando saldos...");
      setLoadingProgress(80);

      // Os mapas de lojas vinculadas já foram criados acima

      // Create lookup maps for fast access
      const transfersData = transfersResult.data || [];
      const financialTransData = financialTransResult.data || [];
      const cashControlItemsData = cashControlItemsResult.data || [];
      const deliveryItemsData = deliveryItemsResult.data || [];
      const cardItemsData = cardItemsResult.data || [];
      const accountItemsData = accountItemsResult.data || [];
      const partnerTransData = partnerTransResult.data || [];

      // Calculate balance for each selected account
      const results: BalanceResult[] = [];

      for (const account of selectedAccountsData) {
        let balance = account.initial_balance || 0;
        const initialBalanceDate = account.initial_balance_date;

        if (!initialBalanceDate) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            accountType: getAccountTypeLabel(account.type),
            storeName: account.store_name,
            balance
          });
          continue;
        }

        const inicialDate = new Date(initialBalanceDate + 'T12:00:00');
        
        if (selectedDate < inicialDate) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            accountType: getAccountTypeLabel(account.type),
            storeName: account.store_name,
            balance
          });
          continue;
        }

        // 1. Process transfers
        transfersData.forEach(transfer => {
          if (transfer.transfer_date >= initialBalanceDate && transfer.transfer_date <= formattedTargetDate) {
            if (transfer.source_account_id === account.id) {
              balance -= transfer.amount;
            } else if (transfer.destination_account_id === account.id) {
              balance += transfer.amount;
            }
          }
        });

        // 2. Process financial transactions - usa todas as lojas vinculadas à conta
        let accountLinkedStores: string[] = [account.store_id];
        if (account.type === 'current') {
          accountLinkedStores = currentAccountStoresMap.get(account.id) || [account.store_id];
        } else if (account.type === 'cash') {
          accountLinkedStores = cashAccountStoresMap.get(account.id) || [account.store_id];
        } else if (account.type === 'card') {
          accountLinkedStores = cardAccountStoresMap.get(account.id) || [account.store_id];
        } else if (account.type === 'delivery') {
          accountLinkedStores = deliveryAccountStoresMap.get(account.id) || [account.store_id];
        }
        
        financialTransData.forEach(t => {
          if (t.account_id === account.id && 
              accountLinkedStores.includes(t.store_id) &&
              t.transaction_date >= initialBalanceDate && 
              t.transaction_date <= formattedTargetDate) {
            if (t.transaction_type === 'saida') {
              balance -= t.amount;
            } else if (t.transaction_type === 'entrada') {
              balance += t.amount;
            }
          }
        });

        // 3. Process cash control items - aceita de todas as lojas vinculadas à conta
        if (account.type === 'cash') {
          cashControlItemsData.forEach((item: any) => {
            if (item.cash_account_id === account.id) {
              const cc = cashControlMap.get(item.cash_control_id);
              if (cc && accountLinkedStores.includes(cc.store_id) && 
                  cc.date >= initialBalanceDate && cc.date <= formattedTargetDate) {
                balance += item.valor;
              }
            }
          });
        }

        if (account.type === 'delivery') {
          deliveryItemsData.forEach((item: any) => {
            if (item.delivery_account_id === account.id) {
              const cc = cashControlMap.get(item.cash_control_id);
              if (cc && accountLinkedStores.includes(cc.store_id) && 
                  cc.date >= initialBalanceDate && cc.date <= formattedTargetDate) {
                balance += item.valor;
              }
            }
          });
        }

        if (account.type === 'card') {
          cardItemsData.forEach((item: any) => {
            if (item.card_account_id === account.id) {
              const cc = cashControlMap.get(item.cash_control_id);
              if (cc && accountLinkedStores.includes(cc.store_id) && 
                  cc.date >= initialBalanceDate && cc.date <= formattedTargetDate) {
                balance += item.valor;
              }
            }
          });
        }

        if (account.type === 'current') {
          accountItemsData.forEach((item: any) => {
            if (item.current_account_id === account.id) {
              const cc = cashControlMap.get(item.cash_control_id);
              if (cc && accountLinkedStores.includes(cc.store_id) && 
                  cc.date >= initialBalanceDate && cc.date <= formattedTargetDate) {
                balance += item.valor;
              }
            }
          });
        }

        // 4. Process partner transactions - aceita de todas as lojas vinculadas à conta
        partnerTransData.forEach(transaction => {
          if (transaction.account_id === account.id && 
              accountLinkedStores.includes(transaction.store_id) &&
              transaction.payment_date >= initialBalanceDate && 
              transaction.payment_date <= formattedTargetDate) {
            if (transaction.transaction_type === 'aporte') {
              balance += transaction.amount;
            } else if (transaction.transaction_type === 'retirada') {
              balance -= transaction.amount;
            }
          }
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          accountType: getAccountTypeLabel(account.type),
          storeName: account.store_name,
          balance
        });
      }

      setLoadingProgress(100);
      setLoadingMessage("Concluído!");

      // Sort by store name, then account name
      results.sort((a, b) => {
        const storeCompare = a.storeName.localeCompare(b.storeName);
        if (storeCompare !== 0) return storeCompare;
        return a.accountName.localeCompare(b.accountName);
      });

      setBalanceResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Posição de Saldos", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data: ${selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : ''}`, 14, 28);

    const tableData = balanceResults.map(item => [
      item.storeName,
      item.accountName,
      item.accountType,
      formatCurrency(item.balance)
    ]);

    const totalBalance = balanceResults.reduce((sum, item) => sum + item.balance, 0);
    tableData.push(['', '', 'TOTAL', formatCurrency(totalBalance)]);

    autoTable(doc, {
      head: [['Loja', 'Conta', 'Tipo', 'Saldo']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`posicao-saldos-${format(selectedDate!, 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = () => {
    const data = balanceResults.map(item => ({
      'Loja': item.storeName,
      'Conta': item.accountName,
      'Tipo': item.accountType,
      'Saldo': item.balance
    }));

    const totalBalance = balanceResults.reduce((sum, item) => sum + item.balance, 0);
    data.push({
      'Loja': '',
      'Conta': '',
      'Tipo': 'TOTAL',
      'Saldo': totalBalance
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Posição de Saldos");
    XLSX.writeFile(wb, `posicao-saldos-${format(selectedDate!, 'yyyy-MM-dd')}.xlsx`);
  };

  const handleStoreToggle = (storeId: string) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      }
      return [...prev, storeId];
    });
    setSelectedAccounts([]);
    setShowResults(false);
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      }
      return [...prev, accountId];
    });
    setShowResults(false);
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(a => a.id));
    }
    setShowResults(false);
  };

  const totalBalance = balanceResults.reduce((sum, item) => sum + item.balance, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Posição de Saldos</h1>
            <p className="text-sm text-muted-foreground">Visualize o saldo das contas em uma data específica</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setShowResults(false);
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Stores Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Lojas</label>
              <div className="flex flex-wrap gap-2">
                {stores.map(store => (
                  <div
                    key={store.id}
                    className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted"
                    onClick={() => handleStoreToggle(store.id)}
                  >
                    <Checkbox
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={() => handleStoreToggle(store.id)}
                    />
                    <span className="text-sm">{store.code} - {store.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accounts Filter */}
            {selectedStores.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Contas</label>
                  <Button variant="ghost" size="sm" onClick={handleSelectAllAccounts}>
                    {selectedAccounts.length === accounts.length ? "Desmarcar todas" : "Selecionar todas"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {accounts.map(account => (
                    <div
                      key={`${account.id}-${account.store_id}`}
                      className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted"
                      onClick={() => handleAccountToggle(account.id)}
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => handleAccountToggle(account.id)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {getAccountTypeLabel(account.type)} - {account.store_name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{loadingMessage}</span>
                  <span className="font-medium">{loadingProgress}%</span>
                </div>
                <Progress value={loadingProgress} className="h-2" />
              </div>
            )}

            <Button onClick={generateReport} disabled={loading || !selectedDate || selectedAccounts.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Relatório"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {showResults && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Posição em {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : ''}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="table-sticky-first">
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balanceResults.map((item, index) => (
                    <TableRow key={`${item.accountId}-${index}`}>
                      <TableCell>{item.storeName}</TableCell>
                      <TableCell className="font-medium">{item.accountName}</TableCell>
                      <TableCell>{item.accountType}</TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        item.balance >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(item.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">TOTAL</TableCell>
                    <TableCell className={cn(
                      "text-right",
                      totalBalance >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(totalBalance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default BalancePositionReport;
