import { useState, useEffect, useMemo } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, CheckCircle, Search, Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AspirationRecord {
  id: string;
  code: number;
  name: string;
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
  laboratory_id: string | null;
  veterinarian_id: string | null;
  embryo_count: number | null;
  embryo_details: EmbryoDetail[] | null;
  transfer_date: string | null;
}

interface EmbryoDetail {
  sire_id: string;
  recipient_id: string;
}

interface Breed { id: string; name: string; }
interface Category { id: string; name: string; }
interface Auction { id: string; name: string; }
interface BreedingAnimal { id: string; name: string; sex: string; sire_id: string | null; dam_id: string | null; }
interface Laboratory { id: string; name: string; }
interface Veterinarian { id: string; name: string; }
interface AnimalOption { id: string; name: string; ear_tag: number | null; registration: string | null; category_id: string | null; }

const ITEMS_PER_PAGE = 15;

const AnimaisGestaoAspiracoes = () => {
  const navigate = useNavigate();
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
  });

  // Second finalize modal (in_progress → finalized)
  const [secondFinalizeOpen, setSecondFinalizeOpen] = useState(false);
  const [secondFinalizeRecord, setSecondFinalizeRecord] = useState<AspirationRecord | null>(null);
  const [embryoCount, setEmbryoCount] = useState(0);
  const [embryoRows, setEmbryoRows] = useState<{ sire_id: string; recipient_id: string; recipientName: string }[]>([]);
  const [finalizeVeterinarianId, setFinalizeVeterinarianId] = useState("");
  const [finalizeTransferDate, setFinalizeTransferDate] = useState<Date | null>(null);

  // Recipient search modal
  const [activeEmbryoRowIndex, setActiveEmbryoRowIndex] = useState<number | null>(null);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const debouncedRecipientSearch = useDebounce(recipientSearchTerm, 300);
  const [recipientResults, setRecipientResults] = useState<AnimalOption[]>([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [recipientNamesCache, setRecipientNamesCache] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    expected_aspiration_month: null as Date | null,
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    dam_id: "",
    farm: "",
  });

  // Dropdown options
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
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
    allocation_type: string;
    item_total_price: number;
    account_payable_id: string;
    paid_amount: number;
  }
  const [financialRecords, setFinancialRecords] = useState<AspirationFinancialRecord[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");

  useEffect(() => {
    fetchRecords();
    fetchDropdownData();
  }, []);

  // Search recipients for embryo rows
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
      const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userData.user.id).single();
      if (!profile?.store_id) return;
      setStoreId(profile.store_id);

      const { data, error } = await supabase
        .from("aspiration_management")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("code", { ascending: false });
      if (error) throw error;
      setRecords((data as unknown as AspirationRecord[]) || []);
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
      const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userData.user.id).single();
      if (!profile?.store_id) return;

      const [breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes, labsRes, vetsRes] = await Promise.all([
        supabase.from("animal_breeds").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("animal_categories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("leiloes").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        supabase.from("laboratories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("veterinarians").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
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
      default: return status;
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "pending": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "finalized": return "bg-green-100 text-green-800";
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
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}>
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

  const handleOpenModal = async (mode: "view" | "edit" | "create", record?: AspirationRecord) => {
    setModalMode(mode);
    setActiveTab("dados");
    setFinancialRecords([]);

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode, name: "", expected_aspiration_month: null,
        breed_id: "", category_id: "", auction_id: "", auction_lot: "", dam_id: "", farm: "",
      });
      setSelectedRecord(null);
    } else if (record) {
      setSelectedRecord(record);
      let farmValue = "";
      if (record.farm_id && record.farm_type) farmValue = `${record.farm_type}-${record.farm_id}`;
      setFormData({
        code: record.code, name: record.name,
        expected_aspiration_month: record.expected_aspiration_month ? new Date(record.expected_aspiration_month) : null,
        breed_id: record.breed_id || "", category_id: record.category_id || "",
        auction_id: record.auction_id || "", auction_lot: record.auction_lot || "",
        dam_id: record.dam_id || "", farm: farmValue,
      });

      if (mode === "view" && record.status === "finalized" && record.embryo_details) {
        const details = record.embryo_details as EmbryoDetail[];
        const recipientIds = details.map(d => d.recipient_id).filter(Boolean);
        if (recipientIds.length > 0) {
          const { data: animals } = await supabase
            .from("animals")
            .select("id, name, ear_tag")
            .in("id", recipientIds);
          if (animals) {
            const cache: Record<string, string> = {};
            animals.forEach(a => {
              cache[a.id] = `${a.name}${a.ear_tag ? ` - Brinco: ${a.ear_tag}` : ""}`;
            });
            setRecipientNamesCache(cache);
          }
        }
      }
      fetchAspirationFinancial(record.id);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "O nome é obrigatório.", variant: "destructive" });
      return;
    }
    setSaving(true);
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
        expected_aspiration_month: formData.expected_aspiration_month ? format(formData.expected_aspiration_month, "yyyy-MM-dd") : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        dam_id: formData.dam_id || null,
        farm_id: farmId,
        farm_type: farmType,
        store_id: profile.store_id,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("aspiration_management").insert(recordData);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso." });
      } else {
        const { error } = await supabase.from("aspiration_management").update(recordData).eq("id", selectedRecord!.id);
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

  const handleFirstFinalize = async () => {
    if (saving) return;
    if (!firstFinalizeRecord || !firstFinalizeData.aspiration_date || !firstFinalizeData.laboratory_id) {
      toast({ title: "Erro", description: "Data da aspiração e laboratório são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("aspiration_management")
        .update({
          status: "in_progress",
          aspiration_date: format(firstFinalizeData.aspiration_date, "yyyy-MM-dd"),
          laboratory_id: firstFinalizeData.laboratory_id,
        })
        .eq("id", firstFinalizeRecord.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Aspiração iniciada com sucesso." });
      setFirstFinalizeOpen(false);
      setFirstFinalizeRecord(null);
      fetchRecords();
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
    }
    setSaving(true);
    try {
      const embryoDetails = embryoRows.map(r => ({ sire_id: r.sire_id, recipient_id: r.recipient_id }));

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

      for (let i = 0; i < embryoRows.length; i++) {
        const row = embryoRows[i];
        const sireName = sires.find(s => s.id === row.sire_id)?.name || "";
        const transferName = `${secondFinalizeRecord.name} X ${sireName}`;

        const { data: lastCode } = await supabase
          .from("embryo_transfer_management")
          .select("code")
          .eq("store_id", secondFinalizeRecord.store_id)
          .order("code", { ascending: false })
          .limit(1);
        const nextCode = lastCode && lastCode.length > 0 ? lastCode[0].code + 1 : 1;

        const { error: insertError } = await supabase.from("embryo_transfer_management").insert({
          code: nextCode,
          name: transferName,
          breed_id: secondFinalizeRecord.breed_id,
          category_id: secondFinalizeRecord.category_id,
          auction_id: secondFinalizeRecord.auction_id,
          auction_lot: secondFinalizeRecord.auction_lot,
          dam_id: secondFinalizeRecord.dam_id,
          sire_id: row.sire_id,
          recipient_id: row.recipient_id,
          farm_id: secondFinalizeRecord.farm_id,
          farm_type: secondFinalizeRecord.farm_type,
          store_id: secondFinalizeRecord.store_id,
          aspiration_date: secondFinalizeRecord.aspiration_date || null,
          transfer_date: finalizeTransferDate ? format(finalizeTransferDate, "yyyy-MM-dd") : null,
          veterinarian_id: finalizeVeterinarianId || null,
          laboratory_id: secondFinalizeRecord.laboratory_id || null,
        } as any);
        if (insertError) throw insertError;
      }

      toast({ title: "Sucesso", description: "Aspiração finalizada e registros de pós transferência criados com sucesso." });
      setSecondFinalizeOpen(false);
      setSecondFinalizeRecord(null);
      fetchRecords();
    } catch (error) {
      console.error("Error second finalize:", error);
      toast({ title: "Erro", description: "Erro ao finalizar aspiração.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeClick = (record: AspirationRecord) => {
    if (record.status === "pending") {
      setFirstFinalizeRecord(record);
      setFirstFinalizeData({ aspiration_date: null, laboratory_id: "" });
      setFirstFinalizeOpen(true);
    } else if (record.status === "in_progress") {
      setSecondFinalizeRecord(record);
      setEmbryoCount(0);
      setEmbryoRows([]);
      setFinalizeVeterinarianId("");
      setFinalizeTransferDate(null);
      setSecondFinalizeOpen(true);
    }
  };

  const handleEmbryoCountChange = (count: number) => {
    setEmbryoCount(count);
    const newRows = Array.from({ length: count }, (_, i) => {
      return embryoRows[i] || { sire_id: "", recipient_id: "", recipientName: "" };
    });
    setEmbryoRows(newRows);
  };

  const fetchAspirationFinancial = async (aspirationId: string) => {
    setLoadingFinancial(true);
    try {
      const { data: allocations, error } = await supabase
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

      if (error) throw error;
      if (!allocations || allocations.length === 0) {
        setFinancialRecords([]);
        return;
      }

      const supplierIds = new Set<string>();
      allocations.forEach((a: any) => {
        const sid = a.accounts_payable_items?.accounts_payable?.supplier_id;
        if (sid) supplierIds.add(sid);
      });

      const suppliersMap = new Map<string, string>();
      if (supplierIds.size > 0) {
        const { data: suppliers } = await supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds));
        (suppliers || []).forEach((s: any) => suppliersMap.set(s.id, s.name));
      }

      // Fetch payments for all related accounts_payable to support partial payments
      const apIds = [...new Set(allocations.map((a: any) => a.accounts_payable_items?.accounts_payable?.id).filter(Boolean))];
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

      const records: AspirationFinancialRecord[] = allocations.map((a: any) => {
        const item = a.accounts_payable_items;
        const ap = item?.accounts_payable;
        const apId = ap?.id || "";
        return {
          id: a.id,
          document_number: ap?.document_number || null,
          due_date: ap?.due_date || "",
          payment_date: ap?.payment_date || null,
          status: ap?.status || "",
          supplier_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null,
          allocation_type: a.allocation_type,
          item_total_price: item?.total_price || 0,
          account_payable_id: apId,
          paid_amount: paidAmountsMap.get(apId) || 0,
        };
      });

      setFinancialRecords(records);
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
      const totalDespesas = records.reduce((sum, r) => sum + r.item_total_price, 0);

      if (tipo === "resumido") {
        autoTable(doc, {
          startY: 42,
          head: [["Número", "Fornecedor", "Tipo Alocação", "Vlr Total", "Vencimento", "Pagamento", "Status"]],
          body: records.map(r => [
            r.document_number || "-",
            r.supplier_name || "-",
            getAllocationTypeLabel(r.allocation_type),
            r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
            r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
            r.status === "paid" ? "Pago" : r.status === "pending" ? "Pendente" : r.status,
          ]),
          foot: [["", "", "Total Despesas:", totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "", "", ""]],
          theme: "grid",
          headStyles: { fillColor: [66, 66, 66] },
          footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        });
      } else {
        const accountPayableIds = [...new Set(records.map(r => r.account_payable_id))];
        const { data: allItems } = await supabase
          .from("accounts_payable_items")
          .select("*, products(name)")
          .in("account_payable_id", accountPayableIds);

        const itemsByAP = new Map<string, any[]>();
        (allItems || []).forEach((item: any) => {
          const list = itemsByAP.get(item.account_payable_id) || [];
          list.push(item);
          itemsByAP.set(item.account_payable_id, list);
        });

        let currentY = 42;
        records.forEach((record, index) => {
          if (currentY > 250) { doc.addPage(); currentY = 20; }
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`${index + 1}. Número: ${record.document_number || "-"} | Fornecedor: ${record.supplier_name || "-"}`, 14, currentY);
          currentY += 6;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY);
          currentY += 4;
          doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
          currentY += 6;

          const items = itemsByAP.get(record.account_payable_id) || [];
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

        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Total Despesas: ${totalDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, currentY);
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
    const data = records.map(r => ({
      "Número": r.document_number || "-",
      "Fornecedor": r.supplier_name || "-",
      "Tipo Alocação": getAllocationTypeLabel(r.allocation_type),
      "Valor Total": r.item_total_price,
      "Vencimento": r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Pagamento": r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-",
      "Status": r.status === "paid" ? "Pago" : r.status === "pending" ? "Pendente" : r.status,
    }));
    const totalDespesas = records.reduce((sum, r) => sum + r.item_total_price, 0);
    data.push({ "Número": "", "Fornecedor": "", "Tipo Alocação": "TOTAL DESPESAS", "Valor Total": totalDespesas, "Vencimento": "", "Pagamento": "", "Status": "" });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    const name = selectedRecord?.name || "Aspiracao";
    XLSX.writeFile(wb, `financeiro_aspiracao_${name.replace(/\s+/g, "_")}.xlsx`);
    toast({ title: "Excel gerado com sucesso!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gestão de Aspirações</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de aspirações</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Ocultar Filtros" : "Exibir Filtros"}
            </Button>
            {hasFiltered && filteredRecords.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" onClick={handleExportPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            )}
          </div>
          <Button onClick={() => handleOpenModal("create")}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="border rounded-lg p-4 mb-6 bg-card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filtrar por nome..." className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Raça</Label>
                <Select value={filterBreed} onValueChange={setFilterBreed}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {breeds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fazenda</Label>
                <Select value={filterFarm} onValueChange={setFilterFarm}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
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
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="finalized">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Leilão</Label>
                <Select value={filterAuction} onValueChange={setFilterAuction}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {auctions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nome da Mãe</Label>
                <Input value={filterDamName} onChange={(e) => setFilterDamName(e.target.value)} placeholder="Filtrar por mãe..." className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mês Prev. Aspiração</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterExpectedMonthStart} onChange={setFilterExpectedMonthStart} />
                  <DateFilterPicker label="Fim" value={filterExpectedMonthEnd} onChange={setFilterExpectedMonthEnd} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data Aspiração</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterAspirationDateStart} onChange={setFilterAspirationDateStart} />
                  <DateFilterPicker label="Fim" value={filterAspirationDateEnd} onChange={setFilterAspirationDateEnd} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data Transferência</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DateFilterPicker label="Início" value={filterTransferDateStart} onChange={setFilterTransferDateStart} />
                  <DateFilterPicker label="Fim" value={filterTransferDateEnd} onChange={setFilterTransferDateEnd} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClearFilters}>Limpar Filtros</Button>
              <Button onClick={handleApplyFilters}>
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
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Mês Prev. Aspiração</TableHead>
                    <TableHead>Data Aspiração</TableHead>
                    <TableHead>Data Transferência</TableHead>
                    <TableHead>Qtd. Embriões</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableRow key={record.id}>
                        <TableCell>{record.code}</TableCell>
                        <TableCell>{record.name}</TableCell>
                        <TableCell>{getBreedName(record.breed_id)}</TableCell>
                        <TableCell>{getFarmName(record.farm_id, record.farm_type)}</TableCell>
                        <TableCell>
                          {record.expected_aspiration_month
                            ? format(new Date(record.expected_aspiration_month + "T12:00:00"), "MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {record.aspiration_date
                            ? format(new Date(record.aspiration_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {record.transfer_date
                            ? format(new Date(record.transfer_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {record.embryo_count ?? "-"}
                        </TableCell>
                        <TableCell>
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium", getStatusClasses(record.status))}>
                            {getStatusLabel(record.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal("view", record)} title="Visualizar">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {record.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal("edit", record)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setRecordToDelete(record); setDeleteDialogOpen(true); }} title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleFinalizeClick(record)} title="Iniciar Aspiração" className="text-green-600 hover:text-green-700">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {record.status === "in_progress" && (
                              <Button variant="ghost" size="icon" onClick={() => handleFinalizeClick(record)} title="Finalizar" className="text-green-600 hover:text-green-700">
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
              <div className="flex items-center justify-between mt-4">
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "view" ? "Visualizar Registro" : modalMode === "edit" ? "Editar Registro" : "Novo Registro de Aspiração"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={cn("grid w-full", modalMode === "view" && selectedRecord?.status === "finalized" ? "grid-cols-5" : "grid-cols-4")}>
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              {modalMode === "view" && selectedRecord?.status === "finalized" && (
                <TabsTrigger value="resultado">Resultado</TabsTrigger>
              )}
              <TabsTrigger value="financeiro" disabled={modalMode === "create"}>Financeiro</TabsTrigger>
              <TabsTrigger value="proprietarios" disabled>Proprietários</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="genealogia" className="space-y-6 mt-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Doadora</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Matriz (Mãe)</Label>
                    <Select value={formData.dam_id} onValueChange={(v) => setFormData({ ...formData, dam_id: v })} disabled={modalMode === "view"}>
                      <SelectTrigger><SelectValue placeholder="Selecionar matriz" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {dams.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                </div>

                {selectedRecord.embryo_details && (selectedRecord.embryo_details as EmbryoDetail[]).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">Embriões</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Reprodutor (Pai)</TableHead>
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
                  <Button variant="outline" size="sm" onClick={() => generateAspirationFinancialPDF("resumido")} disabled={financialRecords.length === 0}>
                    <FileText className="h-4 w-4 mr-1" />PDF Resumido
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generateAspirationFinancialPDF("detalhado")} disabled={financialRecords.length === 0}>
                    <FileText className="h-4 w-4 mr-1" />PDF Detalhado
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateAspirationFinancialExcel} disabled={financialRecords.length === 0}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
                  </Button>
                </div>
              </div>

              {loadingFinancial ? (
                <p className="text-center text-muted-foreground py-8">Carregando dados financeiros...</p>
              ) : (() => {
                const filteredRecs = getFilteredFinRecords();

                const despesas = filteredRecs;
                const totalDespesas = despesas.reduce((sum, r) => sum + r.item_total_price, 0);
                const totalPago = despesas.reduce((sum, r) => sum + r.paid_amount, 0);
                const totalPendente = totalDespesas - totalPago;
                const totalReceitas = 0;
                const saldo = totalReceitas - (financialViewMode === "pagos" ? totalPago : totalDespesas);

                return (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium text-base border-b pb-1">Despesas</h4>
                      {despesas.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">Nenhuma despesa registrada.</p>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Número</TableHead>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>{financialViewMode === "pagos" ? "Tipo" : "Tipo Alocação"}</TableHead>
                                <TableHead className="text-right">Vlr Total</TableHead>
                                {financialViewMode === "pagos" && (
                                  <>
                                    <TableHead className="text-right">Pago</TableHead>
                                    <TableHead className="text-right">Pendente</TableHead>
                                  </>
                                )}
                                <TableHead>{financialViewMode === "pagos" ? "Venc." : "Vencimento"}</TableHead>
                                <TableHead>{financialViewMode === "pagos" ? "Pag." : "Pagamento"}</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {despesas.map((record) => {
                                const valorPendente = record.item_total_price - record.paid_amount;
                                return (
                                <TableRow key={record.id}>
                                  <TableCell>{record.document_number || "-"}</TableCell>
                                  <TableCell>{record.supplier_name || "-"}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{getAllocationTypeLabel(record.allocation_type)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </TableCell>
                                  {financialViewMode === "pagos" && (
                                    <>
                                      <TableCell className="text-right font-medium text-primary">
                                        {record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-destructive">
                                        {valorPendente > 0 ? valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell>{record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                                  <TableCell>{record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                                  <TableCell>
                                    <Badge variant={record.status === "paid" ? "default" : "secondary"}>
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

                    <div className="space-y-2">
                      <h4 className="font-medium text-base border-b pb-1">Receitas</h4>
                      <p className="text-center text-muted-foreground py-4">Nenhuma receita registrada.</p>
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className={cn("grid gap-4 text-center", financialViewMode === "pagos" ? "grid-cols-4" : "grid-cols-3")}>
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
                        {financialViewMode === "pagos" && (
                          <div>
                            <p className="text-sm text-muted-foreground">Total Pago</p>
                            <p className="text-lg font-semibold text-primary">
                              {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">Saldo</p>
                          <p className={cn("text-lg font-semibold", saldo >= 0 ? "text-primary" : "text-destructive")}>
                            {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
            <TabsContent value="proprietarios" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">Funcionalidade em desenvolvimento.</div>
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

      {/* First Finalize Modal: pending → in_progress */}
      <Dialog open={firstFinalizeOpen} onOpenChange={setFirstFinalizeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Aspiração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label>Laboratório *</Label>
              <Select value={firstFinalizeData.laboratory_id} onValueChange={(v) => setFirstFinalizeData({ ...firstFinalizeData, laboratory_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o laboratório..." /></SelectTrigger>
                <SelectContent>
                  {laboratories.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirstFinalizeOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleFirstFinalize} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Second Finalize Modal: in_progress → finalized */}
      <Dialog open={secondFinalizeOpen} onOpenChange={setSecondFinalizeOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

            {embryoCount > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Reprodutor (Pai)</TableHead>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
    </div>
  );
};

export default AnimaisGestaoAspiracoes;
