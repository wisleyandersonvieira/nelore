import { useState, useEffect, useMemo } from "react";
import { OwnersTab } from "@/components/OwnersTab";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
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
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, CheckCircle, Search, Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, DollarSign, Download, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PregnancyRecord {
  id: string;
  code: number;
  name: string;
  sex: string;
  expected_birth_month: string | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  sire_id: string | null;
  dam_id: string | null;
  farm_id: string | null;
  farm_type: string | null;
  recipient_id: string | null;
  status: string;
  store_id: string;
  aspiration_date: string | null;
  transfer_date: string | null;
  veterinarian_id: string | null;
  laboratory_id: string | null;
  ultrasound_date: string | null;
  embryo_transfer_id: string | null;
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

interface Animal {
  id: string;
  code: number;
  name: string;
  ear_tag: number | null;
  category_id: string | null;
}

const AnimaisGestaoPrenhez = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PregnancyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedRecord, setSelectedRecord] = useState<PregnancyRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PregnancyRecord | null>(null);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [recordToFinalize, setRecordToFinalize] = useState<PregnancyRecord | null>(null);
  const [finalizeBirthDate, setFinalizeBirthDate] = useState<Date | null>(null);
  const [finalizeValidation, setFinalizeValidation] = useState<string>("");
  const [finalizeName, setFinalizeName] = useState<string>("");
  const [finalizeWeight, setFinalizeWeight] = useState<string>("");
  const [activeTab, setActiveTab] = useState("dados");
  const [storeId, setStoreId] = useState<string | null>(null);

  // Financial state
  interface PrenFinancialRecord {
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
    rateio_label?: string;
  }
  const [financialRecords, setFinancialRecords] = useState<PrenFinancialRecord[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<"geral" | "pagos">("geral");

  // Sale modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleRecord, setSaleRecord] = useState<PregnancyRecord | null>(null);
  const [saleClientId, setSaleClientId] = useState("");
  const [saleDate, setSaleDate] = useState<Date | null>(null);
  const [saleValue, setSaleValue] = useState("");
  const [salePercentage, setSalePercentage] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [saleOwners, setSaleOwners] = useState<{ owner_id: string; owner_name: string; percentage: number; owner_type: string; store_owner_id: string | null }[]>([]);

  // Proprietários state
  interface PregnancySale {
    id: string;
    client_id: string;
    client_name: string;
    sale_date: string;
    sale_value: number;
    sale_percentage: number;
  }
  const [pregnancySales, setPregnancySales] = useState<PregnancySale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const [recipientCategoryFilter, setRecipientCategoryFilter] = useState("");
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Animal | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    sex: "",
    expected_birth_month: null as Date | null,
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    sire_id: "",
    dam_id: "",
    farm: "",
    recipient_id: "",
  });

  // Reproduction data
  const [reproData, setReproData] = useState({
    aspiration_date: null as Date | null,
    transfer_date: null as Date | null,
    veterinarian_id: "",
    laboratory_id: "",
    ultrasound_date: null as Date | null,
  });

  // Dropdown options
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [ownFarms, setOwnFarms] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);
  const [veterinarians, setVeterinarians] = useState<{ id: string; name: string }[]>([]);
  const [laboratories, setLaboratories] = useState<{ id: string; name: string }[]>([]);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState("");
  const [filterBreed, setFilterBreed] = useState("");
  const [filterFarm, setFilterFarm] = useState("");
  const [filterBirthMonthStart, setFilterBirthMonthStart] = useState<Date | null>(null);
  const [filterBirthMonthEnd, setFilterBirthMonthEnd] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAuction, setFilterAuction] = useState("");
  const [filterDam, setFilterDam] = useState("");
  const [filterSire, setFilterSire] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");
  const RECORDS_PER_PAGE = 15;

  // Financial functions
  const getAllocationTypeLabel = (type: string) => {
    switch (type) {
      case "animal": return "Animal";
      case "pregnancy": return "Prenhez";
      case "embryo_transfer": return "Pós Transf. Emb.";
      case "aspiration": return "Aspiração";
      case "aspiration_rateio": return "Rateio Aspiração";
      case "te_rateio": return "Rateio Pós TE";
      default: return type;
    }
  };

  const fetchPregnancyFinancial = async (pregnancyId: string, embryoTransferId?: string | null) => {
    setLoadingFinancial(true);
    try {
      const allRecords: PrenFinancialRecord[] = [];

      // 1. Fetch direct pregnancy allocations (expenses)
      const { data: expAllocations } = await supabase
        .from("accounts_payable_item_allocations")
        .select(`id, allocation_type, account_payable_item_id, accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, document_number, due_date, payment_date, status, supplier_id ) )`)
        .eq("pregnancy_id", pregnancyId);

      // 1b. Fetch direct pregnancy allocations (revenues)
      const { data: revAllocations } = await supabase
        .from("accounts_receivable_item_allocations")
        .select(`id, allocation_type, account_receivable_item_id, accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, document_number, due_date, payment_date, status, creditor_id ) )`)
        .eq("pregnancy_id", pregnancyId);

      // Process direct expense allocations
      if (expAllocations && expAllocations.length > 0) {
        const supplierIds = new Set<string>();
        expAllocations.forEach((a: any) => { const sid = a.accounts_payable_items?.accounts_payable?.supplier_id; if (sid) supplierIds.add(sid); });
        const suppliersMap = new Map<string, string>();
        if (supplierIds.size > 0) {
          const { data: suppliers } = await supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds));
          (suppliers || []).forEach((s: any) => suppliersMap.set(s.id, s.name));
        }
        const apIds = [...new Set(expAllocations.map((a: any) => a.accounts_payable_items?.accounts_payable?.id).filter(Boolean))];
        const paidMap = new Map<string, number>();
        if (apIds.length > 0) {
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: payments } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", apIds).lte("payment_date", today);
          (payments || []).forEach((p: any) => { paidMap.set(p.account_payable_id, (paidMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
        }
        expAllocations.forEach((a: any) => {
          const item = a.accounts_payable_items; const ap = item?.accounts_payable; const apId = ap?.id || "";
          allRecords.push({ id: a.id, document_number: ap?.document_number || null, due_date: ap?.due_date || "", payment_date: ap?.payment_date || null, status: ap?.status || "", supplier_name: ap?.supplier_id ? suppliersMap.get(ap.supplier_id) || null : null, creditor_name: null, allocation_type: a.allocation_type, item_total_price: item?.total_price || 0, account_payable_id: apId, account_receivable_id: "", paid_amount: paidMap.get(apId) || 0, record_type: 'expense' });
        });
      }

      // Process direct revenue allocations
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
          allRecords.push({ id: a.id, document_number: ar?.document_number || null, due_date: ar?.due_date || "", payment_date: ar?.payment_date || null, status: ar?.status || "", supplier_name: null, creditor_name: ar?.creditor_id ? creditorsMap.get(ar.creditor_id) || null : null, allocation_type: a.allocation_type, item_total_price: item?.total_price || 0, account_payable_id: "", account_receivable_id: arId, paid_amount: paidRecMap.get(arId) || 0, record_type: 'revenue' });
        });
      }

      // 2. Fetch Pós TE rateio (if embryoTransferId exists)
      let aspirationId: string | null = null;
      if (embryoTransferId) {
        // Get the embryo transfer to find aspiration_id
        const { data: teData } = await supabase
          .from("embryo_transfer_management")
          .select("aspiration_id")
          .eq("id", embryoTransferId)
          .single();
        aspirationId = teData?.aspiration_id || null;

        // Fetch Pós TE expense allocations for rateio
        const { data: teExpAllocations } = await supabase
          .from("accounts_payable_item_allocations")
          .select(`id, allocation_type, accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, status ) )`)
          .eq("embryo_transfer_id", embryoTransferId);

        const { data: teRevAllocations } = await supabase
          .from("accounts_receivable_item_allocations")
          .select(`id, allocation_type, accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, status ) )`)
          .eq("embryo_transfer_id", embryoTransferId);

        // Sum Pós TE totals for rateio (no division - same cost passes through)
        let teTotalExpense = 0; let tePaidExpense = 0;
        if (teExpAllocations && teExpAllocations.length > 0) {
          // Build a map of AP id -> { totalItemPrice, status }
          const teApMap = new Map<string, { totalItemPrice: number; status: string }>();
          teExpAllocations.forEach((a: any) => {
            const itemPrice = a.accounts_payable_items?.total_price || 0;
            teTotalExpense += itemPrice;
            const apId = a.accounts_payable_items?.accounts_payable?.id;
            const apStatus = a.accounts_payable_items?.accounts_payable?.status || "";
            if (apId) {
              const existing = teApMap.get(apId);
              if (existing) { existing.totalItemPrice += itemPrice; }
              else { teApMap.set(apId, { totalItemPrice: itemPrice, status: apStatus }); }
            }
          });
          const teApIds = Array.from(teApMap.keys());
          if (teApIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: tePay } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", teApIds).lte("payment_date", today);
            const tePayMap = new Map<string, number>();
            (tePay || []).forEach((p: any) => { tePayMap.set(p.account_payable_id, (tePayMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
            // For each AP: use payment sum if available, else fallback to item total if status is paid
            teApMap.forEach((info, apId) => {
              const paymentSum = tePayMap.get(apId) || 0;
              if (paymentSum > 0) { tePaidExpense += paymentSum; }
              else if (info.status === "paid") { tePaidExpense += info.totalItemPrice; }
            });
          }
        }
        let teTotalRevenue = 0; let tePaidRevenue = 0;
        if (teRevAllocations && teRevAllocations.length > 0) {
          const teArMap = new Map<string, { totalItemPrice: number; status: string }>();
          teRevAllocations.forEach((a: any) => {
            const itemPrice = a.accounts_receivable_items?.total_price || 0;
            teTotalRevenue += itemPrice;
            const arId = a.accounts_receivable_items?.accounts_receivable?.id;
            const arStatus = a.accounts_receivable_items?.accounts_receivable?.status || "";
            if (arId) {
              const existing = teArMap.get(arId);
              if (existing) { existing.totalItemPrice += itemPrice; }
              else { teArMap.set(arId, { totalItemPrice: itemPrice, status: arStatus }); }
            }
          });
          const teArIds = Array.from(teArMap.keys());
          if (teArIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: teRecPay } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", teArIds).lte("payment_date", today);
            const teRecPayMap = new Map<string, number>();
            (teRecPay || []).forEach((p: any) => { teRecPayMap.set(p.account_receivable_id, (teRecPayMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)); });
            teArMap.forEach((info, arId) => {
              const paymentSum = teRecPayMap.get(arId) || 0;
              if (paymentSum > 0) { tePaidRevenue += paymentSum; }
              else if (info.status === "paid") { tePaidRevenue += info.totalItemPrice; }
            });
          }
        }

        if (teTotalExpense > 0) {
          allRecords.push({ id: `rateio-te-expense-${embryoTransferId}`, document_number: null, due_date: "", payment_date: null, status: "", supplier_name: "Rateio Pós TE", creditor_name: null, allocation_type: "te_rateio", item_total_price: teTotalExpense, account_payable_id: "", account_receivable_id: "", paid_amount: tePaidExpense, record_type: 'expense', is_rateio: true, rateio_label: "Rateio Pós TE" });
        }
        if (teTotalRevenue > 0) {
          allRecords.push({ id: `rateio-te-revenue-${embryoTransferId}`, document_number: null, due_date: "", payment_date: null, status: "", supplier_name: null, creditor_name: "Rateio Pós TE", allocation_type: "te_rateio", item_total_price: teTotalRevenue, account_payable_id: "", account_receivable_id: "", paid_amount: tePaidRevenue, record_type: 'revenue', is_rateio: true, rateio_label: "Rateio Pós TE" });
        }
      }

      // 3. Fetch Aspiration rateio (if aspirationId exists)
      if (aspirationId) {
        const { data: aspirationData } = await supabase.from("aspiration_management").select("embryo_count").eq("id", aspirationId).single();
        const totalEmbryoCount = aspirationData?.embryo_count || 1;

        // Count siblings finalized as empty to subtract from divisor
        const { data: emptySiblings } = await supabase
          .from("embryo_transfer_management")
          .select("id")
          .eq("aspiration_id", aspirationId)
          .eq("status", "finalized_empty");
        const emptyCount = emptySiblings?.length || 0;
        const embryoCount = Math.max(totalEmbryoCount - emptyCount, 1);

        const { data: aspExpAllocations } = await supabase
          .from("accounts_payable_item_allocations")
          .select(`id, allocation_type, accounts_payable_items!inner ( total_price, account_payable_id, accounts_payable!inner ( id, status ) )`)
          .eq("aspiration_id", aspirationId);

        const { data: aspRevAllocations } = await supabase
          .from("accounts_receivable_item_allocations")
          .select(`id, allocation_type, accounts_receivable_items!inner ( total_price, account_receivable_id, accounts_receivable!inner ( id, status ) )`)
          .eq("aspiration_id", aspirationId);

        let aspTotalExpense = 0; let aspPaidExpense = 0;
        if (aspExpAllocations && aspExpAllocations.length > 0) {
          const aspApMap = new Map<string, { totalItemPrice: number; status: string }>();
          aspExpAllocations.forEach((a: any) => {
            const itemPrice = a.accounts_payable_items?.total_price || 0;
            aspTotalExpense += itemPrice;
            const apId = a.accounts_payable_items?.accounts_payable?.id;
            const apStatus = a.accounts_payable_items?.accounts_payable?.status || "";
            if (apId) {
              const existing = aspApMap.get(apId);
              if (existing) { existing.totalItemPrice += itemPrice; }
              else { aspApMap.set(apId, { totalItemPrice: itemPrice, status: apStatus }); }
            }
          });
          const aspApIds = Array.from(aspApMap.keys());
          if (aspApIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: aspPay } = await supabase.from("accounts_payable_payments").select("account_payable_id, amount_paid").in("account_payable_id", aspApIds).lte("payment_date", today);
            const aspPayMap = new Map<string, number>();
            (aspPay || []).forEach((p: any) => { aspPayMap.set(p.account_payable_id, (aspPayMap.get(p.account_payable_id) || 0) + (p.amount_paid || 0)); });
            aspApMap.forEach((info, apId) => {
              const paymentSum = aspPayMap.get(apId) || 0;
              if (paymentSum > 0) { aspPaidExpense += paymentSum; }
              else if (info.status === "paid") { aspPaidExpense += info.totalItemPrice; }
            });
          }
        }
        let aspTotalRevenue = 0; let aspPaidRevenue = 0;
        if (aspRevAllocations && aspRevAllocations.length > 0) {
          const aspArMap = new Map<string, { totalItemPrice: number; status: string }>();
          aspRevAllocations.forEach((a: any) => {
            const itemPrice = a.accounts_receivable_items?.total_price || 0;
            aspTotalRevenue += itemPrice;
            const arId = a.accounts_receivable_items?.accounts_receivable?.id;
            const arStatus = a.accounts_receivable_items?.accounts_receivable?.status || "";
            if (arId) {
              const existing = aspArMap.get(arId);
              if (existing) { existing.totalItemPrice += itemPrice; }
              else { aspArMap.set(arId, { totalItemPrice: itemPrice, status: arStatus }); }
            }
          });
          const aspArIds = Array.from(aspArMap.keys());
          if (aspArIds.length > 0) {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data: aspRecPay } = await supabase.from("accounts_receivable_payments").select("account_receivable_id, amount_paid").in("account_receivable_id", aspArIds).lte("payment_date", today);
            const aspRecPayMap = new Map<string, number>();
            (aspRecPay || []).forEach((p: any) => { aspRecPayMap.set(p.account_receivable_id, (aspRecPayMap.get(p.account_receivable_id) || 0) + (p.amount_paid || 0)); });
            aspArMap.forEach((info, arId) => {
              const paymentSum = aspRecPayMap.get(arId) || 0;
              if (paymentSum > 0) { aspPaidRevenue += paymentSum; }
              else if (info.status === "paid") { aspPaidRevenue += info.totalItemPrice; }
            });
          }
        }

        if (aspTotalExpense > 0) {
          allRecords.push({ id: `rateio-asp-expense-${aspirationId}`, document_number: null, due_date: "", payment_date: null, status: "", supplier_name: "Rateio de Aspiração", creditor_name: null, allocation_type: "aspiration_rateio", item_total_price: aspTotalExpense / embryoCount, account_payable_id: "", account_receivable_id: "", paid_amount: aspPaidExpense / embryoCount, record_type: 'expense', is_rateio: true, rateio_label: "Rateio de Aspiração" });
        }
        if (aspTotalRevenue > 0) {
          allRecords.push({ id: `rateio-asp-revenue-${aspirationId}`, document_number: null, due_date: "", payment_date: null, status: "", supplier_name: null, creditor_name: "Rateio de Aspiração", allocation_type: "aspiration_rateio", item_total_price: aspTotalRevenue / embryoCount, account_payable_id: "", account_receivable_id: "", paid_amount: aspPaidRevenue / embryoCount, record_type: 'revenue', is_rateio: true, rateio_label: "Rateio de Aspiração" });
        }
      }

      setFinancialRecords(allRecords);
    } catch (error) {
      console.error("Error fetching pregnancy financial:", error);
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

  const generatePregnancyFinancialPDF = async (tipo: "resumido" | "detalhado") => {
    try {
      const doc = new jsPDF();
      const name = selectedRecord?.name || "Prenhez";
      const code = selectedRecord?.code || "";
      doc.setFontSize(16); doc.text(`Relatório Financeiro - ${name} (Cód: ${code})`, 14, 20);
      doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 28);
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
          autoTable(doc, { startY, head: [["Número", "Fornecedor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Pago" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)], body: despesas.map(r => [r.document_number || "-", r.is_rateio ? (r.rateio_label || "") : (r.supplier_name || "-"), getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente")]), theme: "grid", headStyles: { fillColor: [66, 66, 66] } });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
        if (receitas.length > 0) {
          if (startY > 250) { doc.addPage(); startY = 20; }
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Receitas", 14, startY); startY += 6;
          autoTable(doc, { startY, head: [["Número", "Credor", "Tipo", "Vlr Total", financialViewMode === "pagos" ? "Recebido" : "", "Vencimento", "Pagamento", "Status"].filter(Boolean)], body: receitas.map(r => [r.document_number || "-", r.is_rateio ? (r.rateio_label || "") : (r.creditor_name || "-"), getAllocationTypeLabel(r.allocation_type), r.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ...(financialViewMode === "pagos" ? [r.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })] : []), r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente")]), theme: "grid", headStyles: { fillColor: [66, 66, 66] } });
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
        const revenueARIds = [...new Set(receitas.filter(r => !r.is_rateio).map(r => r.account_receivable_id).filter(Boolean))];
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
            doc.text(`${index + 1}. ${record.is_rateio ? (record.rateio_label || "Rateio") : `Número: ${record.document_number || "-"} | Fornecedor: ${record.supplier_name || "-"}`}`, 14, currentY); currentY += 6;
            if (!record.is_rateio) {
              doc.setFontSize(9); doc.setFont("helvetica", "normal");
              doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY); currentY += 4;
            }
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Pago: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
            if (!record.is_rateio) {
              const items = expItemsByAP.get(record.account_payable_id) || [];
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
            if (!record.is_rateio) {
              doc.setFontSize(9); doc.setFont("helvetica", "normal");
              doc.text(`Tipo: ${getAllocationTypeLabel(record.allocation_type)} | Venc.: ${record.due_date ? format(new Date(record.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Pgto: ${record.payment_date ? format(new Date(record.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"} | Status: ${record.status === "paid" ? "Pago" : "Pendente"}`, 14, currentY); currentY += 4;
            }
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Valor Total: ${record.item_total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${financialViewMode === "pagos" ? ` | Recebido: ${record.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}`, 14, currentY); currentY += 6;
            if (!record.is_rateio) {
              const items = revItemsByAR.get(record.account_receivable_id) || [];
              if (items.length > 0) {
                autoTable(doc, { startY: currentY, head: [["Produto", "Qtd", "Vlr Unit.", "Vlr Total"]], body: items.map((it: any) => [it.products?.name || "-", it.quantity, it.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), it.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]), theme: "grid", headStyles: { fillColor: [100, 100, 100], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 20, right: 20 } });
                currentY = (doc as any).lastAutoTable.finalY + 8;
              } else { currentY += 4; }
            }
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
      doc.save(`financeiro_prenhez_${name.replace(/\s+/g, "_")}_${tipo}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const generatePregnancyFinancialExcel = () => {
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
    const despData = despesas.map(r => ({ "Número": r.is_rateio ? "" : (r.document_number || "-"), "Fornecedor": r.is_rateio ? (r.rateio_label || "") : (r.supplier_name || "-"), "Tipo Alocação": getAllocationTypeLabel(r.allocation_type), "Valor Total": r.item_total_price, ...(isPagos ? { "Pago": r.paid_amount } : {}), "Vencimento": r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), "Pagamento": r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), "Status": r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente") }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despData), "Despesas");
    const recData = receitas.map(r => ({ "Número": r.is_rateio ? "" : (r.document_number || "-"), "Credor": r.is_rateio ? (r.rateio_label || "") : (r.creditor_name || "-"), "Tipo Alocação": getAllocationTypeLabel(r.allocation_type), "Valor Total": r.item_total_price, ...(isPagos ? { "Recebido": r.paid_amount } : {}), "Vencimento": r.is_rateio ? "" : (r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"), "Pagamento": r.is_rateio ? "" : (r.payment_date ? format(new Date(r.payment_date + "T12:00:00"), "dd/MM/yyyy") : "-"), "Status": r.is_rateio ? "" : (r.status === "paid" ? "Pago" : r.status === "partial" ? "Parcial" : "Pendente") }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recData), "Receitas");
    const resumoData = isPagos
      ? [{ "Descrição": "Total Despesas Pagas", "Valor": totalPagoDespesas }, { "Descrição": "Total Receitas Recebidas", "Valor": totalPagoReceitas }, { "Descrição": "Saldo", "Valor": saldo }]
      : [{ "Descrição": "Total Despesas", "Valor": totalDespesas }, { "Descrição": "Total Receitas", "Valor": totalReceitas }, { "Descrição": "Saldo", "Valor": saldo }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), "Resumo");
    const name = selectedRecord?.name || "Prenhez";
    XLSX.writeFile(wb, `financeiro_prenhez_${name.replace(/\s+/g, "_")}.xlsx`);
    toast({ title: "Excel gerado com sucesso!" });
  };


  const filteredRecords = useMemo(() => {
    if (!hasFiltered) return records.slice(0, 10);
    return records.filter((r) => {
      if (filterName && !r.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterBreed && filterBreed !== "all" && r.breed_id !== filterBreed) return false;
      if (filterFarm && filterFarm !== "all" && !(r.farm_id && r.farm_type && `${r.farm_type}-${r.farm_id}` === filterFarm)) return false;
      if (filterStatus && filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterAuction && filterAuction !== "all" && r.auction_id !== filterAuction) return false;
      if (filterDam && filterDam !== "all" && r.dam_id !== filterDam) return false;
      if (filterSire && filterSire !== "all" && r.sire_id !== filterSire) return false;
      if (filterRecipient && filterRecipient !== "all" && r.recipient_id !== filterRecipient) return false;
      if (filterBirthMonthStart && r.expected_birth_month) {
        if (new Date(r.expected_birth_month + "T12:00:00") < filterBirthMonthStart) return false;
      }
      if (filterBirthMonthEnd && r.expected_birth_month) {
        if (new Date(r.expected_birth_month + "T12:00:00") > filterBirthMonthEnd) return false;
      }
      return true;
    });
  }, [records, hasFiltered, filterName, filterBreed, filterFarm, filterBirthMonthStart, filterBirthMonthEnd, filterStatus, filterAuction, filterDam, filterSire, filterRecipient]);

  const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

  const handleFilter = () => {
    setHasFiltered(true);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterBreed("");
    setFilterFarm("");
    setFilterBirthMonthStart(null);
    setFilterBirthMonthEnd(null);
    setFilterStatus("");
    setFilterAuction("");
    setFilterDam("");
    setFilterSire("");
    setFilterRecipient("");
    setHasFiltered(false);
    setCurrentPage(1);
  };

  const getSireName = (sireId: string | null) => {
    if (!sireId) return "-";
    return sires.find((s) => s.id === sireId)?.name || "-";
  };

  const getDamName = (damId: string | null) => {
    if (!damId) return "-";
    return dams.find((d) => d.id === damId)?.name || "-";
  };

  const getAuctionName = (auctionId: string | null) => {
    if (!auctionId) return "-";
    return auctions.find((a) => a.id === auctionId)?.name || "-";
  };

  const getStatusLabel = (status: string) => {
    if (status === "in_progress") return "Em Andamento";
    if (status === "finalized_stillborn") return "Finalizado: Natimorto";
    if (status === "sold") return "Vendido";
    return "Finalizado";
  };

  const exportExcel = () => {
    const data = filteredRecords.map((r) => ({
      "Código": r.code,
      "Nome": r.name,
      "Raça": getBreedName(r.breed_id),
      "Fazenda": getFarmName(r.farm_id, r.farm_type),
      "Mês Prev. Nascimento": r.expected_birth_month ? format(new Date(r.expected_birth_month), "MM/yyyy") : "-",
      "Status": getStatusLabel(r.status),
      "Leilão": getAuctionName(r.auction_id),
      "Nome da Mãe": getDamName(r.dam_id),
      "Nome do Pai": getSireName(r.sire_id),
      "Receptora": getRecipientName(r.recipient_id),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prenhez");
    XLSX.writeFile(wb, "gestao_prenhez.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.text("Gestão de Prenhez", 14, 15);
    const headers = [["Código", "Nome", "Raça", "Fazenda", "Mês Prev. Nasc.", "Status", "Leilão", "Mãe", "Pai", "Receptora"]];
    const data = filteredRecords.map((r) => [
      r.code,
      r.name,
      getBreedName(r.breed_id),
      getFarmName(r.farm_id, r.farm_type),
      r.expected_birth_month ? format(new Date(r.expected_birth_month), "MM/yyyy") : "-",
      getStatusLabel(r.status),
      getAuctionName(r.auction_id),
      getDamName(r.dam_id),
      getSireName(r.sire_id),
      getRecipientName(r.recipient_id),
    ]);
    autoTable(doc, { head: headers, body: data, startY: 22, styles: { fontSize: 8 } });
    doc.save("gestao_prenhez.pdf");
  };

  useEffect(() => {
    fetchRecords();
    fetchDropdownData();
    fetchClients();
  }, []);

  const fetchRecords = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;
      setStoreId(profile.store_id);

      const { data, error } = await supabase
        .from("pregnancy_management")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("code", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching pregnancy records:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registros de prenhez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;

      // Fetch all dropdown data in parallel
      const [breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes, animalsRes, vetRes, labRes] = await Promise.all([
        supabase.from("animal_breeds").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("animal_categories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("leiloes").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
        supabase.from("animals").select("id, code, name, ear_tag, category_id").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("veterinarians").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("laboratories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
      ]);

      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      setSires((breedingAnimalsRes.data || []).filter(a => a.sex === "macho"));
      setDams((breedingAnimalsRes.data || []).filter(a => a.sex === "femea"));
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdPartyFarmsRes.data || []);
      setAnimals(animalsRes.data || []);
      setVeterinarians(vetRes.data || []);
      setLaboratories(labRes.data || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
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

  const fetchPregnancySales = async (pregnancyId: string) => {
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from("pregnancy_sales")
        .select("id, client_id, sale_date, sale_value, sale_percentage")
        .eq("pregnancy_id", pregnancyId)
        .order("sale_date", { ascending: true });
      if (error) throw error;
      
      const salesWithNames: PregnancySale[] = [];
      for (const sale of (data || [])) {
        const client = clients.find(c => c.id === sale.client_id);
        salesWithNames.push({
          ...sale,
          client_name: client?.name || "Cliente não encontrado",
        });
      }
      setPregnancySales(salesWithNames);
    } catch (error) {
      console.error("Error fetching pregnancy sales:", error);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleOpenSaleModal = async (record: PregnancyRecord) => {
    setSaleRecord(record);
    setSaleClientId("");
    setSaleDate(null);
    setSaleValue("");
    setSalePercentage("");
    setClientSearchTerm("");
    fetchClients();
    
    // Fetch current owners for this pregnancy
    try {
      const { data: owners } = await supabase
        .from("pregnancy_owners")
        .select("owner_id, owner_type, store_owner_id, percentage")
        .eq("pregnancy_id", record.id);
      
      const ownersWithNames: { owner_id: string; owner_name: string; percentage: number; owner_type: string; store_owner_id: string | null }[] = [];
      for (const o of owners || []) {
        const ownerType = (o as any).owner_type || "supplier";
        let ownerName = "N/A";
        const effectiveId = ownerType === "store" ? (o as any).store_owner_id : o.owner_id;
        
        if (ownerType === "store" && (o as any).store_owner_id) {
          const { data: store } = await supabase.from("stores").select("name").eq("id", (o as any).store_owner_id).single();
          ownerName = store?.name ? `🏠 ${store.name}` : "Fazenda não encontrada";
        } else if (o.owner_id) {
          const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", o.owner_id).single();
          ownerName = supplier?.name || "N/A";
        }
        ownersWithNames.push({ owner_id: effectiveId || "", owner_name: ownerName, percentage: Number(o.percentage), owner_type: ownerType, store_owner_id: (o as any).store_owner_id || null });
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
      const { error } = await supabase.from("pregnancy_sales").insert({
        pregnancy_id: saleRecord.id,
        client_id: saleClientId,
        sale_date: format(saleDate, "yyyy-MM-dd"),
        sale_value: parseFloat(saleValue),
        sale_percentage: percentage,
        created_by: userData.user?.id,
      });
      if (error) throw error;

      // Update all existing owner percentages as edited by the user
      for (const owner of saleOwners) {
        let existingRecord;
        if (owner.owner_type === "store" && owner.store_owner_id) {
          const { data } = await supabase
            .from("pregnancy_owners")
            .select("id")
            .eq("pregnancy_id", saleRecord.id)
            .eq("store_owner_id", owner.store_owner_id)
            .eq("owner_type", "store")
            .maybeSingle();
          existingRecord = data;
        } else {
          const { data } = await supabase
            .from("pregnancy_owners")
            .select("id")
            .eq("pregnancy_id", saleRecord.id)
            .eq("owner_id", owner.owner_id)
            .maybeSingle();
          existingRecord = data;
        }

        if (existingRecord) {
          if (owner.percentage <= 0) {
            await supabase.from("pregnancy_owners").delete().eq("id", existingRecord.id);
          } else {
            await supabase.from("pregnancy_owners").update({ percentage: owner.percentage }).eq("id", existingRecord.id);
          }
        }
      }

      // Add/update buyer as owner with the sold percentage
      const buyerInOwners = saleOwners.find(o => o.owner_id === saleClientId);
      if (!buyerInOwners) {
        const { data: existingOwner } = await supabase
          .from("pregnancy_owners")
          .select("id, percentage")
          .eq("pregnancy_id", saleRecord.id)
          .eq("owner_id", saleClientId)
          .maybeSingle();

        if (existingOwner) {
          await supabase.from("pregnancy_owners")
            .update({ percentage: Number(existingOwner.percentage) + percentage })
            .eq("id", existingOwner.id);
        } else {
          await supabase.from("pregnancy_owners").insert({
            pregnancy_id: saleRecord.id,
            owner_id: saleClientId,
            percentage: percentage,
            created_by: userData.user?.id,
          } as any);
        }
      }

      // Check if fazenda própria still has ownership - if not, mark as sold
      const { data: storeOwners } = await supabase
        .from("pregnancy_owners")
        .select("id, owner_type, percentage")
        .eq("pregnancy_id", saleRecord.id)
        .eq("owner_type", "store");
      
      const storeHasOwnership = storeOwners?.some((o: any) => Number(o.percentage) > 0);
      if (!storeHasOwnership) {
        await supabase.from("pregnancy_management").update({ status: "sold" }).eq("id", saleRecord.id);
      }

      toast({ title: "Sucesso", description: "Venda registrada com sucesso." });
      setSaleModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving sale:", error);
      toast({ title: "Erro", description: "Erro ao salvar venda.", variant: "destructive" });
    }
  };

  const getNextCode = async () => {
    if (!storeId) return 1;
    const { data } = await supabase
      .from("pregnancy_management")
      .select("code")
      .eq("store_id", storeId)
      .order("code", { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0].code + 1 : 1;
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", record?: PregnancyRecord) => {
    setModalMode(mode);
    setActiveTab("dados");

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode,
        name: "",
        sex: "",
        expected_birth_month: null,
        breed_id: "",
        category_id: "",
        auction_id: "",
        auction_lot: "",
        sire_id: "",
        dam_id: "",
        farm: "",
        recipient_id: "",
      });
      setReproData({ aspiration_date: null, transfer_date: null, veterinarian_id: "", laboratory_id: "", ultrasound_date: null });
      setSelectedRecord(null);
      setSelectedRecipient(null);
    } else if (record) {
      setSelectedRecord(record);
      let farmValue = "";
      if (record.farm_id && record.farm_type) {
        farmValue = `${record.farm_type}-${record.farm_id}`;
      }
      setFormData({
        code: record.code,
        name: record.name,
        sex: record.sex,
        expected_birth_month: record.expected_birth_month ? new Date(record.expected_birth_month) : null,
        breed_id: record.breed_id || "",
        category_id: record.category_id || "",
        auction_id: record.auction_id || "",
        auction_lot: record.auction_lot || "",
        sire_id: record.sire_id || "",
        dam_id: record.dam_id || "",
        farm: farmValue,
        recipient_id: record.recipient_id || "",
      });
      setReproData({
        aspiration_date: record.aspiration_date ? new Date(record.aspiration_date + "T12:00:00") : null,
        transfer_date: record.transfer_date ? new Date(record.transfer_date + "T12:00:00") : null,
        veterinarian_id: record.veterinarian_id || "",
        laboratory_id: record.laboratory_id || "",
        ultrasound_date: record.ultrasound_date ? new Date(record.ultrasound_date + "T12:00:00") : null,
      });
      // Find the recipient animal if exists
      if (record.recipient_id) {
        const recipient = animals.find(a => a.id === record.recipient_id);
        setSelectedRecipient(recipient || null);
      } else {
        setSelectedRecipient(null);
      }
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sex) {
      toast({
        title: "Erro",
        description: "O sexo é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;

      // Parse farm value
      let farmId: string | null = null;
      let farmType: string | null = null;
      if (formData.farm) {
        const dashIndex = formData.farm.indexOf("-");
        if (dashIndex > 0) {
          farmType = formData.farm.substring(0, dashIndex);
          farmId = formData.farm.substring(dashIndex + 1);
        }
      }

      const recordData = {
        code: formData.code,
        name: formData.name.trim(),
        sex: formData.sex,
        expected_birth_month: formData.expected_birth_month
          ? format(formData.expected_birth_month, "yyyy-MM-dd")
          : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        farm_id: farmId,
        farm_type: farmType,
        recipient_id: formData.recipient_id || null,
        store_id: profile.store_id,
        aspiration_date: reproData.aspiration_date ? format(reproData.aspiration_date, "yyyy-MM-dd") : null,
        transfer_date: reproData.transfer_date ? format(reproData.transfer_date, "yyyy-MM-dd") : null,
        veterinarian_id: reproData.veterinarian_id || null,
        laboratory_id: reproData.laboratory_id || null,
        ultrasound_date: reproData.ultrasound_date ? format(reproData.ultrasound_date, "yyyy-MM-dd") : null,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("pregnancy_management").insert(recordData);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso." });
      } else {
        const { error } = await supabase
          .from("pregnancy_management")
          .update(recordData)
          .eq("id", selectedRecord!.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso." });
      }

      setModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving record:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase
        .from("pregnancy_management")
        .delete()
        .eq("id", recordToDelete.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Registro excluído com sucesso." });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir registro.",
        variant: "destructive",
      });
    }
  };

  const handleOpenFinalizeDialog = (record: PregnancyRecord) => {
    setRecordToFinalize(record);
    setFinalizeBirthDate(null);
    setFinalizeValidation("");
    setFinalizeName("");
    setFinalizeWeight("");
    setFinalizeDialogOpen(true);
  };

  const handleFinalize = async () => {
    if (!recordToFinalize || !storeId || !finalizeValidation) {
      toast({
        title: "Erro",
        description: "Por favor, selecione a validação (Vivo ou Natimorto).",
        variant: "destructive",
      });
      return;
    }

    if (finalizeValidation === "natimorto") {
      try {
        const { error: updateError } = await supabase
          .from("pregnancy_management")
          .update({ status: "finalized_stillborn" })
          .eq("id", recordToFinalize.id);
        if (updateError) throw updateError;

        toast({
          title: "Sucesso",
          description: "Registro finalizado como Natimorto.",
        });

        setFinalizeDialogOpen(false);
        setRecordToFinalize(null);
        fetchRecords();
      } catch (error) {
        console.error("Error finalizing record:", error);
        toast({
          title: "Erro",
          description: "Erro ao finalizar registro.",
          variant: "destructive",
        });
      }
      return;
    }

    // Vivo flow
    if (!finalizeBirthDate) {
      toast({
        title: "Erro",
        description: "Por favor, informe a data de nascimento do animal.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: codeData } = await supabase.rpc("get_next_animal_code", {
        store_uuid: storeId,
      }) as { data: number | null };

      const animalName = finalizeName.trim() || recordToFinalize.name;
      const birthDateStr = format(finalizeBirthDate, "yyyy-MM-dd");

      const animalInsertData: Record<string, unknown> = {
        code: codeData || 1,
        name: animalName,
        sex: recordToFinalize.sex,
        breed_id: recordToFinalize.breed_id,
        category_id: recordToFinalize.category_id,
        auction_id: recordToFinalize.auction_id,
        auction_lot: recordToFinalize.auction_lot,
        sire_id: recordToFinalize.sire_id,
        dam_id: recordToFinalize.dam_id,
        farm_id: recordToFinalize.farm_id,
        farm_type: recordToFinalize.farm_type,
        recipient_id: recordToFinalize.recipient_id,
        birth_date: birthDateStr,
        store_id: storeId,
        is_active: true,
        aspiration_date: recordToFinalize.aspiration_date,
        transfer_date: recordToFinalize.transfer_date,
        veterinarian_id: recordToFinalize.veterinarian_id,
        laboratory_id: recordToFinalize.laboratory_id,
        ultrasound_date: recordToFinalize.ultrasound_date,
        pregnancy_id: recordToFinalize.id,
      };

      const weight = parseFloat(finalizeWeight);
      if (finalizeWeight && !isNaN(weight) && weight > 0) {
        animalInsertData.first_weight = weight;
        animalInsertData.first_weighing_date = birthDateStr;
      }

      const { error: animalError, data: newAnimal } = await supabase.from("animals").insert(animalInsertData as any).select("id").single();
      if (animalError) throw animalError;

      // Copy pregnancy owners to animal
      if (newAnimal) {
        const { data: pregOwners } = await supabase
          .from("pregnancy_owners")
          .select("owner_id, percentage")
          .eq("pregnancy_id", recordToFinalize.id);

        if (pregOwners && pregOwners.length > 0) {
          const { data: userData } = await supabase.auth.getUser();
          for (const owner of pregOwners) {
            await supabase.from("animal_owners").insert({
              animal_id: newAnimal.id,
              owner_id: owner.owner_id,
              percentage: owner.percentage,
              created_by: userData.user?.id,
            } as any);
          }
        }
      }

      const { error: updateError } = await supabase
        .from("pregnancy_management")
        .update({ status: "finalized" })
        .eq("id", recordToFinalize.id);
      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Animal criado com sucesso a partir do registro de prenhez.",
      });

      setFinalizeDialogOpen(false);
      setRecordToFinalize(null);
      setFinalizeBirthDate(null);
      fetchRecords();
      navigate("/animais/cadastro");
    } catch (error) {
      console.error("Error finalizing record:", error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar registro.",
        variant: "destructive",
      });
    }
  };

  const getBreedName = (breedId: string | null) => {
    if (!breedId) return "-";
    return breeds.find((b) => b.id === breedId)?.name || "-";
  };

  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") {
      return ownFarms.find((f) => f.id === farmId)?.name || "-";
    }
    return thirdPartyFarms.find((f) => f.id === farmId)?.name || "-";
  };

  const getRecipientName = (recipientId: string | null) => {
    if (!recipientId) return "-";
    const animal = animals.find((a) => a.id === recipientId);
    return animal ? `${animal.code} - ${animal.name}` : "-";
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "-";
    return categories.find((c) => c.id === categoryId)?.name || "-";
  };

  // Filter animals for recipient search
  const filteredAnimals = animals.filter((animal) => {
    const searchLower = recipientSearchTerm.toLowerCase();
    const matchesSearch =
      animal.name.toLowerCase().includes(searchLower) ||
      animal.code.toString().includes(searchLower) ||
      (animal.ear_tag && animal.ear_tag.toString().includes(searchLower));
    const matchesCategory = !recipientCategoryFilter || animal.category_id === recipientCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSelectRecipient = (animal: Animal) => {
    setSelectedRecipient(animal);
    setFormData({ ...formData, recipient_id: animal.id });
    setRecipientSearchOpen(false);
    setRecipientSearchTerm("");
    setRecipientCategoryFilter("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gestão de Prenhez</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de gestações</p>
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

        {showFilters && (
          <div className="border rounded-lg p-4 mb-6 bg-card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filtrar por nome..." />
              </div>
              <div>
                <Label>Raça</Label>
                <Select value={filterBreed} onValueChange={setFilterBreed}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {breeds.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fazenda</Label>
                <Select value={filterFarm} onValueChange={setFilterFarm}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ownFarms.map((f) => <SelectItem key={`own-${f.id}`} value={`own-${f.id}`}>{f.name}</SelectItem>)}
                    {thirdPartyFarms.map((f) => <SelectItem key={`third_party-${f.id}`} value={`third_party-${f.id}`}>{f.name}</SelectItem>)}
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
                    <SelectItem value="finalized">Finalizado</SelectItem>
                    <SelectItem value="finalized_stillborn">Natimorto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Mês Prev. Nascimento Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterBirthMonthStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterBirthMonthStart ? format(filterBirthMonthStart, "MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterBirthMonthStart || undefined} onSelect={(d) => setFilterBirthMonthStart(d || null)} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Mês Prev. Nascimento Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterBirthMonthEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterBirthMonthEnd ? format(filterBirthMonthEnd, "MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterBirthMonthEnd || undefined} onSelect={(d) => setFilterBirthMonthEnd(d || null)} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Leilão</Label>
                <Select value={filterAuction} onValueChange={setFilterAuction}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {auctions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome da Mãe</Label>
                <Select value={filterDam} onValueChange={setFilterDam}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {dams.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Nome do Pai</Label>
                <Select value={filterSire} onValueChange={setFilterSire}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sires.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Receptora</Label>
                <Select value={filterRecipient} onValueChange={setFilterRecipient}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleFilter}>
                <Search className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>Limpar Filtros</Button>
            </div>
          </div>
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
                    <TableHead>Mês Prev. Nascimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          {record.expected_birth_month
                            ? format(new Date(record.expected_birth_month), "MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              record.status === "in_progress"
                                ? "bg-yellow-100 text-yellow-800"
                                : record.status === "finalized_stillborn"
                                ? "bg-red-100 text-red-800"
                                : record.status === "sold"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            )}
                          >
                            {getStatusLabel(record.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal("view", record)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {record.status === "in_progress" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleOpenModal("edit", record)}>
                                      <Pencil className="h-4 w-4 mr-2" />Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setRecordToDelete(record); setDeleteDialogOpen(true); }}>
                                      <Trash2 className="h-4 w-4 mr-2" />Excluir
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenSaleModal(record)}>
                                      <DollarSign className="h-4 w-4 mr-2" />Venda
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenFinalizeDialog(record)} className="text-green-600">
                                      <CheckCircle className="h-4 w-4 mr-2" />Finalizar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({filteredRecords.length} registros)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
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
              {modalMode === "view"
                ? "Visualizar Registro"
                : modalMode === "edit"
                ? "Editar Registro"
                : "Novo Registro de Prenhez"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val);
            if (val === "financeiro" && selectedRecord && modalMode === "view") {
              fetchPregnancyFinancial(selectedRecord.id, (selectedRecord as any).embryo_transfer_id);
            }
            if (val === "proprietarios" && selectedRecord) {
              fetchClients();
              fetchPregnancySales(selectedRecord.id);
            }
          }}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="reproducao">Dados Reprodução</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="financeiro">
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="proprietarios">
                Proprietários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={modalMode === "view"}
                  />
                </div>
                <div>
                  <Label>Sexo *</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({ ...formData, sex: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="macho">Macho</SelectItem>
                      <SelectItem value="femea">Fêmea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Mês Previsto de Nascimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.expected_birth_month && "text-muted-foreground"
                        )}
                        disabled={modalMode === "view"}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expected_birth_month
                          ? format(formData.expected_birth_month, "MM/yyyy", { locale: ptBR })
                          : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.expected_birth_month || undefined}
                        onSelect={(date) => setFormData({ ...formData, expected_birth_month: date || null })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Raça</Label>
                  <Select
                    value={formData.breed_id}
                    onValueChange={(value) => setFormData({ ...formData, breed_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {breeds.map((breed) => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fazenda</Label>
                  <Select
                    value={formData.farm}
                    onValueChange={(value) => setFormData({ ...formData, farm: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ownFarms.length > 0 && (
                        <>
                          <SelectItem value="header-own" disabled className="font-semibold">
                            Fazendas Próprias
                          </SelectItem>
                          {ownFarms.map((farm) => (
                            <SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {thirdPartyFarms.length > 0 && (
                        <>
                          <SelectItem value="header-third" disabled className="font-semibold border-t mt-2 pt-2">
                            Fazendas Terceiras
                          </SelectItem>
                          {thirdPartyFarms.map((farm) => (
                            <SelectItem key={`third_party-${farm.id}`} value={`third_party-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Leilão</Label>
                  <Select
                    value={formData.auction_id}
                    onValueChange={(value) => setFormData({ ...formData, auction_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {auctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          {auction.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote Leilão</Label>
                  <Input
                    value={formData.auction_lot}
                    onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })}
                    disabled={modalMode === "view"}
                  />
                </div>
              </div>

              {/* Receptora field */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
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
                      disabled={modalMode === "view"}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    {selectedRecipient && modalMode !== "view" && (
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
                      <Calendar mode="single" selected={reproData.aspiration_date || undefined} onSelect={(d) => setReproData({ ...reproData, aspiration_date: d || null })} locale={ptBR} className="pointer-events-auto" />
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
                      <Calendar mode="single" selected={reproData.transfer_date || undefined} onSelect={(d) => setReproData({ ...reproData, transfer_date: d || null })} locale={ptBR} className="pointer-events-auto" />
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
                <div>
                  <Label>Data de Ultrassom</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reproData.ultrasound_date && "text-muted-foreground")} disabled={modalMode === "view"}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reproData.ultrasound_date ? format(reproData.ultrasound_date, "dd/MM/yyyy") : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={reproData.ultrasound_date || undefined} onSelect={(d) => setReproData({ ...reproData, ultrasound_date: d || null })} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </TabsContent>

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
                      disabled={modalMode === "view"}
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
                      disabled={modalMode === "view"}
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
                      <DropdownMenuItem onClick={() => generatePregnancyFinancialPDF("resumido")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generatePregnancyFinancialPDF("detalhado")}>
                        <FileText className="h-4 w-4 mr-2" />PDF Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={generatePregnancyFinancialExcel}>
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
                              const rateioColor = record.allocation_type === "aspiration_rateio" ? "bg-orange-50" : "bg-blue-50";
                              return (
                              <TableRow key={record.id} className={cn("h-7", isRateio ? rateioColor : "")}>
                                 <TableCell className="py-1 text-sm">{isRateio ? "" : (record.document_number || "-")}</TableCell>
                                 <TableCell className={cn("py-1 text-sm max-w-[180px] truncate", isRateio ? (record.allocation_type === "aspiration_rateio" ? "font-medium text-orange-700" : "font-medium text-blue-700") : "")}>
                                   {isRateio ? (record.rateio_label || "Rateio") : (record.supplier_name || record.creditor_name || "-")}
                                 </TableCell>
                                 <TableCell className="py-1 text-sm">
                                   {isRateio ? (
                                     <Badge variant="outline" className={cn("text-[12px] px-1.5 py-0", record.allocation_type === "aspiration_rateio" ? "border-orange-300 text-orange-700" : "border-blue-300 text-blue-700")}>Rateio</Badge>
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

            <TabsContent value="proprietarios" className="mt-4 space-y-4">
              <OwnersTab
                entityId={selectedRecord?.id || null}
                entityType="pregnancy"
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
                  ) : pregnancySales.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhuma venda registrada.</p>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pregnancySales.map((sale) => (
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
                            {pregnancySales.reduce((s, r) => s + r.sale_value, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="font-semibold">
                            {pregnancySales.reduce((s, r) => s + r.sale_percentage, 0).toFixed(2)}%
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
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              <Table>
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
                  {filteredAnimals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Nenhum animal encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnimals.map((animal) => (
                      <TableRow key={animal.id}>
                        <TableCell>{animal.code}</TableCell>
                        <TableCell>{animal.name}</TableCell>
                        <TableCell>{animal.ear_tag || "-"}</TableCell>
                        <TableCell>{getCategoryName(animal.category_id)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSelectRecipient(animal)}
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
          <DialogHeader>
            <DialogTitle>Finalizar Registro de Prenhez</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Validação *</Label>
              <Select value={finalizeValidation} onValueChange={(value) => {
                setFinalizeValidation(value);
                if (value === "natimorto") {
                  setFinalizeBirthDate(null);
                  setFinalizeName("");
                  setFinalizeWeight("");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivo">Vivo</SelectItem>
                  <SelectItem value="natimorto">Natimorto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {finalizeValidation === "natimorto" && (
              <p className="text-sm text-destructive">
                O registro será finalizado como Natimorto. Nenhum animal será criado no cadastro.
              </p>
            )}

            {finalizeValidation === "vivo" && (
              <>
                <div className="space-y-2">
                  <Label>Data de Nascimento *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !finalizeBirthDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {finalizeBirthDate
                          ? format(finalizeBirthDate, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione a data de nascimento..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={finalizeBirthDate || undefined}
                        onSelect={(date) => setFinalizeBirthDate(date || null)}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={finalizeName}
                    onChange={(e) => setFinalizeName(e.target.value)}
                    placeholder={recordToFinalize?.name || "Será usado o nome da prenhez"}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={finalizeWeight}
                    onChange={(e) => setFinalizeWeight(e.target.value)}
                    placeholder="Peso ao nascer"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={!finalizeValidation || (finalizeValidation === "vivo" && !finalizeBirthDate)}
            >
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Modal */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Venda - {saleRecord?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {saleClientId ? clients.find(c => c.id === saleClientId)?.name || "Selecionar..." : "Selecionar cliente..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50">
                  <div className="p-2">
                    <Input
                      placeholder="Pesquisar cliente..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {clients
                      .filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
                      .map(client => (
                        <div
                          key={client.id}
                          className={cn(
                            "px-3 py-2 cursor-pointer hover:bg-accent text-sm",
                            saleClientId === client.id && "bg-accent font-medium"
                          )}
                          onClick={() => {
                            setSaleClientId(client.id);
                            setClientPopoverOpen(false);
                          }}
                        >
                          {client.name}
                        </div>
                      ))}
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

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
              <Label>Valor da Venda (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>% de Venda *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={salePercentage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (e.target.value === "" || (val >= 0 && val <= 100)) {
                    setSalePercentage(e.target.value);
                  }
                }}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSale}>Salvar Venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnimaisGestaoPrenhez;
