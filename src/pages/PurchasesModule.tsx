import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchasesCreateModal } from "@/components/PurchasesCreateModal";
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
  CircleDollarSign,
  HandCoins,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import {
  PURCHASE_TYPE_LABELS,
  PURCHASE_TYPE_OPTIONS,
  PurchaseOriginType,
  PurchaseType,
} from "@/lib/purchases";

interface PurchaseInstallmentRow extends SaleInstallmentDraft {
  payableDescription: string | null;
  payableId: string;
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
  documentType: string | null;
  documentNumber: string | null;
  negotiationMethod: string | null;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  storeId: string;
  storeName: string;
  originType: PurchaseOriginType;
  linkedPayables: LinkedPayableRow[];
  paidAmount: number;
  pendingAmount: number;
  status: "pending" | "partial" | "paid";
  installments: PurchaseInstallmentRow[];
}

interface PurchaseTableRow {
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

const PurchasesModule = () => {
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PurchaseType>("all");

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setPurchases([]);
        return;
      }

      const purchasesData = await fetchAllPaginated<PurchaseTableRow>(() => {
        let query = supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
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
            .select("id, purchase_id, description, total_amount, amount, payment_date")
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

      const installmentsRes =
        payableIds.length > 0
          ? await supabase
              .from("accounts_payable_installments")
              .select("account_payable_id, installment_number, due_date, amount, payment_date")
              .in("account_payable_id", payableIds)
              .order("installment_number", { ascending: true })
          : { data: [], error: null };

      if (installmentsRes.error) throw installmentsRes.error;

      const installmentsMap = new Map<string, PurchaseInstallmentRow[]>();
      (installmentsRes.data || []).forEach((installment) => {
        const current = installmentsMap.get(installment.account_payable_id) || [];
        const payable = payablesData.find((entry) => entry.id === installment.account_payable_id);
        current.push({
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: Number(installment.amount || 0),
          payment_date: installment.payment_date,
          payableDescription: payable?.description || null,
          payableId: installment.account_payable_id,
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
          .flatMap((payable) => installmentsMap.get(payable.id) || [])
          .sort((left, right) => {
            if (left.due_date === right.due_date) {
              return left.installment_number - right.installment_number;
            }
            return left.due_date.localeCompare(right.due_date);
          });
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
          installmentCount: Number(purchase.installment_count || installments.length || 1),
          notes: purchase.notes,
          documentType: purchase.document_type,
          documentNumber: purchase.document_number,
          negotiationMethod: purchase.negotiation_method,
          issueDate: purchase.issue_date,
          competenceDate: purchase.competence_date,
          firstDueDate: purchase.first_due_date,
          originType: purchase.origin_type,
          storeId: purchase.store_id,
          storeName: storeMap.get(purchase.store_id) || "Fazenda não encontrada",
          linkedPayables,
          paidAmount,
          pendingAmount,
          status,
          installments,
        } satisfies PurchaseRow;
      });

      setPurchases(rows);
    } catch (error) {
      console.error("Erro ao carregar compras:", error);
      setPurchases([]);
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
    void loadPurchases();
  }, [permissionsLoading, canView]);

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

  const chartData = useMemo(() => buildChartData(purchases), [purchases]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalBought = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
    const totalPaid = purchases.reduce((sum, purchase) => sum + purchase.paidAmount, 0);
    const totalPending = purchases.reduce((sum, purchase) => sum + purchase.pendingAmount, 0);

    return [
      {
        title: "Valor comprado",
        value: formatCurrencyBRL(totalBought),
        description: "Acumulado no módulo de compras",
        icon: ShoppingCart,
        accent: "from-indigo-500/18 to-indigo-500/5 text-indigo-700",
      },
      {
        title: "Pago",
        value: formatCurrencyBRL(totalPaid),
        description: "Baixas financeiras já identificadas",
        icon: HandCoins,
        accent: "from-emerald-500/18 to-emerald-500/5 text-emerald-700",
      },
      {
        title: "Pendente",
        value: formatCurrencyBRL(totalPending),
        description: "Saldo aberto no Contas a Pagar",
        icon: CircleDollarSign,
        accent: "from-amber-500/18 to-amber-500/5 text-amber-700",
      },
      {
        title: "Compras registradas",
        value: `${purchases.length}`,
        description: "Aquisições rastreadas no módulo",
        icon: Activity,
        accent: "from-slate-500/18 to-slate-500/5 text-slate-700",
      },
    ];
  }, [purchases]);

  const purchasesByType = useMemo(() => {
    return PURCHASE_TYPE_OPTIONS.map((type) => {
      const count = purchases.filter((purchase) => purchase.purchaseType === type.value).length;
      return {
        ...type,
        count,
      };
    });
  }, [purchases]);

  if (permissionsLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
            onClick={() => setCreateOpen(true)}
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
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item comprado</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                      Nenhuma compra encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase) => (
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
                      <TableCell className="text-right">{formatCurrencyBRL(purchase.totalAmount)}</TableCell>
                      <TableCell className="text-center">{purchase.installmentCount}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(purchase.paidAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(purchase.pendingAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta[purchase.status].className}>
                          {statusMeta[purchase.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedPurchase(purchase)}>
                          Ver detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PurchasesCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={async () => {
          await loadPurchases();
        }}
      />

      <Dialog open={Boolean(selectedPurchase)} onOpenChange={(open) => !open && setSelectedPurchase(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPurchase && (
            <>
              <DialogHeader>
                <DialogTitle>Compra #{selectedPurchase.code}</DialogTitle>
                <DialogDescription>
                  Rastreabilidade completa entre a aquisição e os títulos vinculados no financeiro.
                </DialogDescription>
              </DialogHeader>

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
                  <CardTitle className="text-base">Parcelas geradas</CardTitle>
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
                          selectedPurchase.installments.map((installment) => (
                            <TableRow
                              key={`${selectedPurchase.id}-${installment.payableId}-${installment.installment_number}`}
                            >
                              <TableCell className="font-medium">{installment.installment_number}</TableCell>
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
                </CardContent>
              </Card>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesModule;
