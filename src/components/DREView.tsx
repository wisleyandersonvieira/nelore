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
export const DREView: React.FC<DREViewProps> = ({
  regime = 'competence'
}) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [structures, setStructures] = useState<DREStructure[]>([]);
  const [structureItems, setStructureItems] = useState<StructureItem[]>([]);
  const [dreData, setDreData] = useState<DREData[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedStructure, setSelectedStructure] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();

  // Detectar se estamos na página de DRE Caixa ou Competência
  const isCashRegime = regime === 'cash';

  // Função para extrair mês e ano de uma data string sem problemas de timezone
  const getMonthAndYearFromDate = (dateString: string): {
    month: number;
    year: number;
  } => {
    // Extrair ano, mês e dia da string no formato YYYY-MM-DD
    const [yearStr, monthStr] = dateString.split('-');
    return {
      month: parseInt(monthStr, 10),
      year: parseInt(yearStr, 10)
    };
  };
  const months = [{
    value: "1",
    label: "Janeiro"
  }, {
    value: "2",
    label: "Fevereiro"
  }, {
    value: "3",
    label: "Março"
  }, {
    value: "4",
    label: "Abril"
  }, {
    value: "5",
    label: "Maio"
  }, {
    value: "6",
    label: "Junho"
  }, {
    value: "7",
    label: "Julho"
  }, {
    value: "8",
    label: "Agosto"
  }, {
    value: "9",
    label: "Setembro"
  }, {
    value: "10",
    label: "Outubro"
  }, {
    value: "11",
    label: "Novembro"
  }, {
    value: "12",
    label: "Dezembro"
  }];
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar se é admin
      const {
        data: profile
      } = await supabase.from('profiles').select('role, store_id').eq('id', user.id).single();
      if (profile?.role === 'admin') {
        // Admin vê todas as lojas
        const {
          data,
          error
        } = await supabase.from('stores').select('id, name').order('name');
        if (error) throw error;
        setStores(data || []);
      } else {
        // Usuário normal: buscar lojas autorizadas
        const storeIds: string[] = [];
        if (profile?.store_id) {
          storeIds.push(profile.store_id);
        }
        const {
          data: userStores
        } = await supabase.from('user_stores').select('store_id').eq('user_id', user.id);
        if (userStores) {
          userStores.forEach(us => {
            if (!storeIds.includes(us.store_id)) {
              storeIds.push(us.store_id);
            }
          });
        }
        if (storeIds.length > 0) {
          const {
            data,
            error
          } = await supabase.from('stores').select('id, name').in('id', storeIds).order('name');
          if (error) throw error;
          setStores(data || []);
        } else {
          setStores([]);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const fetchStructures = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('dre_structures').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      setStructures(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estruturas",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const fetchStructureItems = async () => {
    if (!selectedStructure) return;
    try {
      const {
        data,
        error
      } = await supabase.from('dre_structure_items').select('*, account_group_id').eq('structure_id', selectedStructure).order('position_order');
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
        variant: "destructive"
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
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      // Buscar parâmetros de faturamento configurados (incluindo os novos parâmetros separados de acréscimo)
      const {
        data: faturamentoParams,
        error: paramsError
      } = await supabase.from('system_parameters').select('parameter_key, subgroup_id, product_id').in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery', 'acrescimo', 'desconto', 'acrescimo_pagar', 'acrescimo_receber', 'desconto_pagar', 'desconto_receber']);
      if (paramsError) throw paramsError;

      // Criar mapeamento de parâmetros para subgrupos
      const faturamentoMapping: Record<string, string> = {};
      // IDs dos produtos de acréscimo e desconto (juros) - agora separados por módulo
      let acrescimoProductId: string | null = null;
      let acrescimoPagarProductId: string | null = null;
      let acrescimoReceberProductId: string | null = null;
      let descontoProductId: string | null = null;
      let descontoPagarProductId: string | null = null;
      let descontoReceberProductId: string | null = null;
      faturamentoParams?.forEach(param => {
        if (param.subgroup_id) {
          faturamentoMapping[param.parameter_key] = param.subgroup_id;
        }
        // Parâmetros específicos têm prioridade
        if (param.parameter_key === 'acrescimo_pagar' && param.product_id) {
          acrescimoPagarProductId = param.product_id;
        }
        if (param.parameter_key === 'acrescimo_receber' && param.product_id) {
          acrescimoReceberProductId = param.product_id;
        }
        // Fallback para parâmetro legado
        if (param.parameter_key === 'acrescimo' && param.product_id) {
          acrescimoProductId = param.product_id;
        }
        if (param.parameter_key === 'desconto_pagar' && param.product_id) {
          descontoPagarProductId = param.product_id;
        }
        if (param.parameter_key === 'desconto_receber' && param.product_id) {
          descontoReceberProductId = param.product_id;
        }
        // Fallback para parâmetro legado
        if (param.parameter_key === 'desconto' && param.product_id) {
          descontoProductId = param.product_id;
        }
      });
      
      // Se os parâmetros específicos não estiverem configurados, usar o legado
      if (!acrescimoPagarProductId) {
        acrescimoPagarProductId = acrescimoProductId;
      }
      if (!acrescimoReceberProductId) {
        acrescimoReceberProductId = acrescimoProductId;
      }
      if (!descontoPagarProductId) {
        descontoPagarProductId = descontoProductId;
      }
      if (!descontoReceberProductId) {
        descontoReceberProductId = descontoProductId;
      }

      // Buscar dados do controle de caixa
      const {
        data: cashControlData,
        error: ccError
      } = await supabase.from('cash_control').select(`
          id,
          store_id,
          date,
          faturamento_dinheiro,
          faturamento_cartao,
          faturamento_conta,
          faturamento_delivery,
          stores (name)
        `).in('store_id', selectedStores).gte('date', `${selectedYear}-01-01`).lte('date', `${selectedYear}-12-31`);
      if (ccError) throw ccError;

      // Buscar contas a pagar com produtos
      let accountsPayableData, apError;

      // Buscar registros de pagamentos da nova tabela (para juros/descontos corretos)
      const {
        data: paymentsData,
        error: paymentsError
      } = await supabase.from('accounts_payable_payments').select(`
          id,
          installment_id,
          account_payable_id,
          payment_date,
          amount_paid,
          interest_amount,
          discount_amount,
          interest_product_id,
          discount_product_id
        `).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`);
      if (paymentsError) {
        console.warn('Erro ao buscar payments:', paymentsError);
      }

      // Criar mapa de pagamentos por installment_id para uso posterior
      const paymentsByInstallmentId: Record<string, any> = {};
      paymentsData?.forEach(payment => {
        paymentsByInstallmentId[payment.installment_id] = payment;
      });
      if (isCashRegime) {
        // Para regime de caixa: buscar contas pagas (com ou sem parcelas)

        // 1. Buscar parcelas pagas no ano selecionado
        const {
          data: paidInstallments,
          error: installmentsError
        } = await supabase.from('accounts_payable_installments').select('account_payable_id, payment_date, amount, installment_number').not('payment_date', 'is', null).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`);
        if (installmentsError) throw installmentsError;

        // 2. Buscar contas pagas à vista (status = paid e payment_date no ano)
        const {
          data: paidAccounts,
          error: paidAccountsError
        } = await supabase.from('accounts_payable').select('id, payment_date').eq('status', 'paid').not('payment_date', 'is', null).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`).in('store_id', selectedStores);
        if (paidAccountsError) throw paidAccountsError;

        // Combinar IDs de contas com parcelas pagas e contas pagas à vista
        const accountPayableIdsFromInstallments = [...new Set(paidInstallments?.map(inst => inst.account_payable_id) || [])];
        const accountPayableIdsFromDirectPayment = paidAccounts?.map(acc => acc.id) || [];
        const accountPayableIds = [...new Set([...accountPayableIdsFromInstallments, ...accountPayableIdsFromDirectPayment])];
        if (accountPayableIds.length > 0) {
          // Buscar as contas a pagar com seus itens, valor total e parcelas (quitadas ou parcialmente pagas)
          const {
            data,
            error
          } = await supabase.from('accounts_payable').select(`
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
                  subgroup_id,
                  function_type
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
            `).in('id', accountPayableIds).in('store_id', selectedStores).in('status', ['paid', 'partial']);
          accountsPayableData = data;
          apError = error;
        } else {
          accountsPayableData = [];
          apError = null;
        }
      } else {
        // Para regime de competência: buscar por data de competência (lógica original)
        // Incluir payment_date e accounts_payable_installments para processar juros/descontos corretamente
        const {
          data,
          error
        } = await supabase.from('accounts_payable').select(`
            id,
            store_id,
            data_competencia,
            payment_date,
            accounts_payable_items (
              product_id,
              quantity,
              unit_price,
              total_price,
              products (
                id,
                name,
                subgroup_id,
                function_type
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
          `).in('store_id', selectedStores).gte('data_competencia', `${selectedYear}-01-01`).lte('data_competencia', `${selectedYear}-12-31`);
        accountsPayableData = data || [];
        apError = error;

        // Para competência: também precisamos buscar juros/descontos de contas cuja 
        // competência pode estar em outro ano, mas o pagamento foi feito no ano selecionado
        // Buscar IDs das contas que têm pagamentos no ano selecionado
        const accountIdsFromPayments = [...new Set(paymentsData?.map(p => p.account_payable_id) || [])];

        // Filtrar apenas IDs que não estão já nos dados buscados
        const existingAccountIds = new Set(accountsPayableData.map((a: any) => a.id));
        const missingAccountIds = accountIdsFromPayments.filter(id => !existingAccountIds.has(id));
        if (missingAccountIds.length > 0) {
          // Buscar contas adicionais que têm pagamentos no ano mas competência em outro ano
          const {
            data: additionalAccounts,
            error: additionalError
          } = await supabase.from('accounts_payable').select(`
              id,
              store_id,
              data_competencia,
              payment_date,
              accounts_payable_items (
                product_id,
                quantity,
                unit_price,
                total_price,
                products (
                  id,
                  name,
                  subgroup_id,
                  function_type
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
            `).in('id', missingAccountIds).in('store_id', selectedStores);
          if (!additionalError && additionalAccounts) {
            // Marcar essas contas para processar APENAS juros/descontos, não itens normais
            additionalAccounts.forEach((acc: any) => {
              acc._onlyInterestDiscount = true;
            });
            accountsPayableData = [...accountsPayableData, ...additionalAccounts];
          }
        }
      }

      // Buscar registros de pagamentos de contas a receber (para juros/descontos corretos)
      const {
        data: arPaymentsData,
        error: arPaymentsError
      } = await supabase.from('accounts_receivable_payments').select(`
          id,
          installment_id,
          account_receivable_id,
          payment_date,
          amount_paid,
          interest_amount,
          discount_amount,
          interest_product_id,
          discount_product_id
        `).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`);
      if (arPaymentsError) {
        console.warn('Erro ao buscar AR payments:', arPaymentsError);
      }

      // Criar mapa de pagamentos de contas a receber por installment_id
      const arPaymentsByInstallmentId: Record<string, any> = {};
      arPaymentsData?.forEach(payment => {
        arPaymentsByInstallmentId[payment.installment_id] = payment;
      });

      // Buscar contas a receber
      let accountsReceivableData: any[] = [];
      let arError = null;

      if (isCashRegime) {
        // Para regime de caixa: buscar contas recebidas (com ou sem parcelas)

        // 1. Buscar parcelas recebidas no ano selecionado
        const {
          data: receivedInstallments,
          error: arInstallmentsError
        } = await supabase.from('accounts_receivable_installments').select('account_receivable_id, payment_date, amount, installment_number').not('payment_date', 'is', null).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`);
        if (arInstallmentsError) throw arInstallmentsError;

        // 2. Buscar contas recebidas à vista (status = paid e payment_date no ano)
        const {
          data: receivedAccounts,
          error: receivedAccountsError
        } = await supabase.from('accounts_receivable').select('id, payment_date').eq('status', 'paid').not('payment_date', 'is', null).gte('payment_date', `${selectedYear}-01-01`).lte('payment_date', `${selectedYear}-12-31`).in('store_id', selectedStores);
        if (receivedAccountsError) throw receivedAccountsError;

        // Combinar IDs de contas com parcelas recebidas e contas recebidas à vista
        const accountReceivableIdsFromInstallments = [...new Set(receivedInstallments?.map(inst => inst.account_receivable_id) || [])];
        const accountReceivableIdsFromDirectPayment = receivedAccounts?.map(acc => acc.id) || [];
        const accountReceivableIds = [...new Set([...accountReceivableIdsFromInstallments, ...accountReceivableIdsFromDirectPayment])];

        if (accountReceivableIds.length > 0) {
          const {
            data,
            error
          } = await supabase.from('accounts_receivable').select(`
              id,
              store_id,
              total_amount,
              status,
              payment_date,
              data_competencia,
              accounts_receivable_items (
                id,
                product_id,
                quantity,
                unit_price,
                total_price,
                products (
                  id,
                  name,
                  subgroup_id,
                  function_type
                )
              ),
              accounts_receivable_installments (
                id,
                installment_number,
                due_date,
                amount,
                payment_date
              ),
              stores (name)
            `).in('id', accountReceivableIds).in('store_id', selectedStores).in('status', ['paid', 'partial']);
          accountsReceivableData = data || [];
          arError = error;
        } else {
          accountsReceivableData = [];
          arError = null;
        }
      } else {
        // Para regime de competência: buscar por data de competência
        const {
          data,
          error
        } = await supabase.from('accounts_receivable').select(`
            id,
            store_id,
            data_competencia,
            payment_date,
            accounts_receivable_items (
              product_id,
              quantity,
              unit_price,
              total_price,
              products (
                id,
                name,
                subgroup_id,
                function_type
              )
            ),
            accounts_receivable_installments (
              id,
              installment_number,
              due_date,
              amount,
              payment_date
            ),
            stores (name)
          `).in('store_id', selectedStores).gte('data_competencia', `${selectedYear}-01-01`).lte('data_competencia', `${selectedYear}-12-31`);
        accountsReceivableData = data || [];
        arError = error;

        // Para competência: também precisamos buscar juros/descontos de contas cuja 
        // competência pode estar em outro ano, mas o pagamento foi feito no ano selecionado
        // Buscar IDs das contas que têm pagamentos no ano selecionado
        const arAccountIdsFromPayments = [...new Set(arPaymentsData?.map(p => p.account_receivable_id) || [])];

        // Filtrar apenas IDs que não estão já nos dados buscados
        const existingArAccountIds = new Set(accountsReceivableData.map((a: any) => a.id));
        const missingArAccountIds = arAccountIdsFromPayments.filter(id => !existingArAccountIds.has(id));
        if (missingArAccountIds.length > 0) {
          // Buscar contas adicionais que têm pagamentos no ano mas competência em outro ano
          const {
            data: additionalArAccounts,
            error: additionalArError
          } = await supabase.from('accounts_receivable').select(`
              id,
              store_id,
              data_competencia,
              payment_date,
              accounts_receivable_items (
                product_id,
                quantity,
                unit_price,
                total_price,
                products (
                  id,
                  name,
                  subgroup_id,
                  function_type
                )
              ),
              accounts_receivable_installments (
                id,
                installment_number,
                due_date,
                amount,
                payment_date
              ),
              stores (name)
            `).in('id', missingArAccountIds).in('store_id', selectedStores);
          if (!additionalArError && additionalArAccounts) {
            // Marcar essas contas para processar APENAS juros/descontos, não itens normais
            additionalArAccounts.forEach((acc: any) => {
              acc._onlyInterestDiscount = true;
            });
            accountsReceivableData = [...accountsReceivableData, ...additionalArAccounts];
          }
        }
      }
      if (arError) throw arError;

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
      const storesWithoutData = selectedStores.filter(storeId => !cashControlByStore[storeId] && !accountsPayableByStore[storeId]);
      if (storesWithoutData.length > 0) {
        const storeNames = storesWithoutData.map(storeId => {
          const store = stores.find(s => s.id === storeId);
          return store?.name || 'Loja desconhecida';
        }).join(', ');
        toast({
          title: "Atenção: Dados não encontrados",
          description: `Não foram encontrados dados financeiros para as seguintes lojas no ano ${selectedYear}: ${storeNames}. Verifique se os dados foram cadastrados corretamente para essas lojas.`,
          variant: "default"
        });
      }
      if (apError) throw apError;

      // Agrupar dados por mês, loja e subgrupo
      const groupedData: Record<string, DREData> = {};

      // Processar dados do controle de caixa (FATURAMENTO)
      cashControlData?.forEach((cashControl: any) => {
        const {
          month,
          year
        } = getMonthAndYearFromDate(cashControl.date);

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
            const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
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
            const {
              month,
              year
            } = getMonthAndYearFromDate(account.payment_date);

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
                // Contas a pagar são débito por natureza
                const productFunctionType = item.products.function_type || 'debit';

                // Encontrar o item da estrutura que corresponde a este subgrupo
                const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);

                if (structureItem && value !== 0) {
                  if (!groupedData[key].values[structureItem.id]) {
                    groupedData[key].values[structureItem.id] = 0;
                  }
                  // Débito = negativo, Crédito = positivo
                  const signedValue = productFunctionType === 'debit' ? -value : value;
                  groupedData[key].values[structureItem.id] += signedValue;
                }
              }
            });
            return; // Já processou, não precisa processar parcelas
          }

          // Processar parcelas pagas
          const paidInstallments = account.accounts_payable_installments?.filter((installment: any) => installment.payment_date !== null && installment.payment_date !== undefined) || [];

          // Se não houver parcelas pagas, não processar esta conta
          if (paidInstallments.length === 0) {
            return;
          }

          // Separar itens normais de itens de juros/desconto
          const normalItems = account.accounts_payable_items?.filter((item: any) => item.product_id !== acrescimoProductId && item.product_id !== descontoProductId) || [];
          const interestDiscountItems = account.accounts_payable_items?.filter((item: any) => item.product_id === acrescimoProductId || item.product_id === descontoProductId) || [];

          // Calcular o valor base da conta (sem juros/descontos) para proporção correta
          const baseAccountAmount = normalItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total_price) || 0), 0);

          // Calcular o total de parcelas para saber a proporção de cada uma
          const totalInstallments = account.accounts_payable_installments?.length || 1;
          if (baseAccountAmount === 0 && interestDiscountItems.length === 0) {
            console.warn('Conta a pagar sem itens:', account.id);
            return;
          }

          // Para cada parcela paga, calcular a proporção dos itens normais
          // e lançar 100% dos juros/descontos apenas na primeira parcela que está sendo processada
          // (já que não temos como saber qual parcela gerou qual juros)

          // Abordagem: dividir os juros/descontos pelo número de parcelas pagas
          const totalPaidInstallments = paidInstallments.length;
          paidInstallments.forEach((installment: any) => {
            const {
              month,
              year
            } = getMonthAndYearFromDate(installment.payment_date);

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

            // Proporção desta parcela em relação ao total de parcelas
            // Cada parcela representa 1/N do valor base dos itens normais
            const installmentProportion = 1 / totalInstallments;

            // Processar itens normais proporcionalmente
            normalItems.forEach((item: any) => {
              if (item.products?.subgroup_id) {
                const subgroupId = item.products.subgroup_id;
                // Calcular o valor proporcional baseado na parcela paga
                const proportionalValue = (parseFloat(item.total_price) || 0) * installmentProportion;
                // Contas a pagar são débito por natureza
                const productFunctionType = item.products.function_type || 'debit';

                // Encontrar o item da estrutura que corresponde a este subgrupo
                const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                if (structureItem && proportionalValue > 0) {
                  if (!groupedData[key].values[structureItem.id]) {
                    groupedData[key].values[structureItem.id] = 0;
                  }
                  // Débito = negativo, Crédito = positivo
                  const signedValue = productFunctionType === 'debit' ? -proportionalValue : proportionalValue;
                  groupedData[key].values[structureItem.id] += signedValue;
                }
              }
            });

            // Processar juros/descontos da nova tabela accounts_payable_payments
            // Cada pagamento tem seus próprios juros/descontos com data correta
            const paymentRecord = paymentsByInstallmentId[installment.id];
            if (paymentRecord) {
              // Processar juros (acréscimo) se houver
              if (paymentRecord.interest_amount > 0 && paymentRecord.interest_product_id === acrescimoProductId) {
                // Buscar subgrupo do produto de acréscimo
                const interestItem = interestDiscountItems.find((item: any) => item.product_id === acrescimoProductId);
                if (interestItem?.products?.subgroup_id) {
                  const subgroupId = interestItem.products.subgroup_id;
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                  if (structureItem) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    // Juros: aplicar function_type do produto (debit = negativo, credit = positivo)
                    const productFunctionType = interestItem.products.function_type || 'debit';
                    const signedValue = productFunctionType === 'debit' ? -paymentRecord.interest_amount : paymentRecord.interest_amount;
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              }

              // Processar desconto se houver
              if (paymentRecord.discount_amount > 0 && paymentRecord.discount_product_id === descontoProductId) {
                // Buscar subgrupo do produto de desconto
                const discountItem = interestDiscountItems.find((item: any) => item.product_id === descontoProductId);
                if (discountItem?.products?.subgroup_id) {
                  const subgroupId = discountItem.products.subgroup_id;
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                  if (structureItem) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    // Desconto: aplicar function_type do produto (credit = positivo, debit = negativo)
                    const productFunctionType = discountItem.products.function_type || 'credit';
                    const signedValue = productFunctionType === 'credit' ? paymentRecord.discount_amount : -paymentRecord.discount_amount;
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              }
            } else {
              // Fallback: se não encontrar na nova tabela, usar a lógica legada
              // (para pagamentos feitos antes da nova estrutura)
              interestDiscountItems.forEach((item: any) => {
                if (item.products?.subgroup_id) {
                  const subgroupId = item.products.subgroup_id;
                  // Dividir o valor do juros/desconto pelo número de parcelas pagas
                  const dividedValue = (parseFloat(item.total_price) || 0) / totalPaidInstallments;
                  const productFunctionType = item.products.function_type || 'debit';

                  // Encontrar o item da estrutura que corresponde a este subgrupo
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                  if (structureItem && dividedValue !== 0) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    // Aplicar function_type: debit = negativo, credit = positivo
                    const signedValue = productFunctionType === 'debit' ? -dividedValue : dividedValue;
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              });
            }
          });
        } else {
          // Para regime de competência: usar data_competencia para itens normais
          // mas data de pagamento para juros/descontos

          // Separar itens normais de itens de juros/desconto
          const normalItems = account.accounts_payable_items?.filter((item: any) => item.product_id !== acrescimoProductId && item.product_id !== descontoProductId) || [];
          const interestDiscountItems = account.accounts_payable_items?.filter((item: any) => item.product_id === acrescimoProductId || item.product_id === descontoProductId) || [];

          // Processar itens normais pela data de competência
          // MAS apenas se a conta não for marcada para processar apenas juros/descontos
          if (normalItems.length > 0 && !account._onlyInterestDiscount) {
            const {
              month,
              year
            } = getMonthAndYearFromDate(account.data_competencia);

            // Verificar se o mês está selecionado
            if (selectedMonths.includes(month.toString()) && year === parseInt(selectedYear)) {
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
              normalItems.forEach((item: any) => {
                if (item.products?.subgroup_id) {
                  const subgroupId = item.products.subgroup_id;
                  const value = parseFloat(item.total_price) || 0;
                  // Contas a pagar são débito por natureza
                  // O function_type do produto define o sinal do valor
                  const productFunctionType = item.products.function_type || 'debit';

                  // Encontrar o item da estrutura que corresponde a este subgrupo
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                  if (structureItem && value !== 0) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    // Débito = negativo, Crédito = positivo
                    const signedValue = productFunctionType === 'debit' ? -value : value;
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              });
            }
          }

          // Processar juros/descontos pela data de pagamento
          // Se não houver parcelas, usar payment_date da conta principal
          // Se houver parcelas, usar payment_date de cada parcela paga
          if (interestDiscountItems.length > 0) {
            const hasInstallments = account.accounts_payable_installments && account.accounts_payable_installments.length > 0;
            if (hasInstallments) {
              // Parcelas: processar juros/descontos na data de pagamento de cada parcela paga
              const paidInstallments = account.accounts_payable_installments?.filter((installment: any) => installment.payment_date !== null && installment.payment_date !== undefined) || [];
              const totalPaidInstallments = paidInstallments.length;
              if (totalPaidInstallments > 0) {
                paidInstallments.forEach((installment: any) => {
                  const {
                    month,
                    year
                  } = getMonthAndYearFromDate(installment.payment_date);

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

                  // Usar dados da nova tabela accounts_payable_payments
                  const paymentRecord = paymentsByInstallmentId[installment.id];
                  if (paymentRecord) {
                    // Processar juros (acréscimo) se houver
                    if (paymentRecord.interest_amount > 0 && paymentRecord.interest_product_id === acrescimoProductId) {
                      const interestItem = interestDiscountItems.find((item: any) => item.product_id === acrescimoProductId);
                      if (interestItem?.products?.subgroup_id) {
                        const subgroupId = interestItem.products.subgroup_id;
                        const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                        if (structureItem) {
                          if (!groupedData[key].values[structureItem.id]) {
                            groupedData[key].values[structureItem.id] = 0;
                          }
                          // Juros: aplicar function_type do produto (debit = negativo, credit = positivo)
                          const productFunctionType = interestItem.products.function_type || 'debit';
                          const signedValue = productFunctionType === 'debit' ? -paymentRecord.interest_amount : paymentRecord.interest_amount;
                          groupedData[key].values[structureItem.id] += signedValue;
                        }
                      }
                    }

                    // Processar desconto se houver
                    if (paymentRecord.discount_amount > 0 && paymentRecord.discount_product_id === descontoProductId) {
                      const discountItem = interestDiscountItems.find((item: any) => item.product_id === descontoProductId);
                      if (discountItem?.products?.subgroup_id) {
                        const subgroupId = discountItem.products.subgroup_id;
                        const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                        if (structureItem) {
                          if (!groupedData[key].values[structureItem.id]) {
                            groupedData[key].values[structureItem.id] = 0;
                          }
                          // Desconto: aplicar function_type do produto (credit = positivo, debit = negativo)
                          const productFunctionType = discountItem.products.function_type || 'credit';
                          const signedValue = productFunctionType === 'credit' ? paymentRecord.discount_amount : -paymentRecord.discount_amount;
                          groupedData[key].values[structureItem.id] += signedValue;
                        }
                      }
                    }
                  } else {
                    // Fallback para lógica legada (pagamentos anteriores à nova tabela)
                    interestDiscountItems.forEach((item: any) => {
                      if (item.products?.subgroup_id) {
                        const subgroupId = item.products.subgroup_id;
                        const dividedValue = (parseFloat(item.total_price) || 0) / totalPaidInstallments;
                        const productFunctionType = item.products.function_type || 'debit';
                        const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                        if (structureItem && dividedValue !== 0) {
                          if (!groupedData[key].values[structureItem.id]) {
                            groupedData[key].values[structureItem.id] = 0;
                          }
                          // Aplicar function_type: debit = negativo, credit = positivo
                          const signedValue = productFunctionType === 'debit' ? -dividedValue : dividedValue;
                          groupedData[key].values[structureItem.id] += signedValue;
                        }
                      }
                    });
                  }
                });
              }
            } else {
              // Sem parcelas: usar payment_date da conta principal
              if (account.payment_date) {
                const {
                  month,
                  year
                } = getMonthAndYearFromDate(account.payment_date);

                // Verificar se o mês está selecionado
                if (selectedMonths.includes(month.toString()) && year === parseInt(selectedYear)) {
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
                  interestDiscountItems.forEach((item: any) => {
                    if (item.products?.subgroup_id) {
                      const subgroupId = item.products.subgroup_id;
                      const value = parseFloat(item.total_price) || 0;
                      const productFunctionType = item.products.function_type || 'debit';
                      const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                      if (structureItem && value !== 0) {
                        if (!groupedData[key].values[structureItem.id]) {
                          groupedData[key].values[structureItem.id] = 0;
                        }
                        // Aplicar function_type: debit = negativo, credit = positivo
                        const signedValue = productFunctionType === 'debit' ? -value : value;
                        groupedData[key].values[structureItem.id] += signedValue;
                      }
                    }
                  });
                }
              }
            }
          }
        }
      });

      // Processar contas a receber (RECEITAS)
      if (accountsReceivableData && accountsReceivableData.length > 0) {
        accountsReceivableData.forEach((account: any) => {
          if (isCashRegime) {
            // Para regime de caixa: processar baseado nas parcelas recebidas OU pagamento à vista

            // Verificar se é pagamento à vista (sem parcelas)
            const hasInstallments = account.accounts_receivable_installments && account.accounts_receivable_installments.length > 0;
            
            if (!hasInstallments && account.status === 'paid' && account.payment_date) {
              // Conta recebida à vista - processar o valor total
              const {
                month,
                year
              } = getMonthAndYearFromDate(account.payment_date);

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
              account.accounts_receivable_items?.forEach((item: any) => {
                if (item.products?.subgroup_id) {
                  const subgroupId = item.products.subgroup_id;
                  const value = parseFloat(item.total_price) || 0;
                  
                  // Verificar se é item de desconto do contas a receber
                  // Desconto dado no recebimento = reduz a receita = débito (negativo)
                  const isDescontoReceber = item.product_id === descontoReceberProductId;
                  
                  // Contas a receber são crédito por natureza
                  const productFunctionType = item.products.function_type || 'credit';

                  // Encontrar o item da estrutura que corresponde a este subgrupo
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);

                  if (structureItem && value !== 0) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    
                    let signedValue: number;
                    if (isDescontoReceber) {
                      // Desconto no recebimento é sempre débito (reduz receita)
                      signedValue = -Math.abs(value);
                    } else {
                      // Crédito = positivo, Débito = negativo
                      signedValue = productFunctionType === 'credit' ? value : -value;
                    }
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              });
              return; // Já processou, não precisa processar parcelas
            }

            // Processar parcelas recebidas
            const receivedInstallments = account.accounts_receivable_installments?.filter((installment: any) => 
              installment.payment_date !== null && installment.payment_date !== undefined
            ) || [];

            // Se não houver parcelas recebidas, não processar esta conta
            if (receivedInstallments.length === 0) {
              return;
            }

            // Separar itens normais de itens de juros/desconto (como no contas a pagar)
            const allItems = account.accounts_receivable_items || [];
            const normalItems = allItems.filter((item: any) => 
              item.product_id !== acrescimoReceberProductId && item.product_id !== descontoReceberProductId
            );
            const interestDiscountItems = allItems.filter((item: any) => 
              item.product_id === acrescimoReceberProductId || item.product_id === descontoReceberProductId
            );

            // Calcular o valor base da conta (sem juros/descontos) para proporção correta
            const baseAccountAmount = normalItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total_price) || 0), 0);

            // Calcular o total de parcelas para saber a proporção de cada uma
            const totalInstallments = account.accounts_receivable_installments?.length || 1;
            const totalReceivedInstallments = receivedInstallments.length;

            if (baseAccountAmount === 0 && interestDiscountItems.length === 0) {
              console.warn('Conta a receber sem itens:', account.id);
              return;
            }

            // Processar cada parcela recebida
            receivedInstallments.forEach((installment: any) => {
              const {
                month,
                year
              } = getMonthAndYearFromDate(installment.payment_date);

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

              // Proporção desta parcela em relação ao total de parcelas
              // Cada parcela representa 1/N do valor base dos itens normais
              const installmentProportion = 1 / totalInstallments;

              // Processar itens normais proporcionalmente
              normalItems.forEach((item: any) => {
                if (item.products?.subgroup_id) {
                  const subgroupId = item.products.subgroup_id;
                  // Calcular o valor proporcional baseado na parcela (1/N do valor total do item)
                  const proportionalValue = (parseFloat(item.total_price) || 0) * installmentProportion;
                  
                  const productFunctionType = item.products.function_type || 'credit';

                  // Encontrar o item da estrutura que corresponde a este subgrupo
                  const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);

                  if (structureItem && proportionalValue > 0) {
                    if (!groupedData[key].values[structureItem.id]) {
                      groupedData[key].values[structureItem.id] = 0;
                    }
                    // Crédito = positivo, Débito = negativo
                    const signedValue = productFunctionType === 'credit' ? proportionalValue : -proportionalValue;
                    groupedData[key].values[structureItem.id] += signedValue;
                  }
                }
              });

              // Processar juros/descontos usando a tabela accounts_receivable_payments
              // para obter o valor exato por parcela (igual ao contas a pagar)
              const paymentRecord = arPaymentsByInstallmentId[installment.id];
              
              if (paymentRecord) {
                // Processar juros (acréscimo) se houver
                if (paymentRecord.interest_amount > 0 && paymentRecord.interest_product_id === acrescimoReceberProductId) {
                  const interestItem = interestDiscountItems.find((item: any) => item.product_id === acrescimoReceberProductId);
                  if (interestItem?.products?.subgroup_id) {
                    const subgroupId = interestItem.products.subgroup_id;
                    const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                    if (structureItem) {
                      if (!groupedData[key].values[structureItem.id]) {
                        groupedData[key].values[structureItem.id] = 0;
                      }
                      // Acréscimo em contas a receber: credit = positivo (receita extra)
                      const productFunctionType = interestItem.products.function_type || 'credit';
                      const signedValue = productFunctionType === 'credit' ? paymentRecord.interest_amount : -paymentRecord.interest_amount;
                      groupedData[key].values[structureItem.id] += signedValue;
                    }
                  }
                }

                // Processar desconto se houver
                if (paymentRecord.discount_amount > 0 && paymentRecord.discount_product_id === descontoReceberProductId) {
                  const discountItem = interestDiscountItems.find((item: any) => item.product_id === descontoReceberProductId);
                  if (discountItem?.products?.subgroup_id) {
                    const subgroupId = discountItem.products.subgroup_id;
                    const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                    if (structureItem) {
                      if (!groupedData[key].values[structureItem.id]) {
                        groupedData[key].values[structureItem.id] = 0;
                      }
                      // Desconto em contas a receber: sempre débito (reduz a receita)
                      const signedValue = -Math.abs(paymentRecord.discount_amount);
                      groupedData[key].values[structureItem.id] += signedValue;
                    }
                  }
                }
              } else {
                // Fallback para lógica legada (pagamentos anteriores à nova tabela)
                // Dividir o valor do juros/desconto pelo número de parcelas recebidas
                interestDiscountItems.forEach((item: any) => {
                  if (item.products?.subgroup_id) {
                    const subgroupId = item.products.subgroup_id;
                    const dividedValue = (parseFloat(item.total_price) || 0) / totalReceivedInstallments;
                    
                    const isDescontoReceber = item.product_id === descontoReceberProductId;
                    const productFunctionType = item.products.function_type || 'credit';

                    const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);

                    if (structureItem && dividedValue !== 0) {
                      if (!groupedData[key].values[structureItem.id]) {
                        groupedData[key].values[structureItem.id] = 0;
                      }
                      
                      let signedValue: number;
                      if (isDescontoReceber) {
                        signedValue = -Math.abs(dividedValue);
                      } else {
                        signedValue = productFunctionType === 'credit' ? dividedValue : -dividedValue;
                      }
                      groupedData[key].values[structureItem.id] += signedValue;
                    }
                  }
                });
              }
            });
          } else {
            // Para regime de competência: usar data_competencia para itens normais
            // mas data de pagamento para juros/descontos (acréscimos/descontos)

            // Separar itens normais de itens de juros/desconto
            const normalItems = account.accounts_receivable_items?.filter((item: any) => 
              item.product_id !== acrescimoReceberProductId && item.product_id !== descontoReceberProductId
            ) || [];
            const interestDiscountItems = account.accounts_receivable_items?.filter((item: any) => 
              item.product_id === acrescimoReceberProductId || item.product_id === descontoReceberProductId
            ) || [];

            // Processar itens normais pela data de competência
            // MAS apenas se a conta não for marcada para processar apenas juros/descontos
            if (normalItems.length > 0 && !account._onlyInterestDiscount) {
              const {
                month,
                year
              } = getMonthAndYearFromDate(account.data_competencia);

              // Verificar se o mês está selecionado
              if (selectedMonths.includes(month.toString()) && year === parseInt(selectedYear)) {
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

                normalItems.forEach((item: any) => {
                  if (item.products?.subgroup_id) {
                    const subgroupId = item.products.subgroup_id;
                    const value = parseFloat(item.total_price) || 0;
                    // Contas a receber são crédito por natureza
                    const productFunctionType = item.products.function_type || 'credit';

                    // Encontrar o item da estrutura que corresponde a este subgrupo
                    const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                    if (structureItem && value !== 0) {
                      if (!groupedData[key].values[structureItem.id]) {
                        groupedData[key].values[structureItem.id] = 0;
                      }
                      // Crédito = positivo, Débito = negativo
                      const signedValue = productFunctionType === 'credit' ? value : -value;
                      groupedData[key].values[structureItem.id] += signedValue;
                    }
                  }
                });
              }
            }

            // Processar juros/descontos pela data de pagamento
            // Se houver parcelas, usar payment_date de cada parcela paga
            // Se não houver parcelas, usar payment_date da conta principal
            if (interestDiscountItems.length > 0) {
              const hasInstallments = account.accounts_receivable_installments && account.accounts_receivable_installments.length > 0;
              
              if (hasInstallments) {
                // Parcelas: processar juros/descontos na data de pagamento de cada parcela paga
                const paidInstallments = account.accounts_receivable_installments?.filter(
                  (installment: any) => installment.payment_date !== null && installment.payment_date !== undefined
                ) || [];
                const totalPaidInstallments = paidInstallments.length;

                if (totalPaidInstallments > 0) {
                  paidInstallments.forEach((installment: any) => {
                    const {
                      month,
                      year
                    } = getMonthAndYearFromDate(installment.payment_date);

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

                    // Usar dados da tabela accounts_receivable_payments
                    const paymentRecord = arPaymentsByInstallmentId[installment.id];
                    if (paymentRecord) {
                      // Processar juros (acréscimo) se houver
                      if (paymentRecord.interest_amount > 0 && paymentRecord.interest_product_id === acrescimoReceberProductId) {
                        const interestItem = interestDiscountItems.find((item: any) => item.product_id === acrescimoReceberProductId);
                        if (interestItem?.products?.subgroup_id) {
                          const subgroupId = interestItem.products.subgroup_id;
                          const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                          if (structureItem) {
                            if (!groupedData[key].values[structureItem.id]) {
                              groupedData[key].values[structureItem.id] = 0;
                            }
                            // Acréscimo em contas a receber: credit = positivo (receita extra)
                            const productFunctionType = interestItem.products.function_type || 'credit';
                            const signedValue = productFunctionType === 'credit' ? paymentRecord.interest_amount : -paymentRecord.interest_amount;
                            groupedData[key].values[structureItem.id] += signedValue;
                          }
                        }
                      }

                      // Processar desconto se houver
                      if (paymentRecord.discount_amount > 0 && paymentRecord.discount_product_id === descontoReceberProductId) {
                        const discountItem = interestDiscountItems.find((item: any) => item.product_id === descontoReceberProductId);
                        if (discountItem?.products?.subgroup_id) {
                          const subgroupId = discountItem.products.subgroup_id;
                          const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                          if (structureItem) {
                            if (!groupedData[key].values[structureItem.id]) {
                              groupedData[key].values[structureItem.id] = 0;
                            }
                            // Desconto em contas a receber: sempre débito (reduz a receita)
                            const signedValue = -Math.abs(paymentRecord.discount_amount);
                            groupedData[key].values[structureItem.id] += signedValue;
                          }
                        }
                      }
                    } else {
                      // Fallback para lógica legada (pagamentos anteriores à nova tabela)
                      interestDiscountItems.forEach((item: any) => {
                        if (item.products?.subgroup_id) {
                          const subgroupId = item.products.subgroup_id;
                          const dividedValue = (parseFloat(item.total_price) || 0) / totalPaidInstallments;
                          const productFunctionType = item.products.function_type || 'credit';

                          const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                          if (structureItem && dividedValue !== 0) {
                            if (!groupedData[key].values[structureItem.id]) {
                              groupedData[key].values[structureItem.id] = 0;
                            }
                            
                            let signedValue: number;
                            // Desconto em contas a receber = débito (negativo)
                            if (item.product_id === descontoReceberProductId) {
                              signedValue = -Math.abs(dividedValue);
                            } else {
                              // Acréscimo: aplicar function_type
                              signedValue = productFunctionType === 'credit' ? dividedValue : -dividedValue;
                            }
                            groupedData[key].values[structureItem.id] += signedValue;
                          }
                        }
                      });
                    }
                  });
                }
              } else {
                // Sem parcelas: usar payment_date da conta principal
                if (account.payment_date) {
                  const {
                    month,
                    year
                  } = getMonthAndYearFromDate(account.payment_date);

                  // Verificar se o mês está selecionado
                  if (selectedMonths.includes(month.toString()) && year === parseInt(selectedYear)) {
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

                    interestDiscountItems.forEach((item: any) => {
                      if (item.products?.subgroup_id) {
                        const subgroupId = item.products.subgroup_id;
                        const value = parseFloat(item.total_price) || 0;
                        const productFunctionType = item.products.function_type || 'credit';

                        const structureItem = structureItems.find(si => si.item_type === 'subgroup' && si.account_group_id === subgroupId);
                        if (structureItem && value !== 0) {
                          if (!groupedData[key].values[structureItem.id]) {
                            groupedData[key].values[structureItem.id] = 0;
                          }
                          
                          let signedValue: number;
                          // Desconto em contas a receber = débito (negativo)
                          if (item.product_id === descontoReceberProductId) {
                            signedValue = -Math.abs(value);
                          } else {
                            // Acréscimo: aplicar function_type
                            signedValue = productFunctionType === 'credit' ? value : -value;
                          }
                          groupedData[key].values[structureItem.id] += signedValue;
                        }
                      }
                    });
                  }
                }
              }
            }
          }
        });
      }

      // Buscar dados de estoque para itens de estoque inicial e final
      await loadStockData(groupedData);

      // Converter para array
      const formattedData: DREData[] = Object.values(groupedData);
      setDreData(formattedData);
      if (formattedData.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não foram encontradas contas a pagar para os filtros selecionados",
          variant: "default"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados DRE",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadStockData = async (groupedData: Record<string, DREData>) => {
    try {
      // Verificar se há itens de estoque na estrutura
      const stockItems = structureItems.filter(item => item.item_type === 'initial_stock' || item.item_type === 'final_stock');
      if (stockItems.length === 0) return;

      // Para cada combinação de loja/mês nos dados agrupados
      for (const [key, dreData] of Object.entries(groupedData)) {
        const {
          store_id,
          month,
          year
        } = dreData;

        // Para estoque inicial: buscar mês anterior ao selecionado
        const initialStockItems = stockItems.filter(item => item.item_type === 'initial_stock');
        if (initialStockItems.length > 0) {
          let initialMonth = month - 1;
          let initialYear = year;

          // Ajustar ano se necessário
          if (initialMonth <= 0) {
            initialMonth = 12;
            initialYear -= 1;
          }
          const {
            data: initialStockData,
            error: initialError
          } = await supabase.from('stock_control').select('total_value').eq('store_id', store_id).eq('month', initialMonth).eq('year', initialYear).single();
          if (initialError && initialError.code !== 'PGRST116') {
            console.error('Erro ao buscar estoque inicial:', initialError);
          }
          const initialStockValue = initialStockData?.total_value || 0;
          initialStockItems.forEach(item => {
            groupedData[key].values[item.id] = parseFloat(initialStockValue.toString());
          });
        }

        // Para estoque final: buscar o mês atual selecionado
        const finalStockItems = stockItems.filter(item => item.item_type === 'final_stock');
        if (finalStockItems.length > 0) {
          const {
            data: finalStockData,
            error: finalError
          } = await supabase.from('stock_control').select('total_value').eq('store_id', store_id).eq('month', month).eq('year', year).single();
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
        variant: "destructive"
      });
    }
  };
  const calculateGroupTotal = (groupId: string, data: DREData): number => {
    // Encontrar o grupo atual
    const currentGroupIndex = structureItems.findIndex(item => item.id === groupId);
    if (currentGroupIndex === -1) return 0;

    // Encontrar o próximo grupo após este
    const nextGroupIndex = structureItems.findIndex((item, index) => index > currentGroupIndex && item.item_type === 'group');

    // Pegar todos os itens entre este grupo e o próximo grupo (ou até o final)
    const endIndex = nextGroupIndex === -1 ? structureItems.length : nextGroupIndex;
    const itemsInGroup = structureItems.slice(currentGroupIndex + 1, endIndex).filter(item => item.item_type === 'subgroup' || item.item_type === 'initial_stock' || item.item_type === 'final_stock');
    return itemsInGroup.reduce((total, item) => {
      let value = 0;
      if (item.item_type === 'subgroup') {
        // Subgrupos: o valor já vem com o sinal correto (baseado no function_type do produto)
        value = data.values[item.id] || 0;
        return total + value;
      } else if (item.item_type === 'initial_stock' || item.item_type === 'final_stock') {
        // Estoques: aplicar operation_type da estrutura
        value = calculateStockTotal(item.id, data);
        return total + (item.operation_type === 'credit' ? value : -value);
      }
      return total;
    }, 0);
  };
  const calculateSumLineTotal = (sumLineId: string, data: DREData): number => {
    // Find the current sum line position
    const currentSumLineIndex = structureItems.findIndex(item => item.id === sumLineId);
    if (currentSumLineIndex === -1) return 0;

    // Sum all subgroups and stock items that are above this sum line
    const itemsAbove = structureItems.slice(0, currentSumLineIndex);
    return itemsAbove.reduce((total, item) => {
      if (item.item_type === 'subgroup') {
        // Subgrupos: o valor já vem com o sinal correto (baseado no function_type do produto)
        const value = data.values[item.id] || 0;
        return total + value;
      } else if (item.item_type === 'initial_stock' || item.item_type === 'final_stock') {
        // Estoques: aplicar operation_type da estrutura
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
        periodData.forEach(data => {
          headerRow1.push(monthName);
          headerRow2.push(data.store_name);
        });
      });
      exportData.push(headerRow1);
      exportData.push(headerRow2);

      // Dados das linhas
      structureItems.forEach(item => {
        const row = [item.item_type === 'sum_line' && item.description ? item.description : item.name];
        Object.entries(groupedData).forEach(([_, periodData]) => {
          periodData.forEach(data => {
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
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message,
        variant: "destructive"
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

      // Preparar dados para a tabela com metadados de estilo
      const tableHeaders: string[][] = [['Descrição'], ['']];
      const tableData: {
        content: string;
        styles?: any;
      }[][] = [];
      const rowMetadata: {
        itemType: string;
        isNegative: boolean[];
      }[] = [];

      // Cabeçalhos das colunas (duas linhas: período e loja)
      Object.entries(groupedData).forEach(([periodKey, periodData]) => {
        const [year, month] = periodKey.split('-');
        const monthName = `${getMonthName(parseInt(month))} ${year}`;
        periodData.forEach(data => {
          tableHeaders[0].push(monthName);
          tableHeaders[1].push(data.store_name);
        });
      });

      // Linhas de dados com metadados para estilização
      structureItems.forEach(item => {
        const row: {
          content: string;
          styles?: any;
        }[] = [];
        const rowNegatives: boolean[] = [];

        // Nome/descrição com indentação para subgrupos e itens de estoque
        let displayName = item.item_type === 'sum_line' && item.description ? item.description : item.name;

        // Adicionar espaçamento visual para subgrupos e itens de estoque
        const isSubItem = item.item_type === 'subgroup' || item.item_type === 'initial_stock' || item.item_type === 'final_stock';
        if (isSubItem) {
          displayName = '    ' + displayName; // Indentação para subgrupos
        }
        row.push({
          content: displayName
        });
        Object.entries(groupedData).forEach(([_, periodData]) => {
          periodData.forEach(data => {
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

            // Aplicar sinal negativo conforme operation_type
            let displayValue = value;
            if (item.operation_type === 'debit' && value !== 0) {
              displayValue = -Math.abs(value);
            }
            const isNegative = displayValue < 0;
            rowNegatives.push(isNegative);
            row.push({
              content: formatCurrency(displayValue)
            });
          });
        });
        tableData.push(row);
        rowMetadata.push({
          itemType: item.item_type,
          isNegative: rowNegatives
        });
      });

      // Adicionar tabela ao PDF
      autoTable(doc, {
        head: tableHeaders,
        body: tableData.map(row => row.map(cell => cell.content)),
        startY: 40,
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: {
            cellWidth: 'auto',
            minCellWidth: 50,
            halign: 'left'
          }
        },
        margin: {
          top: 40
        },
        didParseCell: function (data: any) {
          // Aplicar estilos personalizados nas células
          if (data.section === 'body') {
            const rowIndex = data.row.index;
            const colIndex = data.column.index;
            const metadata = rowMetadata[rowIndex];
            if (metadata) {
              // Negrito para grupos e linhas de soma
              if (metadata.itemType === 'group' || metadata.itemType === 'sum_line') {
                data.cell.styles.fontStyle = 'bold';
              }

              // Cor vermelha para valores negativos (colunas de valores, não a descrição)
              if (colIndex > 0) {
                const negativeIndex = colIndex - 1;
                if (metadata.isNegative[negativeIndex]) {
                  data.cell.styles.textColor = [220, 53, 69]; // Vermelho
                }
              }
            }
          }
        }
      });

      // Salvar PDF
      const fileName = `DRE_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast({
        title: "Exportação concluída",
        description: "Arquivo PDF baixado com sucesso",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Agrupar dados por mês, mantendo separação por loja
  const groupedDataUnsorted = dreData.reduce((acc, data) => {
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

  // Ordenar por ano e mês (janeiro a dezembro)
  const sortedEntries = Object.entries(groupedDataUnsorted).sort((a, b) => {
    const [yearA, monthA] = a[0].split('-').map(Number);
    const [yearB, monthB] = b[0].split('-').map(Number);
    if (yearA !== yearB) return yearA - yearB;
    return monthA - monthB;
  });

  const groupedData = Object.fromEntries(sortedEntries) as Record<string, DREData[]>;
  return <div className="space-y-6">
      <div>
        
        
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
                  {structures.map(structure => <SelectItem key={structure.id} value={structure.id}>
                      {structure.name}
                    </SelectItem>)}
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
                  {Array.from({
                  length: 5
                }, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>;
                })}
                </SelectContent>
              </Select>
            </div>

            {/* Lojas */}
            <div className="space-y-2">
              <Label>Lojas</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {stores.map(store => <div key={store.id} className="flex items-center space-x-2 mb-2">
                    <Checkbox id={`store-${store.id}`} checked={selectedStores.includes(store.id)} onCheckedChange={checked => handleStoreSelection(store.id, checked as boolean)} />
                    <label htmlFor={`store-${store.id}`} className="text-sm">
                      {store.name}
                    </label>
                  </div>)}
              </div>
            </div>

            {/* Meses */}
            <div className="space-y-2">
              <Label>Meses</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {months.map(month => <div key={month.value} className="flex items-center space-x-2 mb-2">
                    <Checkbox id={`month-${month.value}`} checked={selectedMonths.includes(month.value)} onCheckedChange={checked => handleMonthSelection(month.value, checked as boolean)} />
                    <label htmlFor={`month-${month.value}`} className="text-sm">
                      {month.label}
                    </label>
                  </div>)}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => window.history.back()}>
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

      {Object.keys(groupedData).length > 0 && <Card>
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
                  return <TableHead key={periodKey} colSpan={periodData.length} className="text-center">
                          {getMonthName(parseInt(month))} {year}
                        </TableHead>;
                })}
                  </TableRow>
                  <TableRow>
                    <TableHead></TableHead>
                    {Object.entries(groupedData).map(([periodKey, periodData]) => periodData.map((data, index) => <TableHead key={`${periodKey}-${index}`} className="text-center">
                          {data.store_name}
                        </TableHead>))}
                  </TableRow>
                </TableHeader>
                 <TableBody>
                   {structureItems.map(item => <TableRow key={item.id} className={`h-8 ${item.item_type === 'group' ? 'font-bold' : item.item_type === 'sum_line' ? 'bg-muted/70 font-bold' : ''}`}>
                       <TableCell className={`py-1 ${item.item_type === 'group' ? 'font-bold' : item.item_type === 'sum_line' ? 'font-bold' : item.item_type === 'subgroup' ? 'font-medium pl-6' : 'font-medium'}`}>
                         {item.item_type === 'sum_line' && item.description ? item.description : item.name}
                       </TableCell>
                       {Object.entries(groupedData).map(([periodKey, periodData]) => periodData.map((data, index) => <TableCell key={`${periodKey}-${index}`} className={`text-right py-1 ${item.item_type === 'group' || item.item_type === 'sum_line' ? 'font-bold' : ''} ${item.operation_type === 'debit' ? 'text-destructive' : ''}`}>
                              {item.item_type === 'subgroup' && formatCurrency(data.values[item.id] || 0)}
                              {item.item_type === 'group' && formatCurrency(calculateGroupTotal(item.id, data))}
                              {item.item_type === 'sum_line' && formatCurrency(calculateSumLineTotal(item.id, data))}
                              {(item.item_type === 'initial_stock' || item.item_type === 'final_stock') && formatCurrency(calculateStockTotal(item.id, data))}
                            </TableCell>))}
                     </TableRow>)}
                 </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>}

      {Object.keys(groupedData).length === 0 && !loading && <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
            <p className="text-muted-foreground">
              Verifique se existem DREs cadastrados para o período e lojas selecionadas.
            </p>
          </CardContent>
        </Card>}
    </div>;
};