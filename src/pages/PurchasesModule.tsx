import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchasesCreateModal } from "@/components/PurchasesCreateModal";
import { PurchaseInvoiceModal } from "@/components/PurchaseInvoiceModal";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { cn } from "@/lib/utils";
import {
  buildSaleItemLabel,
  fetchAccessibleStoreScope,
  formatCurrencyBRL,
  SaleInstallmentDraft,
} from "@/lib/sales";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  HandCoins,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  PURCHASE_TYPE_LABELS,
  PURCHASE_TYPE_OPTIONS,
  PurchaseOriginType,
  PurchaseType,
  deletePurchaseWithPayable,
} from "@/lib/purchases";

interface PurchaseInstallmentRow extends SaleInstallmentDraft {
  displayInstallmentNumber: number;
  payableDescription: string | null;
  payableId: string;
  status?: string | null;
}

interface LinkedPayableRow {
  id: string;
  description: string;
  totalAmount: number;
  amount: number;
  paymentDate: string | null;
  dueDate: string;
  issueDate: string | null;
  competenceDate: string | null;
  documentType: string | null;
  documentNumber: string | null;
  status: string;
  purchaseLinkOrigin: "manual" | "migration" | null;
}

interface PurchaseRow {
  animalId: string | null;
  aspirationId: string | null;
  id: string;
  code: number;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  purchaseType: PurchaseType;
  description: string;
  itemCode: string | null;
  itemName: string;
  totalAmount: number;
  installmentCount: number;
  notes: string | null;
  pregnancyId: string | null;
  documentType: string | null;
  documentNumber: string | null;
  negotiationMethod: string | null;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  storeId: string;
  storeName: string;
  originType: PurchaseOriginType;
  recipientId: string | null;
  semenId: string | null;
  linkedPayables: LinkedPayableRow[];
  paidAmount: number;
  pendingAmount: number;
  status: "pending" | "partial" | "paid";
  installments: PurchaseInstallmentRow[];
}

type PurchaseSortField =
  | "code"
  | "purchaseDate"
  | "supplierName"
  | "purchaseType"
  | "itemName"
  | "totalAmount"
  | "pendingAmount"
  | "status";

type PurchaseSortDirection = "asc" | "desc";

interface PurchaseTableRow {
  animal_id: string | null;
  aspiration_id: string | null;
  id: string;
  code: number;
  supplier_id: string;
  purchase_date: string;
  purchase_type: PurchaseType;
  description: string;
  item_code: string | null;
  item_name: string;
  total_amount: number;
  installment_count: number;
  notes: string | null;
  document_type: string | null;
  document_number: string | null;
  negotiation_method: string | null;
  issue_date: string;
  competence_date: string;
  first_due_date: string;
  origin_type: PurchaseOriginType;
  pregnancy_id: string | null;
  recipient_id: string | null;
  semen_id: string | null;
  store_id: string;
}

interface PayableTableRow {
  id: string;
  amount: number;
  competence_date: string | null;
  purchase_id: string | null;
  description: string;
  document_number: string | null;
  document_type: string | null;
  due_date: string;
  issue_date: string | null;
  payment_date: string | null;
  purchase_link_origin: "manual" | "migration" | null;
  status: string;
  total_amount: number | null;
}

interface SummaryCard {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}

const chartConfig = {
  total: {
    label: "Comprado",
    color: "hsl(231 58% 52%)",
  },
} satisfies ChartConfig;

const statusMeta: Record<PurchaseRow["status"], { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  partial: {
    label: "Parcial",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  paid: {
    label: "Paga",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const getPurchaseEntityKey = (purchase: PurchaseRow) => {
  const entityId =
    purchase.purchaseType === "animal"
      ? purchase.animalId
      : purchase.purchaseType === "pregnancy"
        ? purchase.pregnancyId
        : purchase.purchaseType === "aspiration"
          ? purchase.aspirationId
          : purchase.purchaseType === "recipient"
            ? purchase.recipientId
            : purchase.semenId;

  if (entityId) {
    return `${purchase.purchaseType}:${entityId}`;
  }

  return `${purchase.purchaseType}:${purchase.itemCode || purchase.itemName || purchase.id}`;
};

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildChartData = (purchases: PurchaseRow[]) => {
  const months: Array<{ key: string; label: string; total: number }> = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: getMonthKey(date),
      label: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      total: 0,
    });
  }

  const monthMap = months.reduce<Record<string, { key: string; label: string; total: number }>>(
    (acc, month) => {
      acc[month.key] = month;
      return acc;
    },
    {},
  );

  purchases.forEach((purchase) => {
    const purchaseDate = new Date(`${purchase.purchaseDate}T00:00:00`);
    const key = getMonthKey(new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1));
    if (monthMap[key]) {
      monthMap[key].total += purchase.totalAmount;
    }
  });

  return months.map((month) => ({
    ...month,
    total: Number(month.total.toFixed(2)),
  }));
};

const computeStatus = (
  totalAmount: number,
  installments: SaleInstallmentDraft[],
  fallbackPaidAmount = 0,
) => {
  const paidAmount = installments.length
    ? installments.reduce(
        (sum, installment) => sum + (installment.payment_date ? installment.amount : 0),
        0,
      )
    : fallbackPaidAmount;

  const normalizedPaid = Number(paidAmount.toFixed(2));
  const pendingAmount = Number(Math.max(totalAmount - normalizedPaid, 0).toFixed(2));

  if (pendingAmount <= 0.01) {
    return {
      status: "paid" as const,
      paidAmount: totalAmount,
      pendingAmount: 0,
    };
  }

  if (normalizedPaid > 0) {
    return {
      status: "partial" as const,
      paidAmount: normalizedPaid,
      pendingAmount,
    };
  }

  return {
    status: "pending" as const,
    paidAmount: 0,
    pendingAmount: totalAmount,
  };
};

const getPaidProgress = (purchase: Pick<PurchaseRow, "paidAmount" | "totalAmount">) => {
  if (!purchase.totalAmount || purchase.totalAmount <= 0) return 0;
  return Math.min(100, Math.max(0, Number(((purchase.paidAmount / purchase.totalAmount) * 100).toFixed(1))));
};

const PAGE_SIZE = 10;

// Retorna a data no formato YYYY-MM-DD deslocada de `monthsBack` meses a partir de hoje.
// Quando `firstDay` é true, retorna o primeiro dia do mês resultante.
const getDateOffset = (monthsBack: number, firstDay = false): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  if (firstDay) d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const PurchasesModule = () => {
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseFormMode, setPurchaseFormMode] = useState<"create" | "edit">("create");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePurchase, setInvoicePurchase] = useState<{ id: string; code: number } | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [installmentsPage, setInstallmentsPage] = useState(1);
  const [listPage, setListPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDirection, setSortDirection] = useState<PurchaseSortDirection>("desc");
  const [sortField, setSortField] = useState<PurchaseSortField>("purchaseDate");
  const [typeFilter, setTypeFilter] = useState<"all" | PurchaseType>("all");
  // Estado "rascunho" — atualizado enquanto o usuário edita os inputs, sem disparar queries.
  const [draftStart, setDraftStart] = useState<string>(() => getDateOffset(2, true));
  const [draftEnd, setDraftEnd] = useState<string>(() => getDateOffset(0));
  // Estado "aplicado" — copiado do rascunho ao clicar em "Filtrar". É este que dispara o loadPurchases.
  const [periodStart, setPeriodStart] = useState<string>(() => getDateOffset(2, true));
  const [periodEnd, setPeriodEnd] = useState<string>(() => getDateOffset(0));

  // Carrega compras filtrando por período no banco — evita trazer todo o histórico de uma vez.
  // Os parâmetros `start` e `end` são datas no formato YYYY-MM-DD e são aplicados
  // diretamente na coluna `purchase_date` via .gte()/.lte(), aproveitando o índice existente.
  const loadPurchases = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setPurchases([]);
        return;
      }

      const purchasesData = await fetchAllPaginated<PurchaseTableRow>(() => {
        let query = supabase
          .from("purchases")
          .select("*")
          .order("purchase_date", { ascending: false })
          // Filtro de período aplicado no banco — reduz volume de dados retornado
          .gte("purchase_date", start)
          .lte("purchase_date", end);
        if (storeIds && storeIds.length > 0) {
          query = query.in("store_id", storeIds);
        }
        return query;
      });

      if (purchasesData.length === 0) {
        setPurchases([]);
        return;
      }

      const supplierIds = Array.from(new Set(purchasesData.map((purchase) => purchase.supplier_id).filter(Boolean)));
      const purchaseStoreIds = Array.from(new Set(purchasesData.map((purchase) => purchase.store_id).filter(Boolean)));

      const [suppliersRes, storesRes, payablesData] = await Promise.all([
        supplierIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
          : Promise.resolve({ data: [], error: null }),
        purchaseStoreIds.length > 0
          ? supabase.from("stores").select("id, name, code").in("id", purchaseStoreIds)
          : Promise.resolve({ data: [], error: null }),
        fetchAllPaginated<PayableTableRow>(() =>
          supabase
            .from("accounts_payable")
            .select(
              "id, purchase_id, description, total_amount, amount, payment_date, due_date, issue_date, competence_date:data_competencia, document_type, document_number, status, purchase_link_origin",
            )
            .in("purchase_id", purchasesData.map((purchase) => purchase.id)),
        ),
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (storesRes.error) throw storesRes.error;

      const supplierMap = new Map((suppliersRes.data || []).map((supplier) => [supplier.id, supplier.name]));
      const storeMap = new Map(
        (storesRes.data || []).map((store) => [store.id, `${store.code} - ${store.name}`]),
      );

      const payableByPurchaseId = new Map<string, PayableTableRow[]>();
      payablesData.forEach((payable) => {
        if (payable.purchase_id) {
          const current = payableByPurchaseId.get(payable.purchase_id) || [];
          current.push(payable);
          payableByPurchaseId.set(payable.purchase_id, current);
        }
      });

      const payableIds = Array.from(new Set(payablesData.map((payable) => payable.id).filter(Boolean)));
      const installmentsData =
        payableIds.length > 0
          ? await fetchAllPaginated<{
              account_payable_id: string;
              installment_number: number;
              due_date: string;
              amount: number;
              payment_date: string | null;
              status: string | null;
            }>(() =>
              supabase
                .from("accounts_payable_installments")
                .select("account_payable_id, installment_number, due_date, amount, payment_date, status")
                .in("account_payable_id", payableIds)
                .order("installment_number", { ascending: true }),
            )
          : [];

      const installmentsMap = new Map<string, PurchaseInstallmentRow[]>();
      installmentsData.forEach((installment) => {
        const current = installmentsMap.get(installment.account_payable_id) || [];
        const payable = payablesData.find((entry) => entry.id === installment.account_payable_id);
        current.push({
          displayInstallmentNumber: installment.installment_number,
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: Number(installment.amount || 0),
          payment_date: installment.payment_date,
          payableDescription: payable?.description || null,
          payableId: installment.account_payable_id,
          status: installment.status,
        });
        installmentsMap.set(installment.account_payable_id, current);
      });

      const rows = purchasesData.map((purchase) => {
        const linkedPayables = (payableByPurchaseId.get(purchase.id) || []).map((payable) => ({
          id: payable.id,
          description: payable.description,
          totalAmount: Number(payable.total_amount ?? payable.amount ?? 0),
          amount: Number(payable.amount || 0),
          paymentDate: payable.payment_date,
          dueDate: payable.due_date,
          issueDate: payable.issue_date,
          competenceDate: payable.competence_date,
          documentType: payable.document_type,
          documentNumber: payable.document_number,
          status: payable.status,
          purchaseLinkOrigin: payable.purchase_link_origin,
        }));
        const installments = linkedPayables
          .flatMap((payable) => {
            const payableInstallments = installmentsMap.get(payable.id) || [];
            if (payableInstallments.length > 0) {
              return payableInstallments;
            }

            return [
              {
                displayInstallmentNumber: 1,
                installment_number: 1,
                due_date: payable.dueDate,
                amount: payable.totalAmount,
                payment_date: payable.paymentDate,
                payableDescription: payable.description,
                payableId: payable.id,
              } satisfies PurchaseInstallmentRow,
            ];
          })
          .sort((left, right) => {
            if (left.due_date === right.due_date) {
              return left.installment_number - right.installment_number;
            }
            return left.due_date.localeCompare(right.due_date);
          })
          .map((installment, index) => ({
            ...installment,
            displayInstallmentNumber: index + 1,
          }));
        const totalAmount = Number(purchase.total_amount || 0);
        const fallbackPaidAmount = linkedPayables.reduce((sum, payable) => {
          const payableInstallments = installmentsMap.get(payable.id) || [];
          if (payableInstallments.length > 0) {
            return sum;
          }
          return sum + (payable.paymentDate || payable.status === "paid" ? payable.totalAmount : 0);
        }, 0);
        const { status, paidAmount, pendingAmount } = computeStatus(
          totalAmount,
          installments,
          fallbackPaidAmount,
        );

        return {
          animalId: purchase.animal_id,
          aspirationId: purchase.aspiration_id,
          id: purchase.id,
          code: Number(purchase.code),
          supplierId: purchase.supplier_id,
          supplierName: supplierMap.get(purchase.supplier_id) || "Fornecedor não encontrado",
          purchaseDate: purchase.purchase_date,
          purchaseType: purchase.purchase_type,
          description: purchase.description,
          itemCode: purchase.item_code,
          itemName: purchase.item_name,
          totalAmount,
          installmentCount: Math.max(
            linkedPayables.reduce((sum, payable) => {
              const payableInstallments = installmentsMap.get(payable.id) || [];
              return sum + Math.max(payableInstallments.length, 1);
            }, 0),
            Number(purchase.installment_count || 0),
            1,
          ),
          notes: purchase.notes,
          pregnancyId: purchase.pregnancy_id,
          documentType: purchase.document_type,
          documentNumber: purchase.document_number,
          negotiationMethod: purchase.negotiation_method,
          issueDate: purchase.issue_date,
          competenceDate: purchase.competence_date,
          firstDueDate: purchase.first_due_date,
          originType: purchase.origin_type,
          recipientId: purchase.recipient_id,
          semenId: purchase.semen_id,
          storeId: purchase.store_id,
          storeName: storeMap.get(purchase.store_id) || "Fazenda não encontrada",
          linkedPayables,
          paidAmount,
          pendingAmount,
          status,
          installments: [],
        } satisfies PurchaseRow;
      });

      setPurchases(rows);
    } catch (error) {
      console.error("Erro ao carregar compras:", error);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega sempre que as permissões ou o período filtrado mudarem.
  // Ao trocar o período, o loading reaparece e a tela reflete o novo intervalo sem recarregar histórico desnecessário.
  useEffect(() => {
    if (permissionsLoading) return;
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadPurchases(periodStart, periodEnd);
  }, [permissionsLoading, canView, periodStart, periodEnd, loadPurchases]);

  useEffect(() => {
    setInstallmentsPage(1);
  }, [selectedPurchase?.id]);

  useEffect(() => {
    setListPage(1);
  }, [searchTerm, typeFilter, sortDirection, sortField, periodStart, periodEnd]);

  const loadPurchaseDetails = async (purchase: PurchaseRow) => {
    setDetailsLoading(true);
    setDeleteDialogOpen(false);
    setSelectedPurchase(purchase);

    try {
      const payables = await fetchAllPaginated<PayableTableRow>(() =>
        supabase
          .from("accounts_payable")
          .select(
            "id, purchase_id, description, total_amount, amount, payment_date, due_date, issue_date, competence_date:data_competencia, document_type, document_number, status, purchase_link_origin",
          )
          .eq("purchase_id", purchase.id),
      );

      const payableIds = payables.map((payable) => payable.id);
      const installmentsData =
        payableIds.length > 0
          ? await fetchAllPaginated<{
              account_payable_id: string;
              installment_number: number;
              due_date: string;
              amount: number;
              payment_date: string | null;
              status: string | null;
            }>(() =>
              supabase
                .from("accounts_payable_installments")
                .select("account_payable_id, installment_number, due_date, amount, payment_date, status")
                .in("account_payable_id", payableIds)
                .order("installment_number", { ascending: true }),
            )
          : [];

      const linkedPayables = payables.map((payable) => ({
        id: payable.id,
        description: payable.description,
        totalAmount: Number(payable.total_amount ?? payable.amount ?? 0),
        amount: Number(payable.amount || 0),
        paymentDate: payable.payment_date,
        dueDate: payable.due_date,
        issueDate: payable.issue_date,
        competenceDate: payable.competence_date,
        documentType: payable.document_type,
        documentNumber: payable.document_number,
        status: payable.status,
        purchaseLinkOrigin: payable.purchase_link_origin,
      }));

      const installmentsMap = new Map<string, PurchaseInstallmentRow[]>();
      installmentsData.forEach((installment) => {
        const current = installmentsMap.get(installment.account_payable_id) || [];
        const payable = payables.find((entry) => entry.id === installment.account_payable_id);
        current.push({
          displayInstallmentNumber: installment.installment_number,
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: Number(installment.amount || 0),
          payment_date: installment.payment_date,
          payableDescription: payable?.description || null,
          payableId: installment.account_payable_id,
          status: installment.status,
        });
        installmentsMap.set(installment.account_payable_id, current);
      });

      const installments = linkedPayables
        .flatMap((payable) => {
          const payableInstallments = installmentsMap.get(payable.id) || [];
          if (payableInstallments.length > 0) {
            return payableInstallments;
          }

          return [
            {
              displayInstallmentNumber: 1,
              installment_number: 1,
              due_date: payable.dueDate,
              amount: payable.totalAmount,
              payment_date: payable.paymentDate,
              payableDescription: payable.description,
              payableId: payable.id,
            } satisfies PurchaseInstallmentRow,
          ];
        })
        .sort((left, right) => {
          if (left.due_date === right.due_date) {
            return left.installment_number - right.installment_number;
          }
          return left.due_date.localeCompare(right.due_date);
        })
        .map((installment, index) => ({
          ...installment,
          displayInstallmentNumber: index + 1,
        }));

      const fallbackPaidAmount = linkedPayables.reduce((sum, payable) => {
        const payableInstallments = installmentsMap.get(payable.id) || [];
        if (payableInstallments.length > 0) {
          return sum;
        }
        return sum + (payable.paymentDate || payable.status === "paid" ? payable.totalAmount : 0);
      }, 0);
      const { status, paidAmount, pendingAmount } = computeStatus(
        purchase.totalAmount,
        installments,
        fallbackPaidAmount,
      );

      setSelectedPurchase({
        ...purchase,
        installmentCount: Math.max(
          linkedPayables.reduce((sum, payable) => {
            const payableInstallments = installmentsMap.get(payable.id) || [];
            return sum + Math.max(payableInstallments.length, 1);
          }, 0),
          purchase.installmentCount,
          1,
        ),
        linkedPayables,
        paidAmount,
        pendingAmount,
        status,
        installments,
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes da compra:", error);
      setSelectedPurchase(purchase);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return purchases.filter((purchase) => {
      const matchesType = typeFilter === "all" || purchase.purchaseType === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        purchase.supplierName.toLowerCase().includes(normalizedSearch) ||
        purchase.itemName.toLowerCase().includes(normalizedSearch) ||
        (purchase.itemCode || "").toLowerCase().includes(normalizedSearch) ||
        String(purchase.code).includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [purchases, searchTerm, typeFilter]);

  const sortedPurchases = useMemo(() => {
    const getComparableValue = (purchase: PurchaseRow, field: PurchaseSortField) => {
      switch (field) {
        case "code":
          return purchase.code;
        case "purchaseDate":
          return purchase.purchaseDate;
        case "supplierName":
          return purchase.supplierName;
        case "purchaseType":
          return PURCHASE_TYPE_LABELS[purchase.purchaseType];
        case "itemName":
          return buildSaleItemLabel({ code: purchase.itemCode, name: purchase.itemName });
        case "totalAmount":
          return purchase.totalAmount;
        case "pendingAmount":
          return purchase.pendingAmount;
        case "status":
          return statusMeta[purchase.status].label;
        default:
          return "";
      }
    };

    return [...filteredPurchases].sort((left, right) => {
      const leftValue = getComparableValue(left, sortField);
      const rightValue = getComparableValue(right, sortField);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }

      const comparison = String(leftValue).localeCompare(String(rightValue), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredPurchases, sortDirection, sortField]);

  const paginatedPurchases = useMemo(() => {
    const startIndex = (listPage - 1) * PAGE_SIZE;
    return sortedPurchases.slice(startIndex, startIndex + PAGE_SIZE);
  }, [listPage, sortedPurchases]);

  const listPageCount = Math.max(Math.ceil(sortedPurchases.length / PAGE_SIZE), 1);

  const toggleSort = (field: PurchaseSortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "code" || field === "totalAmount" ? "desc" : "asc");
  };

  const chartData = useMemo(() => buildChartData(purchases), [purchases]);

  const canDeleteSelectedPurchase = useMemo(() => {
    if (!selectedPurchase || !canEdit || detailsLoading || deleting) return false;

    const payablesArePending = selectedPurchase.linkedPayables.every(
      (payable) => payable.status === "pending" && !payable.paymentDate,
    );
    const installmentsArePending = selectedPurchase.installments.every(
      (installment) =>
        installment.status !== "pagamento_suspenso" &&
        installment.status !== "paid" &&
        !installment.payment_date,
    );

    return selectedPurchase.status === "pending" && payablesArePending && installmentsArePending;
  }, [canEdit, deleting, detailsLoading, selectedPurchase]);

  const canEditSelectedPurchase = useMemo(() => {
    if (!selectedPurchase || !canEdit || detailsLoading) return false;

    if (selectedPurchase.originType !== "manual") return false;
    if (selectedPurchase.linkedPayables.length !== 1) return false;

    const payablesAreEditable = selectedPurchase.linkedPayables.every(
      (payable) =>
        payable.status !== "pagamento_suspenso" &&
        payable.status !== "paid" &&
        !payable.paymentDate,
    );
    const installmentsAreEditable = selectedPurchase.installments.every(
      (installment) =>
        installment.status !== "pagamento_suspenso" &&
        installment.status !== "paid" &&
        !installment.payment_date,
    );

    return payablesAreEditable && installmentsAreEditable;
  }, [canEdit, detailsLoading, selectedPurchase]);

  const editPurchaseBlockedReason = useMemo(() => {
    if (!selectedPurchase || !canEdit) return null;
    if (detailsLoading) return "Aguarde o carregamento completo dos detalhes para validar a edição.";
    if (selectedPurchase.originType !== "manual") {
      return "Compras migradas do financeiro não podem ser editadas por este fluxo.";
    }
    if (selectedPurchase.linkedPayables.length !== 1) {
      return "A compra precisa ter exatamente um título manual vinculado para permitir edição.";
    }
    if (
      selectedPurchase.linkedPayables.some(
        (payable) =>
          payable.status === "pagamento_suspenso" ||
          payable.status === "paid" ||
          Boolean(payable.paymentDate),
      )
    ) {
      return "A compra possui título com pagamento realizado ou suspenso.";
    }
    if (
      selectedPurchase.installments.some(
        (installment) =>
          installment.status === "pagamento_suspenso" ||
          installment.status === "paid" ||
          Boolean(installment.payment_date),
      )
    ) {
      return "A compra possui parcela paga ou suspensa e não pode ser editada.";
    }
    return null;
  }, [canEdit, detailsLoading, selectedPurchase]);

  const deletePurchaseBlockedReason = useMemo(() => {
    if (!selectedPurchase || !canEdit) return null;
    if (detailsLoading) return "Aguarde o carregamento completo dos detalhes para validar a exclusão.";
    if (selectedPurchase.status !== "pending") {
      return "Somente compras com status pendente podem ser excluídas.";
    }
    if (
      selectedPurchase.linkedPayables.some(
        (payable) => payable.status !== "pending" || Boolean(payable.paymentDate),
      )
    ) {
      return "A compra possui título com pagamento realizado ou com status diferente de pendente.";
    }
    if (selectedPurchase.installments.some((installment) => installment.payment_date)) {
      return "A compra possui parcela paga e não pode ser excluída.";
    }
    if (
      selectedPurchase.installments.some(
        (installment) =>
          installment.status === "pagamento_suspenso" || installment.status === "paid",
      )
    ) {
      return "A compra possui parcela suspensa ou já liquidada e não pode ser excluída.";
    }
    return null;
  }, [canEdit, detailsLoading, selectedPurchase]);

  const selectedPurchaseLastDueDate = useMemo(() => {
    if (!selectedPurchase) return null;
    if (selectedPurchase.installments.length === 0) {
      return selectedPurchase.firstDueDate;
    }

    return [...selectedPurchase.installments]
      .sort((left, right) => right.due_date.localeCompare(left.due_date))[0]
      ?.due_date;
  }, [selectedPurchase]);

  const paginatedInstallments = useMemo(() => {
    if (!selectedPurchase) return [];
    const startIndex = (installmentsPage - 1) * 4;
    return selectedPurchase.installments.slice(startIndex, startIndex + 4);
  }, [installmentsPage, selectedPurchase]);

  const installmentsPageCount = selectedPurchase
    ? Math.max(Math.ceil(selectedPurchase.installments.length / 4), 1)
    : 1;

  // Rótulo legível do período selecionado, usado nas descrições dos cards.
  const periodLabel = useMemo(() => {
    const fmt = (dateStr: string) =>
      new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${fmt(periodStart)} a ${fmt(periodEnd)}`;
  }, [periodStart, periodEnd]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalBought = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
    const totalPaid = purchases.reduce((sum, purchase) => sum + purchase.paidAmount, 0);
    const totalPending = purchases.reduce((sum, purchase) => sum + purchase.pendingAmount, 0);

    return [
      {
        title: "Valor comprado",
        value: formatCurrencyBRL(totalBought),
        description: `Acumulado no período: ${periodLabel}`,
        icon: ShoppingCart,
        accent: "from-indigo-500/18 to-indigo-500/5 text-indigo-700",
      },
      {
        title: "Pago",
        value: formatCurrencyBRL(totalPaid),
        description: `Baixas identificadas no período: ${periodLabel}`,
        icon: HandCoins,
        accent: "from-emerald-500/18 to-emerald-500/5 text-emerald-700",
      },
      {
        title: "Pendente",
        value: formatCurrencyBRL(totalPending),
        description: `Saldo aberto no Contas a Pagar — ${periodLabel}`,
        icon: CircleDollarSign,
        accent: "from-amber-500/18 to-amber-500/5 text-amber-700",
      },
      {
        title: "Compras registradas",
        value: `${purchases.length}`,
        description: `Aquisições rastreadas no período: ${periodLabel}`,
        icon: Activity,
        accent: "from-slate-500/18 to-slate-500/5 text-slate-700",
      },
    ];
  }, [purchases, periodLabel]);

  const purchasesByType = useMemo(() => {
    return PURCHASE_TYPE_OPTIONS.map((type) => {
      const count = new Set(
        purchases
          .filter((purchase) => purchase.purchaseType === type.value)
          .map((purchase) => getPurchaseEntityKey(purchase)),
      ).size;
      return {
        ...type,
        count,
      };
    });
  }, [purchases]);

  const renderSortableHeader = (
    label: string,
    field: PurchaseSortField,
    align: "left" | "center" | "right" = "left",
  ) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={cn(
        "inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
        align === "center" && "mx-auto flex",
        align === "right" && "ml-auto flex",
      )}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={cn(
          "h-3.5 w-3.5",
          sortField === field ? "text-foreground" : "text-muted-foreground/70",
        )}
      />
    </button>
  );

  const handleDeletePurchase = async () => {
    if (!selectedPurchase) return;

    setDeleting(true);
    try {
      const result = await deletePurchaseWithPayable(selectedPurchase.id);

      toast.success(
        result?.deleted_payables
          ? `Compra #${result.purchase_code} excluída com ${result.deleted_payables} título(s) no contas a pagar.`
          : `Compra #${selectedPurchase.code} excluída com sucesso.`,
      );

      setDeleteDialogOpen(false);
      setSelectedPurchase(null);
      await loadPurchases(periodStart, periodEnd);
    } catch (error: unknown) {
      console.error("Erro ao excluir compra:", error);
      const message = error instanceof Error ? error.message : "Não foi possível excluir a compra.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando módulo de compras...
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
            O módulo de compras utiliza a mesma base financeira do Contas a Pagar e segue as permissões do Financeiro.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-700">
            Aquisições
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Compras</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Registre aquisições de animais e reprodutivos com geração automática dos títulos no Contas a Pagar.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={() => {
              setPurchaseFormMode("create");
              setEditingPurchaseId(null);
              setPurchaseFormOpen(true);
            }}
            className="h-11 rounded-2xl bg-indigo-600 px-5 text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova compra
          </Button>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(248,250,255,1),rgba(243,245,250,1))] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compras nos últimos meses</CardTitle>
            <CardDescription>Evolução mensal do valor adquirido no módulo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="purchaseArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-muted-foreground">Total comprado</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrencyBRL(Number(value || 0))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={2.5}
                  fill="url(#purchaseArea)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border-border/70 bg-card/80 shadow-sm">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl bg-gradient-to-br p-3 shadow-sm",
                      card.accent,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {purchasesByType.map((entry) => (
          <Card key={entry.value} className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">{entry.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{entry.count}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-700">
                <PackagePlus className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-base">Listagem de compras</CardTitle>
                <CardDescription>
                  Consulte a compra, o fornecedor, o item adquirido e o reflexo financeiro gerado.
                </CardDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_200px]">
                <div className="space-y-2">
                  <Label htmlFor="purchase-search">Pesquisar</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="purchase-search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Código, fornecedor ou item"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={typeFilter} onValueChange={(value: "all" | PurchaseType) => setTypeFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {PURCHASE_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Filtro de período — edita o rascunho livremente; a busca só ocorre ao clicar em "Filtrar" */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-end">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="font-medium text-foreground">Período</span>
              </div>
              <div className="flex flex-1 flex-wrap gap-3 sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="period-start" className="text-xs">
                    Data inicial
                  </Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={draftStart}
                    max={draftEnd}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="h-9 w-full sm:w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="period-end" className="text-xs">
                    Data final
                  </Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={draftEnd}
                    min={draftStart}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="h-9 w-full sm:w-40"
                  />
                </div>
                {/* Atalhos: pré-preenchem o rascunho mas NÃO disparam a busca */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 self-end text-xs"
                  onClick={() => {
                    setDraftStart(getDateOffset(2, true));
                    setDraftEnd(getDateOffset(0));
                  }}
                >
                  Últimos 2 meses
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 self-end text-xs"
                  onClick={() => {
                    setDraftStart(getDateOffset(6, true));
                    setDraftEnd(getDateOffset(0));
                  }}
                >
                  Últimos 6 meses
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 self-end text-xs"
                  onClick={() => {
                    const now = new Date();
                    setDraftStart(`${now.getFullYear()}-01-01`);
                    setDraftEnd(getDateOffset(0));
                  }}
                >
                  Este ano
                </Button>
                {/* Único botão que confirma e dispara a query no banco */}
                <Button
                  size="sm"
                  className="h-9 shrink-0 self-end bg-indigo-600 text-white hover:bg-indigo-700"
                  disabled={loading || !draftStart || !draftEnd}
                  onClick={() => {
                    setPeriodStart(draftStart);
                    setPeriodEnd(draftEnd);
                  }}
                >
                  {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Filtrar
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{renderSortableHeader("Código", "code")}</TableHead>
                  <TableHead>{renderSortableHeader("Data", "purchaseDate")}</TableHead>
                  <TableHead>{renderSortableHeader("Fornecedor", "supplierName")}</TableHead>
                  <TableHead>{renderSortableHeader("Tipo", "purchaseType")}</TableHead>
                  <TableHead>{renderSortableHeader("Item comprado", "itemName")}</TableHead>
                  <TableHead className="text-right">{renderSortableHeader("Valor total", "totalAmount", "right")}</TableHead>
                  <TableHead className="text-right">{renderSortableHeader("Pendente", "pendingAmount", "right")}</TableHead>
                  <TableHead>{renderSortableHeader("Status", "status")}</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      Nenhuma compra encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">#{purchase.code}</TableCell>
                      <TableCell>{formatDateBR(purchase.purchaseDate)}</TableCell>
                      <TableCell className="min-w-[220px]">{purchase.supplierName}</TableCell>
                      <TableCell>{PURCHASE_TYPE_LABELS[purchase.purchaseType]}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {buildSaleItemLabel({ code: purchase.itemCode, name: purchase.itemName })}
                          </p>
                          <p className="text-xs text-muted-foreground">{purchase.storeName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[170px] text-right">
                        <div className="space-y-2">
                          <p>{formatCurrencyBRL(purchase.totalAmount)}</p>
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${getPaidProgress(purchase)}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {getPaidProgress(purchase).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })}
                              % pago
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[170px] text-right">
                        <div className="space-y-2">
                          <p>{formatCurrencyBRL(purchase.pendingAmount)}</p>
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all"
                                style={{ width: `${Math.max(0, 100 - getPaidProgress(purchase))}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {Math.max(0, 100 - getPaidProgress(purchase)).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })}
                              % em aberto
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta[purchase.status].className}>
                          {statusMeta[purchase.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void loadPurchaseDetails(purchase)}>
                          Ver detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo {paginatedPurchases.length} de {sortedPurchases.length} compras.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setListPage((current) => Math.max(current - 1, 1))}
                disabled={listPage === 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {listPage} de {listPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setListPage((current) => Math.min(current + 1, listPageCount))}
                disabled={listPage === listPageCount}
              >
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PurchasesCreateModal
        open={purchaseFormOpen}
        onOpenChange={setPurchaseFormOpen}
        onSaved={async () => {
          await loadPurchases(periodStart, periodEnd);
        }}
        mode={purchaseFormMode}
        purchaseId={editingPurchaseId}
      />

      <PurchaseInvoiceModal
        open={invoiceModalOpen}
        onOpenChange={(open) => {
          setInvoiceModalOpen(open);
          if (!open) setInvoicePurchase(null);
        }}
        purchaseId={invoicePurchase?.id ?? null}
        purchaseCode={invoicePurchase?.code ?? null}
        canEdit={canEdit}
      />

      <Dialog
        open={Boolean(selectedPurchase)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setSelectedPurchase(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-[67.2rem] overflow-y-auto">
          {selectedPurchase && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <DialogHeader>
                  <DialogTitle>Compra #{selectedPurchase.code}</DialogTitle>
                  <DialogDescription>
                    Rastreabilidade completa entre a aquisição e os títulos vinculados no financeiro.
                  </DialogDescription>
                </DialogHeader>

                {canEdit && (
                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!selectedPurchase) return;
                          setDeleteDialogOpen(false);
                          setPurchaseFormMode("edit");
                          setEditingPurchaseId(selectedPurchase.id);
                          setPurchaseFormOpen(true);
                          setSelectedPurchase(null);
                        }}
                        disabled={!canEditSelectedPurchase}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar compra
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!selectedPurchase) return;
                          setInvoicePurchase({ id: selectedPurchase.id, code: selectedPurchase.code });
                          setInvoiceModalOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        Upload de NF
                      </Button>
                    </div>
                    {editPurchaseBlockedReason && (
                      <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
                        {editPurchaseBlockedReason}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={!canDeleteSelectedPurchase}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir compra
                    </Button>
                    {deletePurchaseBlockedReason && (
                      <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
                        {deletePurchaseBlockedReason}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {detailsLoading ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando detalhes financeiros da compra...
                  </div>
                </div>
              ) : (
                <>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Compra</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Fornecedor</span>
                      <span className="text-right font-medium">{selectedPurchase.supplierName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium">{PURCHASE_TYPE_LABELS[selectedPurchase.purchaseType]}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Item</span>
                      <span className="text-right font-medium">
                        {buildSaleItemLabel({
                          code: selectedPurchase.itemCode,
                          name: selectedPurchase.itemName,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Fazenda</span>
                      <span className="text-right font-medium">{selectedPurchase.storeName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Data da compra</span>
                      <span className="font-medium">{formatDateBR(selectedPurchase.purchaseDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Valor total</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedPurchase.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Origem</span>
                      <Badge
                        variant="outline"
                        className={
                          selectedPurchase.originType === "migrated_from_accounts_payable"
                            ? "border-sky-200 bg-sky-100 text-sky-800"
                            : "border-indigo-200 bg-indigo-100 text-indigo-800"
                        }
                      >
                        {selectedPurchase.originType === "migrated_from_accounts_payable"
                          ? "Migrada do financeiro"
                          : "Compra manual"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Negociação</span>
                      <span className="text-right font-medium">
                        {selectedPurchase.negotiationMethod || "Não informado"}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                      {selectedPurchase.notes || "Sem observações adicionais."}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reflexo financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Títulos vinculados</span>
                      <span className="font-medium">{selectedPurchase.linkedPayables.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Parcelas</span>
                      <span className="font-medium">{selectedPurchase.installments.length || selectedPurchase.installmentCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Emissão</span>
                      <span className="font-medium">{formatDateBR(selectedPurchase.issueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Competência</span>
                      <span className="font-medium">{formatDateBR(selectedPurchase.competenceDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Primeiro vencimento</span>
                      <span className="font-medium">{formatDateBR(selectedPurchase.firstDueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Último vencimento</span>
                      <span className="font-medium">{formatDateBR(selectedPurchaseLastDueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Pago</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedPurchase.paidAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Pendente</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedPurchase.pendingAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className={statusMeta[selectedPurchase.status].className}>
                        {statusMeta[selectedPurchase.status].label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Títulos vinculados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Origem do vínculo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPurchase.linkedPayables.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              Nenhum título vinculado encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedPurchase.linkedPayables.map((payable) => (
                            <TableRow key={payable.id}>
                              <TableCell className="font-medium">{payable.id.slice(0, 8)}</TableCell>
                              <TableCell className="min-w-[260px]">{payable.description}</TableCell>
                              <TableCell>
                                {payable.documentType || payable.documentNumber
                                  ? `${payable.documentType || ""}${payable.documentType && payable.documentNumber ? " / " : ""}${payable.documentNumber || ""}`
                                  : "Não informado"}
                              </TableCell>
                              <TableCell>{formatDateBR(payable.dueDate)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrencyBRL(payable.totalAmount)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    payable.status === "paid"
                                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                      : payable.status === "partial"
                                        ? "border-sky-200 bg-sky-100 text-sky-800"
                                        : "border-amber-200 bg-amber-100 text-amber-800"
                                  }
                                >
                                  {payable.status === "paid"
                                    ? "Pago"
                                    : payable.status === "partial"
                                      ? "Parcial"
                                      : "Pendente"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {payable.purchaseLinkOrigin === "migration"
                                  ? "Migração"
                                  : payable.purchaseLinkOrigin === "manual"
                                    ? "Cadastro de compra"
                                    : "Não identificado"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Parcelas geradas</CardTitle>
                    {selectedPurchase.installments.length > 4 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInstallmentsPage((current) => Math.max(current - 1, 1))}
                          disabled={installmentsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Página {installmentsPage} de {installmentsPageCount}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setInstallmentsPage((current) => Math.min(current + 1, installmentsPageCount))
                          }
                          disabled={installmentsPage === installmentsPageCount}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPurchase.installments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              Nenhuma parcela vinculada encontrada.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedInstallments.map((installment) => (
                            <TableRow
                              key={`${selectedPurchase.id}-${installment.payableId}-${installment.installment_number}`}
                            >
                              <TableCell className="font-medium">
                                {installment.displayInstallmentNumber}
                              </TableCell>
                              <TableCell>{formatDateBR(installment.due_date)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrencyBRL(installment.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <Badge
                                    variant="outline"
                                    className={
                                      installment.payment_date
                                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                        : "border-amber-200 bg-amber-100 text-amber-800"
                                    }
                                  >
                                    {installment.payment_date
                                      ? `Paga em ${formatDateBR(installment.payment_date)}`
                                      : "Em aberto"}
                                  </Badge>
                                  {installment.payableDescription && (
                                    <span className="text-xs text-muted-foreground">
                                      {installment.payableDescription}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedPurchase.installments.length > 4 && (
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <p className="text-muted-foreground">
                        Exibindo {paginatedInstallments.length} de {selectedPurchase.installments.length} parcelas.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInstallmentsPage((current) => Math.max(current - 1, 1))}
                          disabled={installmentsPage === 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setInstallmentsPage((current) => Math.min(current + 1, installmentsPageCount))
                          }
                          disabled={installmentsPage === installmentsPageCount}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPurchase
                ? `Tem certeza que deseja excluir a compra #${selectedPurchase.code}? Esta ação também removerá o registro vinculado no Contas a Pagar.`
                : "Tem certeza que deseja excluir esta compra?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePurchase();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir compra"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchasesModule;
