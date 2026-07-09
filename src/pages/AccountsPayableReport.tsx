import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MobileReportCard from "@/components/MobileReportCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download, Filter, FileDown, ChevronDown, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { toast } from "@/hooks/use-toast";
import { fetchRecipientAllocationOptions, fetchSemenAllocationOptions } from "@/lib/financialAllocations";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import {
  createPdfReportLayout,
  getVinculoBadge,
  REPORT_COLORS,
  type PdfSummaryCard,
  type TotalizerItem,
} from "@/lib/pdfReportLayout";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface SyntheticDailyTotal {
  date: string;
  total: number;
  hasSuspended: boolean;
}

interface SyntheticPeriodBlock {
  startDate: string;
  endDate: string;
  subtotal: number;
  dailyTotals: SyntheticDailyTotal[];
}

interface AccountAllocationDetail {
  labels: string[];
  linkedNames: string[];
  types: string[];
}

type PdfDocWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const formatCurrencyBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDateBR = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");

const parseDateAtMidday = (date: string) => new Date(`${date}T12:00:00`);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTimeBR = (date: string) => new Date(date).toLocaleDateString("pt-BR");

const getUniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));

const joinValues = (values: Array<string | null | undefined>) => {
  const uniqueValues = getUniqueValues(values);
  return uniqueValues.length > 0 ? uniqueValues.join(" • ") : null;
};

const AccountsPayableReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    due_start: "",
    due_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    supplier_id: "all",
    store_id: "all",
    product_id: "all",
    include_suspended: false,
  });

  const [allocationType, setAllocationType] = useState<string>("none");
  const [allocationItems, setAllocationItems] = useState<Array<{ id: string; name: string; code?: number }>>([]);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<string[]>([]);
  const [allocationPopoverOpen, setAllocationPopoverOpen] = useState(false);
  const [allocationSearch, setAllocationSearch] = useState("");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [syntheticPdfModalOpen, setSyntheticPdfModalOpen] = useState(false);
  const [syntheticIntervalDays, setSyntheticIntervalDays] = useState("15");
  const [syntheticPdfLoading, setSyntheticPdfLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [accountAllocationDetails, setAccountAllocationDetails] = useState<Map<string, AccountAllocationDetail>>(new Map());

  useEffect(() => {
    fetchSuppliers();
    fetchStores();
    fetchProducts();
  }, []);

  useEffect(() => {
    setSelectedAllocationIds([]);
    setAllocationItems([]);
    setAllocationSearch("");
    if (allocationType === "none") return;

    const fetchAllocationItems = async () => {
      if (allocationType === "aspiration") {
        const { data } = await supabase
          .from("aspiration_management")
          .select("id, name, code")
          .order("code", { ascending: false });
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "pregnancy") {
        const { data } = await supabase
          .from("pregnancy_management")
          .select("id, name, code")
          .order("code", { ascending: false });
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "animal") {
        const recipientCategoryIds = await fetchRecipientCategoryIds();
        const { data } = await (recipientCategoryIds.length > 0
          ? supabase
              .from("animals")
              .select("id, name, code")
              .not("category_id", "in", `("${recipientCategoryIds.join('","')}")`)
              .order("code", { ascending: false })
          : supabase
              .from("animals")
              .select("id, name, code")
              .order("code", { ascending: false }));
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "recipient") {
        const data = await fetchRecipientAllocationOptions();
        setAllocationItems(data.map((d) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "semen") {
        const data = await fetchSemenAllocationOptions();
        setAllocationItems(data.map((d) => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      }
    };
    fetchAllocationItems();
  }, [allocationType]);

  useEffect(() => {
    let isMounted = true;

    if (accounts.length === 0) {
      setAccountAllocationDetails(new Map());
      return () => {
        isMounted = false;
      };
    }

    const loadAllocationDetails = async () => {
      const details = await fetchAllocationDetailsForAccounts(accounts);
      if (isMounted) {
        setAccountAllocationDetails(details);
      }
    };

    void loadAllocationDetails();

    return () => {
      isMounted = false;
    };
  }, [accounts]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name");
    setSuppliers(data || []);
  };

  const fetchStores = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role, store_id").eq("id", user.id).single();

      if (profile?.role === "admin") {
        const { data } = await supabase.from("stores").select("id, name").order("name");
        setStores(data || []);
      } else {
        const storeIds: string[] = [];
        if (profile?.store_id) storeIds.push(profile.store_id);

        const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", user.id);

        userStores?.forEach((us) => {
          if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
        });

        if (storeIds.length > 0) {
          const { data } = await supabase.from("stores").select("id, name").in("id", storeIds).order("name");
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar fazendas:", error);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name");
    setProducts(data || []);
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const toEndOfDayIso = (date: string) => `${date}T23:59:59.999`;

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

      let accountIdsByAllocation: string[] | null = null;
      if (allocationType !== "none" && selectedAllocationIds.length > 0) {
        let allocationQuery = supabase
          .from("accounts_payable_item_allocations")
          .select("account_payable_item_id");

        if (allocationType === "aspiration") {
          allocationQuery = allocationQuery.in("aspiration_id", selectedAllocationIds);
        } else if (allocationType === "pregnancy") {
          allocationQuery = allocationQuery.in("pregnancy_id", selectedAllocationIds);
        } else if (allocationType === "animal") {
          allocationQuery = allocationQuery.in("animal_id", selectedAllocationIds);
        } else if (allocationType === "recipient") {
          allocationQuery = allocationQuery.in("recipient_id", selectedAllocationIds);
        } else if (allocationType === "semen") {
          allocationQuery = allocationQuery.in("semen_id", selectedAllocationIds);
        }

        const { data: allocations } = await allocationQuery;
        const itemIds = allocations?.map((allocation) => allocation.account_payable_item_id) || [];

        if (itemIds.length === 0) {
          setAccounts([]);
          toast({
            title: "Pesquisa realizada",
            description: "0 conta(s) encontrada(s)",
          });
          return;
        }

        const { data: items } = await supabase
          .from("accounts_payable_items")
          .select("account_payable_id")
          .in("id", itemIds);

        const uniqueIds = Array.from(new Set((items || []).map((item) => item.account_payable_id)));
        if (uniqueIds.length === 0) {
          setAccounts([]);
          toast({
            title: "Pesquisa realizada",
            description: "0 conta(s) encontrada(s)",
          });
          return;
        }
        accountIdsByAllocation = uniqueIds;
      }

      let accountIdsToFilter: string[] | null = null;
      if (accountIdsByProduct && accountIdsByAllocation) {
        const allocationSet = new Set(accountIdsByAllocation);
        accountIdsToFilter = accountIdsByProduct.filter((id) => allocationSet.has(id));
      } else {
        accountIdsToFilter = accountIdsByProduct || accountIdsByAllocation;
      }

      if (accountIdsToFilter && accountIdsToFilter.length === 0) {
        setAccounts([]);
        toast({
          title: "Pesquisa realizada",
          description: "0 conta(s) encontrada(s)",
        });
        return;
      }

      // Fetch accounts with server-side filters whenever possible
      const allAccounts = await fetchAllPaginated(() => {
        let query = supabase.from("accounts_payable").select(`
            *,
            suppliers(id, name),
            employees(id, name),
            stores(id, name),
            chart_of_accounts:account_id(
              id,
              code,
              name,
              account_groups:group_id(id, name)
            ),
            accounts_payable_installments(*),
            accounts_payable_payments(
              id,
              installment_id,
              interest_amount,
              discount_amount
            ),
            accounts_payable_items(
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              products(id, name, subgroup_id, account_groups:subgroup_id(id, name, parent_id))
            )
          `)
          .in(
            "status",
            filters.include_suspended
              ? ["pending", "partial", "pagamento_suspenso"]
              : ["pending", "partial"],
          );

        if (filters.supplier_id && filters.supplier_id !== "all") {
          query = query.eq("supplier_id", filters.supplier_id);
        }
        if (filters.store_id && filters.store_id !== "all") {
          query = query.eq("store_id", filters.store_id);
        }
        if (filters.competencia_start) {
          query = query.gte("data_competencia", filters.competencia_start);
        }
        if (filters.competencia_end) {
          query = query.lte("data_competencia", filters.competencia_end);
        }
        if (filters.created_start) {
          query = query.gte("created_at", filters.created_start);
        }
        if (filters.created_end) {
          query = query.lte("created_at", toEndOfDayIso(filters.created_end));
        }
        if (accountIdsToFilter && accountIdsToFilter.length > 0) {
          query = query.in("id", accountIdsToFilter);
        }

        return query;
      });

      const parentGroupIds = Array.from(
        new Set(
          (allAccounts || [])
            .flatMap((account: any) =>
              (account.accounts_payable_items || []).map((item: any) => item.products?.account_groups?.parent_id),
            )
            .filter(Boolean),
        ),
      ) as string[];

      const { data: parentGroups } =
        parentGroupIds.length > 0
          ? await supabase.from("account_groups").select("id, name").in("id", parentGroupIds)
          : { data: [] as Array<{ id: string; name: string }> };

      const parentGroupNameMap = new Map((parentGroups || []).map((group) => [group.id, group.name]));

      const hydratedAccounts = (allAccounts || []).map((account: any) => ({
        ...account,
        accounts_payable_items: (account.accounts_payable_items || []).map((item: any) => ({
          ...item,
          products: item.products
            ? {
                ...item.products,
                category_name: item.products.account_groups?.parent_id
                  ? parentGroupNameMap.get(item.products.account_groups.parent_id) || null
                  : null,
              }
            : null,
        })),
      }));

      // Filter for unpaid accounts only and expand installments
      let accountsData: any[] = [];
      hydratedAccounts.forEach((account: any) => {
        if (account.status === "paid") return;
        if (account.status === "pagamento_suspenso" && !filters.include_suspended) return;

        if (account.accounts_payable_installments && account.accounts_payable_installments.length > 0) {
          // Has installments - create one row per unpaid installment
          account.accounts_payable_installments.forEach((installment: any) => {
            const isSuspended = installment.status === 'pagamento_suspenso';
            if (!installment.payment_date && (!isSuspended || filters.include_suspended)) {
              // Only unpaid installments
              // Check if there are any reversed payments with interest/discount for this installment
              const installmentPayments = (account.accounts_payable_payments || []).filter(
                (p: any) => p.installment_id === installment.id,
              );

              // Sum up all interest and discount from payments (including reversed ones)
              let totalInterest = 0;
              let totalDiscount = 0;
              installmentPayments.forEach((payment: any) => {
                totalInterest += payment.interest_amount || 0;
                totalDiscount += payment.discount_amount || 0;
              });

              // The installment.amount already reflects the adjusted value from payments
              // So we use it directly
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                installment_number: installment.installment_number,
                total_installments: account.accounts_payable_installments.length,
                installment_id: installment.id,
                is_suspended: isSuspended,
              });
            }
          });
        } else {
          // No installments - single payment
          // Check if there were any reversed payments with adjustments
          const payments = account.accounts_payable_payments || [];
          let adjustedAmount = account.amount;

          if (payments.length > 0) {
            // Sum up all interest and discount from all payments
            let totalInterest = 0;
            let totalDiscount = 0;
            payments.forEach((payment: any) => {
              totalInterest += payment.interest_amount || 0;
              totalDiscount += payment.discount_amount || 0;
            });

            // Adjust the amount with interest and discount
            adjustedAmount = account.amount + totalInterest - totalDiscount;
          }

          accountsData.push({
            ...account,
            amount: adjustedAmount,
            installment_number: 1,
            total_installments: 1,
            is_suspended: account.status === "pagamento_suspenso",
          });
        }
      });

      // Apply client-side filtering for all filters
      if (filters.due_start || filters.due_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.due_date) return false;
          const dueDate = account.due_date; // String no formato YYYY-MM-DD

          if (filters.due_start && dueDate < filters.due_start) return false;
          if (filters.due_end && dueDate > filters.due_end) return false;
          return true;
        });
      }

      // supplier/store/competence/created/product/allocation filters are now applied before or during query

      setAccounts(accountsData);
      setMobileFiltersOpen(false);
      toast({
        title: "Pesquisa realizada",
        description: `${accountsData.length} conta(s) encontrada(s)`,
      });
    } catch (error) {
      console.error("Error searching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a pagar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      due_start: "",
      due_end: "",
      competencia_start: "",
      competencia_end: "",
      created_start: "",
      created_end: "",
      supplier_id: "all",
      store_id: "all",
      product_id: "all",
      include_suspended: false,
    });
    setAccounts([]);
    setAllocationType("none");
    setSelectedAllocationIds([]);
    setAllocationItems([]);
    setHasSearched(false);
    setAccountAllocationDetails(new Map());
    setMobileFiltersOpen(false);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getAccountStatusMeta = (account: any) => {
    const normalizedStatus = String(account.status || "").toLowerCase();

    if (account.is_suspended || normalizedStatus === "pagamento_suspenso") {
      return {
        label: "Suspenso",
        sortValue: 4,
        className: "border-red-200 bg-red-50 text-red-600",
      };
    }

    if (normalizedStatus === "paid" || account.payment_date) {
      return {
        label: "Pago",
        sortValue: 2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") {
      return {
        label: "Cancelado",
        sortValue: 3,
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    }

    if (account.due_date && account.due_date < toDateKey(new Date())) {
      return {
        label: "Vencido",
        sortValue: 1,
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    }

    return {
      label: "Em aberto",
      sortValue: 0,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const sortedAccounts = React.useMemo(() => {
    if (!sortColumn) return accounts;
    return [...accounts].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "description":
          valA = (a.description || "").toLowerCase();
          valB = (b.description || "").toLowerCase();
          break;
        case "supplier":
          valA = (a.employees?.name || a.suppliers?.name || "").toLowerCase();
          valB = (b.employees?.name || b.suppliers?.name || "").toLowerCase();
          break;
        case "due_date":
          valA = a.due_date || "";
          valB = b.due_date || "";
          break;
        case "amount":
          valA = a.amount || 0;
          valB = b.amount || 0;
          break;
        case "created_at":
          valA = a.created_at || "";
          valB = b.created_at || "";
          break;
        case "status":
          valA = getAccountStatusMeta(a).sortValue;
          valB = getAccountStatusMeta(b).sortValue;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [accounts, sortColumn, sortDirection]);

  const getFilterInfo = () => {
    const filterInfo: string[] = [];
    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? new Date(filters.due_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.due_end ? new Date(filters.due_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Vencimento: ${start} a ${end}`);
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find((s) => s.id === filters.supplier_id);
      if (supplier) filterInfo.push(`Fornecedor: ${supplier.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find((s) => s.id === filters.store_id);
      if (store) filterInfo.push(`Fazenda: ${store.name}`);
    }
    return filterInfo;
  };

  const getFilterItems = () => {
    const filterItems: Array<{ label: string; value: string }> = [];

    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? formatDateBR(filters.due_start) : "Início";
      const end = filters.due_end ? formatDateBR(filters.due_end) : "Fim";
      filterItems.push({ label: "Vencimento", value: `${start} a ${end}` });
    }

    if (filters.competencia_start || filters.competencia_end) {
      const start = filters.competencia_start ? formatDateBR(filters.competencia_start) : "Início";
      const end = filters.competencia_end ? formatDateBR(filters.competencia_end) : "Fim";
      filterItems.push({ label: "Competência", value: `${start} a ${end}` });
    }

    if (filters.created_start || filters.created_end) {
      const start = filters.created_start ? formatDateBR(filters.created_start) : "Início";
      const end = filters.created_end ? formatDateBR(filters.created_end) : "Fim";
      filterItems.push({ label: "Cadastro", value: `${start} a ${end}` });
    }

    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find((item) => item.id === filters.supplier_id);
      if (supplier?.name) {
        filterItems.push({ label: "Fornecedor", value: supplier.name });
      }
    }

    if (filters.store_id !== "all") {
      const store = stores.find((item) => item.id === filters.store_id);
      if (store?.name) {
        filterItems.push({ label: "Fazenda", value: store.name });
      }
    }

    if (filters.product_id !== "all") {
      const product = products.find((item) => item.id === filters.product_id);
      if (product?.name) {
        filterItems.push({ label: "Produto", value: product.name });
      }
    }

    if (allocationType !== "none" && selectedAllocationIds.length > 0) {
      const allocationTypeLabel =
        allocationType === "aspiration"
          ? "Aspiração"
          : allocationType === "pregnancy"
            ? "Prenhez"
            : allocationType === "recipient"
              ? "Receptoras"
              : allocationType === "semen"
                ? "Sêmen"
                : "Animais";

      const selectedNames = allocationItems
        .filter((item) => selectedAllocationIds.includes(item.id))
        .map((item) => item.name);

      if (selectedNames.length > 0) {
        const preview =
          selectedNames.length <= 2
            ? selectedNames.join(", ")
            : `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;
        filterItems.push({ label: allocationTypeLabel, value: preview });
      }
    }

    return filterItems;
  };

  /** Situação do relatório, exibida nos cards de resumo do PDF. */
  const reportSituacao = filters.include_suspended ? "Em aberto + suspensas" : "Em aberto";

  /** Indicadores agregados reaproveitados pelos cards de resumo e pelo totalizador. */
  const getReportTotals = () => ({
    total: sortedAccounts.reduce((sum, account) => sum + (account.amount || 0), 0),
    registros: new Set(sortedAccounts.map((account) => account.id)).size,
    parcelas: sortedAccounts.length,
  });

  const buildSummaryCards = (situacao: string = reportSituacao): PdfSummaryCard[] => {
    const { total, registros, parcelas } = getReportTotals();

    const cards: PdfSummaryCard[] = [
      { label: "Total geral", value: formatCurrencyBRL(total), tone: "gold" },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(parcelas) },
      { label: "Situação", value: situacao, tone: "primary" },
    ];

    if (filters.store_id !== "all") {
      const store = stores.find((item) => item.id === filters.store_id);
      if (store?.name) cards.push({ label: "Fazenda", value: store.name });
    }

    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? formatDateBR(filters.due_start) : "Início";
      const end = filters.due_end ? formatDateBR(filters.due_end) : "Fim";
      cards.push({ label: "Período (vencimento)", value: `${start} a ${end}` });
    }

    return cards;
  };

  const buildTotalizerItems = (): TotalizerItem[] => {
    const { total, registros, parcelas } = getReportTotals();
    return [
      { label: "Total geral", value: formatCurrencyBRL(total), emphasis: true },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(parcelas) },
    ];
  };

  const mobileFilterSummary = React.useMemo(() => {
    const supplierName = filters.supplier_id !== "all"
      ? suppliers.find((item) => item.id === filters.supplier_id)?.name
      : null;
    const storeName = filters.store_id !== "all"
      ? stores.find((item) => item.id === filters.store_id)?.name
      : null;
    const productName = filters.product_id !== "all"
      ? products.find((item) => item.id === filters.product_id)?.name
      : null;

    const allocationLabel =
      allocationType === "none"
        ? "Nenhum vínculo"
        : selectedAllocationIds.length > 0
          ? `${selectedAllocationIds.length} vínculo(s)`
          : `Tipo: ${
              allocationType === "aspiration"
                ? "Aspiração"
                : allocationType === "pregnancy"
                  ? "Prenhez"
                  : allocationType === "recipient"
                    ? "Receptoras"
                    : allocationType === "semen"
                      ? "Sêmen"
                      : "Animais"
            }`;

    return [
      supplierName || "Todos os fornecedores",
      storeName || "Todas as fazendas",
      productName || "Todos os produtos",
      allocationLabel,
    ].join(" • ");
  }, [
    allocationType,
    filters.product_id,
    filters.store_id,
    filters.supplier_id,
    products,
    selectedAllocationIds.length,
    stores,
    suppliers,
  ]);

  const buildSyntheticPeriodBlocks = (intervalDays: number): SyntheticPeriodBlock[] => {
    const dailyTotalsMap = new Map<string, { total: number; hasSuspended: boolean }>();

    sortedAccounts.forEach((account) => {
      const dueDate = account.due_date;
      if (!dueDate || dueDate < filters.due_start || dueDate > filters.due_end) return;
      const current = dailyTotalsMap.get(dueDate) || { total: 0, hasSuspended: false };
      dailyTotalsMap.set(dueDate, {
        total: current.total + Number(account.amount || 0),
        hasSuspended: current.hasSuspended || Boolean(account.is_suspended),
      });
    });

    const blocks: SyntheticPeriodBlock[] = [];
    let cursor = parseDateAtMidday(filters.due_start);
    const finalDate = parseDateAtMidday(filters.due_end);

    while (cursor <= finalDate) {
      const blockStartDate = new Date(cursor);
      const tentativeEndDate = addDays(blockStartDate, intervalDays - 1);
      const blockEndDate = tentativeEndDate > finalDate ? new Date(finalDate) : tentativeEndDate;

      const startDateKey = toDateKey(blockStartDate);
      const endDateKey = toDateKey(blockEndDate);

      const dailyTotals = Array.from(dailyTotalsMap.entries())
        .filter(([date]) => date >= startDateKey && date <= endDateKey)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => ({
          date,
          total: value.total,
          hasSuspended: value.hasSuspended,
        }));

      blocks.push({
        startDate: startDateKey,
        endDate: endDateKey,
        subtotal: dailyTotals.reduce((sum, item) => sum + item.total, 0),
        dailyTotals,
      });

      cursor = addDays(blockEndDate, 1);
    }

    return blocks;
  };

  const openSyntheticPdfModal = () => {
    if (!filters.due_start || !filters.due_end) {
      toast({
        title: "Período obrigatório",
        description: "Informe a data inicial e final de vencimento antes de gerar o PDF sintético.",
        variant: "destructive",
      });
      return;
    }

    if (filters.due_end < filters.due_start) {
      toast({
        title: "Período inválido",
        description: "A data final de vencimento deve ser maior ou igual à data inicial.",
        variant: "destructive",
      });
      return;
    }

    if (!hasSearched) {
      toast({
        title: "Pesquise antes de exportar",
        description: "Faça a pesquisa com os filtros desejados antes de gerar o PDF sintético.",
        variant: "destructive",
      });
      return;
    }

    setSyntheticIntervalDays((current) => current || "15");
    setSyntheticPdfModalOpen(true);
  };

  const exportToPDFSintetico = async (intervalDays: number) => {
    const doc = new jsPDF();
    const pdf = doc as PdfDocWithAutoTable;
    const appliedFilters = [
      ...getFilterItems(),
      { label: "Agrupamento", value: `${intervalDays} dia(s)` },
    ];
    const blocks = buildSyntheticPeriodBlocks(intervalDays);
    const totalGeneral = blocks.reduce((sum, block) => sum + block.subtotal, 0);
    const totalMovementDays = blocks.reduce((sum, block) => sum + block.dailyTotals.length, 0);

    doc.setProperties({
      title: "Relatório Sintético de Contas a Pagar",
      subject: "Contas a Pagar agrupado por intervalo de dias",
      author: "EliteBov",
      creator: "EliteBov",
    });

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: `Sintético — agrupado a cada ${intervalDays} dia(s)`,
      emittedAt: new Date(),
      filters: appliedFilters,
      summaryCards: [
        { label: "Total geral", value: formatCurrencyBRL(totalGeneral), tone: "gold" },
        { label: "Dias com movimentação", value: String(totalMovementDays) },
        { label: "Blocos", value: String(blocks.length) },
        { label: "Situação", value: reportSituacao, tone: "primary" },
        { label: "Período (vencimento)", value: `${formatDateBR(filters.due_start)} a ${formatDateBR(filters.due_end)}` },
      ],
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = layout.tableMargin.left;
    const contentWidth = pageWidth - layout.tableMargin.left - layout.tableMargin.right;
    const nextPageStartY = layout.tableMargin.top;
    let currentY = layout.startY;

    const ensureSpace = (requiredHeight: number) => {
      if (currentY + requiredHeight <= pageHeight - layout.tableMargin.bottom) return;
      doc.addPage();
      layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
      currentY = nextPageStartY;
    };

    const drawTotalBox = () => {
      currentY =
        layout.drawTotalizer(currentY, [
          { label: "Total geral do período", value: formatCurrencyBRL(totalGeneral), emphasis: true },
          { label: "Dias", value: String(totalMovementDays) },
          { label: "Blocos", value: String(blocks.length) },
        ]) + 4;
    };

    if (blocks.every((block) => block.dailyTotals.length === 0)) {
      ensureSpace(40);

      doc.setFillColor(...REPORT_COLORS.cardBg);
      doc.setDrawColor(...REPORT_COLORS.border);
      doc.roundedRect(marginLeft, currentY, contentWidth, 28, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text("Nenhuma movimentação encontrada no período selecionado.", marginLeft + 5, currentY + 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...REPORT_COLORS.textMuted);
      doc.text(
        `Período analisado: ${formatDateBR(filters.due_start)} a ${formatDateBR(filters.due_end)}.`,
        marginLeft + 5,
        currentY + 17,
      );
      doc.text(`Agrupamento informado: ${intervalDays} dia(s).`, marginLeft + 5, currentY + 22);

      currentY += 34;
      drawTotalBox();
      layout.finalize();
      doc.save("contas-a-pagar-sintetico.pdf");
      return;
    }

    blocks.forEach((block, index) => {
      ensureSpace(24);

      doc.setFillColor(...REPORT_COLORS.cardBg);
      doc.setDrawColor(...REPORT_COLORS.border);
      doc.roundedRect(marginLeft, currentY, contentWidth, 12, 2.5, 2.5, "FD");
      doc.setFillColor(...REPORT_COLORS.gold);
      doc.rect(marginLeft, currentY + 2, 1.4, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(`Bloco ${index + 1}`, marginLeft + 5, currentY + 5.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...REPORT_COLORS.textMuted);
      doc.text(
        `${formatDateBR(block.startDate)} a ${formatDateBR(block.endDate)}`,
        marginLeft + 5,
        currentY + 9,
      );

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(formatCurrencyBRL(block.subtotal), marginLeft + contentWidth - 4, currentY + 7.2, {
        align: "right",
      });

      currentY += 16;

      const bodyRows: any[] =
        block.dailyTotals.length > 0
          ? block.dailyTotals.map((item) => {
              const cells = [formatDateBR(item.date), formatCurrencyBRL(item.total)];
              // Dias com contas suspensas com fonte em vermelho para destaque
              if (item.hasSuspended) {
                return cells.map((content) => ({ content, styles: { textColor: [220, 38, 38] } }));
              }
              return cells;
            })
          : [["Sem movimentações no intervalo", "-"]];

      bodyRows.push([
        {
          content: "Subtotal do período",
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: REPORT_COLORS.goldSoft,
            textColor: REPORT_COLORS.navy,
          },
        } as any,
        {
          content: formatCurrencyBRL(block.subtotal),
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: REPORT_COLORS.goldSoft,
            textColor: REPORT_COLORS.navy,
          },
        } as any,
      ]);

      autoTable(doc, {
        head: [["Data", "Valor total do dia"]],
        body: bodyRows,
        startY: currentY,
        margin: layout.tableMargin,
        showHead: "everyPage",
        willDrawPage: layout.willDrawPage,
        ...layout.tableStyles({
          styles: { fontSize: 9 },
          bodyStyles: { minCellHeight: 8 },
          columnStyles: {
            0: { cellWidth: 55, halign: "center" },
            1: { cellWidth: 45, halign: "right" },
          },
        }),
      });

      currentY = (pdf.lastAutoTable?.finalY || currentY) + 8;
    });

    drawTotalBox();
    layout.finalize();
    doc.save("contas-a-pagar-sintetico.pdf");
  };

  const handleGenerateSyntheticPdf = async () => {
    if (!filters.due_start || !filters.due_end) {
      toast({
        title: "Período obrigatório",
        description: "Informe a data inicial e final de vencimento.",
        variant: "destructive",
      });
      return;
    }

    const parsedInterval = Number.parseInt(syntheticIntervalDays, 10);
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      toast({
        title: "Intervalo inválido",
        description: "Informe um número inteiro maior que zero para o agrupamento.",
        variant: "destructive",
      });
      return;
    }

    setSyntheticPdfLoading(true);
    try {
      await exportToPDFSintetico(parsedInterval);
      setSyntheticPdfModalOpen(false);
    } catch (error) {
      console.error("Erro ao gerar PDF sintético:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF sintético de Contas a Pagar.",
        variant: "destructive",
      });
    } finally {
      setSyntheticPdfLoading(false);
    }
  };

  const exportToPDFResumido = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Resumido",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Table data
    const tableData: any[] = sortedAccounts.map((account) => {
      const cells = [
        account.description,
        account.employees?.name || account.suppliers?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
      ];
      // Contas suspensas com fonte em vermelho para destaque
      if (account.is_suspended) {
        return cells.map((content) => ({ content, styles: { textColor: [220, 38, 38] } }));
      }
      return cells;
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
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

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-a-pagar-resumido.pdf");
  };

  const exportToPDFResumidoPorMes = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Resumido por Mês",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by month/year
    const accountsByMonth: { [key: string]: { monthLabel: string; accounts: any[]; sortKey: string } } = {};

    sortedAccounts.forEach((account) => {
      const dueDate = new Date(account.due_date + "T00:00:00");
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth();
      const key = `${year}-${String(month).padStart(2, "0")}`;

      const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const monthLabel = `${monthNames[month]} / ${year}`;

      if (!accountsByMonth[key]) {
        accountsByMonth[key] = {
          monthLabel,
          accounts: [],
          sortKey: key,
        };
      }

      accountsByMonth[key].accounts.push(account);
    });

    // Sort by month/year
    const sortedMonths = Object.values(accountsByMonth).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Build table data with month grouping
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalInstallments = 0;

    sortedMonths.forEach((monthGroup) => {
      // Month header row
      tableData.push([
        {
          content: monthGroup.monthLabel,
          colSpan: 6,
          styles: {
            fontStyle: "bold",
            fillColor: REPORT_COLORS.goldSoft,
            textColor: REPORT_COLORS.navy,
            fontSize: 9.5,
          },
        },
      ]);

      // Items for this month
      let monthTotal = 0;
      monthGroup.accounts.forEach((account) => {
        const cells = [
          account.description,
          account.employees?.name || account.suppliers?.name || "N/A",
          account.stores?.name || "N/A",
          new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
        ];
        // Contas suspensas com fonte em vermelho para destaque
        if (account.is_suspended) {
          tableData.push(cells.map((content) => ({ content, styles: { textColor: [220, 38, 38] } })));
        } else {
          tableData.push(cells);
        }
        monthTotal += account.amount || 0;
      });

      // Month subtotal
      tableData.push([
        {
          content: `Subtotal ${monthGroup.monthLabel}`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: `${monthGroup.accounts.length} parcela(s)`,
          styles: { fontStyle: "bold", halign: "center", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
      ]);

      grandTotal += monthTotal;
      totalInstallments += monthGroup.accounts.length;
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, [
      { label: "Total geral", value: formatCurrencyBRL(grandTotal), emphasis: true },
      { label: "Meses", value: String(sortedMonths.length) },
      { label: "Parcelas", value: String(totalInstallments) },
    ]);
    layout.finalize();

    doc.save("contas-a-pagar-resumido-por-mes.pdf");
  };

  const exportToPDFResumidoPorDia = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Resumido por Dia",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by day (YYYY-MM-DD)
    const accountsByDay: { [key: string]: { dayLabel: string; accounts: any[]; sortKey: string } } = {};

    sortedAccounts.forEach((account) => {
      const dueDate = new Date(account.due_date + "T00:00:00");
      const key = account.due_date; // Already in YYYY-MM-DD format
      const dayLabel = dueDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      if (!accountsByDay[key]) {
        accountsByDay[key] = {
          dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
          accounts: [],
          sortKey: key,
        };
      }

      accountsByDay[key].accounts.push(account);
    });

    // Sort by day (ascending)
    const sortedDays = Object.values(accountsByDay).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Build table data with day grouping
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalInstallments = 0;

    sortedDays.forEach((dayGroup) => {
      // Day header row
      tableData.push([
        {
          content: dayGroup.dayLabel,
          colSpan: 6,
          styles: {
            fontStyle: "bold",
            fillColor: REPORT_COLORS.goldSoft,
            textColor: REPORT_COLORS.navy,
            fontSize: 9.5,
          },
        },
      ]);

      // Items for this day
      let dayTotal = 0;
      dayGroup.accounts.forEach((account) => {
        const cells = [
          account.description,
          account.employees?.name || account.suppliers?.name || "N/A",
          account.stores?.name || "N/A",
          new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
        ];
        // Contas suspensas com fonte em vermelho para destaque
        if (account.is_suspended) {
          tableData.push(cells.map((content) => ({ content, styles: { textColor: [220, 38, 38] } })));
        } else {
          tableData.push(cells);
        }
        dayTotal += account.amount || 0;
      });

      // Day subtotal
      tableData.push([
        {
          content: `Subtotal do dia`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: dayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: `${dayGroup.accounts.length} parcela(s)`,
          styles: { fontStyle: "bold", halign: "center", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
      ]);

      grandTotal += dayTotal;
      totalInstallments += dayGroup.accounts.length;
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, [
      { label: "Total geral", value: formatCurrencyBRL(grandTotal), emphasis: true },
      { label: "Dias", value: String(sortedDays.length) },
      { label: "Parcelas", value: String(totalInstallments) },
    ]);
    layout.finalize();

    doc.save("contas-a-pagar-resumido-por-dia.pdf");
  };

  const exportToPDFPorDiaVinculo = async () => {
    const allocMap = await fetchAllocationsForAccounts(sortedAccounts);

    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Dia / Vínculo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group by day, then by vínculo
    const accountsByDay: {
      [key: string]: {
        dayLabel: string;
        sortKey: string;
        byVinculo: { [vinc: string]: any[] };
      };
    } = {};

    sortedAccounts.forEach((account) => {
      const key = account.due_date;
      const dueDate = new Date(account.due_date + "T00:00:00");
      const dayLabel = dueDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      if (!accountsByDay[key]) {
        accountsByDay[key] = {
          dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
          sortKey: key,
          byVinculo: {},
        };
      }

      const vinculos = allocMap.get(account.id) || [];
      const vincKey = vinculos.length > 0 ? vinculos.join(" | ") : "Sem vínculo";

      if (!accountsByDay[key].byVinculo[vincKey]) {
        accountsByDay[key].byVinculo[vincKey] = [];
      }
      accountsByDay[key].byVinculo[vincKey].push(account);
    });

    const sortedDays = Object.values(accountsByDay).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey),
    );

    const tableData: any[] = [];
    let grandTotal = 0;
    let totalInstallments = 0;

    sortedDays.forEach((dayGroup) => {
      // Day header
      tableData.push([
        {
          content: dayGroup.dayLabel,
          colSpan: 7,
          styles: { fontStyle: "bold", fillColor: REPORT_COLORS.navy, textColor: REPORT_COLORS.headText, fontSize: 9.5 },
        },
      ]);

      let dayTotal = 0;
      let dayCount = 0;

      const sortedVinculos = Object.keys(dayGroup.byVinculo).sort((a, b) => a.localeCompare(b));

      sortedVinculos.forEach((vincKey) => {
        const vincLabels = vincKey === "Sem vínculo" ? [] : vincKey.split(" | ");
        const vinculoCell = buildVinculoCell(vincLabels);

        // Vínculo subheader (no subtotal)
        tableData.push([
          {
            content: vincLabels.length ? vinculoCell.content.split("\n").join("   •   ") : vincKey,
            colSpan: 7,
            styles: {
              fontStyle: "bold",
              fontSize: 8.5,
              fillColor: vinculoCell.styles.fillColor || REPORT_COLORS.goldSoft,
              textColor: vinculoCell.styles.textColor || REPORT_COLORS.navy,
            },
          },
        ]);

        dayGroup.byVinculo[vincKey].forEach((account) => {
          const base = [
            account.description,
            account.employees?.name || account.suppliers?.name || "N/A",
            account.stores?.name || "N/A",
            new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
            account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
            account.total_installments > 1
              ? `${account.installment_number}/${account.total_installments}`
              : "À vista",
          ];

          // Contas suspensas com fonte em vermelho para destaque
          if (account.is_suspended) {
            tableData.push([
              ...base.map((content) => ({ content, styles: { textColor: [220, 38, 38] } })),
              { content: vinculoCell.content, styles: { ...vinculoCell.styles, textColor: [220, 38, 38] } },
            ]);
          } else {
            tableData.push([...base.map((content) => ({ content, styles: {} })), vinculoCell]);
          }

          dayTotal += account.amount || 0;
          dayCount += 1;
        });
      });

      // Day subtotal
      tableData.push([
        {
          content: "Subtotal do dia",
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: dayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: `${dayCount} parcela(s)`,
          styles: { fontStyle: "bold", halign: "center", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        { content: "", styles: { fillColor: REPORT_COLORS.zebra } },
      ]);

      grandTotal += dayTotal;
      totalInstallments += dayCount;
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas", "Vínculo"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 7.5 },
        columnStyles: {
          3: { halign: "center", cellWidth: 22 },
          4: { halign: "right", cellWidth: 26 },
          5: { halign: "center", cellWidth: 18 },
          6: { cellWidth: 70 },
        },
      }),
    });

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, [
      { label: "Total geral", value: formatCurrencyBRL(grandTotal), emphasis: true },
      { label: "Dias", value: String(sortedDays.length) },
      { label: "Parcelas", value: String(totalInstallments) },
    ]);
    layout.finalize();

    doc.save("contas-a-pagar-dia-animal.pdf");
  };

  const exportToPDFDetalhado = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Analítico",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Build table data with product details
    const tableData: any[] = [];

    sortedAccounts.forEach((account) => {
      // Contas suspensas com fonte em vermelho para destaque
      const suspendedColor = account.is_suspended ? { textColor: [220, 38, 38] } : {};
      // Main account row
      tableData.push([
        { content: account.description, styles: { fontStyle: "bold", ...suspendedColor } },
        { content: account.employees?.name || account.suppliers?.name || "N/A", styles: { fontStyle: "bold", ...suspendedColor } },
        { content: account.stores?.name || "N/A", styles: { fontStyle: "bold", ...suspendedColor } },
        {
          content: new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          styles: { fontStyle: "bold", ...suspendedColor },
        },
        {
          content: account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          styles: { fontStyle: "bold", ...suspendedColor },
        },
        {
          content:
            account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
          styles: { fontStyle: "bold", ...suspendedColor },
        },
      ]);

      // Product detail rows
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const productName = item.products?.name || "Produto não encontrado";
          const subgroupName = item.products?.account_groups?.name || "-";
          const quantity = item.quantity || 0;
          const unitPrice =
            item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          const totalPrice =
            item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

          tableData.push([
            { content: "", styles: { fontSize: 8 } },
            { content: `   ${productName}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: subgroupName, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: `${quantity}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: totalPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: unitPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } },
          ]);
        });
      }
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
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

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-a-pagar-detalhado.pdf");
  };

  const exportToPDFPorSubgrupo = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Agrupado por Subgrupo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by subgroup
    const accountsBySubgroup: { [key: string]: { subgroupName: string; items: any[] } } = {};

    sortedAccounts.forEach((account: any) => {
      // Calculate the installment proportion for parcelado accounts
      // For installment accounts: proportion = installment_amount / total_title_amount
      // Interest and discounts are applied fully to each installment

      let installmentProportion = 1; // Default: full amount (à vista)
      let interestAmount = 0;
      let discountAmount = 0;

      if (account.total_installments > 1) {
        // This is a parcelado account - calculate proportion
        // We need to get the original total amount (sum of all installments or total_amount)
        const originalTotalAmount = account.total_amount || account.amount * account.total_installments;

        if (originalTotalAmount > 0) {
          // Get the installment base amount (without interest/discount adjustments from payments)
          const installmentBaseAmount = originalTotalAmount / account.total_installments;
          installmentProportion = installmentBaseAmount / originalTotalAmount;
        }

        // Check for interest/discount from payments on this specific installment
        const payments = account.accounts_payable_payments || [];
        if (payments.length > 0) {
          payments.forEach((payment: any) => {
            interestAmount += payment.interest_amount || 0;
            discountAmount += payment.discount_amount || 0;
          });
        }
      } else {
        // À vista - check for interest/discount
        const payments = account.accounts_payable_payments || [];
        if (payments.length > 0) {
          payments.forEach((payment: any) => {
            interestAmount += payment.interest_amount || 0;
            discountAmount += payment.discount_amount || 0;
          });
        }
      }

      // Process items
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        // Calculate total of all items to distribute interest/discount proportionally
        const totalItemsValue = account.accounts_payable_items.reduce(
          (sum: number, item: any) => sum + (item.total_price || 0),
          0,
        );

        account.accounts_payable_items.forEach((item: any) => {
          const subgroupId = item.products?.subgroup_id || "sem-subgrupo";
          const subgroupName = item.products?.account_groups?.name || "Sem Subgrupo";

          if (!accountsBySubgroup[subgroupId]) {
            accountsBySubgroup[subgroupId] = {
              subgroupName,
              items: [],
            };
          }

          // Calculate proportional item amount for this installment
          let itemAmount = (item.total_price || 0) * installmentProportion;

          // Distribute interest/discount proportionally to items based on their value
          if (totalItemsValue > 0 && (interestAmount > 0 || discountAmount > 0)) {
            const itemProportion = (item.total_price || 0) / totalItemsValue;
            itemAmount += interestAmount * itemProportion - discountAmount * itemProportion;
          }

          accountsBySubgroup[subgroupId].items.push({
            description: account.description,
            supplierName: account.employees?.name || account.suppliers?.name || "N/A",
            storeName: account.stores?.name || "N/A",
            dueDate: account.due_date,
            amount: itemAmount,
            productName: item.products?.name || "Produto",
            installmentInfo:
              account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : null,
          });
        });
      } else {
        // No items - add to "Sem Subgrupo"
        if (!accountsBySubgroup["sem-subgrupo"]) {
          accountsBySubgroup["sem-subgrupo"] = {
            subgroupName: "Sem Subgrupo",
            items: [],
          };
        }

        // For accounts without items, use the already adjusted amount
        accountsBySubgroup["sem-subgrupo"].items.push({
          description: account.description,
          supplierName: account.employees?.name || account.suppliers?.name || "N/A",
          storeName: account.stores?.name || "N/A",
          dueDate: account.due_date,
          amount: account.amount || 0,
          productName: null,
          installmentInfo:
            account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : null,
        });
      }
    });

    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;

    Object.values(accountsBySubgroup).forEach((group) => {
      // Subgroup header row
      tableData.push([
        {
          content: group.subgroupName,
          colSpan: 5,
          styles: {
            fontStyle: "bold",
            fillColor: REPORT_COLORS.goldSoft,
            textColor: REPORT_COLORS.navy,
            fontSize: 9.5,
          },
        },
      ]);

      // Items for this subgroup
      let subgroupTotal = 0;
      group.items.forEach((item) => {
        tableData.push([
          item.description,
          item.supplierName,
          item.storeName,
          item.dueDate ? new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "N/A",
          item.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        ]);
        subgroupTotal += item.amount || 0;
      });

      // Subgroup subtotal
      tableData.push([
        {
          content: `Subtotal ${group.subgroupName}`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
        {
          content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", halign: "right", fillColor: REPORT_COLORS.zebra, textColor: REPORT_COLORS.navy },
        },
      ]);

      grandTotal += subgroupTotal;
    });

    autoTable(doc, {
      head: [["Descrição", "Fornecedor", "Fazenda", "Vencimento", "Valor"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", cellWidth: 30 },
        },
      }),
    });

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, [
      { label: "Total geral", value: formatCurrencyBRL(grandTotal), emphasis: true },
      { label: "Subgrupos", value: String(Object.keys(accountsBySubgroup).length) },
      { label: "Parcelas", value: String(sortedAccounts.length) },
    ]);
    layout.finalize();

    doc.save("contas-a-pagar-por-subgrupo.pdf");
  };

  const fetchAllocationDetailsForAccounts = async (accountsList: any[]) => {
    // Collect all item IDs from all accounts
    const allItemIds: string[] = [];
    accountsList.forEach((account) => {
      if (account.accounts_payable_items) {
        account.accounts_payable_items.forEach((item: any) => {
          allItemIds.push(item.id);
        });
      }
    });

    if (allItemIds.length === 0) return new Map<string, string[]>();

    // Fetch allocations with linked entity names
    const { data: allocations } = await supabase
      .from("accounts_payable_item_allocations")
      .select(`
        account_payable_item_id,
        allocation_type,
        animal_id,
        aspiration_id,
        pregnancy_id,
        recipient_id,
        semen_id,
        animals:animal_id(name, code),
        aspiration_management:aspiration_id(name, code),
        pregnancy_management:pregnancy_id(name, code),
        semen_ref:semen_id(name, code)
      `)
      .in("account_payable_item_id", allItemIds);

    const recipientIds = Array.from(
      new Set((allocations || []).map((alloc: any) => alloc.recipient_id).filter(Boolean)),
    ) as string[];

    const { data: recipients } = recipientIds.length > 0
      ? await supabase.from("animals").select("id, name, code").in("id", recipientIds)
      : { data: [] as any[] };

    const recipientMap = new Map((recipients || []).map((recipient: any) => [recipient.id, `${recipient.code} - ${recipient.name}`]));

    // Build a map: account_payable_id -> allocation details
    const itemToAccount = new Map<string, string>();
    accountsList.forEach((account) => {
      if (account.accounts_payable_items) {
        account.accounts_payable_items.forEach((item: any) => {
          itemToAccount.set(item.id, account.id);
        });
      }
    });

    const accountAllocations = new Map<
      string,
      {
        labels: Set<string>;
        linkedNames: Set<string>;
        types: Set<string>;
      }
    >();

    (allocations || []).forEach((alloc: any) => {
      const accountId = itemToAccount.get(alloc.account_payable_item_id);
      if (!accountId) return;

      if (!accountAllocations.has(accountId)) {
        accountAllocations.set(accountId, {
          labels: new Set(),
          linkedNames: new Set(),
          types: new Set(),
        });
      }

      let label = "";
      let linkedName = "";
      let typeLabel = "";
      if (alloc.animal_id && alloc.animals) {
        typeLabel = "Animal";
        linkedName = `${(alloc.animals as any).code} - ${(alloc.animals as any).name}`;
        label = `Animal: ${(alloc.animals as any).code} - ${(alloc.animals as any).name}`;
      } else if (alloc.aspiration_id && alloc.aspiration_management) {
        typeLabel = "Aspiração";
        linkedName = `${(alloc.aspiration_management as any).code} - ${(alloc.aspiration_management as any).name}`;
        label = `Aspiração: ${(alloc.aspiration_management as any).code} - ${(alloc.aspiration_management as any).name}`;
      } else if (alloc.pregnancy_id && alloc.pregnancy_management) {
        typeLabel = "Prenhez";
        linkedName = `${(alloc.pregnancy_management as any).code} - ${(alloc.pregnancy_management as any).name}`;
        label = `Prenhez: ${(alloc.pregnancy_management as any).code} - ${(alloc.pregnancy_management as any).name}`;
      } else if (alloc.recipient_id && recipientMap.has(alloc.recipient_id)) {
        typeLabel = "Receptora";
        linkedName = recipientMap.get(alloc.recipient_id) || "";
        label = `Receptora: ${recipientMap.get(alloc.recipient_id)}`;
      } else if (alloc.semen_id && alloc.semen_ref) {
        typeLabel = "Sêmen";
        linkedName = `${(alloc.semen_ref as any).code} - ${(alloc.semen_ref as any).name}`;
        label = `Sêmen: ${(alloc.semen_ref as any).code} - ${(alloc.semen_ref as any).name}`;
      }

      if (label) {
        const details = accountAllocations.get(accountId)!;
        details.labels.add(label);
        if (linkedName) details.linkedNames.add(linkedName);
        if (typeLabel) details.types.add(typeLabel);
      }
    });

    const result = new Map<string, AccountAllocationDetail>();
    accountAllocations.forEach((details, accountId) => {
      result.set(accountId, {
        labels: Array.from(details.labels),
        linkedNames: Array.from(details.linkedNames),
        types: Array.from(details.types),
      });
    });
    return result;
  };

  const fetchAllocationsForAccounts = async (accountsList: any[]) => {
    const detailsMap = await fetchAllocationDetailsForAccounts(accountsList);
    const labelsMap = new Map<string, string[]>();

    detailsMap.forEach((details, accountId) => {
      labelsMap.set(accountId, details.labels);
    });

    return labelsMap;
  };

  /**
   * Monta a célula de vínculo exibindo cada item como uma tag: "[PRENHEZ] 26 - LUANA".
   * Quando todos os vínculos são do mesmo tipo, a célula recebe as cores do badge.
   */
  const buildVinculoCell = (vinculos: string[]) => {
    if (!vinculos.length) return { content: "-", styles: {} as Record<string, any> };

    const parsed = vinculos.map((label) => {
      const separatorIndex = label.indexOf(":");
      const tipo = separatorIndex === -1 ? label : label.slice(0, separatorIndex);
      const descricao = separatorIndex === -1 ? "" : label.slice(separatorIndex + 1).trim();
      const badge = getVinculoBadge(tipo);
      return { badge, line: descricao ? `[${badge.label}] ${descricao}` : `[${badge.label}]` };
    });

    const content = parsed.map((item) => item.line).join("\n");
    const uniqueTypes = new Set(parsed.map((item) => item.badge.label));

    if (uniqueTypes.size === 1) {
      const { badge } = parsed[0];
      return { content, styles: { textColor: badge.color, fillColor: badge.soft, fontStyle: "bold" } };
    }

    return { content, styles: {} as Record<string, any> };
  };

  const exportToPDFResumidoComVinculo = async () => {
    const allocMap = await fetchAllocationsForAccounts(sortedAccounts);

    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas a Pagar",
      subtitle: "Contas ainda não pagas — Resumido com Vínculo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    const tableData: any[] = sortedAccounts.map((account) => {
      const vinculos = allocMap.get(account.id) || [];
      const base = [
        account.description,
        account.employees?.name || account.suppliers?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
      ];
      const vinculoCell = buildVinculoCell(vinculos);

      // Contas suspensas com fonte em vermelho para destaque
      if (account.is_suspended) {
        return [
          ...base.map((content) => ({ content, styles: { textColor: [220, 38, 38] } })),
          { content: vinculoCell.content, styles: { ...vinculoCell.styles, textColor: [220, 38, 38] } },
        ];
      }

      return [...base.map((content) => ({ content, styles: {} })), vinculoCell];
    });

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas", "Vínculo"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 7.5 },
        columnStyles: {
          3: { halign: "center", cellWidth: 22 },
          4: { halign: "right", cellWidth: 26 },
          5: { halign: "center", cellWidth: 18 },
          6: { cellWidth: 70 },
        },
      }),
    });

    const finalY = (doc as PdfDocWithAutoTable).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-a-pagar-resumido-com-vinculo.pdf");
  };

  const exportToExcel = () => {
    const excelData = sortedAccounts.map((account) => ({
      Título: account.description,
      Fornecedor: account.employees?.name || account.suppliers?.name || "N/A",
      Fazenda: account.stores?.name || "N/A",
      Vencimento: new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
      Valor: account.amount || 0,
      Parcelas:
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, "contas-a-pagar.xlsx");
  };

  const sortOptions = [
    { value: "none", label: "Padrão" },
    { value: "due_date", label: "Vencimento" },
    { value: "supplier", label: "Fornecedor" },
    { value: "amount", label: "Valor" },
    { value: "status", label: "Status" },
    { value: "created_at", label: "Data de cadastro" },
  ];

  const sortedAccountsTotal = React.useMemo(
    () => sortedAccounts.reduce((sum, account) => sum + (account.amount || 0), 0),
    [sortedAccounts],
  );

  const getAccountTitle = (account: any) => account.document_number || account.description || "Sem identificação";

  const getAccountSubtitle = (account: any) => {
    if (account.document_number && account.description && account.document_number !== account.description) {
      return account.description;
    }

    return account.document_type || null;
  };

  const getInstallmentLabel = (account: any) =>
    account.total_installments > 1
      ? `${account.installment_number}/${account.total_installments}`
      : "À vista";

  const getAccountCategory = (account: any) =>
    joinValues(
      (account.accounts_payable_items || []).map((item: any) => item.products?.category_name)
    ) || account.chart_of_accounts?.account_groups?.name || null;

  const getAccountSubcategory = (account: any) =>
    joinValues(
      (account.accounts_payable_items || []).map((item: any) => item.products?.account_groups?.name)
    );

  const getAccountProducts = (account: any) =>
    joinValues((account.accounts_payable_items || []).map((item: any) => item.products?.name));

  const getAccountAllocation = (accountId: string) => accountAllocationDetails.get(accountId);

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
            <h1 className="text-2xl font-bold text-primary">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas ainda não pagas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="hidden md:block">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Configure os filtros para o relatório</CardDescription>
          </CardHeader>

          <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} className="md:hidden">
            <div className="border-b border-border/70 px-4 py-4">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="group h-auto w-full justify-between rounded-xl px-0 py-0 text-left hover:bg-transparent"
                >
                  <div className="space-y-2">
                    <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Filter className="h-4 w-4" />
                      Filtros
                    </span>
                    <p className="pr-4 text-sm leading-relaxed text-muted-foreground">{mobileFilterSummary}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="due_start_mobile">Data Vencimento (Início)</Label>
                    <Input
                      id="due_start_mobile"
                      type="date"
                      value={filters.due_start}
                      onChange={(e) => setFilters((prev) => ({ ...prev, due_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="due_end_mobile">Data Vencimento (Fim)</Label>
                    <Input
                      id="due_end_mobile"
                      type="date"
                      value={filters.due_end}
                      onChange={(e) => setFilters((prev) => ({ ...prev, due_end: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="competencia_start_mobile">Data Competência (Início)</Label>
                    <Input
                      id="competencia_start_mobile"
                      type="date"
                      value={filters.competencia_start}
                      onChange={(e) => setFilters((prev) => ({ ...prev, competencia_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="competencia_end_mobile">Data Competência (Fim)</Label>
                    <Input
                      id="competencia_end_mobile"
                      type="date"
                      value={filters.competencia_end}
                      onChange={(e) => setFilters((prev) => ({ ...prev, competencia_end: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="created_start_mobile">Data Cadastro (Início)</Label>
                    <Input
                      id="created_start_mobile"
                      type="date"
                      value={filters.created_start}
                      onChange={(e) => setFilters((prev) => ({ ...prev, created_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="created_end_mobile">Data Cadastro (Fim)</Label>
                    <Input
                      id="created_end_mobile"
                      type="date"
                      value={filters.created_end}
                      onChange={(e) => setFilters((prev) => ({ ...prev, created_end: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fornecedor</Label>
                    <Select
                      value={filters.supplier_id}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, supplier_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fazenda</Label>
                    <Select
                      value={filters.store_id}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, store_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar fazenda" />
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
                    <Select
                      value={filters.product_id}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Vínculo</Label>
                    <Select value={allocationType} onValueChange={(value) => setAllocationType(value)}>
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-suspended-mobile"
                      checked={filters.include_suspended}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({ ...prev, include_suspended: checked === true }))
                      }
                    />
                    <label htmlFor="include-suspended-mobile" className="cursor-pointer text-sm font-medium">
                      Incluir contas suspensas
                    </label>
                  </div>
                  {allocationType !== "none" && allocationItems.length > 0 && (
                    <div>
                      <Label>
                        {allocationType === "aspiration"
                          ? "Aspirações"
                          : allocationType === "pregnancy"
                            ? "Prenhez"
                            : allocationType === "recipient"
                              ? "Receptoras"
                              : allocationType === "semen"
                                ? "Sêmen"
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
                          <div className="border-b p-2">
                            <Input
                              placeholder="Buscar pelo nome..."
                              value={allocationSearch}
                              onChange={(e) => setAllocationSearch(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="border-b p-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="select-all-mobile"
                                checked={selectedAllocationIds.length === allocationItems.length && allocationItems.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedAllocationIds(allocationItems.map((item) => item.id));
                                  } else {
                                    setSelectedAllocationIds([]);
                                  }
                                }}
                              />
                              <label htmlFor="select-all-mobile" className="cursor-pointer text-sm font-medium">
                                Selecionar todos
                              </label>
                            </div>
                          </div>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-1 p-2">
                              {allocationItems
                                .filter((item) => item.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                                .map((item) => (
                                  <div key={item.id} className="flex items-center space-x-2 py-1">
                                    <Checkbox
                                      id={`alloc-mobile-${item.id}`}
                                      checked={selectedAllocationIds.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedAllocationIds((prev) => [...prev, item.id]);
                                        } else {
                                          setSelectedAllocationIds((prev) => prev.filter((id) => id !== item.id));
                                        }
                                      }}
                                    />
                                    <label htmlFor={`alloc-mobile-${item.id}`} className="cursor-pointer text-sm">
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button onClick={handleSearch} disabled={loading} className="w-full">
                    {loading ? "Pesquisando..." : "Pesquisar"}
                  </Button>
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>

          <CardContent className="hidden space-y-4 md:block">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="due_start">Data Vencimento (Início)</Label>
                <Input
                  id="due_start"
                  type="date"
                  value={filters.due_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, due_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="due_end">Data Vencimento (Fim)</Label>
                <Input
                  id="due_end"
                  type="date"
                  value={filters.due_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, due_end: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_start">Data Competência (Início)</Label>
                <Input
                  id="competencia_start"
                  type="date"
                  value={filters.competencia_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, competencia_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_end">Data Competência (Fim)</Label>
                <Input
                  id="competencia_end"
                  type="date"
                  value={filters.competencia_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, competencia_end: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="created_start">Data Cadastro (Início)</Label>
                <Input
                  id="created_start"
                  type="date"
                  value={filters.created_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, created_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="created_end">Data Cadastro (Fim)</Label>
                <Input
                  id="created_end"
                  type="date"
                  value={filters.created_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, created_end: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Select
                  value={filters.supplier_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, supplier_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fazenda</Label>
                <Select
                  value={filters.store_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, store_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar Fazenda" />
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
                <Select
                  value={filters.product_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, product_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Vínculo</Label>
                <Select value={allocationType} onValueChange={(value) => setAllocationType(value)}>
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
              <div className="flex items-center space-x-2 self-end pb-2">
                <Checkbox
                  id="include-suspended"
                  checked={filters.include_suspended}
                  onCheckedChange={(checked) =>
                    setFilters((prev) => ({ ...prev, include_suspended: checked === true }))
                  }
                />
                <label htmlFor="include-suspended" className="cursor-pointer text-sm font-medium">
                  Incluir contas suspensas
                </label>
              </div>
              {allocationType !== "none" && allocationItems.length > 0 && (
                <div>
                  <Label>
                    {allocationType === "aspiration"
                      ? "Aspirações"
                      : allocationType === "pregnancy"
                        ? "Prenhez"
                        : allocationType === "recipient"
                          ? "Receptoras"
                          : allocationType === "semen"
                            ? "Sêmen"
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
                      <div className="border-b p-2">
                        <Input
                          placeholder="Buscar pelo nome..."
                          value={allocationSearch}
                          onChange={(e) => setAllocationSearch(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="border-b p-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all"
                            checked={selectedAllocationIds.length === allocationItems.length && allocationItems.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAllocationIds(allocationItems.map((item) => item.id));
                              } else {
                                setSelectedAllocationIds([]);
                              }
                            }}
                          />
                          <label htmlFor="select-all" className="cursor-pointer text-sm font-medium">
                            Selecionar todos
                          </label>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px]">
                        <div className="space-y-1 p-2">
                          {allocationItems
                            .filter((item) => item.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                            .map((item) => (
                              <div key={item.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`alloc-${item.id}`}
                                  checked={selectedAllocationIds.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedAllocationIds((prev) => [...prev, item.id]);
                                    } else {
                                      setSelectedAllocationIds((prev) => prev.filter((id) => id !== item.id));
                                    }
                                  }}
                                />
                                <label htmlFor={`alloc-${item.id}`} className="cursor-pointer text-sm">
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
        {hasSearched && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="hidden md:block">Contas a Pagar ({accounts.length})</CardTitle>
                  <div className="space-y-1 md:hidden">
                    <CardTitle className="text-xl leading-tight">Contas a Pagar</CardTitle>
                    <CardDescription>{accounts.length} registros encontrados</CardDescription>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between md:w-auto">
                          <FileDown className="mr-2 h-4 w-4" />
                          PDF
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={exportToPDFResumido}>Relatório Resumido</DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFDetalhado}>PDF Analítico</DropdownMenuItem>
                        <DropdownMenuItem onClick={openSyntheticPdfModal}>PDF Sintético</DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFPorSubgrupo}>Relatório por Subgrupo</DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFResumidoPorMes}>
                          Relatório Resumido por Mês
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFResumidoPorDia}>
                          Relatório Resumido por Dia
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFResumidoComVinculo}>
                          Relatório Resumido com Vínculo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDFPorDiaVinculo}>
                          Relatório Dia/Animal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={exportToExcel} variant="outline" size="sm" className="w-full md:w-auto">
                      <Download className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                  </div>

                  <div className="grid gap-2 md:hidden sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mobile-sort-column">Ordenar por</Label>
                      <Select
                        value={sortColumn || "none"}
                        onValueChange={(value) => setSortColumn(value === "none" ? null : value)}
                      >
                        <SelectTrigger id="mobile-sort-column">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mobile-sort-direction">Direção</Label>
                      <Select
                        value={sortDirection}
                        onValueChange={(value: "asc" | "desc") => setSortDirection(value)}
                      >
                        <SelectTrigger id="mobile-sort-direction">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Crescente</SelectItem>
                          <SelectItem value="desc">Decrescente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 md:hidden">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-muted-foreground">Total encontrado</span>
                  <span className="text-base font-semibold text-foreground">
                    {formatCurrencyBRL(sortedAccountsTotal)}
                  </span>
                </div>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("description")}>
                        Título {getSortIcon("description")}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("supplier")}>
                        Fornecedor {getSortIcon("supplier")}
                      </TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("due_date")}>
                        Vencimento {getSortIcon("due_date")}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("amount")}>
                        Valor {getSortIcon("amount")}
                      </TableHead>
                      <TableHead>Parcelas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                          Nenhuma movimentação encontrada para os filtros informados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {sortedAccounts.map((account, index) => (
                          <TableRow
                            key={`${account.id}-${account.installment_id || index}`}
                            className={cn(account.is_suspended && "text-red-600")}
                          >
                            <TableCell>{account.description}</TableCell>
                            <TableCell>{account.employees?.name || account.suppliers?.name || "N/A"}</TableCell>
                            <TableCell>{account.stores?.name || "N/A"}</TableCell>
                            <TableCell>{new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell>
                              {account.amount?.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }) || "N/A"}
                            </TableCell>
                            <TableCell>{getInstallmentLabel(account)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 bg-muted/50 font-bold">
                          <TableCell colSpan={4} className="text-right">
                            Total:
                          </TableCell>
                          <TableCell>{formatCurrencyBRL(sortedAccountsTotal)}</TableCell>
                          <TableCell>{sortedAccounts.length} parcela(s)</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {sortedAccounts.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex min-h-[160px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação encontrada para os filtros informados.
                    </CardContent>
                  </Card>
                ) : (
                  sortedAccounts.map((account, index) => {
                    const allocation = getAccountAllocation(account.id);
                    const statusMeta = getAccountStatusMeta(account);

                    return (
                      <MobileReportCard
                        key={`${account.id}-${account.installment_id || index}`}
                        title={
                          <span className={cn(account.is_suspended && "text-red-600")}>
                            {getAccountTitle(account)}
                          </span>
                        }
                        subtitle={getAccountSubtitle(account)}
                        badge={
                          <Badge variant="outline" className={cn("font-medium", statusMeta.className)}>
                            {statusMeta.label}
                          </Badge>
                        }
                        titleAside={
                          <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                              Valor
                            </p>
                            <p className="text-base font-semibold text-primary">
                              {formatCurrencyBRL(account.amount || 0)}
                            </p>
                          </div>
                        }
                        summaryFields={[
                          {
                            label: "Fornecedor",
                            value: account.employees?.name || account.suppliers?.name,
                          },
                          {
                            label: "Vencimento",
                            value: account.due_date ? formatDateBR(account.due_date) : null,
                          },
                          {
                            label: "Status",
                            value: statusMeta.label,
                          },
                        ]}
                        detailFields={[
                          {
                            label: "Fazenda",
                            value: account.stores?.name,
                          },
                          {
                            label: "Documento",
                            value: account.document_number,
                          },
                          {
                            label: "Categoria",
                            value: getAccountCategory(account),
                          },
                          {
                            label: "Subcategoria",
                            value: getAccountSubcategory(account),
                          },
                          {
                            label: "Conta",
                            value: account.chart_of_accounts
                              ? `${account.chart_of_accounts.code} - ${account.chart_of_accounts.name}`
                              : null,
                          },
                          {
                            label: "Competência",
                            value: account.data_competencia ? formatDateBR(account.data_competencia) : null,
                          },
                          {
                            label: "Forma de pagamento",
                            value: getInstallmentLabel(account),
                          },
                          {
                            label: "Data de cadastro",
                            value: account.created_at ? formatDateTimeBR(account.created_at) : null,
                          },
                          {
                            label: "Data de pagamento",
                            value: account.payment_date ? formatDateBR(account.payment_date) : null,
                          },
                          {
                            label: "Observação",
                            value: account.notes,
                          },
                          {
                            label: "Projeto/vínculo",
                            value: allocation?.linkedNames.join(" • "),
                          },
                          {
                            label: "Produto/vínculo",
                            value: getAccountProducts(account),
                          },
                          {
                            label: "Tipo de vínculo",
                            value: allocation?.types.join(" • "),
                          },
                        ]}
                      />
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={syntheticPdfModalOpen} onOpenChange={setSyntheticPdfModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>PDF Sintético</DialogTitle>
              <DialogDescription>
                Informe o intervalo em dias para agrupar os subtotais do PDF sintético.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
                <p className="font-medium text-foreground">Período selecionado</p>
                <p className="mt-1 text-muted-foreground">
                  {filters.due_start && filters.due_end
                    ? `${formatDateBR(filters.due_start)} até ${formatDateBR(filters.due_end)}`
                    : "Período de vencimento não informado."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  O relatório exibirá apenas os dias com movimento, mantendo o cabeçalho completo de cada bloco.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="synthetic-interval-days">Intervalo de dias</Label>
                <Input
                  id="synthetic-interval-days"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={syntheticIntervalDays}
                  onChange={(event) => setSyntheticIntervalDays(event.target.value)}
                  placeholder="15"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSyntheticPdfModalOpen(false)}
                disabled={syntheticPdfLoading}
              >
                Cancelar
              </Button>
              <Button onClick={() => void handleGenerateSyntheticPdf()} disabled={syntheticPdfLoading}>
                {syntheticPdfLoading ? "Gerando PDF..." : "Confirmar / Gerar PDF"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AccountsPayableReport;
