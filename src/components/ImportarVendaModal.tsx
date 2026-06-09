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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário escolhe importar uma entrega não faturada. */
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
      let query = supabase
        .from("entregas")
        .select("*")
        .eq("status_faturamento", "nao_faturado")
        .is("venda_id", null)
        .order("code", { ascending: false });
      if (storeIds && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as EntregaImportavel[]);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao carregar entregas.", variant: "destructive" });
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
    const { data: fresh, error } = await supabase
      .from("entregas").select("status_faturamento, venda_id").eq("id", row.id).single();
    if (error) {
      toast({ title: "Erro", description: "Não foi possível validar a entrega.", variant: "destructive" });
      return;
    }
    if (fresh.status_faturamento !== "nao_faturado" || fresh.venda_id) {
      toast({ title: "Entrega já faturada", description: "Esta entrega já foi faturada e não pode ser importada novamente.", variant: "destructive" });
      loadData();
      return;
    }
    onImport(row);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
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
