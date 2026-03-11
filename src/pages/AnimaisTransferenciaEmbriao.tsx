import { useState, useEffect, useMemo } from "react";
import { OwnersTab } from "@/components/OwnersTab";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, CheckCircle, Search, Filter, FileSpreadsheet, FileText, DollarSign, Download, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmbryoTransferRecord {
  id: string;
  code: number;
  name: string;
  expected_aspiration_month: string | null;
  aspiration_date: string | null;
  transfer_date: string | null;
  veterinarian_id: string | null;
  laboratory_id: string | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  dam_id: string | null;
  sire_id: string | null;
  recipient_id: string | null;
  farm_id: string | null;
  farm_type: string | null;
  status: string;
  store_id: string;
  aspiration_id: string | null;
}

interface Breed { id: string; name: string; }
interface Category { id: string; name: string; }
interface Auction { id: string; name: string; }
interface BreedingAnimal { id: string; name: string; sex: string; sire_id: string | null; dam_id: string | null; }
interface AnimalOption { id: string; name: string; ear_tag: number | null; registration: string | null; category_id: string | null; }
interface Laboratory { id: string; name: string; }
interface Veterinarian { id: string; name: string; }

const ITEMS_PER_PAGE = 15;
const INITIAL_ITEMS = 10;

const AnimaisTransferenciaEmbriao = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<EmbryoTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedRecord, setSelectedRecord] = useState<EmbryoTransferRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<EmbryoTransferRecord | null>(null);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [recordToFinalize, setRecordToFinalize] = useState<EmbryoTransferRecord | null>(null);
  const [finalizeUltrasoundDate, setFinalizeUltrasoundDate] = useState<Date | null>(null);
  const [finalizeValidation, setFinalizeValidation] = useState<"prenha" | "vazia" | "">("");
  const [finalizeExpectedBirthMonth, setFinalizeExpectedBirthMonth] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("dados");
  const [storeId, setStoreId] = useState<string | null>(null);

  // Financial state
  interface TEFinancialRecord {
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
    is_rateio?: boolean;
  }
  const [financialRecords, setFinancialRecords] = useState<TEFinancialRecord[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState("");
  const [filterBreed, setFilterBreed] = useState("");
  const [filterFarm, setFilterFarm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAuction, setFilterAuction] = useState("");
  const [filterDam, setFilterDam] = useState("");
  const [filterSire, setFilterSire] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");
  const [filterTransferDateStart, setFilterTransferDateStart] = useState<Date | null>(null);
  const [filterTransferDateEnd, setFilterTransferDateEnd] = useState<Date | null>(null);

  // Receptora search
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const debouncedRecipientSearch = useDebounce(recipientSearchTerm, 300);
  const [recipientResults, setRecipientResults] = useState<AnimalOption[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<AnimalOption | null>(null);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);

  // Recipient names cache for display
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    aspiration_date: null as Date | null,
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    dam_id: "",
    sire_id: "",
    recipient_id: "",
    farm: "",
  });

  // Dados Reprodução tab
  const [reproData, setReproData] = useState({
    aspiration_date: null as Date | null,
    transfer_date: null as Date | null,
    veterinarian_id: "",
    laboratory_id: "",
  });

  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [ownFarms, setOwnFarms] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);
  const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);

  useEffect(() => { fetchRecords(); fetchDropdownData(); }, []);

  // Load recipient names for table display
  useEffect(() => {
    const ids = records.map(r => r.recipient_id).filter(Boolean) as string[];
    const uniqueIds = [...new Set(ids)].filter(id => !recipientNames[id]);
    if (uniqueIds.length === 0) return;
    const loadNames = async () => {
      const { data } = await supabase.from("animals").select("id, name").in("id", uniqueIds);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(a => { map[a.id] = a.name; });
        setRecipientNames(prev => ({ ...prev, ...map }));
      }
    };
    loadNames();
  }, [records]);

  // Search recipients
  useEffect(() => {
    if (!debouncedRecipientSearch || debouncedRecipientSearch.length < 2 || !storeId) {
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
          .eq("is_active", true);

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
  }, [debouncedRecipientSearch, storeId]);

  const fetchRecords = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase.from("profiles").select("store_id, matrix_id").eq("id", userData.user.id).single();
      
      let resolvedStoreId = profile?.store_id || null;
      if (!resolvedStoreId) {
        const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", userData.user.id).limit(1);
        resolvedStoreId = userStores?.[0]?.store_id || null;
      }
      if (resolvedStoreId) setStoreId(resolvedStoreId);

      // Fetch all stores in the user's matrix for filtering
      let storeIds: string[] = [];
      if (profile?.matrix_id) {
        const { data: matrixStores } = await supabase
          .from("stores")
          .select("id")
          .eq("matrix_id", profile.matrix_id);
        storeIds = (matrixStores || []).map(s => s.id);
      } else if (resolvedStoreId) {
        storeIds = [resolvedStoreId];
      }

      if (storeIds.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("embryo_transfer_management")
        .select("*")
        .in("store_id", storeIds)
        .order("code", { ascending: false });
      if (error) throw error;
      setRecords((data as any[]) || []);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({ title: "Erro", description: "Erro ao carregar registros.", variant: "destructive" });
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
        ? supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", storeId!).eq("is_active", true);
      const vetQuery = matrixId
        ? supabase.from("veterinarians").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("veterinarians").select("id, name").eq("store_id", storeId!).eq("is_active", true);
      const labQuery = matrixId
        ? supabase.from("laboratories").select("id, name").eq("matrix_id", matrixId).eq("is_active", true)
        : supabase.from("laboratories").select("id, name").eq("store_id", storeId!).eq("is_active", true);

      const [breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes, vetRes, labRes] = await Promise.all([
        breedsQuery,
        categoriesQuery,
        auctionsQuery,
        breedingQuery,
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        vetQuery,
        labQuery,
      ]);

      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      const animals = breedingAnimalsRes.data || [];
      setDams(animals.filter(a => a.sex === "femea"));
      setSires(animals.filter(a => a.sex === "macho"));
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdPartyFarmsRes.data || []);
      setVeterinarians(vetRes.data || []);
      setLaboratories(labRes.data || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const getNextCode = async () => {
    if (!storeId) return 1;
    const { data } = await supabase
      .from("embryo_transfer_management")
      .select("code")
      .eq("store_id", storeId)
      .order("code", { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0].code + 1 : 1;
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", record?: EmbryoTransferRecord) => {
    setModalMode(mode);
    setActiveTab("dados");
    setSelectedRecipient(null);
    setRecipientSearchTerm("");

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({ code: nextCode, name: "", aspiration_date: null, breed_id: "", category_id: "", auction_id: "", auction_lot: "", dam_id: "", sire_id: "", recipient_id: "", farm: "" });
      setReproData({ aspiration_date: null, transfer_date: null, veterinarian_id: "", laboratory_id: "" });
      setSelectedRecord(null);
    } else if (record) {
      setSelectedRecord(record);
      let farmValue = "";
      if (record.farm_id && record.farm_type) farmValue = `${record.farm_type}-${record.farm_id}`;
      setFormData({
        code: record.code,
        name: record.name,
        aspiration_date: record.aspiration_date ? new Date(record.aspiration_date + "T12:00:00") : null,
        breed_id: record.breed_id || "",
        category_id: record.category_id || "",
        auction_id: record.auction_id || "",
        auction_lot: record.auction_lot || "",
        dam_id: record.dam_id || "",
        sire_id: record.sire_id || "",
        recipient_id: record.recipient_id || "",
        farm: farmValue,
      });
      setReproData({
        aspiration_date: record.aspiration_date ? new Date(record.aspiration_date + "T12:00:00") : null,
        transfer_date: record.transfer_date ? new Date(record.transfer_date + "T12:00:00") : null,
        veterinarian_id: record.veterinarian_id || "",
        laboratory_id: record.laboratory_id || "",
      });
      if (record.recipient_id) {
        const { data } = await supabase.from("animals").select("id, name, ear_tag, registration, category_id").eq("id", record.recipient_id).single();
        if (data) setSelectedRecipient(data);
      }
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "O nome é obrigatório.", variant: "destructive" });
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userData.user.id).single();
      if (!profile?.store_id) return;

      let farmId: string | null = null;
      let farmType: string | null = null;
      if (formData.farm) {
        const dashIndex = formData.farm.indexOf("-");
        if (dashIndex > 0) { farmType = formData.farm.substring(0, dashIndex); farmId = formData.farm.substring(dashIndex + 1); }
      }

      const recordData = {
        code: formData.code,
        name: formData.name.trim(),
        aspiration_date: formData.aspiration_date ? format(formData.aspiration_date, "yyyy-MM-dd") : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        dam_id: formData.dam_id || null,
        sire_id: formData.sire_id || null,
        recipient_id: formData.recipient_id || null,
        farm_id: farmId,
        farm_type: farmType,
        store_id: profile.store_id,
        transfer_date: reproData.transfer_date ? format(reproData.transfer_date, "yyyy-MM-dd") : null,
        veterinarian_id: reproData.veterinarian_id || null,
        laboratory_id: reproData.laboratory_id || null,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("embryo_transfer_management").insert(recordData as any);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso." });
      } else {
        const { error } = await supabase.from("embryo_transfer_management").update(recordData as any).eq("id", selectedRecord!.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso." });
      }
      setModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving record:", error);
      toast({ title: "Erro", description: "Erro ao salvar registro.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      // Check for linked accounts payable
      const { data: payableAllocations } = await supabase
        .from("accounts_payable_item_allocations")
        .select("id")
        .eq("embryo_transfer_id", recordToDelete.id)
        .limit(1);

      // Check for linked accounts receivable
      const { data: receivableAllocations } = await supabase
        .from("accounts_receivable_item_allocations")
        .select("id")
        .eq("embryo_transfer_id", recordToDelete.id)
        .limit(1);

      if ((payableAllocations && payableAllocations.length > 0) || (receivableAllocations && receivableAllocations.length > 0)) {
        toast({ title: "Exclusão não permitida", description: "Este registro possui contas a pagar ou contas a receber vinculadas.", variant: "destructive" });
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
        return;
      }

      const { error } = await supabase.from("embryo_transfer_management").delete().eq("id", recordToDelete.id);
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

  const handleFinalize = async () => {
    if (!recordToFinalize) return;
    if (!finalizeUltrasoundDate || !finalizeValidation) {
      toast({ title: "Erro", description: "Preencha a data de ultrassom e a validação.", variant: "destructive" });
      return;
    }
    if (finalizeValidation === "prenha" && !finalizeExpectedBirthMonth) {
      toast({ title: "Erro", description: "Informe o mês previsto de nascimento.", variant: "destructive" });
      return;
    }

    try {
      const newStatus = finalizeValidation === "prenha" ? "finalized_pregnant" : "finalized_empty";

      const { error } = await supabase.from("embryo_transfer_management").update({
        status: newStatus,
        ultrasound_date: format(finalizeUltrasoundDate, "yyyy-MM-dd"),
      } as any).eq("id", recordToFinalize.id);
      if (error) throw error;

      if (finalizeValidation === "prenha" && storeId) {
        const { data: codeData } = await supabase
          .from("pregnancy_management")
          .select("code")
          .eq("store_id", storeId)
          .order("code", { ascending: false })
          .limit(1);
        const nextCode = codeData && codeData.length > 0 ? codeData[0].code + 1 : 1;

        const pregnancyData = {
          code: nextCode,
          name: recordToFinalize.name,
          sex: "femea",
          expected_birth_month: finalizeExpectedBirthMonth ? format(finalizeExpectedBirthMonth, "yyyy-MM-dd") : null,
          breed_id: recordToFinalize.breed_id,
          category_id: recordToFinalize.category_id,
          auction_id: recordToFinalize.auction_id,
          auction_lot: recordToFinalize.auction_lot,
          sire_id: recordToFinalize.sire_id,
          dam_id: recordToFinalize.dam_id,
          farm_id: recordToFinalize.farm_id,
          farm_type: recordToFinalize.farm_type,
          recipient_id: recordToFinalize.recipient_id,
          store_id: storeId,
          status: "in_progress",
          aspiration_date: recordToFinalize.aspiration_date,
          transfer_date: recordToFinalize.transfer_date,
          veterinarian_id: recordToFinalize.veterinarian_id,
          laboratory_id: recordToFinalize.laboratory_id,
          ultrasound_date: format(finalizeUltrasoundDate, "yyyy-MM-dd"),
          embryo_transfer_id: recordToFinalize.id,
        };

        const { error: pregnancyError, data: newPregnancy } = await supabase.from("pregnancy_management").insert(pregnancyData as any).select("id").single();
        if (pregnancyError) throw pregnancyError;

        // Copy embryo transfer owners to pregnancy
        if (newPregnancy) {
          const { data: etOwners } = await supabase
            .from("embryo_transfer_owners")
            .select("owner_id, store_owner_id, owner_type, percentage")
            .eq("embryo_transfer_id", recordToFinalize.id);

          if (etOwners && etOwners.length > 0) {
            const { data: userData } = await supabase.auth.getUser();
            for (const owner of etOwners) {
              await supabase.from("pregnancy_owners").insert({
                pregnancy_id: newPregnancy.id,
                owner_id: (owner as any).owner_type === "store" ? null : owner.owner_id,
                store_owner_id: (owner as any).owner_type === "store" ? (owner as any).store_owner_id : null,
                owner_type: (owner as any).owner_type || "supplier",
                percentage: owner.percentage,
                created_by: userData.user?.id,
              } as any);
            }
          }
        }
      }

      toast({
        title: "Sucesso",
        description: finalizeValidation === "prenha"
          ? "Registro finalizado como Prenha. Novo registro criado na Gestão de Prenhez."
          : "Registro finalizado como Vazia.",
      });
      setFinalizeDialogOpen(false);
      setRecordToFinalize(null);
      setFinalizeUltrasoundDate(null);
      setFinalizeValidation("");
      setFinalizeExpectedBirthMonth(null);
      fetchRecords();
    } catch (error) {
      console.error("Error finalizing record:", error);
      toast({ title: "Erro", description: "Erro ao finalizar registro.", variant: "destructive" });
    }
  };

  const getBreedName = (breedId: string | null) => breedId ? breeds.find(b => b.id === breedId)?.name || "-" : "-";
  const getCategoryName = (catId: string | null) => catId ? categories.find(c => c.id === catId)?.name || "-" : "-";

  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") return ownFarms.find(f => f.id === farmId)?.name || "-";
    return thirdPartyFarms.find(f => f.id === farmId)?.name || "-";
  };

  const getDaysAfterTransfer = (transferDate: string | null) => {
    if (!transferDate) return null;
    const days = differenceInDays(new Date(), new Date(transferDate + "T12:00:00"));
    return days;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress": return "Em Andamento";
      case "finalized_pregnant": return "Finalizada: Prenha";
      case "finalized_empty": return "Finalizada: Vazia";
      default: return "Finalizado";
    }
  };

  const getDamName = (damId: string | null) => damId ? dams.find(d => d.id === damId)?.name || "-" : "-";
  const getSireName = (sireId: string | null) => sireId ? sires.find(s => s.id === sireId)?.name || "-" : "-";
  const getAuctionName = (auctionId: string | null) => auctionId ? auctions.find(a => a.id === auctionId)?.name || "-" : "-";
  const getRecipientName = (recipientId: string | null) => recipientId ? recipientNames[recipientId] || "-" : "-";

  // Financial functions
  const getAllocationTypeLabel = (type: string) => {
    switch (type) {
      case "animal": return "Animal";
      case "pregnancy": return "Prenhez";
      case "embryo_transfer": return "Pós Transf. Emb.";
      case "aspiration": return "Aspiração";
      case "aspiration_rateio": return "Rateio de Aspiração";
      default: return type;
    }
  };

  const fetchTEFinancial = async (teId: string, aspirationId?: string | null) => {
    setLoadingFinancial(true);
    try {
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
        .eq("embryo_transfer_id", teId);

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
        .eq("embryo_transfer_id", teId);

      if (expError) throw expError;
      if (revError) throw revError;

      const allRecords: TEFinancialRecord[] = [];

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
          const { data: payments } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid, payment_date").in("account_payable_id", apIds).lte("payment_date", today);
          (payments || []).forEach((p: any) => { paidAmountsMap.set(p.account_payable_id, (paidAmountsMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
        }
        expenseAllocations.forEach((a: any) => {
          const item = a.accounts_payable_items;
          const ap = item?.accounts_payable;
          const apId = ap?.id || "";
          allRecords.push({ id: a.id, document_number: ap?.document_number || null, due_date: ap?.due_date || "", payment_date: ap?.payment_date || null, status: ap?.status || "", supplier_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null, creditor_name: null, allocation_type: a.allocation_type, item_total_price: item?.total_price || 0, account_payable_id: apId, account_receivable_id: "", paid_amount: paidAmountsMap.get(apId) || 0, record_type: 'expense' });
        });
      }

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
          const { data: payments } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid, payment_date").in("account_receivable_id", arIds).lte("payment_date", today);
          (payments || []).forEach((p: any) => { paidRecAmountsMap.set(p.account_receivable_id, (paidRecAmountsMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)); });
        }
        revenueAllocations.forEach((a: any) => {
          const item = a.accounts_receivable_items;
          const ar = item?.accounts_receivable;
          const arId = ar?.id || "";
          allRecords.push({ id: a.id, document_number: ar?.document_number || null, due_date: ar?.due_date || "", payment_date: ar?.payment_date || null, status: ar?.status || "", supplier_name: null, creditor_name: ar?.creditor_id ? creditorsMap.get(ar.creditor_id) || null : null, allocation_type: a.allocation_type, item_total_price: item?.total_price || 0, account_payable_id: "", account_receivable_id: arId, paid_amount: paidRecAmountsMap.get(arId) || 0, record_type: 'revenue' });
        });
      }

      // Fetch aspiration rateio if aspirationId exists
      // Skip rateio for finalized_empty records (they are excluded from cost sharing)
      const currentRecord = records.find(r => r.id === teId);
      if (aspirationId && currentRecord?.status !== "finalized_empty") {
        // Get embryo_count from aspiration
        const { data: aspirationData } = await supabase
          .from("aspiration_management")
          .select("embryo_count")
          .eq("id", aspirationId)
          .single();
        const totalEmbryoCount = aspirationData?.embryo_count || 1;

        // Count siblings finalized as empty to subtract from divisor
        const { data: emptySiblings } = await supabase
          .from("embryo_transfer_management")
          .select("id")
          .eq("aspiration_id", aspirationId)
          .eq("status", "finalized_empty");
        const emptyCount = emptySiblings?.length || 0;
        const embryoCount = Math.max(totalEmbryoCount - emptyCount, 1);

        // Fetch aspiration expense allocations
        const { data: aspExpAllocations } = await supabase
          .from("accounts_payable_item_allocations")
          .select(`
            id, allocation_type, account_payable_item_id,
            accounts_payable_items!inner (
              total_price, account_payable_id,
              accounts_payable!inner (
                id, status, supplier_id
              )
            )
          `)
          .eq("aspiration_id", aspirationId);

        // Fetch aspiration revenue allocations
        const { data: aspRevAllocations } = await supabase
          .from("accounts_receivable_item_allocations")
          .select(`
            id, allocation_type, account_receivable_item_id,
            accounts_receivable_items!inner (
              total_price, account_receivable_id,
              accounts_receivable!inner (
                id, status, creditor_id
              )
            )
          `)
          .eq("aspiration_id", aspirationId);

        // Sum total expenses from aspiration
        let aspTotalExpense = 0;
        let aspPaidExpense = 0;
        if (aspExpAllocations && aspExpAllocations.length > 0) {
          aspExpAllocations.forEach((a: any) => {
            aspTotalExpense += a.accounts_payable_items?.total_price || 0;
          });
          // Get paid amounts for aspiration expenses
          const aspApIds = [...new Set(aspExpAllocations.map((a: any) => a.accounts_payable_items?.accounts_payable?.id).filter(Boolean))];
          if (aspApIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: aspPayments } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", aspApIds).lte("payment_date", today);
            (aspPayments || []).forEach((p: any) => { aspPaidExpense += p.amount_paid || 0; });
          }
        }

        // Sum total revenues from aspiration
        let aspTotalRevenue = 0;
        let aspPaidRevenue = 0;
        if (aspRevAllocations && aspRevAllocations.length > 0) {
          aspRevAllocations.forEach((a: any) => {
            aspTotalRevenue += a.accounts_receivable_items?.total_price || 0;
          });
          const aspArIds = [...new Set(aspRevAllocations.map((a: any) => a.accounts_receivable_items?.accounts_receivable?.id).filter(Boolean))];
          if (aspArIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: aspRecPayments } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", aspArIds).lte("payment_date", today);
            (aspRecPayments || []).forEach((p: any) => { aspPaidRevenue += p.amount_paid || 0; });
          }
        }

        // Add rateio rows (divided by embryo count)
        if (aspTotalExpense > 0) {
          allRecords.push({
            id: `rateio-expense-${aspirationId}`,
            document_number: null,
            due_date: "",
            payment_date: null,
            status: "",
            supplier_name: "Rateio de Aspiração",
            creditor_name: null,
            allocation_type: "aspiration_rateio",
            item_total_price: aspTotalExpense / embryoCount,
            account_payable_id: "",
            account_receivable_id: "",
            paid_amount: aspPaidExpense / embryoCount,
            record_type: 'expense',
            is_rateio: true,
          });
        }

        if (aspTotalRevenue > 0) {
          allRecords.push({
            id: `rateio-revenue-${aspirationId}`,
            document_number: null,
            due_date: "",
            payment_date: null,
            status: "",
            supplier_name: null,
            creditor_name: "Rateio de Aspiração",
            allocation_type: "aspiration_rateio",
            item_total_price: aspTotalRevenue / embryoCount,
            account_payable_id: "",
            account_receivable_id: "",
            paid_amount: aspPaidRevenue / embryoCount,
            record_type: 'revenue',
            is_rateio: true,
          });
        }
      }

      setFinancialRecords(allRecords);
    } catch (error) {
      console.error("Error fetching TE financial:", error);
      toast({ title: "Erro", description: "Erro ao carregar dados financeiros.", variant: "destructive" });
    } finally {
      setLoadingFinancial(false);
    }
  };

  const getFilteredFinRecords = () => {
    if (financialViewMode === "pagos") {
      return financialRecords.filter(r => r.paid_amount > 0 || r.status === "paid").map(r => {
        const effectivePaid = r.paid_amount > 0 ? r.paid_amount : (r.status === "paid" ? r.item_total_price : 0);
        return { ...r, paid_amount: effectivePaid };
      });
    }
    return financialRecords;
  };

  const generateTEFinancialPDF = async (tipo: "resumido" | "detalhado") => {
    try {
      const doc = new jsPDF();
      const name = selectedRecord?.name || "Pós TE";
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
      const saldo = financialViewMode === "pagos" ? totalPagoReceitas - totalPagoDespesas : totalReceitas - totalDespesas;

      if (tipo === "resumido") {
        let startY = 42;
        if (despesas.length > 0) {
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Despesas", 14, startY); startY += 6;
          autoTable(doc, {
            startY,
            head: [["Número", "Fornecedor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Pago" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)],
            body: despesas.map(r => [r.document_number || "-", r.supplier_name || "-", getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-", r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-", r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente"]),
            theme: "grid", headStyles: { fillColor: [66, 66, 66] },
          });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
        if (receitas.length > 0) {
          if (startY > 250) { doc.addPage(); startY = 20; }
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Receitas", 14, startY); startY += 6;
          autoTable(doc, {
            startY,
            head: [["Número", "Credor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Recebido" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)],
            body: receitas.map(r => [r.document_number || "-", r.creditor_name || "-", getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-", r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-", r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente"]),
            theme: "grid", headStyles: { fillColor: [66, 66, 66] },
          });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
        if (startY > 260) { doc.addPage(); startY = 20; }
        const summaryHead = financialViewMode === "pagos" ? [["Total Despesas Pagas", "Total Receitas Recebidas", "Saldo"]] : [["Total Despesas", "Total Receitas", "Saldo"]];
        const summaryBody = financialViewMode === "pagos"
          ? [[totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]]
          : [[totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]];
        autoTable(doc, { startY, head: summaryHead, body: summaryBody, theme: "grid", headStyles: { fillColor: [100, 100, 100] }, bodyStyles: { fontStyle: "bold" } });
      } else {
        const expenseAPIds = [...new Set(despesas.map(r => r.account_payable_id).filter(Boolean))];
        const revenueARIds = [...new Set(receitas.map(r => r.account_receivable_id).filter(Boolean))];
        const { data: expItems } = expenseAPIds.length > 0 ? await supabase.from("accounts_payable_items").select("*, products(name)").in("account_payable_id", expenseAPIds) : { data: [] };
        const { data: revItems } = revenueARIds.length > 0 ? await supabase.from("accounts_receivable_items").select("*, products(name)").in("account_receivable_id", revenueARIds) : { data: [] };
        const expItemsByAP = new Map<string, any[]>();
        (expItems || []).forEach((item: any) => { const list = expItemsByAP.get(item.account_payable_id) || []; list.push(item); expItemsByAP.set(item.account_payable_id, list); });
        const revItemsByAR = new Map<string, any[]>();
        (revItems || []).forEach((item: any) => { const list = revItemsByAR.get(item.account_receivable_id) || []; list.push(item); revItemsByAR.set(item.account_receivable_id, list); });

        let currentY = 42;
        if (despesas.length > 0) {
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Despesas", 14, currentY); currentY += 8;
          despesas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. Número: ${record.document_number || "-"} | Fornecedor: ${record.supplier_name || "-"}`, 14, currentY); currentY += 6;
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY); currentY += 4;
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Pago: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
            const items = expItemsByAP.get(record.account_payable_id) || [];
            if (items.length > 0) {
              autoTable(doc, { startY: currentY, head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]], body: items.map((it: any) => [it.products?.name || "-", it.quantity, it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]), theme: "grid", headStyles: { fillColor: [100, 100, 100], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 20, right: 20 } });
              currentY = (doc as any).lastAutoTable.finalY + 8;
            } else { currentY += 4; }
          });
        }
        if (receitas.length > 0) {
          if (currentY > 250) { doc.addPage(); currentY = 20; }
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Receitas", 14, currentY); currentY += 8;
          receitas.forEach((record, index) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`${index + 1}. Número: ${record.document_number || "-"} | Credor: ${record.creditor_name || "-"}`, 14, currentY); currentY += 6;
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY); currentY += 4;
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Recebido: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
            const items = revItemsByAR.get(record.account_receivable_id) || [];
            if (items.length > 0) {
              autoTable(doc, { startY: currentY, head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]], body: items.map((it: any) => [it.products?.name || "-", it.quantity, it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]), theme: "grid", headStyles: { fillColor: [100, 100, 100], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 20, right: 20 } });
              currentY = (doc as any).lastAutoTable.finalY + 8;
            } else { currentY += 4; }
          });
        }
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        if (financialViewMode === "pagos") {
          doc.text(`Total Despesas Pagas: ${totalPagoDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY); currentY += 7;
          doc.text(`Total Receitas Recebidas: ${totalPagoReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY); currentY += 7;
          doc.text(`Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
        } else {
          doc.text(`Total Despesas: ${totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY); currentY += 7;
          doc.text(`Total Receitas: ${totalReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY); currentY += 7;
          doc.text(`Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
        }
      }
      doc.save(`financeiro_pos_te_${name.replace(/\s+/g, "_")}_${tipo}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const generateTEFinancialExcel = () => {
    const records = getFilteredFinRecords();
    const despesas = records.filter(r => r.record_type === 'expense');
    const receitas = records.filter(r => r.record_type === 'revenue');
    const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
    const totalPagoDespesas = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
    const totalReceitas = receitas.reduce((sum, r) => sum + r.item_total_price, 0);
    const totalPagoReceitas = receitas.reduce((sum, r) => sum + r.paid_amount, 0);
    const saldo = financialViewMode === "pagos" ? totalPagoReceitas - totalPagoDespesas : totalReceitas - totalDespesas;
    const isPagos = financialViewMode === "pagos";
    const wb = XLSX.utils.book_new();

    const despData = despesas.map(r => ({ "Número": r.document_number || "-", "Fornecedor": r.supplier_name || "-", "Tipo Alocação": getAllocationTypeLabel(r.allocation_type), "Valor Total": r.item_total_price, ...(isPagos ? { "Pago": r.paid_amount } : {}), "Vencimento": r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-", "Pagamento": r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-", "Status": r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despData), "Despesas");

    const recData = receitas.map(r => ({ "Número": r.document_number || "-", "Credor": r.creditor_name || "-", "Tipo Alocação": getAllocationTypeLabel(r.allocation_type), "Valor Total": r.item_total_price, ...(isPagos ? { "Recebido": r.paid_amount } : {}), "Vencimento": r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-", "Pagamento": r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-", "Status": r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recData), "Receitas");

    const resumoData = isPagos
      ? [{ "Descrição": "Total Despesas Pagas", "Valor": totalPagoDespesas }, { "Descrição": "Total Receitas Recebidas", "Valor": totalPagoReceitas }, { "Descrição": "Saldo", "Valor": saldo }]
      : [{ "Descrição": "Total Despesas", "Valor": totalDespesas }, { "Descrição": "Total Receitas", "Valor": totalReceitas }, { "Descrição": "Saldo", "Valor": saldo }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), "Resumo");

    const name = selectedRecord?.name || "Pos_TE";
    XLSX.writeFile(wb, `financeiro_pos_te_${name.replace(/\s+/g, "_")}.xlsx`);
    toast({ title: "Excel gerado com sucesso!" });
  };

  const filteredRecords = useMemo(() => {
    if (!hasFiltered) return records.slice(0, INITIAL_ITEMS);

    return records.filter(r => {
      if (filterName && !r.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterBreed && r.breed_id !== filterBreed) return false;
      if (filterFarm && (() => {
        if (!r.farm_id || !r.farm_type) return true;
        return `${r.farm_type}-${r.farm_id}` !== filterFarm;
      })()) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterAuction && r.auction_id !== filterAuction) return false;
      if (filterDam && r.dam_id !== filterDam) return false;
      if (filterSire && r.sire_id !== filterSire) return false;
      if (filterRecipient && !getRecipientName(r.recipient_id).toLowerCase().includes(filterRecipient.toLowerCase())) return false;

      if (filterTransferDateStart && r.transfer_date) {
        if (new Date(r.transfer_date + "T12:00:00") < filterTransferDateStart) return false;
      }
      if (filterTransferDateStart && !r.transfer_date) return false;

      if (filterTransferDateEnd && r.transfer_date) {
        if (new Date(r.transfer_date + "T12:00:00") > filterTransferDateEnd) return false;
      }
      if (filterTransferDateEnd && !r.transfer_date) return false;

      return true;
    });
  }, [records, hasFiltered, filterName, filterBreed, filterFarm, filterStatus, filterAuction, filterDam, filterSire, filterRecipient, filterTransferDateStart, filterTransferDateEnd, recipientNames]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleFilter = () => {
    setHasFiltered(true);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterBreed("");
    setFilterFarm("");
    setFilterStatus("");
    setFilterAuction("");
    setFilterDam("");
    setFilterSire("");
    setFilterRecipient("");
    setFilterTransferDateStart(null);
    setFilterTransferDateEnd(null);
    setHasFiltered(false);
    setCurrentPage(1);
  };

  const getExportData = () => {
    return filteredRecords.map(r => ({
      "Código": r.code,
      "Nome": r.name,
      "Raça": getBreedName(r.breed_id),
      "Fazenda": getFarmName(r.farm_id, r.farm_type),
      "Data Transferência": r.transfer_date ? format(new Date(r.transfer_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Dias após Transf.": getDaysAfterTransfer(r.transfer_date) !== null ? `${getDaysAfterTransfer(r.transfer_date)} dias` : "-",
      "Status": getStatusLabel(r.status),
    }));
  };

  const exportExcel = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pós Transferência");
    XLSX.writeFile(wb, "pos_transferencia_embriao.xlsx");
    toast({ title: "Sucesso", description: "Relatório Excel gerado com sucesso." });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório - Pós Transferência de Embrião", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);

    const data = getExportData();
    const headers = Object.keys(data[0] || {});
    const rows = data.map(d => headers.map(h => String((d as any)[h])));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("pos_transferencia_embriao.pdf");
    toast({ title: "Sucesso", description: "Relatório PDF gerado com sucesso." });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gestão de Pós Transferência de Embrião</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento pós transferência de embrião</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Ocultar Filtros" : "Exibir Filtros"}
            </Button>
            {hasFiltered && (
              <>
                <Button variant="outline" onClick={exportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" onClick={exportPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </>
            )}
          </div>
          <Button onClick={() => handleOpenModal("create")}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="border rounded-lg p-4 mb-6 bg-card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Filtrar por nome..." />
              </div>
              <div>
                <Label>Raça</Label>
                <Select value={filterBreed} onValueChange={setFilterBreed}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {breeds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fazenda</Label>
                <Select value={filterFarm} onValueChange={setFilterFarm}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ownFarms.map(f => <SelectItem key={`own-${f.id}`} value={`own-${f.id}`}>{f.name}</SelectItem>)}
                    {thirdPartyFarms.map(f => <SelectItem key={`tp-${f.id}`} value={`third_party-${f.id}`}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="finalized_pregnant">Finalizada: Prenha</SelectItem>
                    <SelectItem value="finalized_empty">Finalizada: Vazia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leilão</Label>
                <Select value={filterAuction} onValueChange={setFilterAuction}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {auctions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome da Mãe</Label>
                <Select value={filterDam} onValueChange={setFilterDam}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {dams.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Pai</Label>
                <Select value={filterSire} onValueChange={setFilterSire}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sires.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Receptora</Label>
                <Input value={filterRecipient} onChange={e => setFilterRecipient(e.target.value)} placeholder="Filtrar por receptora..." />
              </div>
              <div>
                <Label>Data Transferência (Início)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterTransferDateStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterTransferDateStart ? format(filterTransferDateStart, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterTransferDateStart || undefined} onSelect={d => setFilterTransferDateStart(d || null)} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Data Transferência (Fim)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterTransferDateEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterTransferDateEnd ? format(filterTransferDateEnd, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterTransferDateEnd || undefined} onSelect={d => setFilterTransferDateEnd(d || null)} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClearFilters}>Limpar Filtros</Button>
              <Button onClick={handleFilter}>
                <Search className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </div>
        )}

        {!hasFiltered && (
          <p className="text-sm text-muted-foreground mb-4">Exibindo os {INITIAL_ITEMS} últimos registros. Use os filtros para ver todos.</p>
        )}

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Data Transferência</TableHead>
                    <TableHead>Dias após Transf.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((record) => {
                      const daysAfter = getDaysAfterTransfer(record.transfer_date);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>{record.code}</TableCell>
                          <TableCell>{record.name}</TableCell>
                          <TableCell>{getBreedName(record.breed_id)}</TableCell>
                          <TableCell>{getFarmName(record.farm_id, record.farm_type)}</TableCell>
                          <TableCell>
                            {record.transfer_date
                              ? format(new Date(record.transfer_date + "T12:00:00"), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {daysAfter !== null ? (
                              <span className={cn(
                                daysAfter > 35 && "font-bold text-destructive"
                              )}>
                                {daysAfter} dias
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium",
                              record.status === "in_progress" ? "bg-yellow-100 text-yellow-800" :
                              record.status === "finalized_pregnant" ? "bg-green-100 text-green-800" :
                              record.status === "finalized_empty" ? "bg-red-100 text-red-800" :
                              "bg-green-100 text-green-800"
                            )}>
                              {getStatusLabel(record.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenModal("view", record)} title="Visualizar">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {record.status === "in_progress" && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenModal("edit", record)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setRecordToDelete(record); setDeleteDialogOpen(true); }} title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setRecordToFinalize(record); setFinalizeUltrasoundDate(null); setFinalizeValidation(""); setFinalizeExpectedBirthMonth(null); setFinalizeDialogOpen(true); }} title="Finalizar" className="text-green-600 hover:text-green-700">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} de {filteredRecords.length} registros
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={cn(currentPage === 1 && "pointer-events-none opacity-50")} />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <PaginationItem key={page}>
                        <PaginationLink isActive={page === currentPage} onClick={() => setCurrentPage(page)}>
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={cn(currentPage === totalPages && "pointer-events-none opacity-50")} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "view" ? "Visualizar Registro" : modalMode === "edit" ? "Editar Registro" : "Novo Registro de Pós TE"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val);
            if (val === "financeiro" && selectedRecord && modalMode === "view") {
              fetchTEFinancial(selectedRecord.id, selectedRecord.aspiration_id);
            }
          }}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="reproducao">Dados Reprodução</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="financeiro" disabled={modalMode === "create"}>Financeiro</TabsTrigger>
              <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={modalMode === "view"} />
                </div>
                <div>
                  <Label>Data da Aspiração</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.aspiration_date && "text-muted-foreground")} disabled={modalMode === "view"}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.aspiration_date ? format(formData.aspiration_date, "dd/MM/yyyy") : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={formData.aspiration_date || undefined} onSelect={(date) => {
                        setFormData({ ...formData, aspiration_date: date || null });
                        setReproData({ ...reproData, aspiration_date: date || null });
                      }} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Raça</Label>
                  <Select value={formData.breed_id} onValueChange={(value) => setFormData({ ...formData, breed_id: value })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{breeds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fazenda</Label>
                  <Select value={formData.farm} onValueChange={(value) => setFormData({ ...formData, farm: value })} disabled={modalMode === "view"}>
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
                  <Select value={formData.auction_id} onValueChange={(value) => setFormData({ ...formData, auction_id: value })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{auctions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote Leilão</Label>
                  <Input value={formData.auction_lot} onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })} disabled={modalMode === "view"} />
                </div>
                <div>
                  <Label>Receptora</Label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedRecipient ? `${selectedRecipient.name}${selectedRecipient.ear_tag ? ` - Brinco: ${selectedRecipient.ear_tag}` : ""}` : ""}
                      placeholder="Selecione uma receptora..."
                      readOnly
                      disabled={modalMode === "view"}
                      className="flex-1"
                    />
                    {modalMode !== "view" && (
                      <Button variant="outline" size="icon" onClick={() => { setRecipientSearchOpen(true); setRecipientSearchTerm(""); setRecipientResults([]); }}>
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reproducao" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data Aspiração</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reproData.aspiration_date && "text-muted-foreground")} disabled={modalMode === "view"}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reproData.aspiration_date ? format(reproData.aspiration_date, "dd/MM/yyyy") : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={reproData.aspiration_date || undefined} onSelect={(date) => {
                        setReproData({ ...reproData, aspiration_date: date || null });
                        setFormData({ ...formData, aspiration_date: date || null });
                      }} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Data Transferência</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reproData.transfer_date && "text-muted-foreground")} disabled={modalMode === "view"}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reproData.transfer_date ? format(reproData.transfer_date, "dd/MM/yyyy") : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={reproData.transfer_date || undefined} onSelect={(date) => setReproData({ ...reproData, transfer_date: date || null })} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Veterinário</Label>
                  <Select value={reproData.veterinarian_id} onValueChange={(v) => setReproData({ ...reproData, veterinarian_id: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione o veterinário..." /></SelectTrigger>
                    <SelectContent>{veterinarians.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Laboratório</Label>
                  <Select value={reproData.laboratory_id} onValueChange={(v) => setReproData({ ...reproData, laboratory_id: v })} disabled={modalMode === "view"}>
                    <SelectTrigger><SelectValue placeholder="Selecione o laboratório..." /></SelectTrigger>
                    <SelectContent>{laboratories.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="genealogia" className="space-y-6 mt-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Doadora</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Matriz (Mãe)</Label>
                    <Select value={formData.dam_id} onValueChange={(value) => setFormData({ ...formData, dam_id: value })} disabled={modalMode === "view"}>
                      <SelectTrigger><SelectValue placeholder="Selecionar matriz" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">{dams.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Reprodutor (Pai)</Label>
                    <Select value={formData.sire_id} onValueChange={(value) => setFormData({ ...formData, sire_id: value })} disabled={modalMode === "view"}>
                      <SelectTrigger><SelectValue placeholder="Selecionar reprodutor" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">{sires.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {(formData.dam_id || formData.sire_id) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Avós (somente exibição)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.dam_id && (() => {
                      const selectedDam = dams.find(d => d.id === formData.dam_id);
                      const allAnimals = [...dams, ...sires];
                      const damGrandsire = selectedDam?.sire_id ? allAnimals.find(a => a.id === selectedDam.sire_id) : null;
                      const damGranddam = selectedDam?.dam_id ? allAnimals.find(a => a.id === selectedDam.dam_id) : null;
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Maternos (Pais da Matriz)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground w-20">Avô:</Label><span className="text-sm">{damGrandsire?.name || "Não informado"}</span></div>
                            <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground w-20">Avó:</Label><span className="text-sm">{damGranddam?.name || "Não informada"}</span></div>
                          </div>
                        </div>
                      );
                    })()}
                    {formData.sire_id && (() => {
                      const selectedSire = sires.find(s => s.id === formData.sire_id);
                      const allAnimals = [...dams, ...sires];
                      const sireGrandsire = selectedSire?.sire_id ? allAnimals.find(a => a.id === selectedSire.sire_id) : null;
                      const sireGranddam = selectedSire?.dam_id ? allAnimals.find(a => a.id === selectedSire.dam_id) : null;
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Paternos (Pais do Reprodutor)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground w-20">Avô:</Label><span className="text-sm">{sireGrandsire?.name || "Não informado"}</span></div>
                            <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground w-20">Avó:</Label><span className="text-sm">{sireGranddam?.name || "Não informada"}</span></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

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
                      <DropdownMenuItem onClick={() => generateTEFinancialPDF("resumido")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateTEFinancialPDF("detalhado")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={generateTEFinancialExcel}>
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
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="h-8">
                              <TableHead className="py-1 text-xs w-[8%]">Número</TableHead>
                              <TableHead className="py-1 text-xs w-[22%] max-w-[180px]">{label === "Despesas" ? "Fornecedor" : "Credor"}</TableHead>
                              <TableHead className="py-1 text-xs w-[14%]">Tipo</TableHead>
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
                              return (
                              <TableRow key={record.id} className={cn("h-7", isRateio ? "bg-orange-50" : "")}>
                                 <TableCell className="py-1 text-sm">{isRateio ? "" : (record.document_number || "-")}</TableCell>
                                 <TableCell className={cn("py-1 text-sm max-w-[180px] truncate", isRateio ? "font-medium text-orange-700" : "")}>
                                   {isRateio ? "Rateio de Aspiração" : (record.supplier_name || record.creditor_name || "-")}
                                 </TableCell>
                                 <TableCell className="py-1 text-sm">
                                   {isRateio ? (
                                     <Badge variant="outline" className="border-orange-300 text-orange-700 text-[12px] px-1.5 py-0">Rateio</Badge>
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
                        <div className="grid grid-cols-3 gap-4 text-center">
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
                        <div className="grid grid-cols-3 gap-4 text-center">
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
            <TabsContent value="proprietarios" className="mt-4">
              <OwnersTab
                entityId={selectedRecord?.id || null}
                entityType="embryo_transfer"
                isReadOnly={modalMode === "view"}
              />
            </TabsContent>
          </Tabs>

          {modalMode !== "view" && (
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recipient Search Dialog */}
      <Dialog open={recipientSearchOpen} onOpenChange={setRecipientSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar Receptora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Pesquisar por nome, registro ou brinco..."
              value={recipientSearchTerm}
              onChange={(e) => setRecipientSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {recipientSearchLoading ? (
                <div className="text-center py-4 text-muted-foreground">Buscando...</div>
              ) : recipientResults.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  {recipientSearchTerm.length < 2 ? "Digite ao menos 2 caracteres..." : "Nenhum animal encontrado."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientResults.map(animal => (
                      <TableRow key={animal.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setSelectedRecipient(animal);
                        setFormData({ ...formData, recipient_id: animal.id });
                        setRecipientSearchOpen(false);
                      }}>
                        <TableCell>{animal.name}</TableCell>
                        <TableCell>{animal.ear_tag || "-"}</TableCell>
                        <TableCell>{animal.registration || "-"}</TableCell>
                        <TableCell>{getCategoryName(animal.category_id)}</TableCell>
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

      {/* Finalize Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Finalizar Registro de Pós TE</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Data de Ultrassom *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !finalizeUltrasoundDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {finalizeUltrasoundDate ? format(finalizeUltrasoundDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={finalizeUltrasoundDate || undefined} onSelect={(d) => setFinalizeUltrasoundDate(d || null)} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Validação *</Label>
              <Select value={finalizeValidation} onValueChange={(v) => { setFinalizeValidation(v as "prenha" | "vazia"); if (v === "vazia") setFinalizeExpectedBirthMonth(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prenha">Prenha</SelectItem>
                  <SelectItem value="vazia">Não Prenha (Vazia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {finalizeValidation === "prenha" && (
              <div>
                <Label>Mês Previsto de Nascimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !finalizeExpectedBirthMonth && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {finalizeExpectedBirthMonth ? format(finalizeExpectedBirthMonth, "MM/yyyy", { locale: ptBR }) : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={finalizeExpectedBirthMonth || undefined} onSelect={(d) => setFinalizeExpectedBirthMonth(d || null)} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleFinalize} disabled={!finalizeUltrasoundDate || !finalizeValidation}>Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnimaisTransferenciaEmbriao;
