import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Search,
  Users,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getFinancialAllocationLabel } from "@/lib/financialAllocations";

interface ReceptoraRecord {
  id: string;
  code: number;
  name: string;
  registration: string | null;
  ear_tag: number | null;
  batch_id: string | null;
  sex: string;
  farm_entry_date: string | null;
  birth_date: string | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  observations: string | null;
  photos: string[];
  cover_photo: string | null;
  store_id: string;
  is_active: boolean;
  farm_id: string | null;
  farm_type: string | null;
}

interface OptionItem {
  id: string;
  name: string;
}

interface FinancialItem {
  id: string;
  type: "expense" | "revenue";
  document_number: string | null;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  partner_name: string | null;
  allocation_type: string;
  total_price: number;
}

const emptyForm = {
  code: 0,
  name: "",
  registration: "",
  ear_tag: "",
  batch_id: "",
  sex: "femea",
  farm_entry_date: "",
  birth_date: "",
  breed_id: "",
  category_id: "",
  auction_id: "",
  auction_lot: "",
  observations: "",
  photos: [] as string[],
  cover_photo: "",
  is_active: "ativo",
  farm: "",
};

const emptyGroupCommon = {
  sex: "femea",
  farm_entry_date: "",
  birth_date: "",
  breed_id: "",
  category_id: "",
  auction_id: "",
  auction_lot: "",
  batch_id: "",
  farm: "",
  registration: "",
  observations: "",
  is_active: "ativo",
};

const Receptoras = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ReceptoraRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedRecord, setSelectedRecord] = useState<ReceptoraRecord | null>(null);
  const [activeTab, setActiveTab] = useState("dados");
  const [formData, setFormData] = useState(emptyForm);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ReceptoraRecord | null>(null);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupStep, setGroupStep] = useState<1 | 2>(1);
  const [groupCommon, setGroupCommon] = useState(emptyGroupCommon);
  const [groupQuantity, setGroupQuantity] = useState(1);
  const [groupRows, setGroupRows] = useState<Array<{ name: string; ear_tag: string }>>([]);

  const [batches, setBatches] = useState<OptionItem[]>([]);
  const [breeds, setBreeds] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [auctions, setAuctions] = useState<OptionItem[]>([]);
  const [ownFarms, setOwnFarms] = useState<OptionItem[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<OptionItem[]>([]);

  const [primaryStoreId, setPrimaryStoreId] = useState<string | null>(null);
  const [financialItems, setFinancialItems] = useState<FinancialItem[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const isReadOnly = modalMode === "view";

  const recipientCategoryIds = useMemo(
    () => categories.filter((c) => /recept/i.test(c.name)).map((c) => c.id),
    [categories],
  );

  const effectiveCategoryIds = recipientCategoryIds.length > 0 ? recipientCategoryIds : categories.map((c) => c.id);

  const getContext = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id, matrix_id")
      .eq("id", userId)
      .maybeSingle();

    const ids = new Set<string>();
    if (profile?.store_id) ids.add(profile.store_id);

    const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", userId);
    (userStores || []).forEach((s) => ids.add(s.store_id));

    let storeIds = Array.from(ids);

    if (profile?.matrix_id && storeIds.length > 0) {
      const { data: matrixStores } = await supabase
        .from("stores")
        .select("id")
        .eq("matrix_id", profile.matrix_id)
        .in("id", storeIds);
      storeIds = (matrixStores || []).map((s) => s.id);
    }

    return {
      userId,
      matrixId: profile?.matrix_id || null,
      storeId: profile?.store_id || storeIds[0] || null,
      storeIds,
    };
  };

  const getNextCode = async () => {
    const { data, error } = await supabase
      .from("animals")
      .select("code")
      .order("code", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.code || 0) + 1;
  };

  const fetchDropdowns = async () => {
    const context = await getContext();
    if (!context?.storeId) return [] as OptionItem[];

    setPrimaryStoreId(context.storeId);

    const commonFilter = context.matrixId
      ? { key: "matrix_id", value: context.matrixId }
      : { key: "store_id", value: context.storeId };

    const [batchesRes, breedsRes, categoriesRes, auctionsRes, storesRes, thirdFarmsRes] = await Promise.all([
      supabase
        .from("animal_batches")
        .select("id, name")
        .eq(commonFilter.key as any, commonFilter.value)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("animal_breeds")
        .select("id, name")
        .eq(commonFilter.key as any, commonFilter.value)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("animal_categories")
        .select("id, name")
        .eq(commonFilter.key as any, commonFilter.value)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("leiloes")
        .select("id, name")
        .eq(commonFilter.key as any, commonFilter.value)
        .eq("is_active", true)
        .order("name"),
      supabase.from("stores").select("id, name").in("id", context.storeIds).order("name"),
      supabase.from("third_party_farms").select("id, name").eq("is_active", true).order("name"),
    ]);

    const loadedBatches = (batchesRes.data || []) as OptionItem[];
    const loadedBreeds = (breedsRes.data || []) as OptionItem[];
    const loadedCategories = (categoriesRes.data || []) as OptionItem[];
    const loadedAuctions = (auctionsRes.data || []) as OptionItem[];
    const loadedOwnFarms = (storesRes.data || []) as OptionItem[];
    const loadedThirdPartyFarms = (thirdFarmsRes.data || []) as OptionItem[];

    setBatches(loadedBatches);
    setBreeds(loadedBreeds);
    setCategories(loadedCategories);
    setAuctions(loadedAuctions);
    setOwnFarms(loadedOwnFarms);
    setThirdPartyFarms(loadedThirdPartyFarms);

    return loadedCategories;
  };

  const fetchRecords = async (forcedCategoryIds?: string[]) => {
    setLoading(true);
    try {
      const context = await getContext();
      if (!context || context.storeIds.length === 0) {
        setRecords([]);
        return;
      }

      const categoryIds = forcedCategoryIds ?? effectiveCategoryIds;
      if (categoryIds.length === 0) {
        setRecords([]);
        return;
      }

      let query = supabase
        .from("animals")
        .select("id, code, name, registration, ear_tag, batch_id, sex, farm_entry_date, birth_date, breed_id, category_id, auction_id, auction_lot, observations, photos, cover_photo, store_id, is_active, farm_id, farm_type")
        .in("store_id", context.storeIds)
        .order("code", { ascending: false });

      query = query.in("category_id", categoryIds);

      const { data, error } = await query;
      if (error) throw error;

      const normalized = (data || []).map((item: any) => ({
        ...item,
        photos: Array.isArray(item.photos) ? item.photos : [],
      }));

      setRecords(normalized as ReceptoraRecord[]);
    } catch (error) {
      console.error("Error fetching receptoras:", error);
      toast({ title: "Erro ao carregar receptoras", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const loadedCategories = await fetchDropdowns();
      const receptorCategoryIds = loadedCategories.filter((c) => /recept/i.test(c.name)).map((c) => c.id);
      await fetchRecords(receptorCategoryIds);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedRecord || activeTab !== "financeiro") return;
    fetchFinancial(selectedRecord.id);
  }, [selectedRecord, activeTab]);

  const fetchFinancial = async (animalId: string) => {
    setLoadingFinancial(true);
    try {
      const [expRes, revRes] = await Promise.all([
        supabase
          .from("accounts_payable_item_allocations")
          .select(`id, allocation_type, accounts_payable_items!inner(total_price, account_payable_id, accounts_payable!inner(id, document_number, due_date, payment_date, status, supplier_id))`)
          .or(`animal_id.eq.${animalId},recipient_id.eq.${animalId}`),
        supabase
          .from("accounts_receivable_item_allocations")
          .select(`id, allocation_type, accounts_receivable_items!inner(total_price, account_receivable_id, accounts_receivable!inner(id, document_number, due_date, payment_date, status, creditor_id))`)
          .or(`animal_id.eq.${animalId},recipient_id.eq.${animalId}`),
      ]);

      const expensesRaw = expRes.data || [];
      const revenuesRaw = revRes.data || [];

      const supplierIds = Array.from(
        new Set(
          expensesRaw
            .map((e: any) => e.accounts_payable_items?.accounts_payable?.supplier_id)
            .filter(Boolean),
        ),
      ) as string[];

      const creditorIds = Array.from(
        new Set(
          revenuesRaw
            .map((r: any) => r.accounts_receivable_items?.accounts_receivable?.creditor_id)
            .filter(Boolean),
        ),
      ) as string[];

      const [suppliersRes, creditorsRes] = await Promise.all([
        supplierIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
          : Promise.resolve({ data: [] as any[] }),
        creditorIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", creditorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const supplierMap = new Map((suppliersRes.data || []).map((s: any) => [s.id, s.name]));
      const creditorMap = new Map((creditorsRes.data || []).map((c: any) => [c.id, c.name]));

      const mappedExpenses: FinancialItem[] = expensesRaw.map((e: any) => {
        const ap = e.accounts_payable_items?.accounts_payable;
        return {
          id: e.id,
          type: "expense",
          document_number: ap?.document_number || null,
          due_date: ap?.due_date || null,
          payment_date: ap?.payment_date || null,
          status: ap?.status || null,
          partner_name: ap?.supplier_id ? supplierMap.get(ap.supplier_id) || null : null,
          allocation_type: e.allocation_type,
          total_price: Number(e.accounts_payable_items?.total_price || 0),
        };
      });

      const mappedRevenues: FinancialItem[] = revenuesRaw.map((r: any) => {
        const ar = r.accounts_receivable_items?.accounts_receivable;
        return {
          id: r.id,
          type: "revenue",
          document_number: ar?.document_number || null,
          due_date: ar?.due_date || null,
          payment_date: ar?.payment_date || null,
          status: ar?.status || null,
          partner_name: ar?.creditor_id ? creditorMap.get(ar.creditor_id) || null : null,
          allocation_type: r.allocation_type,
          total_price: Number(r.accounts_receivable_items?.total_price || 0),
        };
      });

      setFinancialItems([...mappedExpenses, ...mappedRevenues]);
    } catch (error) {
      console.error("Error fetching financeiro receptora:", error);
      setFinancialItems([]);
    } finally {
      setLoadingFinancial(false);
    }
  };

  const handleUploadPhoto = async (file: File, isCover = false) => {
    try {
      if (isCover) setUploadingCover(true);
      else setUploadingPhoto(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from("animal-photos").upload(path, file);
      if (error) throw error;

      const { data: publicUrl } = supabase.storage.from("animal-photos").getPublicUrl(path);

      if (isCover) {
        setFormData((prev) => ({ ...prev, cover_photo: publicUrl.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, photos: [...prev.photos, publicUrl.publicUrl] }));
      }

      toast({ title: "Foto enviada com sucesso" });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      if (isCover) setUploadingCover(false);
      else setUploadingPhoto(false);
    }
  };

  const openCreateModal = async () => {
    const nextCode = await getNextCode();
    setFormData({ ...emptyForm, code: nextCode, category_id: recipientCategoryIds[0] || "" });
    setSelectedRecord(null);
    setModalMode("create");
    setActiveTab("dados");
    setFinancialItems([]);
    setModalOpen(true);
  };

  const openEditModal = (record: ReceptoraRecord, mode: "edit" | "view") => {
    setSelectedRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      registration: record.registration || "",
      ear_tag: record.ear_tag?.toString() || "",
      batch_id: record.batch_id || "",
      sex: record.sex || "femea",
      farm_entry_date: record.farm_entry_date || "",
      birth_date: record.birth_date || "",
      breed_id: record.breed_id || "",
      category_id: record.category_id || "",
      auction_id: record.auction_id || "",
      auction_lot: record.auction_lot || "",
      observations: record.observations || "",
      photos: record.photos || [],
      cover_photo: record.cover_photo || "",
      is_active: record.is_active ? "ativo" : "inativo",
      farm: record.farm_id ? `${record.farm_type === "third_party" ? "third" : "own"}-${record.farm_id}` : "",
    });
    setModalMode(mode);
    setActiveTab("dados");
    setModalOpen(true);
  };

  const validateBaseForm = (payload: typeof formData) => {
    if (!payload.name.trim()) return "Nome é obrigatório";
    if (!payload.sex) return "Sexo é obrigatório";
    if (!payload.category_id) return "Categoria é obrigatória";
    if (payload.auction_id && !payload.auction_lot.trim()) {
      return "Lote do leilão é obrigatório quando há leilão";
    }
    return null;
  };

  const buildAnimalPayload = (base: typeof formData, codeValue: number, nameValue: string, earTagValue?: string) => {
    let farmId: string | null = null;
    let farmType: string | null = null;

    if (base.farm) {
      const [type, id] = base.farm.split("-");
      farmId = id || null;
      farmType = type === "third" ? "third_party" : "own";
    }

    return {
      code: codeValue,
      name: nameValue.trim(),
      registration: base.registration || null,
      ear_tag: earTagValue ? parseInt(earTagValue, 10) : base.ear_tag ? parseInt(base.ear_tag, 10) : null,
      batch_id: base.batch_id || null,
      sex: base.sex,
      farm_entry_date: base.farm_entry_date || null,
      birth_date: base.birth_date || null,
      breed_id: base.breed_id || null,
      category_id: base.category_id || null,
      auction_id: base.auction_id || null,
      auction_lot: base.auction_lot || null,
      observations: base.observations || null,
      photos: base.photos,
      cover_photo: base.cover_photo || null,
      is_active: base.is_active === "ativo",
      farm_id: farmId,
      farm_type: farmType,
      store_id: primaryStoreId,
      first_weighing_date: null,
      first_weight: null,
      recipient_id: null,
      sire_id: null,
      dam_id: null,
      aspiration_date: null,
      transfer_date: null,
      veterinarian_id: null,
      laboratory_id: null,
      ultrasound_date: null,
    };
  };

  const handleSave = async () => {
    try {
      const validationError = validateBaseForm(formData);
      if (validationError) {
        toast({ title: validationError, variant: "destructive" });
        return;
      }

      if (!primaryStoreId) {
        toast({ title: "Store não encontrada para o usuário", variant: "destructive" });
        return;
      }

      const payload = buildAnimalPayload(formData, formData.code, formData.name);

      if (modalMode === "create") {
        const { error } = await supabase.from("animals").insert(payload as any);
        if (error) throw error;
        toast({ title: "Receptora cadastrada com sucesso" });
      } else if (selectedRecord) {
        const { error } = await supabase.from("animals").update(payload as any).eq("id", selectedRecord.id);
        if (error) throw error;
        toast({ title: "Receptora atualizada com sucesso" });
      }

      setModalOpen(false);
      await fetchRecords();
    } catch (error) {
      console.error("Error saving receptora:", error);
      toast({ title: "Erro ao salvar receptora", variant: "destructive" });
    }
  };

  const openGroupModal = () => {
    setGroupStep(1);
    setGroupCommon(emptyGroupCommon);
    setGroupQuantity(1);
    setGroupRows([]);
    setGroupModalOpen(true);
  };

  const handleGroupStep1 = () => {
    if (!groupCommon.category_id) {
      toast({ title: "Categoria é obrigatória", variant: "destructive" });
      return;
    }
    if (groupQuantity < 1) {
      toast({ title: "Quantidade mínima é 1", variant: "destructive" });
      return;
    }
    const rows = Array.from({ length: groupQuantity }).map((_, i) => ({
      name: `Receptora ${i + 1}`,
      ear_tag: "",
    }));
    setGroupRows(rows);
    setGroupStep(2);
  };

  const handleConfirmGroup = async () => {
    try {
      if (!primaryStoreId) {
        toast({ title: "Store não encontrada para o usuário", variant: "destructive" });
        return;
      }

      const invalidRow = groupRows.find((row) => !row.name.trim());
      if (invalidRow) {
        toast({ title: "Informe o nome de todas as receptoras", variant: "destructive" });
        return;
      }

      const nextCode = await getNextCode();

      const baseForm: typeof formData = {
        ...emptyForm,
        ...groupCommon,
        code: nextCode,
        name: "",
        ear_tag: "",
        photos: [],
        cover_photo: "",
      };

      const inserts = groupRows.map((row, index) => buildAnimalPayload(baseForm, nextCode + index, row.name, row.ear_tag));

      const { error } = await supabase.from("animals").insert(inserts as any);
      if (error) throw error;

      toast({
        title: "Cadastro em grupo concluído",
        description: `${inserts.length} receptora(s) criada(s) com sucesso`,
      });

      setGroupModalOpen(false);
      await fetchRecords();
    } catch (error) {
      console.error("Error creating group receptoras:", error);
      toast({ title: "Erro ao criar cadastro em grupo", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase.from("animals").update({ is_active: false }).eq("id", recordToDelete.id);
      if (error) throw error;
      toast({ title: "Receptora excluída com sucesso" });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      await fetchRecords();
    } catch (error) {
      console.error("Error deleting receptora:", error);
      toast({ title: "Erro ao excluir receptora", variant: "destructive" });
    }
  };

  const filteredRecords = records.filter((item) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return [item.name, item.registration || "", String(item.ear_tag || ""), String(item.code)]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const batchNameById = new Map(batches.map((b) => [b.id, b.name]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const farmNameById = new Map([...ownFarms, ...thirdPartyFarms].map((f) => [f.id, f.name]));

  const expenseTotal = financialItems
    .filter((f) => f.type === "expense")
    .reduce((sum, item) => sum + item.total_price, 0);

  const revenueTotal = financialItems
    .filter((f) => f.type === "revenue")
    .reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Receptoras</h1>
              <p className="text-sm text-slate-600">Módulo exclusivo de cadastro de receptoras</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openGroupModal}>
              <Users className="h-4 w-4 mr-2" />
              Cadastro em Grupo
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Receptora
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Listagem de Receptoras</CardTitle>
            <CardDescription>Busca e gestão das receptoras cadastradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome, código, registro ou brinco"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            {loading ? (
              <p className="text-center py-8 text-slate-500">Carregando receptoras...</p>
            ) : filteredRecords.length === 0 ? (
              <p className="text-center py-8 text-slate-500">Nenhuma receptora encontrada</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => openEditModal(record, "view")}
                      >
                        <TableCell>
                          {record.cover_photo ? (
                            <img src={record.cover_photo} alt={record.name} className="w-10 h-10 rounded-md object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{record.code}</TableCell>
                        <TableCell className="font-medium">{record.name}</TableCell>
                        <TableCell>{record.ear_tag || "-"}</TableCell>
                        <TableCell>{record.farm_id ? farmNameById.get(record.farm_id) || "-" : "-"}</TableCell>
                        <TableCell>{record.batch_id ? batchNameById.get(record.batch_id) || "-" : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={record.is_active ? "default" : "secondary"}>
                            {record.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.farm_entry_date
                            ? new Date(`${record.farm_entry_date}T12:00:00`).toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                        <TableCell>{record.category_id ? categoryNameById.get(record.category_id) || "-" : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditModal(record, "view"); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditModal(record, "edit"); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordToDelete(record);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="p-5 border-b bg-slate-50/70">
            <DialogHeader>
              <DialogTitle>
                {modalMode === "create" ? "Nova Receptora" : modalMode === "edit" ? "Editar Receptora" : "Visualizar Receptora"}
              </DialogTitle>
              <DialogDescription>
                Cadastro exclusivo de receptoras com abas: Dados Cadastrais, Observações e Fotos, Financeiro.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
                <TabsTrigger value="obs">Observações e Fotos</TabsTrigger>
                <TabsTrigger value="financeiro" disabled={!selectedRecord}>Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label>Código</Label>
                    <Input value={formData.code} disabled />
                  </div>
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={formData.name}
                      disabled={isReadOnly}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Registro</Label>
                    <Input
                      value={formData.registration}
                      disabled={isReadOnly}
                      onChange={(e) => setFormData((prev) => ({ ...prev, registration: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Brinco</Label>
                    <Input
                      value={formData.ear_tag}
                      disabled={isReadOnly}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ear_tag: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Lote</Label>
                    <Select
                      value={formData.batch_id || "none"}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, batch_id: value === "none" ? "" : value }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar lote" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem lote</SelectItem>
                        {batches.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sexo *</Label>
                    <Select value={formData.sex} onValueChange={(value) => setFormData((prev) => ({ ...prev, sex: value }))} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="femea">Fêmea</SelectItem>
                        <SelectItem value="macho">Macho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={formData.is_active}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, is_active: value }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fazenda</Label>
                    <Select value={formData.farm || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, farm: value === "none" ? "" : value }))} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecionar fazenda" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem fazenda</SelectItem>
                        {ownFarms.map((farm) => (<SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>Própria - {farm.name}</SelectItem>))}
                        {thirdPartyFarms.map((farm) => (<SelectItem key={`third-${farm.id}`} value={`third-${farm.id}`}>Terceira - {farm.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data de entrada</Label>
                    <Input type="date" value={formData.farm_entry_date} disabled={isReadOnly} onChange={(e) => setFormData((prev) => ({ ...prev, farm_entry_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data de nascimento</Label>
                    <Input type="date" value={formData.birth_date} disabled={isReadOnly} onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Raça</Label>
                    <Select value={formData.breed_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, breed_id: value === "none" ? "" : value }))} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecionar raça" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem raça</SelectItem>
                        {breeds.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria *</Label>
                    <Select value={formData.category_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value === "none" ? "" : value }))} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categories.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Leilão</Label>
                    <Select value={formData.auction_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, auction_id: value === "none" ? "" : value }))} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecionar leilão" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem leilão</SelectItem>
                        {auctions.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lote do leilão</Label>
                    <Input value={formData.auction_lot} disabled={isReadOnly} onChange={(e) => setFormData((prev) => ({ ...prev, auction_lot: e.target.value }))} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="obs" className="mt-4 space-y-4">
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observations}
                    disabled={isReadOnly}
                    onChange={(e) => setFormData((prev) => ({ ...prev, observations: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Foto de capa</Label>
                  {formData.cover_photo ? (
                    <div className="relative w-40 h-40 rounded-lg overflow-hidden border">
                      <img src={formData.cover_photo} alt="Capa" className="w-full h-full object-cover" />
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7"
                          onClick={() => setFormData((prev) => ({ ...prev, cover_photo: "" }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="w-40 h-40 rounded-lg border bg-slate-50 flex items-center justify-center text-slate-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  {!isReadOnly && (
                    <label>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadPhoto(e.target.files[0], true)} />
                      <Button type="button" variant="outline" disabled={uploadingCover} asChild>
                        <span><Upload className="h-4 w-4 mr-2" />{uploadingCover ? "Enviando..." : "Adicionar foto de capa"}</span>
                      </Button>
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Fotos</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {formData.photos.map((photo, idx) => (
                      <div key={`${photo}-${idx}`} className="relative rounded-lg overflow-hidden border h-28">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        {!isReadOnly && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7"
                            onClick={() => setFormData((prev) => ({ ...prev, photos: prev.photos.filter((p) => p !== photo) }))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isReadOnly && (
                    <label>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadPhoto(e.target.files[0], false)} />
                      <Button type="button" variant="outline" disabled={uploadingPhoto} asChild>
                        <span><Upload className="h-4 w-4 mr-2" />{uploadingPhoto ? "Enviando..." : "Adicionar foto"}</span>
                      </Button>
                    </label>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="mt-4 space-y-4">
                {loadingFinancial ? (
                  <p className="text-center py-6 text-slate-500">Carregando financeiro...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Card className="border-rose-200 bg-rose-50/40">
                        <CardContent className="p-4">
                          <p className="text-sm text-rose-700">Total Despesas</p>
                          <p className="text-lg font-semibold text-rose-700">
                            {expenseTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200 bg-emerald-50/40">
                        <CardContent className="p-4">
                          <p className="text-sm text-emerald-700">Total Receitas</p>
                          <p className="text-lg font-semibold text-emerald-700">
                            {revenueTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {financialItems.length === 0 ? (
                      <p className="text-center py-6 text-slate-500">Nenhum lançamento financeiro vinculado</p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Documento</TableHead>
                              <TableHead>Parceiro</TableHead>
                              <TableHead>Alocação</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Pagamento</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {financialItems.map((item) => (
                              <TableRow key={`${item.type}-${item.id}`}>
                                <TableCell>
                                  <Badge variant={item.type === "expense" ? "secondary" : "default"}>
                                    {item.type === "expense" ? "Despesa" : "Receita"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.document_number || "-"}</TableCell>
                                <TableCell>{item.partner_name || "-"}</TableCell>
                                <TableCell>{getFinancialAllocationLabel(item.allocation_type)}</TableCell>
                                <TableCell>{item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "-"}</TableCell>
                                <TableCell>{item.payment_date ? new Date(`${item.payment_date}T12:00:00`).toLocaleDateString("pt-BR") : "-"}</TableCell>
                                <TableCell>{item.status || "-"}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {item.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50/70">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Fechar</Button>
            {!isReadOnly && <Button onClick={handleSave}>Salvar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastro em Grupo de Receptoras</DialogTitle>
            <DialogDescription>
              Etapa {groupStep} de 2 - primeiro defina os dados comuns, depois os nomes individuais.
            </DialogDescription>
          </DialogHeader>

          {groupStep === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" min={1} value={groupQuantity} onChange={(e) => setGroupQuantity(Math.max(1, Number(e.target.value || 1)))} />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={groupCommon.category_id || "none"} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, category_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={groupCommon.sex} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, sex: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="femea">Fêmea</SelectItem>
                      <SelectItem value="macho">Macho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fazenda</Label>
                  <Select value={groupCommon.farm || "none"} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, farm: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar fazenda" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem fazenda</SelectItem>
                      {ownFarms.map((farm) => (<SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>Própria - {farm.name}</SelectItem>))}
                      {thirdPartyFarms.map((farm) => (<SelectItem key={`third-${farm.id}`} value={`third-${farm.id}`}>Terceira - {farm.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote</Label>
                  <Select value={groupCommon.batch_id || "none"} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, batch_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar lote" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem lote</SelectItem>
                      {batches.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Raça</Label>
                  <Select value={groupCommon.breed_id || "none"} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, breed_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar raça" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem raça</SelectItem>
                      {breeds.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={groupCommon.is_active} onValueChange={(value) => setGroupCommon((prev) => ({ ...prev, is_active: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de entrada</Label>
                  <Input type="date" value={groupCommon.farm_entry_date} onChange={(e) => setGroupCommon((prev) => ({ ...prev, farm_entry_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={groupCommon.birth_date} onChange={(e) => setGroupCommon((prev) => ({ ...prev, birth_date: e.target.value }))} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setGroupModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleGroupStep1}>Avançar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nome da Receptora *</TableHead>
                      <TableHead>Brinco (opcional)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.map((row, index) => (
                      <TableRow key={`group-row-${index}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={row.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setGroupRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, name: value } : item)));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.ear_tag}
                            onChange={(e) => {
                              const value = e.target.value;
                              setGroupRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, ear_tag: value } : item)));
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setGroupStep(1)}>Voltar</Button>
                <Button variant="outline" onClick={() => setGroupModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleConfirmGroup}>Confirmar e Criar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receptora?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação inativará a receptora {recordToDelete?.name ? `"${recordToDelete.name}"` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn("bg-red-600 hover:bg-red-700")}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Receptoras;
