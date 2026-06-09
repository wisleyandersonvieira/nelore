import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, MoreHorizontal,
  Droplets, ChevronsUpDown, Check, Ban, ExternalLink, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getRecipientCategoryIds } from "@/lib/animalCategoryRules";

const ITEMS_PER_PAGE = 15;

const formatDateBR = (value?: string | null) =>
  value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "-";

interface ReproducaoRecord {
  id: string;
  code: number;
  animal_mae_id: string;
  aspiracao_id: string | null;
  pos_transferencia_id: string | null;
  prenhez_id: string | null;
  animal_gerado_id: string | null;
  status: string;
  observacao: string | null;
  store_id: string;
  created_at: string;
}

interface AnimalOption {
  id: string;
  code: number;
  name: string;
  sex: string;
  is_active: boolean;
  breed_id: string | null;
  category_id: string | null;
  farm_id: string | null;
  farm_type: string | null;
}

interface NamedRecord { id: string; name: string; }
interface AspiracaoInfo { id: string; code: number; name: string; status: string; }

const STATUS_META: Record<string, { label: string; className: string }> = {
  aspiracao: { label: "Aspiração", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  pos_transferencia: { label: "Pós-transferência", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  prenhez: { label: "Prenhez", className: "bg-rose-100 text-rose-700 border-rose-200" },
  animal_gerado: { label: "Animal gerado", className: "bg-green-100 text-green-700 border-green-200" },
  finalizada: { label: "Finalizada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const meta = STATUS_META[status] || { label: status, className: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={cn("font-medium", meta.className)}>{meta.label}</Badge>;
};

const AnimaisReproducao = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [records, setRecords] = useState<ReproducaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);

  // lookup maps
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [breeds, setBreeds] = useState<NamedRecord[]>([]);
  const [categories, setCategories] = useState<NamedRecord[]>([]);
  const [ownFarms, setOwnFarms] = useState<NamedRecord[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<NamedRecord[]>([]);
  const [aspiracoesMap, setAspiracoesMap] = useState<Record<string, AspiracaoInfo>>({});

  // pagination / search
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Step 1: choose animal
  const [chooseOpen, setChooseOpen] = useState(false);
  const [animalPopoverOpen, setAnimalPopoverOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");

  // Step 2: aspiration form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    expected_aspiration_month: null as Date | null,
    breed_id: "",
    category_id: "",
    farm: "",
    observacao: "",
  });

  // View / edit
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<ReproducaoRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ReproducaoRecord | null>(null);
  const [editData, setEditData] = useState({ status: "aspiracao", observacao: "" });

  // delete / cancel
  const [confirmDelete, setConfirmDelete] = useState<ReproducaoRecord | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<ReproducaoRecord | null>(null);

  const resolveStore = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { storeId: null as string | null, matrixId: null as string | null };
    const { data: profile } = await supabase
      .from("profiles").select("store_id, matrix_id").eq("id", userData.user.id).single();
    let sId = profile?.store_id || null;
    const matrixId = profile?.matrix_id || null;
    if (!sId) {
      const { data: userStores } = await supabase
        .from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1);
      sId = userStores?.[0]?.store_id || null;
    }
    return { storeId: sId, matrixId };
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { storeId: sId, matrixId } = await resolveStore();
      setStoreId(sId);
      if (!sId && !matrixId) {
        setLoading(false);
        return;
      }

      const storeIds = matrixId
        ? ((await supabase.from("stores").select("id").eq("matrix_id", matrixId)).data || []).map((s) => s.id)
        : sId ? [sId] : [];

      const breedsQuery = matrixId
        ? supabase.from("animal_breeds").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_breeds").select("id, name").eq("store_id", sId!).eq("is_active", true);
      const categoriesQuery = matrixId
        ? supabase.from("animal_categories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_categories").select("id, name").eq("store_id", sId!).eq("is_active", true);

      const animalsQuery = storeIds.length > 0
        ? supabase.from("animals").select("id, code, name, sex, is_active, breed_id, category_id, farm_id, farm_type").in("store_id", storeIds).order("name")
        : supabase.from("animals").select("id, code, name, sex, is_active, breed_id, category_id, farm_id, farm_type").eq("store_id", sId!).order("name");

      const reproQuery = storeIds.length > 0
        ? supabase.from("reproducoes").select("*").in("store_id", storeIds).order("code", { ascending: false })
        : supabase.from("reproducoes").select("*").eq("store_id", sId!).order("code", { ascending: false });

      const [breedsRes, categoriesRes, storesRes, thirdRes, animalsRes, reproRes] = await Promise.all([
        breedsQuery,
        categoriesQuery,
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        animalsQuery,
        reproQuery,
      ]);

      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdRes.data || []);
      setAnimals((animalsRes.data || []) as AnimalOption[]);

      const repro = (reproRes.data || []) as ReproducaoRecord[];
      setRecords(repro);

      const aspIds = repro.map((r) => r.aspiracao_id).filter(Boolean) as string[];
      if (aspIds.length > 0) {
        const { data: asps } = await supabase
          .from("aspiration_management").select("id, code, name, status").in("id", aspIds);
        const map: Record<string, AspiracaoInfo> = {};
        (asps || []).forEach((a: any) => { map[a.id] = a; });
        setAspiracoesMap(map);
      } else {
        setAspiracoesMap({});
      }
    } catch (error) {
      console.error("Erro ao carregar reproduções:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as reproduções.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto open "Nova Reprodução" flow when navigating to /nova
  useEffect(() => {
    if (location.pathname.endsWith("/nova")) {
      openChoose();
      // normalize URL so refresh/back behaves well
      navigate("/animais/reproducao/cadastradas", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const getBreedName = (id: string | null) => (id ? breeds.find((b) => b.id === id)?.name || "-" : "-");
  const getCategoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name || "-" : "-");
  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") return ownFarms.find((f) => f.id === farmId)?.name || "-";
    return thirdPartyFarms.find((f) => f.id === farmId)?.name || "-";
  };
  const getAnimal = (id: string | null) => (id ? animals.find((a) => a.id === id) : undefined);

  // Animais ativos, excluindo receptoras (não podem iniciar uma reprodução como matriz)
  const recipientCategoryIds = useMemo(() => getRecipientCategoryIds(categories), [categories]);
  const activeAnimals = useMemo(
    () => animals.filter((a) => a.is_active && !(a.category_id && recipientCategoryIds.includes(a.category_id))),
    [animals, recipientCategoryIds],
  );
  const selectedAnimal = useMemo(() => getAnimal(selectedAnimalId), [selectedAnimalId, animals]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((r) => {
      const animal = getAnimal(r.animal_mae_id);
      const asp = r.aspiracao_id ? aspiracoesMap[r.aspiracao_id] : null;
      return (
        String(r.code).includes(term) ||
        (animal?.name || "").toLowerCase().includes(term) ||
        (asp?.name || "").toLowerCase().includes(term) ||
        (STATUS_META[r.status]?.label || r.status).toLowerCase().includes(term)
      );
    });
  }, [records, search, animals, aspiracoesMap]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginated = filteredRecords.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ---- Nova Reprodução flow ----
  const openChoose = () => {
    setSelectedAnimalId("");
    setChooseOpen(true);
  };

  const handleContinue = () => {
    if (!selectedAnimal) {
      toast({ title: "Selecione um animal", description: "Escolha o animal/mãe para iniciar a reprodução.", variant: "destructive" });
      return;
    }
    if (!selectedAnimal.is_active) {
      toast({ title: "Animal inativo", description: "Não é possível iniciar reprodução com animal inativo.", variant: "destructive" });
      return;
    }
    // Pre-fill aspiration form from the selected animal
    setFormData({
      name: selectedAnimal.name,
      expected_aspiration_month: null,
      breed_id: selectedAnimal.breed_id || "",
      category_id: selectedAnimal.category_id || "",
      farm: selectedAnimal.farm_id && selectedAnimal.farm_type
        ? `${selectedAnimal.farm_type}-${selectedAnimal.farm_id}`
        : "",
      observacao: "",
    });
    setChooseOpen(false);
    setFormOpen(true);
  };

  const getNextCode = async (table: "aspiration_management" | "reproducoes", sId: string) => {
    const { data } = await supabase
      .from(table).select("code").eq("store_id", sId).order("code", { ascending: false }).limit(1);
    return data && data.length > 0 ? (data[0].code as number) + 1 : 1;
  };

  const parseFarm = (farmValue: string) => {
    if (!farmValue || farmValue.startsWith("header-")) return { farmId: null as string | null, farmType: null as string | null };
    const idx = farmValue.indexOf("-");
    if (idx <= 0) return { farmId: null, farmType: null };
    return { farmType: farmValue.substring(0, idx), farmId: farmValue.substring(idx + 1) };
  };

  const handleSave = async () => {
    if (!selectedAnimal) return;
    if (!selectedAnimal.is_active) {
      toast({ title: "Animal inativo", description: "Não é possível vincular a reprodução a um animal inativo.", variant: "destructive" });
      return;
    }
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "O nome é obrigatório.", variant: "destructive" });
      return;
    }
    const sId = storeId;
    if (!sId) {
      toast({ title: "Erro", description: "Loja/fazenda não identificada para o usuário atual.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { farmId, farmType } = parseFarm(formData.farm);

      // 1) Registro normal na Gestão de Aspiração
      const aspCode = await getNextCode("aspiration_management", sId);
      const { data: aspInserted, error: aspError } = await supabase
        .from("aspiration_management")
        .insert({
          code: aspCode,
          name: formData.name.trim(),
          observations: formData.observacao.trim() || null,
          expected_aspiration_month: formData.expected_aspiration_month
            ? format(formData.expected_aspiration_month, "yyyy-MM-dd")
            : null,
          breed_id: formData.breed_id || null,
          category_id: formData.category_id || null,
          farm_id: farmId,
          farm_type: farmType,
          store_id: sId,
        } as any)
        .select("id, code, name, status")
        .single();

      if (aspError) throw aspError;

      // 2) Registro no módulo Reprodução vinculado à aspiração e ao animal/mãe
      const reproCode = await getNextCode("reproducoes", sId);
      const { error: reproError } = await supabase
        .from("reproducoes")
        .insert({
          code: reproCode,
          animal_mae_id: selectedAnimal.id,
          aspiracao_id: aspInserted!.id,
          status: "aspiracao",
          observacao: formData.observacao.trim() || null,
          store_id: sId,
        });

      if (reproError) {
        // Mantém a aspiração? A regra de negócio diz que a aspiração deve aparecer
        // normalmente na Gestão de Aspiração, então não a removemos.
        throw reproError;
      }

      toast({ title: "Reprodução criada", description: `Reprodução #${reproCode} e aspiração #${aspCode} criadas com sucesso.` });
      setFormOpen(false);
      setSelectedAnimalId("");
      fetchAll();
    } catch (error: any) {
      console.error("Erro ao salvar reprodução:", error);
      toast({ title: "Erro", description: error?.message || "Não foi possível salvar a reprodução.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ---- View / Edit / Cancel / Delete ----
  const openView = (record: ReproducaoRecord) => {
    setViewRecord(record);
    setViewOpen(true);
  };

  const openEdit = (record: ReproducaoRecord) => {
    setEditRecord(record);
    setEditData({ status: record.status, observacao: record.observacao || "" });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reproducoes")
        .update({ status: editData.status, observacao: editData.observacao.trim() || null })
        .eq("id", editRecord.id);
      if (error) throw error;
      toast({ title: "Reprodução atualizada" });
      setEditOpen(false);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    try {
      const { error } = await supabase
        .from("reproducoes").update({ status: "cancelada" }).eq("id", confirmCancel.id);
      if (error) throw error;
      toast({ title: "Reprodução cancelada", description: "A aspiração vinculada foi mantida na Gestão de Aspiração." });
      setConfirmCancel(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível cancelar.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      // Exclui apenas o registro de reprodução. A aspiração permanece na Gestão de Aspiração.
      const { error } = await supabase.from("reproducoes").delete().eq("id", confirmDelete.id);
      if (error) throw error;
      toast({ title: "Reprodução excluída", description: "A aspiração vinculada não foi removida." });
      setConfirmDelete(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const animalLabel = (a?: AnimalOption) =>
    a ? `${a.name} - #${a.code} - ${getBreedName(a.breed_id)} - ${getCategoryName(a.category_id)}` : "-";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card/80 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/animais")} className="h-9 w-9 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reprodução</h1>
              <p className="text-sm text-muted-foreground">Central do ciclo reprodutivo do animal</p>
            </div>
          </div>
          <Button onClick={openChoose} className="h-10 gap-2 rounded-lg px-4 shadow-sm">
            <Plus className="h-4 w-4" />
            Nova Reprodução
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Reproduções Cadastradas</p>
            <p className="text-xs text-muted-foreground">Acompanhe a evolução de cada reprodução, da aspiração ao animal gerado.</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por código, animal, aspiração..."
              className="h-9 rounded-lg pl-9"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Animal / Mãe</TableHead>
                <TableHead>Raça</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Aspiração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead className="w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Nenhuma reprodução cadastrada.</TableCell></TableRow>
              ) : (
                paginated.map((r) => {
                  const animal = getAnimal(r.animal_mae_id);
                  const asp = r.aspiracao_id ? aspiracoesMap[r.aspiracao_id] : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">#{r.code}</TableCell>
                      <TableCell>{animal ? `${animal.name} (#${animal.code})` : "-"}</TableCell>
                      <TableCell>{getBreedName(animal?.breed_id ?? null)}</TableCell>
                      <TableCell>{getCategoryName(animal?.category_id ?? null)}</TableCell>
                      <TableCell>{getFarmName(animal?.farm_id ?? null, animal?.farm_type ?? null)}</TableCell>
                      <TableCell>{asp ? `#${asp.code} - ${asp.name}` : "-"}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>{formatDateBR(r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openView(r)}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate("/animais/aspiracoes")}
                              disabled={!r.aspiracao_id}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" /> Abrir aspiração vinculada
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmCancel(r)}
                              disabled={r.status === "cancelada"}
                            >
                              <Ban className="mr-2 h-4 w-4" /> Cancelar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(r)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filteredRecords.length} reprodução(ões)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span>Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </main>

      {/* Step 1: Choose animal */}
      <Dialog open={chooseOpen} onOpenChange={setChooseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Reprodução</DialogTitle>
            <DialogDescription>Selecione o animal/mãe ativo para iniciar o processo reprodutivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Animal / Mãe *</Label>
            <Popover open={animalPopoverOpen} onOpenChange={setAnimalPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedAnimal ? `${selectedAnimal.name} (#${selectedAnimal.code})` : "Selecionar animal ativo"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
                <Command>
                  <CommandInput placeholder="Pesquisar animal..." />
                  <CommandList>
                    <CommandEmpty>Nenhum animal ativo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {activeAnimals.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={`${a.name} ${a.code}`}
                          onSelect={() => { setSelectedAnimalId(a.id); setAnimalPopoverOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedAnimalId === a.id ? "opacity-100" : "opacity-0")} />
                          {a.name} (#{a.code}) — {getBreedName(a.breed_id)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChooseOpen(false)}>Cancelar</Button>
            <Button onClick={handleContinue} disabled={!selectedAnimalId}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Aspiration form (replica) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Reprodução - Aspiração</DialogTitle>
            <DialogDescription>O registro será criado na Gestão de Aspiração e vinculado a esta reprodução.</DialogDescription>
          </DialogHeader>

          {/* Animal vinculado - card informativo */}
          {selectedAnimal && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animal vinculado</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{animalLabel(selectedAnimal)}</p>
            </div>
          )}

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>Mês Previsto de Aspiração</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.expected_aspiration_month && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expected_aspiration_month ? format(formData.expected_aspiration_month, "MM/yyyy", { locale: ptBR }) : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={formData.expected_aspiration_month || undefined} onSelect={(date) => setFormData({ ...formData, expected_aspiration_month: date || null })} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Raça</Label>
                <Select value={formData.breed_id} onValueChange={(v) => setFormData({ ...formData, breed_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{breeds.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fazenda</Label>
                <Select value={formData.farm} onValueChange={(v) => setFormData({ ...formData, farm: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ownFarms.length > 0 && (
                      <>
                        <SelectItem value="header-own" disabled className="font-semibold">Fazendas Próprias</SelectItem>
                        {ownFarms.map((f) => <SelectItem key={`own-${f.id}`} value={`own-${f.id}`}>{f.name}</SelectItem>)}
                      </>
                    )}
                    {thirdPartyFarms.length > 0 && (
                      <>
                        <SelectItem value="header-third" disabled className="font-semibold border-t mt-2 pt-2">Fazendas Terceiras</SelectItem>
                        {thirdPartyFarms.map((f) => <SelectItem key={`third_party-${f.id}`} value={`third_party-${f.id}`}>{f.name}</SelectItem>)}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={4}
                placeholder="Digite uma observação para esta reprodução..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Reprodução"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reprodução #{viewRecord?.code}</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animal vinculado</p>
                <p className="mt-1 text-sm font-semibold">{animalLabel(getAnimal(viewRecord.animal_mae_id))}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewRecord.status} /></div>
                <div><span className="text-muted-foreground">Criação:</span> {formatDateBR(viewRecord.created_at)}</div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Etapas do ciclo</p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-cyan-600" />
                    Aspiração: {viewRecord.aspiracao_id && aspiracoesMap[viewRecord.aspiracao_id]
                      ? `#${aspiracoesMap[viewRecord.aspiracao_id].code} - ${aspiracoesMap[viewRecord.aspiracao_id].name}`
                      : "—"}
                  </li>
                  <li>Pós-transferência: {viewRecord.pos_transferencia_id ? "Vinculada" : "—"}</li>
                  <li>Prenhez: {viewRecord.prenhez_id ? "Vinculada" : "—"}</li>
                  <li>Animal gerado: {viewRecord.animal_gerado_id ? (getAnimal(viewRecord.animal_gerado_id)?.name || "Vinculado") : "—"}</li>
                </ul>
              </div>
              {viewRecord.observacao && (
                <div>
                  <p className="text-sm font-semibold">Observação</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewRecord.observacao}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Reprodução #{editRecord?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={editData.observacao} onChange={(e) => setEditData({ ...editData, observacao: e.target.value })} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reprodução?</AlertDialogTitle>
            <AlertDialogDescription>
              A reprodução #{confirmCancel?.code} será marcada como cancelada. A aspiração vinculada permanece na Gestão de Aspiração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancelar reprodução</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reprodução?</AlertDialogTitle>
            <AlertDialogDescription>
              A reprodução #{confirmDelete?.code} será removida permanentemente. A aspiração vinculada NÃO será excluída e continuará na Gestão de Aspiração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisReproducao;
