import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Edit, Search, Trash2, Users, Check, X } from "lucide-react";

type OwnerType = "supplier" | "store" | "third_party_farm";

interface Owner {
  id: string;
  owner_id: string | null;
  store_owner_id: string | null;
  third_party_farm_id: string | null;
  owner_type: OwnerType;
  owner_name: string;
  owner_trade_name: string | null;
  percentage: number;
}

interface SupplierOption {
  id: string;
  name: string;
  trade_name: string | null;
}

interface OwnersTabProps {
  entityId: string | null;
  entityType: "animal" | "pregnancy" | "aspiration" | "embryo_transfer";
  isReadOnly?: boolean;
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getOwnerType = (ownerType?: string | null): OwnerType => {
  if (ownerType === "store") return "store";
  if (ownerType === "third_party_farm") return "third_party_farm";
  return "supplier";
};

const getOwnerTypeLabel = (ownerType: OwnerType) => {
  if (ownerType === "store") return "Fazenda Própria";
  if (ownerType === "third_party_farm") return "Fazenda Terceira";
  return "Proprietário";
};

const formatSupplierLabel = (supplier?: SupplierOption | null) => {
  if (!supplier) return "";
  return supplier.trade_name ? `${supplier.name} - ${supplier.trade_name}` : supplier.name;
};

export function OwnersTab({ entityId, entityType, isReadOnly = false }: OwnersTabProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [userStores, setUserStores] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedOwnerType, setSelectedOwnerType] = useState<OwnerType>("supplier");
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [percentage, setPercentage] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fkColumn = entityType === "animal"
    ? "animal_id"
    : entityType === "pregnancy"
    ? "pregnancy_id"
    : entityType === "embryo_transfer"
    ? "embryo_transfer_id"
    : "aspiration_id";

  useEffect(() => {
    fetchSuppliers();
    fetchUserStores();
    fetchThirdPartyFarms();
  }, []);

  useEffect(() => {
    if (entityId) {
      fetchOwners();
    } else {
      setOwners([]);
    }
  }, [entityId]);

  const fetchSuppliers = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", userData.user.id)
        .single();
      if (!profile?.matrix_id) return;
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, trade_name")
        .eq("matrix_id", profile.matrix_id)
        .eq("is_active", true)
        .eq("is_owner", true)
        .order("name");
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchUserStores = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("user_stores")
        .select("store_id, stores:store_id(id, name)")
        .eq("user_id", userData.user.id);
      if (data) {
        const stores = data
          .map((d: any) => d.stores)
          .filter(Boolean)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setUserStores(stores);
      }
    } catch (error) {
      console.error("Error fetching user stores:", error);
    }
  };

  const fetchThirdPartyFarms = async () => {
    try {
      const { data } = await supabase
        .from("third_party_farms")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setThirdPartyFarms(data || []);
    } catch (error) {
      console.error("Error fetching third-party farms:", error);
    }
  };

  const queryOwners = async (id: string) => {
    if (entityType === "animal") {
      return supabase.from("animal_owners").select("id, owner_id, store_owner_id, third_party_farm_id, owner_type, percentage").eq("animal_id", id).order("created_at", { ascending: true });
    } else if (entityType === "pregnancy") {
      return supabase.from("pregnancy_owners").select("id, owner_id, store_owner_id, third_party_farm_id, owner_type, percentage").eq("pregnancy_id", id).order("created_at", { ascending: true });
    } else if (entityType === "embryo_transfer") {
      return supabase.from("embryo_transfer_owners").select("id, owner_id, store_owner_id, third_party_farm_id, owner_type, percentage").eq("embryo_transfer_id", id).order("created_at", { ascending: true });
    } else {
      return supabase.from("aspiration_owners").select("id, owner_id, store_owner_id, third_party_farm_id, owner_type, percentage").eq("aspiration_id", id).order("created_at", { ascending: true });
    }
  };

  const insertOwner = async (record: any) => {
    if (entityType === "animal") return supabase.from("animal_owners").insert(record);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").insert(record);
    if (entityType === "embryo_transfer") return supabase.from("embryo_transfer_owners").insert(record);
    return supabase.from("aspiration_owners").insert(record);
  };

  const updateOwner = async (id: string, record: any) => {
    if (entityType === "animal") return supabase.from("animal_owners").update(record).eq("id", id);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").update(record).eq("id", id);
    if (entityType === "embryo_transfer") return supabase.from("embryo_transfer_owners").update(record).eq("id", id);
    return supabase.from("aspiration_owners").update(record).eq("id", id);
  };

  const deleteOwner = async (id: string) => {
    if (entityType === "animal") return supabase.from("animal_owners").delete().eq("id", id);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").delete().eq("id", id);
    if (entityType === "embryo_transfer") return supabase.from("embryo_transfer_owners").delete().eq("id", id);
    return supabase.from("aspiration_owners").delete().eq("id", id);
  };

  const fetchOwners = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const { data, error } = await queryOwners(entityId);
      if (error) throw error;

      const ownersWithNames: Owner[] = [];
      for (const row of data || []) {
        const ownerType = getOwnerType((row as any).owner_type);
        let ownerName = "Não encontrado";
        let ownerTradeName: string | null = null;

        if (ownerType === "store" && (row as any).store_owner_id) {
          const { data: store } = await supabase
            .from("stores")
            .select("name")
            .eq("id", (row as any).store_owner_id)
            .single();
          ownerName = store?.name || "Fazenda não encontrada";
        } else if (ownerType === "third_party_farm" && (row as any).third_party_farm_id) {
          const { data: farm } = await supabase
            .from("third_party_farms")
            .select("name")
            .eq("id", (row as any).third_party_farm_id)
            .single();
          ownerName = farm?.name || "Fazenda não encontrada";
        } else if (row.owner_id) {
          const { data: supplier } = await supabase
            .from("suppliers")
            .select("name, trade_name")
            .eq("id", row.owner_id)
            .single();
          ownerName = supplier?.name || "Não encontrado";
          ownerTradeName = supplier?.trade_name || null;
        }

        ownersWithNames.push({
          id: row.id,
          owner_id: row.owner_id,
          store_owner_id: (row as any).store_owner_id,
          third_party_farm_id: (row as any).third_party_farm_id || null,
          owner_type: ownerType,
          owner_name: ownerName,
          owner_trade_name: ownerTradeName,
          percentage: Number(row.percentage),
        });
      }
      setOwners(ownersWithNames);
    } catch (error) {
      console.error("Error fetching owners:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetSelectionState = () => {
    setSelectedOwnerId("");
    setOwnerSearchTerm("");
    setOwnerPopoverOpen(false);
  };

  const handleAdd = async () => {
    if (!entityId || !selectedOwnerId || !percentage) {
      toast({ title: "Erro", description: "Selecione o proprietário e informe a %.", variant: "destructive" });
      return;
    }
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0.01 e 100.", variant: "destructive" });
      return;
    }
    const currentTotal = owners.reduce((s, o) => s + o.percentage, 0);
    if (currentTotal + pct > 100) {
      toast({ title: "Erro", description: `Soma ultrapassa 100%. Disponível: ${(100 - currentTotal).toFixed(2)}%`, variant: "destructive" });
      return;
    }
    // Check duplicate
    const isDuplicate =
      selectedOwnerType === "store"
        ? owners.some(o => o.owner_type === "store" && o.store_owner_id === selectedOwnerId)
        : selectedOwnerType === "third_party_farm"
          ? owners.some(o => o.owner_type === "third_party_farm" && o.third_party_farm_id === selectedOwnerId)
          : owners.some(o => o.owner_type === "supplier" && o.owner_id === selectedOwnerId);
    if (isDuplicate) {
      toast({ title: "Erro", description: "Este proprietário já foi adicionado.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const record: any = {
        [fkColumn]: entityId,
        owner_type: selectedOwnerType,
        percentage: pct,
        created_by: userData.user?.id,
      };
      if (selectedOwnerType === "store") {
        record.store_owner_id = selectedOwnerId;
        record.owner_id = null;
        record.third_party_farm_id = null;
      } else if (selectedOwnerType === "third_party_farm") {
        record.third_party_farm_id = selectedOwnerId;
        record.owner_id = null;
        record.store_owner_id = null;
      } else {
        record.owner_id = selectedOwnerId;
        record.store_owner_id = null;
        record.third_party_farm_id = null;
      }
      const { error } = await insertOwner(record);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário adicionado." });
      setShowAddForm(false);
      resetSelectionState();
      setPercentage("");
      setSelectedOwnerType("supplier");
      fetchOwners();
    } catch (error) {
      console.error("Error adding owner:", error);
      toast({ title: "Erro", description: "Erro ao adicionar proprietário.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (owner: Owner) => {
    setEditingId(owner.id);
    setSelectedOwnerType(owner.owner_type);
    setSelectedOwnerId(
      owner.owner_type === "store"
        ? owner.store_owner_id || ""
        : owner.owner_type === "third_party_farm"
          ? owner.third_party_farm_id || ""
          : owner.owner_id || "",
    );
    setOwnerSearchTerm("");
    setOwnerPopoverOpen(false);
    setPercentage(owner.percentage.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingId || !percentage) return;
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0.01 e 100.", variant: "destructive" });
      return;
    }
    const currentTotal = owners.filter(o => o.id !== editingId).reduce((s, o) => s + o.percentage, 0);
    if (currentTotal + pct > 100) {
      toast({ title: "Erro", description: `Soma ultrapassa 100%. Disponível: ${(100 - currentTotal).toFixed(2)}%`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updateData: any = { percentage: pct, owner_type: selectedOwnerType };
      if (selectedOwnerType === "store") {
        updateData.store_owner_id = selectedOwnerId;
        updateData.owner_id = null;
        updateData.third_party_farm_id = null;
      } else if (selectedOwnerType === "third_party_farm") {
        updateData.third_party_farm_id = selectedOwnerId;
        updateData.owner_id = null;
        updateData.store_owner_id = null;
      } else {
        updateData.owner_id = selectedOwnerId;
        updateData.store_owner_id = null;
        updateData.third_party_farm_id = null;
      }
      const { error } = await updateOwner(editingId, updateData);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário atualizado." });
      setEditingId(null);
      resetSelectionState();
      setPercentage("");
      setSelectedOwnerType("supplier");
      fetchOwners();
    } catch (error) {
      console.error("Error updating owner:", error);
      toast({ title: "Erro", description: "Erro ao atualizar proprietário.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ownerId: string) => {
    if (!confirm("Tem certeza que deseja remover este proprietário?")) return;
    try {
      const { error } = await deleteOwner(ownerId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário removido." });
      fetchOwners();
    } catch (error) {
      console.error("Error deleting owner:", error);
      toast({ title: "Erro", description: "Erro ao remover proprietário.", variant: "destructive" });
    }
  };

  const totalPercentage = owners.reduce((s, o) => s + o.percentage, 0);

  // Filter available options based on owner type and not already added
  const editingOwner = owners.find(owner => owner.id === editingId);

  const availableSuppliers = useMemo(
    () =>
      suppliers.filter(
        (supplier) =>
          !owners.some((owner) => owner.owner_type === "supplier" && owner.owner_id === supplier.id) ||
          editingOwner?.owner_id === supplier.id,
      ),
    [editingOwner?.owner_id, owners, suppliers],
  );

  const availableStores = useMemo(
    () =>
      userStores.filter(
        (store) =>
          !owners.some((owner) => owner.owner_type === "store" && owner.store_owner_id === store.id) ||
          editingOwner?.store_owner_id === store.id,
      ),
    [editingOwner?.store_owner_id, owners, userStores],
  );

  const availableThirdPartyFarms = useMemo(
    () =>
      thirdPartyFarms.filter(
        (farm) =>
          !owners.some((owner) => owner.owner_type === "third_party_farm" && owner.third_party_farm_id === farm.id) ||
          editingOwner?.third_party_farm_id === farm.id,
      ),
    [editingOwner?.third_party_farm_id, owners, thirdPartyFarms],
  );

  const filteredSuppliers = useMemo(
    () =>
      availableSuppliers.filter((supplier) => {
        if (!ownerSearchTerm.trim()) return true;
        const normalizedTerm = normalizeText(ownerSearchTerm);
        return (
          normalizeText(supplier.name).includes(normalizedTerm) ||
          normalizeText(supplier.trade_name || "").includes(normalizedTerm)
        );
      }),
    [availableSuppliers, ownerSearchTerm],
  );

  const filteredStores = useMemo(
    () =>
      availableStores.filter((store) => {
        if (!ownerSearchTerm.trim()) return true;
        return normalizeText(store.name).includes(normalizeText(ownerSearchTerm));
      }),
    [availableStores, ownerSearchTerm],
  );

  const filteredThirdPartyFarms = useMemo(
    () =>
      availableThirdPartyFarms.filter((farm) => {
        if (!ownerSearchTerm.trim()) return true;
        return normalizeText(farm.name).includes(normalizeText(ownerSearchTerm));
      }),
    [availableThirdPartyFarms, ownerSearchTerm],
  );

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedOwnerId);
  const selectedStore = userStores.find((store) => store.id === selectedOwnerId);
  const selectedThirdPartyFarm = thirdPartyFarms.find((farm) => farm.id === selectedOwnerId);

  const currentOptions =
    selectedOwnerType === "store"
      ? filteredStores.map((store) => ({
          id: store.id,
          primaryLabel: store.name,
          secondaryLabel: null as string | null,
        }))
      : selectedOwnerType === "third_party_farm"
        ? filteredThirdPartyFarms.map((farm) => ({
            id: farm.id,
            primaryLabel: farm.name,
            secondaryLabel: null as string | null,
          }))
        : filteredSuppliers.map((supplier) => ({
            id: supplier.id,
            primaryLabel: supplier.name,
            secondaryLabel: supplier.trade_name,
          }));

  const selectedOwnerLabel =
    selectedOwnerType === "store"
      ? selectedStore?.name || ""
      : selectedOwnerType === "third_party_farm"
        ? selectedThirdPartyFarm?.name || ""
        : formatSupplierLabel(selectedSupplier);

  const renderOwnerSelect = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo *</Label>
          <Select
            value={selectedOwnerType}
            onValueChange={(value: OwnerType) => {
              setSelectedOwnerType(value);
              resetSelectionState();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="store">Fazenda Própria</SelectItem>
              <SelectItem value="third_party_farm">Fazenda Terceira</SelectItem>
              <SelectItem value="supplier">Proprietário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{selectedOwnerType === "store" ? "Fazenda *" : selectedOwnerType === "third_party_farm" ? "Fazenda Terceira *" : "Proprietário *"}</Label>
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                <span className="truncate">
                  {selectedOwnerLabel || (selectedOwnerType === "store" ? "Selecione a fazenda" : selectedOwnerType === "third_party_farm" ? "Selecione a fazenda terceira" : "Selecione o proprietário")}
                </span>
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="border-b p-2">
                <Input
                  placeholder={
                    selectedOwnerType === "store"
                      ? "Pesquisar fazenda..."
                      : selectedOwnerType === "third_party_farm"
                        ? "Pesquisar fazenda terceira..."
                        : "Pesquisar por razão social ou nome fantasia..."
                  }
                  value={ownerSearchTerm}
                  onChange={(event) => setOwnerSearchTerm(event.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {currentOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      selectedOwnerId === option.id && "bg-accent",
                    )}
                    onClick={() => {
                      setSelectedOwnerId(option.id);
                      setOwnerPopoverOpen(false);
                    }}
                  >
                    <span className="font-medium">{option.primaryLabel}</span>
                    {option.secondaryLabel && (
                      <span className="text-xs text-muted-foreground">Nome fantasia: {option.secondaryLabel}</span>
                    )}
                  </button>
                ))}
                {currentOptions.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Proprietários
        </h3>
        {!isReadOnly && !showAddForm && !editingId && entityId && (
          <Button
            size="sm"
            onClick={() => {
              setShowAddForm(true);
              resetSelectionState();
              setPercentage("");
              setSelectedOwnerType("supplier");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Proprietário
          </Button>
        )}
      </div>

      {!entityId && (
        <p className="text-center text-muted-foreground py-4">
          Salve o registro primeiro para gerenciar proprietários.
        </p>
      )}

      {/* Add Form */}
      {showAddForm && entityId && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="space-y-3">
            {renderOwnerSelect()}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label>Participação (%) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={percentage}
                  onChange={e => setPercentage(e.target.value)}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    resetSelectionState();
                    setPercentage("");
                    setSelectedOwnerType("supplier");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owners List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : owners.length === 0 && entityId ? (
        <p className="text-center text-muted-foreground py-8">Nenhum proprietário registrado.</p>
      ) : owners.length > 0 ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead className="text-right">Participação (%)</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map(owner => (
                  <TableRow key={owner.id}>
                    {editingId === owner.id ? (
                      <>
                        <TableCell colSpan={3}>
                          {renderOwnerSelect()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={percentage}
                            onChange={e => setPercentage(e.target.value)}
                            className="w-24 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                resetSelectionState();
                                setPercentage("");
                                setSelectedOwnerType("supplier");
                              }}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              owner.owner_type === "store"
                                ? "bg-primary/10 text-primary"
                                : owner.owner_type === "third_party_farm"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {getOwnerTypeLabel(owner.owner_type)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{owner.owner_name}</TableCell>
                        <TableCell>{owner.owner_type === "supplier" ? owner.owner_trade_name || "-" : "-"}</TableCell>
                        <TableCell className="text-right">{owner.percentage.toFixed(2)}%</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(owner)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(owner.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">Total</span>
            <span className="font-semibold">{totalPercentage.toFixed(2)}%</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
