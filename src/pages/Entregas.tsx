import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MoreHorizontal, Eye, Truck, Home, Paperclip, ExternalLink, Filter,
  CalendarIcon, Package, PackageCheck, PackageX, Receipt, FileX, Upload, Trash2, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL, fetchAccessibleStoreScope } from "@/lib/sales";

const ITEMS_PER_PAGE = 15;

const formatDateBR = (value?: string | null) =>
  value ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "-";

interface EntregaRecord {
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
  manter_fazenda_propria: boolean;
  data_entrega: string | null;
  data_prevista_entrega: string | null;
  observacoes_entrega: string | null;
  venda_id: string | null;
  store_id: string;
  created_at: string;
}

interface Anexo {
  id: string;
  entrega_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

const TIPO_LABEL: Record<string, string> = {
  animal: "Animal",
  prenhez: "Prenhez",
  aspiracao: "Aspiração",
};

const ENTREGA_META: Record<string, { label: string; className: string }> = {
  nao_entregue: { label: "Não entregue", className: "bg-amber-100 text-amber-700 border-amber-200" },
  manter_fazenda_propria: { label: "Manter na fazenda própria", className: "bg-sky-100 text-sky-700 border-sky-200" },
  entregue: { label: "Entregue", className: "bg-green-100 text-green-700 border-green-200" },
};

const FATURAMENTO_META: Record<string, { label: string; className: string }> = {
  nao_faturado: { label: "Não faturado", className: "bg-muted text-muted-foreground border-border" },
  parcialmente_faturado: { label: "Parcialmente faturado", className: "bg-amber-100 text-amber-700 border-amber-200" },
  faturado: { label: "Faturado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

interface EntregaClienteRow {
  id: string;
  entrega_id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  percentual_venda: number | null;
  valor_venda: number | null;
  percentual_animal: number | null;
  status_faturamento: string;
  venda_id: string | null;
}

const Entregas = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<EntregaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterEntrega, setFilterEntrega] = useState("all");
  const [filterFaturamento, setFilterFaturamento] = useState("all");
  const [filterVendaInicio, setFilterVendaInicio] = useState("");
  const [filterVendaFim, setFilterVendaFim] = useState("");
  const [filterEntregaInicio, setFilterEntregaInicio] = useState("");
  const [filterEntregaFim, setFilterEntregaFim] = useState("");
  const [filterPrevisaoInicio, setFilterPrevisaoInicio] = useState("");
  const [filterPrevisaoFim, setFilterPrevisaoFim] = useState("");

  // Editar data prevista
  const [previsaoRecord, setPrevisaoRecord] = useState<EntregaRecord | null>(null);
  const [previsaoDate, setPrevisaoDate] = useState<Date | null>(null);
  const [savingPrevisao, setSavingPrevisao] = useState(false);

  // View
  const [viewRecord, setViewRecord] = useState<EntregaRecord | null>(null);

  // Clientes da entrega
  const [clientesByEntrega, setClientesByEntrega] = useState<Record<string, EntregaClienteRow[]>>({});
  const [clientesRecord, setClientesRecord] = useState<EntregaRecord | null>(null);

  // Mark as delivered modal
  const [deliverRecord, setDeliverRecord] = useState<EntregaRecord | null>(null);
  const [deliverDate, setDeliverDate] = useState<Date | null>(null);
  const [deliverObs, setDeliverObs] = useState("");
  const [deliverFiles, setDeliverFiles] = useState<File[]>([]);
  const [savingDeliver, setSavingDeliver] = useState(false);

  // Attachments modal
  const [anexosRecord, setAnexosRecord] = useState<EntregaRecord | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }
      let query = supabase.from("entregas").select("*").order("code", { ascending: false });
      if (storeIds && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRecords((data || []) as EntregaRecord[]);

      // Clientes vinculados a cada entrega
      const ids = (data || []).map((d: any) => d.id);
      if (ids.length > 0) {
        const { data: cli } = await (supabase as any)
          .from("entrega_clientes")
          .select("*")
          .in("entrega_id", ids);
        const map: Record<string, EntregaClienteRow[]> = {};
        (cli || []).forEach((c: EntregaClienteRow) => {
          (map[c.entrega_id] = map[c.entrega_id] || []).push(c);
        });
        setClientesByEntrega(map);
      } else {
        setClientesByEntrega({});
      }
    } catch (error) {
      console.error("Erro ao carregar entregas:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as entregas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => { if (r.cliente_id) map.set(r.cliente_id, r.cliente_nome || "-"); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterCliente !== "all" && r.cliente_id !== filterCliente) return false;
      if (filterTipo !== "all" && r.tipo_item !== filterTipo) return false;
      if (filterEntrega !== "all" && r.status_entrega !== filterEntrega) return false;
      if (filterFaturamento !== "all" && r.status_faturamento !== filterFaturamento) return false;
      if (filterVendaInicio && (!r.data_venda || r.data_venda < filterVendaInicio)) return false;
      if (filterVendaFim && (!r.data_venda || r.data_venda > filterVendaFim)) return false;
      if (filterEntregaInicio && (!r.data_entrega || r.data_entrega < filterEntregaInicio)) return false;
      if (filterEntregaFim && (!r.data_entrega || r.data_entrega > filterEntregaFim)) return false;
      if (filterPrevisaoInicio && (!r.data_prevista_entrega || r.data_prevista_entrega < filterPrevisaoInicio)) return false;
      if (filterPrevisaoFim && (!r.data_prevista_entrega || r.data_prevista_entrega > filterPrevisaoFim)) return false;
      return true;
    });
  }, [records, filterCliente, filterTipo, filterEntrega, filterFaturamento, filterVendaInicio, filterVendaFim, filterEntregaInicio, filterEntregaFim, filterPrevisaoInicio, filterPrevisaoFim]);

  const summary = useMemo(() => ({
    total: records.length,
    naoEntregues: records.filter((r) => r.status_entrega === "nao_entregue").length,
    fazenda: records.filter((r) => r.status_entrega === "manter_fazenda_propria").length,
    entregues: records.filter((r) => r.status_entrega === "entregue").length,
    naoFaturadas: records.filter((r) => r.status_faturamento === "nao_faturado").length,
    parciais: records.filter((r) => r.status_faturamento === "parcialmente_faturado").length,
    faturadas: records.filter((r) => r.status_faturamento === "faturado").length,
  }), [records]);

  // Lista de clientes de uma entrega (com fallback para o cliente da própria entrega)
  const clientesDe = (r: EntregaRecord): EntregaClienteRow[] => {
    const list = clientesByEntrega[r.id];
    if (list && list.length > 0) return list;
    return [{
      id: r.id, entrega_id: r.id, cliente_id: r.cliente_id, cliente_nome: r.cliente_nome,
      percentual_venda: 100, valor_venda: r.valor_venda, percentual_animal: r.percentual_venda,
      status_faturamento: r.status_faturamento, venda_id: r.venda_id,
    }];
  };

  const clienteLabel = (r: EntregaRecord): string => {
    const list = clientesDe(r);
    const first = list[0]?.cliente_nome || "-";
    return list.length > 1 ? `${first} +${list.length - 1}` : first;
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setFilterCliente("all"); setFilterTipo("all"); setFilterEntrega("all"); setFilterFaturamento("all");
    setFilterVendaInicio(""); setFilterVendaFim(""); setFilterEntregaInicio(""); setFilterEntregaFim("");
    setFilterPrevisaoInicio(""); setFilterPrevisaoFim("");
    setPage(1);
  };

  const openPrevisao = (record: EntregaRecord) => {
    setPrevisaoRecord(record);
    setPrevisaoDate(record.data_prevista_entrega ? new Date(`${record.data_prevista_entrega}T12:00:00`) : null);
  };

  const handleSavePrevisao = async () => {
    if (!previsaoRecord) return;
    setSavingPrevisao(true);
    try {
      const { error } = await supabase
        .from("entregas")
        .update({ data_prevista_entrega: previsaoDate ? format(previsaoDate, "yyyy-MM-dd") : null })
        .eq("id", previsaoRecord.id);
      if (error) throw error;
      toast({ title: "Data prevista atualizada" });
      setPrevisaoRecord(null);
      fetchRecords();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível atualizar a data prevista.", variant: "destructive" });
    } finally {
      setSavingPrevisao(false);
    }
  };

  // ---- Actions ----
  const handleManterFazenda = async (record: EntregaRecord) => {
    try {
      const { error } = await supabase
        .from("entregas")
        .update({ status_entrega: "manter_fazenda_propria", manter_fazenda_propria: true, data_entrega: null })
        .eq("id", record.id);
      if (error) throw error;
      toast({ title: "Atualizado", description: "Entrega marcada para manter na fazenda própria." });
      fetchRecords();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  const openDeliver = (record: EntregaRecord) => {
    setDeliverRecord(record);
    setDeliverDate(record.data_entrega ? new Date(`${record.data_entrega}T12:00:00`) : new Date());
    setDeliverObs(record.observacoes_entrega || "");
    setDeliverFiles([]);
  };

  const uploadAnexos = async (entregaId: string, files: File[]) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id || "anon";
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${uid}/${entregaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("entrega-anexos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("entrega-anexos").getPublicUrl(path);
      const { error: insErr } = await supabase.from("entrega_anexos").insert({
        entrega_id: entregaId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type || null,
        file_size: file.size,
      });
      if (insErr) throw insErr;
    }
  };

  const handleSaveDeliver = async () => {
    if (!deliverRecord) return;
    if (!deliverDate) {
      toast({ title: "Data obrigatória", description: "Informe a data da entrega.", variant: "destructive" });
      return;
    }
    setSavingDeliver(true);
    try {
      const { error } = await supabase
        .from("entregas")
        .update({
          status_entrega: "entregue",
          manter_fazenda_propria: false,
          data_entrega: format(deliverDate, "yyyy-MM-dd"),
          observacoes_entrega: deliverObs.trim() || null,
        })
        .eq("id", deliverRecord.id);
      if (error) throw error;
      if (deliverFiles.length > 0) {
        await uploadAnexos(deliverRecord.id, deliverFiles);
      }
      toast({ title: "Entrega registrada", description: "Status atualizado para Entregue." });
      setDeliverRecord(null);
      fetchRecords();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível registrar a entrega.", variant: "destructive" });
    } finally {
      setSavingDeliver(false);
    }
  };

  const openAnexos = async (record: EntregaRecord) => {
    setAnexosRecord(record);
    setLoadingAnexos(true);
    try {
      const { data } = await supabase.from("entrega_anexos").select("*").eq("entrega_id", record.id).order("created_at");
      setAnexos((data || []) as Anexo[]);
    } finally {
      setLoadingAnexos(false);
    }
  };

  const handleUploadToAnexosModal = async (files: FileList | null) => {
    if (!anexosRecord || !files || files.length === 0) return;
    setUploadingAnexo(true);
    try {
      await uploadAnexos(anexosRecord.id, Array.from(files));
      const { data } = await supabase.from("entrega_anexos").select("*").eq("entrega_id", anexosRecord.id).order("created_at");
      setAnexos((data || []) as Anexo[]);
      toast({ title: "Anexo enviado" });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha no upload.", variant: "destructive" });
    } finally {
      setUploadingAnexo(false);
    }
  };

  const handleDeleteAnexo = async (anexo: Anexo) => {
    try {
      const { error } = await supabase.from("entrega_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
      toast({ title: "Anexo removido" });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível remover.", variant: "destructive" });
    }
  };

  const openOrigem = (record: EntregaRecord) => {
    if (record.tipo_item === "animal") navigate("/animais/cadastro");
    else if (record.tipo_item === "prenhez") navigate("/animais/prenhez");
    else navigate("/animais/aspiracoes");
  };

  const summaryCards = [
    { title: "Total de entregas", value: summary.total, icon: Package, accent: "from-slate-500/15 to-slate-500/5 text-slate-700" },
    { title: "Não entregues", value: summary.naoEntregues, icon: PackageX, accent: "from-amber-500/18 to-amber-500/5 text-amber-700" },
    { title: "Mantidas na fazenda", value: summary.fazenda, icon: Home, accent: "from-sky-500/18 to-sky-500/5 text-sky-700" },
    { title: "Entregues", value: summary.entregues, icon: PackageCheck, accent: "from-green-500/18 to-green-500/5 text-green-700" },
    { title: "Não faturadas", value: summary.naoFaturadas, icon: FileX, accent: "from-muted to-muted text-muted-foreground" },
    { title: "Parcialmente faturadas", value: summary.parciais, icon: Receipt, accent: "from-amber-500/18 to-amber-500/5 text-amber-700" },
    { title: "Faturadas", value: summary.faturadas, icon: Receipt, accent: "from-emerald-500/18 to-emerald-500/5 text-emerald-700" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card/80 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/animais")} className="h-9 w-9 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Entregas</h1>
              <p className="text-sm text-muted-foreground">Controle operacional das vendas realizadas</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowFilters((s) => !s)} className="h-10 gap-2 rounded-lg">
            <Filter className="h-4 w-4" />
            {showFilters ? "Ocultar Filtros" : "Filtros"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="overflow-hidden border-border/70 shadow-sm">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
                  </div>
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br", card.accent)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <Label className="text-xs text-muted-foreground">Status de entrega</Label>
                <Select value={filterEntrega} onValueChange={setFilterEntrega}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="nao_entregue">Não entregue</SelectItem>
                    <SelectItem value="manter_fazenda_propria">Manter na fazenda própria</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status de faturamento</Label>
                <Select value={filterFaturamento} onValueChange={setFilterFaturamento}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="nao_faturado">Não faturado</SelectItem>
                    <SelectItem value="parcialmente_faturado">Parcialmente faturado</SelectItem>
                    <SelectItem value="faturado">Faturado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Venda - início</Label>
                <Input type="date" value={filterVendaInicio} onChange={(e) => setFilterVendaInicio(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Venda - fim</Label>
                <Input type="date" value={filterVendaFim} onChange={(e) => setFilterVendaFim(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Entrega - início</Label>
                <Input type="date" value={filterEntregaInicio} onChange={(e) => setFilterEntregaInicio(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Entrega - fim</Label>
                <Input type="date" value={filterEntregaFim} onChange={(e) => setFilterEntregaFim(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Previsão - início</Label>
                <Input type="date" value={filterPrevisaoInicio} onChange={(e) => setFilterPrevisaoInicio(e.target.value)} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Previsão - fim</Label>
                <Input type="date" value={filterPrevisaoFim} onChange={(e) => setFilterPrevisaoFim(e.target.value)} className="mt-1 h-10" />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
              <Button onClick={() => setPage(1)}>Filtrar</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-border/70 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Data Venda</TableHead>
                <TableHead>Data Prevista</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>% Venda</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead className="w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">Nenhuma entrega encontrada.</TableCell></TableRow>
              ) : paginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">#{r.code}</TableCell>
                  <TableCell>{clienteLabel(r)}</TableCell>
                  <TableCell>{TIPO_LABEL[r.tipo_item] || r.tipo_item}</TableCell>
                  <TableCell>{r.registro_nome || "-"}</TableCell>
                  <TableCell>{formatDateBR(r.data_venda)}</TableCell>
                  <TableCell>{r.data_prevista_entrega ? formatDateBR(r.data_prevista_entrega) : "Não informada"}</TableCell>
                  <TableCell>{r.valor_venda != null ? formatCurrencyBRL(Number(r.valor_venda)) : "-"}</TableCell>
                  <TableCell>{r.percentual_venda != null ? `${r.percentual_venda}%` : "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-medium", ENTREGA_META[r.status_entrega]?.className)}>
                      {ENTREGA_META[r.status_entrega]?.label || r.status_entrega}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-medium", FATURAMENTO_META[r.status_faturamento]?.className)}>
                      {FATURAMENTO_META[r.status_faturamento]?.label || r.status_faturamento}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateBR(r.data_entrega)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewRecord(r)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setClientesRecord(r)}>
                          <Receipt className="mr-2 h-4 w-4" /> Visualizar clientes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeliver(r)} disabled={r.status_entrega === "entregue"}>
                          <Truck className="mr-2 h-4 w-4" /> Marcar como entregue
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPrevisao(r)}>
                          <CalendarIcon className="mr-2 h-4 w-4" /> Editar data prevista
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleManterFazenda(r)} disabled={r.status_entrega === "manter_fazenda_propria"}>
                          <Home className="mr-2 h-4 w-4" /> Manter na fazenda própria
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAnexos(r)}>
                          <Paperclip className="mr-2 h-4 w-4" /> Anexos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openOrigem(r)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Abrir registro de origem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/sales")} disabled={!r.venda_id}>
                          <Receipt className="mr-2 h-4 w-4" /> Abrir venda vinculada
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} entrega(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span>Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </main>

      {/* View modal */}
      <Dialog open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Entrega #{viewRecord?.code}</DialogTitle></DialogHeader>
          {viewRecord && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> {viewRecord.cliente_nome || "-"}</div>
              <div><span className="text-muted-foreground">Tipo:</span> {TIPO_LABEL[viewRecord.tipo_item]}</div>
              <div><span className="text-muted-foreground">Registro:</span> {viewRecord.registro_nome || "-"}</div>
              <div><span className="text-muted-foreground">Data venda:</span> {formatDateBR(viewRecord.data_venda)}</div>
              <div><span className="text-muted-foreground">Data prevista:</span> {viewRecord.data_prevista_entrega ? formatDateBR(viewRecord.data_prevista_entrega) : "Não informada"}</div>
              <div><span className="text-muted-foreground">Valor:</span> {viewRecord.valor_venda != null ? formatCurrencyBRL(Number(viewRecord.valor_venda)) : "-"}</div>
              <div><span className="text-muted-foreground">% Venda:</span> {viewRecord.percentual_venda != null ? `${viewRecord.percentual_venda}%` : "-"}</div>
              <div><span className="text-muted-foreground">Entrega:</span> {ENTREGA_META[viewRecord.status_entrega]?.label}</div>
              <div><span className="text-muted-foreground">Faturamento:</span> {FATURAMENTO_META[viewRecord.status_faturamento]?.label}</div>
              <div><span className="text-muted-foreground">Data entrega:</span> {formatDateBR(viewRecord.data_entrega)}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Observações:</span> {viewRecord.observacoes_entrega || "-"}</div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewRecord(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clientes da venda modal */}
      <Dialog open={!!clientesRecord} onOpenChange={(o) => !o && setClientesRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clientes da venda — Entrega #{clientesRecord?.code}</DialogTitle>
            <DialogDescription>Participação de cada cliente nesta venda operacional.</DialogDescription>
          </DialogHeader>
          {clientesRecord && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">% Venda</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">% Animal</TableHead>
                    <TableHead>Faturamento</TableHead>
                    <TableHead className="text-right">Venda vinculada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesDe(clientesRecord).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cliente_nome || "-"}</TableCell>
                      <TableCell className="text-right">{c.percentual_venda != null ? `${c.percentual_venda}%` : "-"}</TableCell>
                      <TableCell className="text-right">{c.valor_venda != null ? formatCurrencyBRL(Number(c.valor_venda)) : "-"}</TableCell>
                      <TableCell className="text-right">{c.percentual_animal != null ? `${c.percentual_animal}%` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("font-medium", FATURAMENTO_META[c.status_faturamento]?.className)}>
                          {FATURAMENTO_META[c.status_faturamento]?.label || c.status_faturamento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.venda_id ? (
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/sales")}>
                            <Receipt className="h-3.5 w-3.5" /> Abrir
                          </Button>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setClientesRecord(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as delivered modal */}
      <Dialog open={!!deliverRecord} onOpenChange={(o) => !o && setDeliverRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Marcar como entregue — #{deliverRecord?.code}</DialogTitle>
            <DialogDescription>Informe a data da entrega (obrigatória), observações e anexos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data da entrega *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deliverDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliverDate ? format(deliverDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deliverDate || undefined} onSelect={(d) => setDeliverDate(d || null)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={deliverObs} onChange={(e) => setDeliverObs(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Anexos</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => setDeliverFiles(Array.from(e.target.files || []))}
              />
              <Button type="button" variant="outline" className="mt-1 w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Selecionar arquivos
              </Button>
              {deliverFiles.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {deliverFiles.map((f, i) => <li key={i} className="truncate">• {f.name}</li>)}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverRecord(null)} disabled={savingDeliver}>Cancelar</Button>
            <Button onClick={handleSaveDeliver} disabled={savingDeliver}>{savingDeliver ? "Salvando..." : "Confirmar entrega"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar data prevista modal */}
      <Dialog open={!!previsaoRecord} onOpenChange={(o) => !o && setPrevisaoRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar data prevista de entrega</DialogTitle>
            <DialogDescription>Atualiza apenas a previsão de entrega da entrega #{previsaoRecord?.code}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Data prevista de entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !previsaoDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {previsaoDate ? format(previsaoDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={previsaoDate || undefined} onSelect={(d) => setPrevisaoDate(d || null)} locale={ptBR} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {previsaoDate && (
              <Button variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={() => setPrevisaoDate(null)}>
                Limpar data
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevisaoRecord(null)} disabled={savingPrevisao}>Cancelar</Button>
            <Button onClick={handleSavePrevisao} disabled={savingPrevisao}>{savingPrevisao ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachments modal */}
      <Dialog open={!!anexosRecord} onOpenChange={(o) => !o && setAnexosRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Anexos — Entrega #{anexosRecord?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4" />
              {uploadingAnexo ? "Enviando..." : "Clique para enviar arquivos"}
              <input
                type="file"
                multiple
                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                className="hidden"
                disabled={uploadingAnexo}
                onChange={(e) => handleUploadToAnexosModal(e.target.files)}
              />
            </label>
            {loadingAnexos ? (
              <p className="text-center text-sm text-muted-foreground">Carregando...</p>
            ) : anexos.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Nenhum anexo.</p>
            ) : (
              <ul className="space-y-2">
                {anexos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="truncate">{a.file_name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={a.file_url} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteAnexo(a)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAnexosRecord(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Entregas;
