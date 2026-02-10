import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, FileSpreadsheet, Download, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Store {
  id: string;
  name: string;
}

interface AccountGroup {
  id: string;
  name: string;
  code: string;
  account_type: 'receita' | 'despesa' | 'ativo' | 'passivo';
  parent_id: string | null;
}

interface ReportData {
  groupId: string;
  groupName: string;
  groupType: string;
  subgroups: {
    id: string;
    name: string;
    values: Record<string, number>; // key = column key (month/year/store combo)
  }[];
  totals: Record<string, number>;
}

const IncomeExpenseReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Filters
  const [regime, setRegime] = useState<'competencia' | 'pagamento'>('competencia');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  
  // Organization
  const [organizeBy, setOrganizeBy] = useState<'month' | 'year' | 'general'>('general');
  const [separateByStore, setSeparateByStore] = useState(false);
  
  // Data
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [columns, setColumns] = useState<{ key: string; label: string; storeId?: string; storeName?: string }[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

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
        const { data } = await supabase.from("stores").select("id, name").order('name');
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
          const { data } = await supabase.from("stores").select("id, name").in('id', storeIds).order('name');
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const handleStoreSelection = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores(prev => [...prev, storeId]);
    } else {
      setSelectedStores(prev => prev.filter(id => id !== storeId));
    }
  };

  const getMonthFromDate = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    return { month: parseInt(month), year: parseInt(year) };
  };

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const generateColumns = () => {
    const cols: { key: string; label: string; storeId?: string; storeName?: string }[] = [];
    const storeList = selectedStores.length > 0 
      ? stores.filter(s => selectedStores.includes(s.id))
      : stores;

    if (organizeBy === 'general') {
      if (separateByStore && storeList.length > 0) {
        storeList.forEach(store => {
          cols.push({ key: `general_${store.id}`, label: store.name, storeId: store.id, storeName: store.name });
        });
        cols.push({ key: 'general_total', label: 'Total' });
      } else {
        cols.push({ key: 'general', label: 'Total' });
      }
    } else if (organizeBy === 'month') {
      const start = getMonthFromDate(startDate);
      const end = getMonthFromDate(endDate);
      
      let currentYear = start.year;
      let currentMonth = start.month;
      
      while (currentYear < end.year || (currentYear === end.year && currentMonth <= end.month)) {
        const monthLabel = `${monthNames[currentMonth - 1]}/${currentYear}`;
        
        if (separateByStore && storeList.length > 0) {
          storeList.forEach(store => {
            cols.push({ 
              key: `${currentYear}_${currentMonth}_${store.id}`, 
              label: `${monthLabel} - ${store.name}`,
              storeId: store.id,
              storeName: store.name
            });
          });
        } else {
          cols.push({ key: `${currentYear}_${currentMonth}`, label: monthLabel });
        }
        
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
      
      if (separateByStore) {
        cols.push({ key: 'total', label: 'Total Geral' });
      }
    } else if (organizeBy === 'year') {
      const startYear = parseInt(startDate.split('-')[0]);
      const endYear = parseInt(endDate.split('-')[0]);
      
      for (let year = startYear; year <= endYear; year++) {
        if (separateByStore && storeList.length > 0) {
          storeList.forEach(store => {
            cols.push({ 
              key: `${year}_${store.id}`, 
              label: `${year} - ${store.name}`,
              storeId: store.id,
              storeName: store.name
            });
          });
        } else {
          cols.push({ key: `${year}`, label: `${year}` });
        }
      }
      
      if (separateByStore) {
        cols.push({ key: 'total', label: 'Total Geral' });
      }
    }

    return cols;
  };

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a data inicial e data final",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const generatedColumns = generateColumns();
      setColumns(generatedColumns);

      // Fetch groups and subgroups
      const { data: groups, error: groupsError } = await supabase
        .from('account_groups')
        .select('*')
        .is('parent_id', null)
        .in('account_type', ['receita', 'despesa'])
        .order('code');

      if (groupsError) throw groupsError;

      const { data: subgroups, error: subgroupsError } = await supabase
        .from('account_groups')
        .select('*')
        .not('parent_id', 'is', null)
        .order('code');

      if (subgroupsError) throw subgroupsError;

      // Fetch parameters for cash control mapping, interest/discount products, and aportes/retiradas
      const { data: params } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id, product_id')
        .in('parameter_key', [
          'venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery',
          'acrescimo_pagar', 'desconto_pagar', 'acrescimo_receber', 'desconto_receber',
          'aporte_socios', 'retirada_socios'
        ]);

      const faturamentoMapping: Record<string, string> = {};
      let acrescimoPagarProductId: string | null = null;
      let descontoPagarProductId: string | null = null;
      let acrescimoReceberProductId: string | null = null;
      let descontoReceberProductId: string | null = null;
      let aporteProductId: string | null = null;
      let retiradaProductId: string | null = null;

      params?.forEach(p => {
        if (p.subgroup_id) faturamentoMapping[p.parameter_key] = p.subgroup_id;
        if (p.parameter_key === 'acrescimo_pagar') acrescimoPagarProductId = p.product_id;
        if (p.parameter_key === 'desconto_pagar') descontoPagarProductId = p.product_id;
        if (p.parameter_key === 'acrescimo_receber') acrescimoReceberProductId = p.product_id;
        if (p.parameter_key === 'desconto_receber') descontoReceberProductId = p.product_id;
        if (p.parameter_key === 'aporte_socios') aporteProductId = p.product_id;
        if (p.parameter_key === 'retirada_socios') retiradaProductId = p.product_id;
      });

      // Fetch interest/discount and aportes/retiradas product subgroups
      const specialProductIds = [
        acrescimoPagarProductId, descontoPagarProductId,
        acrescimoReceberProductId, descontoReceberProductId,
        aporteProductId, retiradaProductId
      ].filter(Boolean) as string[];

      const { data: specialProducts } = specialProductIds.length > 0
        ? await supabase
            .from('products')
            .select('id, subgroup_id, function_type')
            .in('id', specialProductIds)
        : { data: [] };

      const getProductSubgroupId = (productId: string | null): string | null => {
        if (!productId) return null;
        const item = specialProducts?.find(p => p.id === productId);
        return item?.subgroup_id || null;
      };

      const getProductFunctionType = (productId: string | null): string => {
        if (!productId) return 'debit';
        const item = specialProducts?.find(p => p.id === productId);
        return item?.function_type || 'debit';
      };

      // Initialize values accumulator
      const subgroupValues: Record<string, Record<string, number>> = {};

      const storeFilter = selectedStores.length > 0 ? selectedStores : stores.map(s => s.id);

      // Fetch cash control data (revenues)
      const { data: cashControlData } = await supabase
        .from('cash_control')
        .select('store_id, date, faturamento_dinheiro, faturamento_cartao, faturamento_conta, faturamento_delivery')
        .in('store_id', storeFilter)
        .gte('date', startDate)
        .lte('date', endDate);

      // Process cash control data
      cashControlData?.forEach(cc => {
        const { month, year } = getMonthFromDate(cc.date);
        
        const revenues = {
          venda_dinheiro: parseFloat(cc.faturamento_dinheiro as any) || 0,
          venda_cartao: parseFloat(cc.faturamento_cartao as any) || 0,
          venda_contas: parseFloat(cc.faturamento_conta as any) || 0,
          venda_delivery: parseFloat(cc.faturamento_delivery as any) || 0,
        };

        Object.entries(revenues).forEach(([key, value]) => {
          const subgroupId = faturamentoMapping[key];
          if (subgroupId && value > 0) {
            if (!subgroupValues[subgroupId]) subgroupValues[subgroupId] = {};
            
            const columnKeys = getColumnKeysForEntry(year, month, cc.store_id, generatedColumns);
            columnKeys.forEach(colKey => {
              subgroupValues[subgroupId][colKey] = (subgroupValues[subgroupId][colKey] || 0) + value;
            });
          }
        });
      });

      // Fetch accounts payable/receivable based on regime
      if (regime === 'competencia') {
        // Accounts payable by competence - NORMAL ITEMS ONLY (exclude interest/discount)
        const { data: apData } = await supabase
          .from('accounts_payable')
          .select(`
            id, store_id, data_competencia,
            accounts_payable_items (
              product_id,
              total_price,
              products (subgroup_id)
            )
          `)
          .in('store_id', storeFilter)
          .gte('data_competencia', startDate)
          .lte('data_competencia', endDate);

        apData?.forEach(ap => {
          if (!ap.data_competencia) return;
          const { month, year } = getMonthFromDate(ap.data_competencia);
          
          // Filter out interest/discount items - they will be processed by payment date
          const normalItems = ap.accounts_payable_items?.filter((item: any) => 
            item.product_id !== acrescimoPagarProductId && 
            item.product_id !== descontoPagarProductId
          ) || [];
          
          normalItems.forEach((item: any) => {
            const subgroupId = item.products?.subgroup_id;
            if (subgroupId) {
              if (!subgroupValues[subgroupId]) subgroupValues[subgroupId] = {};
              const columnKeys = getColumnKeysForEntry(year, month, ap.store_id, generatedColumns);
              columnKeys.forEach(colKey => {
                subgroupValues[subgroupId][colKey] = (subgroupValues[subgroupId][colKey] || 0) + (item.total_price || 0);
              });
            }
          });
        });

        // Accounts receivable by competence - NORMAL ITEMS ONLY (exclude interest/discount)
        const { data: arData } = await supabase
          .from('accounts_receivable')
          .select(`
            id, store_id, data_competencia,
            accounts_receivable_items (
              product_id,
              total_price,
              products (subgroup_id)
            )
          `)
          .in('store_id', storeFilter)
          .gte('data_competencia', startDate)
          .lte('data_competencia', endDate);

        arData?.forEach(ar => {
          if (!ar.data_competencia) return;
          const { month, year } = getMonthFromDate(ar.data_competencia);
          
          // Filter out interest/discount items - they will be processed by payment date
          const normalItems = ar.accounts_receivable_items?.filter((item: any) => 
            item.product_id !== acrescimoReceberProductId && 
            item.product_id !== descontoReceberProductId
          ) || [];
          
          normalItems.forEach((item: any) => {
            const subgroupId = item.products?.subgroup_id;
            if (subgroupId) {
              if (!subgroupValues[subgroupId]) subgroupValues[subgroupId] = {};
              const columnKeys = getColumnKeysForEntry(year, month, ar.store_id, generatedColumns);
              columnKeys.forEach(colKey => {
                subgroupValues[subgroupId][colKey] = (subgroupValues[subgroupId][colKey] || 0) + (item.total_price || 0);
              });
            }
          });
        });

        // For competence regime: Interest and Discount must use PAYMENT DATE (not competence date)
        // Fetch AP payments for interest/discount
        const { data: apPaymentsCompetencia } = await supabase
          .from('accounts_payable_payments')
          .select(`
            payment_date, interest_amount, discount_amount,
            accounts_payable_installments!inner (
              accounts_payable!inner (store_id)
            )
          `)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        apPaymentsCompetencia?.forEach((payment: any) => {
          const storeId = payment.accounts_payable_installments?.accounts_payable?.store_id;
          if (!storeId || !storeFilter.includes(storeId)) return;
          
          const { month, year } = getMonthFromDate(payment.payment_date);
          const columnKeys = getColumnKeysForEntry(year, month, storeId, generatedColumns);

          // Interest (acréscimo) for AP
          if (payment.interest_amount > 0) {
            const interestSubgroupId = getProductSubgroupId(acrescimoPagarProductId);
            if (interestSubgroupId) {
              if (!subgroupValues[interestSubgroupId]) subgroupValues[interestSubgroupId] = {};
              columnKeys.forEach(colKey => {
                subgroupValues[interestSubgroupId][colKey] = (subgroupValues[interestSubgroupId][colKey] || 0) + payment.interest_amount;
              });
            }
          }

          // Discount (desconto) for AP - inverted sign
          if (payment.discount_amount > 0) {
            const discountSubgroupId = getProductSubgroupId(descontoPagarProductId);
            if (discountSubgroupId) {
              if (!subgroupValues[discountSubgroupId]) subgroupValues[discountSubgroupId] = {};
              columnKeys.forEach(colKey => {
                subgroupValues[discountSubgroupId][colKey] = (subgroupValues[discountSubgroupId][colKey] || 0) - payment.discount_amount;
              });
            }
          }
        });

        // Fetch AR payments for interest/discount
        const { data: arPaymentsCompetencia } = await supabase
          .from('accounts_receivable_payments')
          .select(`
            payment_date, interest_amount, discount_amount,
            accounts_receivable_installments!inner (
              accounts_receivable!inner (store_id)
            )
          `)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        arPaymentsCompetencia?.forEach((payment: any) => {
          const storeId = payment.accounts_receivable_installments?.accounts_receivable?.store_id;
          if (!storeId || !storeFilter.includes(storeId)) return;
          
          const { month, year } = getMonthFromDate(payment.payment_date);
          const columnKeys = getColumnKeysForEntry(year, month, storeId, generatedColumns);

          // Interest (acréscimo) for AR - inverted sign (opposite of AP)
          if (payment.interest_amount > 0) {
            const interestSubgroupId = getProductSubgroupId(acrescimoReceberProductId);
            if (interestSubgroupId) {
              if (!subgroupValues[interestSubgroupId]) subgroupValues[interestSubgroupId] = {};
              columnKeys.forEach(colKey => {
                subgroupValues[interestSubgroupId][colKey] = (subgroupValues[interestSubgroupId][colKey] || 0) - payment.interest_amount;
              });
            }
          }

          // Discount (desconto) for AR - positive sign (opposite of AP)
          if (payment.discount_amount > 0) {
            const discountSubgroupId = getProductSubgroupId(descontoReceberProductId);
            if (discountSubgroupId) {
              if (!subgroupValues[discountSubgroupId]) subgroupValues[discountSubgroupId] = {};
              columnKeys.forEach(colKey => {
                subgroupValues[discountSubgroupId][colKey] = (subgroupValues[discountSubgroupId][colKey] || 0) + payment.discount_amount;
              });
            }
          }
        });
      } else {
        // Payment regime - use payment dates from installments with proportional item values
        
        // Fetch AP installments with payments - need to get total installments count
        const { data: apInstallments } = await supabase
          .from('accounts_payable_installments')
          .select(`
            id, payment_date, amount, account_payable_id,
            accounts_payable!inner (
              id, store_id,
              accounts_payable_items (
                product_id,
                total_price,
                products (id, subgroup_id)
              )
            )
          `)
          .not('payment_date', 'is', null)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        // Get total installments count per account_payable
        const apIds = [...new Set(apInstallments?.map(i => i.account_payable_id) || [])];
        const { data: allApInstallments } = apIds.length > 0
          ? await supabase
              .from('accounts_payable_installments')
              .select('account_payable_id')
              .in('account_payable_id', apIds)
          : { data: [] };

        // Count total installments per AP
        const apInstallmentCounts: Record<string, number> = {};
        allApInstallments?.forEach(i => {
          apInstallmentCounts[i.account_payable_id] = (apInstallmentCounts[i.account_payable_id] || 0) + 1;
        });

        // Fetch AP payments for interest/discount
        const apInstallmentIds = apInstallments?.map(i => i.id) || [];
        const { data: apPayments } = apInstallmentIds.length > 0
          ? await supabase
              .from('accounts_payable_payments')
              .select('installment_id, interest_amount, interest_product_id, discount_amount, discount_product_id, payment_date')
              .in('installment_id', apInstallmentIds)
          : { data: [] };

        const apPaymentsByInstallmentId: Record<string, any> = {};
        apPayments?.forEach(p => {
          apPaymentsByInstallmentId[p.installment_id] = p;
        });

        apInstallments?.forEach((inst: any) => {
          if (!inst.payment_date) return;
          const ap = inst.accounts_payable;
          if (!ap || !storeFilter.includes(ap.store_id)) return;
          
          const { month, year } = getMonthFromDate(inst.payment_date);
          const columnKeys = getColumnKeysForEntry(year, month, ap.store_id, generatedColumns);

          // Calculate proportional value based on installment count (like DRE)
          const totalInstallments = apInstallmentCounts[ap.id] || 1;
          const installmentProportion = 1 / totalInstallments;

          // Separate normal items from interest/discount items (like DRE does)
          const normalItems = ap.accounts_payable_items?.filter((item: any) => 
            item.product_id !== acrescimoPagarProductId && 
            item.product_id !== descontoPagarProductId
          ) || [];

          // Process ONLY normal items with proportional amount
          normalItems.forEach((item: any) => {
            const subgroupId = item.products?.subgroup_id;
            if (subgroupId) {
              if (!subgroupValues[subgroupId]) subgroupValues[subgroupId] = {};
              const proportionalValue = (parseFloat(item.total_price) || 0) * installmentProportion;
              columnKeys.forEach(colKey => {
                subgroupValues[subgroupId][colKey] = (subgroupValues[subgroupId][colKey] || 0) + proportionalValue;
              });
            }
          });

          // Process interest/discount from payment record with EXACT values (not proportional)
          const paymentRecord = apPaymentsByInstallmentId[inst.id];
          if (paymentRecord) {
            // Interest (acréscimo) for AP - exact value from payment record
            if (paymentRecord.interest_amount > 0) {
              const interestSubgroupId = getProductSubgroupId(acrescimoPagarProductId);
              if (interestSubgroupId) {
                if (!subgroupValues[interestSubgroupId]) subgroupValues[interestSubgroupId] = {};
                columnKeys.forEach(colKey => {
                  subgroupValues[interestSubgroupId][colKey] = (subgroupValues[interestSubgroupId][colKey] || 0) + paymentRecord.interest_amount;
                });
              }
            }

            // Discount (desconto) for AP - exact value from payment record (inverted sign)
            if (paymentRecord.discount_amount > 0) {
              const discountSubgroupId = getProductSubgroupId(descontoPagarProductId);
              if (discountSubgroupId) {
                if (!subgroupValues[discountSubgroupId]) subgroupValues[discountSubgroupId] = {};
                columnKeys.forEach(colKey => {
                  subgroupValues[discountSubgroupId][colKey] = (subgroupValues[discountSubgroupId][colKey] || 0) - paymentRecord.discount_amount;
                });
              }
            }
          }
        });

        // Fetch AR installments with payments
        const { data: arInstallments } = await supabase
          .from('accounts_receivable_installments')
          .select(`
            id, payment_date, amount, account_receivable_id,
            accounts_receivable!inner (
              id, store_id,
              accounts_receivable_items (
                product_id,
                total_price,
                products (id, subgroup_id)
              )
            )
          `)
          .not('payment_date', 'is', null)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        // Get total installments count per account_receivable
        const arIds = [...new Set(arInstallments?.map(i => i.account_receivable_id) || [])];
        const { data: allArInstallments } = arIds.length > 0
          ? await supabase
              .from('accounts_receivable_installments')
              .select('account_receivable_id')
              .in('account_receivable_id', arIds)
          : { data: [] };

        // Count total installments per AR
        const arInstallmentCounts: Record<string, number> = {};
        allArInstallments?.forEach(i => {
          arInstallmentCounts[i.account_receivable_id] = (arInstallmentCounts[i.account_receivable_id] || 0) + 1;
        });

        // Fetch AR payments for interest/discount
        const arInstallmentIds = arInstallments?.map(i => i.id) || [];
        const { data: arPayments } = arInstallmentIds.length > 0
          ? await supabase
              .from('accounts_receivable_payments')
              .select('installment_id, interest_amount, interest_product_id, discount_amount, discount_product_id, payment_date')
              .in('installment_id', arInstallmentIds)
          : { data: [] };

        const arPaymentsByInstallmentId: Record<string, any> = {};
        arPayments?.forEach(p => {
          arPaymentsByInstallmentId[p.installment_id] = p;
        });

        arInstallments?.forEach((inst: any) => {
          if (!inst.payment_date) return;
          const ar = inst.accounts_receivable;
          if (!ar || !storeFilter.includes(ar.store_id)) return;
          
          const { month, year } = getMonthFromDate(inst.payment_date);
          const columnKeys = getColumnKeysForEntry(year, month, ar.store_id, generatedColumns);

          // Calculate proportional value based on installment count (like DRE)
          const totalInstallments = arInstallmentCounts[ar.id] || 1;
          const installmentProportion = 1 / totalInstallments;

          // Separate normal items from interest/discount items (like DRE does)
          const normalItems = ar.accounts_receivable_items?.filter((item: any) => 
            item.product_id !== acrescimoReceberProductId && 
            item.product_id !== descontoReceberProductId
          ) || [];

          // Process ONLY normal items with proportional amount
          normalItems.forEach((item: any) => {
            const subgroupId = item.products?.subgroup_id;
            if (subgroupId) {
              if (!subgroupValues[subgroupId]) subgroupValues[subgroupId] = {};
              const proportionalValue = (parseFloat(item.total_price) || 0) * installmentProportion;
              columnKeys.forEach(colKey => {
                subgroupValues[subgroupId][colKey] = (subgroupValues[subgroupId][colKey] || 0) + proportionalValue;
              });
            }
          });

          // Process interest/discount from payment record with EXACT values (not proportional)
          const paymentRecord = arPaymentsByInstallmentId[inst.id];
          if (paymentRecord) {
            // Interest (acréscimo) for AR - inverted sign (opposite of AP)
            if (paymentRecord.interest_amount > 0) {
              const interestSubgroupId = getProductSubgroupId(acrescimoReceberProductId);
              if (interestSubgroupId) {
                if (!subgroupValues[interestSubgroupId]) subgroupValues[interestSubgroupId] = {};
                columnKeys.forEach(colKey => {
                  subgroupValues[interestSubgroupId][colKey] = (subgroupValues[interestSubgroupId][colKey] || 0) - paymentRecord.interest_amount;
                });
              }
            }

            // Discount (desconto) for AR - positive sign (opposite of AP)
            if (paymentRecord.discount_amount > 0) {
              const discountSubgroupId = getProductSubgroupId(descontoReceberProductId);
              if (discountSubgroupId) {
                if (!subgroupValues[discountSubgroupId]) subgroupValues[discountSubgroupId] = {};
                columnKeys.forEach(colKey => {
                  subgroupValues[discountSubgroupId][colKey] = (subgroupValues[discountSubgroupId][colKey] || 0) + paymentRecord.discount_amount;
                });
              }
            }
          }
        });
      }

      // Process partner transactions (aportes and retiradas)
      // Use competence_date for competencia regime, payment_date for pagamento regime
      const partnerDateField = regime === 'competencia' ? 'competence_date' : 'payment_date';
      const { data: partnerTransactions } = await supabase
        .from('partner_transactions')
        .select('store_id, payment_date, competence_date, amount, transaction_type')
        .in('store_id', storeFilter)
        .gte(partnerDateField, startDate)
        .lte(partnerDateField, endDate);

      partnerTransactions?.forEach(transaction => {
        const dateToUse = regime === 'competencia' 
          ? transaction.competence_date 
          : transaction.payment_date;
        
        if (!dateToUse) return;
        
        const { month, year } = getMonthFromDate(dateToUse);
        const columnKeys = getColumnKeysForEntry(year, month, transaction.store_id, generatedColumns);

        if (transaction.transaction_type === 'aporte') {
          // Aporte is credit - use the subgroup from the configured aporte product
          const aporteSubgroupId = getProductSubgroupId(aporteProductId);
          if (aporteSubgroupId) {
            if (!subgroupValues[aporteSubgroupId]) subgroupValues[aporteSubgroupId] = {};
            columnKeys.forEach(colKey => {
              subgroupValues[aporteSubgroupId][colKey] = (subgroupValues[aporteSubgroupId][colKey] || 0) + transaction.amount;
            });
          }
        } else if (transaction.transaction_type === 'retirada') {
          // Retirada is debit - use the subgroup from the configured retirada product
          const retiradaSubgroupId = getProductSubgroupId(retiradaProductId);
          if (retiradaSubgroupId) {
            if (!subgroupValues[retiradaSubgroupId]) subgroupValues[retiradaSubgroupId] = {};
            columnKeys.forEach(colKey => {
              subgroupValues[retiradaSubgroupId][colKey] = (subgroupValues[retiradaSubgroupId][colKey] || 0) + transaction.amount;
            });
          }
        }
      });

      // Build report data - organize by account_type: receita first, then despesa
      const reportRows: ReportData[] = [];
      
      // Sort groups: receita first, then despesa
      const sortedGroups = (groups || []).sort((a, b) => {
        if (a.account_type === 'receita' && b.account_type !== 'receita') return -1;
        if (a.account_type !== 'receita' && b.account_type === 'receita') return 1;
        return a.code.localeCompare(b.code);
      });

      sortedGroups.forEach(group => {
        const groupSubgroups = (subgroups || []).filter(sg => sg.parent_id === group.id);
        
        const subgroupData = groupSubgroups.map(sg => ({
          id: sg.id,
          name: sg.name,
          values: subgroupValues[sg.id] || {}
        }));

        // Calculate group totals
        const groupTotals: Record<string, number> = {};
        generatedColumns.forEach(col => {
          groupTotals[col.key] = subgroupData.reduce((sum, sg) => sum + (sg.values[col.key] || 0), 0);
        });

        // Only add groups that have values
        const hasValues = Object.values(groupTotals).some(v => v > 0);
        if (hasValues || subgroupData.some(sg => Object.values(sg.values).some(v => v > 0))) {
          reportRows.push({
            groupId: group.id,
            groupName: group.name,
            groupType: group.account_type,
            subgroups: subgroupData.filter(sg => Object.values(sg.values).some(v => v > 0)),
            totals: groupTotals
          });
        }
      });

      setReportData(reportRows);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getColumnKeysForEntry = (year: number, month: number, storeId: string, cols: typeof columns): string[] => {
    const keys: string[] = [];

    if (organizeBy === 'general') {
      if (separateByStore) {
        keys.push(`general_${storeId}`);
        keys.push('general_total');
      } else {
        keys.push('general');
      }
    } else if (organizeBy === 'month') {
      if (separateByStore) {
        keys.push(`${year}_${month}_${storeId}`);
        keys.push('total');
      } else {
        keys.push(`${year}_${month}`);
      }
    } else if (organizeBy === 'year') {
      if (separateByStore) {
        keys.push(`${year}_${storeId}`);
        keys.push('total');
      } else {
        keys.push(`${year}`);
      }
    }

    return keys.filter(k => cols.some(c => c.key === k));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.text('Relatório de Entradas e Saídas', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Regime: ${regime === 'competencia' ? 'Competência' : 'Pagamento'}`, 14, 22);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 27);
    
    const tableData: any[] = [];
    
    reportData.forEach(group => {
      // Add group row
      const groupRow = [{ content: group.groupName, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }];
      columns.forEach(col => {
        groupRow.push({ content: formatCurrency(group.totals[col.key] || 0), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } });
      });
      tableData.push(groupRow);
      
      // Add subgroup rows
      group.subgroups.forEach(sg => {
        const sgRow = [`  ${sg.name}`];
        columns.forEach(col => {
          sgRow.push(formatCurrency(sg.values[col.key] || 0));
        });
        tableData.push(sgRow);
      });
    });

    autoTable(doc, {
      head: [['Grupo / Subgrupo', ...columns.map(c => c.label)]],
      body: tableData,
      startY: 32,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save('relatorio-entradas-saidas.pdf');
  };

  const exportToExcel = () => {
    const wsData: any[] = [];
    
    // Header
    wsData.push(['Grupo / Subgrupo', ...columns.map(c => c.label)]);
    
    reportData.forEach(group => {
      // Group row
      wsData.push([group.groupName, ...columns.map(col => group.totals[col.key] || 0)]);
      
      // Subgroup rows
      group.subgroups.forEach(sg => {
        wsData.push([`  ${sg.name}`, ...columns.map(col => sg.values[col.key] || 0)]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entradas e Saídas');
    XLSX.writeFile(wb, 'relatorio-entradas-saidas.xlsx');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Relatório de Entradas e Saídas</h1>
            <p className="text-sm text-muted-foreground">Análise de receitas e despesas por grupo e subgrupo</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Regime Selection */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Tipo de Regime *</Label>
              <RadioGroup value={regime} onValueChange={(v) => setRegime(v as 'competencia' | 'pagamento')} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="competencia" id="competencia" />
                  <Label htmlFor="competencia">Competência</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pagamento" id="pagamento" />
                  <Label htmlFor="pagamento">Pagamento</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inicial *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Store Selection */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Lojas (opcional - deixe vazio para todas)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {stores.map(store => (
                  <div key={store.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={(checked) => handleStoreSelection(store.id, checked as boolean)}
                    />
                    <Label htmlFor={`store-${store.id}`} className="text-sm">{store.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Organization Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-base font-semibold mb-3 block">Organizar por</Label>
                <Select value={organizeBy} onValueChange={(v) => setOrganizeBy(v as 'month' | 'year' | 'general')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral (valor total)</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-base font-semibold mb-3 block">Separar por loja?</Label>
                <RadioGroup value={separateByStore ? 'yes' : 'no'} onValueChange={(v) => setSeparateByStore(v === 'yes')} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="separate-no" />
                    <Label htmlFor="separate-no">Não</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="separate-yes" />
                    <Label htmlFor="separate-yes">Sim</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto">
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Carregando...' : 'Gerar Relatório'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Resultado</CardTitle>
              {reportData.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              {reportData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado para os filtros selecionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Grupo / Subgrupo</TableHead>
                        {columns.map(col => (
                          <TableHead key={col.key} className="text-right min-w-[120px]">{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map(group => (
                        <React.Fragment key={group.groupId}>
                          {/* Group Row */}
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell className="font-bold">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${group.groupType === 'receita' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {group.groupName}
                            </TableCell>
                            {columns.map(col => (
                              <TableCell key={col.key} className="text-right font-bold">
                                {formatCurrency(group.totals[col.key] || 0)}
                              </TableCell>
                            ))}
                          </TableRow>
                          {/* Subgroup Rows */}
                          {group.subgroups.map(sg => (
                            <TableRow key={sg.id}>
                              <TableCell className="pl-8">{sg.name}</TableCell>
                              {columns.map(col => (
                                <TableCell key={col.key} className="text-right">
                                  {formatCurrency(sg.values[col.key] || 0)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                      {/* Summary Row: Entradas - Saídas */}
                      <TableRow className="bg-primary/10 font-bold border-t-2 border-primary">
                        <TableCell className="font-bold text-primary">
                          RESULTADO (Entradas - Saídas)
                        </TableCell>
                        {columns.map(col => {
                          const totalEntradas = reportData
                            .filter(g => g.groupType === 'receita')
                            .reduce((sum, g) => sum + (g.totals[col.key] || 0), 0);
                          const totalSaidas = reportData
                            .filter(g => g.groupType === 'despesa')
                            .reduce((sum, g) => sum + (g.totals[col.key] || 0), 0);
                          const resultado = totalEntradas - totalSaidas;
                          return (
                            <TableCell 
                              key={col.key} 
                              className={`text-right font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {formatCurrency(resultado)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default IncomeExpenseReport;
