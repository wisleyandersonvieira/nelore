import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDaysInMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CashControlData {
  id: string;
  date: string;
  saldo_inicial: number;
  contagem_dinheiro: number;
  despesas_pagas: number;
  valor_mantido_caixa: number;
  faturamento_dinheiro: number;
  faturamento_cartao: number;
  faturamento_conta: number;
  faturamento_delivery: number;
  faturamento_total: number;
  valor_fechamento_pdv: number;
  diferenca: number;
  card_items: Array<{ card_account_id: string; valor: number; account_name: string }>;
  account_items: Array<{ current_account_id: string; valor: number; account_name: string }>;
  delivery_items: Array<{ delivery_account_id: string; valor: number; account_name: string }>;
}

interface MonthViewTableProps {
  storeId: string;
  year: number;
  month: number;
}

export const MonthViewTable = ({ storeId, year, month }: MonthViewTableProps) => {
  const [data, setData] = useState<Record<string, CashControlData>>({});
  const [loading, setLoading] = useState(true);
  const [cardAccounts, setCardAccounts] = useState<Set<string>>(new Set());
  const [currentAccounts, setCurrentAccounts] = useState<Set<string>>(new Set());
  const [deliveryAccounts, setDeliveryAccounts] = useState<Set<string>>(new Set());

  const daysInMonth = getDaysInMonth(new Date(year, month));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    fetchMonthData();
  }, [storeId, year, month]);

  const fetchMonthData = async () => {
    try {
      setLoading(true);
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      // Buscar dados do cash_control
      const { data: cashControlData, error } = await supabase
        .from('cash_control')
        .select(`
          *,
          cash_control_card_items(*, card_accounts(name)),
          cash_control_account_items(*, current_accounts(name)),
          cash_control_delivery_items(*, delivery_accounts(name))
        `)
        .eq('store_id', storeId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      const organizedData: Record<string, CashControlData> = {};
      const cardAccountsSet = new Set<string>();
      const currentAccountsSet = new Set<string>();
      const deliveryAccountsSet = new Set<string>();

      cashControlData?.forEach((item) => {
        const dayKey = new Date(item.date).getDate().toString();
        
        // Organizar itens de cartão
        const cardItems = item.cash_control_card_items?.map((cardItem: any) => ({
          card_account_id: cardItem.card_account_id,
          valor: cardItem.valor,
          account_name: cardItem.card_accounts?.name || 'Conta não encontrada'
        })) || [];

        // Organizar itens de conta corrente
        const accountItems = item.cash_control_account_items?.map((accountItem: any) => ({
          current_account_id: accountItem.current_account_id,
          valor: accountItem.valor,
          account_name: accountItem.current_accounts?.name || 'Conta não encontrada'
        })) || [];

        // Organizar itens de delivery
        const deliveryItems = item.cash_control_delivery_items?.map((deliveryItem: any) => ({
          delivery_account_id: deliveryItem.delivery_account_id,
          valor: deliveryItem.valor,
          account_name: deliveryItem.delivery_accounts?.name || 'Conta não encontrada'
        })) || [];

        // Adicionar contas aos sets
        cardItems.forEach(item => cardAccountsSet.add(item.account_name));
        accountItems.forEach(item => currentAccountsSet.add(item.account_name));
        deliveryItems.forEach(item => deliveryAccountsSet.add(item.account_name));

        organizedData[dayKey] = {
          id: item.id,
          date: item.date,
          saldo_inicial: item.saldo_inicial || 0,
          contagem_dinheiro: item.contagem_dinheiro || 0,
          despesas_pagas: item.despesas_pagas || 0,
          valor_mantido_caixa: item.valor_mantido_caixa || 0,
          faturamento_dinheiro: item.faturamento_dinheiro || 0,
          faturamento_cartao: item.faturamento_cartao || 0,
          faturamento_conta: item.faturamento_conta || 0,
          faturamento_delivery: item.faturamento_delivery || 0,
          faturamento_total: item.faturamento_total || 0,
          valor_fechamento_pdv: item.valor_fechamento_pdv || 0,
          diferenca: item.diferenca || 0,
          card_items: cardItems,
          account_items: accountItems,
          delivery_items: deliveryItems
        };
      });

      setData(organizedData);
      setCardAccounts(cardAccountsSet);
      setCurrentAccounts(currentAccountsSet);
      setDeliveryAccounts(deliveryAccountsSet);
    } catch (error) {
      console.error('Erro ao carregar dados do mês:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCardValue = (day: string, accountName: string) => {
    const dayData = data[day];
    if (!dayData) return 0;
    const cardItem = dayData.card_items.find(item => item.account_name === accountName);
    return cardItem?.valor || 0;
  };

  const getAccountValue = (day: string, accountName: string) => {
    const dayData = data[day];
    if (!dayData) return 0;
    const accountItem = dayData.account_items.find(item => item.account_name === accountName);
    return accountItem?.valor || 0;
  };

  const getDeliveryValue = (day: string, accountName: string) => {
    const dayData = data[day];
    if (!dayData) return 0;
    const deliveryItem = dayData.delivery_items.find(item => item.account_name === accountName);
    return deliveryItem?.valor || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-[70vh] overflow-hidden border rounded-lg">
      <div className="h-full overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 p-3 text-left font-medium border-r min-w-[200px]">
                Descrição
              </th>
              {days.map((day) => (
                <th key={day} className="p-3 text-center font-medium min-w-[100px] border-r">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Seção DINHEIRO */}
            <tr className="border-b bg-blue-50">
              <td className="sticky left-0 bg-blue-50 p-3 font-semibold border-r">DINHEIRO</td>
              {days.map((day) => (
                <td key={day} className="p-3 border-r"></td>
              ))}
            </tr>
            
            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 pl-6 border-r">Saldo Inicial</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].saldo_inicial) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 pl-6 border-r">Contagem Dinheiro</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].contagem_dinheiro) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 pl-6 border-r">Despesas Pagas</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].despesas_pagas) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 pl-6 border-r">Valor Mantido</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].valor_mantido_caixa) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 pl-6 border-r">Faturamento Dinheiro</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].faturamento_dinheiro) : '-'}
                </td>
              ))}
            </tr>

            {/* Seção CARTÃO */}
            <tr className="border-b bg-green-50">
              <td className="sticky left-0 bg-green-50 p-3 font-semibold border-r">CARTÃO</td>
              {days.map((day) => (
                <td key={day} className="p-3 border-r"></td>
              ))}
            </tr>

            {Array.from(cardAccounts).map((accountName) => (
              <tr key={accountName} className="border-b">
                <td className="sticky left-0 bg-background p-3 pl-6 border-r">{accountName}</td>
                {days.map((day) => (
                  <td key={day} className="p-3 text-center border-r text-sm">
                    {getCardValue(day.toString(), accountName) > 0 ? formatCurrency(getCardValue(day.toString(), accountName)) : '-'}
                  </td>
                ))}
              </tr>
            ))}

            {/* Seção CONTAS */}
            <tr className="border-b bg-yellow-50">
              <td className="sticky left-0 bg-yellow-50 p-3 font-semibold border-r">CONTAS</td>
              {days.map((day) => (
                <td key={day} className="p-3 border-r"></td>
              ))}
            </tr>

            {Array.from(currentAccounts).map((accountName) => (
              <tr key={accountName} className="border-b">
                <td className="sticky left-0 bg-background p-3 pl-6 border-r">{accountName}</td>
                {days.map((day) => (
                  <td key={day} className="p-3 text-center border-r text-sm">
                    {getAccountValue(day.toString(), accountName) > 0 ? formatCurrency(getAccountValue(day.toString(), accountName)) : '-'}
                  </td>
                ))}
              </tr>
            ))}

            {/* Seção DELIVERY */}
            <tr className="border-b bg-purple-50">
              <td className="sticky left-0 bg-purple-50 p-3 font-semibold border-r">DELIVERY</td>
              {days.map((day) => (
                <td key={day} className="p-3 border-r"></td>
              ))}
            </tr>

            {Array.from(deliveryAccounts).map((accountName) => (
              <tr key={accountName} className="border-b">
                <td className="sticky left-0 bg-background p-3 pl-6 border-r">{accountName}</td>
                {days.map((day) => (
                  <td key={day} className="p-3 text-center border-r text-sm">
                    {getDeliveryValue(day.toString(), accountName) > 0 ? formatCurrency(getDeliveryValue(day.toString(), accountName)) : '-'}
                  </td>
                ))}
              </tr>
            ))}

            {/* Seção TOTAIS */}
            <tr className="border-b bg-orange-50">
              <td className="sticky left-0 bg-orange-50 p-3 font-semibold border-r">FATURAMENTO</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm font-semibold">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].faturamento_total) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 font-semibold border-r">Valor Total Fechamento PDV</td>
              {days.map((day) => (
                <td key={day} className="p-3 text-center border-r text-sm font-semibold">
                  {data[day.toString()] ? formatCurrency(data[day.toString()].valor_fechamento_pdv) : '-'}
                </td>
              ))}
            </tr>

            <tr className="border-b">
              <td className="sticky left-0 bg-background p-3 font-semibold border-r">DIFERENÇA</td>
              {days.map((day) => (
                <td key={day} className={`p-3 text-center border-r text-sm font-semibold ${data[day.toString()]?.diferenca !== 0 ? 'text-red-600' : ''}`}>
                  {data[day.toString()] ? formatCurrency(data[day.toString()].diferenca) : '-'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};