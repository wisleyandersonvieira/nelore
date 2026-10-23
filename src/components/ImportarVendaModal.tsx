import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
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
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { fetchAccessibleStoreScope, formatCurrencyBRL } from "@/lib/sales";

export interface EntregaImportavel {
  /** id do registro em entrega_clientes (cliente específico) */
  entrega_cliente_id: string;
  entrega_id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  percentual_venda: number | null;
  valor_venda: number | null; // valor correspondente a este cliente
  status_faturamento: string;
  venda_id: string | null;
  // dados da entrega (item vendido)
  code: number;
  tipo_item: string;
  registro_id: string;
  registro_nome: string | null;
  data_venda: string | null;
  status_entrega: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário escolhe importar um cliente ainda não faturado. */
  onImport: (entrega: EntregaImportavel) => void;
}

const TIPO_LABEL: Record<string, string> = { animal: "Animal", prenhez: "Prenhez", aspiracao: "Aspiração" };
const ENTREGA_LABEL: Record<string, string> = {
  nao_entregue: "Não entregue",
  manter_fazenda_propria: "Manter na fazenda própria",
  entregue: "Entregue",
};

export function ImportarVendaModal({ open, onOpenChange, onImport }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EntregaImportavel[]>([]);

  // filtros
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      // Uma linha por cliente ainda não faturado (venda_id IS NULL).
      const { data, error } = await (supabase as any)
        .from("entrega_clientes")
        .select(
          "id, entrega_id, cliente_id, cliente_nome, percentual_venda, valor_venda, status_faturamento, venda_id, " +
          "entregas!inner(code, tipo_item, registro_id, registro_nome, data_venda, status_entrega, store_id)"
        )
        .is("venda_id", null);
      if (error) throw error;

      const allowed = Array.isArray(storeIds) && storeIds.length > 0 ? new Set(storeIds) : null;
      const mapped: EntregaImportavel[] = (data || [])
        .filter((r: any) => !allowed || allowed.has(r.entregas?.store_id))
        .map((r: any) => ({
          entrega_cliente_id: r.id,
          entrega_id: r.entrega_id,
          cliente_id: r.cliente_id,
          cliente_nome: r.cliente_nome,
          percentual_venda: r.percentual_venda,
          valor_venda: r.valor_venda,
          status_faturamento: r.status_faturamento,
          venda_id: r.venda_id,
          code: r.entregas?.code,
          tipo_item: r.entregas?.tipo_item,
          registro_id: r.entregas?.registro_id,
          registro_nome: r.entregas?.registro_nome,
          data_venda: r.entregas?.data_venda,
          status_entrega: r.entregas?.status_entrega,
        }))
        .sort((a, b) => (b.code || 0) - (a.code || 0));

      setRows(mapped);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao carregar vendas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
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

  const handleImportClick = async (row: EntregaImportavel) => {
    // Revalida no banco para evitar importação duplicada.
    const { data: fresh, error } = await (supabase as any)
      .from("entrega_clientes").select("status_faturamento, venda_id").eq("id", row.entrega_cliente_id).single();
    if (error) {
      toast({ title: "Erro", description: "Não foi possível validar a venda.", variant: "destructive" });
      return;
    }
    if (fresh.status_faturamento !== "nao_faturado" || fresh.venda_id) {
      toast({ title: "Cliente já faturado", description: "Este cliente já foi faturado nesta entrega.", variant: "destructive" });
      loadData();
      return;
    }
    onImport(row);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Venda</DialogTitle>
          <DialogDescription>
            Selecione um cliente ainda não faturado para importar para o módulo Comercial. Cada cliente gera uma venda individual.
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
          <Table className="table-sticky-first table-sticky-last">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Data da venda</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>% Venda</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Status entrega</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhuma venda não faturada.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.entrega_cliente_id}>
                  <TableCell>{r.cliente_nome || "-"}</TableCell>
                  <TableCell>{TIPO_LABEL[r.tipo_item]}</TableCell>
                  <TableCell>{r.registro_nome || "-"}</TableCell>
                  <TableCell>{r.data_venda ? new Date(`${r.data_venda}T12:00:00`).toLocaleDateString("pt-BR") : "-"}</TableCell>
                  <TableCell>{r.valor_venda != null ? formatCurrencyBRL(Number(r.valor_venda)) : "-"}</TableCell>
                  <TableCell>{r.percentual_venda != null ? `${r.percentual_venda}%` : "-"}</TableCell>
                  <TableCell>#{r.code}</TableCell>
                  <TableCell><Badge variant="outline">{ENTREGA_LABEL[r.status_entrega]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="gap-1" onClick={() => handleImportClick(r)}>
                      <Download className="h-3.5 w-3.5" /> Importar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImportarVendaModal;
