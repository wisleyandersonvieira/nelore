import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, ArrowLeft, FileSpreadsheet } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface Store {
  id: string;
  name: string;
}

interface DREStructure {
  id: string;
  name: string;
}

interface StructureItem {
  id: string;
  item_type: 'group' | 'subgroup' | 'sum_line' | 'initial_stock' | 'final_stock';
  name: string;
  description?: string;
  operation_type: 'credit' | 'debit';
  position_order: number;
  parent_id?: string;
  sum_items?: string[];
  account_group_id?: string;
}

interface DREData {
  month: number;
  year: number;
  store_id: string;
  store_name: string;
  values: Record<string, number>;
}

interface DREViewProps {
  regime?: 'cash' | 'competence';
}

export const DREView: React.FC<DREViewProps> = ({ regime = 'competence' }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [structures, setStructures] = useState<DREStructure[]>([]);
  const [structureItems, setStructureItems] = useState<StructureItem[]>([]);
  const [dreData, setDreData] = useState<DREData[]>([]);
  
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedStructure, setSelectedStructure] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Detectar se estamos na página de DRE Caixa ou Competência
  const isCashRegime = regime === 'cash';

  // Função para extrair mês e ano de uma data string sem problemas de timezone
  const getMonthAndYearFromDate = (dateString: string): { month: number; year: number } => {
    // Extrair ano, mês e dia da string no formato YYYY-MM-DD
    const [yearStr, monthStr] = dateString.split('-');
    return {
      month: parseInt(monthStr, 10),
      year: parseInt(yearStr, 10)
    };
  };

  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  useEffect(() => {
    fetchStores();
    fetchStructures();
  }, []);

  useEffect(() => {
    if (selectedStructure) {
      fetchStructureItems();
    }
  }, [selectedStructure]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('dre_structures')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStructures(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estruturas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStructureItems = async () => {
    if (!selectedStructure) return;

    try {
      const { data, error } = await supabase
        .from('dre_structure_items')
        .select('*, account_group_id')
        .eq('structure_id', selectedStructure)
        .order('position_order');

      if (error) throw error;
      
      const formattedItems = (data || []).map((item: any) => ({
        id: item.id,
        item_type: item.item_type as 'group' | 'subgroup' | 'sum_line' | 'initial_stock' | 'final_stock',
        name: item.name,
        description: item.description,
        operation_type: item.operation_type as 'credit' | 'debit',
        position_order: item.position_order,
        parent_id: item.parent_id,
        sum_items: item.sum_items || [],
        account_group_id: item.account_group_id
      }));
      
      setStructureItems(formattedItems);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar itens da estrutura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStoreSelection = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores(prev => [...prev, storeId]);
    } else {
      setSelectedStores(prev => prev.filter(id => id !== storeId));
    }
  };

  const handleMonthSelection = (monthId: string, checked: boolean) => {
    if (checked) {
      setSelectedMonths(prev => [...prev, monthId]);
    } else {
      setSelectedMonths(prev => prev.filter(id => id !== monthId));
    }
  };

  const loadDREData = async () => {
    if (!selectedStructure || selectedStores.length === 0 || selectedMonths.length === 0) {
      toast({
        title: "Seleção incompleta",
        description: "Selecione estrutura, lojas e meses para visualizar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar parâmetros de faturamento configurados
      const { data: faturamentoParams, error: paramsError } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id')
        .in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery']);

      if (paramsError) throw paramsError;

      // Criar mapeamento de parâmetros para subgrupos
      const faturamentoMapping: Record<string, string> = {};
      faturamentoParams?.forEach(param => {
        if (param.subgroup_id) {
          faturamentoMapping[param.parameter_key] = param.subgroup_id;
        }
      });

      // Buscar dados do controle de caixa
      const { data: cashControlData, error: ccError } = await supabase
        .from('cash_control')
        .select(`
          id,
          store_id,
          date,
          faturamento_dinheiro,
          faturamento_cartao,
          faturamento_conta,
          faturamento_delivery,
          stores (name)
        `)
        .in('store_id', selectedStores)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

      if (ccError) throw ccError;

      // Buscar contas a pagar com produtos
      let accountsPayableData, apError;
      
      if (isCashRegime) {
        // Para regime de caixa: buscar contas pagas (com ou sem parcelas)
        
        // 1. Buscar parcelas pagas no ano selecionado
        const { data: paidInstallments, error: installmentsError } = await supabase
          .from('accounts_payable_installments')
          .select('account_payable_id, payment_date, amount, installment_number')
          .not('payment_date', 'is', null)
          .gte('payment_date', `${selectedYear}-01-01`)
          .lte('payment_date', `${selectedYear}-12-31`);

        if (installmentsError) throw installmentsError;

        // 2. Buscar contas pagas à vista (status = paid e payment_date no ano)
        const { data: paidAccounts, error: paidAccountsError } = await supabase
          .from('accounts_payable')
          .select('id, payment_date')
          .eq('status', 'paid')
          .not('payment_date', 'is', null)
          .gte('payment_date', `${selectedYear}-01-01`)
          .lte('payment_date', `${selectedYear}-12-31`)
          .in('store_id', selectedStores);

        if (paidAccountsError) throw paidAccountsError;

        // Combinar IDs de contas com parcelas pagas e contas pagas à vista
        const accountPayableIdsFromInstallments = [...new Set(paidInstallments?.map(inst => inst.account_payable_id) || [])];
        const accountPayableIdsFromDirectPayment = paidAccounts?.map(acc => acc.id) || [];
        const accountPayableIds = [...new Set([...accountPayableIdsFromInstallments, ...accountPayableIdsFromDirectPayment])];

        if (accountPayableIds.length > 0) {
          // Buscar as contas a pagar com seus itens, valor total e parcelas (somente contas quitadas)
          const { data, error } = await supabase
            .from('accounts_payable')
            .select(`
              id,
              store_id,
              total_amount,
              status,
              payment_date,
              data_competencia,
              accounts_payable_items (
                id,
                product_id,
                quantity,
                unit_price,
                total_price,
                products (
                  id,
                  name,
                  subgroup_id
                )
              ),
              accounts_payable_installments (
                id,
                installment_number,
                due_date,
                amount,
                payment_date
              ),
              stores (name)
            `)
            .in('id', accountPayableIds)
            .in('store_id', selectedStores)
            .eq('status', 'paid');

          accountsPayableData = data;
          apError = error;
        } else {
          accountsPayableData = [];
          apError = null;
        }
      } else {
        // Para regime de competência: buscar por data de competência (lógica original)
        const { data, error } = await supabase
          .from('accounts_payable')
          .select(`
            id,
            store_id,
            data_competencia,
            accounts_payable_items (
              product_id,
              quantity,
              unit_price,
              total_price,
              products (
                id,
                name,
                subgroup_id
              )
            ),
            stores (name)
          `)
          .in('store_id', selectedStores)
          .gte('data_competencia', `${selectedYear}-01-01`)
          .lte('data_competencia', `${selectedYear}-12-31`);
        
        accountsPayableData = data;
        apError = error;
      }

      // Verificar se existem dados para as lojas selecionadas
      const cashControlByStore = cashControlData?.reduce((acc: Record<string, number>, item: any) => {
        acc[item.store_id] = (acc[item.store_id] || 0) + 1;
        return acc;
      }, {}) || {};

      const accountsPayableByStore = accountsPayableData?.reduce((acc: Record<string, number>, item: any) => {
        acc[item.store_id] = (acc[item.store_id] || 0) + 1;
        return acc;
      }, {}) || {};

      // Verificar lojas sem dados
      const storesWithoutData = selectedStores.filter(storeId => 
        !cashControlByStore[storeId] && !accountsPayableByStore[storeId]
      );

      if (storesWithoutData.length > 0) {
        const storeNames = storesWithoutData.map(storeId => {
          const store = stores.find(s => s.id === storeId);
          return store?.name || 'Loja desconhecida';
        }).join(', ');
        
        toast({
          title: "Atenção: Dados não encontrados",
          description: `Não foram encontrados dados financeiros para as seguintes lojas no ano ${selectedYear}: ${storeNames}. Verifique se os dados foram cadastrados corretamente para essas lojas.`,
          variant: "default",
        });
      }

      if (apError) throw apError;

      // Agrupar dados por mês, loja e subgrupo
      const groupedData: Record<string, DREData> = {};

      // Processar dados do controle de caixa (FATURAMENTO)
      cashControlData?.forEach((cashControl: any) => {
        const { month, year } = getMonthAndYearFromDate(cashControl.date);

        // Verificar se o mês está selecionado
        if (!selectedMonths.includes(month.toString()) || year !== parseInt(selectedYear)) {
          return;
        }

        const storeId = cashControl.store_id;
        const storeName = cashControl.stores?.name || 'Loja sem nome';
        const key = `${storeId}-${month}`;

        // Inicializar se não existir
        if (!groupedData[key]) {
          groupedData[key] = {
            month,
            year: parseInt(selectedYear),
            store_id: storeId,
            store_name: storeName,
            values: {}
          };
        }

        // Mapear faturamento do caixa para subgrupos baseado nos parâmetros
        const faturamentoData = {
          venda_dinheiro: parseFloat(cashControl.faturamento_dinheiro) || 0,
          venda_cartao: parseFloat(cashControl.faturamento_cartao) || 0,
          venda_contas: parseFloat(cashControl.faturamento_conta) || 0,
          venda_delivery: parseFloat(cashControl.faturamento_delivery) || 0
        };

        Object.entries(faturamentoData).forEach(([paramKey, value]) => {
          const subgroupId = faturamentoMapping[paramKey];
          if (subgroupId && value > 0) {
            // Encontrar o item da estrutura que corresponde a este subgrupo
            const structureItem = structureItems.find(si => 
              si.item_type === 'subgroup' && 
              si.account_group_id === subgroupId
            );

            if (structureItem) {
              if (!groupedData[key].values[structureItem.id]) {
                groupedData[key].values[structureItem.id] = 0;
              }
              groupedData[key].values[structureItem.id] += value;
            }
          }
        });
      });

      // Processar contas a pagar
      accountsPayableData?.forEach((account: any) => {
        if (isCashRegime) {
          // Para regime de caixa: processar baseado nas parcelas pagas OU pagamento à vista
          
          // Verificar se é pagamento à vista (sem parcelas)
          const hasInstallments = account.accounts_payable_installments && account.accounts_payable_installments.length > 0;
          
          if (!hasInstallments && account.status === 'paid' && account.payment_date) {
            // Conta paga à vista - processar o valor total
            const { month, year } = getMonthAndYearFromDate(account.payment_date);

            // Verificar se o mês está selecionado
            if (!selectedMonths.includes(month.toString()) || year !== parseInt(selectedYear)) {
              return;
            }

            const storeId = account.store_id;
            const storeName = account.stores?.name || 'Loja sem nome';
            const key = `${storeId}-${month}`;

            // Inicializar se não existir
            if (!groupedData[key]) {
              groupedData[key] = {
                month,
                year: parseInt(selectedYear),
                store_id: storeId,
                store_name: storeName,
                values: {}
              };
            }

            // Para pagamento à vista, lançar o valor total de cada item
            account.accounts_payable_items?.forEach((item: any) => {
              if (item.products?.subgroup_id) {
                const subgroupId = item.products.subgroup_id;
                const value = parseFloat(item.total_price) || 0;

                // Encontrar o item da estrutura que corresponde a este subgrupo
                const structureItem = structureItems.find(si => 
                  si.item_type === 'subgroup' && 
                  si.account_group_id === subgroupId
                );

                if (structureItem && value > 0) {
                  if (!groupedData[key].values[structureItem.id]) {
                    groupedData[key].values[structureItem.id] = 0;
                  }
                  groupedData[key].values[structureItem.id] += value;
                }
              }
            });
            
            return; // Já processou, não precisa processar parcelas
          }

          // Processar parcelas pagas
          const paidInstallments = account.accounts_payable_installments?.filter((installment: any) => 
            installment.payment_date !== null && installment.payment_date !== undefined
          ) || [];

          // Se não houver parcelas pagas, não processar esta conta
          if (paidInstallments.length === 0) {
            return;
          }

          // Valor total da conta a pagar
          const totalAccountAmount = parseFloat(account.total_amount) || 0;
          
          if (totalAccountAmount === 0) {
            console.warn('Conta a pagar sem valor total:', account.id);
            return;
          }

          paidInstallments.forEach((installment: any) => {
            const { month, year } = getMonthAndYearFromDate(installment.payment_date);

            // Verificar se o mês está selecionado
            if (!selectedMonths.includes(month.toString()) || year !== parseInt(selectedYear)) {
              return;
            }

            const storeId = account.store_id;
            const storeName = account.stores?.name || 'Loja sem nome';
            const key = `${storeId}-${month}`;

            // Inicializar se não existir
            if (!groupedData[key]) {
              groupedData[key] = {
                month,
                year: parseInt(selectedYear),
                store_id: storeId,
                store_name: storeName,
                values: {}
              };
            }

            // Proporção desta parcela em relação ao valor total da conta
            const installmentProportion = parseFloat(installment.amount) / totalAccountAmount;

            account.accounts_payable_items?.forEach((item: any) => {
              if (item.products?.subgroup_id) {
                const subgroupId = item.products.subgroup_id;
                // Calcular o valor proporcional baseado na parcela paga
                const proportionalValue = (parseFloat(item.total_price) || 0) * installmentProportion;

                // Encontrar o item da estrutura que corresponde a este subgrupo
                const structureItem = structureItems.find(si => 
                  si.item_type === 'subgroup' && 
                  si.account_group_id === subgroupId
                );

                if (structureItem && proportionalValue > 0) {
                  if (!groupedData[key].values[structureItem.id]) {
                    groupedData[key].values[structureItem.id] = 0;
                  }
                  groupedData[key].values[structureItem.id] += proportionalValue;
                }
              }
            });
          });
        } else {
          // Para regime de competência: usar lógica original
          const { month, year } = getMonthAndYearFromDate(account.data_competencia);

          // Verificar se o mês está selecionado
          if (!selectedMonths.includes(month.toString()) || year !== parseInt(selectedYear)) {
            return;
          }

          const storeId = account.store_id;
          const storeName = account.stores?.name || 'Loja sem nome';
          const key = `${storeId}-${month}`;

          // Inicializar se não existir
          if (!groupedData[key]) {
            groupedData[key] = {
              month,
              year: parseInt(selectedYear),
              store_id: storeId,
              store_name: storeName,
              values: {}
            };
          }

          account.accounts_payable_items?.forEach((item: any) => {
            if (item.products?.subgroup_id) {
              const subgroupId = item.products.subgroup_id;
              const value = parseFloat(item.total_price) || 0;

              // Encontrar o item da estrutura que corresponde a este subgrupo
              const structureItem = structureItems.find(si => 
                si.item_type === 'subgroup' && 
                si.account_group_id === subgroupId
              );

              if (structureItem) {
                if (!groupedData[key].values[structureItem.id]) {
                  groupedData[key].values[structureItem.id] = 0;
                }
                groupedData[key].values[structureItem.id] += value;
              }
            }
          });
        }
      });

      // Buscar dados de estoque para itens de estoque inicial e final
      await loadStockData(groupedData);

      // Converter para array
      const formattedData: DREData[] = Object.values(groupedData);
      setDreData(formattedData);

      if (formattedData.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não foram encontradas contas a pagar para os filtros selecionados",
          variant: "default",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados DRE",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStockData = async (groupedData: Record<string, DREData>) => {
    try {
      // Verificar se há itens de estoque na estrutura
      const stockItems = structureItems.filter(item => 
        item.item_type === 'initial_stock' || item.item_type === 'final_stock'
      );

      if (stockItems.length === 0) return;

      // Para cada combinação de loja/mês nos dados agrupados
      for (const [key, dreData] of Object.entries(groupedData)) {
        const { store_id, month, year } = dreData;

        // Para estoque inicial: buscar 2 meses antes do mês selecionado
        const initialStockItems = stockItems.filter(item => item.item_type === 'initial_stock');
        if (initialStockItems.length > 0) {
          let initialMonth = month - 2;
          let initialYear = year;
          
          // Ajustar ano se necessário
          if (initialMonth <= 0) {
            initialMonth += 12;
            initialYear -= 1;
          }

          const { data: initialStockData, error: initialError } = await supabase
            .from('stock_control')
            .select('total_value')
            .eq('store_id', store_id)
            .eq('month', initialMonth)
            .eq('year', initialYear)
            .single();

          if (initialError && initialError.code !== 'PGRST116') {
            console.error('Erro ao buscar estoque inicial:', initialError);
          }

          const initialStockValue = initialStockData?.total_value || 0;
          initialStockItems.forEach(item => {
            groupedData[key].values[item.id] = parseFloat(initialStockValue.toString());
          });
        }

        // Para estoque final: buscar mês anterior (mesmo código do estoque inicial)
        const finalStockItems = stockItems.filter(item => item.item_type === 'final_stock');
        if (finalStockItems.length > 0) {
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear = month === 1 ? year - 1 : year;

          const { data: finalStockData, error: finalError } = await supabase
            .from('stock_control')
            .select('total_value')
            .eq('store_id', store_id)
            .eq('month', prevMonth)
            .eq('year', prevYear)
            .single();

          if (finalError && finalError.code !== 'PGRST116') {
            console.error('Erro ao buscar estoque final:', finalError);
          }

          const finalStockValue = finalStockData?.total_value || 0;
          finalStockItems.forEach(item => {
            groupedData[key].values[item.id] = parseFloat(finalStockValue.toString());
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados de estoque:', error);
      toast({
        title: "Erro ao carregar dados de estoque",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateGroupTotal = (groupId: string, data: DREData): number => {
    // Encontrar o grupo atual
    const currentGroupIndex = structureItems.findIndex(item => item.id === groupId);
    if (currentGroupIndex === -1) return 0;

    // Encontrar o próximo grupo após este
    const nextGroupIndex = structureItems.findIndex((item, index) => 
      index > currentGroupIndex && item.item_type === 'group'
    );

    // Pegar todos os itens entre este grupo e o próximo grupo (ou até o final)
    const endIndex = nextGroupIndex === -1 ? structureItems.length : nextGroupIndex;
    const itemsInGroup = structureItems.slice(currentGroupIndex + 1, endIndex)
      .filter(item => item.item_type === 'subgroup' || item.item_type === 'initial_stock' || item.item_type === 'final_stock');
    
    return itemsInGroup.reduce((total, item) => {
      let value = 0;
      if (item.item_type === 'subgroup') {
        value = data.values[item.id] || 0;
      } else if (item.item_type === 'initial_stock' || item.item_type === 'final_stock') {
        value = calculateStockTotal(item.id, data);
      }
      return total + (item.operation_type === 'credit' ? value : -value);
    }, 0);
  };

  const calculateSumLineTotal = (sumLineId: string, data: DREData): number => {
    // Find the current sum line position
    const currentSumLineIndex = structureItems.findIndex(item => item.id === sumLineId);
    if (currentSumLineIndex === -1) return 0;
    
    // Sum all subgroups and stock items that are above this sum line
    const itemsAbove = structureItems.slice(0, currentSumLineIndex);
    
    return itemsAbove.reduce((total, item) => {
      if (item.item_type === 'subgroup' || item.item_type === 'initial_stock' || item.item_type === 'final_stock') {
        const value = data.values[item.id] || 0;
        return total + (item.operation_type === 'credit' ? value : -value);
      }
      return total;
    }, 0);
  };

  const calculateStockTotal = (stockId: string, data: DREData): number => {
    // Para itens de estoque, retornar o valor direto
    return data.values[stockId] || 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return months[month - 1]?.label || month.toString();
  };

  const exportToExcel = () => {
    try {
      // Preparar dados para exportação
      const exportData: any[] = [];
      
      // Cabeçalho principal
      const headerRow1 = ['Descrição'];
      const headerRow2 = [''];
      
      Object.entries(groupedData).forEach(([periodKey, periodData]) => {
        const [year, month] = periodKey.split('-');
        const monthName = `${getMonthName(parseInt(month))} ${year}`;
        
        periodData.forEach((data) => {
          headerRow1.push(monthName);
          headerRow2.push(data.store_name);
        });
      });
      
      exportData.push(headerRow1);
      exportData.push(headerRow2);
      
      // Dados das linhas
      structureItems.forEach((item) => {
        const row = [
          item.item_type === 'sum_line' && item.description 
            ? item.description 
            : item.name
        ];
        
        Object.entries(groupedData).forEach(([_, periodData]) => {
          periodData.forEach((data) => {
            let value = 0;
            if (item.item_type === 'subgroup') {
              value = data.values[item.id] || 0;
            } else if (item.item_type === 'group') {
              value = calculateGroupTotal(item.id, data);
            } else if (item.item_type === 'sum_line') {
              value = calculateSumLineTotal(item.id, data);
            }
            row.push(value.toString());
          });
        });
        
        exportData.push(row);
      });
      
      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(exportData);
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, "DRE");
      
      // Baixar arquivo
      const fileName = `DRE_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Exportação concluída",
        description: "Arquivo Excel baixado com sucesso",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape');
      
      // Título
      doc.setFontSize(16);
      doc.text('Demonstrativo de Resultados do Exercício', 20, 20);
      doc.setFontSize(12);
      doc.text(`Ano: ${selectedYear}`, 20, 30);
      
      // Preparar dados para a tabela
      const tableHeaders: string[] = ['Descrição'];
      const tableData: (string | number)[][] = [];
      
      // Cabeçalhos das colunas
      Object.entries(groupedData).forEach(([periodKey, periodData]) => {
        const [year, month] = periodKey.split('-');
        const monthName = `${getMonthName(parseInt(month))} ${year}`;
        
        periodData.forEach((data) => {
          tableHeaders.push(`${monthName} - ${data.store_name}`);
        });
      });
      
      // Linhas de dados
      structureItems.forEach((item) => {
        const row: (string | number)[] = [
          item.item_type === 'sum_line' && item.description 
            ? item.description 
            : item.name
        ];
        
        Object.entries(groupedData).forEach(([_, periodData]) => {
          periodData.forEach((data) => {
            let value = 0;
            if (item.item_type === 'subgroup') {
              value = data.values[item.id] || 0;
            } else if (item.item_type === 'group') {
              value = calculateGroupTotal(item.id, data);
            } else if (item.item_type === 'sum_line') {
              value = calculateSumLineTotal(item.id, data);
            } else if (item.item_type === 'initial_stock' || item.item_type === 'final_stock') {
              value = calculateStockTotal(item.id, data);
            }
            row.push(formatCurrency(value));
          });
        });
        
        tableData.push(row);
      });
      
      // Adicionar tabela ao PDF
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 'auto', minCellWidth: 40 },
        },
        margin: { top: 40 },
      });
      
      // Salvar PDF
      const fileName = `DRE_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Exportação concluída",
        description: "Arquivo PDF baixado com sucesso",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Agrupar dados por mês, mantendo separação por loja
  const groupedData = dreData.reduce((acc, data) => {
    const key = `${data.year}-${data.month}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    // Verificar se já existe uma entrada para esta loja neste período
    const existingStoreIndex = acc[key].findIndex(item => item.store_id === data.store_id);
    if (existingStoreIndex >= 0) {
      // Somar os valores se já existe entrada para esta loja
      Object.keys(data.values).forEach(structureItemId => {
        if (!acc[key][existingStoreIndex].values[structureItemId]) {
          acc[key][existingStoreIndex].values[structureItemId] = 0;
        }
        acc[key][existingStoreIndex].values[structureItemId] += data.values[structureItemId];
      });
    } else {
      // Adicionar nova entrada se não existe para esta loja
      acc[key].push(data);
    }
    return acc;
  }, {} as Record<string, DREData[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visualizar DRE</h2>
        <p className="text-muted-foreground">Consulte e compare os demonstrativos de resultados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de Consulta</CardTitle>
          <CardDescription>Selecione os parâmetros para visualização do DRE</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Estrutura */}
            <div className="space-y-2">
              <Label>Estrutura DRE</Label>
              <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a estrutura" />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ano */}
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Lojas */}
            <div className="space-y-2">
              <Label>Lojas</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={(checked) => 
                        handleStoreSelection(store.id, checked as boolean)
                      }
                    />
                    <label htmlFor={`store-${store.id}`} className="text-sm">
                      {store.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Meses */}
            <div className="space-y-2">
              <Label>Meses</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {months.map((month) => (
                  <div key={month.value} className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id={`month-${month.value}`}
                      checked={selectedMonths.includes(month.value)}
                      onCheckedChange={(checked) => 
                        handleMonthSelection(month.value, checked as boolean)
                      }
                    />
                    <label htmlFor={`month-${month.value}`} className="text-sm">
                      {month.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={loadDREData} disabled={loading}>
              <Eye className="h-4 w-4 mr-2" />
              {loading ? "Carregando..." : "Visualizar DRE"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {Object.keys(groupedData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Demonstrativo de Resultados</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Comparativo dos resultados por período e loja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Descrição</TableHead>
                    {Object.entries(groupedData).map(([periodKey, periodData]) => {
                      const [year, month] = periodKey.split('-');
                      return (
                        <TableHead key={periodKey} colSpan={periodData.length} className="text-center">
                          {getMonthName(parseInt(month))} {year}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                  <TableRow>
                    <TableHead></TableHead>
                    {Object.entries(groupedData).map(([periodKey, periodData]) => 
                      periodData.map((data, index) => (
                        <TableHead key={`${periodKey}-${index}`} className="text-center">
                          {data.store_name}
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                 <TableBody>
                   {structureItems.map((item) => (
                     <TableRow key={item.id} className={`h-8 ${
                       item.item_type === 'group' ? 'font-bold' : 
                       item.item_type === 'sum_line' ? 'bg-muted/70 font-bold' : ''
                     }`}>
                       <TableCell className={`py-1 ${
                         item.item_type === 'group' ? 'font-bold' : 
                         item.item_type === 'sum_line' ? 'font-bold' : 
                         item.item_type === 'subgroup' ? 'font-medium pl-6' : 'font-medium'
                       }`}>
                         {item.item_type === 'sum_line' && item.description 
                           ? item.description 
                           : item.name}
                       </TableCell>
                       {Object.entries(groupedData).map(([periodKey, periodData]) => 
                         periodData.map((data, index) => (
                            <TableCell key={`${periodKey}-${index}`} className={`text-right py-1 ${
                              item.item_type === 'group' || item.item_type === 'sum_line' ? 'font-bold' : ''
                            } ${item.operation_type === 'debit' ? 'text-destructive' : ''}`}>
                              {item.item_type === 'subgroup' && formatCurrency(data.values[item.id] || 0)}
                              {item.item_type === 'group' && formatCurrency(calculateGroupTotal(item.id, data))}
                              {item.item_type === 'sum_line' && formatCurrency(calculateSumLineTotal(item.id, data))}
                              {(item.item_type === 'initial_stock' || item.item_type === 'final_stock') && 
                                formatCurrency(calculateStockTotal(item.id, data))}
                            </TableCell>
                         ))
                       )}
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(groupedData).length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
            <p className="text-muted-foreground">
              Verifique se existem DREs cadastrados para o período e lojas selecionadas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};