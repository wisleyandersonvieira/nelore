import { useState, useEffect, useMemo } from "react";
import { OwnersTab } from "@/components/OwnersTab";
import { CreateLeilaoModal } from "@/components/CreateLeilaoModal";
import { SaleModal } from "@/components/SaleModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, Upload, X, Image, ChevronDown, ChevronUp, Filter, Search, DollarSign, FileText, FileSpreadsheet, Download, MoreHorizontal, Skull } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getRecipientCategoryIds, isRecipientCategoryId } from "@/lib/animalCategoryRules";
import { fetchAspirationRateioSummary } from "@/lib/aspirationRateio";
import ReproducoesVinculadas from "@/components/ReproducoesVinculadas";
import MobileReportCard from "@/components/MobileReportCard";
import FinanceiroReproducao from "@/components/FinanceiroReproducao";

interface Animal {
  id: string;
  code: number;
  name: string;
  registration: string | null;
  ear_tag: number | null;
  batch_id: string | null;
  sex: string;
  farm_entry_date: string | null;
  birth_date: string | null;
  first_weighing_date: string | null;
  first_weight: number | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  sire_id: string | null;
  dam_id: string | null;
  observations: string | null;
  photos: string[];
  cover_photo: string | null;
  store_id: string;
  is_active: boolean;
  farm_id: string | null;
  farm_type: string | null;
  recipient_id: string | null;
  aspiration_date: string | null;
  transfer_date: string | null;
  veterinarian_id: string | null;
  laboratory_id: string | null;
  ultrasound_date: string | null;
  pregnancy_id: string | null;
}

interface Batch {
  id: string;
  name: string;
}

interface Breed {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Auction {
  id: string;
  name: string;
}

interface BreedingAnimal {
  id: string;
  name: string;
  sex: string;
  sire_id: string | null;
  dam_id: string | null;
}

interface WeighingRecord {
  date: string;
  weight: number;
}

interface WeighingWithGMD extends WeighingRecord {
  gmd: number | null;
}

const AnimaisCadastro = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [soldAnimalIds, setSoldAnimalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState<Animal | null>(null);
  const [activeTab, setActiveTab] = useState("dados");

  // Filter state
  const [filters, setFilters] = useState({
    name: "",
    status: "ambos",
    farm: "",
    sex: "",
    breed_id: "",
    dam_id: "",
    sire_id: "",
    auction_id: "",
    category_id: "",
    birth_date_start: null as Date | null,
    birth_date_end: null as Date | null,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    registration: "",
    ear_tag: "",
    batch_id: "",
    sex: "",
    farm_entry_date: null as Date | null,
    birth_date: null as Date | null,
    first_weighing_date: null as Date | null,
    first_weight: "",
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    sire_id: "",
    dam_id: "",
    observations: "",
    photos: [] as string[],
    cover_photo: "",
    is_active: "ativo",
    farm: "",
    recipient_id: "",
  });

  // Recipient search state
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const [recipientCategoryFilter, setRecipientCategoryFilter] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Animal | null>(null);

  // Dropdown options
  const [batches, setBatches] = useState<Batch[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [createLeilaoOpen, setCreateLeilaoOpen] = useState(false);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [ownFarms, setOwnFarms] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ url: string; isCover: boolean } | null>(null);
  const [animalWeighings, setAnimalWeighings] = useState<WeighingWithGMD[]>([]);
  const [loadingWeighings, setLoadingWeighings] = useState(false);
  const [veterinarians, setVeterinarians] = useState<{ id: string; name: string }[]>([]);
  const [laboratories, setLaboratories] = useState<{ id: string; name: string }[]>([]);

  const recipientCategoryIds = useMemo(() => getRecipientCategoryIds(categories), [categories]);
  const animalCategories = useMemo(
    () => categories.filter((category) => !isRecipientCategoryId(category.id, recipientCategoryIds)),
    [categories, recipientCategoryIds],
  );
  const recipientCategories = useMemo(
    () => categories.filter((category) => isRecipientCategoryId(category.id, recipientCategoryIds)),
    [categories, recipientCategoryIds],
  );
  const listedAnimals = useMemo(
    () => animals.filter((animal) => !isRecipientCategoryId(animal.category_id, recipientCategoryIds)),
    [animals, recipientCategoryIds],
  );
  const recipientAnimals = useMemo(
    () => animals.filter((animal) => isRecipientCategoryId(animal.category_id, recipientCategoryIds)),
    [animals, recipientCategoryIds],
  );
  const farmLookup = useMemo(() => {
    const entries: Array<[string, string]> = [
      ...ownFarms.map((farm) => [`own-${farm.id}`, farm.name] as [string, string]),
      ...thirdPartyFarms.map((farm) => [`third_party-${farm.id}`, farm.name] as [string, string]),
    ];

    return new Map(entries);
  }, [ownFarms, thirdPartyFarms]);

  // Financial data state
  interface FinancialRecord {
    id: string;
    description: string;
    document_number: string | null;
    amount: number;
    due_date: string;
    payment_date: string | null;
    status: string;
    supplier_name: string | null;
    creditor_name: string | null;
    store_name: string | null;
    allocation_type: string;
    item_quantity: number;
    item_unit_price: number;
    item_total_price: number;
    account_payable_id: string;
    account_receivable_id: string;
    paid_amount: number;
    record_type: 'expense' | 'revenue';
    is_rateio?: boolean;
    rateio_label?: string;
  }
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");

  // Saldo direto do animal no modo atual (mesma lógica do bloco financeiro do animal),
  // usado para compor o card "Resultado Geral" do bloco Financeiro Reprodução.
  const animalDirectSaldo = useMemo(() => {
    const filtered = financialViewMode === "pagos"
      ? financialRecords
          .filter((r) => r.paid_amount > 0 || r.status === "paid")
          .map((r) => ({ ...r, paid_amount: r.paid_amount > 0 ? r.paid_amount : (r.status === "paid" ? r.item_total_price : 0) }))
      : financialRecords;
    const receitas = filtered.filter((r) => r.record_type === "revenue");
    const despesas = filtered.filter((r) => r.record_type === "expense");
    if (financialViewMode === "pagos") {
      return receitas.reduce((s, r) => s + r.paid_amount, 0) - despesas.reduce((s, r) => s + r.paid_amount, 0);
    }
    return receitas.reduce((s, r) => s + r.item_total_price, 0) - despesas.reduce((s, r) => s + r.item_total_price, 0);
  }, [financialRecords, financialViewMode]);

  // Sale modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleAnimal, setSaleAnimal] = useState<Animal | null>(null);
  const [saleClientId, setSaleClientId] = useState("");
  const [saleDate, setSaleDate] = useState<Date | null>(null);
  const [saleExpectedDeliveryDate, setSaleExpectedDeliveryDate] = useState<Date | null>(null);
  const [saleValue, setSaleValue] = useState("");
  const [salePercentage, setSalePercentage] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [saleOwners, setSaleOwners] = useState<{ owner_id: string; owner_name: string; percentage: number; owner_type: string; store_owner_id: string | null; third_party_farm_id: string | null }[]>([]);

  // Proprietários state
  interface AnimalSale {
    id: string;
    client_id: string;
    client_name: string;
    sale_date: string;
    sale_value: number;
    sale_percentage: number;
    auction_id: string | null;
    auction_lot: string | null;
  }
  const [animalSales, setAnimalSales] = useState<AnimalSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Death modal state
  const [deathModalOpen, setDeathModalOpen] = useState(false);
  const [deathAnimal, setDeathAnimal] = useState<Animal | null>(null);
  const [deathDate, setDeathDate] = useState<Date | null>(null);
  const [deathReason, setDeathReason] = useState("");

  // Reproduction data state
  const [reproData, setReproData] = useState({
    aspiration_date: null as Date | null,
    transfer_date: null as Date | null,
    veterinarian_id: "",
    laboratory_id: "",
    ultrasound_date: null as Date | null,
  });

  useEffect(() => {
    fetchAnimals();
    fetchDropdownData();
    fetchClients();
  }, []);

  // Abre automaticamente o cadastro do animal vindo do Rebanho (?open=<id>)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || animals.length === 0) return;
    const animal = animals.find((a) => a.id === openId);
    if (animal) {
      handleOpenModal("view", animal);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, animals]);

  const getUserStoreId = async (userId: string): Promise<string | null> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", userId)
      .single();

    if (profile?.store_id) return profile.store_id;

    // Fallback: buscar via user_stores
    const { data: userStore } = await supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    return userStore?.store_id || null;
  };

  const fetchAnimals = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const storeId = await getUserStoreId(userData.user.id);
      if (!storeId) return;

      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("store_id", storeId)
        .order("code", { ascending: true });

      if (error) throw error;
      const animalList = (data || []).map(a => ({ 
        ...a, 
        photos: Array.isArray(a.photos) ? a.photos as string[] : [] 
      }));
      setAnimals(animalList);

      // Fetch sold animal IDs: animals where the fazenda própria (store) has 0% ownership
      // An animal is "Vendido" when its store no longer appears as owner
      const animalIds = animalList.map(a => a.id);
      if (animalIds.length > 0) {
        const { data: ownerData } = await supabase
          .from("animal_owners")
          .select("animal_id, owner_type, store_owner_id, percentage")
          .in("animal_id", animalIds);
        
        if (ownerData) {
          // For each animal, check if there are ANY owners registered
          // and if the store (fazenda própria) has 0% or is not present
          const animalsWithOwners = new Set<string>();
          const animalsWithStoreOwner = new Set<string>();
          
          ownerData.forEach((o: any) => {
            animalsWithOwners.add(o.animal_id);
            if (o.owner_type === "store" && Number(o.percentage) > 0) {
              animalsWithStoreOwner.add(o.animal_id);
            }
          });
          
          const soldIds = new Set<string>();
          // An animal is "Vendido" if it has owners registered but no store owner with > 0%
          animalsWithOwners.forEach(animalId => {
            if (!animalsWithStoreOwner.has(animalId)) {
              soldIds.add(animalId);
            }
          });
          setSoldAnimalIds(soldIds);
        }
      }
    } catch (error) {
      console.error("Error fetching animals:", error);
      toast({ title: "Erro ao carregar animais", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const storeId = await getUserStoreId(userData.user.id);
      if (!storeId) return;

      // Get matrix_id for shared resources
      const { data: userProfile } = await supabase.from("profiles").select("matrix_id").eq("id", userData.user.id).single();
      const matrixId = userProfile?.matrix_id;

      // Fetch all dropdown data in parallel - shared resources by matrix_id
      const breedsQuery = matrixId
        ? supabase.from("animal_breeds").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_breeds").select("id, name").eq("store_id", storeId).eq("is_active", true);
      const categoriesQuery = matrixId
        ? supabase.from("animal_categories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_categories").select("id, name").eq("store_id", storeId).eq("is_active", true);
      const auctionsQuery = matrixId
        ? supabase.from("leiloes").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("leiloes").select("id, name").eq("store_id", storeId).eq("is_active", true);
      const breedingQuery = matrixId
        ? supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", storeId).eq("is_active", true);
      const vetQuery = matrixId
        ? supabase.from("veterinarians").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("veterinarians").select("id, name").eq("store_id", storeId).eq("is_active", true);
      const labQuery = matrixId
        ? supabase.from("laboratories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("laboratories").select("id, name").eq("store_id", storeId).eq("is_active", true);

      const [batchesRes, breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes, vetRes, labRes] = await Promise.all([
        supabase.from("animal_batches").select("id, name").eq("store_id", storeId),
        breedsQuery,
        categoriesQuery,
        auctionsQuery,
        breedingQuery,
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        vetQuery,
        labQuery,
      ]);

      setBatches(batchesRes.data || []);
      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      setSires((breedingAnimalsRes.data || []).filter(a => a.sex === "macho"));
      setDams((breedingAnimalsRes.data || []).filter(a => a.sex === "femea"));
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdPartyFarmsRes.data || []);
      setVeterinarians(vetRes.data || []);
      setLaboratories(labRes.data || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const getNextCode = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return 1;

      const storeId = await getUserStoreId(userData.user.id);
      if (!storeId) return 1;

      const { data, error } = await supabase.rpc("get_next_animal_code", {
        store_uuid: storeId,
      });

      if (error) throw error;
      return data || 1;
    } catch (error) {
      console.error("Error getting next code:", error);
      return 1;
    }
  };

  const fetchAnimalWeighings = async (animalId: string, firstWeighingDate: string | null, firstWeight: number | null) => {
    setLoadingWeighings(true);
    try {
      // Fetch weighing records for this animal
      const { data: records, error } = await supabase
        .from("weighing_records")
        .select(`
          weight,
          weighing_sessions!inner (date)
        `)
        .eq("animal_id", animalId)
        .not("weight", "is", null);

      if (error) throw error;

      // Build list of weighings including first weight if exists
      const weighings: WeighingRecord[] = [];

      // Add first weighing from animal registration
      if (firstWeighingDate && firstWeight) {
        weighings.push({
          date: firstWeighingDate,
          weight: firstWeight,
        });
      }

      // Add weighings from weighing_records
      if (records) {
        records.forEach((record: any) => {
          if (record.weight && record.weighing_sessions?.date) {
            weighings.push({
              date: record.weighing_sessions.date,
              weight: Number(record.weight),
            });
          }
        });
      }

      // Sort by date ascending
      weighings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate GMD for each weighing
      const weighingsWithGMD: WeighingWithGMD[] = weighings.map((w, index) => {
        if (index === 0) {
          return { ...w, gmd: null };
        }
        const prevWeighing = weighings[index - 1];
        const daysDiff = Math.round(
          (new Date(w.date).getTime() - new Date(prevWeighing.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const weightDiff = w.weight - prevWeighing.weight;
        const gmd = daysDiff > 0 ? weightDiff / daysDiff : null;
        return { ...w, gmd };
      });

      setAnimalWeighings(weighingsWithGMD);
    } catch (error) {
      console.error("Error fetching animal weighings:", error);
      setAnimalWeighings([]);
    } finally {
      setLoadingWeighings(false);
    }
  };

  const fetchAnimalFinancial = async (animalId: string, pregnancyId?: string | null) => {
    setLoadingFinancial(true);
    try {
      const allRecords: FinancialRecord[] = [];

      // 1. Fetch direct animal allocations (expenses)
      const { data: expAllocations } = await supabase
        .from("accounts_payable_item_allocations")
        .select(`id, allocation_type, account_payable_item_id, accounts_payable_items!inner ( quantity, unit_price, total_price, account_payable_id, accounts_payable!inner ( id, description, document_number, amount, due_date, payment_date, status, supplier_id, store_id ) )`)
        .eq("animal_id", animalId);

      // 1b. Fetch direct animal allocations (revenues)
      const { data: revAllocations } = await supabase
        .from("accounts_receivable_item_allocations")
        .select(`id, allocation_type, account_receivable_item_id, accounts_receivable_items!inner ( quantity, unit_price, total_price, account_receivable_id, accounts_receivable!inner ( id, description, document_number, amount, due_date, payment_date, status, creditor_id, store_id ) )`)
        .eq("animal_id", animalId);

      // Process expense allocations
      if (expAllocations && expAllocations.length > 0) {
        const supplierIds = new Set<string>();
        const storeIds = new Set<string>();
        expAllocations.forEach((a: any) => {
          const ap = a.accounts_payable_items?.accounts_payable;
          if (ap?.supplier_id) supplierIds.add(ap.supplier_id);
          if (ap?.store_id) storeIds.add(ap.store_id);
        });
        const [suppliersRes, storesRes] = await Promise.all([
          supplierIds.size > 0 ? supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds)) : { data: [] },
          storeIds.size > 0 ? supabase.from("stores").select("id, name").in("id", Array.from(storeIds)) : { data: [] },
        ]);
        const suppliersMap = new Map((suppliersRes.data || []).map((s: any) => [s.id, s.name]));
        const storesMap = new Map((storesRes.data || []).map((s: any) => [s.id, s.name]));

        const apIds = [...new Set(expAllocations.map((a: any) => a.accounts_payable_items?.accounts_payable?.id).filter(Boolean))];
        const paidMap = new Map<string, number>();
        if (apIds.length > 0) {
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: payments } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", apIds).lte("payment_date", today);
          (payments || []).forEach((p: any) => { paidMap.set(p.account_payable_id, (paidMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
        }

        expAllocations.forEach((a: any) => {
          const item = a.accounts_payable_items; const ap = item?.accounts_payable; const apId = ap?.id || "";
          allRecords.push({ id: a.id, description: ap?.description || "", document_number: ap?.document_number || null, amount: ap?.amount || 0, due_date: ap?.due_date || "", payment_date: ap?.payment_date || null, status: ap?.status || "", supplier_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null, creditor_name: null, store_name: ap?.store_id ? storesMap.get(ap.store_id) || null : null, allocation_type: a.allocation_type, item_quantity: item?.quantity || 0, item_unit_price: item?.unit_price || 0, item_total_price: item?.total_price || 0, account_payable_id: apId, account_receivable_id: "", paid_amount: paidMap.get(apId) || 0, record_type: 'expense' });
        });
      }

      // Process revenue allocations
      if (revAllocations && revAllocations.length > 0) {
        const creditorIds = new Set<string>();
        revAllocations.forEach((a: any) => { const cid = a.accounts_receivable_items?.accounts_receivable?.creditor_id; if (cid) creditorIds.add(cid); });
        const creditorsMap = new Map<string, string>();
        if (creditorIds.size > 0) {
          const { data: creditors } = await supabase.from("suppliers").select("id, name").in("id", Array.from(creditorIds));
          (creditors || []).forEach((c: any) => creditorsMap.set(c.id, c.name));
        }
        const arIds = [...new Set(revAllocations.map((a: any) => a.accounts_receivable_items?.accounts_receivable?.id).filter(Boolean))];
        const paidRecMap = new Map<string, number>();
        if (arIds.length > 0) {
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: payments } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", arIds).lte("payment_date", today);
          (payments || []).forEach((p: any) => { paidRecMap.set(p.account_receivable_id, (paidRecMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)); });
        }
        revAllocations.forEach((a: any) => {
          const item = a.accounts_receivable_items; const ar = item?.accounts_receivable; const arId = ar?.id || "";
          allRecords.push({ id: a.id, description: ar?.description || "", document_number: ar?.document_number || null, amount: ar?.amount || 0, due_date: ar?.due_date || "", payment_date: ar?.payment_date || null, status: ar?.status || "", supplier_name: null, creditor_name: ar?.creditor_id ? creditorsMap.get(ar.creditor_id) || null : null, store_name: null, allocation_type: a.allocation_type, item_quantity: item?.quantity || 0, item_unit_price: item?.unit_price || 0, item_total_price: item?.total_price || 0, account_payable_id: "", account_receivable_id: arId, paid_amount: paidRecMap.get(arId) || 0, record_type: 'revenue' });
        });
      }

      // 2. If animal has pregnancy_id, fetch rateios from pregnancy chain
      if (pregnancyId) {
        // Fetch pregnancy allocations (direct - no division since 1:1)
        const { data: prenExpAlloc } = await supabase.from("accounts_payable_item_allocations").select(`id, allocation_type, accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, status ) )`).eq("pregnancy_id", pregnancyId);
        const { data: prenRevAlloc } = await supabase.from("accounts_receivable_item_allocations").select(`id, allocation_type, accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, status ) )`).eq("pregnancy_id", pregnancyId);

        const addRateioSummary = async (allocations: any[], revAllocations: any[], label: string, allocType: string, idSuffix: string, divisor: number = 1) => {
          let totalExp = 0; let paidExp = 0;
          if (allocations && allocations.length > 0) {
            const apMap = new Map<string, { total: number; status: string }>();
            allocations.forEach((a: any) => { const p = a.accounts_payable_items?.total_price || 0; totalExp += p; const apId = a.accounts_payable_items?.accounts_payable?.id; const st = a.accounts_payable_items?.accounts_payable?.status || ""; if (apId) { const e = apMap.get(apId); if (e) e.total += p; else apMap.set(apId, { total: p, status: st }); } });
            const ids = Array.from(apMap.keys());
            if (ids.length > 0) {
              const today = format(new Date(), "yyyy-MM-dd");
              const { data: pay } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", ids).lte("payment_date", today);
              const payMap = new Map<string, number>(); (pay || []).forEach((p: any) => { payMap.set(p.account_payable_id, (payMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
              apMap.forEach((info, apId) => { const s = payMap.get(apId) || 0; if (s > 0) paidExp += s; else if (info.status === "paid") paidExp += info.total; });
            }
          }
          let totalRev = 0; let paidRev = 0;
          if (revAllocations && revAllocations.length > 0) {
            const arMap = new Map<string, { total: number; status: string }>();
            revAllocations.forEach((a: any) => { const p = a.accounts_receivable_items?.total_price || 0; totalRev += p; const arId = a.accounts_receivable_items?.accounts_receivable?.id; const st = a.accounts_receivable_items?.accounts_receivable?.status || ""; if (arId) { const e = arMap.get(arId); if (e) e.total += p; else arMap.set(arId, { total: p, status: st }); } });
            const ids = Array.from(arMap.keys());
            if (ids.length > 0) {
              const today = format(new Date(), "yyyy-MM-dd");
              const { data: pay } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", ids).lte("payment_date", today);
              const payMap = new Map<string, number>(); (pay || []).forEach((p: any) => { payMap.set(p.account_receivable_id, (payMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)); });
              arMap.forEach((info, arId) => { const s = payMap.get(arId) || 0; if (s > 0) paidRev += s; else if (info.status === "paid") paidRev += info.total; });
            }
          }
          if (totalExp > 0) {
            allRecords.push({ id: `rateio-${allocType}-exp-${idSuffix}`, description: "", document_number: null, amount: 0, due_date: "", payment_date: null, status: "", supplier_name: label, creditor_name: null, store_name: null, allocation_type: allocType, item_quantity: 0, item_unit_price: 0, item_total_price: totalExp / divisor, account_payable_id: "", account_receivable_id: "", paid_amount: paidExp / divisor, record_type: 'expense', is_rateio: true, rateio_label: label });
          }
          if (totalRev > 0) {
            allRecords.push({ id: `rateio-${allocType}-rev-${idSuffix}`, description: "", document_number: null, amount: 0, due_date: "", payment_date: null, status: "", supplier_name: null, creditor_name: label, store_name: null, allocation_type: allocType, item_quantity: 0, item_unit_price: 0, item_total_price: totalRev / divisor, account_payable_id: "", account_receivable_id: "", paid_amount: paidRev / divisor, record_type: 'revenue', is_rateio: true, rateio_label: label });
          }
        };

        // Add Prenhez rateio (1:1, no division)
        await addRateioSummary(prenExpAlloc || [], prenRevAlloc || [], "Rateio Gestão de Prenhez", "pregnancy_rateio", pregnancyId);

        // Get embryo_transfer_id from pregnancy
        const { data: pregnancyData } = await supabase.from("pregnancy_management").select("embryo_transfer_id").eq("id", pregnancyId).single();
        const embryoTransferId = pregnancyData?.embryo_transfer_id;

        if (embryoTransferId) {
          // Fetch Pós TE allocations
          const { data: teExpAlloc } = await supabase.from("accounts_payable_item_allocations").select(`id, allocation_type, accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, status ) )`).eq("embryo_transfer_id", embryoTransferId);
          const { data: teRevAlloc } = await supabase.from("accounts_receivable_item_allocations").select(`id, allocation_type, accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, status ) )`).eq("embryo_transfer_id", embryoTransferId);
          await addRateioSummary(teExpAlloc || [], teRevAlloc || [], "Rateio Pós TE", "te_rateio", embryoTransferId);

          // Get aspiration_id from embryo transfer
          const { data: teData } = await supabase.from("embryo_transfer_management").select("aspiration_id").eq("id", embryoTransferId).single();
          const aspirationId = teData?.aspiration_id;

          if (aspirationId) {
            const aspirationRateio = await fetchAspirationRateioSummary({
              aspirationId,
              embryoTransferId,
              reallocateEmptyBatchSiblings: true,
            });

            if (aspirationRateio.expenseTotal > 0) {
              allRecords.push({ id: `rateio-aspiration_rateio-exp-${aspirationId}`, description: "", document_number: null, amount: 0, due_date: "", payment_date: null, status: "", supplier_name: "Rateio de Aspiração", creditor_name: null, store_name: null, allocation_type: "aspiration_rateio", item_quantity: 0, item_unit_price: 0, item_total_price: aspirationRateio.expenseTotal / aspirationRateio.divisor, account_payable_id: "", account_receivable_id: "", paid_amount: aspirationRateio.expensePaid / aspirationRateio.divisor, record_type: 'expense', is_rateio: true, rateio_label: "Rateio de Aspiração" });
            }
            if (aspirationRateio.revenueTotal > 0) {
              allRecords.push({ id: `rateio-aspiration_rateio-rev-${aspirationId}`, description: "", document_number: null, amount: 0, due_date: "", payment_date: null, status: "", supplier_name: null, creditor_name: "Rateio de Aspiração", store_name: null, allocation_type: "aspiration_rateio", item_quantity: 0, item_unit_price: 0, item_total_price: aspirationRateio.revenueTotal / aspirationRateio.divisor, account_payable_id: "", account_receivable_id: "", paid_amount: aspirationRateio.revenuePaid / aspirationRateio.divisor, record_type: 'revenue', is_rateio: true, rateio_label: "Rateio de Aspiração" });
            }
          }
        }
      }

      setFinancialRecords(allRecords);
    } catch (error) {
      console.error("Error fetching animal financial:", error);
      setFinancialRecords([]);
    } finally {
      setLoadingFinancial(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase.from("profiles").select("matrix_id").eq("id", userData.user.id).single();
      if (!profile?.matrix_id) return;
      const { data } = await supabase.from("suppliers").select("id, name").eq("matrix_id", profile.matrix_id).eq("is_active", true).order("name");
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const getAuctionName = (auctionId: string | null) => {
    if (!auctionId) return "-";
    return auctions.find((a) => a.id === auctionId)?.name || "-";
  };

  const fetchAnimalSales = async (animalId: string) => {
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from("animal_sales")
        .select("id, client_id, sale_date, sale_value, sale_percentage, auction_id, auction_lot")
        .eq("animal_id", animalId)
        .order("sale_date", { ascending: true });
      if (error) throw error;

      const salesWithNames: AnimalSale[] = [];
      for (const sale of (data || [])) {
        const client = clients.find(c => c.id === sale.client_id);
        let clientName = client?.name;
        if (!clientName) {
          const { data: clientData } = await supabase.from("suppliers").select("name").eq("id", sale.client_id).single();
          clientName = clientData?.name || "Cliente não encontrado";
        }
        salesWithNames.push({
          ...sale,
          client_name: clientName,
        });
      }
      setAnimalSales(salesWithNames);
    } catch (error) {
      console.error("Error fetching animal sales:", error);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleOpenSaleModal = (animal: Animal) => {
    setSaleAnimal(animal);
    setSaleModalOpen(true);
  };

  const handleSaveSale = async () => {
    if (!saleAnimal || !saleClientId || !saleDate || !saleValue || !salePercentage) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    const percentage = parseFloat(salePercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0 e 100.", variant: "destructive" });
      return;
    }

    // Validate: owner percentages + sale percentage must not exceed 100%
    const ownersTotal = saleOwners.reduce((s, o) => s + o.percentage, 0);
    const buyerAlreadyInOwners = saleOwners.some(o => o.owner_id === saleClientId);
    const grandTotal = ownersTotal + (buyerAlreadyInOwners ? 0 : percentage);
    if (grandTotal > 100) {
      toast({ title: "Erro", description: `O somatório das participações dos proprietários (${ownersTotal.toFixed(2)}%) + venda (${percentage.toFixed(2)}%) ultrapassa 100%.`, variant: "destructive" });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("animal_sales").insert({
        animal_id: saleAnimal.id,
        client_id: saleClientId,
        sale_date: format(saleDate, "yyyy-MM-dd"),
        sale_value: parseFloat(saleValue),
        sale_percentage: percentage,
        data_prevista_entrega: saleExpectedDeliveryDate ? format(saleExpectedDeliveryDate, "yyyy-MM-dd") : null,
        created_by: userData.user?.id,
      });
      if (error) throw error;

      // Update all existing owner percentages as edited by the user
      for (const owner of saleOwners) {
        let existingRecord;
        if (owner.owner_type === "store" && owner.store_owner_id) {
          const { data } = await supabase
            .from("animal_owners")
            .select("id")
            .eq("animal_id", saleAnimal.id)
            .eq("store_owner_id", owner.store_owner_id)
            .eq("owner_type", "store")
            .maybeSingle();
          existingRecord = data;
        } else if (owner.owner_type === "third_party_farm" && owner.third_party_farm_id) {
          const { data } = await supabase
            .from("animal_owners")
            .select("id")
            .eq("animal_id", saleAnimal.id)
            .eq("third_party_farm_id", owner.third_party_farm_id)
            .eq("owner_type", "third_party_farm")
            .maybeSingle();
          existingRecord = data;
        } else {
          const { data } = await supabase
            .from("animal_owners")
            .select("id")
            .eq("animal_id", saleAnimal.id)
            .eq("owner_id", owner.owner_id)
            .maybeSingle();
          existingRecord = data;
        }

        if (existingRecord) {
          if (owner.percentage <= 0) {
            await supabase.from("animal_owners").delete().eq("id", existingRecord.id);
          } else {
            await supabase.from("animal_owners").update({ percentage: owner.percentage }).eq("id", existingRecord.id);
          }
        }
      }

      // Add/update buyer as owner with the sold percentage
      const buyerInOwners = saleOwners.find(o => o.owner_id === saleClientId);
      if (!buyerInOwners) {
        // Buyer was not in the owners list, add them
        const { data: existingOwner } = await supabase
          .from("animal_owners")
          .select("id, percentage")
          .eq("animal_id", saleAnimal.id)
          .eq("owner_id", saleClientId)
          .maybeSingle();

        if (existingOwner) {
          await supabase.from("animal_owners")
            .update({ percentage: Number(existingOwner.percentage) + percentage })
            .eq("id", existingOwner.id);
        } else {
          await supabase.from("animal_owners").insert({
            animal_id: saleAnimal.id,
            owner_id: saleClientId,
            percentage: percentage,
            created_by: userData.user?.id,
          } as any);
        }
      }

      toast({ title: "Sucesso", description: "Venda registrada com sucesso." });
      setSaleModalOpen(false);
      fetchAnimals();
    } catch (error) {
      console.error("Error saving sale:", error);
      toast({ title: "Erro", description: "Erro ao salvar venda.", variant: "destructive" });
    }
  };

  const handleOpenDeathModal = (animal: Animal) => {
    setDeathAnimal(animal);
    setDeathDate(null);
    setDeathReason("");
    setDeathModalOpen(true);
  };

  const handleSaveDeath = async () => {
    if (!deathAnimal || !deathDate || !deathReason.trim()) {
      toast({ title: "Erro", description: "Preencha a data e o motivo da morte.", variant: "destructive" });
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("animal_deaths").insert({
        animal_id: deathAnimal.id,
        death_date: format(deathDate, "yyyy-MM-dd"),
        reason: deathReason.trim(),
        created_by: userData.user?.id,
      } as any);
      if (error) throw error;

      await supabase.from("animals").update({ is_active: false }).eq("id", deathAnimal.id);

      toast({ title: "Sucesso", description: "Morte registrada. Animal inativado." });
      setDeathModalOpen(false);
      fetchAnimals();
    } catch (error) {
      console.error("Error saving death:", error);
      toast({ title: "Erro", description: "Erro ao registrar morte.", variant: "destructive" });
    }
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", animal?: Animal) => {
    setModalMode(mode);
    setActiveTab("dados");
    setAnimalWeighings([]);
    setFinancialRecords([]);

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode,
        name: "",
        registration: "",
        ear_tag: "",
        batch_id: "",
        sex: "",
        farm_entry_date: null,
        birth_date: null,
        first_weighing_date: null,
        first_weight: "",
        breed_id: "",
        category_id: "",
        auction_id: "",
        auction_lot: "",
        sire_id: "",
        dam_id: "",
        observations: "",
        photos: [],
        cover_photo: "",
        is_active: "ativo",
        farm: "",
        recipient_id: "",
      });
      setSelectedAnimal(null);
      setSelectedRecipient(null);
      setReproData({ aspiration_date: null, transfer_date: null, veterinarian_id: "", laboratory_id: "", ultrasound_date: null });
    } else if (animal) {
      setSelectedAnimal(animal);
      // Fetch weighings for this animal
      fetchAnimalWeighings(animal.id, animal.first_weighing_date, animal.first_weight);
      fetchAnimalFinancial(animal.id, animal.pregnancy_id);
      // Set recipient if exists
      if (animal.recipient_id) {
        const recipient = animals.find(a => a.id === animal.recipient_id);
        setSelectedRecipient(recipient || null);
      } else {
        setSelectedRecipient(null);
      }
      setFormData({
        code: animal.code,
        name: animal.name,
        registration: animal.registration || "",
        ear_tag: animal.ear_tag?.toString() || "",
        batch_id: animal.batch_id || "",
        sex: animal.sex,
        farm_entry_date: animal.farm_entry_date ? new Date(animal.farm_entry_date) : null,
        birth_date: animal.birth_date ? new Date(animal.birth_date) : null,
        first_weighing_date: animal.first_weighing_date ? new Date(animal.first_weighing_date) : null,
        first_weight: animal.first_weight?.toString() || "",
        breed_id: animal.breed_id || "",
        category_id: animal.category_id || "",
        auction_id: animal.auction_id || "",
        auction_lot: animal.auction_lot || "",
        sire_id: animal.sire_id || "",
        dam_id: animal.dam_id || "",
        observations: animal.observations || "",
        photos: animal.photos || [],
        cover_photo: animal.cover_photo || "",
        is_active: animal.is_active ? "ativo" : "inativo",
        farm: animal.farm_id && animal.farm_type ? `${animal.farm_type === "own" ? "own" : "third"}-${animal.farm_id}` : "",
        recipient_id: animal.recipient_id || "",
      });
      setReproData({
        aspiration_date: animal.aspiration_date ? new Date(animal.aspiration_date + "T12:00:00") : null,
        transfer_date: animal.transfer_date ? new Date(animal.transfer_date + "T12:00:00") : null,
        veterinarian_id: animal.veterinarian_id || "",
        laboratory_id: animal.laboratory_id || "",
        ultrasound_date: animal.ultrasound_date ? new Date(animal.ultrasound_date + "T12:00:00") : null,
      });
    }

    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAnimal(null);
    setActiveTab("dados");
  };

  const handleUploadPhoto = async (file: File, isCover: boolean = false) => {
    try {
      if (isCover) setUploadingCover(true);
      else setUploadingPhoto(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${userData.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("animal-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("animal-photos")
        .getPublicUrl(fileName);

      if (isCover) {
        setFormData(prev => ({ ...prev, cover_photo: urlData.publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, photos: [...prev.photos, urlData.publicUrl] }));
      }

      toast({ title: "Foto enviada com sucesso!" });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      if (isCover) setUploadingCover(false);
      else setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p !== photoUrl),
    }));
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: "Nome é obrigatório", variant: "destructive" });
        return;
      }

      if (!formData.sex) {
        toast({ title: "Sexo é obrigatório", variant: "destructive" });
        return;
      }

      if (formData.auction_id && !formData.auction_lot.trim()) {
        toast({ title: "Lote é obrigatório quando Leilão está selecionado", variant: "destructive" });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const storeId = await getUserStoreId(userData.user.id);
      if (!storeId) throw new Error("Store não encontrada");

      // Check for duplicate name
      const { data: existingAnimal } = await supabase
        .from("animals")
        .select("id")
        .eq("store_id", storeId)
        .eq("name", formData.name.trim())
        .eq("is_active", true)
        .neq("id", selectedAnimal?.id || "00000000-0000-0000-0000-000000000000")
        .single();

      if (existingAnimal) {
        toast({ title: "Já existe um animal com este nome", variant: "destructive" });
        return;
      }

      // Parse farm value (format: "own-uuid" or "third-uuid")
      let farmId: string | null = null;
      let farmType: string | null = null;
      if (formData.farm) {
        const dashIndex = formData.farm.indexOf("-");
        if (dashIndex > 0) {
          const type = formData.farm.substring(0, dashIndex);
          farmId = formData.farm.substring(dashIndex + 1);
          farmType = type === "own" ? "own" : "third_party";
        }
      }

      const animalData = {
        name: formData.name.trim(),
        registration: formData.registration || null,
        ear_tag: formData.ear_tag ? parseInt(formData.ear_tag) : null,
        batch_id: formData.batch_id || null,
        sex: formData.sex,
        farm_entry_date: formData.farm_entry_date ? format(formData.farm_entry_date, "yyyy-MM-dd") : null,
        birth_date: formData.birth_date ? format(formData.birth_date, "yyyy-MM-dd") : null,
        first_weighing_date: formData.first_weighing_date ? format(formData.first_weighing_date, "yyyy-MM-dd") : null,
        first_weight: formData.first_weight ? parseFloat(formData.first_weight) : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        observations: formData.observations || null,
        photos: formData.photos,
        cover_photo: formData.cover_photo || null,
        store_id: storeId,
        is_active: formData.is_active === "ativo",
        farm_id: farmId,
        farm_type: farmType,
        recipient_id: formData.recipient_id || null,
        aspiration_date: reproData.aspiration_date ? format(reproData.aspiration_date, "yyyy-MM-dd") : null,
        transfer_date: reproData.transfer_date ? format(reproData.transfer_date, "yyyy-MM-dd") : null,
        veterinarian_id: reproData.veterinarian_id || null,
        laboratory_id: reproData.laboratory_id || null,
        ultrasound_date: reproData.ultrasound_date ? format(reproData.ultrasound_date, "yyyy-MM-dd") : null,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("animals").insert({
          ...animalData,
          code: formData.code,
        });
        if (error) throw error;
        toast({ title: "Animal cadastrado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("animals")
          .update(animalData)
          .eq("id", selectedAnimal!.id);
        if (error) throw error;
        toast({ title: "Animal atualizado com sucesso!" });
      }

      handleCloseModal();
      fetchAnimals();
    } catch (error: any) {
      console.error("Error saving animal:", error);
      toast({ title: error.message || "Erro ao salvar animal", variant: "destructive" });
    }
  };

  const openDeleteDialog = (animal: Animal) => {
    setAnimalToDelete(animal);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!animalToDelete) return;

    try {
      const { error } = await supabase
        .from("animals")
        .update({ is_active: false })
        .eq("id", animalToDelete.id);

      if (error) throw error;

      toast({ title: "Animal excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setAnimalToDelete(null);
      fetchAnimals();
    } catch (error) {
      console.error("Error deleting animal:", error);
      toast({ title: "Erro ao excluir animal", variant: "destructive" });
    }
  };

  const DatePickerFieldInner = ({
    label,
    value,
    onChange,
    disabled = false,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | undefined) => void;
    disabled?: boolean;
  }) => {
    const [dateText, setDateText] = useState(value ? format(value, "dd/MM/yyyy") : "");

    useEffect(() => {
      setDateText(value ? format(value, "dd/MM/yyyy") : "");
    }, [value]);

    const handleDateTextChange = (text: string) => {
      const digits = text.replace(/\D/g, "").substring(0, 8);
      let formatted = "";
      if (digits.length > 0) formatted = digits.substring(0, 2);
      if (digits.length > 2) formatted += "/" + digits.substring(2, 4);
      if (digits.length > 4) formatted += "/" + digits.substring(4, 8);
      setDateText(formatted);

      if (digits.length === 8) {
        const d = parse(formatted, "dd/MM/yyyy", new Date());
        if (isValid(d)) {
          onChange(d);
        }
      } else if (digits.length === 0) {
        onChange(undefined);
      }
    };

    const handleCalendarSelect = (date: Date | undefined) => {
      onChange(date);
      setDateText(date ? format(date, "dd/MM/yyyy") : "");
    };

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            placeholder="dd/MM/yyyy"
            value={dateText}
            onChange={(e) => handleDateTextChange(e.target.value)}
            disabled={disabled}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" disabled={disabled} className="shrink-0">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
              <Calendar
                mode="single"
                selected={value || undefined}
                onSelect={handleCalendarSelect}
                initialFocus
                className="pointer-events-auto"
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  };

  const DatePickerField = DatePickerFieldInner;

  const isReadOnly = modalMode === "view";
  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    return farmLookup.get(`${farmType}-${farmId}`) || "-";
  };

  const getAllocationTypeLabel = (type: string) => {
    switch (type) {
      case "animal": return "Animal";
      case "pregnancy": return "Prenhez";
      case "embryo_transfer": return "Pós Transf. Emb.";
      case "aspiration": return "Aspiração";
      case "aspiration_rateio": return "Rateio Aspiração";
      case "te_rateio": return "Rateio Pós TE";
      case "pregnancy_rateio": return "Rateio Prenhez";
      default: return type;
    }
  };

  const getFilteredFinancialRecords = () => {
    if (financialViewMode === "pagos") {
      return financialRecords.filter(r => r.paid_amount > 0 || r.status === "paid").map(r => {
        const effectivePaid = r.paid_amount > 0 ? r.paid_amount : (r.status === "paid" ? r.item_total_price : 0);
        return { ...r, paid_amount: effectivePaid };
      });
    }
    return financialRecords;
  };

  const generateFinancialPDF = async (tipo: "resumido" | "detalhado") => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      
      const doc = new jsPDF();
      const animalName = selectedAnimal?.name || "Animal";
      const animalCode = selectedAnimal?.code || "";

      doc.setFontSize(16);
      doc.text(`Relatório Financeiro - ${animalName} (Cód: ${animalCode})`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 28);
      doc.text(`Modo: ${financialViewMode === "pagos" ? "Pagos até Hoje" : "Geral"}`, 14, 34);

      const records = getFilteredFinancialRecords();
      const despesas = records.filter(r => r.record_type === 'expense');
      const receitas = records.filter(r => r.record_type === 'revenue');
      const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
      const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
      const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
      const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
      const saldo = financialViewMode === "pagos" ? totalPagoReceitas - totalPagoDespesas : totalReceitas - totalDespesas;

      if (tipo === "resumido") {
        let startY = 42;
        if (despesas.length > 0) {
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Despesas", 14, startY); startY += 6;
          autoTable(doc, { startY, head: [["Número", "Fornecedor", "Tipo", "Vlr Total", ...(financialViewMode === "pagos" ? ["Pago"] : []), "Vencimento", "Pagamento", "Status"]], body: despesas.map(r => [r.is_rateio ? "" : (r.document_number || "-"), r.is_rateio ? (r.rateio_label || "") : (r.supplier_name || "-"), getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente")]), theme: "grid", headStyles: { fillColor: [66, 66, 66] } });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
        if (receitas.length > 0) {
          if (startY > 250) { doc.addPage(); startY = 20; }
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Receitas", 14, startY); startY += 6;
          autoTable(doc, { startY, head: [["Número", "Credor", "Tipo", "Vlr Total", ...(financialViewMode === "pagos" ? ["Recebido"] : []), "Vencimento", "Pagamento", "Status"]], body: receitas.map(r => [r.is_rateio ? "" : (r.document_number || "-"), r.is_rateio ? (r.rateio_label || "") : (r.creditor_name || "-"), getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente")]), theme: "grid", headStyles: { fillColor: [66, 66, 66] } });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
        if (startY > 260) { doc.addPage(); startY = 20; }
        const summaryHead = financialViewMode === "pagos" ? [["Total Desp. Pagas", "Total Rec. Recebidas", "Saldo"]] : [["Total Despesas", "Total Receitas", "Saldo"]];
        const summaryBody = financialViewMode === "pagos"
          ? [[totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]]
          : [[totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]];
        autoTable(doc, { startY, head: summaryHead, body: summaryBody, theme: "grid", headStyles: { fillColor: [100, 100, 100] }, bodyStyles: { fontStyle: "bold" } });
      } else {
        const expenseAPIds = [...new Set(despesas.filter(r => !r.is_rateio).map(r => r.account_payable_id).filter(Boolean))];
        const { data: allItems } = expenseAPIds.length > 0 ? await supabase.from("accounts_payable_items").select("*, products(name)").in("account_payable_id", expenseAPIds) : { data: [] };
        const itemsByAP = new Map<string, any[]>();
        (allItems || []).forEach((item: any) => { const list = itemsByAP.get(item.account_payable_id) || []; list.push(item); itemsByAP.set(item.account_payable_id, list); });

        let currentY = 42;
        if (despesas.length > 0) {
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Despesas", 14, currentY); currentY += 8;
          despesas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. ${record.is_rateio ? (record.rateio_label || "Rateio") : `Número: ${record.document_number || "-"} | Fornecedor: ${record.supplier_name || "-"}`}`, 14, currentY); currentY += 6;
            if (!record.is_rateio) {
              doc.setFontSize(9); doc.setFont("helvetica", "normal");
              doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY); currentY += 4;
            }
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Pago: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
            if (!record.is_rateio) {
              const items = itemsByAP.get(record.account_payable_id) || [];
              if (items.length > 0) {
                autoTable(doc, { startY: currentY, head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]], body: items.map((it: any) => [it.products?.name || "-", it.quantity, it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]), theme: "grid", headStyles: { fillColor: [100, 100, 100], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 20, right: 20 } });
                currentY = (doc as any).lastAutoTable.finalY + 8;
              } else { currentY += 4; }
            }
          });
        }
        if (receitas.length > 0) {
          if (currentY > 250) { doc.addPage(); currentY = 20; }
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Receitas", 14, currentY); currentY += 8;
          receitas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. ${record.is_rateio ? (record.rateio_label || "Rateio") : `Número: ${record.document_number || "-"} | Credor: ${record.creditor_name || "-"}`}`, 14, currentY); currentY += 6;
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Recebido: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
          });
        }
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(`Total Despesas: ${totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | Total Receitas: ${totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
      }

      doc.save(`financeiro_${animalName.replace(/\s+/g, "_")}_${tipo}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const generateFinancialExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const records = getFilteredFinancialRecords();
      const despesas = records.filter(r => r.record_type === 'expense');
      const receitas = records.filter(r => r.record_type === 'revenue');

      const despData = despesas.map(r => ({
        "Número": r.is_rateio ? "" : (r.document_number || "-"),
        "Fornecedor": r.is_rateio ? (r.rateio_label || "") : (r.supplier_name || "-"),
        "Tipo Alocação": getAllocationTypeLabel(r.allocation_type),
        "Valor Total": r.item_total_price,
        ...(financialViewMode === "pagos" ? { "Pago": r.paid_amount } : {}),
        "Vencimento": r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"),
        "Pagamento": r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"),
        "Status": r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente"),
      }));

      const recData = receitas.map(r => ({
        "Número": r.is_rateio ? "" : (r.document_number || "-"),
        "Credor": r.is_rateio ? (r.rateio_label || "") : (r.creditor_name || "-"),
        "Tipo Alocação": getAllocationTypeLabel(r.allocation_type),
        "Valor Total": r.item_total_price,
        ...(financialViewMode === "pagos" ? { "Recebido": r.paid_amount } : {}),
        "Vencimento": r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"),
        "Pagamento": r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"),
        "Status": r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente"),
      }));

      const wb = XLSX.utils.book_new();
      if (despData.length > 0) { const ws = XLSX.utils.json_to_sheet(despData); XLSX.utils.book_append_sheet(wb, ws, "Despesas"); }
      if (recData.length > 0) { const ws = XLSX.utils.json_to_sheet(recData); XLSX.utils.book_append_sheet(wb, ws, "Receitas"); }

      const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
      const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
      const resumo = [{ "Tipo": "Total Despesas", "Valor": totalDespesas }, { "Tipo": "Total Receitas", "Valor": totalReceitas }, { "Tipo": "Saldo", "Valor": totalReceitas - totalDespesas }];
      const wsResumo = XLSX.utils.json_to_sheet(resumo);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const animalName = selectedAnimal?.name || "Animal";
      XLSX.writeFile(wb, `financeiro_${animalName.replace(/\s+/g, "_")}.xlsx`);
      toast({ title: "Excel gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({ title: "Erro ao gerar Excel", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card/80 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão de Animais</h1>
              <p className="text-sm text-muted-foreground">Cadastro e gestão de animais</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal("create")} className="h-10 gap-2 rounded-lg px-4 shadow-sm">
            <Plus className="h-4 w-4" />
            Cadastrar Animal
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Listagem de animais</p>
            <p className="text-xs text-muted-foreground">
              Consulte e acompanhe os cadastros com uma visualização mais objetiva.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 gap-2 rounded-lg border-border/70 bg-background/90 px-3"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? "Ocultar Filtros" : "Exibir Filtros"}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showFilters && (
        <div className="mb-5 rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Filtros</p>
              <p className="text-xs text-muted-foreground">Refine a listagem sem alterar a navegação principal da tela.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {/* Name filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome</Label>
              <Input
                className="h-10 rounded-lg"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                placeholder="Buscar por nome..."
              />
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Farm filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Fazenda</Label>
              <Select
                value={filters.farm || "_all"}
                onValueChange={(value) => setFilters({ ...filters, farm: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar fazenda" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {ownFarms.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Fazendas Próprias</div>
                      {ownFarms.map((farm) => (
                        <SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>
                          {farm.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {ownFarms.length > 0 && thirdPartyFarms.length > 0 && (
                    <div className="my-1 border-t border-border" />
                  )}
                  {thirdPartyFarms.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Fazendas Terceiras</div>
                      {thirdPartyFarms.map((farm) => (
                        <SelectItem key={`third-${farm.id}`} value={`third-${farm.id}`}>
                          {farm.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sex filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Sexo</Label>
              <Select
                value={filters.sex || "_all"}
                onValueChange={(value) => setFilters({ ...filters, sex: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar sexo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Breed filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Raça</Label>
              <Select
                value={filters.breed_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, breed_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar raça" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {breeds.map((breed) => (
                    <SelectItem key={breed.id} value={breed.id}>
                      {breed.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dam filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome Mãe</Label>
              <Select
                value={filters.dam_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, dam_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar mãe" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {dams.map((dam) => (
                    <SelectItem key={dam.id} value={dam.id}>
                      {dam.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sire filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome Pai</Label>
              <Select
                value={filters.sire_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, sire_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar pai" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  {sires.map((sire) => (
                    <SelectItem key={sire.id} value={sire.id}>
                      {sire.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auction filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Leilão</Label>
              <Select
                value={filters.auction_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, auction_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar leilão" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  {auctions.map((auction) => (
                    <SelectItem key={auction.id} value={auction.id}>
                      {auction.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
              <Select
                value={filters.category_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, category_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {animalCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Birth date start */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data Nasc. Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start rounded-lg text-left font-normal",
                      !filters.birth_date_start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.birth_date_start
                      ? format(filters.birth_date_start, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.birth_date_start || undefined}
                    onSelect={(date) => setFilters({ ...filters, birth_date_start: date || null })}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Birth date end */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data Nasc. Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start rounded-lg text-left font-normal",
                      !filters.birth_date_end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.birth_date_end
                      ? format(filters.birth_date_end, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.birth_date_end || undefined}
                    onSelect={(date) => setFilters({ ...filters, birth_date_end: date || null })}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear filters button */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              className="h-9 rounded-lg px-3"
              onClick={() => setFilters({
                name: "",
                status: "ambos",
                farm: "",
                sex: "",
                breed_id: "",
                dam_id: "",
                sire_id: "",
                auction_id: "",
                category_id: "",
                birth_date_start: null,
                birth_date_end: null,
              })}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
        )}

        {(() => {
          // Apply filters
          const filteredAnimals = listedAnimals.filter((animal) => {
            // Name filter
            if (filters.name && !animal.name.toLowerCase().includes(filters.name.toLowerCase())) {
              return false;
            }
            // Status filter
            const isSold = soldAnimalIds.has(animal.id);
            if (filters.status === "ativo" && (!animal.is_active || isSold)) return false;
            if (filters.status === "inativo" && (animal.is_active || isSold)) return false;
            if (filters.status === "vendido" && !isSold) return false;
            // Farm filter
            if (filters.farm) {
              const dashIndex = filters.farm.indexOf("-");
              if (dashIndex > 0) {
                const filterType = filters.farm.substring(0, dashIndex);
                const filterId = filters.farm.substring(dashIndex + 1);
                const animalFarmType = filterType === "own" ? "own" : "third_party";
                if (animal.farm_id !== filterId || animal.farm_type !== animalFarmType) {
                  return false;
                }
              }
            }
            // Sex filter
            if (filters.sex && animal.sex !== filters.sex) return false;
            // Breed filter
            if (filters.breed_id && animal.breed_id !== filters.breed_id) return false;
            // Dam filter
            if (filters.dam_id && animal.dam_id !== filters.dam_id) return false;
            // Sire filter
            if (filters.sire_id && animal.sire_id !== filters.sire_id) return false;
            // Auction filter
            if (filters.auction_id && animal.auction_id !== filters.auction_id) return false;
            // Category filter
            if (filters.category_id && animal.category_id !== filters.category_id) return false;
            // Birth date range filter
            if (filters.birth_date_start && animal.birth_date) {
              const birthDate = new Date(animal.birth_date);
              if (birthDate < filters.birth_date_start) return false;
            }
            if (filters.birth_date_end && animal.birth_date) {
              const birthDate = new Date(animal.birth_date);
              if (birthDate > filters.birth_date_end) return false;
            }
            return true;
          });

          if (loading) {
            return <p className="text-center text-muted-foreground">Carregando...</p>;
          }
          
          if (listedAnimals.length === 0) {
            return <p className="text-center text-muted-foreground">Nenhum animal cadastrado.</p>;
          }
          
          if (filteredAnimals.length === 0) {
            return <p className="text-center text-muted-foreground">Nenhum animal encontrado com os filtros selecionados.</p>;
          }

          const renderAnimalPhoto = (animal: (typeof filteredAnimals)[number]) =>
            animal.cover_photo ? (
              <img
                src={animal.cover_photo}
                alt={animal.name}
                className="h-11 w-11 rounded-lg border border-border/60 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/35">
                <Image className="h-4 w-4 text-muted-foreground" />
              </div>
            );

          const renderAnimalStatusBadge = (animal: (typeof filteredAnimals)[number]) => {
            const isSold = soldAnimalIds.has(animal.id);
            if (isSold) {
              return (
                <Badge className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">
                  Vendido
                </Badge>
              );
            }
            return (
              <Badge className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold hover:bg-transparent",
                animal.is_active 
                  ? "border-green-200 bg-green-50 text-green-700" 
                  : "border-red-200 bg-red-50 text-red-700"
              )}>
                {animal.is_active ? "Ativo" : "Inativo"}
              </Badge>
            );
          };

          const renderAnimalActions = (animal: (typeof filteredAnimals)[number]) => (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => handleOpenModal("view", animal)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenModal("edit", animal)}>
                    <Pencil className="h-4 w-4 mr-2" />Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDeleteDialog(animal)}>
                    <Trash2 className="h-4 w-4 mr-2" />Excluir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenSaleModal(animal)}>
                    <DollarSign className="h-4 w-4 mr-2" />Venda
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenDeathModal(animal)}>
                    <Skull className="h-4 w-4 mr-2" />Informar Morte
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );

          return (
          <>
          <div className="hidden md:block overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <Table className="min-w-[860px] table-sticky-first table-sticky-last">
              <TableHeader className="bg-muted/35 [&_tr]:border-border/70">
                <TableRow>
                  <TableHead className="h-11 w-20 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Código</TableHead>
                  <TableHead className="h-11 w-20 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Foto</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Nome</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fazenda</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sexo</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Raça</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimals.map((animal) => (
                  <TableRow
                    key={animal.id}
                    className={cn(
                      "border-border/60 hover:bg-muted/25",
                      !animal.is_active && "opacity-70"
                    )}
                  >
                    <TableCell className="px-4 py-3 text-sm font-semibold text-foreground">{animal.code}</TableCell>
                    <TableCell className="px-4 py-3">
                      {renderAnimalPhoto(animal)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="min-w-[180px]">
                        <p className="truncate font-medium text-foreground">{animal.name}</p>
                        {animal.registration && (
                          <p className="truncate text-xs text-muted-foreground">{animal.registration}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      <span className="block max-w-[220px] truncate">{getFarmName(animal.farm_id, animal.farm_type)}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-foreground">{animal.sex === "macho" ? "Macho" : "Fêmea"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {breeds.find((b) => b.id === animal.breed_id)?.name || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {renderAnimalStatusBadge(animal)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {renderAnimalActions(animal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-3">
            {filteredAnimals.map((animal) => (
              <div key={animal.id} className={cn(!animal.is_active && "opacity-70")}>
                <MobileReportCard
                  title={animal.name}
                  subtitle={animal.registration || undefined}
                  badge={renderAnimalStatusBadge(animal)}
                  titleAside={renderAnimalPhoto(animal)}
                  summaryFields={[
                    { label: "Código", value: animal.code },
                    { label: "Fazenda", value: getFarmName(animal.farm_id, animal.farm_type) },
                    { label: "Sexo", value: animal.sex === "macho" ? "Macho" : "Fêmea" },
                    { label: "Raça", value: breeds.find((b) => b.id === animal.breed_id)?.name || "-" },
                  ]}
                  actions={renderAnimalActions(animal)}
                />
              </div>
            ))}
          </div>
          </>
          );
        })()}
      </main>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create"
                ? "Cadastrar Animal"
                : modalMode === "edit"
                ? "Editar Animal"
                : "Visualizar Animal"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val);
            if (val === "proprietarios" && selectedAnimal) {
              fetchClients();
              fetchAnimalSales(selectedAnimal.id);
            }
            if (val === "leilao" && selectedAnimal) {
              fetchAnimalSales(selectedAnimal.id);
            }
          }} className="w-full">
            <TabsList className="flex w-full lg:grid lg:grid-cols-8">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="reproducao" disabled={modalMode === "create"}>Dados Reprodução</TabsTrigger>
              <TabsTrigger value="pesagem" disabled={modalMode === "create"}>Pesagem</TabsTrigger>
              <TabsTrigger value="observacoes">Observações e Fotos</TabsTrigger>
              <TabsTrigger value="financeiro" disabled={modalMode === "create"}>Financeiro</TabsTrigger>
              <TabsTrigger value="leilao" disabled={modalMode === "create"}>Leilão</TabsTrigger>
              <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
            </TabsList>

            {/* Tab: Dados Cadastrais */}
            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Nome do animal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registro</Label>
                  <Input
                    value={formData.registration}
                    onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número de registro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brinco</Label>
                  <Input
                    type="number"
                    value={formData.ear_tag}
                    onChange={(e) => setFormData({ ...formData, ear_tag: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número do brinco"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lote</Label>
                  <Select
                    value={formData.batch_id}
                    onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar lote" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sexo *</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({ ...formData, sex: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar sexo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="femea">Fêmea</SelectItem>
                      <SelectItem value="macho">Macho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fazenda</Label>
                  <Select
                    value={formData.farm || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, farm: value === "_none" ? "" : value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar fazenda" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {ownFarms.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Fazendas Próprias</div>
                          {ownFarms.map((farm) => (
                            <SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {ownFarms.length > 0 && thirdPartyFarms.length > 0 && (
                        <div className="my-1 border-t border-border" />
                      )}
                      {thirdPartyFarms.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Fazendas Terceiras</div>
                          {thirdPartyFarms.map((farm) => (
                            <SelectItem key={`third-${farm.id}`} value={`third-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data Entrada na Fazenda"
                  value={formData.farm_entry_date}
                  onChange={(date) => setFormData({ ...formData, farm_entry_date: date || null })}
                  disabled={isReadOnly}
                />
                <DatePickerField
                  label="Data Nascimento"
                  value={formData.birth_date}
                  onChange={(date) => setFormData({ ...formData, birth_date: date || null })}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data Primeira Pesagem"
                  value={formData.first_weighing_date}
                  onChange={(date) => setFormData({ ...formData, first_weighing_date: date || null })}
                  disabled={isReadOnly}
                />
                <div className="space-y-2">
                  <Label>Primeiro Peso (kg)</Label>
                  <Input
                    type="number"
                    value={formData.first_weight}
                    onChange={(e) => setFormData({ ...formData, first_weight: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Peso em kg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Raça</Label>
                  <Select
                    value={formData.breed_id}
                    onValueChange={(value) => setFormData({ ...formData, breed_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar raça" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {breeds.map((breed) => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Leilão</Label>
                  <div className="flex gap-1">
                    <Select
                      value={formData.auction_id}
                      onValueChange={(value) => setFormData({ ...formData, auction_id: value })}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar leilão" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {auctions.map((auction) => (
                          <SelectItem key={auction.id} value={auction.id}>
                            {auction.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setCreateLeilaoOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lote (Leilão) {formData.auction_id && "*"}</Label>
                  <Input
                    value={formData.auction_lot}
                    onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número do lote no leilão"
                  />
                </div>
              </div>

              {/* Receptora field */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receptora</Label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedRecipient ? `${selectedRecipient.code} - ${selectedRecipient.name}` : ""}
                      placeholder="Selecione uma receptora..."
                      disabled
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setRecipientSearchOpen(true)}
                      disabled={isReadOnly}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    {selectedRecipient && !isReadOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRecipient(null);
                          setFormData({ ...formData, recipient_id: "" });
                        }}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Genealogia */}
            <TabsContent value="genealogia" className="space-y-6 mt-4">
              {/* Pais */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Pais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Reprodutor (Pai)</Label>
                    <Select
                      value={formData.sire_id}
                      onValueChange={(value) => setFormData({ ...formData, sire_id: value })}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar reprodutor" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {sires.map((sire) => (
                          <SelectItem key={sire.id} value={sire.id}>
                            {sire.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Matriz (Mãe)</Label>
                    <Select
                      value={formData.dam_id}
                      onValueChange={(value) => setFormData({ ...formData, dam_id: value })}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar matriz" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {dams.map((dam) => (
                          <SelectItem key={dam.id} value={dam.id}>
                            {dam.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Avós - exibição somente leitura */}
              {(formData.sire_id || formData.dam_id) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Avós (somente exibição)</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Avós Paternos */}
                    {formData.sire_id && (() => {
                      const selectedSire = sires.find(s => s.id === formData.sire_id);
                      const sireGrandsire = selectedSire?.sire_id ? [...sires, ...dams].find(a => a.id === selectedSire.sire_id) : null;
                      const sireGranddam = selectedSire?.dam_id ? [...sires, ...dams].find(a => a.id === selectedSire.dam_id) : null;
                      
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Paternos (Pais do Reprodutor)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avô:</Label>
                              <span className="text-sm">{sireGrandsire?.name || "Não informado"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avó:</Label>
                              <span className="text-sm">{sireGranddam?.name || "Não informada"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Avós Maternos */}
                    {formData.dam_id && (() => {
                      const selectedDam = dams.find(d => d.id === formData.dam_id);
                      const damGrandsire = selectedDam?.sire_id ? [...sires, ...dams].find(a => a.id === selectedDam.sire_id) : null;
                      const damGranddam = selectedDam?.dam_id ? [...sires, ...dams].find(a => a.id === selectedDam.dam_id) : null;
                      
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Maternos (Pais da Matriz)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avô:</Label>
                              <span className="text-sm">{damGrandsire?.name || "Não informado"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avó:</Label>
                              <span className="text-sm">{damGranddam?.name || "Não informada"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Observações e Fotos */}
            <TabsContent value="observacoes" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Observações sobre o animal"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                {formData.cover_photo ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.cover_photo}
                      alt="Cover"
                      className="w-40 h-40 object-cover rounded-t border-t border-l border-r"
                    />
                    <div className="w-40 bg-primary text-primary-foreground text-center text-sm py-1 rounded-b font-medium">
                      Foto de Capa
                    </div>
                    {!isReadOnly && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-10 md:h-6 w-10 md:w-6"
                        onClick={() => setPhotoToDelete({ url: formData.cover_photo, isCover: true })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : !isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="cover-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPhoto(file, true);
                      }}
                    />
                    <label htmlFor="cover-upload">
                      <Button variant="outline" asChild disabled={uploadingCover}>
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingCover ? "Enviando..." : "Adicionar Foto de Capa"}
                        </span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma foto de capa</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fotos do Animal</Label>
                <div className="flex flex-wrap gap-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-24 h-24 object-cover rounded border"
                      />
                      {!isReadOnly && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-5 w-5"
                          onClick={() => setPhotoToDelete({ url: photo, isCover: false })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="photos-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadPhoto(file, false);
                        }}
                      />
                      <label htmlFor="photos-upload">
                        <div className="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                          {uploadingPhoto ? (
                            <span className="text-xs text-muted-foreground">Enviando...</span>
                          ) : (
                            <Plus className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Dados Reprodução */}
            <TabsContent value="reproducao" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data da Aspiração"
                  value={reproData.aspiration_date}
                  onChange={(date) => setReproData({ ...reproData, aspiration_date: date || null })}
                  disabled={isReadOnly}
                />
                <DatePickerField
                  label="Data da Transferência"
                  value={reproData.transfer_date}
                  onChange={(date) => setReproData({ ...reproData, transfer_date: date || null })}
                  disabled={isReadOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veterinário</Label>
                  <Select
                    value={reproData.veterinarian_id}
                    onValueChange={(value) => setReproData({ ...reproData, veterinarian_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar veterinário" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {veterinarians.map((vet) => (
                        <SelectItem key={vet.id} value={vet.id}>
                          {vet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Laboratório</Label>
                  <Select
                    value={reproData.laboratory_id}
                    onValueChange={(value) => setReproData({ ...reproData, laboratory_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar laboratório" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {laboratories.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data do Ultrassom"
                  value={reproData.ultrasound_date}
                  onChange={(date) => setReproData({ ...reproData, ultrasound_date: date || null })}
                  disabled={isReadOnly}
                />
              </div>

              {/* Histórico / Reproduções vinculadas a este animal */}
              <ReproducoesVinculadas animalId={selectedAnimal?.id ?? null} />
            </TabsContent>

            {/* Tab: Pesagem */}
            <TabsContent value="pesagem" className="space-y-4 mt-4">
              {loadingWeighings ? (
                <p className="text-center text-muted-foreground py-8">Carregando pesagens...</p>
              ) : animalWeighings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma pesagem registrada para este animal.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Peso (kg)</TableHead>
                        <TableHead className="text-right">GMD (kg/dia)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalWeighings.map((weighing, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {format(new Date(weighing.date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {weighing.weight.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {weighing.gmd !== null ? (
                              <span className={cn(
                                "font-medium",
                                weighing.gmd >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {weighing.gmd >= 0 ? "+" : ""}{weighing.gmd.toFixed(3)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab: Financeiro */}
            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financeiro
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={financialViewMode === "geral" ? "default" : "outline"} size="sm" onClick={() => setFinancialViewMode("geral")}>Visualizar Geral</Button>
                  <Button variant={financialViewMode === "pagos" ? "default" : "outline"} size="sm" onClick={() => setFinancialViewMode("pagos")}>Pagos até Hoje</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={financialRecords.length === 0}>
                        <Download className="h-4 w-4 mr-1" />Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => generateFinancialPDF("resumido")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateFinancialPDF("detalhado")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateFinancialExcel()}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {loadingFinancial ? (
                <p className="text-center text-muted-foreground py-8">Carregando dados financeiros...</p>
              ) : (() => {
                const filteredRecords = getFilteredFinancialRecords();
                const despesas = filteredRecords.filter(r => r.record_type === 'expense');
                const receitas = filteredRecords.filter(r => r.record_type === 'revenue');
                const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
                const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
                const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
                const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
                const saldo = (financialViewMode === "pagos" ? totalPagoReceitas : totalReceitas) - (financialViewMode === "pagos" ? totalPagoDespesas : totalDespesas);

                const renderFinTable = (records: typeof filteredRecords, label: string) => (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm border-b pb-0.5">{label}</h4>
                    {records.length === 0 ? (
                      <p className="text-center text-muted-foreground py-2 text-sm">Nenhum registro.</p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                        <Table className="table-sticky-first">
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="h-8">
                              <TableHead className="py-1 text-xs w-[8%]">Número</TableHead>
                              <TableHead className="py-1 text-xs w-[22%] max-w-[180px]">{label === "Despesas" ? "Fornecedor" : "Credor"}</TableHead>
                              <TableHead className="py-1 text-xs w-[14%]">Tipo Alocação</TableHead>
                              <TableHead className="py-1 text-xs text-right w-[12%]">Vlr Total</TableHead>
                              {financialViewMode === "pagos" && (
                                <>
                                  <TableHead className="py-1 text-xs text-right w-[10%]">Pago</TableHead>
                                  <TableHead className="py-1 text-xs text-right w-[10%]">Pendente</TableHead>
                                </>
                              )}
                              <TableHead className="py-1 text-xs w-[12%]">{financialViewMode === "pagos" ? "Venc." : "Vencimento"}</TableHead>
                              <TableHead className="py-1 text-xs w-[12%]">{financialViewMode === "pagos" ? "Pag." : "Pagamento"}</TableHead>
                              <TableHead className="py-1 text-xs w-[10%]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {records.map((record) => {
                              const valorPendente = record.item_total_price - record.paid_amount;
                              const isRateio = record.is_rateio;
                              const rateioColor = record.allocation_type === "aspiration_rateio" ? "bg-orange-50" : record.allocation_type === "pregnancy_rateio" ? "bg-purple-50" : "bg-blue-50";
                              return (
                              <TableRow key={record.id} className={cn("h-7", isRateio ? rateioColor : "")}>
                                <TableCell className="py-1 text-sm">{isRateio ? "" : (record.document_number || "-")}</TableCell>
                                <TableCell className={cn("py-1 text-sm max-w-[180px] truncate", isRateio ? (record.allocation_type === "aspiration_rateio" ? "font-medium text-orange-700" : record.allocation_type === "pregnancy_rateio" ? "font-medium text-purple-700" : "font-medium text-blue-700") : "")}>
                                  {isRateio ? (record.rateio_label || "Rateio") : (record.supplier_name || record.creditor_name || "-")}
                                </TableCell>
                                <TableCell className="py-1 text-sm">
                                  {isRateio ? (
                                    <Badge variant="outline" className={cn("text-[12px] px-1.5 py-0", record.allocation_type === "aspiration_rateio" ? "border-orange-300 text-orange-700" : record.allocation_type === "pregnancy_rateio" ? "border-purple-300 text-purple-700" : "border-blue-300 text-blue-700")}>
                                      {getAllocationTypeLabel(record.allocation_type)}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[12px] px-1.5 py-0">{getAllocationTypeLabel(record.allocation_type)}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-1 text-sm text-right font-medium">
                                  {record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </TableCell>
                                {financialViewMode === "pagos" && (
                                  <>
                                    <TableCell className="py-1 text-sm text-right font-medium text-primary">
                                      {record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </TableCell>
                                    <TableCell className="py-1 text-sm text-right font-medium text-destructive">
                                      {!isRateio && valorPendente > 0 ? valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell className="py-1 text-sm">{isRateio ? "" : (record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-")}</TableCell>
                                <TableCell className="py-1 text-sm">{isRateio ? "" : (record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-")}</TableCell>
                                <TableCell className="py-1 text-sm">{isRateio ? "" : (
                                  <Badge variant={record.status === "paid" ? "default" : "secondary"} className="text-[12px] px-1.5 py-0">
                                    {record.status === "paid" ? "Pago" : record.status === "pending" ? "Pendente" : record.status === "partial" ? "Parcial" : record.status}
                                  </Badge>
                                )}</TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );

                return (
                  <>
                    {renderFinTable(despesas, "Despesas")}
                    {renderFinTable(receitas, "Receitas")}

                    <div className="border rounded-lg p-4 bg-muted/30">
                      {financialViewMode === "pagos" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Despesas Pagas</p>
                            <p className="text-lg font-semibold text-destructive">
                              {totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Receitas Recebidas</p>
                            <p className="text-lg font-semibold text-blue-600">
                              {totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Saldo</p>
                            <p className={cn("text-lg font-semibold", saldo >= 0 ? "text-blue-600" : "text-destructive")}>
                              {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Receitas</p>
                            <p className="text-lg font-semibold text-primary">
                              {totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Despesas</p>
                            <p className="text-lg font-semibold text-destructive">
                              {totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Saldo</p>
                            <p className={cn("text-lg font-semibold", saldo >= 0 ? "text-primary" : "text-destructive")}>
                              {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Bloco: Financeiro Reprodução (abaixo do financeiro direto do animal) */}
              <FinanceiroReproducao
                animalId={selectedAnimal?.id ?? null}
                viewMode={financialViewMode}
                onViewModeChange={setFinancialViewMode}
                animalSaldo={animalDirectSaldo}
              />
            </TabsContent>

            {/* Tab: Leilão */}
            <TabsContent value="leilao" className="space-y-6 mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg border-b pb-2">Leilão de Compra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Leilão</Label>
                    <p className="font-medium">{getAuctionName(selectedAnimal?.auction_id ?? null)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Lote</Label>
                    <p className="font-medium">{selectedAnimal?.auction_lot || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg border-b pb-2">Leilão de Venda</h3>
                {loadingSales ? (
                  <p className="text-center text-muted-foreground py-4">Carregando...</p>
                ) : animalSales.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma venda registrada.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table className="table-sticky-first">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data da Venda</TableHead>
                          <TableHead>Leilão</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">% Vendido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {animalSales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell>{format(new Date(sale.sale_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                            <TableCell>{getAuctionName(sale.auction_id)}</TableCell>
                            <TableCell>{sale.auction_lot || "-"}</TableCell>
                            <TableCell className="text-right">{sale.sale_percentage.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Proprietários */}
            <TabsContent value="proprietarios" className="mt-4 space-y-4">
              <OwnersTab
                entityId={selectedAnimal?.id || null}
                entityType="animal"
                isReadOnly={false}
              />

              {/* Vendas section - only show for existing animals */}
              {selectedAnimal && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Vendas
                    </h3>
                  </div>
                  {loadingSales ? (
                    <p className="text-center text-muted-foreground py-8">Carregando...</p>
                  ) : animalSales.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhuma venda registrada.</p>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <Table className="table-sticky-first">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {animalSales.map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell>{format(new Date(sale.sale_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                                <TableCell>{sale.client_name}</TableCell>
                                <TableCell className="text-right">{sale.sale_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                <TableCell className="text-right">{sale.sale_percentage.toFixed(2)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="font-medium">Total Vendido</span>
                        <div className="flex gap-6">
                          <span className="font-semibold">
                            {animalSales.reduce((s, r) => s + r.sale_value, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="font-semibold">
                            {animalSales.reduce((s, r) => s + r.sale_percentage, 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          {!isReadOnly && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {modalMode === "create" ? "Cadastrar" : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o animal "{animalToDelete?.name}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Delete Dialog */}
      <AlertDialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir essa foto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (photoToDelete) {
                  if (photoToDelete.isCover) {
                    setFormData({ ...formData, cover_photo: "" });
                  } else {
                    handleRemovePhoto(photoToDelete.url);
                  }
                  setPhotoToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recipient Search Modal */}
      <Dialog open={recipientSearchOpen} onOpenChange={setRecipientSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar Receptora</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Buscar por Nome ou Brinco</Label>
                <Input
                  placeholder="Digite o nome ou brinco..."
                  value={recipientSearchTerm}
                  onChange={(e) => setRecipientSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label>Filtrar por Categoria</Label>
                <Select
                  value={recipientCategoryFilter || "all"}
                  onValueChange={(value) => setRecipientCategoryFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {recipientCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              <Table className="table-sticky-first table-sticky-last">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Brinco</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientAnimals
                    .filter((animal) => {
                      // Exclude current animal being edited
                      if (selectedAnimal && animal.id === selectedAnimal.id) return false;
                      const searchLower = recipientSearchTerm.toLowerCase();
                      const matchesSearch =
                        animal.name.toLowerCase().includes(searchLower) ||
                        animal.code.toString().includes(searchLower) ||
                        (animal.ear_tag && animal.ear_tag.toString().includes(searchLower));
                      const matchesCategory = !recipientCategoryFilter || animal.category_id === recipientCategoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Nenhum animal encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recipientAnimals
                      .filter((animal) => {
                        if (selectedAnimal && animal.id === selectedAnimal.id) return false;
                        const searchLower = recipientSearchTerm.toLowerCase();
                        const matchesSearch =
                          animal.name.toLowerCase().includes(searchLower) ||
                          animal.code.toString().includes(searchLower) ||
                          (animal.ear_tag && animal.ear_tag.toString().includes(searchLower));
                        const matchesCategory = !recipientCategoryFilter || animal.category_id === recipientCategoryFilter;
                        return matchesSearch && matchesCategory;
                      })
                      .map((animal) => (
                        <TableRow key={animal.id}>
                          <TableCell>{animal.code}</TableCell>
                          <TableCell>{animal.name}</TableCell>
                          <TableCell>{animal.ear_tag || "-"}</TableCell>
                          <TableCell>{categories.find(c => c.id === animal.category_id)?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRecipient(animal);
                                setFormData({ ...formData, recipient_id: animal.id });
                                setRecipientSearchOpen(false);
                                setRecipientSearchTerm("");
                                setRecipientCategoryFilter("");
                              }}
                            >
                              Selecionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipientSearchOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Modal */}
      <SaleModal
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
        tipo="animal"
        record={saleAnimal ? { id: saleAnimal.id, name: saleAnimal.name } : null}
        onSaved={fetchAnimals}
      />

      {/* Death Modal */}
      <Dialog open={deathModalOpen} onOpenChange={setDeathModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Informar Morte - {deathAnimal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data da Morte *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deathDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deathDate ? format(deathDate, "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deathDate || undefined} onSelect={(d) => setDeathDate(d || null)} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Textarea value={deathReason} onChange={(e) => setDeathReason(e.target.value)} placeholder="Informe o motivo da morte" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeathModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSaveDeath}>Registrar Morte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateLeilaoModal
        open={createLeilaoOpen}
        onOpenChange={setCreateLeilaoOpen}
        onCreated={(newAuction) => {
          setAuctions(prev => [...prev, newAuction].sort((a, b) => a.name.localeCompare(b.name)));
          setFormData(prev => ({ ...prev, auction_id: newAuction.id }));
        }}
      />
    </div>
  );
};

export default AnimaisCadastro;
