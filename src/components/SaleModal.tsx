import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarIcon, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SaleTipo = "animal" | "prenhez" | "aspiracao";

interface SaleRecord {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: SaleTipo;
  record: SaleRecord | null;
  onSaved?: () => void;
}

interface ClientRow {
  clienteId: string;
  pctVenda: string;   // % da venda (divisão do valor) — soma 100
  valor: string;      // R$ correspondente
  pctAnimal: string;  // % vendida do animal (lógica de DONO)
}

interface OwnerRow {
  owner_id: string;
  owner_name: string;
  percentage: number;
  owner_type: string;
  store_owner_id: string | null;
  third_party_farm_id: string | null;
}

const OWNERS_CONFIG: Record<SaleTipo, { table: string; fk: string }> = {
  animal: { table: "animal_owners", fk: "animal_id" },
  prenhez: { table: "pregnancy_owners", fk: "pregnancy_id" },
  aspiracao: { table: "aspiration_owners", fk: "aspiration_id" },
};

const emptyRow = (): ClientRow => ({ clienteId: "", pctVenda: "", valor: "", pctAnimal: "" });

const toNum = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SaleModal({ open, onOpenChange, tipo, record, onSaved }: Props) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [saleDate, setSaleDate] = useState<Date | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(null);
  const [totalValue, setTotalValue] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([emptyRow()]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [saving, setSaving] = useState(false);

  // popover por linha
  const [openClientPopover, setOpenClientPopover] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    if (!open || !record) return;
    setSaleDate(null);
    setExpectedDeliveryDate(null);
    setTotalValue("");
    setRows([emptyRow()]);
    setClientSearch("");
    setOpenClientPopover(null);
    fetchClients();
    fetchOwners(record.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const fetchClients = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles").select("matrix_id").eq("id", userData.user.id).single();
      if (!profile?.matrix_id) return;
      const { data } = await supabase
        .from("suppliers").select("id, name")
        .eq("matrix_id", profile.matrix_id).eq("is_active", true).order("name");
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchOwners = async (recordId: string) => {
    const { table, fk } = OWNERS_CONFIG[tipo];
    try {
      const { data: ownersData } = await (supabase as any)
        .from(table)
        .select("owner_id, owner_type, store_owner_id, third_party_farm_id, percentage")
        .eq(fk, recordId);

      const resolved: OwnerRow[] = [];
      for (const o of ownersData || []) {
        const ownerType = o.owner_type || "supplier";
        const effectiveId = ownerType === "store"
          ? o.store_owner_id
          : ownerType === "third_party_farm"
            ? o.third_party_farm_id
            : o.owner_id;
        let ownerName = "N/A";
        if (ownerType === "store" && o.store_owner_id) {
          const { data: store } = await supabase.from("stores").select("name").eq("id", o.store_owner_id).single();
          ownerName = store?.name || "Fazenda não encontrada";
        } else if (ownerType === "third_party_farm" && o.third_party_farm_id) {
          const { data: farm } = await supabase.from("third_party_farms").select("name").eq("id", o.third_party_farm_id).single();
          ownerName = farm?.name || "Fazenda não encontrada";
        } else if (o.owner_id) {
          const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", o.owner_id).single();
          ownerName = supplier?.name || "N/A";
        }
        resolved.push({
          owner_id: effectiveId || "",
          owner_name: ownerName,
          percentage: Number(o.percentage),
          owner_type: ownerType,
          store_owner_id: o.store_owner_id || null,
          third_party_farm_id: o.third_party_farm_id || null,
        });
      }
      setOwners(resolved);
    } catch (error) {
      console.error("Error fetching owners:", error);
      setOwners([]);
    }
  };

  const total = toNum(totalValue);

  // Mantém os valores em R$ sincronizados com os percentuais quando o total muda
  useEffect(() => {
    setRows((prev) => prev.map((r) => {
      if (!r.pctVenda) return r;
      const valor = (total * toNum(r.pctVenda)) / 100;
      return { ...r, valor: valor ? valor.toFixed(2) : "" };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const updateRow = (idx: number, patch: Partial<ClientRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handlePctVendaChange = (idx: number, value: string) => {
    const pct = toNum(value);
    const valor = total > 0 ? ((total * pct) / 100).toFixed(2) : "";
    updateRow(idx, { pctVenda: value, valor });
  };

  const handleValorChange = (idx: number, value: string) => {
    const valor = toNum(value);
    const pct = total > 0 ? ((valor / total) * 100).toFixed(2) : "";
    updateRow(idx, { valor: value, pctVenda: pct });
  };

  const handleSelectClient = (idx: number, clienteId: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, clienteId } : r));
      // Primeiro cliente da venda recebe automaticamente 100% / valor total
      if (next.length === 1 && !prev[idx].pctVenda) {
        next[idx] = {
          ...next[idx],
          pctVenda: "100",
          valor: total > 0 ? total.toFixed(2) : "",
        };
      }
      return next;
    });
    setOpenClientPopover(null);
    setClientSearch("");
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const distributedValue = rows.reduce((s, r) => s + toNum(r.valor), 0);
  const distributedPct = rows.reduce((s, r) => s + toNum(r.pctVenda), 0);
  const difference = total - distributedValue;

  const clienteIds = rows.map((r) => r.clienteId).filter(Boolean);
  const hasDuplicate = new Set(clienteIds).size !== clienteIds.length;
  const ownersTotal = owners.reduce((s, o) => s + o.percentage, 0);
  const buyersAnimalTotal = rows.reduce((s, r) => {
    const isExistingOwner = owners.some((o) => o.owner_id === r.clienteId);
    return s + (isExistingOwner ? 0 : toNum(r.pctAnimal));
  }, 0);
  const animalGrandTotal = ownersTotal + buyersAnimalTotal;

  const allRowsFilled = rows.length > 0 && rows.every(
    (r) => r.clienteId && toNum(r.pctVenda) > 0 && toNum(r.valor) > 0 && toNum(r.pctAnimal) > 0
  );

  const canSave =
    !!record &&
    !!saleDate &&
    total > 0 &&
    allRowsFilled &&
    !hasDuplicate &&
    Math.abs(distributedPct - 100) < 0.01 &&
    Math.abs(difference) < 0.01 &&
    animalGrandTotal <= 100 + 0.01;

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name || "Selecionar cliente...";

  const handleSave = async () => {
    if (!record || !saleDate) return;
    if (hasDuplicate) {
      toast({ title: "Erro", description: "Este cliente já foi adicionado nesta venda.", variant: "destructive" });
      return;
    }
    if (Math.abs(distributedPct - 100) >= 0.01 || Math.abs(difference) >= 0.01) {
      toast({ title: "Erro", description: "A soma das participações dos clientes precisa totalizar 100% e o valor total da venda.", variant: "destructive" });
      return;
    }
    if (animalGrandTotal > 100 + 0.01) {
      toast({ title: "Erro", description: `O somatório das participações dos proprietários (${ownersTotal.toFixed(2)}%) + venda do animal ultrapassa 100%.`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("register_operational_sale", {
        p_tipo: tipo,
        p_item_id: record.id,
        p_sale_date: format(saleDate, "yyyy-MM-dd"),
        p_total: total,
        p_data_prevista: expectedDeliveryDate ? format(expectedDeliveryDate, "yyyy-MM-dd") : null,
        p_clients: rows.map((r) => ({
          cliente_id: r.clienteId,
          percentual_venda: toNum(r.pctVenda),
          valor_venda: toNum(r.valor),
          percentual_animal: toNum(r.pctAnimal),
        })),
        p_owners: owners.map((o) => ({
          owner_type: o.owner_type,
          owner_id: o.owner_id,
          store_owner_id: o.store_owner_id,
          third_party_farm_id: o.third_party_farm_id,
          percentage: o.percentage,
        })),
      });
      if (error) throw error;

      toast({ title: "Sucesso", description: "Venda registrada com sucesso." });
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      console.error("Error saving sale:", error);
      toast({ title: "Erro", description: error?.message || "Erro ao salvar venda.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Venda{record ? ` - ${record.name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Campos gerais da venda */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data da Venda *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !saleDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {saleDate ? format(saleDate, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={saleDate || undefined} onSelect={(d) => setSaleDate(d || null)} locale={ptBR} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Valor total da Venda (R$) *</Label>
              <Input type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="0,00" />
            </div>

            <div className="space-y-2">
              <Label>Data prevista de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedDeliveryDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedDeliveryDate ? format(expectedDeliveryDate, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expectedDeliveryDate || undefined} onSelect={(d) => setExpectedDeliveryDate(d || null)} locale={ptBR} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clientes da venda */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Clientes da venda</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar cliente
              </Button>
            </div>

            {rows.map((row, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <Popover open={openClientPopover === idx} onOpenChange={(o) => setOpenClientPopover(o ? idx : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          {row.clienteId ? clientName(row.clienteId) : "Selecionar cliente..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50">
                        <div className="p-2">
                          <Input placeholder="Pesquisar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredClients.map((c) => (
                            <div
                              key={c.id}
                              className={cn("px-3 py-2 cursor-pointer hover:bg-accent text-sm", row.clienteId === c.id && "bg-accent font-medium")}
                              onClick={() => handleSelectClient(idx, c.id)}
                            >
                              {c.name}
                            </div>
                          ))}
                          {filteredClients.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {rows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="mt-5 text-destructive" onClick={() => removeRow(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">% da venda</Label>
                    <Input type="number" step="0.01" value={row.pctVenda} onChange={(e) => handlePctVendaChange(idx, e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={row.valor} onChange={(e) => handleValorChange(idx, e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">% vendida do animal</Label>
                    <Input type="number" step="0.01" value={row.pctAnimal} onChange={(e) => updateRow(idx, { pctAnimal: e.target.value })} placeholder="0,00" />
                  </div>
                </div>
              </div>
            ))}

            {/* Resumo */}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Total da venda:</span><span className="font-medium">{formatCurrency(total)}</span></div>
              <div className="flex justify-between"><span>Total distribuído:</span><span className="font-medium">{formatCurrency(distributedValue)}</span></div>
              <div className="flex justify-between">
                <span>Diferença:</span>
                <span className={cn("font-medium", Math.abs(difference) >= 0.01 && "text-destructive")}>{formatCurrency(difference)}</span>
              </div>
              <div className="flex justify-between">
                <span>Percentual distribuído:</span>
                <span className={cn("font-medium", Math.abs(distributedPct - 100) >= 0.01 && "text-destructive")}>{distributedPct.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Proprietários atuais */}
          {owners.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <Label className="text-base font-semibold">Proprietários Atuais</Label>
              <p className="text-sm text-muted-foreground">Ajuste as participações dos proprietários conforme a venda.</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proprietário</TableHead>
                      <TableHead className="text-right">% Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owners.map((owner, idx) => (
                      <TableRow key={`${owner.owner_type}-${owner.owner_id}`}>
                        <TableCell className="font-medium">{owner.owner_name}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={owner.percentage}
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val <= 100) {
                                setOwners((prev) => prev.map((o, i) => (i === idx ? { ...o, percentage: val } : o)));
                              }
                            }}
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded-lg text-sm">
                <span className="font-medium">Total Proprietários + venda</span>
                <span className={cn("font-semibold", animalGrandTotal > 100 && "text-destructive")}>
                  {animalGrandTotal.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Salvando..." : "Salvar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaleModal;
