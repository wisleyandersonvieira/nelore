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
import { SalesCreateModal, type SalesCreateInitialValues } from "@/components/SalesCreateModal";
import { ImportarVendaModal, type EntregaImportavel } from "@/components/ImportarVendaModal";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { cn } from "@/lib/utils";
import {
  buildSaleItemLabel,
  fetchAccessibleStoreScope,
  formatCurrencyBRL,
  SALE_TYPE_LABELS,
  SALE_TYPE_OPTIONS,
  SaleInstallmentDraft,
  SaleType,
} from "@/lib/sales";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  Loader2,
  Package2,
  Plus,
  Search,
  Download,
} from "lucide-react";

interface SaleRow {
  id: string;
  code: number;
  clientId: string;
  clientName: string;
  saleDate: string;
  saleType: SaleType;
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
  receivableId: string | null;
  receivableDescription: string | null;
  receivedAmount: number;
  pendingAmount: number;
  status: "pending" | "partial" | "paid";
  installments: SaleInstallmentDraft[];
}

interface SaleTableRow {
  id: string;
  code: number;
  client_id: string;
  sale_date: string;
  sale_type: SaleType;
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
  store_id: string;
}

interface ReceivableTableRow {
  id: string;
  sale_id: string | null;
  description: string;
  total_amount: number | null;
  amount: number;
  payment_date: string | null;
}

interface SalesSummaryCard {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}

const chartConfig = {
  total: {
    label: "Vendido",
    color: "hsl(153 60% 38%)",
  },
} satisfies ChartConfig;

const statusMeta: Record<SaleRow["status"], { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  partial: {
    label: "Parcial",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  paid: {
    label: "Recebida",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildChartData = (sales: SaleRow[]) => {
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

  sales.forEach((sale) => {
    const saleDate = new Date(`${sale.saleDate}T00:00:00`);
    const key = getMonthKey(new Date(saleDate.getFullYear(), saleDate.getMonth(), 1));
    if (monthMap[key]) {
      monthMap[key].total += sale.totalAmount;
    }
  });

  return months.map((month) => ({
    ...month,
    total: Number(month.total.toFixed(2)),
  }));
};

const computeStatus = (totalAmount: number, installments: SaleInstallmentDraft[], fallbackPaid = false) => {
  const receivedAmount = installments.length
    ? installments.reduce(
        (sum, installment) => sum + (installment.payment_date ? installment.amount : 0),
        0,
      )
    : fallbackPaid
      ? totalAmount
      : 0;

  const normalizedReceived = Number(receivedAmount.toFixed(2));
  const pendingAmount = Number(Math.max(totalAmount - normalizedReceived, 0).toFixed(2));

  if (pendingAmount <= 0.01) {
    return {
      status: "paid" as const,
      receivedAmount: totalAmount,
      pendingAmount: 0,
    };
  }

  if (normalizedReceived > 0) {
    return {
      status: "partial" as const,
      receivedAmount: normalizedReceived,
      pendingAmount,
    };
  }

  return {
    status: "pending" as const,
    receivedAmount: 0,
    pendingAmount: totalAmount,
  };
};

const getReceivedProgress = (sale: Pick<SaleRow, "receivedAmount" | "totalAmount">) => {
  if (!sale.totalAmount || sale.totalAmount <= 0) return 0;
  return Math.min(100, Math.max(0, Number(((sale.receivedAmount / sale.totalAmount) * 100).toFixed(1))));
};

const SalesModule = () => {
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPrefill, setImportPrefill] = useState<SalesCreateInitialValues | null>(null);
  const [importEntregaId, setImportEntregaId] = useState<string | null>(null);

  const ENTREGA_SALE_TYPE: Record<string, SaleType> = {
    animal: "animal",
    prenhez: "pregnancy",
    aspiracao: "aspiration",
  };

  const handleNewSale = () => {
    setImportPrefill(null);
    setImportEntregaId(null);
    setCreateOpen(true);
  };

  const handleImportEntrega = async (entrega: EntregaImportavel) => {
    let saleType: SaleType = ENTREGA_SALE_TYPE[entrega.tipo_item] || "animal";
    // Uma entrega de animal pode ser, na verdade, uma receptora. Detectamos isso
    // para usar o mesmo tipo de venda ("recipient") de uma venda direta, garantindo
    // que a alocação/referência no Contas a Receber fique correta.
    if (entrega.tipo_item === "animal") {
      try {
        const [animalRes, recipientCategoryIds] = await Promise.all([
          supabase.from("animals").select("category_id").eq("id", entrega.registro_id).maybeSingle(),
          fetchRecipientCategoryIds(),
        ]);
        const categoryId = animalRes.data?.category_id;
        if (categoryId && recipientCategoryIds.includes(categoryId)) {
          saleType = "recipient";
        }
      } catch (error) {
        console.error("Erro ao detectar categoria do animal importado:", error);
      }
    }

    const tipoLabel = entrega.tipo_item === "prenhez" ? "prenhez" : entrega.tipo_item === "aspiracao" ? "aspiração" : "animal";
    setImportPrefill({
      clientId: entrega.cliente_id || undefined,
      saleType,
      itemId: entrega.registro_id,
      saleDate: entrega.data_venda || undefined,
      firstDueDate: entrega.data_venda || undefined,
      totalAmount: entrega.valor_venda != null ? Number(entrega.valor_venda) : undefined,
      description: `Venda de ${tipoLabel} - ${entrega.registro_nome || ""} para ${entrega.cliente_nome || ""}`.trim(),
    });
    setImportEntregaId(entrega.id);
    setImportOpen(false);
    setCreateOpen(true);
  };
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SaleType>("all");

  const loadSales = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setSales([]);
        return;
      }

      const salesData = await fetchAllPaginated<SaleTableRow>(() => {
        let query = supabase.from("sales").select("*").order("sale_date", { ascending: false });
        if (storeIds && storeIds.length > 0) {
          query = query.in("store_id", storeIds);
        }
        return query;
      });

      if (salesData.length === 0) {
        setSales([]);
        return;
      }

      const clientIds = Array.from(new Set(salesData.map((sale) => sale.client_id).filter(Boolean)));
      const saleStoreIds = Array.from(new Set(salesData.map((sale) => sale.store_id).filter(Boolean)));

      const [clientsRes, storesRes, receivablesData] = await Promise.all([
        clientIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", clientIds)
          : Promise.resolve({ data: [], error: null }),
        saleStoreIds.length > 0
          ? supabase.from("stores").select("id, name, code").in("id", saleStoreIds)
          : Promise.resolve({ data: [], error: null }),
        fetchAllPaginated<ReceivableTableRow>(() =>
          supabase
            .from("accounts_receivable")
            .select("id, sale_id, description, total_amount, amount, payment_date")
            .in("sale_id", salesData.map((sale) => sale.id)),
        ),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (storesRes.error) throw storesRes.error;

      const clientMap = new Map((clientsRes.data || []).map((client) => [client.id, client.name]));
      const storeMap = new Map(
        (storesRes.data || []).map((store) => [store.id, `${store.code} - ${store.name}`]),
      );

      const receivableBySaleId = new Map<string, ReceivableTableRow>();
      receivablesData.forEach((receivable) => {
        if (receivable.sale_id) {
          receivableBySaleId.set(receivable.sale_id, receivable);
        }
      });

      const receivableIds = Array.from(
        new Set(receivablesData.map((receivable) => receivable.id).filter(Boolean)),
      );

      const installmentsMap = new Map<string, SaleInstallmentDraft[]>();
      const installmentsData =
        receivableIds.length > 0
          ? await fetchAllPaginated<{
              account_receivable_id: string;
              installment_number: number;
              due_date: string;
              amount: number;
              payment_date: string | null;
            }>(() =>
              supabase
                .from("accounts_receivable_installments")
                .select("account_receivable_id, installment_number, due_date, amount, payment_date")
                .in("account_receivable_id", receivableIds)
                .order("installment_number", { ascending: true }),
            )
          : [];

      installmentsData.forEach((installment) => {
        const current = installmentsMap.get(installment.account_receivable_id) || [];
        current.push({
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: Number(installment.amount || 0),
          payment_date: installment.payment_date,
        } as SaleInstallmentDraft & { payment_date?: string | null });
        installmentsMap.set(installment.account_receivable_id, current);
      });

      const rows = salesData.map((sale) => {
        const receivable = receivableBySaleId.get(sale.id);
        const installments = receivable?.id ? installmentsMap.get(receivable.id) || [] : [];
        const totalAmount = Number(sale.total_amount || 0);
        const { status, receivedAmount, pendingAmount } = computeStatus(
          totalAmount,
          installments,
          Boolean(receivable?.payment_date),
        );

        return {
          id: sale.id,
          code: Number(sale.code),
          clientId: sale.client_id,
          clientName: clientMap.get(sale.client_id) || "Cliente não encontrado",
          saleDate: sale.sale_date,
          saleType: sale.sale_type as SaleType,
          description: sale.description,
          itemCode: sale.item_code,
          itemName: sale.item_name,
          totalAmount,
          installmentCount: Number(sale.installment_count || installments.length || 1),
          notes: sale.notes,
          documentType: sale.document_type,
          documentNumber: sale.document_number,
          negotiationMethod: sale.negotiation_method,
          issueDate: sale.issue_date,
          competenceDate: sale.competence_date,
          firstDueDate: sale.first_due_date,
          storeId: sale.store_id,
          storeName: storeMap.get(sale.store_id) || "Fazenda não encontrada",
          receivableId: receivable?.id || null,
          receivableDescription: receivable?.description || null,
          receivedAmount,
          pendingAmount,
          status,
          installments,
        } satisfies SaleRow;
      });

      setSales(rows);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      setSales([]);
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
    void loadSales();
  }, [permissionsLoading, canView]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sales.filter((sale) => {
      const matchesType = typeFilter === "all" || sale.saleType === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        sale.clientName.toLowerCase().includes(normalizedSearch) ||
        sale.itemName.toLowerCase().includes(normalizedSearch) ||
        (sale.itemCode || "").toLowerCase().includes(normalizedSearch) ||
        String(sale.code).includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [sales, searchTerm, typeFilter]);

  const chartData = useMemo(() => buildChartData(sales), [sales]);

  const summaryCards = useMemo<SalesSummaryCard[]>(() => {
    const totalSold = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalReceived = sales.reduce((sum, sale) => sum + sale.receivedAmount, 0);
    const totalPending = sales.reduce((sum, sale) => sum + sale.pendingAmount, 0);

    return [
      {
        title: "Valor vendido",
        value: formatCurrencyBRL(totalSold),
        description: "Acumulado no módulo de vendas",
        icon: BadgeDollarSign,
        accent: "from-emerald-500/18 to-emerald-500/5 text-emerald-700",
      },
      {
        title: "Recebido",
        value: formatCurrencyBRL(totalReceived),
        description: "Baixas financeiras já identificadas",
        icon: HandCoins,
        accent: "from-sky-500/18 to-sky-500/5 text-sky-700",
      },
      {
        title: "Pendente",
        value: formatCurrencyBRL(totalPending),
        description: "Saldo aberto no Contas a Receber",
        icon: CircleDollarSign,
        accent: "from-amber-500/18 to-amber-500/5 text-amber-700",
      },
      {
        title: "Vendas registradas",
        value: `${sales.length}`,
        description: "Negociações rastreadas no módulo",
        icon: Activity,
        accent: "from-violet-500/18 to-violet-500/5 text-violet-700",
      },
    ];
  }, [sales]);

  const salesByType = useMemo(() => {
    return SALE_TYPE_OPTIONS.map((type) => {
      const count = sales.filter((sale) => sale.saleType === type.value).length;
      return {
        ...type,
        count,
      };
    });
  }, [sales]);

  if (permissionsLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-5 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando módulo de vendas...
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
            O módulo de vendas utiliza a mesma base financeira do Contas a Receber e segue as permissões do Financeiro.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Comercial
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Vendas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Registre negociações de animais e reprodutivos com geração automática dos títulos no Contas a Receber.
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-11 rounded-2xl border-emerald-600/40 px-5 text-emerald-700 hover:bg-emerald-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Importar Venda
            </Button>
            <Button
              onClick={handleNewSale}
              className="h-11 rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova venda
            </Button>
          </div>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(250,253,252,1),rgba(244,248,246,1))] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vendas nos últimos meses</CardTitle>
            <CardDescription>Evolução mensal do valor negociado no módulo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
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
                          <span className="text-muted-foreground">Total vendido</span>
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
                  fill="url(#salesArea)"
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
        {salesByType.map((entry) => (
          <Card key={entry.value} className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">{entry.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{entry.count}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                <Package2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-base">Listagem de vendas</CardTitle>
              <CardDescription>
                Consulte a venda, o cliente, o item negociado e o reflexo financeiro gerado.
              </CardDescription>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_200px]">
              <div className="space-y-2">
                <Label htmlFor="sales-search">Pesquisar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sales-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Código, cliente ou item"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={typeFilter} onValueChange={(value: "all" | SaleType) => setTypeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {SALE_TYPE_OPTIONS.map((type) => (
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item vendido</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                      Nenhuma venda encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">#{sale.code}</TableCell>
                      <TableCell>{formatDateBR(sale.saleDate)}</TableCell>
                      <TableCell className="min-w-[220px]">{sale.clientName}</TableCell>
                      <TableCell>{SALE_TYPE_LABELS[sale.saleType]}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {buildSaleItemLabel({ code: sale.itemCode, name: sale.itemName })}
                          </p>
                          <p className="text-xs text-muted-foreground">{sale.storeName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[170px] text-right">
                        <div className="space-y-2">
                          <p>{formatCurrencyBRL(sale.totalAmount)}</p>
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${getReceivedProgress(sale)}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {getReceivedProgress(sale).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })}
                              % recebido
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{sale.installmentCount}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(sale.receivedAmount)}</TableCell>
                      <TableCell className="min-w-[170px] text-right">
                        <div className="space-y-2">
                          <p>{formatCurrencyBRL(sale.pendingAmount)}</p>
                          <div className="space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all"
                                style={{ width: `${Math.max(0, 100 - getReceivedProgress(sale))}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {Math.max(0, 100 - getReceivedProgress(sale)).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })}
                              % em aberto
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta[sale.status].className}>
                          {statusMeta[sale.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
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

      <SalesCreateModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setImportPrefill(null);
            setImportEntregaId(null);
          }
        }}
        initialValues={importPrefill}
        sourceEntregaId={importEntregaId}
        onSaved={async () => {
          await loadSales();
        }}
      />

      <ImportarVendaModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportEntrega}
      />

      <Dialog open={Boolean(selectedSale)} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedSale && (
            <>
              <DialogHeader>
                <DialogTitle>Venda #{selectedSale.code}</DialogTitle>
                <DialogDescription>
                  Rastreabilidade completa entre a negociação comercial e os títulos criados no financeiro.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Venda</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="text-right font-medium">{selectedSale.clientName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium">{SALE_TYPE_LABELS[selectedSale.saleType]}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Item</span>
                      <span className="text-right font-medium">
                        {buildSaleItemLabel({
                          code: selectedSale.itemCode,
                          name: selectedSale.itemName,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Fazenda</span>
                      <span className="text-right font-medium">{selectedSale.storeName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Data da venda</span>
                      <span className="font-medium">{formatDateBR(selectedSale.saleDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Valor total</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedSale.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Negociação</span>
                      <span className="text-right font-medium">
                        {selectedSale.negotiationMethod || "Não informado"}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                      {selectedSale.notes || "Sem observações adicionais."}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reflexo financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Título no contas a receber</span>
                      <span className="font-medium">
                        {selectedSale.receivableId ? selectedSale.receivableId.slice(0, 8) : "Não gerado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Descrição</span>
                      <span className="max-w-[55%] text-right font-medium">
                        {selectedSale.receivableDescription || "Não disponível"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Emissão</span>
                      <span className="font-medium">{formatDateBR(selectedSale.issueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Competência</span>
                      <span className="font-medium">{formatDateBR(selectedSale.competenceDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Primeiro vencimento</span>
                      <span className="font-medium">{formatDateBR(selectedSale.firstDueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Recebido</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedSale.receivedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Pendente</span>
                      <span className="font-medium">{formatCurrencyBRL(selectedSale.pendingAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className={statusMeta[selectedSale.status].className}>
                        {statusMeta[selectedSale.status].label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                        {selectedSale.installments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              Nenhuma parcela vinculada encontrada.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedSale.installments.map((installment) => (
                            <TableRow key={`${selectedSale.id}-${installment.installment_number}`}>
                              <TableCell className="font-medium">{installment.installment_number}</TableCell>
                              <TableCell>{formatDateBR(installment.due_date)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrencyBRL(installment.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    installment.payment_date
                                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                      : "border-amber-200 bg-amber-100 text-amber-800"
                                  }
                                >
                                  {installment.payment_date
                                    ? `Recebida em ${formatDateBR(installment.payment_date)}`
                                    : "Em aberto"}
                                </Badge>
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

export default SalesModule;
