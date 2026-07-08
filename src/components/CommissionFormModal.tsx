import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Plus, PlusCircle, WalletCards, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SuppliersModal } from "@/components/SuppliersModal";
import { fetchAccessibleStoreScope, formatCurrencyBRL, generateSaleInstallments, SaleInstallmentDraft, sumInstallments } from "@/lib/sales";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";
import {
  buildCommissionItemLabel,
  calculateCommissionAmount,
  CommissionItemDraft,
  CommissionItemOption,
  CommissionItemType,
  CommissionKind,
  COMMISSION_ITEM_TYPE_LABELS,
  COMMISSION_ITEM_TYPE_OPTIONS,
  COMMISSION_KIND_LABELS,
  COMMISSION_KIND_OPTIONS,
  createCommissionWithPayable,
  roundMoney,
  sumCommissionItems,
  updateCommissionWithPayable,
} from "@/lib/commissions";

interface CommissionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
  mode: "create" | "edit" | "view";
  commissionId?: string | null;
}

interface AuctionOption {
  id: string;
  code: number;
  name: string;
  date: string;
  store_id: string;
}

interface SupplierOption {
  id: string;
  name: string;
  cnpj_cpf: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  code: string | null;
}

interface DocumentTypeOption {
  id: string;
  name: string;
  code: string;
}

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

interface CommissionRow {
  id: string;
  auction_id: string;
  supplier_id: string;
  product_id: string;
  commission_kind: CommissionKind;
  default_percentage: number;
  description: string;
  document_type: string | null;
  document_number: string | null;
  negotiation_method: string | null;
  commission_date: string;
  issue_date: string;
  competence_date: string;
  first_due_date: string;
  total_amount: number;
  installment_count: number;
  notes: string | null;
}

interface CommissionItemRow {
  id: string;
  source_type: "auction" | "manual";
  item_type: CommissionItemType;
  animal_id: string | null;
  pregnancy_id: string | null;
  aspiration_id: string | null;
  item_name: string;
  item_code: string | null;
  purchase_amount: number;
  commission_percentage: number;
  commission_amount: number;
  display_order: number;
}

interface PayableRow {
  id: string;
  due_date: string;
  issue_date: string | null;
  document_type: string | null;
  document_number: string | null;
  payment_date: string | null;
  status: string;
}

const todayISO = () => new Date().toISOString().split("T")[0];

const emptyItems: Record<CommissionItemType, CommissionItemOption[]> = {
  animal: [],
  pregnancy: [],
  aspiration: [],
};

const buildLocalItemId = (itemType: CommissionItemType, itemId: string) => `${itemType}:${itemId}`;

export function CommissionFormModal({
  open,
  onOpenChange,
  onSaved,
  mode,
  commissionId,
}: CommissionFormModalProps) {
  const { toast } = useToast();
  const { canEdit: canEditCadastros, canDelete: canDeleteCadastros } = useCadastrosPermissions();
  const readOnly = mode === "view";
  const [loading, setLoading] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [loadingAuctionItems, setLoadingAuctionItems] = useState(false);
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [debitProducts, setDebitProducts] = useState<ProductOption[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [itemOptions, setItemOptions] = useState<Record<CommissionItemType, CommissionItemOption[]>>(emptyItems);
  const [storesMap, setStoresMap] = useState<Record<string, StoreOption>>({});

  const [auctionPopoverOpen, setAuctionPopoverOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [extraItemPopoverOpen, setExtraItemPopoverOpen] = useState(false);

  const [auctionSearchTerm, setAuctionSearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [extraItemSearchTerm, setExtraItemSearchTerm] = useState("");

  const [auctionId, setAuctionId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [commissionKind, setCommissionKind] = useState<CommissionKind>("purchase");
  const [defaultPercentage, setDefaultPercentage] = useState("8");
  const [productId, setProductId] = useState("");
  const [commissionDate, setCommissionDate] = useState(todayISO());
  const [issueDate, setIssueDate] = useState(todayISO());
  const [competenceDate, setCompetenceDate] = useState(todayISO());
  const [firstDueDate, setFirstDueDate] = useState(todayISO());
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [negotiationMethod, setNegotiationMethod] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installments, setInstallments] = useState<SaleInstallmentDraft[]>([]);
  const [items, setItems] = useState<CommissionItemDraft[]>([]);

  const [extraItemType, setExtraItemType] = useState<CommissionItemType>("animal");
  const [extraItemId, setExtraItemId] = useState("");

  const resetForm = () => {
    const today = todayISO();
    setAuctionId("");
    setSupplierId("");
    setCommissionKind("purchase");
    setDefaultPercentage("8");
    setProductId("");
    setCommissionDate(today);
    setIssueDate(today);
    setCompetenceDate(today);
    setFirstDueDate(today);
    setDocumentType("");
    setDocumentNumber("");
    setNegotiationMethod("");
    setDescription("");
    setNotes("");
    setInstallmentCount(1);
    setInstallments([]);
    setItems([]);
    setExtraItemType("animal");
    setExtraItemId("");
    setAuctionPopoverOpen(false);
    setSupplierPopoverOpen(false);
    setExtraItemPopoverOpen(false);
    setAuctionSearchTerm("");
    setSupplierSearchTerm("");
    setExtraItemSearchTerm("");
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, cnpj_cpf")
      .eq("is_active", true)
      .eq("is_supplier", true)
      .order("name");

    if (error) {
      throw error;
    }

    setSuppliers((data || []) as SupplierOption[]);
  };

  const fetchAccumulatedPurchaseAmounts = async (
    selectedItems: Array<{ item_type: CommissionItemType; item_id: string }>,
    kind: CommissionKind,
  ) => {
    const amounts = new Map<string, number>();
    const animalIds = Array.from(new Set(selectedItems.filter((item) => item.item_type === "animal").map((item) => item.item_id)));
    const pregnancyIds = Array.from(new Set(selectedItems.filter((item) => item.item_type === "pregnancy").map((item) => item.item_id)));
    const aspirationIds = Array.from(new Set(selectedItems.filter((item) => item.item_type === "aspiration").map((item) => item.item_id)));

    if (animalIds.length === 0 && pregnancyIds.length === 0 && aspirationIds.length === 0) {
      return amounts;
    }

    const fillMap = (
      rows: Array<{ total_amount?: number; sale_value?: number; animal_id?: string | null; pregnancy_id?: string | null; aspiration_id?: string | null }>,
      type: CommissionItemType,
    ) => {
      rows.forEach((row) => {
        const targetId =
          type === "animal" ? row.animal_id : type === "pregnancy" ? row.pregnancy_id : row.aspiration_id;

        if (!targetId) return;
        const key = buildLocalItemId(type, targetId);
        const value = kind === "sale" ? row.sale_value : row.total_amount;
        amounts.set(key, roundMoney((amounts.get(key) || 0) + Number(value || 0)));
      });
    };

    if (kind === "sale") {
      const [animalSales, pregnancySales, aspirationSales] = await Promise.all([
        animalIds.length > 0
          ? supabase
              .from("animal_sales")
              .select("animal_id, sale_value, sale_date, created_at")
              .in("animal_id", animalIds)
              .order("sale_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        pregnancyIds.length > 0
          ? supabase
              .from("pregnancy_sales")
              .select("pregnancy_id, sale_value, sale_date, created_at")
              .in("pregnancy_id", pregnancyIds)
              .order("sale_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        aspirationIds.length > 0
          ? supabase
              .from("aspiration_sales")
              .select("aspiration_id, sale_value, sale_date, created_at")
              .in("aspiration_id", aspirationIds)
              .order("sale_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (animalSales.error) throw animalSales.error;
      if (pregnancySales.error) throw pregnancySales.error;
      if (aspirationSales.error) throw aspirationSales.error;

      fillMap((animalSales.data || []) as any[], "animal");
      fillMap((pregnancySales.data || []) as any[], "pregnancy");
      fillMap((aspirationSales.data || []) as any[], "aspiration");
    } else {
      const [animalPurchases, pregnancyPurchases, aspirationPurchases] = await Promise.all([
        animalIds.length > 0
          ? supabase
              .from("purchases")
              .select("animal_id, total_amount, purchase_date, created_at")
              .eq("purchase_type", "animal")
              .in("animal_id", animalIds)
              .order("purchase_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        pregnancyIds.length > 0
          ? supabase
              .from("purchases")
              .select("pregnancy_id, total_amount, purchase_date, created_at")
              .eq("purchase_type", "pregnancy")
              .in("pregnancy_id", pregnancyIds)
              .order("purchase_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        aspirationIds.length > 0
          ? supabase
              .from("purchases")
              .select("aspiration_id, total_amount, purchase_date, created_at")
              .eq("purchase_type", "aspiration")
              .in("aspiration_id", aspirationIds)
              .order("purchase_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (animalPurchases.error) throw animalPurchases.error;
      if (pregnancyPurchases.error) throw pregnancyPurchases.error;
      if (aspirationPurchases.error) throw aspirationPurchases.error;

      fillMap((animalPurchases.data || []) as any[], "animal");
      fillMap((pregnancyPurchases.data || []) as any[], "pregnancy");
      fillMap((aspirationPurchases.data || []) as any[], "aspiration");
    }

    return amounts;
  };

  const loadReferenceData = async () => {
    setLoadingReferenceData(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setAuctions([]);
        setSuppliers([]);
        setDebitProducts([]);
        setDocumentTypes([]);
        setItemOptions(emptyItems);
        setStoresMap({});
        return;
      }

      let storesQuery = supabase.from("stores").select("id, name, code").order("name");
      let auctionsQuery = supabase.from("leiloes").select("id, code, name, date, store_id").eq("is_active", true).order("date", { ascending: false });
      let animalsQuery = supabase.from("animals").select("id, name, code, store_id, category_id").order("name");
      let pregnanciesQuery = supabase.from("pregnancy_management").select("id, name, code, store_id").order("name");
      let aspirationsQuery = supabase.from("aspiration_management").select("id, name, code, store_id").order("name");

      if (storeIds && storeIds.length > 0) {
        storesQuery = storesQuery.in("id", storeIds);
        auctionsQuery = auctionsQuery.in("store_id", storeIds);
        animalsQuery = animalsQuery.in("store_id", storeIds);
        pregnanciesQuery = pregnanciesQuery.in("store_id", storeIds);
        aspirationsQuery = aspirationsQuery.in("store_id", storeIds);
      }

      const recipientCategoryIds = await fetchRecipientCategoryIds({
        storeIds: storeIds || undefined,
      });

      const suppliersPromise = loadSuppliers();

      const [storesRes, auctionsRes, productsRes, documentTypesRes, animalsRes, pregnanciesRes, aspirationsRes] = await Promise.all([
        storesQuery,
        auctionsQuery,
        supabase.from("products").select("id, name, code").eq("is_active", true).eq("function_type", "debit").order("name"),
        supabase.from("document_types").select("id, name, code").eq("is_active", true).order("code"),
        animalsQuery,
        pregnanciesQuery,
        aspirationsQuery,
      ]);

      if (storesRes.error) throw storesRes.error;
      if (auctionsRes.error) throw auctionsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (documentTypesRes.error) throw documentTypesRes.error;
      if (animalsRes.error) throw animalsRes.error;
      if (pregnanciesRes.error) throw pregnanciesRes.error;
      if (aspirationsRes.error) throw aspirationsRes.error;

      await suppliersPromise;

      const nextStoresMap = ((storesRes.data || []) as StoreOption[]).reduce<Record<string, StoreOption>>((acc, store) => {
        acc[store.id] = store;
        return acc;
      }, {});

      setStoresMap(nextStoresMap);
      setAuctions((auctionsRes.data || []) as AuctionOption[]);
      setDebitProducts((productsRes.data || []) as ProductOption[]);
      setDocumentTypes((documentTypesRes.data || []) as DocumentTypeOption[]);

      const animalOptions = ((animalsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
        category_id: string | null;
      }>)
        .filter((animal) => !animal.category_id || !recipientCategoryIds.includes(animal.category_id))
        .map((animal) => ({
          id: animal.id,
          item_type: "animal" as const,
          code: String(animal.code),
          name: animal.name,
          store_id: animal.store_id,
          store_name: nextStoresMap[animal.store_id]?.name || null,
        }));

      const pregnancyOptions = ((pregnanciesRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((item) => ({
        id: item.id,
        item_type: "pregnancy" as const,
        code: String(item.code),
        name: item.name,
        store_id: item.store_id,
        store_name: nextStoresMap[item.store_id]?.name || null,
      }));

      const aspirationOptions = ((aspirationsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((item) => ({
        id: item.id,
        item_type: "aspiration" as const,
        code: String(item.code),
        name: item.name,
        store_id: item.store_id,
        store_name: nextStoresMap[item.store_id]?.name || null,
      }));

      setItemOptions({
        animal: animalOptions,
        pregnancy: pregnancyOptions,
        aspiration: aspirationOptions,
      });
    } catch (error) {
      console.error("Erro ao carregar dados de referência das comissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários para a comissão.",
        variant: "destructive",
      });
    } finally {
      setLoadingReferenceData(false);
    }
  };

  const loadCommission = async (targetCommissionId: string) => {
    const { data: commissionRes, error: commissionError } = await supabase
      .from("commissions")
      .select("*")
      .eq("id", targetCommissionId)
      .single();

    if (commissionError) throw commissionError;

    const commission = commissionRes as unknown as CommissionRow;

    const [itemsRes, payableRes] = await Promise.all([
      supabase
        .from("commission_items")
        .select("*")
        .eq("commission_id", targetCommissionId)
        .order("display_order", { ascending: true }),
      supabase
        .from("accounts_payable")
        .select("id, due_date, issue_date, document_type, document_number, payment_date, status")
        .eq("commission_id", targetCommissionId)
        .maybeSingle(),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (payableRes.error) throw payableRes.error;

    const installmentsRes = payableRes.data
      ? await supabase
          .from("accounts_payable_installments")
          .select("installment_number, due_date, amount, payment_date")
          .eq("account_payable_id", payableRes.data.id)
          .order("installment_number", { ascending: true })
      : { data: [], error: null };

    if (installmentsRes.error) throw installmentsRes.error;

    setAuctionId(commission.auction_id);
    setSupplierId(commission.supplier_id);
    setCommissionKind(commission.commission_kind);
    setDefaultPercentage(String(commission.default_percentage));
    setProductId(commission.product_id);
    setCommissionDate(commission.commission_date);
    setIssueDate(commission.issue_date);
    setCompetenceDate(commission.competence_date);
    setFirstDueDate(commission.first_due_date);
    setDocumentType(commission.document_type || "");
    setDocumentNumber(commission.document_number || "");
    setNegotiationMethod(commission.negotiation_method || "");
    setDescription(commission.description || "");
    setNotes(commission.notes || "");
    setInstallmentCount(Number(commission.installment_count || 1));
    setInstallments(
      ((installmentsRes.data || []) as Array<{
        installment_number: number;
        due_date: string;
        amount: number;
        payment_date?: string | null;
      }>).map((item) => ({
        installment_number: item.installment_number,
        due_date: item.due_date,
        amount: Number(item.amount || 0),
        payment_date: item.payment_date || null,
      })),
    );
    setItems(
      ((itemsRes.data || []) as CommissionItemRow[]).map((item) => {
        const targetId =
          item.item_type === "animal"
            ? item.animal_id
            : item.item_type === "pregnancy"
              ? item.pregnancy_id
              : item.aspiration_id;

        return {
          local_id: buildLocalItemId(item.item_type, targetId || item.id),
          item_type: item.item_type,
          item_id: targetId || "",
          item_name: item.item_name,
          item_code: item.item_code,
          store_id: commissionRes.store_id,
          store_name: storesMap[commissionRes.store_id]?.name || null,
          source_type: item.source_type,
          selected: true,
          purchase_amount: Number(item.purchase_amount || 0),
          commission_percentage: Number(item.commission_percentage || 0),
          commission_amount: Number(item.commission_amount || 0),
        } satisfies CommissionItemDraft;
      }),
    );
  };

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    const initialize = async () => {
      resetForm();
      await loadReferenceData();
      if (commissionId) {
        setLoading(true);
        try {
          await loadCommission(commissionId);
        } catch (error) {
          console.error("Erro ao carregar comissão:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os dados da comissão.",
            variant: "destructive",
          });
          onOpenChange(false);
        } finally {
          setLoading(false);
        }
      }
    };

    void initialize();
  }, [open, commissionId]);

  const selectedAuction = auctions.find((auction) => auction.id === auctionId) || null;
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) || null;
  const selectedProduct = debitProducts.find((product) => product.id === productId) || null;

  const filteredAuctions = useMemo(
    () =>
      auctions.filter((auction) =>
        `${auction.code} ${auction.name}`.toLowerCase().includes(auctionSearchTerm.trim().toLowerCase()),
      ),
    [auctionSearchTerm, auctions],
  );

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierSearchTerm.trim().toLowerCase()),
      ),
    [supplierSearchTerm, suppliers],
  );

  const filteredExtraItems = useMemo(() => {
    const selectedStoreId = selectedAuction?.store_id;
    const search = extraItemSearchTerm.trim().toLowerCase();

    return itemOptions[extraItemType]
      .filter((item) => !selectedStoreId || item.store_id === selectedStoreId)
      .filter((item) => !items.some((current) => current.local_id === buildLocalItemId(current.item_type, current.item_id) && current.item_type === item.item_type && current.item_id === item.id))
      .filter((item) => {
        if (!search) return true;
        return buildCommissionItemLabel(item).toLowerCase().includes(search);
      });
  }, [extraItemSearchTerm, extraItemType, itemOptions, items, selectedAuction?.store_id]);

  const selectedExtraItem =
    extraItemId ? filteredExtraItems.find((item) => item.id === extraItemId) || null : null;

  const selectedItems = useMemo(() => items.filter((item) => item.selected), [items]);
  const totalCommissionAmount = useMemo(() => sumCommissionItems(items), [items]);
  const totalPurchaseAmount = useMemo(
    () => roundMoney(selectedItems.reduce((sum, item) => sum + Number(item.purchase_amount || 0), 0)),
    [selectedItems],
  );
  const installmentDifference = useMemo(
    () => Math.abs(sumInstallments(installments) - totalCommissionAmount),
    [installments, totalCommissionAmount],
  );

  const applyPercentageToItems = (value: string) => {
    setDefaultPercentage(value);
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;

    setItems((current) =>
      current.map((item) => ({
        ...item,
        commission_percentage: parsed,
        commission_amount: calculateCommissionAmount(item.purchase_amount, parsed),
      })),
    );
  };

  const upsertItems = (
    currentItems: CommissionItemDraft[],
    nextEntries: Array<Omit<CommissionItemDraft, "selected" | "commission_percentage" | "commission_amount">>,
    percentage: number,
  ) => {
    const nextMap = new Map(currentItems.map((item) => [item.local_id, item]));

    nextEntries.forEach((entry) => {
      if (nextMap.has(entry.local_id)) {
        const existing = nextMap.get(entry.local_id)!;
        nextMap.set(entry.local_id, {
          ...existing,
          ...entry,
          selected: existing.selected,
        });
        return;
      }

      nextMap.set(entry.local_id, {
        ...entry,
        selected: true,
        commission_percentage: percentage,
        commission_amount: calculateCommissionAmount(entry.purchase_amount, percentage),
      });
    });

    return Array.from(nextMap.values()).sort((left, right) =>
      (left.item_name || "").localeCompare(right.item_name || ""),
    );
  };

  const handleLoadAuctionItems = async () => {
    if (!auctionId || !selectedAuction) {
      toast({
        title: "Leilão obrigatório",
        description: "Selecione o leilão antes de carregar os cadastros relacionados.",
        variant: "destructive",
      });
      return;
    }

    setLoadingAuctionItems(true);
    try {
      let animalIds: string[] = [];
      let pregnancyIds: string[] = [];
      let aspirationIds: string[] = [];

      if (commissionKind === "sale") {
        // Vendas vinculadas ao leilão vivem em animal_sales/pregnancy_sales/aspiration_sales.
        const [aSales, pSales, asSales] = await Promise.all([
          supabase.from("animal_sales").select("animal_id").eq("auction_id", auctionId),
          supabase.from("pregnancy_sales").select("pregnancy_id").eq("auction_id", auctionId),
          supabase.from("aspiration_sales").select("aspiration_id").eq("auction_id", auctionId),
        ]);
        if (aSales.error) throw aSales.error;
        if (pSales.error) throw pSales.error;
        if (asSales.error) throw asSales.error;
        animalIds = Array.from(new Set((aSales.data || []).map((r: any) => r.animal_id).filter(Boolean)));
        pregnancyIds = Array.from(new Set((pSales.data || []).map((r: any) => r.pregnancy_id).filter(Boolean)));
        aspirationIds = Array.from(new Set((asSales.data || []).map((r: any) => r.aspiration_id).filter(Boolean)));
      } else {
        // Compras: itens cadastrados no leilão que possuem registro em purchases.
        const [animalsRes, pregnanciesRes, aspirationsRes] = await Promise.all([
          supabase.from("animals").select("id").eq("auction_id", auctionId),
          supabase.from("pregnancy_management").select("id").eq("auction_id", auctionId),
          supabase.from("aspiration_management").select("id").eq("auction_id", auctionId),
        ]);
        if (animalsRes.error) throw animalsRes.error;
        if (pregnanciesRes.error) throw pregnanciesRes.error;
        if (aspirationsRes.error) throw aspirationsRes.error;

        const aIds = (animalsRes.data || []).map((r: any) => r.id);
        const pIds = (pregnanciesRes.data || []).map((r: any) => r.id);
        const asIds = (aspirationsRes.data || []).map((r: any) => r.id);

        const [pAnimals, pPreg, pAsp] = await Promise.all([
          aIds.length ? supabase.from("purchases").select("animal_id").in("animal_id", aIds) : Promise.resolve({ data: [], error: null } as any),
          pIds.length ? supabase.from("purchases").select("pregnancy_id").in("pregnancy_id", pIds) : Promise.resolve({ data: [], error: null } as any),
          asIds.length ? supabase.from("purchases").select("aspiration_id").in("aspiration_id", asIds) : Promise.resolve({ data: [], error: null } as any),
        ]);
        if (pAnimals.error) throw pAnimals.error;
        if (pPreg.error) throw pPreg.error;
        if (pAsp.error) throw pAsp.error;

        animalIds = Array.from(new Set((pAnimals.data || []).map((r: any) => r.animal_id).filter(Boolean)));
        pregnancyIds = Array.from(new Set((pPreg.data || []).map((r: any) => r.pregnancy_id).filter(Boolean)));
        aspirationIds = Array.from(new Set((pAsp.data || []).map((r: any) => r.aspiration_id).filter(Boolean)));
      }

      const [animalsInfo, pregnanciesInfo, aspirationsInfo] = await Promise.all([
        animalIds.length
          ? supabase.from("animals").select("id, name, code, store_id").in("id", animalIds)
          : Promise.resolve({ data: [], error: null } as any),
        pregnancyIds.length
          ? supabase.from("pregnancy_management").select("id, name, code, store_id").in("id", pregnancyIds)
          : Promise.resolve({ data: [], error: null } as any),
        aspirationIds.length
          ? supabase.from("aspiration_management").select("id, name, code, store_id").in("id", aspirationIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (animalsInfo.error) throw animalsInfo.error;
      if (pregnanciesInfo.error) throw pregnanciesInfo.error;
      if (aspirationsInfo.error) throw aspirationsInfo.error;

      const animals = (animalsInfo.data || []) as Array<{ id: string; name: string; code: number; store_id: string }>;
      const pregnancies = (pregnanciesInfo.data || []) as Array<{ id: string; name: string; code: number; store_id: string }>;
      const aspirations = (aspirationsInfo.data || []) as Array<{ id: string; name: string; code: number; store_id: string }>;

      const rawItems = [
        ...animals.map((item) => ({
          item_type: "animal" as const,
          item_id: item.id,
          item_name: item.name,
          item_code: String(item.code),
          store_id: item.store_id,
          store_name: storesMap[item.store_id]?.name || null,
          source_type: "auction" as const,
        })),
        ...pregnancies.map((item) => ({
          item_type: "pregnancy" as const,
          item_id: item.id,
          item_name: item.name,
          item_code: String(item.code),
          store_id: item.store_id,
          store_name: storesMap[item.store_id]?.name || null,
          source_type: "auction" as const,
        })),
        ...aspirations.map((item) => ({
          item_type: "aspiration" as const,
          item_id: item.id,
          item_name: item.name,
          item_code: String(item.code),
          store_id: item.store_id,
          store_name: storesMap[item.store_id]?.name || null,
          source_type: "auction" as const,
        })),
      ];

      const purchaseAmounts = await fetchAccumulatedPurchaseAmounts(rawItems, commissionKind);
      const percentage = parseFloat(defaultPercentage) || 0;
      const nextEntries = rawItems.map((item) => ({
        ...item,
        local_id: buildLocalItemId(item.item_type, item.item_id),
        purchase_amount: purchaseAmounts.get(buildLocalItemId(item.item_type, item.item_id)) || 0,
      }));

      setItems((current) => upsertItems(current, nextEntries, percentage));

      if (rawItems.length === 0) {
        toast({
          title: "Nenhum cadastro encontrado",
          description: commissionKind === "sale"
            ? "Não existem vendas de animais, prenhezes ou aspirações vinculadas a este leilão."
            : "Não existem compras de animais, prenhezes ou aspirações vinculadas a este leilão.",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar cadastros do leilão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cadastros relacionados ao leilão.",
        variant: "destructive",
      });
    } finally {
      setLoadingAuctionItems(false);
    }
  };

  const handleAddExtraItem = async () => {
    if (!selectedAuction) {
      toast({
        title: "Leilão obrigatório",
        description: "Selecione o leilão antes de adicionar um cadastro extra.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedExtraItem) {
      toast({
        title: "Cadastro obrigatório",
        description: "Selecione o cadastro extra que será adicionado à comissão.",
        variant: "destructive",
      });
      return;
    }

    try {
      const key = buildLocalItemId(extraItemType, selectedExtraItem.id);
      const purchaseAmounts = await fetchAccumulatedPurchaseAmounts([{ item_type: extraItemType, item_id: selectedExtraItem.id }], commissionKind);
      const percentage = parseFloat(defaultPercentage) || 0;

      setItems((current) =>
        upsertItems(
          current,
          [
            {
              local_id: key,
              item_type: extraItemType,
              item_id: selectedExtraItem.id,
              item_name: selectedExtraItem.name,
              item_code: selectedExtraItem.code,
              store_id: selectedExtraItem.store_id,
              store_name: selectedExtraItem.store_name || null,
              source_type: "manual",
              purchase_amount: purchaseAmounts.get(key) || 0,
            },
          ],
          percentage,
        ),
      );

      setExtraItemId("");
      setExtraItemSearchTerm("");
      setExtraItemPopoverOpen(false);
    } catch (error) {
      console.error("Erro ao adicionar cadastro extra:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o cadastro extra à comissão.",
        variant: "destructive",
      });
    }
  };

  const handleToggleItem = (localId: string, checked: boolean) => {
    setItems((current) =>
      current.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              selected: checked,
            }
          : item,
      ),
    );
  };

  const handleRemoveItem = (localId: string) => {
    setItems((current) => current.filter((item) => item.local_id !== localId));
  };

  const handleUpdateItemAmount = (localId: string, value: string) => {
    const nextValue = roundMoney(Number(value || 0));
    setItems((current) =>
      current.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              commission_amount: nextValue,
            }
          : item,
      ),
    );
  };

  const handleGenerateInstallments = () => {
    if (!firstDueDate || totalCommissionAmount <= 0) {
      toast({
        title: "Parcelamento incompleto",
        description: "Informe a primeira data de vencimento e mantenha ao menos um item selecionado.",
        variant: "destructive",
      });
      return;
    }

    if (installmentCount < 1 || installmentCount > 36) {
      toast({
        title: "Quantidade inválida",
        description: "A comissão deve ter entre 1 e 36 parcelas.",
        variant: "destructive",
      });
      return;
    }

    setInstallments(generateSaleInstallments(totalCommissionAmount, installmentCount, firstDueDate));
  };

  const updateInstallment = (
    index: number,
    field: keyof SaleInstallmentDraft,
    value: string | number,
  ) => {
    setInstallments((current) =>
      current.map((installment, currentIndex) =>
        currentIndex === index
          ? {
              ...installment,
              [field]: field === "amount" ? Number(value) : value,
            }
          : installment,
      ),
    );
  };

  const handleSave = async () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }

    if (!auctionId || !supplierId || !productId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione leilão, fornecedor e produto financeiro antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const percentage = parseFloat(defaultPercentage);
    if (Number.isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast({
        title: "Percentual inválido",
        description: "Informe um percentual de comissão válido entre 0,01 e 100.",
        variant: "destructive",
      });
      return;
    }

    if (!commissionDate || !issueDate || !competenceDate || !firstDueDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Preencha as datas da comissão, emissão, competência e primeiro vencimento.",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: "Nenhum item selecionado",
        description: "Marque ao menos um cadastro para entrar no cálculo da comissão.",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.some((item) => Number(item.commission_amount || 0) <= 0)) {
      toast({
        title: "Valor inválido",
        description: "Todos os itens selecionados precisam ter valor de comissão maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const competenceValidation = await validateAccountsPayablePeriod.competencia(competenceDate);
    if (competenceValidation.blocked) {
      toast({
        title: "Período bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    const effectiveInstallments =
      installments.length > 0
        ? installments
        : generateSaleInstallments(totalCommissionAmount, installmentCount, firstDueDate);

    if (effectiveInstallments.length === 0) {
      toast({
        title: "Parcelamento inválido",
        description: "Gere ao menos uma parcela antes de salvar a comissão.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(sumInstallments(effectiveInstallments) - totalCommissionAmount) > 0.01) {
      toast({
        title: "Parcelas inconsistentes",
        description: "A soma das parcelas deve ser igual ao valor total da comissão.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        auctionId,
        supplierId,
        commissionKind,
        defaultPercentage: percentage,
        productId,
        commissionDate,
        issueDate,
        competenceDate,
        firstDueDate,
        documentType: documentType || undefined,
        documentNumber: documentNumber || undefined,
        description: description || undefined,
        notes: notes || undefined,
        negotiationMethod: negotiationMethod || undefined,
        items,
        installments: effectiveInstallments,
      };

      const result =
        mode === "edit" && commissionId
          ? await updateCommissionWithPayable({
              commissionId,
              ...payload,
            })
          : await createCommissionWithPayable(payload);

      toast({
        title: mode === "edit" ? "Comissão atualizada" : "Comissão registrada",
        description:
          result?.commission_code
            ? `Comissão #${result.commission_code} salva com vínculo automático no Contas a Pagar.`
            : "Comissão salva com vínculo automático no Contas a Pagar.",
      });

      await onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar comissão:", error);
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar a comissão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-indigo-600" />
            {mode === "create" ? "Registrar Comissão" : mode === "edit" ? "Editar Comissão" : "Visualizar Comissão"}
          </DialogTitle>
          <DialogDescription>
            O módulo de comissões gera automaticamente o Contas a Pagar e preserva o vínculo com os cadastros relacionados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Dados gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Leilão</Label>
                    <Popover open={auctionPopoverOpen} onOpenChange={setAuctionPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={readOnly || loadingReferenceData}>
                          <span className="truncate">
                            {selectedAuction ? `${selectedAuction.code} - ${selectedAuction.name}` : "Selecionar leilão"}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <div className="border-b p-2">
                          <Input
                            placeholder="Pesquisar leilão..."
                            value={auctionSearchTerm}
                            onChange={(event) => setAuctionSearchTerm(event.target.value)}
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredAuctions.map((auction) => (
                            <button
                              type="button"
                              key={auction.id}
                              className={cn(
                                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                auctionId === auction.id && "bg-accent font-medium",
                              )}
                              onClick={() => {
                                setAuctionId(auction.id);
                                setAuctionPopoverOpen(false);
                                if (!readOnly) {
                                  setItems([]);
                                  setInstallments([]);
                                  setExtraItemId("");
                                  setExtraItemSearchTerm("");
                                }
                              }}
                            >
                              <span className="font-medium">{auction.code} - {auction.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {storesMap[auction.store_id]?.name || "Fazenda não encontrada"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <div className="flex items-stretch gap-2">
                      <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 justify-between"
                            disabled={readOnly || loadingReferenceData}
                          >
                            <span className="truncate">
                              {selectedSupplier ? selectedSupplier.name : "Selecionar fornecedor"}
                            </span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <div className="border-b p-2">
                            <Input
                              placeholder="Pesquisar fornecedor..."
                              value={supplierSearchTerm}
                              onChange={(event) => setSupplierSearchTerm(event.target.value)}
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredSuppliers.map((supplier) => (
                              <button
                                type="button"
                                key={supplier.id}
                                className={cn(
                                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                  supplierId === supplier.id && "bg-accent font-medium",
                                )}
                                onClick={() => {
                                  setSupplierId(supplier.id);
                                  setSupplierPopoverOpen(false);
                                }}
                              >
                                <span>{supplier.name}</span>
                                {supplier.cnpj_cpf && (
                                  <span className="text-xs text-muted-foreground">{supplier.cnpj_cpf}</span>
                                )}
                              </button>
                            ))}
                            {filteredSuppliers.length === 0 && (
                              <div className="px-3 py-4 text-sm text-muted-foreground">
                                Nenhum fornecedor encontrado.
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {!readOnly && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          disabled={!canEditCadastros}
                          onClick={() => setSupplierModalOpen(true)}
                          aria-label="Cadastrar fornecedor"
                          title="Cadastrar fornecedor"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Tipo de comissão</Label>
                    <Select value={commissionKind} onValueChange={(value: CommissionKind) => setCommissionKind(value)} disabled={readOnly}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMISSION_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Percentual padrão (%)</Label>
                    <Input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={defaultPercentage}
                      onChange={(event) => applyPercentageToItems(event.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data da comissão</Label>
                    <Input
                      type="date"
                      value={commissionDate}
                      onChange={(event) => setCommissionDate(event.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {selectedAuction && (
                  <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                        {storesMap[selectedAuction.store_id]?.code || ""} {storesMap[selectedAuction.store_id]?.name || "Fazenda"}
                      </Badge>
                      <span className="font-medium text-foreground">{selectedAuction.code} - {selectedAuction.name}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {COMMISSION_KIND_LABELS[commissionKind]} com base nos cadastros vinculados ao leilão selecionado.
                    </p>
                  </div>
                )}

                {!readOnly && (
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={handleLoadAuctionItems} disabled={loadingAuctionItems || !auctionId}>
                      {loadingAuctionItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Carregar cadastros do leilão
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Itens da comissão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!readOnly && (
                  <div className="grid gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                    <div className="space-y-2">
                      <Label>Cadastro extra</Label>
                      <Select value={extraItemType} onValueChange={(value: CommissionItemType) => { setExtraItemType(value); setExtraItemId(""); setExtraItemSearchTerm(""); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMISSION_ITEM_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Buscar cadastro</Label>
                      <Popover open={extraItemPopoverOpen} onOpenChange={setExtraItemPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between" disabled={!auctionId}>
                            <span className="truncate">
                              {selectedExtraItem ? buildCommissionItemLabel(selectedExtraItem) : "Selecionar cadastro"}
                            </span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <div className="border-b p-2">
                            <Input
                              placeholder={`Pesquisar ${COMMISSION_ITEM_TYPE_LABELS[extraItemType].toLowerCase()}...`}
                              value={extraItemSearchTerm}
                              onChange={(event) => setExtraItemSearchTerm(event.target.value)}
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredExtraItems.map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                className={cn(
                                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                  extraItemId === item.id && "bg-accent",
                                )}
                                onClick={() => {
                                  setExtraItemId(item.id);
                                  setExtraItemPopoverOpen(false);
                                }}
                              >
                                <span className="font-medium">{buildCommissionItemLabel(item)}</span>
                                {item.store_name && (
                                  <span className="text-xs text-muted-foreground">{item.store_name}</span>
                                )}
                              </button>
                            ))}
                            {filteredExtraItems.length === 0 && (
                              <div className="px-3 py-4 text-sm text-muted-foreground">
                                Nenhum cadastro encontrado.
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-end">
                      <Button type="button" onClick={handleAddExtraItem} disabled={!extraItemId}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[54px]">Incluir</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">
                          {commissionKind === "sale" ? "Valor de venda" : "Valor de compra"}
                        </TableHead>
                        <TableHead className="text-right">% Comissão</TableHead>
                        <TableHead className="text-right">Valor comissão</TableHead>
                        {!readOnly && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={readOnly ? 7 : 8} className="h-28 text-center text-muted-foreground">
                            Carregue os cadastros do leilão ou adicione itens extras para montar a comissão.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.local_id} className={!item.selected ? "opacity-60" : undefined}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) => handleToggleItem(item.local_id, Boolean(checked))}
                                disabled={readOnly}
                              />
                            </TableCell>
                            <TableCell>{COMMISSION_ITEM_TYPE_LABELS[item.item_type]}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{buildCommissionItemLabel({ code: item.item_code, name: item.item_name })}</p>
                                {item.purchase_amount <= 0 && (
                                  <p className="text-xs text-amber-700">
                                    {commissionKind === "sale"
                                      ? "Sem valor de venda encontrado no módulo de vendas."
                                      : "Sem valor de compra encontrado no módulo de compras."}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.source_type === "auction" ? "Leilão" : "Manual"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(Number(item.purchase_amount || 0))}</TableCell>
                            <TableCell className="text-right">{Number(item.commission_percentage || 0).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">
                              {readOnly ? (
                                formatCurrencyBRL(Number(item.commission_amount || 0))
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.commission_amount}
                                  onChange={(event) => handleUpdateItemAmount(item.local_id, event.target.value)}
                                  className="ml-auto w-32 text-right"
                                  disabled={!item.selected}
                                />
                              )}
                            </TableCell>
                            {!readOnly && (
                              <TableCell className="text-right">
                                <div className="flex justify-end">
                                  {item.source_type === "manual" && (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.local_id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens selecionados</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedItems.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Base de compra</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrencyBRL(totalPurchaseAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total comissão</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrencyBRL(totalCommissionAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Dados financeiros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Produto financeiro</Label>
                    <Select value={productId} onValueChange={setProductId} disabled={readOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a classificação financeira" />
                      </SelectTrigger>
                      <SelectContent>
                        {debitProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.code ? `${product.code} - ${product.name}` : product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total da comissão</Label>
                    <Input value={formatCurrencyBRL(totalCommissionAmount)} readOnly disabled />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Emissão</Label>
                    <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência</Label>
                    <Input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-2">
                    <Label>Primeiro vencimento</Label>
                    <Input type="date" value={firstDueDate} onChange={(event) => setFirstDueDate(event.target.value)} disabled={readOnly} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de documento</Label>
                    <Select value={documentType} onValueChange={setDocumentType} disabled={readOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.code}>
                            {type.code} - {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Número do documento</Label>
                    <Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} disabled={readOnly} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Forma de negociação</Label>
                    <Input value={negotiationMethod} onChange={(event) => setNegotiationMethod(event.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      value={installmentCount}
                      onChange={(event) => setInstallmentCount(Number(event.target.value || 1))}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição financeira</Label>
                  <Input value={description} onChange={(event) => setDescription(event.target.value)} disabled={readOnly} />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={readOnly} rows={4} />
                </div>

                {!readOnly && (
                  <Button type="button" variant="outline" onClick={handleGenerateInstallments} disabled={totalCommissionAmount <= 0}>
                    Gerar parcelas
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Parcelamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                            Gere as parcelas para visualizar o contas a pagar antes de salvar.
                          </TableCell>
                        </TableRow>
                      ) : (
                        installments.map((installment, index) => (
                          <TableRow key={`${installment.installment_number}-${index}`}>
                            <TableCell>{installment.installment_number}</TableCell>
                            <TableCell>
                              {readOnly ? (
                                installment.due_date
                              ) : (
                                <Input
                                  type="date"
                                  value={installment.due_date}
                                  onChange={(event) => updateInstallment(index, "due_date", event.target.value)}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {readOnly ? (
                                formatCurrencyBRL(Number(installment.amount || 0))
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={installment.amount}
                                  onChange={(event) => updateInstallment(index, "amount", event.target.value)}
                                  className="ml-auto w-32 text-right"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Soma das parcelas</span>
                    <span className="font-semibold">{formatCurrencyBRL(sumInstallments(installments))}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Diferença para o total</span>
                    <span className={cn("font-semibold", installmentDifference > 0.01 && "text-destructive")}>
                      {formatCurrencyBRL(installmentDifference)}
                    </span>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-medium">Produto financeiro selecionado</p>
                    <p className="mt-1">
                      {selectedProduct.code ? `${selectedProduct.code} - ${selectedProduct.name}` : selectedProduct.name}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || loadingReferenceData}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={loading || loadingReferenceData}>
              {(loading || loadingReferenceData) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Salvar alterações" : "Salvar comissão"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <SuppliersModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        canEdit={canEditCadastros}
        canDelete={canDeleteCadastros}
        closeOnSave
        onSupplierSaved={(supplier) => {
          setSuppliers((current) => {
            const next = current.filter((item) => item.id !== supplier.id);
            next.push({
              id: supplier.id,
              name: supplier.name,
              cnpj_cpf: supplier.cnpj_cpf,
            });

            return next.sort((left, right) => left.name.localeCompare(right.name));
          });
          setSupplierId(supplier.id);
          setSupplierSearchTerm("");
          setSupplierPopoverOpen(false);
        }}
      />
    </>
  );
}
