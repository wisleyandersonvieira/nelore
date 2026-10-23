// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  DollarSign,
  Droplets,
  Eye,
  FlaskConical,
  Package2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { fetchAccessibleStoreScope, formatCurrencyBRL } from "@/lib/sales";
import { getFinancialAllocationLabel } from "@/lib/financialAllocations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SemenRecord {
  id: string;
  code: number;
  store_id: string;
  name: string;
  auction_id: string | null;
  auction_lot: string | null;
  quantity_initial: number;
  breed_id: string | null;
  sire_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SemenUtilization {
  id: string;
  semen_id: string;
  utilization_date: string;
  description: string | null;
  quantity_used: number;
  created_at: string;
  updated_at: string;
}

interface BreedOption {
  id: string;
  name: string;
}

interface AuctionOption {
  id: string;
  name: string;
}

interface BreedingAnimalOption {
  id: string;
  name: string;
  sex: string;
  sire_id: string | null;
  dam_id: string | null;
}

interface FinancialRecord {
  id: string;
  document_number: string | null;
  due_date: string;
  payment_date: string | null;
  status: string;
  supplier_name: string | null;
  allocation_type: string;
  item_total_price: number;
  account_payable_id: string;
  paid_amount: number;
  record_type: "expense" | "revenue";
}

type ModalMode = "create" | "edit" | "view";
type StockStatus = "available" | "low" | "zero";

const ITEMS_PER_PAGE = 12;

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  return format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
};

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const getStockStatusMeta = (quantityInitial: number, quantityUsed: number) => {
  const available = Math.max(Number(quantityInitial || 0) - Number(quantityUsed || 0), 0);
  const lowStockLimit = quantityInitial > 0 ? Math.max(1, Math.ceil(quantityInitial * 0.2)) : 0;

  if (available <= 0) {
    return {
      available,
      status: "zero" as StockStatus,
      label: "Zerado",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (available <= lowStockLimit) {
    return {
      available,
      status: "low" as StockStatus,
      label: "Baixo estoque",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    available,
    status: "available" as StockStatus,
    label: "Disponível",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

const AnimaisSemen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<SemenRecord[]>([]);
  const [usageTotals, setUsageTotals] = useState<Record<string, number>>({});
  const [breeds, setBreeds] = useState<BreedOption[]>([]);
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [sires, setSires] = useState<BreedingAnimalOption[]>([]);
  const [allBreedingAnimals, setAllBreedingAnimals] = useState<BreedingAnimalOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [activeTab, setActiveTab] = useState("dados");
  const [selectedRecord, setSelectedRecord] = useState<SemenRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SemenRecord | null>(null);
  const [usageDeleteOpen, setUsageDeleteOpen] = useState(false);
  const [usageToDelete, setUsageToDelete] = useState<SemenUtilization | null>(null);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageSaving, setUsageSaving] = useState(false);
  const [usages, setUsages] = useState<SemenUtilization[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | StockStatus>("all");
  const [scope, setScope] = useState<{ storeIds: string[] | null; defaultStoreId: string | null; matrixId: string | null }>({
    storeIds: [],
    defaultStoreId: null,
    matrixId: null,
  });

  const [formData, setFormData] = useState({
    code: null as number | null,
    name: "",
    auction_id: "",
    auction_lot: "",
    quantity_initial: "0",
    breed_id: "",
    sire_id: "",
  });

  const [usageForm, setUsageForm] = useState({
    id: "",
    utilization_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    quantity_used: "",
  });

  const resetForm = () => {
    setFormData({
      code: null,
      name: "",
      auction_id: "",
      auction_lot: "",
      quantity_initial: "0",
      breed_id: "",
      sire_id: "",
    });
  };

  const resetUsageForm = () => {
    setUsageForm({
      id: "",
      utilization_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      quantity_used: "",
    });
  };

  const fetchScope = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { storeIds: [] as string[], defaultStoreId: null as string | null, matrixId: null as string | null };
    }

    const { storeIds, defaultStoreId } = await fetchAccessibleStoreScope();
    const { data: profile } = await supabase
      .from("profiles")
      .select("matrix_id")
      .eq("id", user.id)
      .maybeSingle();

    let resolvedDefaultStoreId = defaultStoreId;

    if (!resolvedDefaultStoreId) {
      const query = supabase.from("stores").select("id").order("name").limit(1);
      const { data: storeData } =
        Array.isArray(storeIds) && storeIds.length > 0
          ? await query.in("id", storeIds)
          : await query;
      resolvedDefaultStoreId = storeData?.[0]?.id || null;
    }

    return {
      storeIds,
      defaultStoreId: resolvedDefaultStoreId,
      matrixId: profile?.matrix_id || null,
    };
  };

  const fetchDropdownData = async (nextScope: { storeIds: string[] | null; defaultStoreId: string | null; matrixId: string | null }) => {
    const { matrixId, storeIds } = nextScope;

    let breedsQuery = supabase.from("animal_breeds").select("id, name").eq("is_active", true);
    let auctionsQuery = supabase.from("leiloes").select("id, name").eq("is_active", true);
    let breedingQuery = supabase
      .from("breeding_animals")
      .select("id, name, sex, sire_id, dam_id")
      .eq("is_active", true)
      .eq("sex", "macho")
      .order("name");
    let allBreedingQuery = supabase
      .from("breeding_animals")
      .select("id, name, sex, sire_id, dam_id")
      .eq("is_active", true)
      .order("name");

    if (matrixId) {
      breedsQuery = breedsQuery.eq("matrix_id", matrixId);
      auctionsQuery = auctionsQuery.eq("matrix_id", matrixId);
      breedingQuery = breedingQuery.eq("matrix_id", matrixId);
      allBreedingQuery = allBreedingQuery.eq("matrix_id", matrixId);
    } else if (storeIds && storeIds.length > 0) {
      breedsQuery = breedsQuery.in("store_id", storeIds);
      auctionsQuery = auctionsQuery.in("store_id", storeIds);
      breedingQuery = breedingQuery.in("store_id", storeIds);
      allBreedingQuery = allBreedingQuery.in("store_id", storeIds);
    }

    const [breedsRes, auctionsRes, siresRes, allBreedingRes] = await Promise.all([
      breedsQuery.order("name"),
      auctionsQuery.order("name"),
      breedingQuery,
      allBreedingQuery,
    ]);

    setBreeds((breedsRes.data || []) as BreedOption[]);
    setAuctions((auctionsRes.data || []) as AuctionOption[]);
    setSires((siresRes.data || []) as BreedingAnimalOption[]);
    setAllBreedingAnimals((allBreedingRes.data || []) as BreedingAnimalOption[]);
  };

  const fetchRecords = async (nextScope?: { storeIds: string[] | null; defaultStoreId: string | null; matrixId: string | null }) => {
    const resolvedScope = nextScope || scope;
    setLoading(true);

    try {
      let query = supabase.from("semen" as any).select("*").order("code", { ascending: false });
      if (resolvedScope.storeIds && resolvedScope.storeIds.length > 0) {
        query = query.in("store_id", resolvedScope.storeIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const nextRecords = ((data || []) as SemenRecord[]).map((record) => ({
        ...record,
        quantity_initial: Number(record.quantity_initial || 0),
      }));

      setRecords(nextRecords);

      if (nextRecords.length === 0) {
        setUsageTotals({});
        return;
      }

      const recordIds = nextRecords.map((record) => record.id);
      const { data: usageData, error: usageError } = await supabase
        .from("semen_utilizations" as any)
        .select("semen_id, quantity_used")
        .in("semen_id", recordIds);

      if (usageError) throw usageError;

      const nextTotals = (usageData || []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.semen_id] = (acc[row.semen_id] || 0) + Number(row.quantity_used || 0);
        return acc;
      }, {});

      setUsageTotals(nextTotals);
    } catch (error: any) {
      console.error("Erro ao carregar sêmen:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível carregar o módulo de sêmen.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUtilizations = async (recordId: string) => {
    setUsageLoading(true);
    try {
      const { data, error } = await supabase
        .from("semen_utilizations" as any)
        .select("*")
        .eq("semen_id", recordId)
        .order("utilization_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsages(((data || []) as SemenUtilization[]).map((item) => ({
        ...item,
        quantity_used: Number(item.quantity_used || 0),
      })));
    } catch (error) {
      console.error("Erro ao carregar utilizações:", error);
      setUsages([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchFinancial = async (recordId: string) => {
    setLoadingFinancial(true);
    try {
      const { data: expenseAllocations, error } = await supabase
        .from("accounts_payable_item_allocations")
        .select(`
          id,
          allocation_type,
          account_payable_item_id,
          accounts_payable_items!inner (
            total_price,
            account_payable_id,
            accounts_payable!inner (
              id,
              document_number,
              due_date,
              payment_date,
              status,
              supplier_id,
              purchase_id
            )
          )
        `)
        .eq("semen_id", recordId);

      if (error) throw error;

      const supplierIds = Array.from(
        new Set((expenseAllocations || []).map((allocation: any) => allocation.accounts_payable_items?.accounts_payable?.supplier_id).filter(Boolean)),
      );

      const { data: suppliers } =
        supplierIds.length > 0
          ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
          : { data: [] as Array<{ id: string; name: string }> };

      const suppliersMap = new Map((suppliers || []).map((supplier) => [supplier.id, supplier.name]));

      const payableIds = Array.from(
        new Set((expenseAllocations || []).map((allocation: any) => allocation.accounts_payable_items?.accounts_payable?.id).filter(Boolean)),
      );

      const paidAmountsMap = new Map<string, number>();
      if (payableIds.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: payments } = await supabase
          .from("accounts_payable_payments")
          .select("account_payable_id, amount_paid, payment_date")
          .in("account_payable_id", payableIds)
          .lte("payment_date", today);

        (payments || []).forEach((payment: any) => {
          paidAmountsMap.set(
            payment.account_payable_id,
            (paidAmountsMap.get(payment.account_payable_id) || 0) + Number(payment.amount_paid || 0),
          );
        });
      }

      // Para compras de sêmen com múltiplos itens, buscar o valor individual de cada sêmen
      const purchaseIds = Array.from(
        new Set(
          (expenseAllocations || [])
            .map((allocation: any) => allocation.accounts_payable_items?.accounts_payable?.purchase_id)
            .filter(Boolean),
        ),
      );

      const semenAmountByPurchase = new Map<string, number>();
      const purchaseTotalsMap = new Map<string, number>();
      if (purchaseIds.length > 0) {
        const { data: semenItems } = await supabase
          .from("purchase_semen_items")
          .select("purchase_id, semen_id, amount")
          .in("purchase_id", purchaseIds);

        (semenItems || []).forEach((it: any) => {
          purchaseTotalsMap.set(
            it.purchase_id,
            (purchaseTotalsMap.get(it.purchase_id) || 0) + Number(it.amount || 0),
          );
          if (it.semen_id === recordId) {
            semenAmountByPurchase.set(
              it.purchase_id,
              (semenAmountByPurchase.get(it.purchase_id) || 0) + Number(it.amount || 0),
            );
          }
        });
      }

      const nextFinancialRecords: FinancialRecord[] = (expenseAllocations || []).map((allocation: any) => {
        const item = allocation.accounts_payable_items;
        const payable = item?.accounts_payable;
        const payableId = payable?.id || "";
        const purchaseId = payable?.purchase_id || "";

        const individualAmount = purchaseId ? semenAmountByPurchase.get(purchaseId) : undefined;
        const itemTotal = individualAmount !== undefined ? individualAmount : Number(item?.total_price || 0);

        // Rateia o valor pago proporcionalmente quando vários sêmens compartilham a mesma conta
        const totalPurchaseSemen = purchaseId ? purchaseTotalsMap.get(purchaseId) : undefined;
        const fullPaid = paidAmountsMap.get(payableId) || 0;
        const paidAmount =
          individualAmount !== undefined && totalPurchaseSemen && totalPurchaseSemen > 0
            ? fullPaid * (individualAmount / totalPurchaseSemen)
            : fullPaid;

        return {
          id: allocation.id,
          document_number: payable?.document_number || null,
          due_date: payable?.due_date || "",
          payment_date: payable?.payment_date || null,
          status: payable?.status || "",
          supplier_name: payable?.supplier_id ? suppliersMap.get(payable.supplier_id) || null : null,
          allocation_type: allocation.allocation_type,
          item_total_price: itemTotal,
          account_payable_id: payableId,
          paid_amount: paidAmount,
          record_type: "expense",
        };
      });

      setFinancialRecords(nextFinancialRecords);
    } catch (error) {
      console.error("Erro ao carregar financeiro do sêmen:", error);
      setFinancialRecords([]);
    } finally {
      setLoadingFinancial(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const nextScope = await fetchScope();
        setScope(nextScope);
        await Promise.all([fetchDropdownData(nextScope), fetchRecords(nextScope)]);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const used = usageTotals[record.id] || 0;
      const stockMeta = getStockStatusMeta(record.quantity_initial, used);
      const matchesSearch =
        !normalizedSearch ||
        record.name.toLowerCase().includes(normalizedSearch) ||
        String(record.code).includes(normalizedSearch) ||
        (record.auction_lot || "").toLowerCase().includes(normalizedSearch);
      const matchesStock = stockFilter === "all" || stockMeta.status === stockFilter;

      return matchesSearch && matchesStock;
    });
  }, [records, searchTerm, stockFilter, usageTotals]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));

  const summaryCards = useMemo(() => {
    const totals = records.reduce(
      (acc, record) => {
        const used = usageTotals[record.id] || 0;
        const stockMeta = getStockStatusMeta(record.quantity_initial, used);

        acc.totalInitial += Number(record.quantity_initial || 0);
        acc.totalAvailable += stockMeta.available;
        acc.totalRecords += 1;

        if (stockMeta.status === "low") acc.lowStock += 1;
        if (stockMeta.status === "zero") acc.zeroStock += 1;

        return acc;
      },
      { totalInitial: 0, totalAvailable: 0, totalRecords: 0, lowStock: 0, zeroStock: 0 },
    );

    return totals;
  }, [records, usageTotals]);

  const currentUsageTotal = useMemo(
    () => usages.reduce((sum, item) => sum + Number(item.quantity_used || 0), 0),
    [usages],
  );

  const currentStockMeta = useMemo(() => {
    if (!selectedRecord) {
      return getStockStatusMeta(0, 0);
    }

    return getStockStatusMeta(selectedRecord.quantity_initial, currentUsageTotal);
  }, [currentUsageTotal, selectedRecord]);

  const getEditableUsageBalance = () => {
    const currentUsage = usageForm.id
      ? usages.find((item) => item.id === usageForm.id)?.quantity_used || 0
      : 0;

    return currentStockMeta.available + currentUsage;
  };

  const handleOpenModal = async (mode: ModalMode, record?: SemenRecord) => {
    setModalMode(mode);
    setActiveTab("dados");
    setFinancialRecords([]);
    setUsages([]);
    resetUsageForm();
    setFinancialViewMode("geral");

    if (mode === "create") {
      setSelectedRecord(null);
      resetForm();
      setModalOpen(true);
      return;
    }

    if (!record) return;

    setSelectedRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      auction_id: record.auction_id || "",
      auction_lot: record.auction_lot || "",
      quantity_initial: String(Number(record.quantity_initial || 0)),
      breed_id: record.breed_id || "",
      sire_id: record.sire_id || "",
    });

    await Promise.all([fetchUtilizations(record.id), fetchFinancial(record.id)]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;

    const quantityInitial = Number(formData.quantity_initial || 0);

    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome / descrição é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(quantityInitial) || quantityInitial < 0) {
      toast({
        title: "Erro",
        description: "Quantidade deve ser maior ou igual a zero.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRecord && !scope.defaultStoreId) {
      toast({
        title: "Erro",
        description: "Não foi possível identificar a fazenda padrão do usuário.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const payload = {
        store_id: selectedRecord?.store_id || scope.defaultStoreId,
        name: formData.name.trim(),
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot.trim() || null,
        quantity_initial: quantityInitial,
        breed_id: formData.breed_id || null,
        sire_id: formData.sire_id || null,
        created_by: selectedRecord ? undefined : user.id,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("semen" as any).insert(payload as any);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Sêmen cadastrado com sucesso." });
      } else if (selectedRecord) {
        const { error } = await supabase.from("semen" as any).update(payload as any).eq("id", selectedRecord.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cadastro de sêmen atualizado com sucesso." });
      }

      setModalOpen(false);
      await fetchRecords();
    } catch (error: any) {
      console.error("Erro ao salvar sêmen:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível salvar o cadastro de sêmen.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;

    try {
      const [{ data: usageData }, { data: payableData }, { data: purchaseData }] = await Promise.all([
        supabase.from("semen_utilizations" as any).select("id").eq("semen_id", recordToDelete.id).limit(1),
        supabase.from("accounts_payable_item_allocations").select("id").eq("semen_id", recordToDelete.id).limit(1),
        supabase.from("purchases").select("id").eq("semen_id", recordToDelete.id).limit(1),
      ]);

      if ((usageData || []).length > 0) {
        toast({
          title: "Exclusão não permitida",
          description: "Este sêmen possui utilizações registradas no estoque.",
          variant: "destructive",
        });
        return;
      }

      if ((payableData || []).length > 0 || (purchaseData || []).length > 0) {
        toast({
          title: "Exclusão não permitida",
          description: "Este sêmen possui vínculos financeiros cadastrados.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("semen" as any).delete().eq("id", recordToDelete.id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Sêmen excluído com sucesso." });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      await fetchRecords();
    } catch (error: any) {
      console.error("Erro ao excluir sêmen:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível excluir o sêmen.",
        variant: "destructive",
      });
    }
  };

  const handleSaveUsage = async () => {
    if (!selectedRecord || usageSaving) return;

    const quantityUsed = Number(usageForm.quantity_used || 0);
    const editableBalance = getEditableUsageBalance();

    if (!usageForm.utilization_date) {
      toast({
        title: "Erro",
        description: "Data da utilização é obrigatória.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(quantityUsed) || quantityUsed <= 0) {
      toast({
        title: "Erro",
        description: "Quantidade utilizada deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (quantityUsed > editableBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "Quantidade utilizada não pode ser maior que o saldo disponível.",
        variant: "destructive",
      });
      return;
    }

    setUsageSaving(true);
    try {
      const payload = {
        semen_id: selectedRecord.id,
        utilization_date: usageForm.utilization_date,
        description: usageForm.description.trim() || null,
        quantity_used: quantityUsed,
      };

      if (usageForm.id) {
        const { error } = await supabase
          .from("semen_utilizations" as any)
          .update(payload as any)
          .eq("id", usageForm.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Utilização atualizada com sucesso." });
      } else {
        const { error } = await supabase.from("semen_utilizations" as any).insert(payload as any);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Utilização registrada com sucesso." });
      }

      resetUsageForm();
      await Promise.all([fetchUtilizations(selectedRecord.id), fetchRecords()]);
    } catch (error: any) {
      console.error("Erro ao salvar utilização:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível salvar a utilização.",
        variant: "destructive",
      });
    } finally {
      setUsageSaving(false);
    }
  };

  const handleDeleteUsage = async () => {
    if (!usageToDelete || !selectedRecord) return;

    try {
      const { error } = await supabase.from("semen_utilizations" as any).delete().eq("id", usageToDelete.id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Utilização removida com sucesso." });
      setUsageDeleteOpen(false);
      setUsageToDelete(null);
      resetUsageForm();
      await Promise.all([fetchUtilizations(selectedRecord.id), fetchRecords()]);
    } catch (error: any) {
      console.error("Erro ao excluir utilização:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível excluir a utilização.",
        variant: "destructive",
      });
    }
  };

  const filteredFinancialRecords = useMemo(() => {
    if (financialViewMode === "geral") {
      return financialRecords;
    }

    return financialRecords
      .filter((record) => record.paid_amount > 0 || record.status === "paid")
      .map((record) => ({
        ...record,
        paid_amount: record.paid_amount > 0 ? record.paid_amount : record.item_total_price,
      }));
  }, [financialRecords, financialViewMode]);

  const selectedSire = formData.sire_id
    ? allBreedingAnimals.find((animal) => animal.id === formData.sire_id) || null
    : null;
  const sireFather = selectedSire?.sire_id
    ? allBreedingAnimals.find((animal) => animal.id === selectedSire.sire_id) || null
    : null;
  const sireMother = selectedSire?.dam_id
    ? allBreedingAnimals.find((animal) => animal.id === selectedSire.dam_id) || null
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/animais")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Sêmen</h1>
              <p className="text-sm text-muted-foreground">Carregando módulo...</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/animais")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Sêmen</h1>
              <p className="text-sm text-muted-foreground">
                Controle de cadastro, genealogia, financeiro e estoque de sêmen.
              </p>
            </div>
          </div>

          <Button onClick={() => void handleOpenModal("create")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo sêmen
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Cadastros ativos</CardDescription>
              <CardTitle className="text-2xl">{summaryCards.totalRecords}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <FlaskConical className="h-4 w-4" />
              Registros cadastrados no módulo
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Quantidade inicial</CardDescription>
              <CardTitle className="text-2xl">{formatQuantity(summaryCards.totalInitial)}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package2 className="h-4 w-4" />
              Doses/unidades cadastradas
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Saldo disponível</CardDescription>
              <CardTitle className="text-2xl">{formatQuantity(summaryCards.totalAvailable)}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Droplets className="h-4 w-4" />
              Estoque disponível no momento
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardDescription>Alertas de estoque</CardDescription>
              <CardTitle className="text-2xl">
                {summaryCards.lowStock + summaryCards.zeroStock}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              {summaryCards.lowStock} baixo e {summaryCards.zeroStock} zerado
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Listagem de sêmen</CardTitle>
            <CardDescription>
              Consulte o estoque, acompanhe o saldo e acesse rapidamente cadastro, financeiro e utilizações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr]">
              <div className="space-y-2">
                <Label>Pesquisar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Buscar por código, nome, descrição ou lote"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status de estoque</Label>
                <Select
                  value={stockFilter}
                  onValueChange={(value: "all" | StockStatus) => {
                    setStockFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="low">Baixo estoque</SelectItem>
                    <SelectItem value="zero">Zerado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome / Descrição</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Leilão</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="text-right">Qtd. inicial</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                        Nenhum sêmen encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((record) => {
                      const used = usageTotals[record.id] || 0;
                      const stockMeta = getStockStatusMeta(record.quantity_initial, used);

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">#{record.code}</TableCell>
                          <TableCell>{record.name}</TableCell>
                          <TableCell>{breeds.find((item) => item.id === record.breed_id)?.name || "-"}</TableCell>
                          <TableCell>{auctions.find((item) => item.id === record.auction_id)?.name || "-"}</TableCell>
                          <TableCell>{record.auction_lot || "-"}</TableCell>
                          <TableCell className="text-right">{formatQuantity(record.quantity_initial)}</TableCell>
                          <TableCell className="text-right">{formatQuantity(stockMeta.available)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={stockMeta.className}>
                              {stockMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="icon" onClick={() => void handleOpenModal("view", record)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => void handleOpenModal("edit", record)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setRecordToDelete(record);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Exibindo {paginatedRecords.length} de {filteredRecords.length} registro(s).
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[92dvh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-sky-600" />
              {modalMode === "create"
                ? "Novo cadastro de sêmen"
                : modalMode === "edit"
                  ? "Editar sêmen"
                  : "Visualizar sêmen"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full md:grid md:grid-cols-4">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="financeiro" disabled={modalMode === "create"}>
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="estoque" disabled={modalMode === "create"}>
                Estoque
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={formData.code ? `#${formData.code}` : "Automático"} disabled />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome / Descrição *</Label>
                  <Input
                    value={formData.name}
                    onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    disabled={modalMode === "view"}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Leilão</Label>
                  <Select
                    value={formData.auction_id || "_none"}
                    onValueChange={(value) =>
                      setFormData((current) => ({ ...current, auction_id: value === "_none" ? "" : value }))
                    }
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informado</SelectItem>
                      {auctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          {auction.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lote Leilão</Label>
                  <Input
                    value={formData.auction_lot}
                    onChange={(event) => setFormData((current) => ({ ...current, auction_lot: event.target.value }))}
                    disabled={modalMode === "view"}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.quantity_initial}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, quantity_initial: event.target.value }))
                    }
                    disabled={modalMode === "view"}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Raça</Label>
                  <Select
                    value={formData.breed_id || "_none"}
                    onValueChange={(value) =>
                      setFormData((current) => ({ ...current, breed_id: value === "_none" ? "" : value }))
                    }
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informada</SelectItem>
                      {breeds.map((breed) => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="genealogia" className="mt-4 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Reprodutor (Pai)</Label>
                  {modalMode === "view" ? (
                    <Input value={selectedSire?.name || ""} disabled />
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {selectedSire?.name || "Selecionar reprodutor"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Pesquisar reprodutor..." />
                          <CommandList>
                            <CommandEmpty>Nenhum reprodutor encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => setFormData((current) => ({ ...current, sire_id: "" }))}
                              >
                                <Check className={cn("mr-2 h-4 w-4", !formData.sire_id ? "opacity-100" : "opacity-0")} />
                                Limpar seleção
                              </CommandItem>
                              {sires.map((sire) => (
                                <CommandItem
                                  key={sire.id}
                                  value={sire.name}
                                  onSelect={() => setFormData((current) => ({ ...current, sire_id: sire.id }))}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", formData.sire_id === sire.id ? "opacity-100" : "opacity-0")} />
                                  {sire.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              {selectedSire && (
                <div className="space-y-4">
                  <h3 className="border-b pb-2 text-lg font-semibold">Avós (somente exibição)</h3>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Label className="w-20 text-xs text-muted-foreground">Avô:</Label>
                        <span className="text-sm">{sireFather?.name || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="w-20 text-xs text-muted-foreground">Avó:</Label>
                        <span className="text-sm">{sireMother?.name || "Não informada"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="financeiro" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <DollarSign className="h-5 w-5" />
                  Financeiro
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={financialViewMode === "geral" ? "default" : "outline"}
                    onClick={() => setFinancialViewMode("geral")}
                  >
                    Visualizar Geral
                  </Button>
                  <Button
                    size="sm"
                    variant={financialViewMode === "pagos" ? "default" : "outline"}
                    onClick={() => setFinancialViewMode("pagos")}
                  >
                    Pagos até Hoje
                  </Button>
                </div>
              </div>

              {loadingFinancial ? (
                <p className="py-8 text-center text-muted-foreground">Carregando lançamentos financeiros...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <h4 className="border-b pb-1 text-sm font-medium">Despesas</h4>
                    {filteredFinancialRecords.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhum lançamento financeiro vinculado a este sêmen.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número</TableHead>
                              <TableHead>Fornecedor</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Valor total</TableHead>
                              {financialViewMode === "pagos" && <TableHead className="text-right">Pago</TableHead>}
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Pagamento</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFinancialRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell>{record.document_number || "-"}</TableCell>
                                <TableCell>{record.supplier_name || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {getFinancialAllocationLabel(record.allocation_type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrencyBRL(record.item_total_price)}</TableCell>
                                {financialViewMode === "pagos" && (
                                  <TableCell className="text-right">{formatCurrencyBRL(record.paid_amount)}</TableCell>
                                )}
                                <TableCell>{formatDateBR(record.due_date)}</TableCell>
                                <TableCell>{formatDateBR(record.payment_date)}</TableCell>
                                <TableCell>
                                  <Badge variant={record.status === "paid" ? "default" : "secondary"}>
                                    {record.status === "paid"
                                      ? "Pago"
                                      : record.status === "partial"
                                        ? "Parcial"
                                        : "Pendente"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="border-b pb-1 text-sm font-medium">Receitas</h4>
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhuma receita vinculada a este sêmen no momento.
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-border/70">
                      <CardHeader className="pb-2">
                        <CardDescription>Total de despesas</CardDescription>
                        <CardTitle className="text-xl text-rose-700">
                          {formatCurrencyBRL(
                            filteredFinancialRecords.reduce((sum, record) => sum + record.item_total_price, 0),
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70">
                      <CardHeader className="pb-2">
                        <CardDescription>Total pago</CardDescription>
                        <CardTitle className="text-xl text-sky-700">
                          {formatCurrencyBRL(
                            filteredFinancialRecords.reduce((sum, record) => sum + record.paid_amount, 0),
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70">
                      <CardHeader className="pb-2">
                        <CardDescription>Saldo pendente</CardDescription>
                        <CardTitle className="text-xl">
                          {formatCurrencyBRL(
                            filteredFinancialRecords.reduce(
                              (sum, record) => sum + Math.max(record.item_total_price - record.paid_amount, 0),
                              0,
                            ),
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="estoque" className="mt-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardDescription>Quantidade inicial</CardDescription>
                    <CardTitle className="text-2xl">{formatQuantity(selectedRecord?.quantity_initial || 0)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardDescription>Quantidade utilizada</CardDescription>
                    <CardTitle className="text-2xl">{formatQuantity(currentUsageTotal)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardDescription>Saldo disponível</CardDescription>
                    <CardTitle className="text-2xl">{formatQuantity(currentStockMeta.available)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className={currentStockMeta.className}>
                      {currentStockMeta.label}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {currentStockMeta.available <= 0 && !usageForm.id && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  Estoque zerado. Não é possível registrar nova utilização.
                </div>
              )}

              <Card className="border-border/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">
                    {usageForm.id ? "Editar utilização" : "Registrar utilização"}
                  </CardTitle>
                  <CardDescription>
                    Cada utilização reduz o saldo disponível automaticamente e é validada no frontend e no banco.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Data da utilização *</Label>
                      <Input
                        type="date"
                        value={usageForm.utilization_date}
                        onChange={(event) =>
                          setUsageForm((current) => ({ ...current, utilization_date: event.target.value }))
                        }
                        disabled={modalMode === "view"}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Descrição</Label>
                      <Input
                        value={usageForm.description}
                        onChange={(event) =>
                          setUsageForm((current) => ({ ...current, description: event.target.value }))
                        }
                        disabled={modalMode === "view"}
                        placeholder="Ex.: utilização para coleta, IATF, teste..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.4fr_1fr]">
                    <div className="space-y-2">
                      <Label>Quantidade utilizada *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={usageForm.quantity_used}
                        onChange={(event) =>
                          setUsageForm((current) => ({ ...current, quantity_used: event.target.value }))
                        }
                        disabled={modalMode === "view"}
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <Button
                        onClick={() => void handleSaveUsage()}
                        disabled={modalMode === "view" || (!usageForm.id && currentStockMeta.available <= 0) || usageSaving}
                      >
                        {usageForm.id ? "Salvar alteração" : "Registrar utilização"}
                      </Button>
                      {usageForm.id && modalMode !== "view" && (
                        <Button variant="outline" onClick={resetUsageForm}>
                          Cancelar edição
                        </Button>
                      )}
                      <span className="text-sm text-muted-foreground">
                        Saldo considerado para esta edição: {formatQuantity(getEditableUsageBalance())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Histórico de utilizações</CardTitle>
                </CardHeader>
                <CardContent>
                  {usageLoading ? (
                    <p className="py-8 text-center text-muted-foreground">Carregando histórico...</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Quantidade utilizada</TableHead>
                            {modalMode !== "view" && <TableHead className="text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usages.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={modalMode === "view" ? 3 : 4}
                                className="h-24 text-center text-muted-foreground"
                              >
                                Nenhuma utilização registrada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            usages.map((usage) => (
                              <TableRow key={usage.id}>
                                <TableCell>{formatDateBR(usage.utilization_date)}</TableCell>
                                <TableCell>{usage.description || "-"}</TableCell>
                                <TableCell className="text-right">{formatQuantity(usage.quantity_used)}</TableCell>
                                {modalMode !== "view" && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                          setUsageForm({
                                            id: usage.id,
                                            utilization_date: usage.utilization_date,
                                            description: usage.description || "",
                                            quantity_used: String(usage.quantity_used),
                                          })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setUsageToDelete(usage);
                                          setUsageDeleteOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Fechar
            </Button>
            {modalMode !== "view" && (
              <Button onClick={() => void handleSave()} disabled={saving}>
                {modalMode === "create" ? "Salvar cadastro" : "Salvar alterações"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sêmen</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o cadastro somente se não houver utilizações ou vínculos financeiros relacionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={usageDeleteOpen} onOpenChange={setUsageDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir utilização</AlertDialogTitle>
            <AlertDialogDescription>
              O saldo será recalculado automaticamente após a exclusão desta utilização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteUsage()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisSemen;
