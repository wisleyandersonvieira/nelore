import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { getFinancialAllocationTargetId } from "@/lib/financialAllocations";
import {
  migrateAccountsPayableToPurchase,
  PURCHASE_TYPE_LABELS,
  PURCHASE_TYPE_OPTIONS,
  PurchaseType,
} from "@/lib/purchases";
import {
  buildSaleItemLabel,
  fetchAccessibleStoreScope,
  formatCurrencyBRL,
  SaleItemOption,
} from "@/lib/sales";
import { cn } from "@/lib/utils";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import {
  ArrowRightLeft,
  ArrowUpDown,
  CircleAlert,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  Unplug,
  WalletCards,
} from "lucide-react";

interface MigrationPayableRow {
  id: string;
  supplier_id: string | null;
  store_id: string;
  purchase_id: string | null;
  purchase_link_origin: "manual" | "migration" | null;
  description: string;
  document_type: string | null;
  document_number: string | null;
  issue_date: string | null;
  due_date: string;
  data_competencia: string | null;
  amount: number;
  total_amount: number | null;
  payment_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SupplierOption {
  id: string;
  name: string;
  cnpj_cpf: string | null;
}

interface StoreOption {
  id: string;
  name: string;
  code: string;
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

interface MigrationInstallmentRow {
  account_payable_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  payment_date: string | null;
}

interface PurchaseLookupRow {
  id: string;
  code: number;
}

interface PayableListRow {
  allocationId: string | null;
  allocationType: PurchaseType | null;
  id: string;
  supplierId: string | null;
  supplierName: string;
  storeId: string;
  storeName: string;
  purchaseId: string | null;
  purchaseCode: number | null;
  purchaseLinkOrigin: "manual" | "migration" | null;
  description: string;
  documentType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  dueDate: string;
  competenceDate: string | null;
  totalAmount: number;
  installmentCount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentDate: string | null;
  productId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface PayableItemLookupRow {
  account_payable_id: string;
  id: string;
  product_id: string;
}

interface PayableAllocationLookupRow {
  account_payable_item_id: string;
  allocation_type: string;
  animal_id: string | null;
  aspiration_id: string | null;
  pregnancy_id: string | null;
  recipient_id: string | null;
  semen_id: string | null;
}

const EMPTY_ITEMS: Record<PurchaseType, SaleItemOption[]> = {
  animal: [],
  pregnancy: [],
  aspiration: [],
  recipient: [],
  semen: [],
};

const todayISO = () => new Date().toISOString().split("T")[0];

const formatDateBR = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const normalizeText = (value?: string | null) => (value || "").trim().toLowerCase();

const isSupportedPurchaseType = (value?: string | null): value is PurchaseType =>
  value === "animal" ||
  value === "pregnancy" ||
  value === "aspiration" ||
  value === "recipient" ||
  value === "semen";

const PurchaseMigrationModule = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();

  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);

  const [rows, setRows] = useState<PayableListRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Record<PurchaseType, SaleItemOption[]>>(EMPTY_ITEMS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [migrationFilter, setMigrationFilter] = useState<"pending" | "all" | "migrated">("pending");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");

  const [sortColumn, setSortColumn] = useState<keyof PayableListRow | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [purchaseType, setPurchaseType] = useState<PurchaseType>("animal");
  const [itemId, setItemId] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [issueDate, setIssueDate] = useState(todayISO());
  const [competenceDate, setCompetenceDate] = useState(todayISO());
  const [firstDueDate, setFirstDueDate] = useState(todayISO());
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [negotiationMethod, setNegotiationMethod] = useState("");

  const loadReferenceData = async () => {
    setReferenceLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setSuppliers([]);
        setProducts([]);
        setDocumentTypes([]);
        setPurchaseItems(EMPTY_ITEMS);
        return;
      }

      const productsPromise = supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("function_type", "debit")
        .order("name");

      const documentTypesPromise = supabase
        .from("document_types")
        .select("id, name, code")
        .eq("is_active", true)
        .order("code");

      let storesQuery = supabase.from("stores").select("id, name, code").order("name");
      let animalsQuery = supabase.from("animals").select("id, name, code, store_id, category_id");
      let pregnanciesQuery = supabase.from("pregnancy_management").select("id, name, code, store_id");
      let aspirationsQuery = supabase.from("aspiration_management").select("id, name, code, store_id");
      let semenQuery = supabase.from("semen" as any).select("id, name, code, store_id");

      if (storeIds && storeIds.length > 0) {
        storesQuery = storesQuery.in("id", storeIds);
        animalsQuery = animalsQuery.in("store_id", storeIds);
        pregnanciesQuery = pregnanciesQuery.in("store_id", storeIds);
        aspirationsQuery = aspirationsQuery.in("store_id", storeIds);
        semenQuery = semenQuery.in("store_id", storeIds);
      }

      const [productsRes, documentTypesRes, storesRes, animalsRes, pregnanciesRes, aspirationsRes, semenRes] =
        await Promise.all([
          productsPromise,
          documentTypesPromise,
          storesQuery,
          animalsQuery.order("name"),
          pregnanciesQuery.order("name"),
          aspirationsQuery.order("name"),
          semenQuery.order("name"),
        ]);

      if (productsRes.error) throw productsRes.error;
      if (documentTypesRes.error) throw documentTypesRes.error;
      if (storesRes.error) throw storesRes.error;
      if (animalsRes.error) throw animalsRes.error;
      if (pregnanciesRes.error) throw pregnanciesRes.error;
      if (aspirationsRes.error) throw aspirationsRes.error;
      if (semenRes.error) throw semenRes.error;

      const storesMap = ((storesRes.data || []) as StoreOption[]).reduce<Record<string, StoreOption>>(
        (acc, store) => {
          acc[store.id] = store;
          return acc;
        },
        {},
      );

      const recipientCategoryIds = await fetchRecipientCategoryIds({
        storeIds: storeIds || undefined,
      });

      const animals = (animalsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
        category_id: string | null;
      }>;

      const animalOptions = animals
        .filter((animal) => !animal.category_id || !recipientCategoryIds.includes(animal.category_id))
        .map((animal) => ({
          id: animal.id,
          code: String(animal.code),
          name: animal.name,
          store_id: animal.store_id,
          store_name: storesMap[animal.store_id]?.name || null,
        }));

      const recipientOptions = animals
        .filter((animal) => animal.category_id && recipientCategoryIds.includes(animal.category_id))
        .map((animal) => ({
          id: animal.id,
          code: String(animal.code),
          name: animal.name,
          store_id: animal.store_id,
          store_name: storesMap[animal.store_id]?.name || null,
        }));

      const pregnancyOptions = ((pregnanciesRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: storesMap[record.store_id]?.name || null,
      }));

      const aspirationOptions = ((aspirationsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: storesMap[record.store_id]?.name || null,
      }));

      const semenOptions = ((semenRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: storesMap[record.store_id]?.name || null,
      }));

      setProducts((productsRes.data || []) as ProductOption[]);
      setDocumentTypes((documentTypesRes.data || []) as DocumentTypeOption[]);
      setPurchaseItems({
        animal: animalOptions,
        pregnancy: pregnancyOptions,
        aspiration: aspirationOptions,
        recipient: recipientOptions,
        semen: semenOptions,
      });
    } catch (error) {
      console.error("Erro ao carregar dados da migração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados auxiliares para migrar compras.",
        variant: "destructive",
      });
    } finally {
      setReferenceLoading(false);
    }
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setRows([]);
        setSuppliers([]);
        setSelectedIds([]);
        return;
      }

      const payables = await fetchAllPaginated<MigrationPayableRow>(() => {
        let query = supabase
          .from("accounts_payable")
          .select(
            "id, supplier_id, store_id, purchase_id, purchase_link_origin, description, document_type, document_number, issue_date, due_date, data_competencia, amount, total_amount, payment_date, status, notes, created_at",
          )
          .order("due_date", { ascending: false });

        if (storeIds && storeIds.length > 0) {
          query = query.in("store_id", storeIds);
        }

        return query;
      });

      if (payables.length === 0) {
        setRows([]);
        setSuppliers([]);
        setSelectedIds([]);
        return;
      }

      const payableIds = payables.map((payable) => payable.id);
      const supplierIds = Array.from(new Set(payables.map((payable) => payable.supplier_id).filter(Boolean)));
      const storeIdsUsed = Array.from(new Set(payables.map((payable) => payable.store_id).filter(Boolean)));
      const purchaseIds = Array.from(new Set(payables.map((payable) => payable.purchase_id).filter(Boolean)));

      const [installmentsRes, suppliersRes, storesRes, purchasesRes, itemsRes] = await Promise.all([
        supabase
          .from("accounts_payable_installments")
          .select("account_payable_id, installment_number, due_date, amount, payment_date")
          .in("account_payable_id", payableIds)
          .order("installment_number", { ascending: true }),
        supplierIds.length > 0
          ? supabase
              .from("suppliers")
              .select("id, name, cnpj_cpf")
              .in("id", supplierIds)
              .order("name")
          : Promise.resolve({ data: [], error: null }),
        storeIdsUsed.length > 0
          ? supabase.from("stores").select("id, name, code").in("id", storeIdsUsed)
          : Promise.resolve({ data: [], error: null }),
        purchaseIds.length > 0
          ? supabase.from("purchases").select("id, code").in("id", purchaseIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("accounts_payable_items")
          .select("id, account_payable_id, product_id")
          .in("account_payable_id", payableIds),
      ]);

      if (installmentsRes.error) throw installmentsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (storesRes.error) throw storesRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const supplierMap = new Map((suppliersRes.data || []).map((supplier) => [supplier.id, supplier]));
      const storeMap = new Map(
        ((storesRes.data || []) as StoreOption[]).map((store) => [store.id, `${store.code} - ${store.name}`]),
      );
      const purchaseCodeMap = new Map(
        ((purchasesRes.data || []) as PurchaseLookupRow[]).map((purchase) => [purchase.id, purchase.code]),
      );
      const payableItems = (itemsRes.data || []) as PayableItemLookupRow[];
      const payableItemIds = payableItems.map((item) => item.id);
      const payableItemsByPayableId = new Map<string, PayableItemLookupRow[]>();
      payableItems.forEach((item) => {
        const current = payableItemsByPayableId.get(item.account_payable_id) || [];
        current.push(item);
        payableItemsByPayableId.set(item.account_payable_id, current);
      });

      const allocationsRes =
        payableItemIds.length > 0
          ? await supabase
              .from("accounts_payable_item_allocations")
              .select(
                "account_payable_item_id, allocation_type, animal_id, aspiration_id, pregnancy_id, recipient_id, semen_id",
              )
              .in("account_payable_item_id", payableItemIds)
          : { data: [], error: null };

      if (allocationsRes.error) throw allocationsRes.error;

      const allocationsByItemId = new Map<string, PayableAllocationLookupRow>();
      ((allocationsRes.data || []) as PayableAllocationLookupRow[]).forEach((allocation) => {
        allocationsByItemId.set(allocation.account_payable_item_id, allocation);
      });

      const installmentsMap = new Map<string, MigrationInstallmentRow[]>();
      ((installmentsRes.data || []) as MigrationInstallmentRow[]).forEach((installment) => {
        const current = installmentsMap.get(installment.account_payable_id) || [];
        current.push(installment);
        installmentsMap.set(installment.account_payable_id, current);
      });

      const nextRows = payables.map((payable) => {
        const totalAmount = Number(payable.total_amount ?? payable.amount ?? 0);
        const installments = installmentsMap.get(payable.id) || [];
        const paidAmount = installments.length
          ? installments.reduce(
              (sum, installment) => sum + (installment.payment_date ? Number(installment.amount || 0) : 0),
              0,
            )
          : payable.payment_date || payable.status === "paid"
            ? totalAmount
            : 0;
        const pendingAmount = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));
        const supplier = payable.supplier_id ? supplierMap.get(payable.supplier_id) : null;
        const payableItemsForAccount = payableItemsByPayableId.get(payable.id) || [];
        const uniqueProductIds = Array.from(
          new Set(payableItemsForAccount.map((item) => item.product_id).filter(Boolean)),
        );
        const supportedAllocations = payableItemsForAccount
          .map((item) => {
            const allocation = allocationsByItemId.get(item.id);
            if (!allocation || !isSupportedPurchaseType(allocation.allocation_type)) {
              return null;
            }
            return {
              allocationId: getFinancialAllocationTargetId(allocation) || null,
              allocationType: allocation.allocation_type,
            };
          })
          .filter((value): value is { allocationId: string | null; allocationType: PurchaseType } => Boolean(value));
        const uniqueAllocationTypes = Array.from(
          new Set(supportedAllocations.map((allocation) => allocation.allocationType).filter(Boolean)),
        );
        const uniqueAllocationIds = Array.from(
          new Set(supportedAllocations.map((allocation) => allocation.allocationId).filter(Boolean)),
        );

        return {
          allocationId:
            uniqueAllocationTypes.length === 1 && uniqueAllocationIds.length === 1
              ? uniqueAllocationIds[0] || null
              : null,
          allocationType: uniqueAllocationTypes.length === 1 ? uniqueAllocationTypes[0] : null,
          id: payable.id,
          supplierId: payable.supplier_id,
          supplierName: supplier?.name || "Fornecedor não identificado",
          storeId: payable.store_id,
          storeName: storeMap.get(payable.store_id) || "Fazenda não identificada",
          purchaseId: payable.purchase_id,
          purchaseCode: payable.purchase_id ? purchaseCodeMap.get(payable.purchase_id) || null : null,
          purchaseLinkOrigin: payable.purchase_link_origin,
          description: payable.description,
          documentType: payable.document_type,
          documentNumber: payable.document_number,
          issueDate: payable.issue_date,
          dueDate: payable.due_date,
          competenceDate: payable.data_competencia,
          totalAmount,
          installmentCount: installments.length || 1,
          paidAmount: Number(paidAmount.toFixed(2)),
          pendingAmount,
          paymentDate: payable.payment_date,
          productId: uniqueProductIds.length === 1 ? uniqueProductIds[0] : null,
          status: payable.status,
          notes: payable.notes,
          createdAt: payable.created_at,
        } satisfies PayableListRow;
      });

      setRows(nextRows);
      setSuppliers((suppliersRes.data || []) as SupplierOption[]);
      setSelectedIds((current) => current.filter((id) => nextRows.some((row) => row.id === id && !row.purchaseId)));
    } catch (error) {
      console.error("Erro ao carregar lançamentos para migração:", error);
      toast({
        title: "Erro ao carregar migração",
        description: "Não foi possível listar os lançamentos antigos do Contas a Pagar.",
        variant: "destructive",
      });
      setRows([]);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canView) {
      setLoading(false);
      return;
    }

    void Promise.all([loadRows(), loadReferenceData()]);
  }, [permissionsLoading, canView]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (migrationFilter === "pending" && row.purchaseId) return false;
      if (migrationFilter === "migrated" && !row.purchaseId) return false;
      if (supplierFilter !== "all" && row.supplierId !== supplierFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (periodFrom) {
        const referenceDate = row.issueDate || row.dueDate;
        if (referenceDate < periodFrom) return false;
      }
      if (periodTo) {
        const referenceDate = row.issueDate || row.dueDate;
        if (referenceDate > periodTo) return false;
      }
      if (documentFilter) {
        const combined = `${row.documentType || ""} ${row.documentNumber || ""}`.toLowerCase();
        if (!combined.includes(documentFilter.trim().toLowerCase())) return false;
      }
      if (descriptionFilter) {
        const haystack = `${row.description} ${row.notes || ""}`.toLowerCase();
        if (!haystack.includes(descriptionFilter.trim().toLowerCase())) return false;
      }
      if (valueMin && row.totalAmount < Number(valueMin)) return false;
      if (valueMax && row.totalAmount > Number(valueMax)) return false;
      return true;
    });
  }, [
    descriptionFilter,
    documentFilter,
    migrationFilter,
    periodFrom,
    periodTo,
    rows,
    statusFilter,
    supplierFilter,
    valueMax,
    valueMin,
  ]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn as keyof PayableListRow];
      const bVal = b[sortColumn as keyof PayableListRow];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * direction;
      }
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (column: keyof PayableListRow) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds],
  );

  const selectedSupplier = selectedRows[0]?.supplierId
    ? suppliers.find((supplier) => supplier.id === selectedRows[0].supplierId) || null
    : null;

  const selectedTotalAmount = selectedRows.reduce((sum, row) => sum + row.totalAmount, 0);

  const selectedWarnings = useMemo(() => {
    if (selectedRows.length <= 1) return [];

    const warnings: string[] = [];
    const distinctSuppliers = new Set(selectedRows.map((row) => row.supplierId || "sem-fornecedor"));
    const distinctStores = new Set(selectedRows.map((row) => row.storeId));
    const distinctDocuments = new Set(
      selectedRows
        .map((row) => `${row.documentType || ""}:${row.documentNumber || ""}`)
        .filter((value) => value !== ":"),
    );
    const distinctDescriptions = new Set(
      selectedRows.map((row) => normalizeText(row.description)).filter(Boolean),
    );
    const distinctProducts = new Set(selectedRows.map((row) => row.productId).filter(Boolean));
    const distinctAllocationTypes = new Set(selectedRows.map((row) => row.allocationType).filter(Boolean));
    const distinctAllocationIds = new Set(selectedRows.map((row) => row.allocationId).filter(Boolean));

    if (distinctSuppliers.size > 1) {
      warnings.push("A seleção contém fornecedores diferentes. O vínculo será bloqueado.");
    }
    if (distinctStores.size > 1) {
      warnings.push("A seleção contém fazendas diferentes. O vínculo será bloqueado.");
    }
    if (distinctDocuments.size > 1) {
      warnings.push("Os títulos possuem documentos diferentes. Revise se pertencem à mesma compra.");
    }
    if (distinctDescriptions.size > 1) {
      warnings.push("As descrições variam entre os títulos selecionados. Confirme o agrupamento manual.");
    }
    if (distinctProducts.size > 1) {
      warnings.push("Os títulos possuem produtos financeiros diferentes. Revise antes de migrar.");
    }
    if (distinctAllocationTypes.size > 1 || distinctAllocationIds.size > 1) {
      warnings.push("Os títulos possuem alocações diferentes. Revise o tipo e o registro comprado.");
    }

    return warnings;
  }, [selectedRows]);

  const detectedAutofill = useMemo(() => {
    const uniqueProductIds = Array.from(new Set(selectedRows.map((row) => row.productId).filter(Boolean)));
    const uniqueAllocationTypes = Array.from(
      new Set(selectedRows.map((row) => row.allocationType).filter(Boolean)),
    );
    const uniqueAllocationIds = Array.from(
      new Set(selectedRows.map((row) => row.allocationId).filter(Boolean)),
    );

    return {
      itemId:
        uniqueAllocationTypes.length === 1 && uniqueAllocationIds.length === 1
          ? uniqueAllocationIds[0] || ""
          : "",
      productId: uniqueProductIds.length === 1 ? uniqueProductIds[0] || "" : "",
      purchaseType: uniqueAllocationTypes.length === 1 ? uniqueAllocationTypes[0] : null,
    };
  }, [selectedRows]);

  const selectedItem = itemId
    ? purchaseItems[purchaseType].find((item) => item.id === itemId) || null
    : null;

  const filteredItems = useMemo(
    () =>
      purchaseItems[purchaseType].filter((item) =>
        buildSaleItemLabel(item).toLowerCase().includes(itemSearchTerm.trim().toLowerCase()),
      ),
    [itemSearchTerm, purchaseItems, purchaseType],
  );

  const headerSummary = useMemo(
    () => ({
      pending: rows.filter((row) => !row.purchaseId).length,
      migrated: rows.filter((row) => Boolean(row.purchaseId)).length,
      selectedAmount: selectedTotalAmount,
    }),
    [rows, selectedTotalAmount],
  );

  const resetDialogState = () => {
    const today = todayISO();
    setPurchaseType("animal");
    setItemId("");
    setItemSearchTerm("");
    setItemPopoverOpen(false);
    setProductId("");
    setPurchaseDate(today);
    setIssueDate(today);
    setCompetenceDate(today);
    setFirstDueDate(today);
    setDocumentType("");
    setDocumentNumber("");
    setDescription("");
    setNotes("");
    setNegotiationMethod("");
  };

  const initializeDialogState = () => {
    if (selectedRows.length === 0) return;

    const sortedByDue = [...selectedRows].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
    const firstRow = sortedByDue[0];
    const uniqueDocumentType =
      new Set(selectedRows.map((row) => row.documentType).filter(Boolean)).size === 1
        ? firstRow.documentType || ""
        : "";
    const uniqueDocumentNumber =
      new Set(selectedRows.map((row) => row.documentNumber).filter(Boolean)).size === 1
        ? firstRow.documentNumber || ""
        : "";

    setPurchaseType(detectedAutofill.purchaseType || "animal");
    setItemId(detectedAutofill.itemId);
    setItemSearchTerm("");
    setItemPopoverOpen(false);
    setProductId(detectedAutofill.productId);
    setPurchaseDate(firstRow.issueDate || firstRow.dueDate || todayISO());
    setIssueDate(firstRow.issueDate || firstRow.dueDate || todayISO());
    setCompetenceDate(firstRow.competenceDate || firstRow.issueDate || firstRow.dueDate || todayISO());
    setFirstDueDate(firstRow.dueDate || todayISO());
    setDocumentType(uniqueDocumentType);
    setDocumentNumber(uniqueDocumentNumber);
    setDescription(selectedRows.length === 1 ? firstRow.description : "");
    setNotes(
      `Compra migrada do Contas a Pagar. ${selectedRows.length} título(s) antigo(s) vinculados sem recriar parcelas.`,
    );
    setNegotiationMethod("");
  };

  const handleToggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((current) => current.filter((id) => !filteredRows.some((row) => row.id === id)));
      return;
    }

    const visibleSelectableIds = filteredRows.filter((row) => !row.purchaseId).map((row) => row.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleSelectableIds])));
  };

  const handleToggleRow = (rowId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, rowId])) : current.filter((id) => id !== rowId),
    );
  };

  const handleOpenMigration = () => {
    if (selectedRows.length === 0) {
      toast({
        title: "Seleção vazia",
        description: "Selecione ao menos um título pendente de migração.",
        variant: "destructive",
      });
      return;
    }

    const distinctSuppliers = new Set(selectedRows.map((row) => row.supplierId || "sem-fornecedor"));
    const distinctStores = new Set(selectedRows.map((row) => row.storeId));

    if (distinctSuppliers.size > 1 || distinctStores.size > 1) {
      toast({
        title: "Seleção inconsistente",
        description: "Selecione apenas títulos do mesmo fornecedor e da mesma fazenda para migrar.",
        variant: "destructive",
      });
      return;
    }

    initializeDialogState();
    setDialogOpen(true);
  };

  const handleMigrate = async () => {
    if (!selectedSupplier?.id || !itemId || !productId) {
      toast({
        title: "Dados obrigatórios",
        description: "Informe o item comprado e o produto financeiro antes de concluir a migração.",
        variant: "destructive",
      });
      return;
    }

    if (!purchaseDate) {
      toast({
        title: "Data obrigatória",
        description: "Informe a data da compra migrada.",
        variant: "destructive",
      });
      return;
    }

    setMigrating(true);
    try {
      const result = await migrateAccountsPayableToPurchase({
        accountPayableIds: selectedRows.map((row) => row.id),
        purchaseType,
        itemId,
        productId,
        purchaseDate,
        issueDate,
        competenceDate,
        firstDueDate,
        documentType: documentType || undefined,
        documentNumber: documentNumber || undefined,
        description: description || undefined,
        notes: notes || undefined,
        negotiationMethod: negotiationMethod || undefined,
      });

      toast({
        title: "Migração concluída",
        description: result?.purchase_code
          ? `Compra #${result.purchase_code} criada e vinculada aos títulos selecionados sem duplicar o financeiro.`
          : "Compra criada e vinculada aos títulos selecionados.",
      });

      setDialogOpen(false);
      setSelectedIds([]);
      resetDialogState();
      await loadRows();
    } catch (error: any) {
      console.error("Erro ao migrar títulos para compra:", error);
      toast({
        title: "Erro na migração",
        description: error?.message || "Não foi possível criar a compra migrada.",
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando migração de compras...
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-2xl border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            A migração temporária utiliza dados do Financeiro e segue as mesmas permissões do Contas a Pagar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
            Ferramenta temporária
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Migração de Compras
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Converta lançamentos antigos do Contas a Pagar em compras rastreáveis sem recriar títulos,
            sem duplicar parcelas e preservando todo o histórico financeiro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void loadRows()}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Atualizar listagem
          </Button>
          <Button
            onClick={handleOpenMigration}
            disabled={!canEdit || selectedRows.length === 0}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            <WalletCards className="mr-2 h-4 w-4" />
            Migrar para compra
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pendentes de migração</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{headerSummary.pending}</p>
            <p className="mt-1 text-xs text-muted-foreground">Títulos ainda sem vínculo com compras</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Já migrados</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{headerSummary.migrated}</p>
            <p className="mt-1 text-xs text-muted-foreground">Títulos já reconhecidos pelo módulo Compras</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Seleção atual</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{formatCurrencyBRL(headerSummary.selectedAmount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedRows.length} título(s) selecionado(s)</p>
          </CardContent>
        </Card>
      </section>

      {selectedWarnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
          <CardContent className="space-y-2 p-5 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <CircleAlert className="h-4 w-4" />
              Revisar seleção antes de migrar
            </div>
            {selectedWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle className="text-base">Lançamentos elegíveis</CardTitle>
              <CardDescription>
                Filtre os títulos antigos do Contas a Pagar, selecione os que pertencem à mesma compra
                e vincule-os ao módulo Compras sem alterar o histórico financeiro já existente.
              </CardDescription>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os fornecedores</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status financeiro</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status da migração</Label>
                <Select
                  value={migrationFilter}
                  onValueChange={(value: "pending" | "all" | "migrated") => setMigrationFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pendentes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Somente não migrados</SelectItem>
                    <SelectItem value="migrated">Somente migrados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Documento</Label>
                <Input
                  value={documentFilter}
                  onChange={(event) => setDocumentFilter(event.target.value)}
                  placeholder="Tipo ou número"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={descriptionFilter}
                  onChange={(event) => setDescriptionFilter(event.target.value)}
                  placeholder="Pesquisar descrição"
                />
              </div>

              <div className="space-y-2">
                <Label>Período inicial</Label>
                <Input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Período final</Label>
                <Input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valor mínimo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valueMin}
                    onChange={(event) => setValueMin(event.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor máximo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valueMax}
                    onChange={(event) => setValueMax(event.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              A migração cria apenas a compra e vincula os títulos já existentes, preservando parcelas,
              vencimentos, pagamentos e status.
            </div>
            <div className="text-foreground">
              <span className="font-medium">{selectedRows.length}</span> título(s) selecionado(s)
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px]">
                    <Checkbox
                      checked={
                        filteredRows.filter((row) => !row.purchaseId).length > 0 &&
                        filteredRows.filter((row) => !row.purchaseId).every((row) => selectedIds.includes(row.id))
                      }
                      onCheckedChange={(checked) => handleToggleAllVisible(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>Migração</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compra vinculada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-28 text-center text-muted-foreground">
                      Nenhum lançamento encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          disabled={Boolean(row.purchaseId)}
                          onCheckedChange={(checked) => handleToggleRow(row.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.purchaseId
                              ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                              : "border-amber-200 bg-amber-100 text-amber-800"
                          }
                        >
                          {row.purchaseId ? "Migrado" : "Não migrado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{row.supplierName}</p>
                          <p className="text-xs text-muted-foreground">{row.storeName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[260px]">{row.description}</TableCell>
                      <TableCell>
                        {row.documentType || row.documentNumber
                          ? `${row.documentType || ""}${row.documentType && row.documentNumber ? " / " : ""}${row.documentNumber || ""}`
                          : "Não informado"}
                      </TableCell>
                      <TableCell>{formatDateBR(row.issueDate)}</TableCell>
                      <TableCell>{formatDateBR(row.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(row.totalAmount)}</TableCell>
                      <TableCell className="text-center">{row.installmentCount}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(row.paidAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(row.pendingAmount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "paid"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                              : row.status === "partial"
                                ? "border-sky-200 bg-sky-100 text-sky-800"
                                : "border-amber-200 bg-amber-100 text-amber-800"
                          }
                        >
                          {row.status === "paid" ? "Pago" : row.status === "partial" ? "Parcial" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.purchaseCode ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{row.purchaseCode}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => navigate("/purchases")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pendente</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetDialogState();
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-amber-600" />
              Migrar títulos para compra
            </DialogTitle>
            <DialogDescription>
              Esta ação cria um registro no módulo Compras e vincula os títulos já existentes do
              Contas a Pagar, sem recriar financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.95fr]">
            <div className="space-y-6">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Seleção financeira</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 text-sm">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedor</p>
                      <p className="mt-2 font-medium text-foreground">{selectedSupplier?.name || "N/D"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Títulos</p>
                      <p className="mt-2 font-medium text-foreground">{selectedRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor total</p>
                      <p className="mt-2 font-medium text-foreground">
                        {formatCurrencyBRL(selectedTotalAmount)}
                      </p>
                    </div>
                  </div>

                  {(detectedAutofill.purchaseType || detectedAutofill.itemId || detectedAutofill.productId) && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <ShieldCheck className="h-4 w-4" />
                        Dados reaproveitados do Contas a Pagar
                      </div>
                      <p>
                        Tipo do item:{" "}
                        <span className="font-medium">
                          {detectedAutofill.purchaseType
                            ? PURCHASE_TYPE_LABELS[detectedAutofill.purchaseType]
                            : "preenchimento manual necessário"}
                        </span>
                      </p>
                      <p>
                        Registro comprado:{" "}
                        <span className="font-medium">
                          {detectedAutofill.itemId ? "vínculo encontrado" : "preenchimento manual necessário"}
                        </span>
                      </p>
                      <p>
                        Produto financeiro:{" "}
                        <span className="font-medium">
                          {detectedAutofill.productId ? "produto encontrado" : "preenchimento manual necessário"}
                        </span>
                      </p>
                    </div>
                  )}

                  {selectedWarnings.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <CircleAlert className="h-4 w-4" />
                        Atenção na conferência
                      </div>
                      {selectedWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Documento</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              {row.documentType || row.documentNumber
                                ? `${row.documentType || ""}${row.documentType && row.documentNumber ? " / " : ""}${row.documentNumber || ""}`
                                : row.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="min-w-[260px]">{row.description}</TableCell>
                            <TableCell>{formatDateBR(row.dueDate)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(row.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Dados da compra migrada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo do item</Label>
                      <Select
                        value={purchaseType}
                        onValueChange={(value: PurchaseType) => {
                          setPurchaseType(value);
                          setItemId("");
                          setItemSearchTerm("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURCHASE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Registro comprado</Label>
                      <Popover open={itemPopoverOpen} onOpenChange={setItemPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="truncate">
                              {selectedItem ? buildSaleItemLabel(selectedItem) : "Selecionar registro"}
                            </span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <div className="border-b p-2">
                            <Input
                              placeholder={`Pesquisar ${PURCHASE_TYPE_LABELS[purchaseType].toLowerCase()}...`}
                              value={itemSearchTerm}
                              onChange={(event) => setItemSearchTerm(event.target.value)}
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredItems.map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                className={cn(
                                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                  itemId === item.id && "bg-accent",
                                )}
                                onClick={() => {
                                  setItemId(item.id);
                                  setItemPopoverOpen(false);
                                  if (!description) {
                                    setDescription(
                                      `${PURCHASE_TYPE_LABELS[purchaseType]} ${buildSaleItemLabel(item)}`,
                                    );
                                  }
                                }}
                              >
                                <span className="font-medium">{buildSaleItemLabel(item)}</span>
                                {item.store_name && (
                                  <span className="text-xs text-muted-foreground">{item.store_name}</span>
                                )}
                              </button>
                            ))}
                            {filteredItems.length === 0 && (
                              <div className="px-3 py-4 text-sm text-muted-foreground">
                                Nenhum item encontrado para este tipo.
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Produto financeiro</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder={referenceLoading ? "Carregando..." : "Selecionar produto"} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.code ? `${product.code} - ${product.name}` : product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Data da compra</Label>
                      <Input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Emissão</Label>
                      <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Competência</Label>
                      <Input
                        type="date"
                        value={competenceDate}
                        onChange={(event) => setCompetenceDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primeiro vencimento</Label>
                      <Input
                        type="date"
                        value={firstDueDate}
                        onChange={(event) => setFirstDueDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de documento</Label>
                      <Select
                        value={documentType || "__empty__"}
                        onValueChange={(value) => setDocumentType(value === "__empty__" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Sem tipo</SelectItem>
                          {documentTypes.map((option) => (
                            <SelectItem key={option.id} value={option.code}>
                              {option.code} - {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número do documento</Label>
                      <Input
                        value={documentNumber}
                        onChange={(event) => setDocumentNumber(event.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição da compra</Label>
                    <Input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Descreva a compra migrada"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de negociação</Label>
                    <Input
                      value={negotiationMethod}
                      onChange={(event) => setNegotiationMethod(event.target.value)}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Informações adicionais e contexto da migração"
                    />
                  </div>

                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Valor total a vincular</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrencyBRL(selectedTotalAmount)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Este valor é lido dos títulos selecionados. A migração não cria novas parcelas e não altera os
                      pagamentos já existentes.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={migrating}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void handleMigrate()} disabled={migrating || referenceLoading}>
                      {migrating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Migrando...
                        </>
                      ) : (
                        <>
                          <WalletCards className="mr-2 h-4 w-4" />
                          Concluir migração
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseMigrationModule;
