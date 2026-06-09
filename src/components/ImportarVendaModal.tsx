import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  createSaleWithReceivable, fetchAccessibleStoreScope, generateSaleInstallments,
  sumInstallments, formatCurrencyBRL, SaleType,
} from "@/lib/sales";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
}

interface EntregaRow {
  id: string;
  code: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo_item: string;
  registro_id: string;
  registro_nome: string | null;
  data_venda: string | null;
  valor_venda: number | null;
  percentual_venda: number | null;
  status_entrega: string;
  status_faturamento: string;
  venda_id: string | null;
}

interface ProductOption { id: string; name: string; code: string | number | null; }

const TIPO_LABEL: Record<string, string> = { animal: "Animal", prenhez: "Prenhez", aspiracao: "Aspiração" };
const ENTREGA_LABEL: Record<string, string> = {
  nao_entregue: "Não entregue",
  manter_fazenda_propria: "Manter na fazenda própria",
  entregue: "Entregue",
};
const SALE_TYPE_MAP: Record<string, SaleType> = { animal: "animal", prenhez: "pregnancy", aspiracao: "aspiration" };
const todayISO = () => new Date().toISOString().split("T")[0];

export function ImportarVendaModal({ open, onOpenChange, onImported }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // filters
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");

  // confirm step
  const [selected, setSelected] = useState<EntregaRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    issueDate: todayISO(),
    competenceDate: todayISO(),
    firstDueDate: todayISO(),
    installmentCount: 1,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      let query = supabase
        .from("entregas")
        .select("*")
        .eq("status_faturamento", "nao_faturado")
        .is("venda_id", null)
        .order("code", { ascending: false });
      if (storeIds && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
      } else if (Array.isArray(storeIds) && storeIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [entregasRes, productsRes] = await Promise.all([
        query,
        supabase.from("products").select("id, name, code").eq("is_active", true).eq("function_type", "credit").order("name"),
      ]);
      if (entregasRes.error) throw entregasRes.error;
      setRows((entregasRes.data || []) as EntregaRow[]);
      setProducts((productsRes.data || []) as ProductOption[]);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao carregar entregas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelected(null);
      setFilterCliente("all"); setFilterTipo("all"); setFilterInicio(""); setFilterFim("");
      loadData();
    }
  }, [open]);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.cliente_id) map.set(r.cliente_id, r.cliente_nome || "-"); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterCliente !== "all" && r.cliente_id !== filterCliente) return false;
    if (filterTipo !== "all" && r.tipo_item !== filterTipo) return false;
    if (filterInicio && (!r.data_venda || r.data_venda < filterInicio)) return false;
    if (filterFim && (!r.data_venda || r.data_venda > filterFim)) return false;
    return true;
  }), [rows, filterCliente, filterTipo, filterInicio, filterFim]);

  const openConfirm = (row: EntregaRow) => {
    setSelected(row);
    setForm({
      productId: "",
      issueDate: row.data_venda || todayISO(),
      competenceDate: row.data_venda || todayISO(),
      firstDueDate: row.data_venda || todayISO(),
      installmentCount: 1,
    });
  };

  const handleImport = async () => {
    if (!selected) return;
    if (!selected.cliente_id) {
      toast({ title: "Cliente ausente", description: "A entrega não possui cliente vinculado.", variant: "destructive" });
      return;
    }
    if (!form.productId) {
      toast({ title: "Produto financeiro", description: "Selecione o produto financeiro.", variant: "destructive" });
      return;
    }
    const total = Number(selected.valor_venda || 0);
    if (total <= 0) {
      toast({ title: "Valor inválido", description: "A entrega não possui valor de venda válido.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      // Revalida para evitar importação duplicada
      const { data: fresh, error: freshErr } = await supabase
        .from("entregas").select("status_faturamento, venda_id").eq("id", selected.id).single();
      if (freshErr) throw freshErr;
      if (fresh.status_faturamento !== "nao_faturado" || fresh.venda_id) {
        toast({ title: "Já faturada", description: "Esta venda já foi faturada e não pode ser importada novamente.", variant: "destructive" });
        setSelected(null);
        loadData();
        return;
      }

      const saleType = SALE_TYPE_MAP[selected.tipo_item];
      const saleDate = selected.data_venda || todayISO();
      const installments = generateSaleInstallments(total, form.installmentCount, form.firstDueDate);
      if (sumInstallments(installments) !== Math.round(total * 100) / 100) {
        // generateSaleInstallments já ajusta a última parcela; segue o fluxo padrão
      }

      const result = await createSaleWithReceivable({
        clientId: selected.cliente_id,
        saleType,
        itemId: selected.registro_id,
        productId: form.productId,
        saleDate,
        issueDate: form.issueDate,
        competenceDate: form.competenceDate,
        firstDueDate: form.firstDueDate,
        totalAmount: total,
        description: `Entrega #${selected.code} - ${selected.registro_nome || ""}`.trim(),
        notes: `Importado da Entrega #${selected.code}`,
        installments,
      });

      const saleId = (result as any)?.sale_id || null;

      const { error: updErr } = await supabase
        .from("entregas")
        .update({ status_faturamento: "faturado", venda_id: saleId })
        .eq("id", selected.id);
      if (updErr) throw updErr;

      toast({ title: "Venda importada", description: `Entrega #${selected.code} faturada com sucesso.` });
      setSelected(null);
      await loadData();
      await onImported();
    } catch (error: any) {
      console.error("Erro ao importar venda:", error);
      toast({ title: "Erro", description: error?.message || "Não foi possível importar a venda.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        {!selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Importar Venda</DialogTitle>
              <DialogDescription>
                Selecione uma venda ainda não faturada para importar para o módulo Comercial.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={filterCliente} onValueChange={setFilterCliente}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo do item</Label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="animal">Animal</SelectItem>
                    <SelectItem value="prenhez">Prenhez</SelectItem>
                    <SelectItem value="aspiracao">Aspiração</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Venda - início</Label>
                <Input type="date" value={filterInicio} onChange={(e) => setFilterInicio(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Venda - fim</Label>
                <Input type="date" value={filterFim} onChange={(e) => setFilterFim(e.target.value)} className="mt-1 h-10" />
              </div>
            </div>

            <div className="mt-2 rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Data da venda</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>% Venda</TableHead>
                    <TableHead>Status entrega</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma venda não faturada.</TableCell></TableRow>
                  ) : filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.cliente_nome || "-"}</TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo_item]}</TableCell>
                      <TableCell>{r.registro_nome || "-"}</TableCell>
                      <TableCell>{r.data_venda ? new Date(`${r.data_venda}T12:00:00`).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>{r.valor_venda != null ? formatCurrencyBRL(Number(r.valor_venda)) : "-"}</TableCell>
                      <TableCell>{r.percentual_venda != null ? `${r.percentual_venda}%` : "-"}</TableCell>
                      <TableCell><Badge variant="outline">{ENTREGA_LABEL[r.status_entrega]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="gap-1" onClick={() => openConfirm(r)}>
                          <Download className="h-3.5 w-3.5" /> Importar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar importação — Entrega #{selected.code}</DialogTitle>
              <DialogDescription>Os dados da venda serão usados para criar a venda no Comercial e gerar o Contas a Receber.</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Cliente:</span> {selected.cliente_nome || "-"}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {TIPO_LABEL[selected.tipo_item]}</div>
                <div><span className="text-muted-foreground">Registro:</span> {selected.registro_nome || "-"}</div>
                <div><span className="text-muted-foreground">Valor:</span> {selected.valor_venda != null ? formatCurrencyBRL(Number(selected.valor_venda)) : "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Produto financeiro *</Label>
                <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ""}{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emissão</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <Label>Competência</Label>
                <Input type="date" value={form.competenceDate} onChange={(e) => setForm({ ...form, competenceDate: e.target.value })} />
              </div>
              <div>
                <Label>Primeiro vencimento</Label>
                <Input type="date" value={form.firstDueDate} onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })} />
              </div>
              <div>
                <Label>Nº de parcelas</Label>
                <Input
                  type="number" min={1} max={36}
                  value={form.installmentCount}
                  onChange={(e) => setForm({ ...form, installmentCount: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)} disabled={importing}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>{importing ? "Importando..." : "Importar venda"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportarVendaModal;
