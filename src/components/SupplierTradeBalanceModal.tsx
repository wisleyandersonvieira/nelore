import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { createPdfReportLayout } from "@/lib/pdfReportLayout";
import { formatCurrencyBRL } from "@/lib/sales";
import {
  fetchSupplierTradeBalance,
  type SupplierTradeBalance,
  type SupplierTradeBalanceFilters,
  type TradeCategory,
  type TradeGroup,
  type TradeItem,
} from "@/lib/supplierTradeBalance";
import { cn } from "@/lib/utils";

export interface SupplierTradeBalanceSupplier {
  id: string;
  name: string;
  cnpj_cpf?: string | null;
  city?: string | null;
  state?: string | null;
}

interface SupplierTradeBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierTradeBalanceSupplier | null;
  filters: SupplierTradeBalanceFilters | null;
  /** Texto da fazenda aplicada no filtro (ex.: "Todas as fazendas"). */
  storeLabel: string;
}

const CATEGORIES: Array<{ key: TradeCategory; title: string; hideWhenEmpty?: boolean }> = [
  { key: "animals", title: "Animais" },
  { key: "pregnancies", title: "Prenhezes" },
  { key: "aspirations", title: "Aspirações" },
  { key: "others", title: "Outros", hideWhenEmpty: true },
];

/** Acima desse número de itens o quadro começa recolhido no celular. */
const MOBILE_OPEN_LIMIT = 5;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
};

const formatPercentage = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const formatAmount = (item: TradeItem) =>
  item.percentage !== undefined && item.percentage < 100
    ? `${formatCurrencyBRL(item.amount)} (${formatPercentage(item.percentage)})`
    : formatCurrencyBRL(item.amount);

const itemDetail = (item: TradeItem) =>
  [item.detail, item.auctionLot ? `Lote ${item.auctionLot}` : null].filter(Boolean).join(" · ");

const categorySubtotal = (items: TradeItem[]) => items.reduce((acc, item) => acc + item.amount, 0);

const visibleCategories = (group: TradeGroup) =>
  CATEGORIES.filter(({ key, hideWhenEmpty }) => !hideWhenEmpty || group[key].length > 0);

const describePeriod = (filters: SupplierTradeBalanceFilters | null) => {
  if (!filters?.startDate && !filters?.endDate) return "Todo o período";
  if (filters?.startDate && filters?.endDate) return `${formatDate(filters.startDate)} a ${formatDate(filters.endDate)}`;
  if (filters?.startDate) return `A partir de ${formatDate(filters.startDate)}`;
  return `Até ${formatDate(filters?.endDate)}`;
};

const describeLocation = (supplier: SupplierTradeBalanceSupplier | null) =>
  [supplier?.city, supplier?.state].filter(Boolean).join("/");

function TradeItemsList({ items }: { items: TradeItem[] }) {
  if (items.length === 0) {
    return <p className="py-3 text-center text-sm text-muted-foreground">Nenhum registro</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border/60 md:hidden">
        {items.map((item) => {
          const detail = itemDetail(item);
          return (
            <li key={`${item.sourceTable}-${item.id}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.label}>
                  {item.label}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={detail || undefined}>
                  {formatDate(item.date)}
                  {detail ? ` · ${detail}` : ""}
                </p>
              </div>
              <span className="whitespace-nowrap text-right text-sm tabular-nums">{formatAmount(item)}</span>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Data</TableHead>
              <TableHead>Identificação</TableHead>
              <TableHead>Detalhe</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.sourceTable}-${item.id}`}>
                <TableCell className="py-2">{formatDate(item.date)}</TableCell>
                <TableCell className="py-2 font-medium">{item.label}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{itemDetail(item) || "-"}</TableCell>
                <TableCell className="whitespace-nowrap py-2 text-right tabular-nums">{formatAmount(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function TradeCategoryBox({ title, items, isMobile }: { title: string; items: TradeItem[]; isMobile: boolean }) {
  const [open, setOpen] = useState(() => !isMobile || items.length <= MOBILE_OPEN_LIMIT);
  const subtotal = categorySubtotal(items);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-4">
          <div className="min-w-0">
            <h4 className="font-semibold leading-tight">{title}</h4>
            <p className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-right font-semibold tabular-nums">{formatCurrencyBRL(subtotal)}</span>
            {items.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="group h-10 md:h-9">
                  {open ? "Ocultar itens" : "Ver itens"}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardHeader>
        {items.length === 0 ? (
          <CardContent className="px-4 pb-3 pt-0">
            <TradeItemsList items={items} />
          </CardContent>
        ) : (
          <CollapsibleContent>
            <CardContent className="border-t border-border/60 px-4 pb-2 pt-1 md:px-2">
              <TradeItemsList items={items} />
            </CardContent>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  );
}

function TradeSection({
  title,
  totalLabel,
  group,
  isMobile,
}: {
  title: string;
  totalLabel: string;
  group: TradeGroup;
  isMobile: boolean;
}) {
  const categories = visibleCategories(group);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map(({ key, title: categoryTitle }) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{categoryTitle}</p>
              <p className="text-xs text-muted-foreground">{group[key].length} reg.</p>
            </div>
            <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums">
              {formatCurrencyBRL(categorySubtotal(group[key]))}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {categories.map(({ key, title: categoryTitle }) => (
          <TradeCategoryBox key={key} title={categoryTitle} items={group[key]} isMobile={isMobile} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <span className="font-semibold">{totalLabel}</span>
        <span className="whitespace-nowrap text-right font-semibold tabular-nums">{formatCurrencyBRL(group.total)}</span>
      </div>
    </section>
  );
}

function TradeBalanceSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2].map((tile) => (
              <Skeleton key={tile} className="h-14 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function SupplierTradeBalanceModal({
  open,
  onOpenChange,
  supplier,
  filters,
  storeLabel,
}: SupplierTradeBalanceModalProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [data, setData] = useState<SupplierTradeBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open || !filters?.supplierId) return;

    let cancelled = false;
    setLoading(true);
    setData(null);

    fetchSupplierTradeBalance(supabase, filters)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error: unknown) => {
        console.error("Erro ao gerar relatório de compras e vendas por fornecedor:", error);
        if (!cancelled) {
          toast({
            title: "Erro ao gerar relatório",
            description: error instanceof Error ? error.message : "Não foi possível carregar as compras e vendas.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, filters, toast]);

  const isEmpty =
    !!data &&
    [data.purchases, data.sales].every((group) => CATEGORIES.every(({ key }) => group[key].length === 0));
  const balance = data?.balance ?? 0;
  const location = describeLocation(supplier);
  const period = describePeriod(filters);

  const handleExportPdf = async () => {
    if (!data || !supplier) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      const layout = await createPdfReportLayout(doc, {
        title: "Compras e Vendas por Fornecedor",
        subtitle: supplier.name,
        emittedAt: new Date(),
        summaryCards: [
          { label: "Total comprado", value: formatCurrencyBRL(data.purchases.total), tone: "default" },
          { label: "Total vendido", value: formatCurrencyBRL(data.sales.total), tone: "primary" },
          { label: "Saldo (Vendas − Compras)", value: formatCurrencyBRL(balance), tone: balance >= 0 ? "success" : "danger" },
        ],
        filters: [
          { label: "Fornecedor", value: supplier.name },
          ...(supplier.cnpj_cpf ? [{ label: "CNPJ/CPF", value: supplier.cnpj_cpf }] : []),
          ...(location ? [{ label: "Cidade/UF", value: location }] : []),
          { label: "Período", value: period },
          { label: "Fazenda", value: storeLabel },
        ],
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      let cursorY = layout.startY;
      const ensureSpace = (needed: number) => {
        if (cursorY + needed > pageHeight - layout.tableMargin.bottom) {
          doc.addPage();
          layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
          cursorY = layout.tableMargin.top + 2;
        }
      };

      const sections: Array<{ title: string; totalLabel: string; group: TradeGroup }> = [
        { title: "COMPRAS", totalLabel: "Total comprado", group: data.purchases },
        { title: "VENDAS", totalLabel: "Total vendido", group: data.sales },
      ];

      for (const section of sections) {
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(section.title, layout.tableMargin.left, cursorY + 5);
        cursorY += 8;

        for (const { key, title } of visibleCategories(section.group)) {
          const items = section.group[key];
          ensureSpace(18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(
            `${title} — ${items.length} ${items.length === 1 ? "registro" : "registros"} — ${formatCurrencyBRL(categorySubtotal(items))}`,
            layout.tableMargin.left,
            cursorY + 4,
          );
          cursorY += 6;

          autoTable(doc, {
            ...layout.tableStyles(),
            head: [["Data", "Identificação", "Detalhe", "Valor"]],
            body:
              items.length > 0
                ? items.map((item) => [formatDate(item.date), item.label, itemDetail(item) || "-", formatAmount(item)])
                : [[{ content: "Nenhum registro", colSpan: 4, styles: { halign: "center" } }]],
            startY: cursorY,
            margin: layout.tableMargin,
            showHead: "everyPage",
            willDrawPage: layout.willDrawPage,
            columnStyles: {
              0: { cellWidth: 22 },
              3: { cellWidth: 38, halign: "right" },
            },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lastAutoTable é injetado pelo plugin
          cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 5;
        }

        ensureSpace(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(section.totalLabel, layout.tableMargin.left, cursorY + 4);
        doc.text(formatCurrencyBRL(section.group.total), doc.internal.pageSize.getWidth() - layout.tableMargin.right, cursorY + 4, {
          align: "right",
        });
        cursorY += 10;
      }

      ensureSpace(30);
      layout.drawTotalizer(cursorY, [
        { label: "Total comprado", value: formatCurrencyBRL(data.purchases.total) },
        { label: "Total vendido", value: formatCurrencyBRL(data.sales.total) },
        { label: "Saldo (Vendas − Compras)", value: formatCurrencyBRL(balance), emphasis: true },
      ]);

      layout.finalize();
      const fileName = supplier.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w-]+/g, "_");
      doc.save(`compras_vendas_${fileName}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({ title: "Erro", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:p-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/70 px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="break-words leading-snug">{supplier?.name || "Fornecedor"}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-0.5 text-xs sm:text-sm">
              {(supplier?.cnpj_cpf || location) && (
                <p className="break-words">
                  {[supplier?.cnpj_cpf ? `CNPJ/CPF ${supplier.cnpj_cpf}` : null, location || null].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="break-words">
                Período: {period} · Fazenda: {storeLabel}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {loading || !data ? (
            <TradeBalanceSkeleton />
          ) : isEmpty ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma compra ou venda encontrada para este fornecedor com os filtros aplicados.
            </p>
          ) : (
            <div className="space-y-8">
              <TradeSection title="Compras" totalLabel="Total comprado" group={data.purchases} isMobile={isMobile} />
              <TradeSection title="Vendas" totalLabel="Total vendido" group={data.sales} isMobile={isMobile} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 shrink-0 space-y-3 border-t border-border/70 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0 sm:px-6 sm:pb-4">
          <div className="flex items-baseline justify-between gap-3 sm:justify-start">
            <span className="text-sm font-medium text-muted-foreground">Saldo (Vendas − Compras)</span>
            <span
              className={cn(
                "whitespace-nowrap text-lg font-semibold tabular-nums",
                balance >= 0 ? "text-emerald-600" : "text-destructive",
              )}
            >
              {data ? formatCurrencyBRL(balance) : "—"}
            </span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void handleExportPdf()}
              disabled={!data || loading || exporting}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SupplierTradeBalanceModal;
