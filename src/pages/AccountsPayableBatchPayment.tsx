import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  Filter,
  History,
  Layers3,
  Loader2,
  RotateCcw,
  WalletCards,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { type FinancialAllocationType } from "@/lib/financialAllocations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type AllocationFilterValue = "all" | FinancialAllocationType;
type EligibleSortField = "documentNumber" | "supplierName" | "dueDate" | "amount" | "allocation";
type SortDirection = "asc" | "desc";

interface SupplierOption {
  id: string;
  name: string;
}

interface PaymentAccountOption {
  id: string;
  name: string;
  type: "current" | "cash" | "card" | "delivery";
}

interface EligibleInstallmentRow {
  id: string;
  accountPayableId: string;
  installmentNumber: number;
  documentNumber: string;
  supplierName: string;
  dueDate: string;
  amount: number;
  allocationLabels: string[];
}

interface BatchRow {
  id: string;
  batchNumber: number;
  createdAt: string;
  createdByName: string;
  paymentAccountName: string;
  paymentAccountType: string;
  paymentDate: string;
  installmentsCount: number;
  totalAmount: number;
  status: string;
  reversedAt: string | null;
  reversedByName: string | null;
}

interface BatchItemRow {
  id: string;
  documentNumber: string;
  supplierName: string;
  dueDate: string;
  amount: number;
  installmentLabel: string;
  allocationLabels: string[];
  status: string;
  paymentDate: string | null;
}

const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountOption["type"], string> = {
  current: "Conta Corrente",
  cash: "Conta Caixa",
  card: "Conta Cartão",
  delivery: "Delivery",
};

const formatCurrencyBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const formatDateBR = (value: string | null | undefined) => {
  if (!value) return "-";
  return format(parseISO(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTimeBR = (value: string | null | undefined) => {
  if (!value) return "-";
  return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const formatBatchCode = (batchNumber: number) => `LBP-${String(batchNumber).padStart(6, "0")}`;
const normalizeSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const getPartnerName = (payable: any) =>
  payable?.suppliers?.name || payable?.employees?.name || "Não informado";

const getInstallmentStatusLabel = (status: string, paymentDate: string | null) => {
  if (paymentDate) return "Pago";
  if (status === "pagamento_suspenso") return "Pagamento suspenso";
  return "Pendente";
};

const getInstallmentStatusVariant = (status: string, paymentDate: string | null) => {
  if (paymentDate) return "default";
  if (status === "pagamento_suspenso") return "secondary";
  return "outline";
};

async function fetchAccountAllocationMetadata(accountIds: string[]) {
  const labelsByAccount = new Map<string, string[]>();
  const typesByAccount = new Map<string, Set<string>>();

  if (accountIds.length === 0) {
    return { labelsByAccount, typesByAccount };
  }

  const items = await fetchAllPaginated<{ id: string; account_payable_id: string }>(() =>
    supabase
      .from("accounts_payable_items")
      .select("id, account_payable_id")
      .in("account_payable_id", accountIds)
      .order("id", { ascending: true }),
  );

  if (items.length === 0) {
    return { labelsByAccount, typesByAccount };
  }

  const itemToAccount = new Map(items.map((item) => [item.id, item.account_payable_id]));
  const itemIds = items.map((item) => item.id);

  const allocations = await fetchAllPaginated<any>(() =>
    supabase
      .from("accounts_payable_item_allocations")
      .select(`
        id,
        account_payable_item_id,
        allocation_type,
        animal_id,
        aspiration_id,
        pregnancy_id,
        embryo_transfer_id,
        recipient_id,
        semen_id,
        animals:animal_id(name, code),
        aspiration_management:aspiration_id(name, code),
        pregnancy_management:pregnancy_id(name, code),
        embryo_transfer_management:embryo_transfer_id(name, code),
        semen_ref:semen_id(name, code)
      `)
      .in("account_payable_item_id", itemIds)
      .order("id", { ascending: true }),
  );

  const recipientIds = Array.from(
    new Set((allocations || []).map((allocation: any) => allocation.recipient_id).filter(Boolean)),
  ) as string[];

  const recipients =
    recipientIds.length > 0
      ? await fetchAllPaginated<any>(() =>
          supabase.from("animals").select("id, name, code").in("id", recipientIds).order("id", { ascending: true }),
        )
      : [];

  const recipientMap = new Map(
    recipients.map((recipient: any) => [recipient.id, `${recipient.code} - ${recipient.name}`]),
  );

  allocations.forEach((allocation: any) => {
    const accountId = itemToAccount.get(allocation.account_payable_item_id);
    if (!accountId) return;

    const currentLabels = labelsByAccount.get(accountId) || [];
    const currentTypes = typesByAccount.get(accountId) || new Set<string>();

    let label = "";
    if (allocation.animal_id && allocation.animals) {
      label = `Animal: ${(allocation.animals as any).code} - ${(allocation.animals as any).name}`;
    } else if (allocation.pregnancy_id && allocation.pregnancy_management) {
      label = `Prenhez: ${(allocation.pregnancy_management as any).code} - ${(allocation.pregnancy_management as any).name}`;
    } else if (allocation.embryo_transfer_id && allocation.embryo_transfer_management) {
      label = `Pós TE: ${(allocation.embryo_transfer_management as any).code} - ${(allocation.embryo_transfer_management as any).name}`;
    } else if (allocation.aspiration_id && allocation.aspiration_management) {
      label = `Aspiração: ${(allocation.aspiration_management as any).code} - ${(allocation.aspiration_management as any).name}`;
    } else if (allocation.recipient_id && recipientMap.has(allocation.recipient_id)) {
      label = `Receptora: ${recipientMap.get(allocation.recipient_id)}`;
    } else if (allocation.semen_id && allocation.semen_ref) {
      label = `Sêmen: ${(allocation.semen_ref as any).code} - ${(allocation.semen_ref as any).name}`;
    }

    if (label && !currentLabels.includes(label)) {
      currentLabels.push(label);
      labelsByAccount.set(accountId, currentLabels);
    }

    if (allocation.allocation_type) {
      currentTypes.add(allocation.allocation_type);
      typesByAccount.set(accountId, currentTypes);
    }
  });

  return { labelsByAccount, typesByAccount };
}

const AccountsPayableBatchPayment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountOption[]>([]);
  const [eligibleRows, setEligibleRows] = useState<EligibleInstallmentRow[]>([]);
  const [lots, setLots] = useState<BatchRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasSearchedEligible, setHasSearchedEligible] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [processingReverse, setProcessingReverse] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState("");
  const [selectedPaymentDate, setSelectedPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewingLot, setViewingLot] = useState<BatchRow | null>(null);
  const [viewingLotItems, setViewingLotItems] = useState<BatchItemRow[]>([]);
  const [loadingLotItems, setLoadingLotItems] = useState(false);
  const [lotPendingReverse, setLotPendingReverse] = useState<BatchRow | null>(null);

  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [allocationTypeFilter, setAllocationTypeFilter] = useState<AllocationFilterValue>("all");
  const [allocationSearch, setAllocationSearch] = useState("");
  const [sortField, setSortField] = useState<EligibleSortField>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const visibleRows = useMemo(() => {
    const normalizedAllocationSearch = normalizeSearchText(allocationSearch.trim());
    const filteredRows = eligibleRows.filter((row) => {
      if (!normalizedAllocationSearch) return true;
      return normalizeSearchText(row.allocationLabels.join(" ")).includes(normalizedAllocationSearch);
    });

    return [...filteredRows].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "documentNumber":
          comparison = a.documentNumber.localeCompare(b.documentNumber, "pt-BR", { sensitivity: "base" });
          break;
        case "supplierName":
          comparison = a.supplierName.localeCompare(b.supplierName, "pt-BR", { sensitivity: "base" });
          break;
        case "dueDate":
          comparison = a.dueDate.localeCompare(b.dueDate);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "allocation":
          comparison = a.allocationLabels.join(" | ").localeCompare(b.allocationLabels.join(" | "), "pt-BR", {
            sensitivity: "base",
          });
          break;
      }

      if (comparison === 0) {
        comparison = a.id.localeCompare(b.id);
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });
  }, [allocationSearch, eligibleRows, sortDirection, sortField]);

  const selectedRows = useMemo(
    () => eligibleRows.filter((row) => selectedIds.has(row.id)),
    [eligibleRows, selectedIds],
  );

  const selectedAmount = useMemo(
    () => selectedRows.reduce((total, row) => total + Number(row.amount || 0), 0),
    [selectedRows],
  );

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = visibleRows.some((row) => selectedIds.has(row.id));

  useEffect(() => {
    if (permissionsLoading || !canView) return;

    void Promise.all([fetchSuppliers(), fetchPaymentAccounts(), fetchBatchLots()]);
  }, [permissionsLoading, canView]);

  const fetchSuppliers = async () => {
    const data = await fetchAllPaginated<SupplierOption>(() =>
      supabase.from("suppliers").select("id, name").order("name", { ascending: true }),
    );
    setSuppliers(data);
  };

  const fetchPaymentAccounts = async () => {
    const [currentAccounts, cashAccounts, cardAccounts, deliveryAccounts] = await Promise.all([
      fetchAllPaginated<any>(() =>
        supabase
          .from("current_accounts")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ),
      fetchAllPaginated<any>(() =>
        supabase.from("cash_accounts").select("id, name").eq("is_active", true).order("name", { ascending: true }),
      ),
      fetchAllPaginated<any>(() =>
        supabase.from("card_accounts").select("id, name").eq("is_active", true).order("name", { ascending: true }),
      ),
      fetchAllPaginated<any>(() =>
        supabase
          .from("delivery_accounts")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ),
    ]);

    const allAccounts: PaymentAccountOption[] = [
      ...currentAccounts.map((account) => ({ id: account.id, name: account.name, type: "current" as const })),
      ...cashAccounts.map((account) => ({ id: account.id, name: account.name, type: "cash" as const })),
      ...cardAccounts.map((account) => ({ id: account.id, name: account.name, type: "card" as const })),
      ...deliveryAccounts.map((account) => ({ id: account.id, name: account.name, type: "delivery" as const })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    setPaymentAccounts(allAccounts);
  };

  const fetchEligibleInstallments = async () => {
    setLoadingEligible(true);
    setHasSearchedEligible(true);
    try {
      const payables = await fetchAllPaginated<any>(() => {
        let query = supabase
          .from("accounts_payable")
          .select(`
            id,
            document_number,
            description,
            status,
            supplier_id,
            employee_id,
            suppliers(name),
            employees(name)
          `)
          .in("status", ["pending", "partial"])
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });

        if (supplierFilter !== "all") {
          query = query.eq("supplier_id", supplierFilter);
        }

        return query;
      });

      let accountIds = payables.map((payable) => payable.id);
      const payablesMap = new Map(payables.map((payable) => [payable.id, payable]));

      const { labelsByAccount, typesByAccount } = await fetchAccountAllocationMetadata(accountIds);

      if (allocationTypeFilter !== "all") {
        accountIds = accountIds.filter((accountId) => typesByAccount.get(accountId)?.has(allocationTypeFilter));
      }

      if (accountIds.length === 0) {
        setEligibleRows([]);
        setSelectedIds(new Set());
        return;
      }

      const installments = await fetchAllPaginated<any>(() => {
        let query = supabase
          .from("accounts_payable_installments")
          .select("id, account_payable_id, installment_number, due_date, amount, payment_date, status")
          .in("account_payable_id", accountIds)
          .is("payment_date", null)
          .neq("status", "pagamento_suspenso")
          .order("due_date", { ascending: true })
          .order("id", { ascending: true });

        if (dueDateFrom) {
          query = query.gte("due_date", dueDateFrom);
        }
        if (dueDateTo) {
          query = query.lte("due_date", dueDateTo);
        }

        return query;
      });

      const rows: EligibleInstallmentRow[] = installments
        .filter((installment) => payablesMap.has(installment.account_payable_id))
        .map((installment) => {
          const payable = payablesMap.get(installment.account_payable_id);
          return {
            id: installment.id,
            accountPayableId: installment.account_payable_id,
            installmentNumber: installment.installment_number,
            documentNumber: payable?.document_number || payable?.description || "Sem número",
            supplierName: getPartnerName(payable),
            dueDate: installment.due_date,
            amount: Number(installment.amount || 0),
            allocationLabels: labelsByAccount.get(installment.account_payable_id) || [],
          };
        });

      setEligibleRows(rows);
      setSelectedIds((previous) => new Set(rows.filter((row) => previous.has(row.id)).map((row) => row.id)));
    } catch (error) {
      console.error("Erro ao buscar parcelas elegíveis:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as parcelas pendentes para baixa em lote.",
        variant: "destructive",
      });
    } finally {
      setLoadingEligible(false);
    }
  };

  const fetchBatchLots = async () => {
    setLoadingLots(true);
    try {
      const data = await fetchAllPaginated<any>(() =>
        supabase
          .from("accounts_payable_payment_batches")
          .select(`
            id,
            batch_number,
            created_at,
            payment_account_name,
            payment_account_type,
            payment_date,
            installments_count,
            total_amount,
            status,
            reversed_at,
            creator:profiles!accounts_payable_payment_batches_created_by_fkey(name),
            reverser:profiles!accounts_payable_payment_batches_reversed_by_fkey(name)
          `)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      );

      setLots(
        data.map((row) => ({
          id: row.id,
          batchNumber: row.batch_number,
          createdAt: row.created_at,
          createdByName: row.creator?.name || "Usuário",
          paymentAccountName: row.payment_account_name,
          paymentAccountType: row.payment_account_type,
          paymentDate: row.payment_date,
          installmentsCount: Number(row.installments_count || 0),
          totalAmount: Number(row.total_amount || 0),
          status: row.status,
          reversedAt: row.reversed_at,
          reversedByName: row.reverser?.name || null,
        })),
      );
    } catch (error) {
      console.error("Erro ao buscar lotes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de baixas em lote.",
        variant: "destructive",
      });
    } finally {
      setLoadingLots(false);
    }
  };

  const fetchLotItems = async (lot: BatchRow) => {
    setViewingLot(lot);
    setLoadingLotItems(true);
    try {
      const items = await fetchAllPaginated<any>(() =>
        supabase
          .from("accounts_payable_payment_batch_items")
          .select(`
            id,
            account_payable_id,
            amount,
            accounts_payable(
              id,
              document_number,
              description,
              supplier_id,
              employee_id,
              suppliers(name),
              employees(name)
            ),
            accounts_payable_installments(
              id,
              installment_number,
              due_date,
              payment_date,
              status
            )
          `)
          .eq("batch_id", lot.id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      );

      const accountIds = Array.from(new Set(items.map((item) => item.account_payable_id)));
      const { labelsByAccount } = await fetchAccountAllocationMetadata(accountIds);

      const rows: BatchItemRow[] = items.map((item) => {
        const payable = item.accounts_payable;
        const installment = item.accounts_payable_installments;
        return {
          id: item.id,
          documentNumber: payable?.document_number || payable?.description || "Sem número",
          supplierName: getPartnerName(payable),
          dueDate: installment?.due_date || "",
          amount: Number(item.amount || 0),
          installmentLabel: installment?.installment_number ? `${installment.installment_number}` : "-",
          allocationLabels: labelsByAccount.get(item.account_payable_id) || [],
          status: installment?.status || "pending",
          paymentDate: installment?.payment_date || null,
        };
      });

      setViewingLotItems(rows);
    } catch (error) {
      console.error("Erro ao buscar itens do lote:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as parcelas do lote selecionado.",
        variant: "destructive",
      });
    } finally {
      setLoadingLotItems(false);
    }
  };

  const handleToggleAllVisible = (checked: boolean | "indeterminate") => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (!checked || checked === "indeterminate") {
        visibleRows.forEach((row) => next.delete(row.id));
        return next;
      }

      visibleRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const handleToggleRow = (rowId: string, checked: boolean | "indeterminate") => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked && checked !== "indeterminate") {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const handleOpenBatchDialog = () => {
    if (selectedRows.length === 0) return;
    setSelectedPaymentAccountId("");
    setSelectedPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentDialogOpen(true);
  };

  const handleSort = (field: EligibleSortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const renderSortIcon = (field: EligibleSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleCreateBatch = async () => {
    const selectedAccount = paymentAccounts.find((account) => account.id === selectedPaymentAccountId);
    if (!selectedAccount || !selectedPaymentDate || selectedRows.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a conta financeira e a data da baixa antes de confirmar.",
        variant: "destructive",
      });
      return;
    }

    setProcessingBatch(true);
    try {
      const { data, error } = await supabase.rpc("create_accounts_payable_payment_batch", {
        p_installment_ids: selectedRows.map((row) => row.id),
        p_payment_account_id: selectedAccount.id,
        p_payment_account_type: selectedAccount.type,
        p_payment_date: selectedPaymentDate,
      });

      if (error) throw error;

      const createdBatch = data?.[0];

      toast({
        title: "Baixa em lote concluída",
        description: createdBatch
          ? `Lote ${formatBatchCode(createdBatch.batch_number)} criado com ${createdBatch.installments_count} parcela(s).`
          : "As parcelas selecionadas foram baixadas com sucesso.",
      });

      setPaymentDialogOpen(false);
      setSelectedIds(new Set());
      await Promise.all([fetchEligibleInstallments(), fetchBatchLots()]);
    } catch (error: any) {
      console.error("Erro ao processar baixa em lote:", error);
      toast({
        title: "Erro ao baixar lote",
        description: error?.message || "Não foi possível concluir a baixa em lote.",
        variant: "destructive",
      });
    } finally {
      setProcessingBatch(false);
    }
  };

  const handleReverseBatch = async () => {
    if (!lotPendingReverse) return;

    setProcessingReverse(true);
    try {
      const { data, error } = await supabase.rpc("reverse_accounts_payable_payment_batch", {
        p_batch_id: lotPendingReverse.id,
      });

      if (error) throw error;

      const reversed = data?.[0];

      toast({
        title: "Lote desfeito",
        description: reversed
          ? `Lote ${formatBatchCode(reversed.batch_number)} desfeito com ${reversed.reversed_count} parcela(s) reabertas.`
          : "A baixa em lote foi desfeita com sucesso.",
      });

      setLotPendingReverse(null);
      setViewingLot(null);
      setViewingLotItems([]);
      await Promise.all([fetchEligibleInstallments(), fetchBatchLots()]);
    } catch (error: any) {
      console.error("Erro ao desfazer lote:", error);
      toast({
        title: "Erro ao desfazer lote",
        description: error?.message || "Não foi possível desfazer a baixa em lote.",
        variant: "destructive",
      });
    } finally {
      setProcessingReverse(false);
    }
  };

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando permissões do módulo...
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
              <CardDescription>Você não possui permissão para visualizar o módulo de baixa em lote de contas a pagar.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Baixa em Lote de Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">
              Baixe múltiplas parcelas pendentes, acompanhe os lotes gerados e desfaça quando necessário.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-[420px]">
            <TabsTrigger value="pending" className="gap-2">
              <Layers3 className="h-4 w-4" />
              Parcelas Pendentes
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Lotes Realizados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
                <CardDescription>Localize parcelas pendentes por vencimento, fornecedor e tipo de vínculo financeiro.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="due-date-from">Vencimento inicial</Label>
                  <Input id="due-date-from" type="date" value={dueDateFrom} onChange={(event) => setDueDateFrom(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due-date-to">Vencimento final</Label>
                  <Input id="due-date-to" type="date" value={dueDateTo} onChange={(event) => setDueDateTo(event.target.value)} />
                </div>

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
                  <Label>Tipo de vínculo</Label>
                  <Select
                    value={allocationTypeFilter}
                    onValueChange={(value) => setAllocationTypeFilter(value as AllocationFilterValue)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os vínculos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os vínculos</SelectItem>
                      <SelectItem value="animal">Animal</SelectItem>
                      <SelectItem value="pregnancy">Prenhez</SelectItem>
                      <SelectItem value="embryo_transfer">Pós Transf. Emb.</SelectItem>
                      <SelectItem value="aspiration">Aspiração</SelectItem>
                      <SelectItem value="recipient">Receptora</SelectItem>
                      <SelectItem value="semen">Sêmen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-3">
                  <Button onClick={() => void fetchEligibleInstallments()} disabled={loadingEligible}>
                    {loadingEligible ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      "Buscar parcelas"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDueDateFrom("");
                      setDueDateTo("");
                      setSupplierFilter("all");
                      setAllocationTypeFilter("all");
                      setAllocationSearch("");
                      setHasSearchedEligible(false);
                      setEligibleRows([]);
                      setSelectedIds(new Set());
                    }}
                    disabled={loadingEligible}
                  >
                    Limpar filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Parcelas elegíveis</CardDescription>
                  <CardTitle>{loadingEligible ? "..." : visibleRows.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Parcelas selecionadas</CardDescription>
                  <CardTitle>{selectedRows.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Valor selecionado</CardDescription>
                  <CardTitle>{formatCurrencyBRL(selectedAmount)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Parcelas pendentes para baixa</CardTitle>
                  <CardDescription>Apenas parcelas ainda não pagas e elegíveis para liquidação em lote aparecem nesta listagem.</CardDescription>
                </div>
                <Button onClick={handleOpenBatchDialog} disabled={!canEdit || selectedRows.length === 0 || processingBatch}>
                  <WalletCards className="mr-2 h-4 w-4" />
                  Baixar em lote
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="allocation-search">Buscar por nome do vínculo</Label>
                    <Input
                      id="allocation-search"
                      placeholder="Digite parte do nome do animal, prenhez, aspiração, receptora..."
                      value={allocationSearch}
                      onChange={(event) => setAllocationSearch(event.target.value)}
                      disabled={!hasSearchedEligible && eligibleRows.length === 0}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="max-h-[620px] overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                              onCheckedChange={handleToggleAllVisible}
                              aria-label="Selecionar todas as parcelas filtradas"
                            />
                          </TableHead>
                          <TableHead>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 max-md:h-10 px-3"
                              onClick={() => handleSort("documentNumber")}
                            >
                              Documento
                              {renderSortIcon("documentNumber")}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 max-md:h-10 px-3"
                              onClick={() => handleSort("supplierName")}
                            >
                              Fornecedor
                              {renderSortIcon("supplierName")}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 max-md:h-10 px-3"
                              onClick={() => handleSort("dueDate")}
                            >
                              Vencimento
                              {renderSortIcon("dueDate")}
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-8 max-md:h-10 px-3"
                              onClick={() => handleSort("amount")}
                            >
                              Valor
                              {renderSortIcon("amount")}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 max-md:h-10 px-3"
                              onClick={() => handleSort("allocation")}
                            >
                              Vínculo
                              {renderSortIcon("allocation")}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingEligible ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                              <div className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando parcelas elegíveis...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : !hasSearchedEligible ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                              Informe os filtros desejados e clique em buscar para carregar as parcelas pendentes.
                            </TableCell>
                          </TableRow>
                        ) : visibleRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                              Nenhuma parcela pendente encontrada com os filtros informados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(row.id)}
                                  onCheckedChange={(checked) => handleToggleRow(row.id, checked)}
                                  aria-label={`Selecionar parcela ${row.documentNumber}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{row.documentNumber}</p>
                                  <p className="text-xs text-muted-foreground">Parcela {row.installmentNumber}</p>
                                </div>
                              </TableCell>
                              <TableCell>{row.supplierName}</TableCell>
                              <TableCell>{formatDateBR(row.dueDate)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrencyBRL(row.amount)}</TableCell>
                              <TableCell>
                                {row.allocationLabels.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {row.allocationLabels.map((label) => (
                                      <Badge key={`${row.id}-${label}`} variant="outline">
                                        {label}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Sem vínculo</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lotes de baixa realizados</CardTitle>
                <CardDescription>Consulte o histórico, visualize as parcelas de cada lote e desfaça a operação quando necessário.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lote</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Conta utilizada</TableHead>
                        <TableHead>Data da baixa</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead className="text-right">Valor total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[180px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingLots ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            <div className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Carregando lotes...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : lots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            Nenhum lote de baixa em lote foi encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lots.map((lot) => (
                          <TableRow key={lot.id}>
                            <TableCell className="font-medium">{formatBatchCode(lot.batchNumber)}</TableCell>
                            <TableCell>{formatDateTimeBR(lot.createdAt)}</TableCell>
                            <TableCell>{lot.createdByName}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p>{lot.paymentAccountName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {PAYMENT_ACCOUNT_TYPE_LABELS[lot.paymentAccountType as PaymentAccountOption["type"]] || lot.paymentAccountType}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{formatDateBR(lot.paymentDate)}</TableCell>
                            <TableCell>{lot.installmentsCount}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrencyBRL(lot.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant={lot.status === "active" ? "default" : "secondary"}>
                                {lot.status === "active" ? "Ativo" : "Desfeito"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => void fetchLotItems(lot)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Visualizar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!canEdit || lot.status !== "active" || processingReverse}
                                  onClick={() => setLotPendingReverse(lot)}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Desfazer
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar baixa em lote</DialogTitle>
            <DialogDescription>
              Informe a conta financeira e a data do pagamento para baixar as {selectedRows.length} parcela(s) selecionada(s).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Quantidade selecionada</span>
                <span className="font-medium">{selectedRows.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Valor total</span>
                <span className="font-medium">{formatCurrencyBRL(selectedAmount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conta financeira</Label>
              <Select value={selectedPaymentAccountId} onValueChange={setSelectedPaymentAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta financeira" />
                </SelectTrigger>
                <SelectContent>
                  {paymentAccounts.map((account) => (
                    <SelectItem key={`${account.type}-${account.id}`} value={account.id}>
                      {account.name} - {PAYMENT_ACCOUNT_TYPE_LABELS[account.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-payment-date">Data da baixa</Label>
              <Input
                id="batch-payment-date"
                type="date"
                value={selectedPaymentDate}
                onChange={(event) => setSelectedPaymentDate(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={processingBatch}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateBatch()} disabled={processingBatch}>
              {processingBatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar baixa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingLot)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingLot(null);
            setViewingLotItems([]);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {viewingLot ? `Parcelas do lote ${formatBatchCode(viewingLot.batchNumber)}` : "Parcelas do lote"}
            </DialogTitle>
            <DialogDescription>
              Visualize as parcelas baixadas neste lote, com vínculo financeiro e status atual.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conta utilizada</p>
                <p className="mt-1 text-sm font-medium">{viewingLot?.paymentAccountName || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Data da baixa</p>
                <p className="mt-1 text-sm font-medium">{formatDateBR(viewingLot?.paymentDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status do lote</p>
                <p className="mt-1 text-sm font-medium">{viewingLot?.status === "active" ? "Ativo" : "Desfeito"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reversão</p>
                <p className="mt-1 text-sm font-medium">
                  {viewingLot?.reversedAt
                    ? `${formatDateTimeBR(viewingLot.reversedAt)}${viewingLot.reversedByName ? ` por ${viewingLot.reversedByName}` : ""}`
                    : "Não desfeito"}
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Status atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLotItems ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando parcelas do lote...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : viewingLotItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Nenhuma parcela vinculada a este lote.
                    </TableCell>
                  </TableRow>
                ) : (
                  viewingLotItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.documentNumber}</TableCell>
                      <TableCell>{item.supplierName}</TableCell>
                      <TableCell>{item.installmentLabel}</TableCell>
                      <TableCell>{formatDateBR(item.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrencyBRL(item.amount)}</TableCell>
                      <TableCell>
                        {item.allocationLabels.length > 0 ? item.allocationLabels.join(" | ") : "Sem vínculo"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getInstallmentStatusVariant(item.status, item.paymentDate) as any}>
                          {getInstallmentStatusLabel(item.status, item.paymentDate)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(lotPendingReverse)} onOpenChange={(open) => !open && setLotPendingReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer baixa em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              {lotPendingReverse
                ? `O lote ${formatBatchCode(lotPendingReverse.batchNumber)} será desfeito e as parcelas voltarão a ficar pendentes. Essa reversão afeta apenas as parcelas deste lote e ficará registrada no histórico.`
                : "As parcelas do lote voltarão a ficar pendentes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingReverse}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleReverseBatch()} disabled={processingReverse}>
              {processingReverse ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desfazendo...
                </>
              ) : (
                "Confirmar desfazimento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountsPayableBatchPayment;
