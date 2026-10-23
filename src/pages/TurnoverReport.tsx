import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const TurnoverReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stores, setStores] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  // Buscar lojas
  useEffect(() => {
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
            .select('id, name, code')
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
          
          userStores?.forEach((us: any) => {
            if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
          });

          if (storeIds.length > 0) {
            const { data, error } = await supabase
              .from('stores')
              .select('id, name, code')
              .in('id', storeIds)
              .order('name');

            if (error) throw error;
            setStores(data || []);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar lojas:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar lojas",
          variant: "destructive",
        });
      }
    };

    fetchStores();
  }, [toast]);

  // Buscar contas quando loja é selecionada
  useEffect(() => {
    if (!selectedStore) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      try {
        // Buscar IDs das contas associadas à loja
        const cashStores = await supabase
          .from('cash_account_stores')
          .select('account_id')
          .eq('store_id', selectedStore);

        const cardStores = await supabase
          .from('card_account_stores')
          .select('account_id')
          .eq('store_id', selectedStore);

        const currentStores = await supabase
          .from('current_account_stores')
          .select('account_id')
          .eq('store_id', selectedStore);

        const deliveryStores = await supabase
          .from('delivery_account_stores')
          .select('account_id')
          .eq('store_id', selectedStore);

        // Extrair os IDs
        const cashIds = cashStores.data?.map(item => item.account_id) || [];
        const cardIds = cardStores.data?.map(item => item.account_id) || [];
        const currentIds = currentStores.data?.map(item => item.account_id) || [];
        const deliveryIds = deliveryStores.data?.map(item => item.account_id) || [];

        // Buscar as contas usando os IDs
        const allAccounts = [];

        if (cashIds.length > 0) {
          const { data } = await supabase
            .from('cash_accounts')
            .select('id, name')
            .eq('is_active', true)
            .in('id', cashIds);

          if (data) {
            data.forEach(acc => allAccounts.push({ ...acc, type: 'cash' }));
          }
        }

        if (cardIds.length > 0) {
          const { data } = await supabase
            .from('card_accounts')
            .select('id, name')
            .eq('is_active', true)
            .in('id', cardIds);

          if (data) {
            data.forEach(acc => allAccounts.push({ ...acc, type: 'card' }));
          }
        }

        if (currentIds.length > 0) {
          const { data } = await supabase
            .from('current_accounts')
            .select('id, name')
            .eq('is_active', true)
            .in('id', currentIds);

          if (data) {
            data.forEach(acc => allAccounts.push({ ...acc, type: 'current' }));
          }
        }

        if (deliveryIds.length > 0) {
          const { data } = await supabase
            .from('delivery_accounts')
            .select('id, name')
            .eq('is_active', true)
            .in('id', deliveryIds);

          if (data) {
            data.forEach(acc => allAccounts.push({ ...acc, type: 'delivery' }));
          }
        }

        setAccounts(allAccounts);
      } catch (error) {
        console.error('Erro ao buscar contas:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar contas",
          variant: "destructive",
        });
      }
    };

    fetchAccounts();
  }, [selectedStore, toast]);

  const handleAccountSelect = (accountId) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const removeAccount = (accountId) => {
    setSelectedAccounts(prev => prev.filter(id => id !== accountId));
  };

  const fetchContasRecebidas = async (): Promise<Record<string, number>> => {
    try {
      // 1. Get faturamento subgroup IDs from system_parameters
      const { data: params } = await supabase
        .from('system_parameters')
        .select('subgroup_id')
        .in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery']);

      const subgroupIds = [...new Set((params || []).map(p => p.subgroup_id).filter(Boolean))] as string[];
      if (subgroupIds.length === 0) return {};

      // 2. Get product IDs that belong to those subgroups
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .in('subgroup_id', subgroupIds);

      const productIds = (products || []).map(p => p.id);
      if (productIds.length === 0) return {};

      // 3. Get accounts_receivable IDs for the selected store that have items with those products
      const { data: items } = await supabase
        .from('accounts_receivable_items')
        .select('account_receivable_id')
        .eq('store_id', selectedStore)
        .in('product_id', productIds);

      const receivableIds = [...new Set((items || []).map(i => i.account_receivable_id))];
      if (receivableIds.length === 0) return {};

      // 4. Get payments for those receivables, grouped by payment_date
      let paymentQuery = supabase
        .from('accounts_receivable_payments')
        .select('payment_date, amount_paid')
        .in('account_receivable_id', receivableIds);

      if (startDate) paymentQuery = paymentQuery.gte('payment_date', startDate);
      if (endDate) paymentQuery = paymentQuery.lte('payment_date', endDate);

      const { data: payments } = await paymentQuery;

      // 5. Group by date
      const dateMap: Record<string, number> = {};
      (payments || []).forEach(p => {
        const date = p.payment_date;
        dateMap[date] = (dateMap[date] || 0) + (p.amount_paid || 0);
      });

      return dateMap;
    } catch (error) {
      console.error('Erro ao buscar contas recebidas:', error);
      return {};
    }
  };

  const generateReport = async () => {
    if (!selectedStore) {
      toast({
        title: "Erro",
        description: "Selecione uma loja",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Fetch cash control data and contas recebidas in parallel
      let query = supabase
        .from('cash_control')
        .select(`
          date,
          faturamento_dinheiro,
          faturamento_cartao,
          faturamento_conta,
          faturamento_delivery,
          faturamento_total,
          cash_control_card_items(valor, card_account_id),
          cash_control_account_items(valor, current_account_id),
          cash_control_delivery_items(valor, delivery_account_id)
        `)
        .eq('store_id', selectedStore)
        .order('date');

      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const [{ data, error }, contasRecebidasMap] = await Promise.all([
        query,
        fetchContasRecebidas()
      ]);

      if (error) throw error;

      // Collect all dates (from cash_control and from contas recebidas)
      const allDates = new Set<string>();
      (data || []).forEach(item => allDates.add(item.date));
      Object.keys(contasRecebidasMap).forEach(date => allDates.add(date));

      const cashControlMap = new Map<string, any>();
      (data || []).forEach(item => cashControlMap.set(item.date, item));

      const processedData = Array.from(allDates).sort().map(date => {
        const item = cashControlMap.get(date);
        
        let dinheiro = 0;
        let cartao = 0;
        let contas = 0;
        let delivery = 0;

        if (item) {
          dinheiro = item.faturamento_dinheiro || 0;

          if (selectedAccounts.length > 0) {
            cartao = (item.cash_control_card_items || [])
              .filter((cardItem: any) => selectedAccounts.includes(cardItem.card_account_id))
              .reduce((sum: number, cardItem: any) => sum + (cardItem.valor || 0), 0);

            contas = (item.cash_control_account_items || [])
              .filter((accountItem: any) => selectedAccounts.includes(accountItem.current_account_id))
              .reduce((sum: number, accountItem: any) => sum + (accountItem.valor || 0), 0);

            delivery = (item.cash_control_delivery_items || [])
              .filter((deliveryItem: any) => selectedAccounts.includes(deliveryItem.delivery_account_id))
              .reduce((sum: number, deliveryItem: any) => sum + (deliveryItem.valor || 0), 0);

            const cashAccountSelected = selectedAccounts.some(accountId => 
              accounts.find(acc => acc.id === accountId && acc.type === 'cash')
            );
            
            if (!cashAccountSelected) {
              dinheiro = 0;
            }
          } else {
            cartao = item.faturamento_cartao || 0;
            contas = item.faturamento_conta || 0;
            delivery = item.faturamento_delivery || 0;
          }
        }

        const contasRecebidas = contasRecebidasMap[date] || 0;
        const total = dinheiro + cartao + contas + delivery + contasRecebidas;

        return {
          date,
          dinheiro,
          cartao,
          contas,
          delivery,
          contasRecebidas,
          total
        };
      });

      setReportData(processedData);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    return reportData.reduce(
      (acc, row) => ({
        dinheiro: acc.dinheiro + row.dinheiro,
        cartao: acc.cartao + row.cartao,
        contas: acc.contas + row.contas,
        delivery: acc.delivery + row.delivery,
        contasRecebidas: acc.contasRecebidas + row.contasRecebidas,
        total: acc.total + row.total
      }),
      { dinheiro: 0, cartao: 0, contas: 0, delivery: 0, contasRecebidas: 0, total: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Relatório de Faturamento</h1>
            <p className="text-sm text-muted-foreground">Visualize o faturamento por período</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Configure os filtros para gerar o relatório</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Loja - Obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="store">Loja *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Inicial e Final */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Contas */}
            {selectedStore && (
              <div className="space-y-2">
                <Label>Contas</Label>
                <Select onValueChange={handleAccountSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione contas para filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem 
                        key={account.id} 
                        value={account.id}
                        disabled={selectedAccounts.includes(account.id)}
                      >
                        {account.name} ({account.type === 'cash' ? 'Caixa' : 
                                     account.type === 'card' ? 'Cartão' : 
                                     account.type === 'current' ? 'Conta Corrente' : 'Delivery'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Contas Selecionadas */}
                {selectedAccounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedAccounts.map(accountId => {
                      const account = accounts.find(acc => acc.id === accountId);
                      return account ? (
                        <Badge key={accountId} variant="secondary" className="flex items-center gap-1">
                          {account.name}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => removeAccount(accountId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            <Button onClick={generateReport} disabled={loading || !selectedStore}>
              {loading ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </CardContent>
        </Card>

        {/* Relatório */}
        {reportData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Relatório de Faturamento</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="table-sticky-first">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Dinheiro</TableHead>
                      <TableHead className="text-right">Cartão</TableHead>
                      <TableHead className="text-right">Contas</TableHead>
                      <TableHead className="text-right">Delivery</TableHead>
                      <TableHead className="text-right">Contas Recebidas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>
                          {format(parseISO(row.date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.dinheiro)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.cartao)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.contas)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.delivery)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.contasRecebidas)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Linha de Totais */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.dinheiro)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.cartao)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.contas)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.delivery)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.contasRecebidas)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TurnoverReport;