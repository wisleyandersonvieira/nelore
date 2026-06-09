import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitBranch, Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type Etapa = "aspiracao" | "pos" | "prenhez" | "animal";

interface FinRow {
  id: string;
  etapa: Etapa;
  record_type: "expense" | "revenue";
  due_date: string | null;
  payment_date: string | null;
  description: string;
  registro_nome: string;
  party_name: string | null; // fornecedor / credor
  value: number;
  paid_amount: number;
  status: string;
}

interface Props {
  animalId: string | null;
  /** Modo de visualização compartilhado com o bloco financeiro do animal. */
  viewMode: "geral" | "pagos";
  onViewModeChange: (mode: "geral" | "pagos") => void;
  /** Saldo direto do animal (no mesmo modo) para o card "Resultado Geral". */
  animalSaldo: number;
}

const ETAPA_LABEL: Record<Etapa, string> = {
  aspiracao: "Aspiração",
  pos: "Pós-transferência",
  prenhez: "Prenhez",
  animal: "Animal",
};

const ETAPA_ROUTE: Record<Etapa, string> = {
  aspiracao: "/animais/aspiracoes",
  pos: "/animais/transferencia-embriao",
  prenhez: "/animais/prenhez",
  animal: "/animais/cadastro",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDateBR = (v?: string | null) => (v ? format(new Date(`${v}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "-");
const statusLabel = (s: string) => (s === "paid" ? "Pago" : s === "partial" ? "Parcial" : s === "pending" ? "Pendente" : s || "-");

const FinanceiroReproducao = ({ animalId, viewMode, onViewModeChange, animalSaldo }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FinRow[]>([]);

  useEffect(() => {
    if (!animalId) {
      setRows([]);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Árvore de reprodução do animal (mesma base da aba Dados Reprodução)
        const { data: repros } = await supabase
          .from("reproducoes")
          .select("aspiracao_id, pos_transferencia_id, prenhez_id, animal_gerado_id")
          .eq("animal_mae_id", animalId);

        const list = repros || [];
        const idsByEtapa: Record<Etapa, string[]> = {
          aspiracao: Array.from(new Set(list.map((r) => r.aspiracao_id).filter(Boolean) as string[])),
          pos: Array.from(new Set(list.map((r) => r.pos_transferencia_id).filter(Boolean) as string[])),
          prenhez: Array.from(new Set(list.map((r) => r.prenhez_id).filter(Boolean) as string[])),
          animal: Array.from(new Set(list.map((r) => r.animal_gerado_id).filter(Boolean) as string[])),
        };

        const columnByEtapa: Record<Etapa, string> = {
          aspiracao: "aspiration_id",
          pos: "embryo_transfer_id",
          prenhez: "pregnancy_id",
          animal: "animal_id",
        };

        const allRows: FinRow[] = [];
        const seenAlloc = new Set<string>(); // evita duplicidade entre etapas
        const today = format(new Date(), "yyyy-MM-dd");

        // Nomes dos registros de origem por etapa
        const nameMaps: Record<Etapa, Map<string, string>> = {
          aspiracao: new Map(), pos: new Map(), prenhez: new Map(), animal: new Map(),
        };
        const entityTableByEtapa: Record<Etapa, string> = {
          aspiracao: "aspiration_management",
          pos: "embryo_transfer_management",
          prenhez: "pregnancy_management",
          animal: "animals",
        };
        await Promise.all((Object.keys(idsByEtapa) as Etapa[]).map(async (etapa) => {
          const ids = idsByEtapa[etapa];
          if (ids.length === 0) return;
          const { data } = await supabase.from(entityTableByEtapa[etapa] as any).select("id, name, code").in("id", ids);
          (data || []).forEach((e: any) => nameMaps[etapa].set(e.id, `#${e.code} - ${e.name}`));
        }));

        // Coleta de allocations por etapa (despesas e receitas)
        const supplierIds = new Set<string>();
        const creditorIds = new Set<string>();
        const apIds = new Set<string>();
        const arIds = new Set<string>();
        const pending: Array<{ etapa: Etapa; type: "expense" | "revenue"; rows: any[] }> = [];

        await Promise.all((Object.keys(idsByEtapa) as Etapa[]).map(async (etapa) => {
          const ids = idsByEtapa[etapa];
          if (ids.length === 0) return;
          const col = columnByEtapa[etapa];

          const expQuery = (supabase.from("accounts_payable_item_allocations") as any)
            .select("id, allocation_type, " + col + ", accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, description, document_number, due_date, payment_date, status, supplier_id ) )")
            .in(col, ids);
          const revQuery = (supabase.from("accounts_receivable_item_allocations") as any)
            .select("id, allocation_type, " + col + ", accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, description, document_number, due_date, payment_date, status, creditor_id ) )")
            .in(col, ids);

          const [expRes, revRes] = await Promise.all([expQuery, revQuery]);
          (expRes.data || []).forEach((a: any) => {
            const ap = a.accounts_payable_items?.accounts_payable;
            if (ap?.supplier_id) supplierIds.add(ap.supplier_id);
            if (ap?.id) apIds.add(ap.id);
          });
          (revRes.data || []).forEach((a: any) => {
            const ar = a.accounts_receivable_items?.accounts_receivable;
            if (ar?.creditor_id) creditorIds.add(ar.creditor_id);
            if (ar?.id) arIds.add(ar.id);
          });
          pending.push({ etapa, type: "expense", rows: expRes.data || [] });
          pending.push({ etapa, type: "revenue", rows: revRes.data || [] });
        }));

        // Lookups de nomes e pagamentos
        const [suppliersRes, creditorsRes, apPayRes, arPayRes] = await Promise.all([
          supplierIds.size > 0 ? supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds)) : Promise.resolve({ data: [] as any[] }),
          creditorIds.size > 0 ? supabase.from("suppliers").select("id, name").in("id", Array.from(creditorIds)) : Promise.resolve({ data: [] as any[] }),
          apIds.size > 0 ? supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", Array.from(apIds)).lte("payment_date", today) : Promise.resolve({ data: [] as any[] }),
          arIds.size > 0 ? supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", Array.from(arIds)).lte("payment_date", today) : Promise.resolve({ data: [] as any[] }),
        ]);
        const suppliersMap = new Map((suppliersRes.data || []).map((s: any) => [s.id, s.name]));
        const creditorsMap = new Map((creditorsRes.data || []).map((s: any) => [s.id, s.name]));
        const apPaidMap = new Map<string, number>();
        (apPayRes.data || []).forEach((p: any) => apPaidMap.set(p.account_payable_id, (apPaidMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)));
        const arPaidMap = new Map<string, number>();
        (arPayRes.data || []).forEach((p: any) => arPaidMap.set(p.account_receivable_id, (arPaidMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)));

        pending.forEach(({ etapa, type, rows: allocRows }) => {
          const col = columnByEtapa[etapa];
          allocRows.forEach((a: any) => {
            if (seenAlloc.has(a.id)) return;
            seenAlloc.add(a.id);
            const originId = a[col];
            if (type === "expense") {
              const item = a.accounts_payable_items;
              const ap = item?.accounts_payable;
              allRows.push({
                id: a.id,
                etapa,
                record_type: "expense",
                due_date: ap?.due_date || null,
                payment_date: ap?.payment_date || null,
                description: ap?.description || "-",
                registro_nome: nameMaps[etapa].get(originId) || "-",
                party_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null,
                value: item?.total_price || 0,
                paid_amount: ap?.id ? apPaidMap.get(ap.id) || 0 : 0,
                status: ap?.status || "",
              });
            } else {
              const item = a.accounts_receivable_items;
              const ar = item?.accounts_receivable;
              allRows.push({
                id: a.id,
                etapa,
                record_type: "revenue",
                due_date: ar?.due_date || null,
                payment_date: ar?.payment_date || null,
                description: ar?.description || "-",
                registro_nome: nameMaps[etapa].get(originId) || "-",
                party_name: ar?.creditor_id ? creditorsMap.get(ar.creditor_id) || null : null,
                value: item?.total_price || 0,
                paid_amount: ar?.id ? arPaidMap.get(ar.id) || 0 : 0,
                status: ar?.status || "",
              });
            }
          });
        });

        setRows(allRows);
      } catch (error) {
        console.error("Erro ao carregar financeiro de reprodução:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [animalId]);

  // Aplica o modo de visualização (Geral / Pagos até Hoje)
  const filteredRows = useMemo(() => {
    if (viewMode === "pagos") {
      return rows
        .filter((r) => r.paid_amount > 0 || r.status === "paid")
        .map((r) => ({ ...r, value: r.paid_amount > 0 ? r.paid_amount : r.value }));
    }
    return rows;
  }, [rows, viewMode]);

  const rowsByEtapa = (etapa: Etapa) => filteredRows.filter((r) => r.etapa === etapa);

  const totals = useMemo(() => {
    const receitas = filteredRows.filter((r) => r.record_type === "revenue").reduce((s, r) => s + r.value, 0);
    const despesas = filteredRows.filter((r) => r.record_type === "expense").reduce((s, r) => s + r.value, 0);
    return { receitas, despesas, saldo: receitas - despesas, count: filteredRows.length };
  }, [filteredRows]);

  const exportExcel = () => {
    const data = filteredRows.map((r) => ({
      Etapa: ETAPA_LABEL[r.etapa],
      Tipo: r.record_type === "revenue" ? "Receita" : "Despesa",
      Data: formatDateBR(r.due_date),
      Descrição: r.description,
      "Registro de origem": r.registro_nome,
      "Fornecedor/Credor": r.party_name || "-",
      Valor: r.value,
      Situação: statusLabel(r.status),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro Reprodução");
    XLSX.writeFile(wb, "financeiro_reproducao.xlsx");
  };

  if (!animalId) return null;

  const renderTable = (etapa: Etapa) => {
    const data = rowsByEtapa(etapa);
    if (data.length === 0) {
      return <p className="py-4 text-center text-sm text-muted-foreground">Nenhum registro financeiro encontrado para esta etapa.</p>;
    }
    return (
      <div className="max-h-[280px] overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="h-8">
              <TableHead className="py-1 text-xs">Data</TableHead>
              <TableHead className="py-1 text-xs">Tipo</TableHead>
              <TableHead className="py-1 text-xs">Descrição</TableHead>
              <TableHead className="py-1 text-xs">Registro de origem</TableHead>
              <TableHead className="py-1 text-xs text-right">Valor</TableHead>
              <TableHead className="py-1 text-xs">Situação</TableHead>
              <TableHead className="py-1 text-xs text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id} className="h-7">
                <TableCell className="py-1 text-sm">{formatDateBR(r.due_date)}</TableCell>
                <TableCell className="py-1 text-sm">
                  <Badge variant="outline" className={cn("px-1.5 py-0 text-[12px]", r.record_type === "revenue" ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive")}>
                    {r.record_type === "revenue" ? "Receita" : "Despesa"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate py-1 text-sm">{r.description}</TableCell>
                <TableCell className="py-1 text-sm">{r.registro_nome}</TableCell>
                <TableCell className={cn("py-1 text-right text-sm font-medium", r.record_type === "revenue" ? "text-primary" : "text-destructive")}>{brl(r.value)}</TableCell>
                <TableCell className="py-1 text-sm">
                  <Badge variant={r.status === "paid" ? "default" : "secondary"} className="px-1.5 py-0 text-[12px]">{statusLabel(r.status)}</Badge>
                </TableCell>
                <TableCell className="py-1 text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(ETAPA_ROUTE[etapa])} title="Abrir registro de origem">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="mt-6 space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <GitBranch className="h-5 w-5" />
            Financeiro Reprodução
          </h3>
          <p className="text-sm text-muted-foreground">Débitos e créditos vinculados às reproduções geradas por este animal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={viewMode === "geral" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("geral")}>Visualizar Geral</Button>
          <Button variant={viewMode === "pagos" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("pagos")}>Pagos até Hoje</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={filteredRows.length === 0}>
                <Download className="mr-1 h-4 w-4" />Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando dados financeiros...</p>
      ) : (
        <>
          <Tabs defaultValue="aspiracao" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="aspiracao">Aspiração ({rowsByEtapa("aspiracao").length})</TabsTrigger>
              <TabsTrigger value="pos">Pós-transferência ({rowsByEtapa("pos").length})</TabsTrigger>
              <TabsTrigger value="prenhez">Prenhez ({rowsByEtapa("prenhez").length})</TabsTrigger>
              <TabsTrigger value="animal">Animal ({rowsByEtapa("animal").length})</TabsTrigger>
            </TabsList>
            <TabsContent value="aspiracao" className="mt-3">{renderTable("aspiracao")}</TabsContent>
            <TabsContent value="pos" className="mt-3">{renderTable("pos")}</TabsContent>
            <TabsContent value="prenhez" className="mt-3">{renderTable("prenhez")}</TabsContent>
            <TabsContent value="animal" className="mt-3">{renderTable("animal")}</TabsContent>
          </Tabs>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Receitas Reprodução</p>
                <p className="text-lg font-semibold text-primary">{brl(totals.receitas)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas Reprodução</p>
                <p className="text-lg font-semibold text-destructive">{brl(totals.despesas)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Reprodução</p>
                <p className={cn("text-lg font-semibold", totals.saldo >= 0 ? "text-primary" : "text-destructive")}>{brl(totals.saldo)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resultado Geral</p>
                <p className={cn("text-lg font-semibold", animalSaldo + totals.saldo >= 0 ? "text-primary" : "text-destructive")}>{brl(animalSaldo + totals.saldo)}</p>
                <p className="text-[11px] text-muted-foreground">Saldo Animal + Reprodução</p>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">{totals.count} lançamento(s) de reprodução</p>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceiroReproducao;
