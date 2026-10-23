// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { OwnersTab } from "@/components/OwnersTab";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SaleModal } from "@/components/SaleModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, CheckCircle, Search, Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, DollarSign, Download, ChevronsUpDown, Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import { getRecipientCategoryIds } from "@/lib/animalCategoryRules";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AspirationRecord {
  id: string;
  code: number;
  name: string;
  observations: string | null;
  expected_aspiration_month: string | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  dam_id: string | null;
  farm_id: string | null;
  farm_type: string | null;
  status: string;
  store_id: string;
  aspiration_date: string | null;
  oocyte_count: number | null;
  laboratory_id: string | null;
  veterinarian_id: string | null;
  embryo_count: number | null;
  embryo_details: EmbryoDetail[] | null;
  transfer_date: string | null;
  financial_released: boolean;
  is_batch_purchase: boolean;
  batch_quantity: number;
}

interface EmbryoDetail {
  dam_id?: string | null;
  sire_id: string;
  recipient_id: string;
  semen_id?: string | null;
}

interface EmbryoRow {
  dam_id: string;
  sire_id: string;
  recipient_id: string;
  recipientName: string;
  semen_id: string;
}

interface AspirationBatchUtilization {
  id: string;
  aspiration_id: string;
  aspiration_date: string;
  laboratory_id: string | null;
  oocyte_count: number | null;
  quantity_used: number;
  embryo_count: number;
  embryo_details: EmbryoDetail[] | null;
  veterinarian_id: string | null;
  transfer_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Breed { id: string; name: string; }
interface Category { id: string; name: string; }
interface Auction { id: string; name: string; }
interface BreedingAnimal { id: string; name: string; sex: string; sire_id: string | null; dam_id: string | null; }
interface Laboratory { id: string; name: string; }
interface Veterinarian { id: string; name: string; }
interface AnimalOption { id: string; name: string; ear_tag: number | null; registration: string | null; category_id: string | null; }
interface SemenOption { id: string; name: string; quantity_initial: number; available_quantity: number; }
interface AspirationSemenConsumption {
  id: string;
  semen_id: string;
  aspiration_id: string | null;
  utilization_date: string;
  description: string | null;
  quantity_used: number;
}

const ITEMS_PER_PAGE = 15;
const formatDateBR = (value?: string | null) =>
  value ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "-";
const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const AnimaisGestaoAspiracoes = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<AspirationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedRecord, setSelectedRecord] = useState<AspirationRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AspirationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [storeId, setStoreId] = useState<string | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterBreed, setFilterBreed] = useState("");
  const [filterFarm, setFilterFarm] = useState("");
  const [filterExpectedMonthStart, setFilterExpectedMonthStart] = useState<Date | null>(null);
  const [filterExpectedMonthEnd, setFilterExpectedMonthEnd] = useState<Date | null>(null);
  const [filterAspirationDateStart, setFilterAspirationDateStart] = useState<Date | null>(null);
  const [filterAspirationDateEnd, setFilterAspirationDateEnd] = useState<Date | null>(null);
  const [filterTransferDateStart, setFilterTransferDateStart] = useState<Date | null>(null);
  const [filterTransferDateEnd, setFilterTransferDateEnd] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAuction, setFilterAuction] = useState("");
  const [filterDamName, setFilterDamName] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // First finalize modal (pending → in_progress)
  const [firstFinalizeOpen, setFirstFinalizeOpen] = useState(false);
  const [firstFinalizeRecord, setFirstFinalizeRecord] = useState<AspirationRecord | null>(null);
  const [firstFinalizeData, setFirstFinalizeData] = useState({
    aspiration_date: null as Date | null,
    laboratory_id: "",
    oocyte_count: "",
    quantity_used: "1",
    embryo_count: "",
    veterinarian_id: "",
    transfer_date: null as Date | null,
  });

  // Second finalize modal (in_progress → finalized)
  const [secondFinalizeOpen, setSecondFinalizeOpen] = useState(false);
  const [secondFinalizeRecord, setSecondFinalizeRecord] = useState<AspirationRecord | null>(null);
  const [embryoCount, setEmbryoCount] = useState(0);
  const [embryoRows, setEmbryoRows] = useState<EmbryoRow[]>([]);
  const [finalizeVeterinarianId, setFinalizeVeterinarianId] = useState("");
  const [finalizeTransferDate, setFinalizeTransferDate] = useState<Date | null>(null);
  const [defaultSireId, setDefaultSireId] = useState("");
  const [defaultSemenId, setDefaultSemenId] = useState("");
  const [semenConsumptions, setSemenConsumptions] = useState<Array<{ semen_id: string; quantity_used: string }>>([]);
  const [semenDialogOpen, setSemenDialogOpen] = useState(false);
  const [semenForm, setSemenForm] = useState({ semen_id: "", quantity_used: "" });
  const [savedSemenConsumptions, setSavedSemenConsumptions] = useState<AspirationSemenConsumption[]>([]);
  const [batchSavedSemenConsumptions, setBatchSavedSemenConsumptions] = useState<AspirationSemenConsumption[]>([]);

  // Recipient search modal
  const [activeEmbryoRowIndex, setActiveEmbryoRowIndex] = useState<number | null>(null);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const debouncedRecipientSearch = useDebounce(recipientSearchTerm, 300);
  const [recipientResults, setRecipientResults] = useState<AnimalOption[]>([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [recipientNamesCache, setRecipientNamesCache] = useState<Record<string, string>>({});
  const [recipientCreateOpen, setRecipientCreateOpen] = useState(false);
  const [recipientCreateSaving, setRecipientCreateSaving] = useState(false);
  const [recipientQuickForm, setRecipientQuickForm] = useState({
    code: 0,
    name: "",
    registration: "",
    ear_tag: "",
    breed_id: "",
    category_id: "",
    farm: "",
    observations: "",
  });
  const [usageDeleteOpen, setUsageDeleteOpen] = useState(false);
  const [usageToDelete, setUsageToDelete] = useState<AspirationBatchUtilization | null>(null);
  const [batchUsages, setBatchUsages] = useState<AspirationBatchUtilization[]>([]);
  const [usageTotals, setUsageTotals] = useState<Record<string, number>>({});
  const [editingBatchUsage, setEditingBatchUsage] = useState<AspirationBatchUtilization | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    observations: "",
    expected_aspiration_month: null as Date | null,
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    dam_id: "",
    farm: "",
    is_batch_purchase: false,
    batch_quantity: "",
  });

  // Dropdown options
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const recipientCategoryIds = useMemo(() => getRecipientCategoryIds(categories), [categories]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [semenOptions, setSemenOptions] = useState<SemenOption[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);
  const [ownFarms, setOwnFarms] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);

  // Financial data state
  interface AspirationFinancialRecord {
    id: string;
    document_number: string | null;
    due_date: string;
    payment_date: string | null;
    status: string;
    supplier_name: string | null;
    creditor_name: string | null;
    allocation_type: string;
    item_total_price: number;
    account_payable_id: string;
    account_receivable_id: string;
    paid_amount: number;
    record_type: 'expense' | 'revenue';
  }
  const [financialRecords, setFinancialRecords] = useState<AspirationFinancialRecord[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");

  // Sale modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleRecord, setSaleRecord] = useState<AspirationRecord | null>(null);
  const [saleClientId, setSaleClientId] = useState("");
  const [saleDate, setSaleDate] = useState<Date | null>(null);
  const [saleExpectedDeliveryDate, setSaleExpectedDeliveryDate] = useState<Date | null>(null);
  const [saleValue, setSaleValue] = useState("");
  const [salePercentage, setSalePercentage] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [saleOwners, setSaleOwners] = useState<{ owner_id: string; owner_name: string; percentage: number; owner_type: string; store_owner_id: string | null; third_party_farm_id: string | null }[]>([]);

  interface AspirationSale {
    id: string;
    client_id: string;
    client_name: string;
    sale_date: string;
    sale_value: number;
    sale_percentage: number;
    auction_id: string | null;
    auction_lot: string | null;
  }
  const [aspirationSales, setAspirationSales] = useState<AspirationSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const getBatchUsedTotal = (recordId: string) => usageTotals[recordId] || 0;
  const getBatchAvailableQuantity = (record: Pick<AspirationRecord, "id" | "batch_quantity">) =>
    Math.max(Number(record.batch_quantity || 0) - getBatchUsedTotal(record.id), 0);
  const hasSemenColumn = semenConsumptions.length > 0;
  const singleSelectedSemenId = semenConsumptions.length === 1 ? semenConsumptions[0].semen_id : "";
  const semenNameById = useMemo(
    () => new Map(semenOptions.map((option) => [option.id, option.name])),
    [semenOptions],
  );

  const getDefaultEmbryoRow = (): EmbryoRow => ({
    dam_id: "",
    sire_id: "",
    recipient_id: "",
    recipientName: "",
    semen_id: singleSelectedSemenId,
  });

  const getNextRecipientCode = async () => {
    const { data, error } = await supabase
      .from("animals")
      .select("code")
      .order("code", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.code || 0) + 1;
  };

  const parseFarmSelection = (farmValue: string) => {
    if (!farmValue) {
      return { farmId: null as string | null, farmType: null as string | null };
    }

    const dashIndex = farmValue.indexOf("-");
    if (dashIndex <= 0) {
      return { farmId: null as string | null, farmType: null as string | null };
    }

    return {
      farmType: farmValue.substring(0, dashIndex),
      farmId: farmValue.substring(dashIndex + 1),
    };
  };

  const hydrateRecipientNames = async (details: EmbryoDetail[]) => {
    const recipientIds = details.map((detail) => detail.recipient_id).filter(Boolean);
    const missingIds = recipientIds.filter((recipientId) => !recipientNamesCache[recipientId]);

    if (missingIds.length === 0) {
      return;
    }

    const { data: animals } = await supabase
      .from("animals")
      .select("id, name, ear_tag")
      .in("id", missingIds);

    if (!animals || animals.length === 0) {
      return;
    }

    setRecipientNamesCache((current) => {
      const next = { ...current };
      animals.forEach((animal) => {
        next[animal.id] = `${animal.name}${animal.ear_tag ? ` - Brinco: ${animal.ear_tag}` : ""}`;
      });
      return next;
    });
  };

  useEffect(() => {
    fetchRecords();
    fetchDropdownData();
  }, []);

  // Abre automaticamente o cadastro vindo do Rebanho (?open=<id>)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || records.length === 0) return;
    const record = records.find((r) => r.id === openId);
    if (record) {
      handleOpenModal("view", record);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, records]);

  useEffect(() => {
    if (!formData.is_batch_purchase && activeTab === "estoque") {
      setActiveTab("dados");
    }
  }, [activeTab, formData.is_batch_purchase]);

  // Search recipients for embryo rows
  useEffect(() => {
    if (!debouncedRecipientSearch || debouncedRecipientSearch.length < 2 || !storeId || recipientCategoryIds.length === 0) {
      setRecipientResults([]);
      return;
    }
    const searchRecipients = async () => {
      setRecipientSearchLoading(true);
      try {
        const term = `%${debouncedRecipientSearch}%`;
        const isNumeric = /^\d+$/.test(debouncedRecipientSearch);
        let query = supabase
          .from("animals")
          .select("id, name, ear_tag, registration, category_id")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .in("category_id", recipientCategoryIds);
        if (isNumeric) {
          query = query.or(`name.ilike.${term},registration.ilike.${term},ear_tag.eq.${debouncedRecipientSearch}`);
        } else {
          query = query.or(`name.ilike.${term},registration.ilike.${term}`);
        }
        const { data, error } = await query.limit(20);
        if (error) throw error;
        setRecipientResults(data || []);
      } catch (error) {
        console.error("Error searching recipients:", error);
      } finally {
        setRecipientSearchLoading(false);
      }
    };
    searchRecipients();
  }, [debouncedRecipientSearch, recipientCategoryIds, storeId]);

  const fetchRecords = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase.from("profiles").select("store_id, matrix_id").eq("id", userData.user.id).maybeSingle();
      
      let currentStoreId = profile?.store_id || null;
      if (!currentStoreId) {
        const { data: userStore } = await supabase.from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
        currentStoreId = userStore?.store_id || null;
      }
      setStoreId(currentStoreId);

      // Fetch all stores in the user's matrix to show all aspirations from the same matrix
      let storeIds: string[] = [];
      if (profile?.matrix_id) {
        const { data: matrixStores } = await supabase.from("stores").select("id").eq("matrix_id", profile.matrix_id);
        storeIds = (matrixStores || []).map(s => s.id);
      } else if (currentStoreId) {
        storeIds = [currentStoreId];
      }

      if (storeIds.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("aspiration_management")
        .select("*")
        .in("store_id", storeIds)
        .order("code", { ascending: false });
      if (error) throw error;

      const nextRecords = ((data as unknown as AspirationRecord[]) || []).map((record) => ({
        ...record,
        is_batch_purchase: Boolean((record as any).is_batch_purchase),
        batch_quantity: Number((record as any).batch_quantity || 0),
      }));

      setRecords(nextRecords);

      const batchRecordIds = nextRecords.filter((record) => record.is_batch_purchase).map((record) => record.id);
      if (batchRecordIds.length > 0) {
        const { data: usageData, error: usageError } = await supabase
          .from("aspiration_batch_utilizations" as any)
          .select("aspiration_id, quantity_used")
          .in("aspiration_id", batchRecordIds);
        if (usageError) throw usageError;

        const nextTotals = (usageData || []).reduce<Record<string, number>>((acc, row: any) => {
          acc[row.aspiration_id] = (acc[row.aspiration_id] || 0) + Number(row.quantity_used || 0);
          return acc;
        }, {});
        setUsageTotals(nextTotals);
      } else {
        setUsageTotals({});
      }

      if (selectedRecord) {
        const refreshedSelected = nextRecords.find((record) => record.id === selectedRecord.id) || null;
        setSelectedRecord(refreshedSelected);
      }
    } catch (error) {
      console.error("Error fetching aspiration records:", error);
      toast({ title: "Erro", description: "Erro ao carregar registros de aspiração.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase.from("profiles").select("store_id, matrix_id").eq("id", userData.user.id).single();
      let storeId = profile?.store_id || null;
      const matrixId = profile?.matrix_id || null;
      if (!storeId) {
        const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1);
        storeId = userStores?.[0]?.store_id || null;
      }
      if (!storeId && !matrixId) return;

      const breedsQuery = matrixId
        ? supabase.from("animal_breeds").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_breeds").select("id, name").eq("store_id", storeId!).eq("is_active", true);
      const categoriesQuery = matrixId
        ? supabase.from("animal_categories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("animal_categories").select("id, name").eq("store_id", storeId!).eq("is_active", true);
      const auctionsQuery = matrixId
        ? supabase.from("leiloes").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("leiloes").select("id, name").eq("store_id", storeId!).eq("is_active", true);
      const breedingQuery = matrixId
        ? supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("matrix_id", matrixId).eq("is_active", true).order("name")
        : supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", storeId!).eq("is_active", true).order("name");
      const labsQuery = matrixId
        ? supabase.from("laboratories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("laboratories").select("id, name").eq("store_id", storeId!).eq("is_active", true);
      const vetsQuery = matrixId
        ? supabase.from("veterinarians").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("veterinarians").select("id, name").eq("store_id", storeId!).eq("is_active", true);

      const semenStoreIds = matrixId
        ? ((await supabase.from("stores").select("id").eq("matrix_id", matrixId)).data || []).map((store) => store.id)
        : storeId
          ? [storeId]
          : [];

      let semenQuery = supabase.from("semen" as any).select("id, name, quantity_initial, store_id");
      if (semenStoreIds.length > 0) {
        semenQuery = semenQuery.in("store_id", semenStoreIds);
      }

      const [breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes, labsRes, vetsRes, semenRes] = await Promise.all([
        breedsQuery,
        categoriesQuery,
        auctionsQuery,
        breedingQuery,
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        labsQuery,
        vetsQuery,
        semenQuery.order("name"),
      ]);

      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      const animals = breedingAnimalsRes.data || [];
      setDams(animals.filter(a => a.sex === "femea"));
      setSires(animals.filter(a => a.sex === "macho"));
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdPartyFarmsRes.data || []);
      setLaboratories(labsRes.data || []);
      setVeterinarians(vetsRes.data || []);

      const loadedSemen = (semenRes.data || []) as Array<{ id: string; name: string; quantity_initial: number | string | null; store_id: string }>;
      if (loadedSemen.length === 0) {
        setSemenOptions([]);
        return;
      }

      const { data: semenUsageRes, error: semenUsageError } = await supabase
        .from("semen_utilizations" as any)
        .select("semen_id, quantity_used")
        .in("semen_id", loadedSemen.map((item) => item.id));

      if (semenUsageError) throw semenUsageError;

      const usageBySemen = (semenUsageRes || []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.semen_id] = (acc[row.semen_id] || 0) + Number(row.quantity_used || 0);
        return acc;
      }, {});

      setSemenOptions(
        loadedSemen.map((item) => {
          const quantityInitial = Number(item.quantity_initial || 0);
          const availableQuantity = Math.max(quantityInitial - (usageBySemen[item.id] || 0), 0);
          return {
            id: item.id,
            name: item.name,
            quantity_initial: quantityInitial,
            available_quantity: availableQuantity,
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  // Filtering logic
  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (!hasFiltered) {
      // Show only last 5 records on initial load
      return filtered.slice(0, 5);
    }

    if (filterName.trim()) {
      filtered = filtered.filter(r => r.name.toLowerCase().includes(filterName.toLowerCase()));
    }
    if (filterBreed) {
      filtered = filtered.filter(r => r.breed_id === filterBreed);
    }
    if (filterFarm) {
      filtered = filtered.filter(r => {
        if (!r.farm_id || !r.farm_type) return false;
        return `${r.farm_type}-${r.farm_id}` === filterFarm;
      });
    }
    if (filterExpectedMonthStart) {
      filtered = filtered.filter(r => {
        if (!r.expected_aspiration_month) return false;
        return new Date(r.expected_aspiration_month + "T12:00:00") >= filterExpectedMonthStart;
      });
    }
    if (filterExpectedMonthEnd) {
      filtered = filtered.filter(r => {
        if (!r.expected_aspiration_month) return false;
        return new Date(r.expected_aspiration_month + "T12:00:00") <= filterExpectedMonthEnd;
      });
    }
    if (filterAspirationDateStart) {
      filtered = filtered.filter(r => {
        if (!r.aspiration_date) return false;
        return new Date(r.aspiration_date + "T12:00:00") >= filterAspirationDateStart;
      });
    }
    if (filterAspirationDateEnd) {
      filtered = filtered.filter(r => {
        if (!r.aspiration_date) return false;
        return new Date(r.aspiration_date + "T12:00:00") <= filterAspirationDateEnd;
      });
    }
    if (filterTransferDateStart) {
      filtered = filtered.filter(r => {
        if (!r.transfer_date) return false;
        return new Date(r.transfer_date + "T12:00:00") >= filterTransferDateStart;
      });
    }
    if (filterTransferDateEnd) {
      filtered = filtered.filter(r => {
        if (!r.transfer_date) return false;
        return new Date(r.transfer_date + "T12:00:00") <= filterTransferDateEnd;
      });
    }
    if (filterStatus) {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    if (filterAuction) {
      filtered = filtered.filter(r => r.auction_id === filterAuction);
    }
    if (filterDamName.trim()) {
      filtered = filtered.filter(r => {
        if (!r.dam_id) return false;
        const dam = dams.find(d => d.id === r.dam_id);
        return dam?.name.toLowerCase().includes(filterDamName.toLowerCase()) || false;
      });
    }

    return filtered;
  }, [records, hasFiltered, filterName, filterBreed, filterFarm, filterExpectedMonthStart, filterExpectedMonthEnd, filterAspirationDateStart, filterAspirationDateEnd, filterTransferDateStart, filterTransferDateEnd, filterStatus, filterAuction, filterDamName, dams]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const currentBatchUsageTotal = useMemo(
    () => batchUsages.reduce((sum, usage) => sum + Number(usage.quantity_used || 0), 0),
    [batchUsages],
  );

  const currentBatchAvailable = useMemo(() => {
    if (!selectedRecord?.is_batch_purchase) {
      return 0;
    }

    return Math.max(Number(selectedRecord.batch_quantity || 0) - currentBatchUsageTotal, 0);
  }, [currentBatchUsageTotal, selectedRecord]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredRecords.length]);

  const handleApplyFilters = () => {
    setHasFiltered(true);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterBreed("");
    setFilterFarm("");
    setFilterExpectedMonthStart(null);
    setFilterExpectedMonthEnd(null);
    setFilterAspirationDateStart(null);
    setFilterAspirationDateEnd(null);
    setFilterTransferDateStart(null);
    setFilterTransferDateEnd(null);
    setFilterStatus("");
    setFilterAuction("");
    setFilterDamName("");
    setHasFiltered(false);
    setCurrentPage(1);
  };

  // Helper functions
  const getBreedName = (breedId: string | null) => breedId ? breeds.find(b => b.id === breedId)?.name || "-" : "-";
  const getDamName = (damId: string | null) => damId ? dams.find(d => d.id === damId)?.name || "-" : "-";
  const getAuctionName = (auctionId: string | null) => auctionId ? auctions.find(a => a.id === auctionId)?.name || "-" : "-";

  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") return ownFarms.find(f => f.id === farmId)?.name || "-";
    return thirdPartyFarms.find(f => f.id === farmId)?.name || "-";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "in_progress": return "Em Andamento";
      case "finalized": return "Finalizado";
      case "sold": return "Vendido";
      default: return status;
    }
  };

  const handleToggleFinancialReleased = async (record: AspirationRecord) => {
    try {
      const newValue = !record.financial_released;
      const { error } = await supabase
        .from("aspiration_management")
        .update({ financial_released: newValue })
        .eq("id", record.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, financial_released: newValue } : r));
      toast({
        title: "Sucesso",
        description: newValue ? "Liberado financeiro ativado" : "Liberado financeiro desativado",
      });
    } catch (error) {
      console.error("Error toggling financial_released:", error);
      toast({ title: "Erro", description: "Erro ao atualizar liberado financeiro", variant: "destructive" });
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "pending": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "finalized": return "bg-green-100 text-green-800";
      case "sold": return "bg-sky-100 text-sky-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Report export functions
  const getReportData = () => {
    return filteredRecords.map(record => ({
      "Código": record.code,
      "Nome": record.name,
      "Raça": getBreedName(record.breed_id),
      "Fazenda": getFarmName(record.farm_id, record.farm_type),
      "Mês Prev. Aspiração": record.expected_aspiration_month
        ? format(new Date(record.expected_aspiration_month + "T12:00:00"), "MM/yyyy", { locale: ptBR })
        : "-",
      "Data Aspiração": record.aspiration_date
        ? format(new Date(record.aspiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
        : "-",
      "Data Transferência": record.transfer_date
        ? format(new Date(record.transfer_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
        : "-",
      "Qtd. Embriões": record.embryo_count ?? "-",
      "Status": getStatusLabel(record.status),
    }));
  };

  const handleExportExcel = () => {
    const data = getReportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aspirações");
    XLSX.writeFile(wb, `aspiracoes_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
    toast({ title: "Sucesso", description: "Relatório Excel exportado." });
  };

  const handleExportPDF = () => {
    const data = getReportData();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório de Aspirações", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);

    const columns = Object.keys(data[0] || {});
    const rows = data.map(row => columns.map(col => String((row as any)[col])));

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`aspiracoes_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
    toast({ title: "Sucesso", description: "Relatório PDF exportado." });
  };

  // Date picker helper component
  const DateFilterPicker = ({ label, value, onChange }: { label: string; value: Date | null; onChange: (d: Date | null) => void }) => (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("mt-1 h-10 w-full justify-start rounded-lg text-left text-sm font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-3 w-3" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={value || undefined} onSelect={(d) => onChange(d || null)} locale={ptBR} className="pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  const getNextCode = async () => {
    if (!storeId) return 1;
    const { data } = await supabase
      .from("aspiration_management")
      .select("code")
      .eq("store_id", storeId)
      .order("code", { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0].code + 1 : 1;
  };

  const fetchBatchUtilizations = async (recordId: string) => {
    const { data, error } = await supabase
      .from("aspiration_batch_utilizations" as any)
      .select("*")
      .eq("aspiration_id", recordId)
      .order("aspiration_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

      const nextUsages = ((data || []) as AspirationBatchUtilization[]).map((usage) => ({
        ...usage,
        oocyte_count: usage.oocyte_count ? Number(usage.oocyte_count || 0) : null,
        quantity_used: Number(usage.quantity_used || 0),
        embryo_count: Number(usage.embryo_count || 0),
        embryo_details: (usage.embryo_details as EmbryoDetail[] | null) || [],
      }));

    setBatchUsages(nextUsages);

    const allDetails = nextUsages.flatMap((usage) => usage.embryo_details || []);
    if (allDetails.length > 0) {
      await hydrateRecipientNames(allDetails);
    }
  };

  const buildEmbryoRowsFromDetails = async (details: EmbryoDetail[]) => {
    const recipientIds = details.map((detail) => detail.recipient_id).filter(Boolean);
    const recipientMap = new Map<string, string>();

    if (recipientIds.length > 0) {
      const { data: recipients } = await supabase
        .from("animals")
        .select("id, name, ear_tag")
        .in("id", recipientIds);

      (recipients || []).forEach((recipient) => {
        recipientMap.set(recipient.id, `${recipient.name}${recipient.ear_tag ? ` - Brinco: ${recipient.ear_tag}` : ""}`);
      });
    }

    return details.map((detail) => ({
      dam_id: detail.dam_id || "",
      sire_id: detail.sire_id,
      recipient_id: detail.recipient_id,
      recipientName: recipientMap.get(detail.recipient_id) || recipientNamesCache[detail.recipient_id] || "",
      semen_id: detail.semen_id || "",
    }));
  };

  const fetchAspirationSemenConsumptions = async (aspirationId: string) => {
    const { data, error } = await supabase
      .from("semen_utilizations" as any)
      .select("id, semen_id, aspiration_id, utilization_date, description, quantity_used")
      .eq("aspiration_id", aspirationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    setSavedSemenConsumptions(
      ((data || []) as AspirationSemenConsumption[]).map((item) => ({
        ...item,
        quantity_used: Number(item.quantity_used || 0),
      })),
    );
  };

  const fetchBatchUsageSemenConsumptions = async (batchUtilizationId: string) => {
    const { data, error } = await supabase
      .from("semen_utilizations" as any)
      .select("id, semen_id, aspiration_id, utilization_date, description, quantity_used")
      .eq("batch_utilization_id", batchUtilizationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const nextConsumptions = ((data || []) as AspirationSemenConsumption[]).map((item) => ({
      ...item,
      quantity_used: Number(item.quantity_used || 0),
    }));

    setBatchSavedSemenConsumptions(nextConsumptions);
    setSemenConsumptions(nextConsumptions.map((item) => ({ semen_id: item.semen_id, quantity_used: String(item.quantity_used) })));
  };

  const getBatchEditableBalance = (record: AspirationRecord, usage?: AspirationBatchUtilization | null) =>
    getBatchAvailableQuantity(record) + Number(usage?.quantity_used || 0);

  const openBatchUsageModal = async (record: AspirationRecord, usage?: AspirationBatchUtilization | null) => {
    setFirstFinalizeRecord(record);
    setEditingBatchUsage(usage || null);
    setDefaultSireId("");
    setDefaultSemenId("");
    setSemenConsumptions([]);
    setBatchSavedSemenConsumptions([]);
    const details = usage?.embryo_details || [];
    const rows = details.length > 0 ? await buildEmbryoRowsFromDetails(details) : [];

    setFirstFinalizeData({
      aspiration_date: usage?.aspiration_date ? new Date(`${usage.aspiration_date}T12:00:00`) : null,
      laboratory_id: usage?.laboratory_id || "",
      oocyte_count: usage?.oocyte_count ? String(Number(usage.oocyte_count || 0)) : "",
      quantity_used: usage ? String(Number(usage.quantity_used || 0)) : "1",
      embryo_count: usage ? String(Number(usage.embryo_count || 0)) : "",
      veterinarian_id: usage?.veterinarian_id || "",
      transfer_date: usage?.transfer_date ? new Date(`${usage.transfer_date}T12:00:00`) : null,
    });
    setEmbryoCount(Number(usage?.embryo_count || 0));
    setEmbryoRows(rows);
    if (usage?.id) {
      await fetchBatchUsageSemenConsumptions(usage.id);
      if ((usage?.embryo_details as EmbryoDetail[] | null)?.some((detail) => detail.semen_id)) {
        const firstSemenId = (usage.embryo_details as EmbryoDetail[]).find((detail) => detail.semen_id)?.semen_id || "";
        setDefaultSemenId(firstSemenId);
      }
    }
    setFirstFinalizeOpen(true);
  };

  const copyAspirationOwnersToEmbryoTransfer = async (aspirationId: string, embryoTransferId: string) => {
    const { data: aspirationOwners } = await supabase
      .from("aspiration_owners")
      .select("owner_id, store_owner_id, third_party_farm_id, owner_type, percentage")
      .eq("aspiration_id", aspirationId);

    if (!aspirationOwners || aspirationOwners.length === 0) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const owner of aspirationOwners) {
      await supabase.from("embryo_transfer_owners").insert({
        embryo_transfer_id: embryoTransferId,
        owner_id: (owner as any).owner_type === "supplier" ? owner.owner_id : null,
        store_owner_id: (owner as any).owner_type === "store" ? (owner as any).store_owner_id : null,
        third_party_farm_id: (owner as any).owner_type === "third_party_farm" ? (owner as any).third_party_farm_id : null,
        owner_type: (owner as any).owner_type || "supplier",
        percentage: owner.percentage,
        created_by: user?.id,
      } as any);
    }
  };

  const createEmbryoTransfersForUsage = async (
    record: AspirationRecord,
    batchUtilizationId: string | null,
    details: EmbryoDetail[],
    transferDate: Date | null,
    veterinarianId: string,
    laboratoryId: string,
  ) => {
    for (let i = 0; i < details.length; i++) {
      const row = details[i];
      const sireName = sires.find((sire) => sire.id === row.sire_id)?.name || "";
      const transferName = `${record.name} X ${sireName}`;

      const { data: lastCode } = await supabase
        .from("embryo_transfer_management")
        .select("code")
        .eq("store_id", record.store_id)
        .order("code", { ascending: false })
        .limit(1);
      const nextCode = lastCode && lastCode.length > 0 ? lastCode[0].code + 1 : 1;

      const { data: insertedTransfer, error: insertError } = await supabase
        .from("embryo_transfer_management")
        .insert({
          code: nextCode,
          name: transferName,
          breed_id: record.breed_id,
          category_id: record.category_id,
          auction_id: record.auction_id,
          auction_lot: record.auction_lot,
          dam_id: row.dam_id || record.dam_id,
          sire_id: row.sire_id,
          recipient_id: row.recipient_id,
          farm_id: record.farm_id,
          farm_type: record.farm_type,
          store_id: record.store_id,
          aspiration_date: record.aspiration_date || null,
          transfer_date: transferDate ? format(transferDate, "yyyy-MM-dd") : null,
          veterinarian_id: veterinarianId || null,
          laboratory_id: laboratoryId || null,
          aspiration_id: record.id,
          batch_utilization_id: batchUtilizationId,
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (insertedTransfer?.id) {
        await copyAspirationOwnersToEmbryoTransfer(record.id, insertedTransfer.id);
      }
    }
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", record?: AspirationRecord) => {
    setModalMode(mode);
    setActiveTab("dados");
    setFinancialRecords([]);
    setBatchUsages([]);
    setEditingBatchUsage(null);

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode, name: "", observations: "", expected_aspiration_month: null,
        breed_id: "", category_id: "", auction_id: "", auction_lot: "", dam_id: "", farm: "",
        is_batch_purchase: false, batch_quantity: "",
      });
      setSelectedRecord(null);
      setSavedSemenConsumptions([]);
    } else if (record) {
      setSelectedRecord(record);
      let farmValue = "";
      if (record.farm_id && record.farm_type) farmValue = `${record.farm_type}-${record.farm_id}`;
      setFormData({
        code: record.code, name: record.name, observations: record.observations || "",
        expected_aspiration_month: record.expected_aspiration_month ? new Date(record.expected_aspiration_month) : null,
        breed_id: record.breed_id || "", category_id: record.category_id || "",
        auction_id: record.auction_id || "", auction_lot: record.auction_lot || "",
        dam_id: record.dam_id || "", farm: farmValue,
        is_batch_purchase: record.is_batch_purchase,
        batch_quantity: record.is_batch_purchase ? String(Number(record.batch_quantity || 0)) : "",
      });

      if (mode === "view" && record.status === "finalized" && record.embryo_details) {
        const details = record.embryo_details as EmbryoDetail[];
        await hydrateRecipientNames(details);
      }
      await Promise.all([
        fetchAspirationFinancial(record.id),
        record.is_batch_purchase ? fetchBatchUtilizations(record.id) : Promise.resolve(),
        fetchAspirationSemenConsumptions(record.id),
      ]);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "O nome é obrigatório.", variant: "destructive" });
      return;
    }
    const batchQuantity = Number(formData.batch_quantity || 0);
    if (formData.is_batch_purchase && (Number.isNaN(batchQuantity) || batchQuantity <= 0)) {
      toast({ title: "Erro", description: "Informe uma quantidade válida para compra em lote.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userData.user.id).maybeSingle();
      let currentStoreId = profile?.store_id;
      if (!currentStoreId) {
        const { data: userStore } = await supabase.from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
        currentStoreId = userStore?.store_id || null;
      }
      if (!currentStoreId) {
        toast({ title: "Erro", description: "Nenhuma fazenda vinculada ao seu perfil. Contate o administrador.", variant: "destructive" });
        setSaving(false);
        return;
      }

      let farmId: string | null = null;
      let farmType: string | null = null;
      if (formData.farm) {
        const parsedFarm = parseFarmSelection(formData.farm);
        farmType = parsedFarm.farmType;
        farmId = parsedFarm.farmId;
      }

      const recordData = {
        code: formData.code,
        name: formData.name.trim(),
        observations: formData.observations.trim() || null,
        expected_aspiration_month: formData.expected_aspiration_month ? format(formData.expected_aspiration_month, "yyyy-MM-dd") : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        dam_id: formData.dam_id || null,
        farm_id: farmId,
        farm_type: farmType,
        store_id: currentStoreId,
        is_batch_purchase: formData.is_batch_purchase,
        batch_quantity: formData.is_batch_purchase ? batchQuantity : 0,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("aspiration_management").insert(recordData as any);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso." });
      } else {
        const { error } = await supabase.from("aspiration_management").update(recordData as any).eq("id", selectedRecord!.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso." });
      }
      setModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving record:", error);
      toast({ title: "Erro", description: "Erro ao salvar registro.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      // Check for linked accounts payable
      const { data: payableAllocations } = await supabase
        .from("accounts_payable_item_allocations")
        .select("id")
        .eq("aspiration_id", recordToDelete.id)
        .limit(1);

      // Check for linked accounts receivable
      const { data: receivableAllocations } = await supabase
        .from("accounts_receivable_item_allocations")
        .select("id")
        .eq("aspiration_id", recordToDelete.id)
        .limit(1);

      const { data: batchUtilizations } = await supabase
        .from("aspiration_batch_utilizations" as any)
        .select("id")
        .eq("aspiration_id", recordToDelete.id)
        .limit(1);

      if ((payableAllocations && payableAllocations.length > 0) || (receivableAllocations && receivableAllocations.length > 0) || (batchUtilizations && batchUtilizations.length > 0)) {
        toast({ title: "Exclusão não permitida", description: "Este registro possui vínculos financeiros ou movimentações de estoque cadastradas.", variant: "destructive" });
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
        return;
      }

      const { error } = await supabase.from("aspiration_management").delete().eq("id", recordToDelete.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Registro excluído com sucesso." });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({ title: "Erro", description: "Erro ao excluir registro.", variant: "destructive" });
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

  const fetchAspirationSales = async (aspirationId: string) => {
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from("aspiration_sales")
        .select("id, client_id, sale_date, sale_value, sale_percentage, auction_id, auction_lot")
        .eq("aspiration_id", aspirationId)
        .order("sale_date", { ascending: true });
      if (error) throw error;
      
      const salesWithNames: AspirationSale[] = [];
      for (const sale of (data || [])) {
        const client = clients.find(c => c.id === sale.client_id);
        salesWithNames.push({
          ...sale,
          client_name: client?.name || "Cliente não encontrado",
        });
      }
      setAspirationSales(salesWithNames);
    } catch (error) {
      console.error("Error fetching aspiration sales:", error);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleOpenSaleModal = async (record: AspirationRecord) => {
    setSaleRecord(record);
    setSaleClientId("");
    setSaleDate(null);
    setSaleExpectedDeliveryDate(null);
    setSaleValue("");
    setSalePercentage("");
    setClientSearchTerm("");
    fetchClients();
    
    try {
      const { data: owners } = await supabase
        .from("aspiration_owners")
        .select("owner_id, owner_type, store_owner_id, third_party_farm_id, percentage")
        .eq("aspiration_id", record.id);
      
      const ownersWithNames: { owner_id: string; owner_name: string; percentage: number; owner_type: string; store_owner_id: string | null; third_party_farm_id: string | null }[] = [];
      for (const o of owners || []) {
        const ownerType = (o as any).owner_type || "supplier";
        let ownerName = "N/A";
        const effectiveId = ownerType === "store"
          ? (o as any).store_owner_id
          : ownerType === "third_party_farm"
            ? (o as any).third_party_farm_id
            : o.owner_id;
        
        if (ownerType === "store" && (o as any).store_owner_id) {
          const { data: store } = await supabase.from("stores").select("name").eq("id", (o as any).store_owner_id).single();
          ownerName = store?.name || "Fazenda não encontrada";
        } else if (ownerType === "third_party_farm" && (o as any).third_party_farm_id) {
          const { data: farm } = await supabase.from("third_party_farms").select("name").eq("id", (o as any).third_party_farm_id).single();
          ownerName = farm?.name || "Fazenda não encontrada";
        } else if (o.owner_id) {
          const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", o.owner_id).single();
          ownerName = supplier?.name || "N/A";
        }
        ownersWithNames.push({
          owner_id: effectiveId || "",
          owner_name: ownerName,
          percentage: Number(o.percentage),
          owner_type: ownerType,
          store_owner_id: (o as any).store_owner_id || null,
          third_party_farm_id: (o as any).third_party_farm_id || null,
        });
      }
      setSaleOwners(ownersWithNames);
    } catch (error) {
      console.error("Error fetching owners for sale:", error);
      setSaleOwners([]);
    }
    
    setSaleModalOpen(true);
  };

  const handleSaveSale = async () => {
    if (!saleRecord || !saleClientId || !saleDate || !saleValue || !salePercentage) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    const percentage = parseFloat(salePercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0 e 100.", variant: "destructive" });
      return;
    }

    const ownersTotal = saleOwners.reduce((s, o) => s + o.percentage, 0);
    const buyerAlreadyInOwners = saleOwners.some(o => o.owner_id === saleClientId);
    const grandTotal = ownersTotal + (buyerAlreadyInOwners ? 0 : percentage);
    if (grandTotal > 100) {
      toast({ title: "Erro", description: `O somatório das participações dos proprietários (${ownersTotal.toFixed(2)}%) + venda (${percentage.toFixed(2)}%) ultrapassa 100%.`, variant: "destructive" });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("aspiration_sales").insert({
        aspiration_id: saleRecord.id,
        client_id: saleClientId,
        sale_date: format(saleDate, "yyyy-MM-dd"),
        sale_value: parseFloat(saleValue),
        sale_percentage: percentage,
        data_prevista_entrega: saleExpectedDeliveryDate ? format(saleExpectedDeliveryDate, "yyyy-MM-dd") : null,
        created_by: userData.user?.id,
      });
      if (error) throw error;

      for (const owner of saleOwners) {
        let existingRecord;
        if (owner.owner_type === "store" && owner.store_owner_id) {
          const { data } = await supabase
            .from("aspiration_owners")
            .select("id")
            .eq("aspiration_id", saleRecord.id)
            .eq("store_owner_id", owner.store_owner_id)
            .eq("owner_type", "store")
            .maybeSingle();
          existingRecord = data;
        } else if (owner.owner_type === "third_party_farm" && owner.third_party_farm_id) {
          const { data } = await supabase
            .from("aspiration_owners")
            .select("id")
            .eq("aspiration_id", saleRecord.id)
            .eq("third_party_farm_id", owner.third_party_farm_id)
            .eq("owner_type", "third_party_farm")
            .maybeSingle();
          existingRecord = data;
        } else {
          const { data } = await supabase
            .from("aspiration_owners")
            .select("id")
            .eq("aspiration_id", saleRecord.id)
            .eq("owner_id", owner.owner_id)
            .maybeSingle();
          existingRecord = data;
        }

        if (existingRecord) {
          if (owner.percentage <= 0) {
            await supabase.from("aspiration_owners").delete().eq("id", existingRecord.id);
          } else {
            await supabase.from("aspiration_owners").update({ percentage: owner.percentage }).eq("id", existingRecord.id);
          }
        }
      }

      const buyerInOwners = saleOwners.find(o => o.owner_id === saleClientId);
      if (!buyerInOwners) {
        const { data: existingOwner } = await supabase
          .from("aspiration_owners")
          .select("id, percentage")
          .eq("aspiration_id", saleRecord.id)
          .eq("owner_id", saleClientId)
          .maybeSingle();

        if (existingOwner) {
          await supabase.from("aspiration_owners")
            .update({ percentage: Number(existingOwner.percentage) + percentage })
            .eq("id", existingOwner.id);
        } else {
          await supabase.from("aspiration_owners").insert({
            aspiration_id: saleRecord.id,
            owner_id: saleClientId,
            percentage: percentage,
            created_by: userData.user?.id,
          } as any);
        }
      }

      const { data: storeOwners } = await supabase
        .from("aspiration_owners")
        .select("id, owner_type, percentage")
        .eq("aspiration_id", saleRecord.id)
        .eq("owner_type", "store");
      
      const storeHasOwnership = storeOwners?.some((o: any) => Number(o.percentage) > 0);
      if (!storeHasOwnership) {
        await supabase.from("aspiration_management").update({ status: "sold" }).eq("id", saleRecord.id);
      }

      toast({ title: "Sucesso", description: "Venda registrada com sucesso." });
      setSaleModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving sale:", error);
      toast({ title: "Erro", description: "Erro ao salvar venda.", variant: "destructive" });
    }
  };

  const handleFirstFinalizeEmbryoCountChange = (count: number) => {
    setEmbryoCount(count);
    const newRows = Array.from({ length: count }, (_, index) => {
      return embryoRows[index] || getDefaultEmbryoRow();
    });
    setEmbryoRows(newRows);
  };

  const handleReplicateDefaultSire = () => {
    if (!defaultSireId || embryoRows.length === 0) return;
    setEmbryoRows((current) => current.map((row) => ({ ...row, sire_id: defaultSireId })));
  };

  const handleReplicateDefaultSemen = () => {
    if (!defaultSemenId || embryoRows.length === 0) return;
    setEmbryoRows((current) => current.map((row) => ({ ...row, semen_id: defaultSemenId })));
  };

  const handleSaveSemenConsumption = () => {
    const selectedOption = semenOptions.find((option) => option.id === semenForm.semen_id);
    const quantityValue = Number(semenForm.quantity_used || 0);

    if (!selectedOption) {
      toast({ title: "Erro", description: "Selecione um sêmen.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Erro", description: "Informe uma quantidade válida.", variant: "destructive" });
      return;
    }

    if (quantityValue > selectedOption.available_quantity) {
      toast({ title: "Saldo insuficiente", description: "A quantidade informada é maior que o saldo disponível do sêmen.", variant: "destructive" });
      return;
    }

    if (semenConsumptions.some((item) => item.semen_id === semenForm.semen_id)) {
      toast({ title: "Erro", description: "Esse sêmen já foi adicionado ao consumo desta aspiração.", variant: "destructive" });
      return;
    }

    const nextConsumptions = [...semenConsumptions, { semen_id: semenForm.semen_id, quantity_used: semenForm.quantity_used }];
    setSemenConsumptions(nextConsumptions);
    setSemenDialogOpen(false);
    setSemenForm({ semen_id: "", quantity_used: "" });

    if (nextConsumptions.length === 1) {
      setDefaultSemenId(nextConsumptions[0].semen_id);
      setEmbryoRows((current) => current.map((row) => ({ ...row, semen_id: nextConsumptions[0].semen_id })));
    }
  };

  const handleRemoveSemenConsumption = (semenId: string) => {
    const remaining = semenConsumptions.filter((item) => item.semen_id !== semenId);
    setSemenConsumptions(remaining);
    setEmbryoRows((current) =>
      current.map((row) => ({
        ...row,
        semen_id: row.semen_id === semenId ? (remaining.length === 1 ? remaining[0].semen_id : "") : row.semen_id,
      })),
    );
    if (defaultSemenId === semenId) {
      setDefaultSemenId(remaining.length === 1 ? remaining[0].semen_id : "");
    }
  };

  const openQuickRecipientCreate = async () => {
    try {
      const nextCode = await getNextRecipientCode();
      setRecipientQuickForm({
        code: nextCode,
        name: "",
        registration: "",
        ear_tag: "",
        breed_id: "",
        category_id: recipientCategoryIds[0] || "",
        farm: "",
        observations: "",
      });
      setRecipientCreateOpen(true);
    } catch (error) {
      console.error("Error preparing recipient create modal:", error);
      toast({ title: "Erro", description: "Não foi possível preparar o cadastro da receptora.", variant: "destructive" });
    }
  };

  const handleQuickRecipientSave = async () => {
    if (!recipientQuickForm.name.trim()) {
      toast({ title: "Erro", description: "O nome da receptora é obrigatório.", variant: "destructive" });
      return;
    }

    if (!recipientQuickForm.category_id) {
      toast({ title: "Erro", description: "Selecione a categoria da receptora.", variant: "destructive" });
      return;
    }

    if (!storeId) {
      toast({ title: "Erro", description: "Nenhuma fazenda vinculada ao usuário.", variant: "destructive" });
      return;
    }

    setRecipientCreateSaving(true);
    try {
      const parsedFarm = parseFarmSelection(recipientQuickForm.farm);
      const payload = {
        code: recipientQuickForm.code,
        name: recipientQuickForm.name.trim(),
        registration: recipientQuickForm.registration.trim() || null,
        ear_tag: recipientQuickForm.ear_tag && !Number.isNaN(parseInt(recipientQuickForm.ear_tag, 10))
          ? parseInt(recipientQuickForm.ear_tag, 10)
          : null,
        sex: "femea",
        breed_id: recipientQuickForm.breed_id || null,
        category_id: recipientQuickForm.category_id || null,
        observations: recipientQuickForm.observations.trim() || null,
        store_id: storeId,
        is_active: true,
        batch_id: null,
        auction_id: null,
        auction_lot: null,
        farm_entry_date: null,
        birth_date: null,
        photos: [] as string[],
        cover_photo: null,
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
        pregnancy_id: null,
        farm_id: parsedFarm.farmId,
        farm_type: parsedFarm.farmType === "third_party" ? "third_party" : parsedFarm.farmType === "own" ? "own" : null,
      };

      const { data, error } = await supabase
        .from("animals")
        .insert(payload as any)
        .select("id, name, ear_tag, registration, category_id")
        .single();

      if (error) throw error;

      const createdRecipient = data as AnimalOption;
      const createdRecipientName = `${createdRecipient.name}${createdRecipient.ear_tag ? ` - Brinco: ${createdRecipient.ear_tag}` : ""}`;

      setRecipientNamesCache((current) => ({
        ...current,
        [createdRecipient.id]: createdRecipientName,
      }));

      if (activeEmbryoRowIndex !== null) {
        setEmbryoRows((current) => {
          const updated = [...current];
          updated[activeEmbryoRowIndex] = {
            ...updated[activeEmbryoRowIndex],
            recipient_id: createdRecipient.id,
            recipientName: createdRecipientName,
          };
          return updated;
        });
      }

      setRecipientResults((current) => [createdRecipient, ...current.filter((item) => item.id !== createdRecipient.id)]);
      setRecipientCreateOpen(false);
      setRecipientSearchOpen(false);
      setRecipientQuickForm({
        code: 0,
        name: "",
        registration: "",
        ear_tag: "",
        breed_id: "",
        category_id: "",
        farm: "",
        observations: "",
      });
      toast({ title: "Sucesso", description: "Receptora cadastrada e vinculada à linha selecionada." });
    } catch (error: unknown) {
      console.error("Error creating recipient:", error);
      const message = error instanceof Error ? error.message : "Erro ao cadastrar receptora.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setRecipientCreateSaving(false);
    }
  };

  const handleSaveBatchUsage = async () => {
    if (saving || !firstFinalizeRecord || !firstFinalizeData.aspiration_date) {
      toast({ title: "Erro", description: "Data da aspiração é obrigatória.", variant: "destructive" });
      return;
    }

    const quantityUsed = Number(firstFinalizeData.quantity_used || 0);
    const oocyteCountValue = Number(firstFinalizeData.oocyte_count || 0);
    const embryoCountValue = Number(firstFinalizeData.embryo_count || 0);
    const editableBalance = getBatchEditableBalance(firstFinalizeRecord, editingBatchUsage);

    if (Number.isNaN(quantityUsed) || quantityUsed <= 0) {
      toast({ title: "Erro", description: "Quantidade deve ser maior que zero.", variant: "destructive" });
      return;
    }

    if (quantityUsed > editableBalance) {
      toast({ title: "Saldo insuficiente", description: "Quantidade utilizada não pode ser maior que o saldo disponível.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(embryoCountValue) || embryoCountValue <= 0) {
      toast({ title: "Erro", description: "Quantidade de embriões é obrigatória.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(oocyteCountValue) || oocyteCountValue <= 0) {
      toast({ title: "Erro", description: "Quantidade de oócitos é obrigatória.", variant: "destructive" });
      return;
    }

    for (let i = 0; i < embryoRows.length; i++) {
      if (!embryoRows[i].dam_id || !embryoRows[i].sire_id || !embryoRows[i].recipient_id) {
        toast({ title: "Erro", description: `Preencha matriz, reprodutor e receptora na linha ${i + 1}.`, variant: "destructive" });
        return;
      }
      if (hasSemenColumn && !embryoRows[i].semen_id) {
        toast({ title: "Erro", description: `Selecione o sêmen na linha ${i + 1}.`, variant: "destructive" });
        return;
      }
    }

    if (hasSemenColumn) {
      const unusedSemen = semenConsumptions.find((consumption) => !embryoRows.some((row) => row.semen_id === consumption.semen_id));
      if (unusedSemen) {
        toast({ title: "Erro", description: `Associe o sêmen "${semenNameById.get(unusedSemen.semen_id) || "selecionado"}" a pelo menos uma linha.`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    let savedUsageId = editingBatchUsage?.id || null;
    const insertedSemenUsageIds: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const embryoDetails = embryoRows.map((row) => ({
        dam_id: row.dam_id || null,
        sire_id: row.sire_id,
        recipient_id: row.recipient_id,
        semen_id: row.semen_id || null,
      }));
      const payload = {
        aspiration_id: firstFinalizeRecord.id,
        aspiration_date: format(firstFinalizeData.aspiration_date, "yyyy-MM-dd"),
        laboratory_id: null,
        oocyte_count: oocyteCountValue,
        quantity_used: quantityUsed,
        embryo_count: embryoCountValue,
        embryo_details: embryoDetails as any,
        veterinarian_id: firstFinalizeData.veterinarian_id || null,
        transfer_date: firstFinalizeData.transfer_date ? format(firstFinalizeData.transfer_date, "yyyy-MM-dd") : null,
        description: `Consumo do lote - ${format(firstFinalizeData.aspiration_date, "dd/MM/yyyy")}`,
        created_by: editingBatchUsage ? undefined : user?.id,
      };

      if (editingBatchUsage) {
        const { error: updateUsageError } = await supabase
          .from("aspiration_batch_utilizations" as any)
          .update(payload as any)
          .eq("id", editingBatchUsage.id);
        if (updateUsageError) throw updateUsageError;

        const { error: deleteTransfersError } = await supabase
          .from("embryo_transfer_management")
          .delete()
          .eq("batch_utilization_id", editingBatchUsage.id);
        if (deleteTransfersError) throw deleteTransfersError;

        const { error: deleteExistingSemenError } = await supabase
          .from("semen_utilizations" as any)
          .delete()
          .eq("batch_utilization_id", editingBatchUsage.id);
        if (deleteExistingSemenError) throw deleteExistingSemenError;
      } else {
        const { data: insertedUsage, error: insertUsageError } = await supabase
          .from("aspiration_batch_utilizations" as any)
          .insert(payload as any)
          .select("id")
          .single();
        if (insertUsageError) throw insertUsageError;
        savedUsageId = insertedUsage?.id || null;
      }

      if (!savedUsageId) {
        throw new Error("Não foi possível identificar a movimentação de estoque.");
      }

      for (const consumption of semenConsumptions) {
        const quantityUsedValue = Number(consumption.quantity_used || 0);
        if (Number.isNaN(quantityUsedValue) || quantityUsedValue <= 0) {
          throw new Error("Quantidade de sêmen inválida.");
        }

        const { data: insertedSemenUsage, error: semenUsageError } = await supabase
          .from("semen_utilizations" as any)
          .insert({
            semen_id: consumption.semen_id,
            aspiration_id: firstFinalizeRecord.id,
            batch_utilization_id: savedUsageId,
            utilization_date: format(firstFinalizeData.aspiration_date, "yyyy-MM-dd"),
            description: `Consumo de sêmen na aspiração em lote ${firstFinalizeRecord.code} - ${firstFinalizeRecord.name}`,
            quantity_used: quantityUsedValue,
          })
          .select("id")
          .single();

        if (semenUsageError) throw semenUsageError;
        if (insertedSemenUsage?.id) {
          insertedSemenUsageIds.push(insertedSemenUsage.id);
        }
      }

      const refreshedRecord = {
        ...firstFinalizeRecord,
        aspiration_date: format(firstFinalizeData.aspiration_date, "yyyy-MM-dd"),
        oocyte_count: oocyteCountValue,
      };

      await createEmbryoTransfersForUsage(
        refreshedRecord,
        savedUsageId,
        embryoDetails,
        firstFinalizeData.transfer_date,
        firstFinalizeData.veterinarian_id,
        "",
      );

      toast({
        title: "Sucesso",
        description: editingBatchUsage
          ? "Movimentação do lote atualizada com sucesso."
          : "Consumo do lote registrado com sucesso.",
      });
      setFirstFinalizeOpen(false);
      setFirstFinalizeRecord(null);
      setEditingBatchUsage(null);
      setEmbryoCount(0);
      setEmbryoRows([]);
      setDefaultSireId("");
      setDefaultSemenId("");
      setSemenConsumptions([]);
      setBatchSavedSemenConsumptions([]);
      if (selectedRecord?.id === refreshedRecord.id) {
        await fetchBatchUtilizations(refreshedRecord.id);
      }
      await Promise.allSettled([fetchRecords(), fetchDropdownData()]);
    } catch (error) {
      console.error("Error saving aspiration batch usage:", error);
      if (!editingBatchUsage && savedUsageId) {
        await supabase.from("aspiration_batch_utilizations" as any).delete().eq("id", savedUsageId);
      }
      if (insertedSemenUsageIds.length > 0) {
        await supabase.from("semen_utilizations" as any).delete().in("id", insertedSemenUsageIds);
      }
      toast({ title: "Erro", description: "Erro ao registrar consumo do lote.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFirstFinalize = async () => {
    if (firstFinalizeRecord?.is_batch_purchase) {
      await handleSaveBatchUsage();
      return;
    }

    if (saving) return;
    const oocyteCount = Number(firstFinalizeData.oocyte_count || 0);
    if (!firstFinalizeRecord || !firstFinalizeData.aspiration_date) {
      toast({ title: "Erro", description: "Data da aspiração é obrigatória.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(oocyteCount) || oocyteCount <= 0) {
      toast({ title: "Erro", description: "Quantidade de oócitos é obrigatória.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("aspiration_management")
        .update({
          status: "in_progress",
          aspiration_date: format(firstFinalizeData.aspiration_date, "yyyy-MM-dd"),
          oocyte_count: oocyteCount,
          laboratory_id: null,
        } as any)
        .eq("id", firstFinalizeRecord.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Aspiração iniciada com sucesso." });
      setFirstFinalizeOpen(false);
      setFirstFinalizeRecord(null);
      await fetchRecords();
    } catch (error) {
      console.error("Error first finalize:", error);
      toast({ title: "Erro", description: "Erro ao iniciar aspiração.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSecondFinalize = async () => {
    if (saving) return;
    if (!secondFinalizeRecord) return;
    if (embryoCount <= 0) {
      toast({ title: "Erro", description: "Quantidade de embriões é obrigatória.", variant: "destructive" });
      return;
    }
    for (let i = 0; i < embryoRows.length; i++) {
      if (!embryoRows[i].sire_id || !embryoRows[i].recipient_id) {
        toast({ title: "Erro", description: `Preencha reprodutor e receptora na linha ${i + 1}.`, variant: "destructive" });
        return;
      }
      if (hasSemenColumn && !embryoRows[i].semen_id) {
        toast({ title: "Erro", description: `Selecione o sêmen na linha ${i + 1}.`, variant: "destructive" });
        return;
      }
    }
    if (hasSemenColumn) {
      const unusedSemen = semenConsumptions.find((consumption) => !embryoRows.some((row) => row.semen_id === consumption.semen_id));
      if (unusedSemen) {
        toast({ title: "Erro", description: `Associe o sêmen "${semenNameById.get(unusedSemen.semen_id) || "selecionado"}" a pelo menos uma linha.`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const insertedSemenUsageIds: string[] = [];
    try {
      const embryoDetails = embryoRows.map((row) => ({
        sire_id: row.sire_id,
        recipient_id: row.recipient_id,
        semen_id: row.semen_id || null,
      }));

      for (const consumption of semenConsumptions) {
        const quantityUsed = Number(consumption.quantity_used || 0);
        if (Number.isNaN(quantityUsed) || quantityUsed <= 0) {
          throw new Error("Quantidade de sêmen inválida.");
        }

        const { data: insertedUsage, error: semenUsageError } = await supabase
          .from("semen_utilizations" as any)
          .insert({
            semen_id: consumption.semen_id,
            aspiration_id: secondFinalizeRecord.id,
            utilization_date: secondFinalizeRecord.aspiration_date || format(new Date(), "yyyy-MM-dd"),
            description: `Consumo de sêmen na aspiração ${secondFinalizeRecord.code} - ${secondFinalizeRecord.name}`,
            quantity_used: quantityUsed,
          })
          .select("id")
          .single();

        if (semenUsageError) throw semenUsageError;
        if (insertedUsage?.id) {
          insertedSemenUsageIds.push(insertedUsage.id);
        }
      }

      const { error: updateError } = await supabase
        .from("aspiration_management")
        .update({
          status: "finalized",
          embryo_count: embryoCount,
          embryo_details: embryoDetails as any,
          veterinarian_id: finalizeVeterinarianId || null,
          transfer_date: finalizeTransferDate ? format(finalizeTransferDate, "yyyy-MM-dd") : null,
        } as any)
        .eq("id", secondFinalizeRecord.id);
      if (updateError) throw updateError;

      await createEmbryoTransfersForUsage(
        secondFinalizeRecord,
        null,
        embryoDetails,
        finalizeTransferDate,
        finalizeVeterinarianId,
        secondFinalizeRecord.laboratory_id || "",
      );

      toast({ title: "Sucesso", description: "Aspiração finalizada e registros de pós transferência criados com sucesso." });
      setSecondFinalizeOpen(false);
      setSecondFinalizeRecord(null);
      setEmbryoCount(0);
      setEmbryoRows([]);
      setFinalizeVeterinarianId("");
      setFinalizeTransferDate(null);
      setDefaultSireId("");
      setDefaultSemenId("");
      setSemenConsumptions([]);
      setSemenForm({ semen_id: "", quantity_used: "" });
      await Promise.allSettled([fetchDropdownData(), fetchRecords()]);
    } catch (error) {
      console.error("Error second finalize:", error);
      if (insertedSemenUsageIds.length > 0) {
        await supabase.from("semen_utilizations" as any).delete().in("id", insertedSemenUsageIds);
      }
      toast({ title: "Erro", description: "Erro ao finalizar aspiração.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeClick = async (record: AspirationRecord) => {
    if (record.is_batch_purchase) {
      await openBatchUsageModal(record);
      return;
    }

    if (record.status === "pending") {
      setEditingBatchUsage(null);
      setFirstFinalizeRecord(record);
      setFirstFinalizeData({
        aspiration_date: null,
        laboratory_id: "",
        oocyte_count: "",
        quantity_used: "1",
        embryo_count: "",
        veterinarian_id: "",
        transfer_date: null,
      });
      setFirstFinalizeOpen(true);
    } else if (record.status === "in_progress") {
      setSecondFinalizeRecord(record);
      setEmbryoCount(0);
      setEmbryoRows([]);
      setFinalizeVeterinarianId("");
      setFinalizeTransferDate(null);
      setDefaultSireId("");
      setDefaultSemenId("");
      setSemenConsumptions([]);
      setSemenForm({ semen_id: "", quantity_used: "" });
      setSecondFinalizeOpen(true);
    }
  };

  const handleEmbryoCountChange = (count: number) => {
    setEmbryoCount(count);
    const newRows = Array.from({ length: count }, (_, i) => {
      return embryoRows[i] || getDefaultEmbryoRow();
    });
    setEmbryoRows(newRows);
  };

  const handleDeleteBatchUsage = async () => {
    if (!usageToDelete || !selectedRecord) return;

    try {
      const { error } = await supabase
        .from("aspiration_batch_utilizations" as any)
        .delete()
        .eq("id", usageToDelete.id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Movimentação do lote excluída com sucesso." });
      setUsageDeleteOpen(false);
      setUsageToDelete(null);
      setEditingBatchUsage(null);
      await Promise.all([fetchBatchUtilizations(selectedRecord.id), fetchRecords()]);
    } catch (error) {
      console.error("Error deleting aspiration batch usage:", error);
      toast({ title: "Erro", description: "Erro ao excluir movimentação do lote.", variant: "destructive" });
    }
  };

  const fetchAspirationFinancial = async (aspirationId: string) => {
    setLoadingFinancial(true);
    try {
      // Fetch expense allocations (accounts payable)
      const { data: expenseAllocations, error: expError } = await supabase
        .from("accounts_payable_item_allocations")
        .select(`
          id, allocation_type, account_payable_item_id,
          accounts_payable_items!inner (
            total_price, account_payable_id, product_id, quantity, unit_price,
            accounts_payable!inner (
              id, document_number, due_date, payment_date, status, supplier_id
            )
          )
        `)
        .eq("aspiration_id", aspirationId);

      // Fetch revenue allocations (accounts receivable)
      const { data: revenueAllocations, error: revError } = await supabase
        .from("accounts_receivable_item_allocations")
        .select(`
          id, allocation_type, account_receivable_item_id,
          accounts_receivable_items!inner (
            total_price, account_receivable_id, product_id, quantity, unit_price,
            accounts_receivable!inner (
              id, document_number, due_date, payment_date, status, creditor_id
            )
          )
        `)
        .eq("aspiration_id", aspirationId);

      if (expError) throw expError;
      if (revError) throw revError;

      const allRecords: AspirationFinancialRecord[] = [];

      // Process expenses
      if (expenseAllocations && expenseAllocations.length > 0) {
        const supplierIds = new Set<string>();
        expenseAllocations.forEach((a: any) => {
          const sid = a.accounts_payable_items?.accounts_payable?.supplier_id;
          if (sid) supplierIds.add(sid);
        });

        const suppliersMap = new Map<string, string>();
        if (supplierIds.size > 0) {
          const { data: suppliers } = await supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds));
          (suppliers || []).forEach((s: any) => suppliersMap.set(s.id, s.name));
        }

        const apIds = [...new Set(expenseAllocations.map((a: any) => a.accounts_payable_items?.accounts_payable?.id).filter(Boolean))];
        const paidAmountsMap = new Map<string, number>();
        if (apIds.length > 0) {
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: payments } = await supabase
            .from("accounts_payable_payments")
            .select("account_payable_id, amount_paid, payment_date")
            .in("account_payable_id", apIds)
            .lte("payment_date", today);
          (payments || []).forEach((p: any) => {
            paidAmountsMap.set(p.account_payable_id, (paidAmountsMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0));
          });
        }

        expenseAllocations.forEach((a: any) => {
          const item = a.accounts_payable_items;
          const ap = item?.accounts_payable;
          const apId = ap?.id || "";
          allRecords.push({
            id: a.id,
            document_number: ap?.document_number || null,
            due_date: ap?.due_date || "",
            payment_date: ap?.payment_date || null,
            status: ap?.status || "",
            supplier_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null,
            creditor_name: null,
            allocation_type: a.allocation_type,
            item_total_price: item?.total_price || 0,
            account_payable_id: apId,
            account_receivable_id: "",
            paid_amount: paidAmountsMap.get(apId) || 0,
            record_type: 'expense',
          });
        });
      }

      // Process revenues
      if (revenueAllocations && revenueAllocations.length > 0) {
        const creditorIds = new Set<string>();
        revenueAllocations.forEach((a: any) => {
          const cid = a.accounts_receivable_items?.accounts_receivable?.creditor_id;
          if (cid) creditorIds.add(cid);
        });

        const creditorsMap = new Map<string, string>();
        if (creditorIds.size > 0) {
          const { data: creditors } = await supabase.from("suppliers").select("id, name").in("id", Array.from(creditorIds));
          (creditors || []).forEach((c: any) => creditorsMap.set(c.id, c.name));
        }

        const arIds = [...new Set(revenueAllocations.map((a: any) => a.accounts_receivable_items?.accounts_receivable?.id).filter(Boolean))];
        const paidRecAmountsMap = new Map<string, number>();
        if (arIds.length > 0) {
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: payments } = await supabase
            .from("accounts_receivable_payments")
            .select("account_receivable_id, amount_paid, payment_date")
            .in("account_receivable_id", arIds)
            .lte("payment_date", today);
          (payments || []).forEach((p: any) => {
            paidRecAmountsMap.set(p.account_receivable_id, (paidRecAmountsMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0));
          });
        }

        revenueAllocations.forEach((a: any) => {
          const item = a.accounts_receivable_items;
          const ar = item?.accounts_receivable;
          const arId = ar?.id || "";
          allRecords.push({
            id: a.id,
            document_number: ar?.document_number || null,
            due_date: ar?.due_date || "",
            payment_date: ar?.payment_date || null,
            status: ar?.status || "",
            supplier_name: null,
            creditor_name: ar?.creditor_id ? creditorsMap.get(ar.creditor_id) || null : null,
            allocation_type: a.allocation_type,
            item_total_price: item?.total_price || 0,
            account_payable_id: "",
            account_receivable_id: arId,
            paid_amount: paidRecAmountsMap.get(arId) || 0,
            record_type: 'revenue',
          });
        });
      }

      setFinancialRecords(allRecords);
    } catch (error) {
      console.error("Error fetching aspiration financial:", error);
      setFinancialRecords([]);
    } finally {
      setLoadingFinancial(false);
    }
  };

  const getAllocationTypeLabel = (type: string) => {
    switch (type) {
      case "animal": return "Animal";
      case "pregnancy": return "Prenhez";
      case "embryo_transfer": return "Pós Transf. Emb.";
      case "aspiration": return "Aspiração";
      default: return type;
    }
  };

  const getFilteredFinRecords = () => {
    if (financialViewMode === "pagos") {
      // Include records that have any payment (via installments or fully paid status)
      return financialRecords.filter(r => {
        const hasPaidInstallments = r.paid_amount > 0;
        const isFullyPaid = r.status === "paid";
        return hasPaidInstallments || isFullyPaid;
      }).map(r => {
        // For fully paid records without installment payments, use total as paid amount
        const effectivePaid = r.paid_amount > 0 ? r.paid_amount : (r.status === "paid" ? r.item_total_price : 0);
        return { ...r, paid_amount: effectivePaid };
      });
    }
    return financialRecords;
  };

  const generateAspirationFinancialPDF = async (tipo: "resumido" | "detalhado") => {
    try {
      const doc = new jsPDF();
      const name = selectedRecord?.name || "Aspiração";
      const code = selectedRecord?.code || "";

      doc.setFontSize(16);
      doc.text(`Relatório Financeiro - ${name} (Cód: ${code})`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 28);
      doc.text(`Modo: ${financialViewMode === "pagos" ? "Pagos até Hoje" : "Geral"}`, 14, 34);

      const records = getFilteredFinRecords();
      const despesas = records.filter(r => r.record_type === 'expense');
      const receitas = records.filter(r => r.record_type === 'revenue');
      const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
      const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
      const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
      const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
      const saldo = financialViewMode === "pagos"
        ? totalPagoReceitas - totalPagoDespesas
        : totalReceitas - totalDespesas;

      if (tipo === "resumido") {
        let startY = 42;

        // Despesas table
        if (despesas.length > 0) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Despesas", 14, startY);
          startY += 6;
          autoTable(doc, {
            startY,
            head: [["Número", "Fornecedor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Pago" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)],
            body: despesas.map(r => [
              r.document_number || "-",
              r.supplier_name || "-",
              getAllocationTypeLabel(r.allocation_type),
              r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []),
              r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
              r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
              r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : r.status === "pending" ? "Pendente" : r.status,
            ]),
            theme: "grid",
            headStyles: { fillColor: [66, 66, 66] },
          });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // Receitas table
        if (receitas.length > 0) {
          if (startY > 250) { doc.addPage(); startY = 20; }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Receitas", 14, startY);
          startY += 6;
          autoTable(doc, {
            startY,
            head: [["Número", "Credor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Recebido" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)],
            body: receitas.map(r => [
              r.document_number || "-",
              r.creditor_name || "-",
              getAllocationTypeLabel(r.allocation_type),
              r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []),
              r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
              r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
              r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : r.status === "pending" ? "Pendente" : r.status,
            ]),
            theme: "grid",
            headStyles: { fillColor: [66, 66, 66] },
          });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // Summary footer
        if (startY > 260) { doc.addPage(); startY = 20; }
        if (financialViewMode === "pagos") {
          autoTable(doc, {
            startY,
            head: [["Total Despesas Pagas", "Total Receitas Recebidas", "Saldo"]],
            body: [[
              totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            ]],
            theme: "grid",
            headStyles: { fillColor: [100, 100, 100] },
            bodyStyles: { fontStyle: "bold" },
          });
        } else {
          autoTable(doc, {
            startY,
            head: [["Total Despesas", "Total Receitas", "Saldo"]],
            body: [[
              totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            ]],
            theme: "grid",
            headStyles: { fillColor: [100, 100, 100] },
            bodyStyles: { fontStyle: "bold" },
          });
        }
      } else {
        // Detalhado
        const expenseAPIds = [...new Set(despesas.map(r => r.account_payable_id).filter(Boolean))];
        const revenueARIds = [...new Set(receitas.map(r => r.account_receivable_id).filter(Boolean))];

        const { data: expItems } = expenseAPIds.length > 0
          ? await supabase.from("accounts_payable_items").select("*, products(name)").in("account_payable_id", expenseAPIds)
          : { data: [] };
        const { data: revItems } = revenueARIds.length > 0
          ? await supabase.from("accounts_receivable_items").select("*, products(name)").in("account_receivable_id", revenueARIds)
          : { data: [] };

        const expItemsByAP = new Map<string, any[]>();
        (expItems || []).forEach((item: any) => {
          const list = expItemsByAP.get(item.account_payable_id) || [];
          list.push(item);
          expItemsByAP.set(item.account_payable_id, list);
        });

        const revItemsByAR = new Map<string, any[]>();
        (revItems || []).forEach((item: any) => {
          const list = revItemsByAR.get(item.account_receivable_id) || [];
          list.push(item);
          revItemsByAR.set(item.account_receivable_id, list);
        });

        let currentY = 42;

        // Despesas section
        if (despesas.length > 0) {
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text("Despesas", 14, currentY);
          currentY += 8;

          despesas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. Número: ${record.document_number || "-"} | Fornecedor: ${record.supplier_name || "-"}`, 14, currentY);
            currentY += 6;
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY);
            currentY += 4;
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Pago: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY);
            currentY += 6;

            const items = expItemsByAP.get(record.account_payable_id) || [];
            if (items.length > 0) {
              autoTable(doc, {
                startY: currentY,
                head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]],
                body: items.map((it: any) => [
                  it.products?.name || "-", it.quantity,
                  it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                  it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                ]),
                theme: "grid",
                headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: 20, right: 20 },
              });
              currentY = (doc as any).lastAutoTable.finalY + 8;
            } else { currentY += 4; }
          });
        }

        // Receitas section
        if (receitas.length > 0) {
          if (currentY > 250) { doc.addPage(); currentY = 20; }
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text("Receitas", 14, currentY);
          currentY += 8;

          receitas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. Número: ${record.document_number || "-"} | Credor: ${record.creditor_name || "-"}`, 14, currentY);
            currentY += 6;
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY);
            currentY += 4;
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Recebido: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY);
            currentY += 6;

            const items = revItemsByAR.get(record.account_receivable_id) || [];
            if (items.length > 0) {
              autoTable(doc, {
                startY: currentY,
                head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]],
                body: items.map((it: any) => [
                  it.products?.name || "-", it.quantity,
                  it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                  it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                ]),
                theme: "grid",
                headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: 20, right: 20 },
              });
              currentY = (doc as any).lastAutoTable.finalY + 8;
            } else { currentY += 4; }
          });
        }

        // Summary footer
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        if (financialViewMode === "pagos") {
          doc.text(`Total Despesas Pagas: ${totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
          currentY += 7;
          doc.text(`Total Receitas Recebidas: ${totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
          currentY += 7;
          doc.text(`Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
        } else {
          doc.text(`Total Despesas: ${totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
          currentY += 7;
          doc.text(`Total Receitas: ${totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
          currentY += 7;
          doc.text(`Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
        }
      }

      doc.save(`financeiro_aspiracao_${name.replace(/\s+/g, "_")}_${tipo}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const generateAspirationFinancialExcel = () => {
    const records = getFilteredFinRecords();
    const despesas = records.filter(r => r.record_type === 'expense');
    const receitas = records.filter(r => r.record_type === 'revenue');
    const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
    const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
    const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
    const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
    const saldo = financialViewMode === "pagos"
      ? totalPagoReceitas - totalPagoDespesas
      : totalReceitas - totalDespesas;
    const isPagos = financialViewMode === "pagos";

    const wb = XLSX.utils.book_new();

    // Despesas sheet
    const despData = despesas.map(r => ({
      "Número": r.document_number || "-",
      "Fornecedor": r.supplier_name || "-",
      "Tipo Alocação": getAllocationTypeLabel(r.allocation_type),
      "Valor Total": r.item_total_price,
      ...(isPagos ? { "Pago": r.paid_amount } : {}),
      "Vencimento": r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Pagamento": r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Status": r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : r.status === "pending" ? "Pendente" : r.status,
    }));
    const wsDespesas = XLSX.utils.json_to_sheet(despData);
    XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas");

    // Receitas sheet
    const recData = receitas.map(r => ({
      "Número": r.document_number || "-",
      "Credor": r.creditor_name || "-",
      "Tipo Alocação": getAllocationTypeLabel(r.allocation_type),
      "Valor Total": r.item_total_price,
      ...(isPagos ? { "Recebido": r.paid_amount } : {}),
      "Vencimento": r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Pagamento": r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Status": r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : r.status === "pending" ? "Pendente" : r.status,
    }));
    const wsReceitas = XLSX.utils.json_to_sheet(recData);
    XLSX.utils.book_append_sheet(wb, wsReceitas, "Receitas");

    // Resumo sheet
    const resumoData = isPagos
      ? [{ "Descrição": "Total Despesas Pagas", "Valor": totalPagoDespesas }, { "Descrição": "Total Receitas Recebidas", "Valor": totalPagoReceitas }, { "Descrição": "Saldo", "Valor": saldo }]
      : [{ "Descrição": "Total Despesas", "Valor": totalDespesas }, { "Descrição": "Total Receitas", "Valor": totalReceitas }, { "Descrição": "Saldo", "Valor": saldo }];
    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const name = selectedRecord?.name || "Aspiracao";
    XLSX.writeFile(wb, `financeiro_aspiracao_${name.replace(/\s+/g, "_")}.xlsx`);
    toast({ title: "Excel gerado com sucesso!" });
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
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão de Aspirações</h1>
              <p className="text-sm text-muted-foreground">Acompanhamento de aspirações</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal("create")} className="h-10 gap-2 rounded-lg px-4 shadow-sm">
            <Plus className="h-4 w-4" />
            Cadastrar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Listagem de aspirações</p>
            <p className="text-xs text-muted-foreground">Mais densidade visual para leitura operacional e financeira.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-9 gap-2 rounded-lg border-border/70 bg-background/90 px-3">
              <Filter className="h-4 w-4" />
              {showFilters ? "Ocultar Filtros" : "Exibir Filtros"}
            </Button>
            {hasFiltered && filteredRecords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleExportExcel} className="h-9 gap-2 rounded-lg border-border/70 bg-background/90 px-3">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" onClick={handleExportPDF} className="h-9 gap-2 rounded-lg border-border/70 bg-background/90 px-3">
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-5 rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
            <div className="mb-3">
              <p className="text-sm font-semibold text-foreground">Filtros</p>
              <p className="text-xs text-muted-foreground">Refine a busca sem alterar o fluxo principal da tela.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Nome</Label>
                <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filtrar por nome..." className="mt-1 h-10 rounded-lg" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Raça</Label>
                <Select value={filterBreed} onValueChange={setFilterBreed}>
                  <SelectTrigger className="mt-1 h-10 rounded-lg"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {breeds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Fazenda</Label>
                <Select value={filterFarm} onValueChange={setFilterFarm}>
                  <SelectTrigger className="mt-1 h-10 rounded-lg"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ownFarms.length > 0 && (
                      <>
                        <SelectItem value="header-own" disabled className="font-semibold">Fazendas Próprias</SelectItem>
                        {ownFarms.map(f => <SelectItem key={`own-${f.id}`} value={`own-${f.id}`}>{f.name}</SelectItem>)}
                      </>
                    )}
                    {thirdPartyFarms.length > 0 && (
                      <>
                        <SelectItem value="header-third" disabled className="font-semibold border-t mt-2 pt-2">Fazendas Terceiras</SelectItem>
                        {thirdPartyFarms.map(f => <SelectItem key={`tp-${f.id}`} value={`third_party-${f.id}`}>{f.name}</SelectItem>)}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1 h-10 rounded-lg"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="finalized">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Leilão</Label>
                <Select value={filterAuction} onValueChange={setFilterAuction}>
                  <SelectTrigger className="mt-1 h-10 rounded-lg"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {auctions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Nome da Mãe</Label>
                <Input value={filterDamName} onChange={(e) => setFilterDamName(e.target.value)} placeholder="Filtrar por mãe..." className="mt-1 h-10 rounded-lg" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Mês Prev. Aspiração</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterExpectedMonthStart} onChange={setFilterExpectedMonthStart} />
                  <DateFilterPicker label="Fim" value={filterExpectedMonthEnd} onChange={setFilterExpectedMonthEnd} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Data Aspiração</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterAspirationDateStart} onChange={setFilterAspirationDateStart} />
                  <DateFilterPicker label="Fim" value={filterAspirationDateEnd} onChange={setFilterAspirationDateEnd} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Data Transferência</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterTransferDateStart} onChange={setFilterTransferDateStart} />
                  <DateFilterPicker label="Fim" value={filterTransferDateEnd} onChange={setFilterTransferDateEnd} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleClearFilters} className="h-9 rounded-lg px-3">Limpar Filtros</Button>
              <Button onClick={handleApplyFilters} className="h-9 rounded-lg px-3">
                <Search className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </div>
        )}

        {!hasFiltered && (
          <p className="text-sm text-muted-foreground mb-4">Exibindo as 5 últimas aspirações. Use os filtros para buscar registros específicos.</p>
        )}

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <Table className="table-sticky-first table-sticky-last">
                <TableHeader className="bg-muted/35 [&_tr]:border-border/70">
                   <TableRow>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Código</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Nome</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Raça</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fazenda</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mês Prev. Aspiração</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data Aspiração</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data Transferência</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Qtd. Embriões</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</TableHead>
                    <TableHead className="h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                         Nenhum registro encontrado.
                       </TableCell>
                     </TableRow>
                  ) : (
                    paginatedRecords.map((record) => (
                      <TableRow key={record.id} className="border-border/60 hover:bg-muted/25">
                        <TableCell className="px-4 py-3 text-sm font-semibold text-foreground">{record.code}</TableCell>
                        <TableCell className="px-4 py-3 font-medium text-foreground">{record.name}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">{getBreedName(record.breed_id)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">{getFarmName(record.farm_id, record.farm_type)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {record.expected_aspiration_month
                            ? format(new Date(record.expected_aspiration_month + "T12:00:00"), "MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {record.aspiration_date
                            ? format(new Date(record.aspiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {record.transfer_date
                            ? format(new Date(record.transfer_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {record.embryo_count ?? "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold hover:bg-transparent",
                            record.status === "pending"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : record.status === "in_progress"
                              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                              : record.status === "finalized"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-sky-200 bg-sky-50 text-sky-700"
                          )}>
                            {getStatusLabel(record.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="icon" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => handleOpenModal("view", record)} title="Visualizar">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {record.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => handleOpenModal("edit", record)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => { setRecordToDelete(record); setDeleteDialogOpen(true); }} title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleFinalizeClick(record)} title="Iniciar Aspiração" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {record.is_batch_purchase && record.status === "in_progress" && (
                              <Button variant="ghost" size="icon" onClick={() => void handleFinalizeClick(record)} title="Consumir nova unidade do lote" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {!record.is_batch_purchase && record.status === "in_progress" && (
                              <Button variant="ghost" size="icon" onClick={() => void handleFinalizeClick(record)} title="Finalizar" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {record.status !== "sold" && (
                              <Button variant="ghost" size="icon" className="h-10 md:h-8 w-10 md:w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => handleOpenSaleModal(record)} title="Venda">
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                            {record.status === "finalized" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleFinancialReleased(record)}
                                title={record.financial_released ? "Desabilitar Liberado Financeiro" : "Liberado Financeiro"}
                                className={cn(
                                  "h-10 md:h-8 w-10 md:w-8 rounded-lg hover:bg-muted/60",
                                  record.financial_released ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} de {filteredRecords.length} registros
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={cn(currentPage === 1 && "pointer-events-none opacity-50", "cursor-pointer")}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                      .map((page, idx, arr) => {
                        const elements = [];
                        if (idx > 0 && page - arr[idx - 1] > 1) {
                          elements.push(<PaginationItem key={`ellipsis-${page}`}><span className="px-2">...</span></PaginationItem>);
                        }
                        elements.push(
                          <PaginationItem key={page}>
                            <PaginationLink
                              isActive={page === currentPage}
                              onClick={() => setCurrentPage(page)}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                        return elements;
                      })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={cn(currentPage === totalPages && "pointer-events-none opacity-50", "cursor-pointer")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create/Edit/View Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "view" ? "Visualizar Registro" : modalMode === "edit" ? "Editar Registro" : "Novo Registro de Aspiração"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "proprietarios" && selectedRecord) { fetchClients().then(() => fetchAspirationSales(selectedRecord.id)); } if (v === "leilao" && selectedRecord) { fetchAspirationSales(selectedRecord.id); } }}>
            <TabsList
              className={cn(
                "flex w-full lg:grid",
                formData.is_batch_purchase
                  ? modalMode === "view" && selectedRecord?.status === "finalized"
                    ? "lg:grid-cols-7"
                    : "lg:grid-cols-6"
                  : modalMode === "view" && selectedRecord?.status === "finalized"
                  ? "lg:grid-cols-6"
                  : "lg:grid-cols-5",
              )}
            >
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              {modalMode === "view" && selectedRecord?.status === "finalized" && (
                <TabsTrigger value="resultado">Resultado</TabsTrigger>
              )}
              <TabsTrigger value="financeiro" disabled={modalMode === "create"}>Financeiro</TabsTrigger>
              {formData.is_batch_purchase && (
                <TabsTrigger value="estoque" disabled={modalMode === "create"}>
                  Estoque
                </TabsTrigger>
              )}
              <TabsTrigger value="leilao" disabled={modalMode === "create"}>Leilão</TabsTrigger>
              <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={modalMode === "view"} />
                </div>
                <div>
                  <Label>Mês Previsto de Aspiração</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.expected_aspiration_month && "text-muted-foreground")} disabled={modalMode === "view"}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expected_aspiration_month ? format(formData.expected_aspiration_month, "MM/yyyy", { locale: ptBR }) : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={formData.expected_aspiration_month || undefined} onSelect={(date) => setFormData({ ...formData, expected_aspiration_month: date || null })} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Quantidade de Oócitos</Label>
                  <Input value={selectedRecord?.oocyte_count ?? ""} disabled placeholder="Preenchido ao iniciar a aspiração" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Raça</Label>
                  <Select value={formData.breed_id} onValueChange={(v) => setFormData({ ...formData, breed_id: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{breeds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fazenda</Label>
                  <Select value={formData.farm} onValueChange={(v) => setFormData({ ...formData, farm: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {ownFarms.length > 0 && (
                        <>
                          <SelectItem value="header-own" disabled className="font-semibold">Fazendas Próprias</SelectItem>
                          {ownFarms.map(f => <SelectItem key={`own-${f.id}`} value={`own-${f.id}`}>{f.name}</SelectItem>)}
                        </>
                      )}
                      {thirdPartyFarms.length > 0 && (
                        <>
                          <SelectItem value="header-third" disabled className="font-semibold border-t mt-2 pt-2">Fazendas Terceiras</SelectItem>
                          {thirdPartyFarms.map(f => <SelectItem key={`third_party-${f.id}`} value={`third_party-${f.id}`}>{f.name}</SelectItem>)}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Leilão</Label>
                  <Select value={formData.auction_id} onValueChange={(v) => setFormData({ ...formData, auction_id: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{auctions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote Leilão</Label>
                  <Input value={formData.auction_lot} onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })} disabled={modalMode === "view"} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <Checkbox
                    id="aspiration-batch-purchase"
                    checked={formData.is_batch_purchase}
                    onCheckedChange={(checked) =>
                      setFormData((current) => ({
                        ...current,
                        is_batch_purchase: Boolean(checked),
                        batch_quantity: checked ? current.batch_quantity || "1" : "",
                      }))
                    }
                    disabled={modalMode === "view"}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="aspiration-batch-purchase">Compra em lote</Label>
                    <p className="text-xs text-muted-foreground">
                      Ativa o controle de estoque por pacote de aspiração, sem alterar o fluxo dos cadastros normais.
                    </p>
                  </div>
                </div>

                {formData.is_batch_purchase && (
                  <div>
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.batch_quantity}
                      onChange={(e) => setFormData({ ...formData, batch_quantity: e.target.value })}
                      disabled={modalMode === "view"}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Observação</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  disabled={modalMode === "view"}
                  rows={4}
                  placeholder="Digite uma observação para este cadastro..."
                />
              </div>
            </TabsContent>

            <TabsContent value="genealogia" className="space-y-6 mt-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Doadora</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Matriz (Mãe)</Label>
                    {modalMode === "view" ? (
                      <Input value={dams.find(d => d.id === formData.dam_id)?.name || ""} disabled />
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                            {formData.dam_id ? dams.find(d => d.id === formData.dam_id)?.name : "Selecionar matriz"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
                          <Command>
                            <CommandInput placeholder="Pesquisar por nome..." />
                            <CommandList>
                              <CommandEmpty>Nenhuma matriz encontrada.</CommandEmpty>
                              <CommandGroup>
                                {dams.map(d => (
                                  <CommandItem key={d.id} value={d.name} onSelect={() => setFormData({ ...formData, dam_id: d.id })}>
                                    <Check className={cn("mr-2 h-4 w-4", formData.dam_id === d.id ? "opacity-100" : "opacity-0")} />
                                    {d.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </div>

              {formData.dam_id && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Avós (somente exibição)</h3>
                  <div className="grid grid-cols-1 gap-6">
                    {(() => {
                      const allAnimals = [...dams, ...sires];
                      const selectedDam = allAnimals.find(d => d.id === formData.dam_id);
                      const damGrandsire = selectedDam?.sire_id ? allAnimals.find(a => a.id === selectedDam.sire_id) : null;
                      const damGranddam = selectedDam?.dam_id ? allAnimals.find(a => a.id === selectedDam.dam_id) : null;
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

            {modalMode === "view" && selectedRecord?.status === "finalized" && (
              <TabsContent value="resultado" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Data da Aspiração</Label>
                    <p className="font-medium">{selectedRecord.aspiration_date ? format(new Date(selectedRecord.aspiration_date + "T00:00:00"), "dd/MM/yyyy") : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Veterinário</Label>
                    <p className="font-medium">{selectedRecord.veterinarian_id ? veterinarians.find(v => v.id === selectedRecord.veterinarian_id)?.name || "-" : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Laboratório</Label>
                    <p className="font-medium">{selectedRecord.laboratory_id ? laboratories.find(l => l.id === selectedRecord.laboratory_id)?.name || "-" : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Data da Transferência</Label>
                    <p className="font-medium">{(selectedRecord as any).transfer_date ? format(new Date((selectedRecord as any).transfer_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Quantidade de Embriões</Label>
                    <p className="font-medium">{selectedRecord.embryo_count || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Quantidade de Oócitos</Label>
                    <p className="font-medium">{selectedRecord.oocyte_count || "-"}</p>
                  </div>
                </div>

                {savedSemenConsumptions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Consumo de Sêmen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {savedSemenConsumptions.map((consumption) => (
                        <div key={consumption.id} className="rounded-lg border p-3">
                          <p className="font-medium">{semenNameById.get(consumption.semen_id) || "Sêmen não encontrado"}</p>
                          <p className="text-sm text-muted-foreground">Quantidade: {formatQuantity(consumption.quantity_used)}</p>
                          <p className="text-sm text-muted-foreground">Data: {formatDateBR(consumption.utilization_date)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecord.embryo_details && (selectedRecord.embryo_details as EmbryoDetail[]).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Embriões</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table className="table-sticky-first">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Reprodutor (Pai)</TableHead>
                            {(selectedRecord.embryo_details as EmbryoDetail[]).some((embryo) => Boolean(embryo.semen_id)) && (
                              <TableHead>Sêmen</TableHead>
                            )}
                            <TableHead>Receptora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedRecord.embryo_details as EmbryoDetail[]).map((embryo, idx) => {
                            const sireName = sires.find(s => s.id === embryo.sire_id)?.name || "-";
                            return (
                              <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{sireName}</TableCell>
                                {(selectedRecord.embryo_details as EmbryoDetail[]).some((detail) => Boolean(detail.semen_id)) && (
                                  <TableCell>{embryo.semen_id ? semenNameById.get(embryo.semen_id) || "-" : "-"}</TableCell>
                                )}
                                <TableCell>{recipientNamesCache[embryo.recipient_id] || "-"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            )}

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
                      <DropdownMenuItem onClick={() => generateAspirationFinancialPDF("resumido")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateAspirationFinancialPDF("detalhado")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={generateAspirationFinancialExcel}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {loadingFinancial ? (
                <p className="text-center text-muted-foreground py-8">Carregando dados financeiros...</p>
              ) : (() => {
                const filteredRecs = getFilteredFinRecords();

                const despesas = filteredRecs.filter(r => r.record_type === 'expense');
                const receitas = filteredRecs.filter(r => r.record_type === 'revenue');
                const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
                const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
                const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
                const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
                const saldo = (financialViewMode === "pagos" ? totalPagoReceitas : totalReceitas) - (financialViewMode === "pagos" ? totalPagoDespesas : totalDespesas);

                const renderFinTable = (records: typeof filteredRecs, label: string) => (
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
                              <TableHead className="py-1 text-xs w-[14%]">{financialViewMode === "pagos" ? "Tipo" : "Tipo Alocação"}</TableHead>
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
                              return (
                              <TableRow key={record.id} className="h-7">
                                 <TableCell className="py-1 text-sm">{record.document_number || "-"}</TableCell>
                                 <TableCell className="py-1 text-sm max-w-[180px] truncate">{record.supplier_name || record.creditor_name || "-"}</TableCell>
                                 <TableCell className="py-1 text-sm">
                                   <Badge variant="outline" className="text-[12px] px-1.5 py-0">{getAllocationTypeLabel(record.allocation_type)}</Badge>
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
                                       {valorPendente > 0 ? valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                                     </TableCell>
                                   </>
                                 )}
                                 <TableCell className="py-1 text-sm">{record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                                 <TableCell className="py-1 text-sm">{record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                                 <TableCell className="py-1 text-sm">
                                   <Badge variant={record.status === "paid" ? "default" : "secondary"} className="text-[12px] px-1.5 py-0">
                                     {record.status === "paid" ? "Pago" : record.status === "pending" ? "Pendente" : record.status === "partial" ? "Parcial" : record.status}
                                   </Badge>
                                 </TableCell>
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
            </TabsContent>
            {formData.is_batch_purchase && (
              <TabsContent value="estoque" className="space-y-5 mt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-border/70">
                    <CardHeader className="pb-2">
                      <CardDescription>Quantidade do lote</CardDescription>
                      <CardTitle className="text-2xl">
                        {selectedRecord ? formatQuantity(selectedRecord.batch_quantity || 0) : "-"}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader className="pb-2">
                      <CardDescription>Quantidade utilizada</CardDescription>
                      <CardTitle className="text-2xl">{formatQuantity(currentBatchUsageTotal)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader className="pb-2">
                      <CardDescription>Saldo disponível</CardDescription>
                      <CardTitle className="text-2xl">{formatQuantity(currentBatchAvailable)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold hover:bg-transparent",
                          currentBatchAvailable <= 0
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : currentBatchAvailable <= 1
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {currentBatchAvailable <= 0 ? "Estoque zerado" : currentBatchAvailable <= 1 ? "Baixo estoque" : "Disponível"}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {currentBatchAvailable <= 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    Estoque zerado. Não é possível registrar nova utilização.
                  </div>
                )}

                <Card className="border-border/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Histórico de utilizações do lote</CardTitle>
                    <CardDescription>
                      Cada início de aspiração em lote consome saldo automaticamente e registra os dados produtivos daquela utilização.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-xl border">
                      <Table className="table-sticky-first table-sticky-last">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data Aspiração</TableHead>
                            <TableHead>Laboratório</TableHead>
                            <TableHead className="text-right">Qtd.</TableHead>
                            <TableHead className="text-right">Embriões</TableHead>
                            <TableHead>Veterinário</TableHead>
                            <TableHead>Data Transferência</TableHead>
                            {modalMode !== "view" && <TableHead className="text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchUsages.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={modalMode === "view" ? 6 : 7}
                                className="h-24 text-center text-muted-foreground"
                              >
                                Nenhuma utilização do lote registrada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            batchUsages.map((usage) => (
                              <TableRow key={usage.id}>
                                <TableCell>{format(new Date(`${usage.aspiration_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                                <TableCell>{usage.laboratory_id ? laboratories.find((laboratory) => laboratory.id === usage.laboratory_id)?.name || "-" : "-"}</TableCell>
                                <TableCell className="text-right">{formatQuantity(usage.quantity_used)}</TableCell>
                                <TableCell className="text-right">{formatQuantity(usage.embryo_count)}</TableCell>
                                <TableCell>{usage.veterinarian_id ? veterinarians.find((veterinarian) => veterinarian.id === usage.veterinarian_id)?.name || "-" : "-"}</TableCell>
                                <TableCell>
                                  {usage.transfer_date
                                    ? format(new Date(`${usage.transfer_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })
                                    : "-"}
                                </TableCell>
                                {modalMode !== "view" && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openBatchUsageModal(selectedRecord!, usage)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setUsageToDelete(usage);
                                          setUsageDeleteOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
            <TabsContent value="leilao" className="space-y-6 mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg border-b pb-2">Leilão de Compra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Leilão</Label>
                    <p className="font-medium">{getAuctionName(selectedRecord?.auction_id ?? null)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Lote</Label>
                    <p className="font-medium">{selectedRecord?.auction_lot || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg border-b pb-2">Leilão de Venda</h3>
                {loadingSales ? (
                  <p className="text-center text-muted-foreground py-4">Carregando...</p>
                ) : aspirationSales.length === 0 ? (
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
                        {aspirationSales.map((sale) => (
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
            <TabsContent value="proprietarios" className="mt-4 space-y-4">
              <OwnersTab
                entityId={selectedRecord?.id || null}
                entityType="aspiration"
                isReadOnly={modalMode === "view"}
              />

              {/* Vendas section */}
              {selectedRecord && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Vendas
                    </h3>
                  </div>
                  {loadingSales ? (
                    <p className="text-center text-muted-foreground py-8">Carregando...</p>
                  ) : aspirationSales.length === 0 ? (
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
                            {aspirationSales.map((sale) => (
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
                            {aspirationSales.reduce((s, r) => s + r.sale_value, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="font-semibold">
                            {aspirationSales.reduce((s, r) => s + r.sale_percentage, 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          {modalMode !== "view" && (
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
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
              Tem certeza que deseja excluir o registro "{recordToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={usageDeleteOpen} onOpenChange={setUsageDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação do lote</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove a utilização do estoque e os pós-transferência gerados por ela. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteBatchUsage()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* First Finalize Modal: pending → in_progress */}
      <Dialog
        open={firstFinalizeOpen}
        onOpenChange={(open) => {
          setFirstFinalizeOpen(open);
          if (!open) {
            setFirstFinalizeRecord(null);
            setEditingBatchUsage(null);
            setDefaultSireId("");
            setDefaultSemenId("");
            setSemenConsumptions([]);
            setBatchSavedSemenConsumptions([]);
            setSemenForm({ semen_id: "", quantity_used: "" });
            setFirstFinalizeData({
              aspiration_date: null,
              laboratory_id: "",
              oocyte_count: "",
              quantity_used: "1",
              embryo_count: "",
              veterinarian_id: "",
              transfer_date: null,
            });
            if (firstFinalizeRecord?.is_batch_purchase) {
              setEmbryoCount(0);
              setEmbryoRows([]);
            }
          }
        }}
      >
        <DialogContent className={cn(firstFinalizeRecord?.is_batch_purchase ? "max-w-4xl max-h-[90dvh] overflow-y-auto" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle>
              {firstFinalizeRecord?.is_batch_purchase
                ? editingBatchUsage
                  ? "Editar Utilização do Lote"
                  : "Iniciar Aspiração em Lote"
                : "Iniciar Aspiração"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={cn("grid gap-4", firstFinalizeRecord?.is_batch_purchase ? "md:grid-cols-2" : "grid-cols-1")}>
              <div>
                <Label>Data da Aspiração *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !firstFinalizeData.aspiration_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {firstFinalizeData.aspiration_date ? format(firstFinalizeData.aspiration_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={firstFinalizeData.aspiration_date || undefined} onSelect={(d) => setFirstFinalizeData({ ...firstFinalizeData, aspiration_date: d || null })} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Quantidade de Oócitos *</Label>
                <Input
                  type="number"
                  min={0}
                  value={firstFinalizeData.oocyte_count}
                  onChange={(e) => setFirstFinalizeData({ ...firstFinalizeData, oocyte_count: e.target.value })}
                />
              </div>

              {firstFinalizeRecord?.is_batch_purchase && (
                <>
                  <div>
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={firstFinalizeData.quantity_used}
                      onChange={(e) => setFirstFinalizeData({ ...firstFinalizeData, quantity_used: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saldo disponível para esta movimentação: {formatQuantity(getBatchEditableBalance(firstFinalizeRecord, editingBatchUsage))}
                    </p>
                  </div>
                  <div>
                    <Label>Quantidade de Oócitos *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={firstFinalizeData.oocyte_count}
                      onChange={(e) => setFirstFinalizeData({ ...firstFinalizeData, oocyte_count: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Quantidade de Embriões *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={firstFinalizeData.embryo_count}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFirstFinalizeData({ ...firstFinalizeData, embryo_count: value });
                        handleFirstFinalizeEmbryoCountChange(parseInt(value, 10) || 0);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Veterinário</Label>
                    <Select value={firstFinalizeData.veterinarian_id} onValueChange={(v) => setFirstFinalizeData({ ...firstFinalizeData, veterinarian_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o veterinário..." /></SelectTrigger>
                      <SelectContent>
                        {veterinarians.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data da Transferência</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !firstFinalizeData.transfer_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {firstFinalizeData.transfer_date ? format(firstFinalizeData.transfer_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={firstFinalizeData.transfer_date || undefined} onSelect={(d) => setFirstFinalizeData({ ...firstFinalizeData, transfer_date: d || null })} initialFocus className="pointer-events-auto" locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>

            {firstFinalizeRecord?.is_batch_purchase && embryoCount > 0 && (
              <>
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                      <div>
                        <Label>Reprodutor padrão</Label>
                        <Select value={defaultSireId} onValueChange={setDefaultSireId}>
                          <SelectTrigger><SelectValue placeholder="Selecione para replicar..." /></SelectTrigger>
                          <SelectContent>
                            {sires.map((sire) => <SelectItem key={sire.id} value={sire.id}>{sire.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" className="w-full" onClick={handleReplicateDefaultSire} disabled={!defaultSireId || embryoRows.length === 0}>
                          Replicar reprodutor para todas as linhas
                        </Button>
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setSemenDialogOpen(true)}>
                      Consumir Sêmen
                    </Button>
                  </div>

                  {semenConsumptions.length > 0 && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Consumos de Sêmen Selecionados</Label>
                        <div className="space-y-2">
                          {semenConsumptions.map((consumption) => {
                            const semenOption = semenOptions.find((option) => option.id === consumption.semen_id);
                            return (
                              <div key={consumption.semen_id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                                <div className="min-w-0">
                                  <p className="font-medium">{semenOption?.name || "Sêmen não encontrado"}</p>
                                  <p className="text-xs text-muted-foreground">Quantidade consumida: {consumption.quantity_used}</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSemenConsumption(consumption.semen_id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              <div className="border rounded-lg overflow-hidden">
                <Table className="table-sticky-first">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Matriz (Mãe)</TableHead>
                      <TableHead>Reprodutor (Pai)</TableHead>
                      {hasSemenColumn && (
                        <TableHead className="min-w-[220px]">
                          <div className="space-y-2">
                            <span>Sêmen</span>
                            <div className="flex gap-2">
                              <Select value={defaultSemenId} onValueChange={setDefaultSemenId}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Replicar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {semenConsumptions.map((consumption) => (
                                    <SelectItem key={consumption.semen_id} value={consumption.semen_id}>
                                      {semenNameById.get(consumption.semen_id) || "Sêmen"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" onClick={handleReplicateDefaultSemen} disabled={!defaultSemenId}>
                                Replicar
                              </Button>
                            </div>
                          </div>
                        </TableHead>
                      )}
                      <TableHead>Receptora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {embryoRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Select
                            value={row.dam_id}
                            onValueChange={(v) => {
                              const updated = [...embryoRows];
                              updated[index] = { ...updated[index], dam_id: v };
                              setEmbryoRows(updated);
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {dams.map((dam) => <SelectItem key={dam.id} value={dam.id}>{dam.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.sire_id}
                            onValueChange={(v) => {
                              const updated = [...embryoRows];
                              updated[index] = { ...updated[index], sire_id: v };
                              setEmbryoRows(updated);
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {sires.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {hasSemenColumn && (
                          <TableCell>
                            <Select
                              value={row.semen_id}
                              onValueChange={(v) => {
                                const updated = [...embryoRows];
                                updated[index] = { ...updated[index], semen_id: v };
                                setEmbryoRows(updated);
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {semenConsumptions.map((consumption) => (
                                  <SelectItem key={consumption.semen_id} value={consumption.semen_id}>
                                    {semenNameById.get(consumption.semen_id) || "Sêmen"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Input
                              value={row.recipientName}
                              placeholder="Selecione uma receptora..."
                              readOnly
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setActiveEmbryoRowIndex(index);
                                setRecipientSearchTerm("");
                                setRecipientResults([]);
                                setRecipientSearchOpen(true);
                              }}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setActiveEmbryoRowIndex(index);
                                void openQuickRecipientCreate();
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFirstFinalizeOpen(false);
                setEditingBatchUsage(null);
                if (firstFinalizeRecord?.is_batch_purchase) {
                  setEmbryoCount(0);
                  setEmbryoRows([]);
                }
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleFirstFinalize} disabled={saving}>
              {saving
                ? "Salvando..."
                : firstFinalizeRecord?.is_batch_purchase
                ? editingBatchUsage
                  ? "Salvar utilização"
                  : "Consumir do lote"
                : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Second Finalize Modal: in_progress → finalized */}
      <Dialog
        open={secondFinalizeOpen}
        onOpenChange={(open) => {
          setSecondFinalizeOpen(open);
          if (!open) {
            setSecondFinalizeRecord(null);
            setEmbryoCount(0);
            setEmbryoRows([]);
            setFinalizeVeterinarianId("");
            setFinalizeTransferDate(null);
            setDefaultSireId("");
            setDefaultSemenId("");
            setSemenConsumptions([]);
            setSemenForm({ semen_id: "", quantity_used: "" });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Aspiração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Quantidade de Embriões *</Label>
                <Input
                  type="number"
                  min={0}
                  value={embryoCount || ""}
                  onChange={(e) => handleEmbryoCountChange(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Veterinário</Label>
                <Select value={finalizeVeterinarianId} onValueChange={setFinalizeVeterinarianId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o veterinário..." /></SelectTrigger>
                  <SelectContent>
                    {veterinarians.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da Transferência</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !finalizeTransferDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {finalizeTransferDate ? format(finalizeTransferDate, "dd/MM/yyyy") : "Selecione a data..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={finalizeTransferDate || undefined} onSelect={(d) => setFinalizeTransferDate(d || null)} initialFocus className="pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                  <div>
                    <Label>Reprodutor padrão</Label>
                    <Select value={defaultSireId} onValueChange={setDefaultSireId}>
                      <SelectTrigger><SelectValue placeholder="Selecione para replicar..." /></SelectTrigger>
                      <SelectContent>
                        {sires.map((sire) => <SelectItem key={sire.id} value={sire.id}>{sire.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="w-full" onClick={handleReplicateDefaultSire} disabled={!defaultSireId || embryoRows.length === 0}>
                      Replicar reprodutor para todas as linhas
                    </Button>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => setSemenDialogOpen(true)}>
                  Consumir Sêmen
                </Button>
              </div>

              {semenConsumptions.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Consumos de Sêmen Selecionados</Label>
                    <div className="space-y-2">
                      {semenConsumptions.map((consumption) => {
                        const semenOption = semenOptions.find((option) => option.id === consumption.semen_id);
                        return (
                          <div key={consumption.semen_id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                            <div className="min-w-0">
                              <p className="font-medium">{semenOption?.name || "Sêmen não encontrado"}</p>
                              <p className="text-xs text-muted-foreground">Quantidade consumida: {consumption.quantity_used}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSemenConsumption(consumption.semen_id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            {embryoCount > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table className="table-sticky-first">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Reprodutor (Pai)</TableHead>
                      {hasSemenColumn && (
                        <TableHead className="min-w-[220px]">
                          <div className="space-y-2">
                            <span>Sêmen</span>
                            <div className="flex gap-2">
                              <Select value={defaultSemenId} onValueChange={setDefaultSemenId}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Replicar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {semenConsumptions.map((consumption) => (
                                    <SelectItem key={consumption.semen_id} value={consumption.semen_id}>
                                      {semenNameById.get(consumption.semen_id) || "Sêmen"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" onClick={handleReplicateDefaultSemen} disabled={!defaultSemenId}>
                                Replicar
                              </Button>
                            </div>
                          </div>
                        </TableHead>
                      )}
                      <TableHead>Receptora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {embryoRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Select
                            value={row.sire_id}
                            onValueChange={(v) => {
                              const updated = [...embryoRows];
                              updated[index] = { ...updated[index], sire_id: v };
                              setEmbryoRows(updated);
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              {sires.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {hasSemenColumn && (
                          <TableCell>
                            <Select
                              value={row.semen_id}
                              onValueChange={(v) => {
                                const updated = [...embryoRows];
                                updated[index] = { ...updated[index], semen_id: v };
                                setEmbryoRows(updated);
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {semenConsumptions.map((consumption) => (
                                  <SelectItem key={consumption.semen_id} value={consumption.semen_id}>
                                    {semenNameById.get(consumption.semen_id) || "Sêmen"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Input
                              value={row.recipientName}
                              placeholder="Selecione uma receptora..."
                              readOnly
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setActiveEmbryoRowIndex(index);
                                setRecipientSearchTerm("");
                                setRecipientResults([]);
                                setRecipientSearchOpen(true);
                              }}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setActiveEmbryoRowIndex(index);
                                void openQuickRecipientCreate();
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSecondFinalizeOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSecondFinalize} disabled={saving}>{saving ? "Finalizando..." : "Finalizar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipient Search Dialog */}
      <Dialog open={recipientSearchOpen} onOpenChange={setRecipientSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar Receptora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Pesquisar por nome, registro ou brinco..."
                value={recipientSearchTerm}
                onChange={(e) => setRecipientSearchTerm(e.target.value)}
                autoFocus
              />
              <Button type="button" variant="outline" onClick={() => void openQuickRecipientCreate()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {recipientSearchLoading ? (
                <div className="text-center py-4 text-muted-foreground">Buscando...</div>
              ) : recipientResults.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  {recipientSearchTerm.length < 2 ? "Digite ao menos 2 caracteres..." : "Nenhum animal encontrado."}
                </div>
              ) : (
                <Table className="table-sticky-first">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientResults.map(animal => (
                      <TableRow key={animal.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        if (activeEmbryoRowIndex !== null) {
                          const updated = [...embryoRows];
                          updated[activeEmbryoRowIndex] = {
                            ...updated[activeEmbryoRowIndex],
                            recipient_id: animal.id,
                            recipientName: `${animal.name}${animal.ear_tag ? ` - Brinco: ${animal.ear_tag}` : ""}`,
                          };
                          setEmbryoRows(updated);
                        }
                        setRecipientSearchOpen(false);
                        setActiveEmbryoRowIndex(null);
                      }}>
                        <TableCell>{animal.name}</TableCell>
                        <TableCell>{animal.ear_tag || "-"}</TableCell>
                        <TableCell>{animal.registration || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Selecionar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recipientCreateOpen}
        onOpenChange={(open) => {
          setRecipientCreateOpen(open);
          if (!open) {
            setRecipientQuickForm({
              code: 0,
              name: "",
              registration: "",
              ear_tag: "",
              breed_id: "",
              category_id: recipientCategoryIds[0] || "",
              farm: "",
              observations: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Receptora</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div>
              <Label>Código</Label>
              <Input value={recipientQuickForm.code} disabled />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={recipientQuickForm.name} onChange={(e) => setRecipientQuickForm((current) => ({ ...current, name: e.target.value }))} />
            </div>
            <div>
              <Label>Registro</Label>
              <Input value={recipientQuickForm.registration} onChange={(e) => setRecipientQuickForm((current) => ({ ...current, registration: e.target.value }))} />
            </div>
            <div>
              <Label>Brinco</Label>
              <Input value={recipientQuickForm.ear_tag} onChange={(e) => setRecipientQuickForm((current) => ({ ...current, ear_tag: e.target.value }))} />
            </div>
            <div>
              <Label>Raça</Label>
              <Select value={recipientQuickForm.breed_id} onValueChange={(value) => setRecipientQuickForm((current) => ({ ...current, breed_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {breeds.map((breed) => <SelectItem key={breed.id} value={breed.id}>{breed.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={recipientQuickForm.category_id} onValueChange={(value) => setRecipientQuickForm((current) => ({ ...current, category_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((category) => recipientCategoryIds.includes(category.id))
                    .map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Fazenda</Label>
              <Select value={recipientQuickForm.farm} onValueChange={(value) => setRecipientQuickForm((current) => ({ ...current, farm: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {ownFarms.map((farm) => <SelectItem key={`quick-own-${farm.id}`} value={`own-${farm.id}`}>{farm.name}</SelectItem>)}
                  {thirdPartyFarms.map((farm) => <SelectItem key={`quick-third-${farm.id}`} value={`third_party-${farm.id}`}>{farm.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Observação</Label>
              <Textarea value={recipientQuickForm.observations} onChange={(e) => setRecipientQuickForm((current) => ({ ...current, observations: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecipientCreateOpen(false)} disabled={recipientCreateSaving}>Cancelar</Button>
            <Button type="button" onClick={() => void handleQuickRecipientSave()} disabled={recipientCreateSaving}>
              {recipientCreateSaving ? "Salvando..." : "Salvar receptora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={semenDialogOpen}
        onOpenChange={(open) => {
          setSemenDialogOpen(open);
          if (!open) {
            setSemenForm({ semen_id: "", quantity_used: "" });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Consumir Sêmen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Sêmen</Label>
              <Select value={semenForm.semen_id} onValueChange={(value) => setSemenForm((current) => ({ ...current, semen_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o sêmen..." /></SelectTrigger>
                <SelectContent>
                  {semenOptions
                    .filter((option) => option.available_quantity > 0 && !semenConsumptions.some((item) => item.semen_id === option.id))
                    .map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} ({formatQuantity(option.available_quantity)} disponível)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={semenForm.quantity_used}
                onChange={(e) => setSemenForm((current) => ({ ...current, quantity_used: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSemenDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSaveSemenConsumption}>Salvar consumo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Modal */}
      <SaleModal
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
        tipo="aspiracao"
        record={saleRecord ? { id: saleRecord.id, name: saleRecord.name } : null}
        onSaved={fetchRecords}
      />
    </div>
  );
};

export default AnimaisGestaoAspiracoes;
