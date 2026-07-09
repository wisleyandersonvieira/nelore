import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download, Filter, FileDown, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { fetchRecipientAllocationOptions, fetchSemenAllocationOptions } from "@/lib/financialAllocations";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { createPdfReportLayout, type PdfSummaryCard, type TotalizerItem } from "@/lib/pdfReportLayout";

const PaidAccountsReport = () => {
  const navigate = useNavigate();
  
  // Function to convert date input to local timezone format - prevents timezone issues
  const formatDateForDatabase = (dateString: string): string => {
    if (!dateString) return dateString;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Parse the date string and format properly
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return dateString;
  };

  const [filters, setFilters] = useState({
    payment_start: "",
    payment_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    supplier_id: "all",
    store_id: "all",
    product_id: "all",
    account_id: "all",
    group_id: "all",
    employee_id: "all",
  });

  const [accounts, setAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [allocationType, setAllocationType] = useState<string>("none");
  const [allocationItems, setAllocationItems] = useState<Array<{ id: string; name: string; code?: number }>>([]);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<string[]>([]);
  const [allocationPopoverOpen, setAllocationPopoverOpen] = useState(false);
  const [allocationSearch, setAllocationSearch] = useState("");

  useEffect(() => {
    setSelectedAllocationIds([]);
    setAllocationItems([]);
    setAllocationSearch("");
    if (allocationType === "none") return;
    const load = async () => {
      if (allocationType === "aspiration") {
        const { data } = await supabase.from("aspiration_management").select("id, name, code").order("code", { ascending: false });
        setAllocationItems((data || []).map((d: any) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "pregnancy") {
        const { data } = await supabase.from("pregnancy_management").select("id, name, code").order("code", { ascending: false });
        setAllocationItems((data || []).map((d: any) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "animal") {
        const recipientCategoryIds = await fetchRecipientCategoryIds();
        const { data } = await (recipientCategoryIds.length > 0
          ? supabase.from("animals").select("id, name, code").not("category_id", "in", `("${recipientCategoryIds.join('","')}")`).order("code", { ascending: false })
          : supabase.from("animals").select("id, name, code").order("code", { ascending: false }));
        setAllocationItems((data || []).map((d: any) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "recipient") {
        const data = await fetchRecipientAllocationOptions();
        setAllocationItems(data.map((d) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "semen") {
        const data = await fetchSemenAllocationOptions();
        setAllocationItems(data.map((d) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      }
    };
    load();
  }, [allocationType]);

  useEffect(() => {
    fetchSuppliers();
    fetchStores();
    fetchProducts();
    fetchGroups();
    fetchEmployees();
  }, []);

  // Fetch available accounts when store is selected
  useEffect(() => {
    if (filters.store_id && filters.store_id !== "all") {
      fetchAccountsForStore(filters.store_id);
    } else {
      setAvailableAccounts([]);
      setFilters(prev => ({ ...prev, account_id: "all" }));
    }
  }, [filters.store_id]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name");
    setSuppliers(data || []);
  };

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

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name");
    setProducts(data || []);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("account_groups")
      .select("id, name, code")
      .is("parent_id", null)
      .order("code");
    setGroups(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setEmployees(data || []);
  };

  const fetchAccountsForStore = async (storeId: string) => {
    try {
      const allAccounts: any[] = [];

      // Fetch cash accounts for the store
      const { data: cashAccountStores } = await supabase
        .from("cash_account_stores")
        .select("account_id, cash_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (cashAccountStores) {
        cashAccountStores.forEach((cas: any) => {
          if (cas.cash_accounts) {
            allAccounts.push({
              id: cas.cash_accounts.id,
              name: cas.cash_accounts.name,
              type: "Caixa"
            });
          }
        });
      }

      // Fetch current accounts for the store
      const { data: currentAccountStores } = await supabase
        .from("current_account_stores")
        .select("account_id, current_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (currentAccountStores) {
        currentAccountStores.forEach((cas: any) => {
          if (cas.current_accounts) {
            allAccounts.push({
              id: cas.current_accounts.id,
              name: cas.current_accounts.name,
              type: "Conta Corrente"
            });
          }
        });
      }

      // Fetch card accounts for the store
      const { data: cardAccountStores } = await supabase
        .from("card_account_stores")
        .select("account_id, card_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (cardAccountStores) {
        cardAccountStores.forEach((cas: any) => {
          if (cas.card_accounts) {
            allAccounts.push({
              id: cas.card_accounts.id,
              name: cas.card_accounts.name,
              type: "Cartão"
            });
          }
        });
      }

      setAvailableAccounts(allAccounts);
    } catch (error) {
      console.error("Error fetching accounts for store:", error);
      setAvailableAccounts([]);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const toEndOfDayIso = (date: string) => `${date}T23:59:59.999`;
      // Using shared fetchAllPaginated utility to avoid Supabase 1000-row limit

      let accountIdsByProduct: string[] | null = null;
      if (filters.product_id && filters.product_id !== "all") {
        const { data: productItems } = await supabase
          .from("accounts_payable_items")
          .select("account_payable_id")
          .eq("product_id", filters.product_id);
        const uniqueIds = Array.from(new Set((productItems || []).map((item) => item.account_payable_id)));
        if (uniqueIds.length === 0) {
          setAccounts([]);
          toast({
            title: "Pesquisa realizada",
            description: "0 conta(s) encontrada(s)",
          });
          return;
        }
        accountIdsByProduct = uniqueIds;
      }

      let accountIdsByPaymentAccount: string[] | null = null;
      if (filters.account_id && filters.account_id !== "all") {
        const { data: transactions } = await supabase
          .from("financial_transactions")
          .select("reference_id")
          .eq("reference_type", "accounts_payable")
          .eq("account_id", filters.account_id);

        const uniqueIds = Array.from(new Set((transactions || []).map((tx) => tx.reference_id).filter(Boolean)));
        if (uniqueIds.length === 0) {
          setAccounts([]);
          toast({
            title: "Pesquisa realizada",
            description: "0 conta(s) encontrada(s)",
          });
          return;
        }
        accountIdsByPaymentAccount = uniqueIds;
      }

      let accountIdsByAllocation: string[] | null = null;
      if (allocationType !== "none" && selectedAllocationIds.length > 0) {
        let allocationQuery = supabase
          .from("accounts_payable_item_allocations")
          .select("account_payable_item_id");
        if (allocationType === "aspiration") allocationQuery = allocationQuery.in("aspiration_id", selectedAllocationIds);
        else if (allocationType === "pregnancy") allocationQuery = allocationQuery.in("pregnancy_id", selectedAllocationIds);
        else if (allocationType === "animal") allocationQuery = allocationQuery.in("animal_id", selectedAllocationIds);
        else if (allocationType === "recipient") allocationQuery = allocationQuery.in("recipient_id", selectedAllocationIds);
        else if (allocationType === "semen") allocationQuery = allocationQuery.in("semen_id", selectedAllocationIds);

        const { data: allocations } = await allocationQuery;
        const itemIds = allocations?.map((a: any) => a.account_payable_item_id) || [];
        if (itemIds.length === 0) {
          setAccounts([]);
          toast({ title: "Pesquisa realizada", description: "0 conta(s) encontrada(s)" });
          return;
        }
        const { data: items } = await supabase
          .from("accounts_payable_items")
          .select("account_payable_id")
          .in("id", itemIds);
        const uniqueIds = Array.from(new Set((items || []).map((i: any) => i.account_payable_id)));
        if (uniqueIds.length === 0) {
          setAccounts([]);
          toast({ title: "Pesquisa realizada", description: "0 conta(s) encontrada(s)" });
          return;
        }
        accountIdsByAllocation = uniqueIds;
      }

      let accountIdsToFilter: string[] | null = null;
      const idSources = [accountIdsByProduct, accountIdsByPaymentAccount, accountIdsByAllocation].filter((x): x is string[] => x !== null);
      if (idSources.length > 0) {
        accountIdsToFilter = idSources.reduce((acc, cur) => {
          const set = new Set(cur);
          return acc.filter((id) => set.has(id));
        });
      }

      if (accountIdsToFilter && accountIdsToFilter.length === 0) {
        setAccounts([]);
        toast({
          title: "Pesquisa realizada",
          description: "0 conta(s) encontrada(s)",
        });
        return;
      }

      // Fetch paid accounts with automatic pagination
      const buildAccountsQuery = () => {
        let q = supabase
          .from("accounts_payable")
          .select(`
            *,
            suppliers(id, name),
            employees(id, name),
            stores(id, name),
            accounts_payable_installments(*),
            accounts_payable_items(
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              products(id, name, subgroup_id, account_groups:subgroup_id(id, name, parent_id))
            )
          `)
          .in('status', ['paid', 'partial']);

        if (filters.store_id && filters.store_id !== "all") {
          q = q.eq('store_id', filters.store_id);
        }
        if (filters.supplier_id && filters.supplier_id !== "all") {
          q = q.eq('supplier_id', filters.supplier_id);
        }
        if (filters.employee_id && filters.employee_id !== "all") {
          q = q.eq('employee_id', filters.employee_id);
        }
        if (filters.competencia_start) {
          q = q.gte("data_competencia", filters.competencia_start);
        }
        if (filters.competencia_end) {
          q = q.lte("data_competencia", filters.competencia_end);
        }
        if (filters.created_start) {
          q = q.gte("created_at", filters.created_start);
        }
        if (filters.created_end) {
          q = q.lte("created_at", toEndOfDayIso(filters.created_end));
        }
        if (accountIdsToFilter && accountIdsToFilter.length > 0) {
          q = q.in("id", accountIdsToFilter);
        }
        return q;
      };

      const allAccounts = await fetchAllPaginated(buildAccountsQuery);

      const accountIds = Array.from(new Set((allAccounts || []).map((account: any) => account.id)));
      if (accountIds.length === 0) {
        setAccounts([]);
        toast({
          title: "Pesquisa realizada",
          description: "0 conta(s) encontrada(s)",
        });
        return;
      }

      // Fetch payments data with automatic pagination
      const paymentsData = await fetchAllPaginated(() =>
        supabase
          .from("accounts_payable_payments")
          .select(`
            *,
            interest_product:interest_product_id(id, name, subgroup_id, account_groups:subgroup_id(id, name)),
            discount_product:discount_product_id(id, name, subgroup_id, account_groups:subgroup_id(id, name))
          `)
          .in("account_payable_id", accountIds)
      );

      // Create a map of payments by installment_id
      const paymentsByInstallmentId: { [key: string]: any } = {};
      (paymentsData || []).forEach((payment: any) => {
        paymentsByInstallmentId[payment.installment_id] = payment;
      });

      // Expand installments into individual rows
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        
        if (account.accounts_payable_installments && account.accounts_payable_installments.length > 0) {
          // Has installments - create one row per paid installment
          account.accounts_payable_installments.forEach((installment: any) => {
            if (installment.payment_date) { // Only paid installments
              const payment = paymentsByInstallmentId[installment.id];
              const interestAmount = payment?.interest_amount || 0;
              const discountAmount = payment?.discount_amount || 0;
              // Calculate the actual paid amount: original amount + interest - discount
              const paidAmount = payment?.amount_paid || (installment.amount + interestAmount - discountAmount);
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                paid_amount: paidAmount,
                payment_date: installment.payment_date,
                installment_number: installment.installment_number,
                total_installments: account.accounts_payable_installments.length,
                installment_id: installment.id,
                payment_account_id: filters.account_id !== "all" ? filters.account_id : null,
                // Add interest/discount data from payments table
                interest_amount: interestAmount,
                discount_amount: discountAmount,
                interest_product: payment?.interest_product || null,
                discount_product: payment?.discount_product || null
              });
            }
          });
        } else if (account.payment_date) {
          // No installments - single payment
          accountsData.push({
            ...account,
            installment_number: 1,
            total_installments: 1,
            paid_amount: account.amount, // No interest/discount for direct payments
            payment_account_id: filters.account_id !== "all" ? filters.account_id : null,
            interest_amount: 0,
            discount_amount: 0,
            interest_product: null,
            discount_product: null
          });
        }
      });

      // Apply client-side filtering
      if (filters.payment_start || filters.payment_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.payment_date) return false;
          // Parse dates without timezone conversion to avoid date shifting
          const paymentDate = account.payment_date; // Keep as string YYYY-MM-DD
          const startDate = filters.payment_start;
          const endDate = filters.payment_end;
          
          if (startDate && paymentDate < startDate) return false;
          if (endDate && paymentDate > endDate) return false;
          return true;
        });
      }

      // supplier, store, employee, competence, created, product and account filters are now applied server-side

      // Filter by product - show accounts that have at least one item with the selected product
      if (filters.product_id && filters.product_id !== "all") {
        accountsData = accountsData.filter((account: any) => {
          if (!account.accounts_payable_items || account.accounts_payable_items.length === 0) {
            return false;
          }
          // Check if any item in this account has the selected product
          return account.accounts_payable_items.some((item: any) => {
            return item.product_id === filters.product_id;
          });
        });
      }

      // Filter by group - show accounts that have at least one product with the selected group
      if (filters.group_id && filters.group_id !== "all") {
        accountsData = accountsData.filter((account: any) => {
          if (!account.accounts_payable_items || account.accounts_payable_items.length === 0) {
            return false;
          }
          // Check if any product in this account belongs to a subgroup of the selected group
          return account.accounts_payable_items.some((item: any) => {
            const subgroup = item.products?.account_groups;
            if (!subgroup) return false;
            // The subgroup's parent_id should match the selected group_id
            return subgroup.parent_id === filters.group_id;
          });
        });
      }

      // employee filter is now applied server-side

      setAccounts(accountsData);
      toast({
        title: "Pesquisa realizada",
        description: `${accountsData.length} conta(s) encontrada(s)`,
      });
    } catch (error) {
      console.error("Error searching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas pagas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      payment_start: "",
      payment_end: "",
      competencia_start: "",
      competencia_end: "",
      created_start: "",
      created_end: "",
      supplier_id: "all",
      store_id: "all",
      product_id: "all",
      account_id: "all",
      group_id: "all",
      employee_id: "all",
    });
    setAvailableAccounts([]);
    setAccounts([]);
    setAllocationType("none");
    setSelectedAllocationIds([]);
  };

  const getFilterInfo = () => {
    let filterInfo = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Pagamento: ${start} a ${end}`);
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find(s => s.id === filters.supplier_id);
      if (supplier) filterInfo.push(`Fornecedor: ${supplier.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) filterInfo.push(`Loja: ${store.name}`);
    }
    if (filters.account_id !== "all") {
      const account = availableAccounts.find(a => a.id === filters.account_id);
      if (account) filterInfo.push(`Conta: ${account.name}`);
    }
    if (filters.group_id !== "all") {
      const group = groups.find(g => g.id === filters.group_id);
      if (group) filterInfo.push(`Grupo: ${group.name}`);
    }
    if (filters.employee_id !== "all") {
      const employee = employees.find(e => e.id === filters.employee_id);
      if (employee) filterInfo.push(`Funcionário: ${employee.name}`);
    }
    return filterInfo;
  };

  const formatBRL = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getFilterItems = (): { label: string; value: string }[] => {
    const filterItems: { label: string; value: string }[] = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      filterItems.push({ label: "Pagamento", value: `${start} a ${end}` });
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find(s => s.id === filters.supplier_id);
      if (supplier) filterItems.push({ label: "Fornecedor", value: supplier.name });
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) filterItems.push({ label: "Loja", value: store.name });
    }
    if (filters.account_id !== "all") {
      const account = availableAccounts.find(a => a.id === filters.account_id);
      if (account) filterItems.push({ label: "Conta", value: account.name });
    }
    if (filters.group_id !== "all") {
      const group = groups.find(g => g.id === filters.group_id);
      if (group) filterItems.push({ label: "Grupo", value: group.name });
    }
    if (filters.employee_id !== "all") {
      const employee = employees.find(e => e.id === filters.employee_id);
      if (employee) filterItems.push({ label: "Funcionário", value: employee.name });
    }
    return filterItems;
  };

  const buildSummaryCards = (): PdfSummaryCard[] => {
    const total = accounts.reduce((sum, account) => sum + (account.paid_amount ?? account.amount ?? 0), 0);
    const registros = new Set(accounts.map((account) => account.id)).size;

    const cards: PdfSummaryCard[] = [
      { label: "Total geral", value: formatBRL(total), tone: "gold" },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(accounts.length) },
      { label: "Situação", value: "Pagas", tone: "success" },
    ];

    if (filters.store_id !== "all") {
      const store = stores.find((s) => s.id === filters.store_id);
      if (store?.name) cards.push({ label: "Loja", value: store.name });
    }

    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      cards.push({ label: "Período", value: `${start} a ${end}` });
    }

    return cards;
  };

  const buildTotalizerItems = (): TotalizerItem[] => {
    const total = accounts.reduce((sum, account) => sum + (account.paid_amount ?? account.amount ?? 0), 0);
    const registros = new Set(accounts.map((account) => account.id)).size;
    return [
      { label: "Total geral", value: formatBRL(total), emphasis: true },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(accounts.length) },
    ];
  };

  const getSupplierOrEmployeeName = (account: any) => {
    if (account.employee_id && account.employees?.name) {
      return account.employees.name;
    }
    return account.suppliers?.name || "N/A";
  };

  const exportToPDFResumido = async () => {
    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Pagas",
      subtitle: "Contas pagas — Resumido",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Table data
    const tableData = accounts.map(account => [
      account.description,
      getSupplierOrEmployeeName(account),
      account.stores?.name || "N/A",
      account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      (account.paid_amount ?? account.amount)?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Vencimento", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 7.5 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "center", cellWidth: 24 },
          5: { halign: "right", cellWidth: 28 },
          6: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-pagas-resumido.pdf");
  };

  const exportToPDFDetalhado = async () => {
    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Pagas",
      subtitle: "Contas pagas — Detalhado",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Build table data with product details
    const tableData: any[] = [];
    
    accounts.forEach(account => {
      // Main account row
      tableData.push([
        { content: account.description, styles: { fontStyle: "bold" } },
        { content: getSupplierOrEmployeeName(account), styles: { fontStyle: "bold" } },
        { content: account.stores?.name || "N/A", styles: { fontStyle: "bold" } },
        { content: account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A", styles: { fontStyle: "bold" } },
        { content: account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A", styles: { fontStyle: "bold" } },
        { content: account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A", styles: { fontStyle: "bold" } },
        { content: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista", styles: { fontStyle: "bold" } }
      ]);
      
      // Product detail rows
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const productName = item.products?.name || "Produto não encontrado";
          const subgroupName = item.products?.account_groups?.name || "-";
          const quantity = item.quantity || 0;
          const unitPrice = item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          const totalPrice = item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          
          tableData.push([
            { content: "", styles: { fontSize: 6.5 } },
            { content: `   ${productName}`, styles: { fontSize: 6.5, textColor: [100, 100, 100] } },
            { content: subgroupName, styles: { fontSize: 6.5, textColor: [100, 100, 100] } },
            { content: `${quantity}`, styles: { fontSize: 6.5, textColor: [100, 100, 100] } },
            { content: "", styles: { fontSize: 6.5 } },
            { content: totalPrice, styles: { fontSize: 6.5, textColor: [100, 100, 100] } },
            { content: unitPrice, styles: { fontSize: 6.5, textColor: [100, 100, 100] } }
          ]);
        });
      }
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Vencimento", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 7.5 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "center", cellWidth: 24 },
          5: { halign: "right", cellWidth: 28 },
          6: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-pagas-detalhado.pdf");
  };

  const exportToPDFPorSubgrupo = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Pagas",
      subtitle: "Contas pagas — Por subgrupo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by subgroup - using product items for grouping
    const accountsBySubgroup: { [key: string]: { subgroupName: string; items: any[] } } = {};
    
    accounts.forEach(account => {
      // Process normal product items - calculate proportional amount for installments
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        // Calculate the total of all items to determine proportion
        const totalItemsValue = account.accounts_payable_items.reduce((sum: number, it: any) => sum + (it.total_price || 0), 0);
        // The paid amount for this installment (excludes interest/discount)
        const paidAmount = account.paid_amount ?? account.amount ?? 0;
        // Proportion: how much of the total was paid in this installment
        const proportion = totalItemsValue > 0 ? paidAmount / totalItemsValue : 1;

        // Group items by subgroup within this account, summing their proportional values
        const itemsBySubgroup: { [key: string]: { subgroupId: string; subgroupName: string; totalAmount: number } } = {};
        account.accounts_payable_items.forEach((item: any) => {
          const subgroupId = item.products?.subgroup_id || 'sem-subgrupo';
          const subgroupName = item.products?.account_groups?.name || 'Sem Subgrupo';
          const proportionalAmount = (item.total_price || 0) * proportion;

          if (!itemsBySubgroup[subgroupId]) {
            itemsBySubgroup[subgroupId] = { subgroupId, subgroupName, totalAmount: 0 };
          }
          itemsBySubgroup[subgroupId].totalAmount += proportionalAmount;
        });

        // Add one row per subgroup for this account
        Object.values(itemsBySubgroup).forEach(({ subgroupId, subgroupName, totalAmount }) => {
          if (!accountsBySubgroup[subgroupId]) {
            accountsBySubgroup[subgroupId] = {
              subgroupName,
              items: []
            };
          }

          accountsBySubgroup[subgroupId].items.push({
            description: account.description,
            supplierName: getSupplierOrEmployeeName(account),
            storeName: account.stores?.name || "N/A",
            paymentDate: account.payment_date,
            amount: totalAmount,
            installmentNumber: account.installment_number,
            totalInstallments: account.total_installments,
            accountId: account.id,
            installmentId: account.installment_id,
          });
        });
      }
      
      // Process interest (juros) - add to interest product's subgroup
      if (account.interest_amount && account.interest_amount > 0 && account.interest_product) {
        const subgroupId = account.interest_product.subgroup_id || 'sem-subgrupo';
        const subgroupName = account.interest_product.account_groups?.name || 'Sem Subgrupo';
        
        if (!accountsBySubgroup[subgroupId]) {
          accountsBySubgroup[subgroupId] = {
            subgroupName,
            items: []
          };
        }
        
        accountsBySubgroup[subgroupId].items.push({
          description: `${account.description} (Juros)`,
          supplierName: getSupplierOrEmployeeName(account),
          storeName: account.stores?.name || "N/A",
          paymentDate: account.payment_date,
          amount: account.interest_amount,
          installmentNumber: account.installment_number,
          totalInstallments: account.total_installments,
          accountId: account.id,
          installmentId: account.installment_id,
          productName: account.interest_product.name || "Juros"
        });
      }
      
      // Process discount (desconto) - add to discount product's subgroup with negative value
      if (account.discount_amount && account.discount_amount > 0 && account.discount_product) {
        const subgroupId = account.discount_product.subgroup_id || 'sem-subgrupo';
        const subgroupName = account.discount_product.account_groups?.name || 'Sem Subgrupo';
        
        if (!accountsBySubgroup[subgroupId]) {
          accountsBySubgroup[subgroupId] = {
            subgroupName,
            items: []
          };
        }
        
        accountsBySubgroup[subgroupId].items.push({
          description: `${account.description} (Desconto)`,
          supplierName: getSupplierOrEmployeeName(account),
          storeName: account.stores?.name || "N/A",
          paymentDate: account.payment_date,
          amount: -account.discount_amount, // Negative for discount
          installmentNumber: account.installment_number,
          totalInstallments: account.total_installments,
          accountId: account.id,
          installmentId: account.installment_id,
          productName: account.discount_product.name || "Desconto"
        });
      }
      
      // If account has no items and no interest/discount, add to "Sem Subgrupo"
      if ((!account.accounts_payable_items || account.accounts_payable_items.length === 0) && 
          !account.interest_amount && !account.discount_amount) {
        if (!accountsBySubgroup['sem-subgrupo']) {
          accountsBySubgroup['sem-subgrupo'] = {
            subgroupName: 'Sem Subgrupo',
            items: []
          };
        }
        accountsBySubgroup['sem-subgrupo'].items.push({
          description: account.description,
          supplierName: getSupplierOrEmployeeName(account),
          storeName: account.stores?.name || "N/A",
          paymentDate: account.payment_date,
          amount: account.amount || 0,
          installmentNumber: account.installment_number,
          totalInstallments: account.total_installments,
          accountId: account.id,
          installmentId: account.installment_id,
          productName: null
        });
      }
    });
    
    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalItems = 0;
    
    Object.values(accountsBySubgroup).forEach(group => {
      // Subgroup header row
      tableData.push([
        { content: group.subgroupName, colSpan: 6, styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 } }
      ]);
      
      // Items for this subgroup
      let subgroupTotal = 0;
      group.items.forEach(item => {
        tableData.push([
          item.description,
          item.supplierName,
          item.storeName,
          item.paymentDate ? new Date(item.paymentDate + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
          item.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          item.totalInstallments > 1 ? `${item.installmentNumber}/${item.totalInstallments}` : "À vista"
        ]);
        subgroupTotal += item.amount || 0;
        totalItems++;
      });
      
      // Subgroup subtotal
      tableData.push([
        { content: `Subtotal ${group.subgroupName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: `${group.items.length} item(s)`, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }
      ]);
      
      grandTotal += subgroupTotal;
    });
    
    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-pagas-por-subgrupo.pdf");
  };

  const exportToPDFPorFornecedor = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Pagas",
      subtitle: "Contas pagas — Por fornecedor",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by supplier
    const accountsBySupplier: { [key: string]: { supplierName: string; items: any[] } } = {};
    
    accounts.forEach(account => {
      const supplierId = account.supplier_id || account.employee_id || 'sem-fornecedor';
      const supplierName = getSupplierOrEmployeeName(account);
      
      if (!accountsBySupplier[supplierId]) {
        accountsBySupplier[supplierId] = {
          supplierName,
          items: []
        };
      }
      
      accountsBySupplier[supplierId].items.push({
        description: account.description,
        storeName: account.stores?.name || "N/A",
        dueDate: account.due_date,
        paymentDate: account.payment_date,
        amount: account.paid_amount ?? account.amount ?? 0,
        installmentNumber: account.installment_number,
        totalInstallments: account.total_installments,
      });
    });
    
    // Sort suppliers alphabetically
    const sortedSuppliers = Object.values(accountsBySupplier).sort((a, b) => 
      a.supplierName.localeCompare(b.supplierName)
    );
    
    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalItems = 0;
    
    sortedSuppliers.forEach(group => {
      // Supplier header row
      tableData.push([
        { content: group.supplierName, colSpan: 6, styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 } }
      ]);
      
      // Items for this supplier
      let supplierTotal = 0;
      group.items.forEach(item => {
        tableData.push([
          item.description,
          item.storeName,
          item.dueDate ? new Date(item.dueDate + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
          item.paymentDate ? new Date(item.paymentDate + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
          item.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          item.totalInstallments > 1 ? `${item.installmentNumber}/${item.totalInstallments}` : "À vista"
        ]);
        supplierTotal += item.amount || 0;
        totalItems++;
      });
      
      // Supplier subtotal
      tableData.push([
        { content: `Subtotal ${group.supplierName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: supplierTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: `${group.items.length} item(s)`, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }
      ]);
      
      grandTotal += supplierTotal;
    });
    
    autoTable(doc, {
      head: [["Título", "Loja", "Vencimento", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        columnStyles: {
          2: { halign: "center", cellWidth: 24 },
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-pagas-por-fornecedor.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: account.description,
      Fornecedor: getSupplierOrEmployeeName(account),
      Loja: account.stores?.name || "N/A",
      Vencimento: account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      Pagamento: account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      Valor: account.paid_amount ?? account.amount ?? 0,
      Parcelas: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas Pagas");
    XLSX.writeFile(wb, "contas-pagas.xlsx");
  };

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
            <h1 className="text-2xl font-bold text-primary">Contas Pagas</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas já pagas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Configure os filtros para o relatório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="payment_start">Data Pagamento (Início)</Label>
                <Input
                  id="payment_start"
                  type="date"
                  value={filters.payment_start}
                  onChange={(e) => setFilters(prev => ({...prev, payment_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="payment_end">Data Pagamento (Fim)</Label>
                <Input
                  id="payment_end"
                  type="date"
                  value={filters.payment_end}
                  onChange={(e) => setFilters(prev => ({...prev, payment_end: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_start">Data Competência (Início)</Label>
                <Input
                  id="competencia_start"
                  type="date"
                  value={filters.competencia_start}
                  onChange={(e) => setFilters(prev => ({...prev, competencia_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_end">Data Competência (Fim)</Label>
                <Input
                  id="competencia_end"
                  type="date"
                  value={filters.competencia_end}
                  onChange={(e) => setFilters(prev => ({...prev, competencia_end: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="created_start">Data Cadastro (Início)</Label>
                <Input
                  id="created_start"
                  type="date"
                  value={filters.created_start}
                  onChange={(e) => setFilters(prev => ({...prev, created_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="created_end">Data Cadastro (Fim)</Label>
                <Input
                  id="created_end"
                  type="date"
                  value={filters.created_end}
                  onChange={(e) => setFilters(prev => ({...prev, created_end: e.target.value}))}
                />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {filters.supplier_id !== "all"
                        ? suppliers.find((supplier) => supplier.id === filters.supplier_id)?.name || "Selecionar fornecedor"
                        : "Todos"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar fornecedor..." />
                      <CommandList>
                        <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => setFilters(prev => ({...prev, supplier_id: "all"}))}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filters.supplier_id === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Todos
                          </CommandItem>
                          {suppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={supplier.name}
                              onSelect={() => setFilters(prev => ({...prev, supplier_id: supplier.id}))}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {supplier.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Loja</Label>
                <Select value={filters.store_id} onValueChange={(value) => setFilters(prev => ({...prev, store_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produto</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {filters.product_id !== "all"
                        ? products.find((product) => product.id === filters.product_id)?.name || "Selecionar produto"
                        : "Todos"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => setFilters(prev => ({...prev, product_id: "all"}))}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filters.product_id === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Todos
                          </CommandItem>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => setFilters(prev => ({...prev, product_id: product.id}))}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.product_id === product.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {product.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Conta</Label>
                <Select 
                  value={filters.account_id} 
                  onValueChange={(value) => setFilters(prev => ({...prev, account_id: value}))}
                  disabled={filters.store_id === "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filters.store_id === "all" ? "Selecione uma loja primeiro" : "Selecionar conta"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grupo</Label>
                <Select value={filters.group_id} onValueChange={(value) => setFilters(prev => ({...prev, group_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.code} - {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funcionário</Label>
                <Select value={filters.employee_id} onValueChange={(value) => setFilters(prev => ({...prev, employee_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Vínculo</Label>
                <Select value={allocationType} onValueChange={(v) => setAllocationType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="aspiration">Aspiração</SelectItem>
                    <SelectItem value="pregnancy">Prenhez</SelectItem>
                    <SelectItem value="animal">Animais</SelectItem>
                    <SelectItem value="recipient">Receptoras</SelectItem>
                    <SelectItem value="semen">Sêmen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {allocationType !== "none" && allocationItems.length > 0 && (
                <div>
                  <Label>
                    {allocationType === "aspiration" ? "Aspirações"
                      : allocationType === "pregnancy" ? "Prenhez"
                      : allocationType === "recipient" ? "Receptoras"
                      : allocationType === "semen" ? "Sêmen"
                      : "Animais"}
                  </Label>
                  <Popover open={allocationPopoverOpen} onOpenChange={setAllocationPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {selectedAllocationIds.length === 0
                          ? "Selecionar..."
                          : selectedAllocationIds.length === allocationItems.length
                          ? "Todos selecionados"
                          : `${selectedAllocationIds.length} selecionado(s)`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar pelo nome..."
                          value={allocationSearch}
                          onChange={(e) => setAllocationSearch(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="p-2 border-b">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="paid-select-all"
                            checked={selectedAllocationIds.length === allocationItems.length && allocationItems.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedAllocationIds(allocationItems.map((i) => i.id));
                              else setSelectedAllocationIds([]);
                            }}
                          />
                          <label htmlFor="paid-select-all" className="text-sm font-medium cursor-pointer">
                            Selecionar todos
                          </label>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px]">
                        <div className="p-2 space-y-1">
                          {allocationItems
                            .filter((item) => item.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                            .map((item) => (
                              <div key={item.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`paid-alloc-${item.id}`}
                                  checked={selectedAllocationIds.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedAllocationIds((prev) => [...prev, item.id]);
                                    else setSelectedAllocationIds((prev) => prev.filter((id) => id !== item.id));
                                  }}
                                />
                                <label htmlFor={`paid-alloc-${item.id}`} className="text-sm cursor-pointer">
                                  {item.name}
                                </label>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Pesquisando..." : "Pesquisar"}
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Contas Pagas ({accounts.length})</CardTitle>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={exportToPDFResumido}>
                        Relatório Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFDetalhado}>
                        Relatório Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorSubgrupo}>
                        Relatório por Subgrupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorFornecedor}>
                        Relatório por Fornecedor
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={exportToExcel} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account, index) => (
                    <TableRow key={`${account.id}-${account.installment_id || index}`}>
                      <TableCell>{account.description}</TableCell>
                      <TableCell>{account.employee_id && account.employees?.name ? account.employees.name : (account.suppliers?.name || "N/A")}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A"}</TableCell>
                      <TableCell>
                        {account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A"}
                      </TableCell>
                      <TableCell>
                        {(account.paid_amount ?? account.amount)?.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        }) || "N/A"}
                      </TableCell>
                      <TableCell>
                        {account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="border-t-2 font-bold bg-muted/50">
                    <TableCell colSpan={5} className="text-right">Total:</TableCell>
                    <TableCell>
                      {accounts.reduce((sum, account) => sum + (account.paid_amount ?? account.amount ?? 0), 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </TableCell>
                    <TableCell>{accounts.length} parcela(s)</TableCell>
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

export default PaidAccountsReport;
