import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Edit, RefreshCw, Upload, X, FileText, FileDown, DollarSign, Eye, Paperclip, Loader2, Search } from "lucide-react";
import { ProductSearchModal } from "./ProductSearchModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateAccountsReceivablePeriod } from "@/utils/periodValidation";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { cn } from "@/lib/utils";
import {
  FINANCIAL_ALLOCATION_OPTIONS,
  fetchRecipientAllocationOptions,
  FinancialAllocationType,
  getFinancialAllocationLabel,
  getFinancialAllocationTargetId,
} from "@/lib/financialAllocations";

interface AccountsReceivableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Creditor {
  id: string;
  name: string;
  cnpj_cpf?: string;
}

interface Product {
  id: string;
  name: string;
  code?: string;
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface CurrentAccount {
  id: string;
  name: string;
  bank: string;
  account_number: string;
  account_type: 'current' | 'cash' | 'card' | 'delivery';
}

interface ReceivableItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  store_id: string;
  store_name: string;
  allocation_type?: FinancialAllocationType | '';
  allocation_id?: string;
  allocation_name?: string;
}

interface AccountReceivable {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  document_type?: string;
  document_number?: string;
  issue_date?: string;
  notes?: string;
  store_id?: string;
  suppliers?: { name: string };
  creditors?: { name: string }; // alias for backwards compat
  stores?: { name: string };
  created_at: string;
  payment_date?: string;
  attachments?: any;
  last_payment_date?: string;
  data_competencia?: string | null;
}

interface Installment {
  id?: string;
  installment_number: number;
  due_date: string;
  amount: number;
  payment_date?: string | null;
}

interface DBInstallment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  payment_date: string | null;
  payment_account_name?: string;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export function AccountsReceivableModal({ open, onOpenChange }: AccountsReceivableModalProps) {
  const [activeTab, setActiveTab] = useState("view");
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [items, setItems] = useState<ReceivableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { canEdit } = useFinanceiroPermissions();
  
  // Document types from database
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<AccountReceivable | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  
  // Installments from database for payment
  const [dbInstallments, setDbInstallments] = useState<DBInstallment[]>([]);
  const [allInstallments, setAllInstallments] = useState<DBInstallment[]>([]);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>("");
  
  // Payment attachments state
  const [paymentAttachments, setPaymentAttachments] = useState<Array<{file: File; name: string; title: string}>>([]);
  const [uploadingPaymentAttachment, setUploadingPaymentAttachment] = useState(false);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  // Function to convert date input to local timezone format - prevents timezone issues
  const formatDateForDatabase = (dateString: string): string => {
    if (!dateString) return dateString;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Parse the date string and format properly
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return dateString;
  };

  // Reverse payment modal state  
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseAccount, setReverseAccount] = useState<AccountReceivable | null>(null);
  const [reverseInstallments, setReverseInstallments] = useState<DBInstallment[]>([]);
  const [selectedReverseInstallments, setSelectedReverseInstallments] = useState<string[]>([]);
  const { toast } = useToast();

  // Filter fields
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCreditor, setFilterCreditor] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterDocumentNumber, setFilterDocumentNumber] = useState("");
  const [filterCurrentAccount, setFilterCurrentAccount] = useState("");
  const [filterDueDateFrom, setFilterDueDateFrom] = useState("");
  const [filterDueDateTo, setFilterDueDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCreatedDateFrom, setFilterCreatedDateFrom] = useState("");
  const [filterCreatedDateTo, setFilterCreatedDateTo] = useState("");
  const [showFilteredData, setShowFilteredData] = useState(false);

  // Payment tab filters
  const [paymentFilterDateFrom, setPaymentFilterDateFrom] = useState("");
  const [paymentFilterDateTo, setPaymentFilterDateTo] = useState("");
  const [paymentFilterCreditor, setPaymentFilterCreditor] = useState("");
  const [paymentFilterStore, setPaymentFilterStore] = useState("");
  const [paymentFilterDocumentNumber, setPaymentFilterDocumentNumber] = useState("");
  const [paymentFilterCurrentAccount, setPaymentFilterCurrentAccount] = useState("");
  const [paymentFilterDueDateFrom, setPaymentFilterDueDateFrom] = useState("");
  const [paymentFilterDueDateTo, setPaymentFilterDueDateTo] = useState("");
  const [paymentShowFilteredData, setPaymentShowFilteredData] = useState(false);

  // Edit mode
  const [editingAccount, setEditingAccount] = useState<AccountReceivable | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRealEdit, setIsRealEdit] = useState(false);
  const [isAttachmentOnlyEdit, setIsAttachmentOnlyEdit] = useState(false);

  // View-only mode
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [viewOnlyAccount, setViewOnlyAccount] = useState<AccountReceivable | null>(null);

  // Form fields
  const [creditorId, setCreditorId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dataCompetencia, setDataCompetencia] = useState("");
  const [notes, setNotes] = useState("");

  // Parcelas
  const [noteRecorded, setNoteRecorded] = useState(false);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState(1);
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Item form fields
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedStore, setSelectedStore] = useState("");
  const [defaultStore, setDefaultStore] = useState("");
  
  // Product search
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Allocation fields
  const [allocationType, setAllocationType] = useState<FinancialAllocationType | ''>('');
  const [allocationId, setAllocationId] = useState("");
  const [allocationAnimals, setAllocationAnimals] = useState<Array<{id: string; name: string; code: number; ear_tag: number | null; registration: string | null}>>([]);
  const [allocationPregnancies, setAllocationPregnancies] = useState<Array<{id: string; name: string}>>([]);
  const [allocationEmbryoTransfers, setAllocationEmbryoTransfers] = useState<Array<{id: string; name: string}>>([]);
  const [allocationAspirations, setAllocationAspirations] = useState<Array<{id: string; name: string; code: number}>>([]);
  const [allocationRecipients, setAllocationRecipients] = useState<Array<{id: string; name: string; code: number; ear_tag: number | null; registration: string | null}>>([]);
  const [allocationSearchTerm, setAllocationSearchTerm] = useState("");

  // File upload fields
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Array<{name: string, url?: string, path?: string, size?: number, type?: string}>>([]);

  useEffect(() => {
    if (open) {
      fetchCreditors();
      fetchProducts();
      fetchStores();
      fetchCurrentAccounts();
      fetchAllocationData();
      fetchDocumentTypes();
      if (activeTab === "view") {
        fetchFilteredAccountsReceivable();
      }
      if (activeTab === "payment") {
        clearPaymentFilters();
      }
    } else {
      // Reset form when modal is closed
      setCreditorId("");
      setDocumentType("");
      setDocumentNumber("");
      setIssueDate("");
      setDueDate("");
      setDataCompetencia("");
      setNotes("");
      setItems([]);
      setDefaultStore("");
      setSelectedStore("");
      setSelectedProduct("");
      setQuantity(1);
      setUnitPrice(0);
      setAllocationType('');
      setAllocationId('');
      setAllocationSearchTerm('');
      setNoteRecorded(false);
      setInstallments([]);
      setEditingAccount(null);
      setIsEditing(false);
      setIsRealEdit(false);
      setIsAttachmentOnlyEdit(false);
      setIsViewOnly(false);
      setViewOnlyAccount(null);
      setAttachments([]);
      setExistingAttachments([]);
    }
  }, [open, activeTab]);

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("document_types")
        .select("id, code, name, is_active")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error) {
      console.error("Error fetching document types:", error);
    }
  };

  const fetchAllocationData = async () => {
    try {
      const [
        animalsResponse,
        recipientData,
      ] = await Promise.all([
        supabase
          .from("animals")
          .select("id, name, code, ear_tag, registration")
          .eq("is_active", true)
          .order("name"),
        fetchRecipientAllocationOptions(),
      ]);
      setAllocationAnimals(animalsResponse.data || []);
      setAllocationRecipients(recipientData || []);

      // Fetch em_andamento pregnancies + financial_released pregnancies
      const { data: pregnancyInProgress } = await supabase
        .from("pregnancy_management")
        .select("id, name")
        .eq("status", "em_andamento")
        .order("name");

      const { data: pregnancyReleased } = await supabase
        .from("pregnancy_management")
        .select("id, name")
        .eq("financial_released", true)
        .neq("status", "em_andamento")
        .order("name");

      const allPregnancies = [...(pregnancyInProgress || []), ...(pregnancyReleased || [])];
      setAllocationPregnancies(allPregnancies);

      const { data: embryoData } = await supabase
        .from("embryo_transfer_management")
        .select("id, name")
        .eq("status", "in_progress")
        .order("name");
      setAllocationEmbryoTransfers(embryoData || []);

      // Fetch active aspirations + financial_released aspirations
      const { data: aspirationActive } = await supabase
        .from("aspiration_management")
        .select("id, name, code")
        .in("status", ["pending", "in_progress"])
        .order("name");

      const { data: aspirationReleased } = await supabase
        .from("aspiration_management")
        .select("id, name, code")
        .eq("financial_released", true)
        .not("status", "in", '("pending","in_progress")')
        .order("name");

      setAllocationAspirations([...(aspirationActive || []), ...(aspirationReleased || [])]);
    } catch (error) {
      console.error("Error fetching allocation data:", error);
    }
  };

  const saveItemAllocations = async (itemsList: ReceivableItem[], insertedItems: Array<{id: string}>) => {
    const allocations = itemsList
      .map((item, index) => {
        if (!item.allocation_type || !item.allocation_id || !insertedItems[index]) return null;
        const alloc: any = {
          account_receivable_item_id: insertedItems[index].id,
          allocation_type: item.allocation_type,
        };
        if (item.allocation_type === 'animal') alloc.animal_id = item.allocation_id;
        if (item.allocation_type === 'pregnancy') alloc.pregnancy_id = item.allocation_id;
        if (item.allocation_type === 'embryo_transfer') alloc.embryo_transfer_id = item.allocation_id;
        if (item.allocation_type === 'aspiration') alloc.aspiration_id = item.allocation_id;
        if (item.allocation_type === 'recipient') alloc.recipient_id = item.allocation_id;
        return alloc;
      })
      .filter(Boolean);

    if (allocations.length > 0) {
      const { error } = await supabase
        .from("accounts_receivable_item_allocations")
        .insert(allocations);
      if (error) console.error("Error saving allocations:", error);
    }
  };

  const getAllocationName = (type: string, id: string): string => {
    if (!type || !id) return '';
    switch (type) {
      case 'animal': return allocationAnimals.find(a => a.id === id)?.name || '';
      case 'pregnancy': return allocationPregnancies.find(p => p.id === id)?.name || '';
      case 'embryo_transfer': return allocationEmbryoTransfers.find(e => e.id === id)?.name || '';
      case 'aspiration': return allocationAspirations.find(a => a.id === id)?.name || '';
      case 'recipient': return allocationRecipients.find(r => r.id === id)?.name || '';
      default: return '';
    }
  };

  const getAllocationLabel = (type: string): string => {
    return getFinancialAllocationLabel(type);
  };

  const fetchAccountsReceivable = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select(`
          *,
          suppliers!accounts_receivable_creditor_id_fkey(name),
          stores(name)
        `)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccountsReceivable((data as any) || []);
    } catch (error) {
      console.error("Error fetching accounts receivable:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a receber",
        variant: "destructive",
      });
    }
  };

  const fetchFilteredPaymentAccounts = async () => {
    try {
      let query = supabase
        .from("accounts_receivable")
        .select(`
          *,
          suppliers!accounts_receivable_creditor_id_fkey(name),
          stores(name)
        `)
        .in("status", ["pending", "partial"]);

      // Apply payment filters
      if (paymentFilterDateFrom) {
        query = query.gte("payment_date", paymentFilterDateFrom);
      }
      if (paymentFilterDateTo) {
        query = query.lte("payment_date", paymentFilterDateTo);
      }
      if (paymentFilterCreditor && paymentFilterCreditor !== "all") {
        query = query.eq("creditor_id", paymentFilterCreditor);
      }
      if (paymentFilterStore && paymentFilterStore !== "all") {
        query = query.eq("store_id", paymentFilterStore);
      }
      if (paymentFilterDocumentNumber) {
        query = query.ilike("document_number", `%${paymentFilterDocumentNumber}%`);
      }
      if (paymentFilterDueDateFrom) {
        query = query.gte("due_date", paymentFilterDueDateFrom);
      }
      if (paymentFilterDueDateTo) {
        query = query.lte("due_date", paymentFilterDueDateTo);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAccountsReceivable((data as any) || []);
      setPaymentShowFilteredData(true);
    } catch (error) {
      console.error("Error fetching filtered payment accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a receber filtradas",
        variant: "destructive",
      });
    }
  };

  const clearPaymentFilters = () => {
    setPaymentFilterDateFrom("");
    setPaymentFilterDateTo("");
    setPaymentFilterCreditor("all");
    setPaymentFilterStore("all");
    setPaymentFilterDocumentNumber("");
    setPaymentFilterCurrentAccount("");
    setPaymentFilterDueDateFrom("");
    setPaymentFilterDueDateTo("");
    setAccountsReceivable([]);
    setPaymentShowFilteredData(false);
  };

  const fetchFilteredAccountsReceivable = async () => {
    try {
      let query = supabase
        .from("accounts_receivable")
        .select(`
          *,
          suppliers!accounts_receivable_creditor_id_fkey(name),
          stores(name)
        `);

      // Apply filters only if they have values (removed status filter to show all accounts)
      if (filterDateFrom || filterDateTo) {
        if (filterDateFrom && filterDateTo) {
          query = query.gte("payment_date", filterDateFrom).lte("payment_date", filterDateTo);
        } else if (filterDateFrom) {
          query = query.gte("payment_date", filterDateFrom);
        } else if (filterDateTo) {
          query = query.lte("payment_date", filterDateTo);
        }
      }
      
      if (filterCreditor && filterCreditor !== "all" && filterCreditor !== "") {
        query = query.eq("creditor_id", filterCreditor);
      }
      if (filterStore && filterStore !== "all" && filterStore !== "") {
        query = query.eq("store_id", filterStore);
      }
      if (filterDocumentNumber.trim()) {
        query = query.ilike("document_number", `%${filterDocumentNumber}%`);
      }
      if (filterDueDateFrom) {
        query = query.gte("due_date", filterDueDateFrom);
      }
      if (filterDueDateTo) {
        query = query.lte("due_date", filterDueDateTo);
      }
      if (filterStatus && filterStatus !== "all" && filterStatus !== "") {
        query = query.eq("status", filterStatus);
      }
      
      // Filtro por período de cadastro (created_at)
      if (filterCreatedDateFrom) {
        query = query.gte("created_at", `${filterCreatedDateFrom}T00:00:00`);
      }
      if (filterCreatedDateTo) {
        query = query.lte("created_at", `${filterCreatedDateTo}T23:59:59`);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      // For each account, fetch the last payment date from installments
      const accountsWithLastPayment = await Promise.all(
        ((data as any) || []).map(async (account: any) => {
          // First try to get the last paid installment
          const { data: lastInstallment } = await supabase
            .from("accounts_receivable_installments")
            .select("payment_date")
            .eq("account_receivable_id", account.id)
            .not("payment_date", "is", null)
            .order("payment_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          return {
            ...account,
            last_payment_date: lastInstallment?.payment_date || account.payment_date
          };
        })
      );
      
      setAccountsReceivable(accountsWithLastPayment);
      setShowFilteredData(true);
    } catch (error) {
      console.error("Error fetching filtered accounts receivable:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a receber filtradas",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCreditor("all");
    setFilterStore("all");
    setFilterDocumentNumber("");
    setFilterCurrentAccount("");
    setFilterDueDateFrom("");
    setFilterDueDateTo("");
    setFilterStatus("all");
    setFilterCreatedDateFrom("");
    setFilterCreatedDateTo("");
    setAccountsReceivable([]);
    setShowFilteredData(false);
  };

  const openPaymentModal = async (account: AccountReceivable) => {
    setPaymentAccount(account);
    setSelectedAccountId("");
    setPaymentDate("");
    setSurcharge(0);
    setDiscount(0);
    setSelectedInstallmentId("");
    
    // Fetch all installments from database
    try {
      const { data: installmentsData, error } = await supabase
        .from("accounts_receivable_installments")
        .select("*")
        .eq("account_receivable_id", account.id)
        .order("installment_number", { ascending: true });
      
      if (error) throw error;
      
      // For paid installments, fetch the payment account info
      const installmentsWithAccountInfo = await Promise.all(
        (installmentsData || []).map(async (inst) => {
          if (inst.payment_date) {
            // Fetch payment info for this installment
            const { data: paymentData } = await supabase
              .from("accounts_receivable_payments")
              .select("payment_account_id, payment_account_type")
              .eq("installment_id", inst.id)
              .maybeSingle();
            
            if (paymentData?.payment_account_id) {
              // Fetch account name based on type
              const { data: accountData } = await supabase
                .from("current_accounts")
                .select("name, bank, account_number")
                .eq("id", paymentData.payment_account_id)
                .maybeSingle();
              
              if (accountData) {
                return {
                  ...inst,
                  payment_account_name: `${accountData.name} - ${accountData.bank} (${accountData.account_number})`
                };
              }
            }
          }
          return inst;
        })
      );
      
      // Store all installments for display
      setAllInstallments(installmentsWithAccountInfo);
      
      // Filter only pending installments (no payment_date)
      const pendingInstallments = installmentsWithAccountInfo.filter(inst => !inst.payment_date);
      setDbInstallments(pendingInstallments);
      
      // If only one pending installment, auto-select it
      if (pendingInstallments.length === 1) {
        setSelectedInstallmentId(pendingInstallments[0].id);
      }
    } catch (error) {
      console.error("Error fetching installments:", error);
      setDbInstallments([]);
      setAllInstallments([]);
    }
    
    setShowPaymentModal(true);
  };

  const handleEditAccount = async (account: AccountReceivable) => {
    console.log('Editing account:', account);
    
    // Check if account has any payments
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("accounts_receivable_payments")
        .select("id")
        .eq("account_receivable_id", account.id)
        .limit(1);

      if (paymentsError) throw paymentsError;

      const hasPayments = paymentsData && paymentsData.length > 0;
      
      if (hasPayments) {
        toast({
          title: "Atenção",
          description: "Esta conta possui recebimentos realizados. Apenas upload de arquivos será permitido.",
        });
        setIsAttachmentOnlyEdit(true);
      } else {
        setIsAttachmentOnlyEdit(false);
      }
    } catch (error) {
      console.error("Error checking payments:", error);
      setIsAttachmentOnlyEdit(false);
    }
    
    setEditingAccount(account);
    setIsEditing(true);
    setIsRealEdit(true);
    setActiveTab("create");
    
    // Load form data - creditor will be loaded from full account data
    setCreditorId(""); // Will be set after fetching full account data
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
    setDataCompetencia((account as any).data_competencia || "");
    setNotes(account.notes || "");
    
    // Load items
    try {
      const { data: itemsData, error } = await supabase
        .from("accounts_receivable_items")
        .select(`
          *,
          products(name),
          stores(name)
        `)
        .eq("account_receivable_id", account.id);

      if (error) throw error;

      const itemIds = (itemsData || []).map((item: any) => item.id);
      let allocationsMap = new Map();
      if (itemIds.length > 0) {
        const { data: allocData } = await supabase
          .from("accounts_receivable_item_allocations")
          .select("*")
          .in("account_receivable_item_id", itemIds);
        (allocData || []).forEach((a: any) => allocationsMap.set(a.account_receivable_item_id, a));
      }

      const formattedItems = (itemsData || []).map((item: any) => {
        const alloc = allocationsMap.get(item.id);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id,
          store_name: item.stores?.name || "",
          allocation_type: alloc?.allocation_type || undefined,
          allocation_id: getFinancialAllocationTargetId(alloc),
          allocation_name: alloc ? getAllocationName(alloc.allocation_type, getFinancialAllocationTargetId(alloc) || "") : undefined,
        };
      });

      setItems(formattedItems);
      setNoteRecorded(true);

      // Load existing attachments and creditor_id
      const { data: accountFullData } = await supabase
        .from("accounts_receivable")
        .select("*, suppliers!accounts_receivable_creditor_id_fkey(id, name)")
        .eq("id", account.id)
        .single();

      if (accountFullData) {
        setCreditorId(accountFullData.creditor_id || "");
        if ((accountFullData as any).attachments) {
          setExistingAttachments((accountFullData as any).attachments as Array<{name: string, url?: string, path?: string, size?: number, type?: string}>);
        } else {
          setExistingAttachments([]);
        }
      }
      setAttachments([]);
    } catch (error) {
      console.error("Error loading account items:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar itens da conta",
        variant: "destructive",
      });
    }
  };

  const handleViewAccount = async (account: AccountReceivable) => {
    setViewOnlyAccount(account);
    setIsViewOnly(true);
    setActiveTab("create");
    
    // Load form data
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
    setDataCompetencia((account as any).data_competencia || "");
    setNotes(account.notes || "");
    
    // Load creditor id
    try {
      const { data: accountFullData } = await supabase
        .from("accounts_receivable")
        .select("*, suppliers!accounts_receivable_creditor_id_fkey(id, name)")
        .eq("id", account.id)
        .single();

      if (accountFullData) {
        setCreditorId(accountFullData.creditor_id || "");
        
        // Load existing attachments
        if ((accountFullData as any).attachments) {
          setExistingAttachments((accountFullData as any).attachments as Array<{name: string, url?: string, path?: string, size?: number, type?: string}>);
        } else {
          setExistingAttachments([]);
        }
      }
      setAttachments([]);
      
      // Load items
      const { data: itemsData, error } = await supabase
        .from("accounts_receivable_items")
        .select(`
          *,
          products(name),
          stores(name)
        `)
        .eq("account_receivable_id", account.id);

      if (error) throw error;

      const itemIds2 = (itemsData || []).map((item: any) => item.id);
      let allocationsMap2 = new Map();
      if (itemIds2.length > 0) {
        const { data: allocData2 } = await supabase
          .from("accounts_receivable_item_allocations")
          .select("*")
          .in("account_receivable_item_id", itemIds2);
        (allocData2 || []).forEach((a: any) => allocationsMap2.set(a.account_receivable_item_id, a));
      }

      const formattedItems = (itemsData || []).map((item: any) => {
        const alloc = allocationsMap2.get(item.id);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id,
          store_name: item.stores?.name || "",
          allocation_type: alloc?.allocation_type || undefined,
          allocation_id: getFinancialAllocationTargetId(alloc),
          allocation_name: alloc ? getAllocationName(alloc.allocation_type, getFinancialAllocationTargetId(alloc) || "") : undefined,
        };
      });

      setItems(formattedItems);
    } catch (error) {
      console.error("Error loading account data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da conta",
        variant: "destructive",
      });
    }
  };

  const handleReversePayment = async (account: AccountReceivable) => {
    setReverseAccount(account);
    setSelectedReverseInstallments([]);
    
    // Fetch paid installments for this account
    try {
      const { data: installmentsData, error } = await supabase
        .from("accounts_receivable_installments")
        .select("*")
        .eq("account_receivable_id", account.id)
        .not("payment_date", "is", null)
        .order("installment_number");

      if (error) throw error;
      
      // For paid installments, fetch the payment account info
      const installmentsWithAccountInfo = await Promise.all(
        (installmentsData || []).map(async (inst) => {
          // Fetch payment info for this installment
          const { data: paymentData } = await supabase
            .from("accounts_receivable_payments")
            .select("payment_account_id, payment_account_type")
            .eq("installment_id", inst.id)
            .maybeSingle();
          
          if (paymentData?.payment_account_id) {
            const accountType = paymentData.payment_account_type || 'current';
            let accountName = '';
            
            // Fetch account name based on type
            if (accountType === 'current') {
              const { data: accountData } = await supabase
                .from("current_accounts")
                .select("name, bank, account_number")
                .eq("id", paymentData.payment_account_id)
                .maybeSingle();
              
              if (accountData) {
                accountName = `${accountData.name} - ${accountData.bank} (${accountData.account_number})`;
              }
            } else if (accountType === 'cash') {
              const { data: accountData } = await supabase
                .from("cash_accounts")
                .select("name")
                .eq("id", paymentData.payment_account_id)
                .maybeSingle();
              
              if (accountData) {
                accountName = `${accountData.name} (Caixa)`;
              }
            } else if (accountType === 'card') {
              const { data: accountData } = await supabase
                .from("card_accounts")
                .select("name, bank")
                .eq("id", paymentData.payment_account_id)
                .maybeSingle();
              
              if (accountData) {
                accountName = `${accountData.name} - ${accountData.bank} (Cartão)`;
              }
            } else if (accountType === 'delivery') {
              const { data: accountData } = await supabase
                .from("delivery_accounts")
                .select("name")
                .eq("id", paymentData.payment_account_id)
                .maybeSingle();
              
              if (accountData) {
                accountName = `${accountData.name} (Delivery)`;
              }
            }
            
            if (accountName) {
              return {
                ...inst,
                payment_account_name: accountName
              };
            }
          }
          return inst;
        })
      );
      
      setReverseInstallments(installmentsWithAccountInfo);
    } catch (error) {
      console.error("Error fetching paid installments:", error);
      setReverseInstallments([]);
    }
    
    setShowReverseModal(true);
  };

  const performReversePayment = async (accountId: string) => {
    if (reverseInstallments.length > 0 && selectedReverseInstallments.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos uma parcela para estornar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Validate period block for each selected installment
      if (reverseInstallments.length > 0) {
        for (const installmentId of selectedReverseInstallments) {
          const installment = reverseInstallments.find(i => i.id === installmentId);
          if (installment?.payment_date) {
            const periodValidation = await validateAccountsReceivablePeriod.pagamento(installment.payment_date);
            if (periodValidation.blocked) {
              toast({
                title: "Período Bloqueado",
                description: periodValidation.message || "O período está bloqueado para estornos.",
                variant: "destructive",
              });
              setLoading(false);
              return;
            }
          }
        }
      } else {
        // No installments - check the account payment_date
        if (reverseAccount?.payment_date) {
          const periodValidation = await validateAccountsReceivablePeriod.pagamento(reverseAccount.payment_date);
          if (periodValidation.blocked) {
            toast({
              title: "Período Bloqueado",
              description: periodValidation.message || "O período está bloqueado para estornos.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
      }
      if (reverseInstallments.length > 0) {
        // Delete payment records from accounts_receivable_payments for selected installments
        for (const installmentId of selectedReverseInstallments) {
          const { error: deletePaymentError } = await supabase
            .from("accounts_receivable_payments")
            .delete()
            .eq("installment_id", installmentId);

          if (deletePaymentError) throw deletePaymentError;

          // Delete financial transaction for this installment
          // Tenta primeiro com reference_type = accounts_receivable_installments
          const { error: deleteTransactionError1 } = await supabase
            .from("financial_transactions")
            .delete()
            .eq("reference_id", installmentId)
            .eq("reference_type", "accounts_receivable_installments");

          if (deleteTransactionError1) throw deleteTransactionError1;

          // Também tenta com reference_type = accounts_receivable (para compatibilidade com registros antigos)
          // Busca pelo account_receivable_id correspondente
          const { error: deleteTransactionError2 } = await supabase
            .from("financial_transactions")
            .delete()
            .eq("reference_id", accountId)
            .eq("reference_type", "accounts_receivable");

          if (deleteTransactionError2) throw deleteTransactionError2;

          // Update installment to remove payment_date
          const { error: installmentError } = await supabase
            .from("accounts_receivable_installments")
            .update({ payment_date: null })
            .eq("id", installmentId);

          if (installmentError) throw installmentError;
        }

        // Check if there are any remaining paid installments
        const { data: remainingPaid, error: checkError } = await supabase
          .from("accounts_receivable_installments")
          .select("id")
          .eq("account_receivable_id", accountId)
          .not("payment_date", "is", null);

        if (checkError) throw checkError;

        // Check if there are any pending installments
        const { data: pendingInstallments, error: pendingError } = await supabase
          .from("accounts_receivable_installments")
          .select("id")
          .eq("account_receivable_id", accountId)
          .is("payment_date", null);

        if (pendingError) throw pendingError;

        // Determine new status
        let newStatus = 'pending';
        if (remainingPaid && remainingPaid.length > 0) {
          newStatus = pendingInstallments && pendingInstallments.length > 0 ? 'partial' : 'paid';
        }

        // Update account status
        const { error } = await supabase
          .from("accounts_receivable")
          .update({ 
            status: newStatus,
            payment_date: newStatus === 'pending' ? null : undefined
          })
          .eq("id", accountId);

        if (error) throw error;
      } else {
        // No installments - delete all payment records and update account
        const { error: deletePaymentsError } = await supabase
          .from("accounts_receivable_payments")
          .delete()
          .eq("account_receivable_id", accountId);

        if (deletePaymentsError) throw deletePaymentsError;

        // Delete financial transaction for this account (integral payment)
        const { error: deleteTransactionError } = await supabase
          .from("financial_transactions")
          .delete()
          .eq("reference_id", accountId)
          .eq("reference_type", "accounts_receivable");

        if (deleteTransactionError) throw deleteTransactionError;

        const { error } = await supabase
          .from("accounts_receivable")
          .update({ 
            status: 'pending',
            payment_date: null 
          })
          .eq("id", accountId);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Recebimento estornado com sucesso",
      });

      fetchFilteredAccountsReceivable();
      setShowReverseModal(false);
      setReverseAccount(null);
      setReverseInstallments([]);
      setSelectedReverseInstallments([]);
    } catch (error) {
      console.error("Error reversing payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao estornar recebimento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string, status: string, dataCompetencia: string | null) => {
    if (status === 'paid' || status === 'partial') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir uma conta paga ou parcialmente paga. Estorne o recebimento primeiro.",
        variant: "destructive",
      });
      return;
    }

    // Validate period block by competency
    if (dataCompetencia) {
      const periodValidation = await validateAccountsReceivablePeriod.competencia(dataCompetencia);
      if (periodValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: periodValidation.message || "O período de competência está bloqueado. Não é possível excluir esta conta.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!confirm("Tem certeza que deseja excluir esta conta a receber?")) {
      return;
    }

    setLoading(true);
    try {
      // Delete items first (foreign key constraint)
      const { error: itemsError } = await supabase
        .from("accounts_receivable_items")
        .delete()
        .eq("account_receivable_id", accountId);

      if (itemsError) throw itemsError;

      // Delete the account
      const { error: accountError } = await supabase
        .from("accounts_receivable")
        .delete()
        .eq("id", accountId);

      if (accountError) throw accountError;

      toast({
        title: "Sucesso",
        description: "Conta a receber excluída com sucesso",
      });

      fetchFilteredAccountsReceivable(); // Refresh data
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta a receber",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditors = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, cnpj_cpf")
        .eq("is_active", true)
        .eq("is_creditor", true)
        .order("name");

      if (error) throw error;
      setCreditors(data || []);
    } catch (error) {
      console.error("Error fetching creditors:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("function_type", "credit")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Filtered product list for combobox
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product.id);
    setProductSearchTerm(product.name);
    setShowProductDropdown(false);
  };

  const handleProductSearchChange = (value: string) => {
    setProductSearchTerm(value);
    setShowProductDropdown(value.trim().length > 0 && filteredProducts.length > 0);
    if (value.trim().length === 0) {
      setSelectedProduct("");
    }
  };

  const fetchStores = async () => {
    try {
      // Buscar o usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar lojas vinculadas ao usuário através de user_stores
      const { data: userStoresData, error: userStoresError } = await supabase
        .from("user_stores")
        .select("store_id")
        .eq("user_id", user.id);

      if (userStoresError) throw userStoresError;

      if (userStoresData && userStoresData.length > 0) {
        const storeIds = userStoresData.map(us => us.store_id);
        
        const { data, error } = await supabase
          .from("stores")
          .select("id, name, code")
          .in("id", storeIds)
          .order("name");

        if (error) throw error;
        const storeList = data || [];
        setStores(storeList);
        if (storeList.length === 1) {
          setDefaultStore(storeList[0].id);
          setSelectedStore(storeList[0].id);
        }
      } else {
        // Se não tiver lojas vinculadas, verificar se é admin (pode ver todas)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileData?.role === 'admin') {
          const { data, error } = await supabase
            .from("stores")
            .select("id, name, code")
            .order("name");

          if (error) throw error;
          const storeList = data || [];
          setStores(storeList);
          if (storeList.length === 1) {
            setDefaultStore(storeList[0].id);
            setSelectedStore(storeList[0].id);
          }
        } else {
          setStores([]);
        }
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchCurrentAccounts = async () => {
    try {
      const accounts: CurrentAccount[] = [];

      // Buscar contas correntes
      const { data: currentAccountsData, error: currentAccountsError } = await supabase
        .from("current_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (currentAccountsError) throw currentAccountsError;
      
      if (currentAccountsData) {
        currentAccountsData.forEach(account => {
          accounts.push({
            ...account,
            account_type: 'current'
          });
        });
      }

      // Buscar contas caixa
      const { data: cashAccountsData, error: cashAccountsError } = await supabase
        .from("cash_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (cashAccountsError) throw cashAccountsError;
      
      if (cashAccountsData) {
        cashAccountsData.forEach(account => {
          accounts.push({
            id: account.id,
            name: account.name,
            bank: account.bank || 'N/A',
            account_number: account.account_number || 'N/A',
            account_type: 'cash'
          });
        });
      }

      // Buscar contas cartão
      const { data: cardAccountsData, error: cardAccountsError } = await supabase
        .from("card_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (cardAccountsError) throw cardAccountsError;
      
      if (cardAccountsData) {
        cardAccountsData.forEach(account => {
          accounts.push({
            ...account,
            account_type: 'card'
          });
        });
      }

      // Buscar contas delivery
      const { data: deliveryAccountsData, error: deliveryAccountsError } = await supabase
        .from("delivery_accounts")
        .select("id, name, contact_person, phone, email")
        .eq("is_active", true)
        .order("name");

      if (deliveryAccountsError) throw deliveryAccountsError;
      
      if (deliveryAccountsData) {
        deliveryAccountsData.forEach(account => {
          accounts.push({
            id: account.id,
            name: account.name,
            bank: account.contact_person || 'N/A',
            account_number: account.phone || 'N/A',
            account_type: 'delivery'
          });
        });
      }

      // Ordenar por nome
      accounts.sort((a, b) => a.name.localeCompare(b.name));
      
      setCurrentAccounts(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  // File upload functions
  const uploadAttachments = async (storeId: string): Promise<Array<{name: string, url: string, size: number}>> => {
    if (attachments.length === 0) return [];

    const uploadedFiles: Array<{name: string, url: string, size: number}> = [];

    for (const file of attachments) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${storeId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('account-documents')
        .upload(fileName, file);

      if (error) {
        console.error('❌ Erro no upload:', error);
        throw error;
      }

      console.log(`✅ Upload realizado: ${fileName}`);

      uploadedFiles.push({
        name: file.name,
        url: fileName,
        size: file.size
      });
    }

    return uploadedFiles;
  };

  const downloadFile = async (filePath: string | undefined, fileName: string) => {
    try {
      if (!filePath) {
        console.error('❌ Erro no download: filePath é undefined');
        toast({
          title: "Erro",
          description: "Caminho do arquivo não encontrado",
          variant: "destructive",
        });
        return;
      }
      
      console.log('📥 Iniciando download do arquivo:', filePath);
      
      if (filePath.startsWith('http')) {
        try {
          const response = await fetch(filePath);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName || filePath.split('/').pop() || 'arquivo';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast({
            title: "Sucesso",
            description: "Download realizado com sucesso",
          });
        } catch (fetchError) {
          console.error('Erro no fetch:', fetchError);
          const link = document.createElement('a');
          link.href = filePath;
          link.download = fileName || filePath.split('/').pop() || 'arquivo';
          link.click();
        }
        return;
      }
      
      const { data, error } = await supabase.storage
        .from('account-documents')
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('❌ Erro ao criar URL assinada:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('URL assinada não foi gerada');
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Sucesso",
        description: "Download realizado com sucesso",
      });

    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar o arquivo",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setAttachments([...attachments, ...Array.from(files)]);
    }
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(existingAttachments.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (!selectedProduct || !selectedStore || quantity <= 0 || unitPrice <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do item",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    const store = stores.find(s => s.id === selectedStore);
    
    if (!product || !store) return;

    const storeToUse = selectedStore || defaultStore;
    const newItem: ReceivableItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
      store_id: storeToUse,
      store_name: store.name,
      allocation_type: allocationType || undefined,
      allocation_id: allocationId || undefined,
      allocation_name: allocationType ? getAllocationName(allocationType, allocationId) : undefined,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    setAllocationType('');
    setAllocationId('');
    setAllocationSearchTerm('');
    setSelectedStore(defaultStore);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleRecordNote = async () => {
    if (!creditorId || !documentType || !documentNumber || !issueDate || !dueDate || !dataCompetencia) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios do formulário",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item na aba Itens",
        variant: "destructive",
      });
      return;
    }

    // Validar se o período de competência não está bloqueado
    const competenceValidation = await validateAccountsReceivablePeriod.competencia(dataCompetencia);
    if (competenceValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const totalAmount = getTotalAmount();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Validar duplicidade: verificar se já existe título com mesmo número e tipo de documento para o credor
      if (creditorId && documentNumber && documentType) {
        const { data: existingReceivable, error: duplicateError } = await supabase
          .from("accounts_receivable")
          .select("id, issue_date, amount")
          .eq("creditor_id", creditorId)
          .eq("document_number", documentNumber)
          .eq("document_type", documentType)
          .maybeSingle();

        if (duplicateError) {
          console.error("Erro ao verificar duplicidade:", duplicateError);
        }

        if (existingReceivable) {
          const formattedDate = existingReceivable.issue_date 
            ? new Date(existingReceivable.issue_date + 'T00:00:00').toLocaleDateString('pt-BR')
            : 'N/A';
          const formattedValue = Number(existingReceivable.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          
          toast({
            title: "Título duplicado",
            description: `Já existe um título igual com data de emissão ${formattedDate} e valor ${formattedValue}`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Upload attachments
      let uploadedAttachments: Array<{name: string, url: string, size: number}> = [];
      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments(items[0]?.store_id || 'default');
      }

      const insertData: any = {
        creditor_id: creditorId,
        description: `Conta a Receber - ${documentType} ${documentNumber}`,
        document_type: documentType,
        document_number: documentNumber,
        issue_date: issueDate,
        due_date: dueDate,
        data_competencia: dataCompetencia,
        amount: totalAmount,
        notes,
        status: "pending",
        store_id: items[0]?.store_id,
        account_id: null,
        created_by: user.id,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
      };

      const { data: accountData, error } = await supabase
        .from("accounts_receivable")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Insert items
      const itemsToInsert = items.map(item => ({
        account_receivable_id: accountData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        store_id: item.store_id,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("accounts_receivable_items")
        .insert(itemsToInsert)
        .select("id");

      if (itemsError) throw itemsError;

      // Save allocations
      if (insertedItems) {
        await saveItemAllocations(items, insertedItems);
      }

      // Set editing mode with the newly created account
      setEditingAccount({ ...accountData, id: accountData.id } as AccountReceivable);
      setIsEditing(true);
      setAttachments([]);
      
      setNoteRecorded(true);
      toast({
        title: "Sucesso",
        description: "Nota gravada! Agora você pode configurar parcelas ou finalizar.",
      });

    } catch (error) {
      console.error("Error recording note:", error);
      toast({
        title: "Erro",
        description: "Erro ao gravar a nota",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInstallments = () => {
    if (numberOfInstallments < 1 || numberOfInstallments > 12) {
      toast({
        title: "Erro",
        description: "Número de parcelas deve ser entre 1 e 12",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = getTotalAmount();
    if (totalAmount <= 0) {
      toast({
        title: "Erro",
        description: "Adicione itens antes de gerar as parcelas",
        variant: "destructive",
      });
      return;
    }

    const baseAmount = totalAmount / numberOfInstallments;
    const newInstallments: Installment[] = [];
    
    for (let i = 0; i < numberOfInstallments; i++) {
      const installmentDate = new Date(dueDate);
      installmentDate.setMonth(installmentDate.getMonth() + i);
      
      newInstallments.push({
        installment_number: i + 1,
        due_date: installmentDate.toISOString().split('T')[0],
        amount: parseFloat(baseAmount.toFixed(2))
      });
    }

    // Ajustar diferença de centavos na última parcela
    const totalInstallments = newInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    const difference = parseFloat((totalAmount - totalInstallments).toFixed(2));
    if (difference !== 0) {
      newInstallments[newInstallments.length - 1].amount = parseFloat((newInstallments[newInstallments.length - 1].amount + difference).toFixed(2));
    }

    setInstallments(newInstallments);
  };

  const updateInstallment = (index: number, field: keyof Installment, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const confirmInstallments = () => {
    const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
    const totalAmount = getTotalAmount();
    
    if (Math.abs(totalInstallments - totalAmount) > 0.01) {
      toast({
        title: "Erro",
        description: "A soma das parcelas deve ser igual ao valor total",
        variant: "destructive",
      });
      return;
    }

    setShowInstallmentsModal(false);
    toast({
      title: "Sucesso",
      description: `${installments.length} parcela(s) configurada(s)`,
    });
  };

  const openInstallmentsModal = () => {
    if (items.length === 0 || getTotalAmount() <= 0) {
      toast({
        title: "Erro",
        description: "Adicione itens antes de configurar as parcelas",
        variant: "destructive",
      });
      return;
    }
    setShowInstallmentsModal(true);
  };

  const handleSave = async () => {
    // Prevent double-click submissions
    if (loading) return;
    setLoading(true);

    // If attachment only edit, skip validation of other fields
    if (!isAttachmentOnlyEdit) {
      if (!creditorId || !documentType || !documentNumber || !issueDate || !dueDate || !dataCompetencia) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios do formulário",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (items.length === 0) {
        toast({
          title: "Erro",
          description: "Adicione pelo menos um item na aba Itens",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Validar se o período de competência não está bloqueado
      const competenceValidation = await validateAccountsReceivablePeriod.competencia(dataCompetencia);
      if (competenceValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: competenceValidation.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }
    try {
      const totalAmount = getTotalAmount();

      if (isEditing && editingAccount) {
        // Upload new attachments
        let allAttachments = [...existingAttachments];
        if (attachments.length > 0) {
          const uploadedFiles = await uploadAttachments(items[0]?.store_id || 'default');
          allAttachments = [...allAttachments, ...uploadedFiles];
        }

        // If attachment only edit, only update attachments
        if (isAttachmentOnlyEdit) {
          const { error } = await supabase
            .from("accounts_receivable")
            .update({
              attachments: allAttachments.length > 0 ? allAttachments : null,
            })
            .eq("id", editingAccount.id);

          if (error) throw error;

          toast({
            title: "Sucesso",
            description: "Anexos atualizados com sucesso",
          });
        } else {
          // Full update - Update existing account
          const updateData: any = {
            creditor_id: creditorId,
            description: `Conta a Receber - ${documentType} ${documentNumber}`,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            due_date: dueDate,
            data_competencia: dataCompetencia,
            amount: totalAmount,
            notes,
            status: "pending",
            attachments: allAttachments.length > 0 ? allAttachments : null,
          };

          const { error } = await supabase
            .from("accounts_receivable")
            .update(updateData)
            .eq("id", editingAccount.id);

          if (error) throw error;

          // Delete existing items
          await supabase
            .from("accounts_receivable_items")
            .delete()
            .eq("account_receivable_id", editingAccount.id);

          // Insert new items
          const itemsToInsert = items.map(item => ({
            account_receivable_id: editingAccount.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            store_id: item.store_id,
          }));

          const { data: insertedItems2, error: itemsError } = await supabase
            .from("accounts_receivable_items")
            .insert(itemsToInsert)
            .select("id");

          if (itemsError) throw itemsError;

          // Save allocations
          if (insertedItems2) {
            await saveItemAllocations(items, insertedItems2);
          }

          // Delete existing installments and insert new ones if configured
          await supabase
            .from("accounts_receivable_installments")
            .delete()
            .eq("account_receivable_id", editingAccount.id);

          if (installments.length > 0) {
            const installmentsToInsert = installments.map(inst => ({
              account_receivable_id: editingAccount.id,
              installment_number: inst.installment_number,
              due_date: inst.due_date,
              amount: inst.amount,
            }));

            const { error: installmentsError } = await supabase
              .from("accounts_receivable_installments")
              .insert(installmentsToInsert);

            if (installmentsError) throw installmentsError;
          }

          toast({
            title: "Sucesso",
            description: "Conta a receber atualizada com sucesso",
          });
        }
      } else {
        // Create new account
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error("Usuário não autenticado");
        }

        // Upload attachments for new account
        let uploadedAttachments: Array<{name: string, url: string, size: number}> = [];
        if (attachments.length > 0) {
          uploadedAttachments = await uploadAttachments(items[0]?.store_id || 'default');
        }

        const insertData: any = {
          creditor_id: creditorId,
          description: `Conta a Receber - ${documentType} ${documentNumber}`,
          document_type: documentType,
          document_number: documentNumber,
          issue_date: issueDate,
          due_date: dueDate,
          data_competencia: dataCompetencia,
          amount: totalAmount,
          notes,
          status: "pending",
          store_id: items[0]?.store_id,
          account_id: null, // Será definido quando receber o pagamento
          created_by: user.id,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        };

        const { data: accountData, error } = await supabase
          .from("accounts_receivable")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        // Insert items
        const itemsToInsert = items.map(item => ({
          account_receivable_id: accountData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id,
        }));

        const { data: insertedItems3, error: itemsError } = await supabase
          .from("accounts_receivable_items")
          .insert(itemsToInsert)
          .select("id");

        if (itemsError) throw itemsError;

        // Save allocations
        if (insertedItems3) {
          await saveItemAllocations(items, insertedItems3);
        }

        // Insert installments if configured
        if (installments.length > 0) {
          const installmentsToInsert = installments.map(inst => ({
            account_receivable_id: accountData.id,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            amount: inst.amount,
          }));

          const { error: installmentsError } = await supabase
            .from("accounts_receivable_installments")
            .insert(installmentsToInsert);

          if (installmentsError) throw installmentsError;
        }

        toast({
          title: "Sucesso",
          description: "Conta a receber criada com sucesso",
        });
      }

      // Reset form
      setCreditorId("");
      setDocumentType("");
      setDocumentNumber("");
      setIssueDate("");
      setDueDate("");
      setDataCompetencia("");
      setNotes("");
      setItems([]);
      setNoteRecorded(false);
      setInstallments([]);
      setIsEditing(false);
      setEditingAccount(null);
      setAttachments([]);
      setExistingAttachments([]);
      setActiveTab("view");
      
      // Refresh list
      if (showFilteredData) {
        fetchFilteredAccountsReceivable();
      } else {
        fetchAccountsReceivable();
      }

    } catch (error) {
      console.error("Error saving account:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar conta a receber",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Payment attachment handlers
  const handlePaymentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Array<{file: File; name: string; title: string}> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAttachments.push({
        file,
        name: file.name,
        title: `Comprovante de Recebimento - ${file.name}`,
      });
    }
    setPaymentAttachments(prev => [...prev, ...newAttachments]);
    
    if (paymentFileInputRef.current) {
      paymentFileInputRef.current.value = '';
    }
  };

  const removePaymentAttachment = (index: number) => {
    setPaymentAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const updatePaymentAttachmentTitle = (index: number, title: string) => {
    setPaymentAttachments(prev => prev.map((att, i) => 
      i === index ? { ...att, title } : att
    ));
  };

  const uploadPaymentAttachments = async (): Promise<any[]> => {
    if (paymentAttachments.length === 0 || !paymentAccount) return [];

    const uploadedAttachments: any[] = [];

    for (const attachment of paymentAttachments) {
      const fileExt = attachment.file.name.split('.').pop();
      const fileName = `${paymentAccount.id}/payment_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('account-documents')
        .upload(fileName, attachment.file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      uploadedAttachments.push({
        name: attachment.title,
        path: fileName,
        type: 'comprovante_recebimento',
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploadedAttachments;
  };

  const handlePayment = async () => {
    if (!paymentAccount || !selectedAccountId || !paymentDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // If there are installments but none selected
    if (dbInstallments.length > 0 && !selectedInstallmentId) {
      toast({
        title: "Erro",
        description: "Selecione uma parcela para receber",
        variant: "destructive",
      });
      return;
    }

    // Validar se o período de recebimento não está bloqueado
    const paymentValidation = await validateAccountsReceivablePeriod.pagamento(paymentDate);
    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message,
        variant: "destructive",
      });
      return;
    }

    // Verificar se a conta está vinculada às lojas dos itens
    try {
      // Buscar itens da conta a receber para obter as lojas
      const { data: accountItems, error: itemsError } = await supabase
        .from("accounts_receivable_items")
        .select("store_id")
        .eq("account_receivable_id", paymentAccount.id);

      if (itemsError) throw itemsError;

      // Se houver itens com lojas, validar
      if (accountItems && accountItems.length > 0) {
        // Determinar o tipo de conta selecionada
        const selectedAccount = currentAccounts.find(acc => acc.id === selectedAccountId);
        if (!selectedAccount) {
          toast({
            title: "Erro",
            description: "Conta selecionada não encontrada",
            variant: "destructive",
          });
          return;
        }

        // Buscar quais lojas estão vinculadas à conta selecionada
        let accountStores;
        let storesError;
        
        if (selectedAccount.account_type === 'current') {
          const result = await supabase
            .from("current_account_stores")
            .select("store_id")
            .eq("account_id", selectedAccountId);
          accountStores = result.data;
          storesError = result.error;
        } else if (selectedAccount.account_type === 'cash') {
          const result = await supabase
            .from("cash_account_stores")
            .select("store_id")
            .eq("account_id", selectedAccountId);
          accountStores = result.data;
          storesError = result.error;
        } else if (selectedAccount.account_type === 'card') {
          const result = await supabase
            .from("card_account_stores")
            .select("store_id")
            .eq("account_id", selectedAccountId);
          accountStores = result.data;
          storesError = result.error;
        } else if (selectedAccount.account_type === 'delivery') {
          const result = await supabase
            .from("delivery_account_stores")
            .select("store_id")
            .eq("account_id", selectedAccountId);
          accountStores = result.data;
          storesError = result.error;
        }

        if (storesError) throw storesError;

        // Verificar se todas as lojas dos itens estão permitidas na conta
        const itemStoreIds = [...new Set(accountItems.map(item => item.store_id))];
        const allowedStoreIds = accountStores?.map(store => store.store_id) || [];

        const unauthorizedStores = itemStoreIds.filter(storeId => !allowedStoreIds.includes(storeId));

        if (unauthorizedStores.length > 0) {
          const accountTypeName = selectedAccount.account_type === 'current' ? 'conta corrente' : 
                                 selectedAccount.account_type === 'cash' ? 'conta caixa' : 
                                 selectedAccount.account_type === 'card' ? 'conta cartão' :
                                 selectedAccount.account_type === 'delivery' ? 'conta delivery' : 'conta';
          toast({
            title: "Conta não autorizada",
            description: `A ${accountTypeName} selecionada não está vinculada a todas as lojas dos itens desta conta a receber.`,
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.error("❌ Erro ao validar conta:", error);
      toast({
        title: "Erro",
        description: "Erro ao validar a conta selecionada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Obter o tipo da conta selecionada
      const selectedAccount = currentAccounts.find(acc => acc.id === selectedAccountId);

      // Upload payment attachments if any
      let uploadedPaymentAttachments: any[] = [];
      if (paymentAttachments.length > 0) {
        setUploadingPaymentAttachment(true);
        try {
          uploadedPaymentAttachments = await uploadPaymentAttachments();
        } finally {
          setUploadingPaymentAttachment(false);
        }
      }

      // Get the amount to process
      const selectedInstallment = dbInstallments.find(i => i.id === selectedInstallmentId);
      const baseAmount = selectedInstallment ? selectedInstallment.amount : paymentAccount.amount;
      const finalAmount = baseAmount + surcharge - discount;

      // Merge new attachments with existing ones
      const existingAttachments = Array.isArray(paymentAccount.attachments) ? paymentAccount.attachments : [];
      const allAttachments = [...existingAttachments, ...uploadedPaymentAttachments];

      // Buscar produtos configurados para acréscimo e desconto
      let surchargeProduct: any = null;
      let discountProduct: any = null;
      
      if (surcharge > 0) {
        // Usar o parâmetro específico para contas a receber
        const { data: surchargeParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "acrescimo_receber")
          .single();
        surchargeProduct = surchargeParam?.products;
      }
      
      if (discount > 0) {
        // Usar o parâmetro específico para contas a receber
        const { data: discountParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "desconto_receber")
          .single();
        discountProduct = discountParam?.products;
      }

      // If processing an installment
      if (selectedInstallment) {
        // Register payment in accounts_receivable_payments table
        const { error: paymentRecordError } = await supabase
          .from("accounts_receivable_payments")
          .insert({
            installment_id: selectedInstallment.id,
            account_receivable_id: paymentAccount.id,
            payment_date: formatDateForDatabase(paymentDate),
            amount_paid: baseAmount,
            interest_amount: surcharge,
            discount_amount: discount,
            interest_product_id: surcharge > 0 && surchargeProduct ? surchargeProduct.id : null,
            discount_product_id: discount > 0 && discountProduct ? discountProduct.id : null,
            payment_account_id: selectedAccountId,
            payment_account_type: selectedAccount?.account_type || 'current',
            created_by: user.id,
          });

        if (paymentRecordError) throw paymentRecordError;

        // Inserir item de acréscimo se houver
        if (surcharge > 0 && surchargeProduct) {
          const { error: surchargeItemError } = await supabase
            .from("accounts_receivable_items")
            .insert({
              account_receivable_id: paymentAccount.id,
              product_id: surchargeProduct.id,
              quantity: 1,
              unit_price: surcharge,
              total_price: surcharge,
              store_id: paymentAccount.store_id || "",
            });
          
          if (surchargeItemError) throw surchargeItemError;
        }

        // Inserir item de desconto se houver
        if (discount > 0 && discountProduct) {
          const { error: discountItemError } = await supabase
            .from("accounts_receivable_items")
            .insert({
              account_receivable_id: paymentAccount.id,
              product_id: discountProduct.id,
              quantity: 1,
              unit_price: -discount, // Valor negativo para desconto
              total_price: -discount,
              store_id: paymentAccount.store_id || "",
            });
          
          if (discountItemError) throw discountItemError;
        }

        // Update installment payment date
        const { error: installmentError } = await supabase
          .from("accounts_receivable_installments")
          .update({
            payment_date: formatDateForDatabase(paymentDate)
          })
          .eq("id", selectedInstallment.id);

        if (installmentError) throw installmentError;

        // Check if all installments are paid
        const { data: allInstallmentsData, error: fetchError } = await supabase
          .from("accounts_receivable_installments")
          .select("*")
          .eq("account_receivable_id", paymentAccount.id);

        if (fetchError) throw fetchError;

        const allPaid = allInstallmentsData?.every(inst => 
          inst.id === selectedInstallment.id || inst.payment_date !== null
        );

        // Update account status and attachments
        const { error: updateError } = await supabase
          .from("accounts_receivable")
          .update({
            status: allPaid ? "paid" : "partial",
            payment_date: allPaid ? formatDateForDatabase(paymentDate) : null,
            attachments: allAttachments.length > 0 ? allAttachments : undefined,
          })
          .eq("id", paymentAccount.id);

        if (updateError) throw updateError;
      } else {
        // No installments - create a single installment record first
        const { data: newInstallment, error: createInstallmentError } = await supabase
          .from("accounts_receivable_installments")
          .insert({
            account_receivable_id: paymentAccount.id,
            installment_number: 1,
            due_date: paymentAccount.due_date,
            amount: paymentAccount.amount,
            payment_date: formatDateForDatabase(paymentDate),
          })
          .select()
          .single();

        if (createInstallmentError) throw createInstallmentError;

        // Register payment in accounts_receivable_payments table
        const { error: paymentRecordError } = await supabase
          .from("accounts_receivable_payments")
          .insert({
            installment_id: newInstallment.id,
            account_receivable_id: paymentAccount.id,
            payment_date: formatDateForDatabase(paymentDate),
            amount_paid: paymentAccount.amount,
            interest_amount: surcharge,
            discount_amount: discount,
            interest_product_id: surcharge > 0 && surchargeProduct ? surchargeProduct.id : null,
            discount_product_id: discount > 0 && discountProduct ? discountProduct.id : null,
            payment_account_id: selectedAccountId,
            payment_account_type: selectedAccount?.account_type || 'current',
            created_by: user.id,
          });

        if (paymentRecordError) throw paymentRecordError;

        // Inserir item de acréscimo se houver
        if (surcharge > 0 && surchargeProduct) {
          const { error: surchargeItemError } = await supabase
            .from("accounts_receivable_items")
            .insert({
              account_receivable_id: paymentAccount.id,
              product_id: surchargeProduct.id,
              quantity: 1,
              unit_price: surcharge,
              total_price: surcharge,
              store_id: paymentAccount.store_id || "",
            });
          
          if (surchargeItemError) throw surchargeItemError;
        }

        // Inserir item de desconto se houver
        if (discount > 0 && discountProduct) {
          const { error: discountItemError } = await supabase
            .from("accounts_receivable_items")
            .insert({
              account_receivable_id: paymentAccount.id,
              product_id: discountProduct.id,
              quantity: 1,
              unit_price: -discount, // Valor negativo para desconto
              total_price: -discount,
              store_id: paymentAccount.store_id || "",
            });
          
          if (discountItemError) throw discountItemError;
        }

        // Update account directly
        const { error: updateError } = await supabase
          .from("accounts_receivable")
          .update({
            status: "paid",
            payment_date: formatDateForDatabase(paymentDate),
            amount: finalAmount,
            attachments: allAttachments.length > 0 ? allAttachments : undefined,
          })
          .eq("id", paymentAccount.id);

        if (updateError) throw updateError;
      }

      // Create financial transaction
      const { error: transactionError } = await supabase
        .from("financial_transactions")
        .insert({
          store_id: paymentAccount.store_id || "",
          account_id: selectedAccountId,
          transaction_type: "entrada",
          amount: finalAmount,
          transaction_date: formatDateForDatabase(paymentDate),
          description: selectedInstallment 
            ? `Recebimento Parcela ${selectedInstallment.installment_number} - ${paymentAccount.description}`
            : `Recebimento - ${paymentAccount.description}`,
          reference_id: selectedInstallment ? selectedInstallment.id : paymentAccount.id,
          reference_type: selectedInstallment ? "accounts_receivable_installments" : "accounts_receivable",
          created_by: user.id,
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Sucesso",
        description: selectedInstallment 
          ? `Parcela ${selectedInstallment.installment_number} recebida com sucesso`
          : "Recebimento processado com sucesso",
      });

      setShowPaymentModal(false);
      setPaymentAccount(null);
      setDbInstallments([]);
      setSelectedInstallmentId("");
      setPaymentAttachments([]);
      
      // Refresh data
      if (paymentShowFilteredData) {
        fetchFilteredPaymentAccounts();
      } else {
        fetchAccountsReceivable();
      }

    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar recebimento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Contas a Receber</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">Visualizar Contas</TabsTrigger>
            <TabsTrigger value="create" disabled={!canEdit}>
              {isEditing ? "Editar Conta" : "Cadastrar Conta"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="space-y-4">
            {/* Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Data Baixa (De)</Label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Baixa (Até)</Label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Credor</Label>
                    <Select value={filterCreditor} onValueChange={setFilterCreditor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar credor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {creditors.map((creditor) => (
                          <SelectItem key={creditor.id} value={creditor.id}>
                            {creditor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Loja</Label>
                    <Select value={filterStore} onValueChange={setFilterStore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar loja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número Documento</Label>
                    <Input
                      value={filterDocumentNumber}
                      onChange={(e) => setFilterDocumentNumber(e.target.value)}
                      placeholder="Digite o número"
                    />
                  </div>
                  <div>
                    <Label>Vencimento (De)</Label>
                    <Input
                      type="date"
                      value={filterDueDateFrom}
                      onChange={(e) => setFilterDueDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Vencimento (Até)</Label>
                    <Input
                      type="date"
                      value={filterDueDateTo}
                      onChange={(e) => setFilterDueDateTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="partial">Parcial</SelectItem>
                        <SelectItem value="paid">Recebido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data Cadastro (De)</Label>
                    <Input
                      type="date"
                      value={filterCreatedDateFrom}
                      onChange={(e) => setFilterCreatedDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Cadastro (Até)</Label>
                    <Input
                      type="date"
                      value={filterCreatedDateTo}
                      onChange={(e) => setFilterCreatedDateTo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={fetchFilteredAccountsReceivable}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Contas a Receber {showFilteredData && `(${accountsReceivable.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Recebimento</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountsReceivable.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            {account.document_type && account.document_number 
                              ? `${account.document_type} ${account.document_number}` 
                              : account.description}
                          </TableCell>
                          <TableCell>{(account as any).suppliers?.name || "N/A"}</TableCell>
                          <TableCell>
                            {new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            R$ {account.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              account.status === "paid" 
                                ? "bg-green-100 text-green-800" 
                                : account.status === "partial"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {account.status === "paid" ? "Recebido" : account.status === "partial" ? "Parcial" : "Pendente"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {account.last_payment_date 
                              ? new Date(account.last_payment_date + 'T00:00:00').toLocaleDateString("pt-BR")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewAccount(account)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditAccount(account)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  {(account.status === 'paid' || account.status === 'partial') && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleReversePayment(account)}
                                      disabled={loading}
                                      title="Estornar recebimento"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  )}
                                  
                                  {(account.status === 'pending' || account.status === 'partial') && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openPaymentModal(account)}
                                      disabled={loading}
                                      title="Receber conta"
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                  )}
                                  
                                  {account.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteAccount(account.id, account.status, account.data_competencia)}
                                      disabled={loading}
                                      title="Excluir conta"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-6">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form">Formulário</TabsTrigger>
                  <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="space-y-4">
                  {isAttachmentOnlyEdit && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
                      <strong>Atenção:</strong> Esta conta possui recebimentos realizados. Apenas upload de arquivos é permitido.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Credor *</Label>
                      <Select 
                        value={creditorId} 
                        onValueChange={setCreditorId}
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar credor" />
                        </SelectTrigger>
                        <SelectContent>
                          {creditors.map((creditor) => (
                            <SelectItem key={creditor.id} value={creditor.id}>
                              {creditor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo Documento *</Label>
                      <Select 
                        value={documentType} 
                        onValueChange={setDocumentType}
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.name} ({type.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número Documento *</Label>
                      <Input
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        placeholder="Número do documento"
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data Emissão *</Label>
                      <Input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data Vencimento *</Label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data Competência *</Label>
                      <Input
                        type="date"
                        value={dataCompetencia}
                        onChange={(e) => setDataCompetencia(e.target.value)}
                        disabled={isViewOnly || isAttachmentOnlyEdit}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações adicionais"
                      rows={3}
                      disabled={isViewOnly || isAttachmentOnlyEdit}
                    />
                  </div>

                  {/* Seção de Anexos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Anexos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!isViewOnly && (
                        <div>
                          <input
                            type="file"
                            id="file-upload-receivable"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('file-upload-receivable')?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Anexar Arquivo
                          </Button>
                        </div>
                      )}

                      {/* Arquivos novos */}
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          <Label>Novos Anexos</Label>
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                              <span className="text-sm truncate">{file.name}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeAttachment(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Arquivos existentes */}
                      {existingAttachments.length > 0 && (
                        <div className="space-y-2">
                          <Label>Anexos Salvos</Label>
                          {existingAttachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                              <span className="text-sm truncate">{file.name}</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => downloadFile(file.url || file.path, file.name)}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                                {!isViewOnly && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeExistingAttachment(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="items" className="space-y-4">
                   {/* Seção de Fazenda Padrão - só exibe se tiver mais de 1 fazenda */}
                   {stores.length > 1 && (
                   <Card>
                     <CardHeader>
                       <CardTitle>Fazenda Padrão (Opcional)</CardTitle>
                       <p className="text-sm text-muted-foreground">
                         Selecione uma fazenda padrão para aplicar automaticamente a todos os itens.
                       </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <Label>Fazenda Padrão</Label>
                          <Select 
                            value={defaultStore} 
                            onValueChange={(value) => {
                              setDefaultStore(value);
                              setSelectedStore(value);
                            }}
                            disabled={isViewOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhuma fazenda padrão selecionada" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.code} - {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                   )}

                  {/* Adicionar Item */}
                  {!isViewOnly && !isAttachmentOnlyEdit && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Adicionar Item</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Produto *</Label>
                            <div className="relative">
                              <Input
                                value={productSearchTerm}
                                onChange={(e) => handleProductSearchChange(e.target.value)}
                                onFocus={() => setShowProductDropdown(productSearchTerm.trim().length > 0 && filteredProducts.length > 0)}
                                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                                placeholder="Digite para buscar..."
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowProductSearch(true)}
                                className="absolute right-0 top-0 h-full px-3"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                              
                              {showProductDropdown && filteredProducts.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                                  {filteredProducts.slice(0, 5).map((product) => (
                                    <div
                                      key={product.id}
                                      className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                      onMouseDown={() => handleProductSelect(product)}
                                    >
                                      <div className="font-medium">
                                        {product.code ? `${product.code} - ` : ""}{product.name}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Quantidade *</Label>
                            <Input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(Number(e.target.value))}
                              min="0.01"
                              step="0.01"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Preço Unitário *</Label>
                            <Input
                              type="number"
                              value={unitPrice}
                              onChange={(e) => setUnitPrice(Number(e.target.value))}
                              min="0.01"
                              step="0.01"
                            />
                          </div>

                          {stores.length > 1 && (
                          <div className="space-y-2">
                             <Label>Fazenda *</Label>
                             <Select value={selectedStore} onValueChange={setSelectedStore}>
                               <SelectTrigger>
                                 <SelectValue placeholder="Selecionar fazenda" />
                              </SelectTrigger>
                              <SelectContent>
                                {stores.map((store) => (
                                  <SelectItem key={store.id} value={store.id}>
                                    {store.code} - {store.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          )}
                        </div>
                        {/* Alocação de receita */}
                        <div className="space-y-3 border rounded-md p-3 bg-muted/30 mt-4">
                          <Label className="text-sm font-medium">Alocar receita para (opcional)</Label>
                          <div className="flex flex-wrap gap-4">
                            {FINANCIAL_ALLOCATION_OPTIONS.map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="receivable_allocation_type"
                                  checked={allocationType === opt.value}
                                  onChange={() => {
                                    if (allocationType === opt.value) {
                                      setAllocationType('');
                                      setAllocationId('');
                                      setAllocationSearchTerm('');
                                    } else {
                                      setAllocationType(opt.value);
                                      setAllocationId('');
                                      setAllocationSearchTerm('');
                                    }
                                  }}
                                  disabled={isViewOnly}
                                  className="accent-primary"
                                />
                                <span className="text-sm">{opt.label}</span>
                              </label>
                            ))}
                            {allocationType && (
                              <Button variant="ghost" size="sm" onClick={() => { setAllocationType(''); setAllocationId(''); setAllocationSearchTerm(''); }} disabled={isViewOnly}>
                                <X className="h-3 w-3 mr-1" /> Limpar
                              </Button>
                            )}
                          </div>

                          {allocationType === 'animal' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Selecionar Animal</Label>
                              <Input
                                placeholder="Buscar por nome, brinco ou registro..."
                                value={allocationSearchTerm}
                                onChange={(e) => setAllocationSearchTerm(e.target.value)}
                                disabled={isViewOnly}
                                className="mb-1"
                              />
                              <div className="border rounded-md max-h-[160px] overflow-y-auto bg-background">
                                {allocationAnimals
                                  .filter(a => {
                                    if (!allocationSearchTerm) return true;
                                    const term = allocationSearchTerm.toLowerCase();
                                    return a.name.toLowerCase().includes(term) ||
                                      String(a.code).includes(term) ||
                                      (a.ear_tag && String(a.ear_tag).includes(term)) ||
                                      (a.registration && a.registration.toLowerCase().includes(term));
                                  })
                                  .map(a => (
                                    <div
                                      key={a.id}
                                      className={cn("px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", allocationId === a.id && "bg-primary/10 font-medium")}
                                      onClick={() => { if (!isViewOnly) setAllocationId(a.id); }}
                                    >
                                      {a.code} - {a.name}{a.ear_tag ? ` (Brinco: ${a.ear_tag})` : ''}{a.registration ? ` [${a.registration}]` : ''}
                                    </div>
                                  ))}
                                {allocationAnimals.filter(a => {
                                  if (!allocationSearchTerm) return true;
                                  const term = allocationSearchTerm.toLowerCase();
                                  return a.name.toLowerCase().includes(term) || String(a.code).includes(term) || (a.ear_tag && String(a.ear_tag).includes(term)) || (a.registration && a.registration.toLowerCase().includes(term));
                                }).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum animal encontrado.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {allocationType === 'pregnancy' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Selecionar Prenhez (em andamento)</Label>
                              <Input
                                placeholder="Buscar por nome..."
                                value={allocationSearchTerm}
                                onChange={(e) => setAllocationSearchTerm(e.target.value)}
                                disabled={isViewOnly}
                                className="mb-1"
                              />
                              <div className="border rounded-md max-h-[160px] overflow-y-auto bg-background">
                                {allocationPregnancies
                                  .filter(p => !allocationSearchTerm || p.name.toLowerCase().includes(allocationSearchTerm.toLowerCase()))
                                  .map(p => (
                                    <div
                                      key={p.id}
                                      className={cn("px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", allocationId === p.id && "bg-primary/10 font-medium")}
                                      onClick={() => { if (!isViewOnly) setAllocationId(p.id); }}
                                    >
                                      {p.name}
                                    </div>
                                  ))}
                                {allocationPregnancies.filter(p => !allocationSearchTerm || p.name.toLowerCase().includes(allocationSearchTerm.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro encontrado.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {allocationType === 'embryo_transfer' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Selecionar Pós Transferência (em andamento)</Label>
                              <Input
                                placeholder="Buscar por nome..."
                                value={allocationSearchTerm}
                                onChange={(e) => setAllocationSearchTerm(e.target.value)}
                                disabled={isViewOnly}
                                className="mb-1"
                              />
                              <div className="border rounded-md max-h-[160px] overflow-y-auto bg-background">
                                {allocationEmbryoTransfers
                                  .filter(e => !allocationSearchTerm || e.name.toLowerCase().includes(allocationSearchTerm.toLowerCase()))
                                  .map(e => (
                                    <div
                                      key={e.id}
                                      className={cn("px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", allocationId === e.id && "bg-primary/10 font-medium")}
                                      onClick={() => { if (!isViewOnly) setAllocationId(e.id); }}
                                    >
                                      {e.name}
                                    </div>
                                  ))}
                                {allocationEmbryoTransfers.filter(e => !allocationSearchTerm || e.name.toLowerCase().includes(allocationSearchTerm.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro encontrado.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {allocationType === 'aspiration' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Selecionar Aspiração (pendente/em andamento)</Label>
                              <Input
                                placeholder="Buscar por nome..."
                                value={allocationSearchTerm}
                                onChange={(e) => setAllocationSearchTerm(e.target.value)}
                                disabled={isViewOnly}
                                className="mb-1"
                              />
                              <div className="border rounded-md max-h-[160px] overflow-y-auto bg-background">
                                {allocationAspirations
                                  .filter(a => !allocationSearchTerm || a.name.toLowerCase().includes(allocationSearchTerm.toLowerCase()) || String(a.code).includes(allocationSearchTerm))
                                  .map(a => (
                                    <div
                                      key={a.id}
                                      className={cn("px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", allocationId === a.id && "bg-primary/10 font-medium")}
                                      onClick={() => { if (!isViewOnly) setAllocationId(a.id); }}
                                    >
                                      {a.code} - {a.name}
                                    </div>
                                  ))}
                                {allocationAspirations.filter(a => !allocationSearchTerm || a.name.toLowerCase().includes(allocationSearchTerm.toLowerCase()) || String(a.code).includes(allocationSearchTerm)).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro encontrado.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {allocationType === 'recipient' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Selecionar Receptora</Label>
                              <Input
                                placeholder="Buscar por nome, brinco ou registro..."
                                value={allocationSearchTerm}
                                onChange={(e) => setAllocationSearchTerm(e.target.value)}
                                disabled={isViewOnly}
                                className="mb-1"
                              />
                              <div className="border rounded-md max-h-[160px] overflow-y-auto bg-background">
                                {allocationRecipients
                                  .filter(r => {
                                    if (!allocationSearchTerm) return true;
                                    const term = allocationSearchTerm.toLowerCase();
                                    return r.name.toLowerCase().includes(term) ||
                                      String(r.code).includes(term) ||
                                      (r.ear_tag && String(r.ear_tag).includes(term)) ||
                                      (r.registration && r.registration.toLowerCase().includes(term));
                                  })
                                  .map(r => (
                                    <div
                                      key={r.id}
                                      className={cn("px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", allocationId === r.id && "bg-primary/10 font-medium")}
                                      onClick={() => { if (!isViewOnly) setAllocationId(r.id); }}
                                    >
                                      {r.code} - {r.name}{r.ear_tag ? ` (Brinco: ${r.ear_tag})` : ''}{r.registration ? ` [${r.registration}]` : ''}
                                    </div>
                                  ))}
                                {allocationRecipients.filter(r => {
                                  if (!allocationSearchTerm) return true;
                                  const term = allocationSearchTerm.toLowerCase();
                                  return r.name.toLowerCase().includes(term) || String(r.code).includes(term) || (r.ear_tag && String(r.ear_tag).includes(term)) || (r.registration && r.registration.toLowerCase().includes(term));
                                }).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma receptora encontrada.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <Button onClick={addItem} className="mt-4">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Item
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Lista de Itens */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens da Conta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum item adicionado
                        </div>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Valor Unit.</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Fazenda</TableHead>
                                <TableHead>Alocação</TableHead>
                                <TableHead>Referência</TableHead>
                                {!isViewOnly && !isAttachmentOnlyEdit && <TableHead>Ações</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.product_name}</TableCell>
                                  <TableCell>{item.quantity}</TableCell>
                                  <TableCell>{item.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell>{item.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell>{item.store_name}</TableCell>
                                  <TableCell>
                                    {item.allocation_type ? (
                                      <span className="text-xs font-medium">
                                        {getAllocationLabel(item.allocation_type)}
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {item.allocation_name ? (
                                      <span className="text-xs">{item.allocation_name}</span>
                                    ) : "-"}
                                  </TableCell>
                                  {!isViewOnly && !isAttachmentOnlyEdit && (
                                    <TableCell>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeItem(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-medium">Total Geral:</span>
                              <span className="text-2xl font-bold text-primary">
                                {getTotalAmount().toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {isViewOnly ? (
                  <Button variant="outline" onClick={() => {
                    setIsViewOnly(false);
                    setViewOnlyAccount(null);
                    setActiveTab("view");
                  }}>
                    Voltar
                  </Button>
                ) : isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setEditingAccount(null);
                      setIsAttachmentOnlyEdit(false);
                      setActiveTab("view");
                    }}>
                      Cancelar
                    </Button>
                    
                    {!isAttachmentOnlyEdit && (
                      <Button variant="outline" onClick={openInstallmentsModal} disabled={items.length === 0}>
                        Parcelas {installments.length > 0 && `(${installments.length})`}
                      </Button>
                    )}
                    
                    <Button onClick={handleSave} disabled={loading || items.length === 0}>
                      {loading ? "Salvando..." : isAttachmentOnlyEdit ? "Salvar Anexos" : "Salvar"}
                    </Button>
                  </>
                ) : !noteRecorded ? (
                  <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    
                    <Button onClick={handleRecordNote} disabled={loading || items.length === 0}>
                      {loading ? "Gravando..." : "Gravar Nota"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    
                    <Button variant="outline" onClick={openInstallmentsModal} disabled={items.length === 0}>
                      Parcelas {installments.length > 0 && `(${installments.length})`}
                    </Button>
                    
                    <Button onClick={handleSave} disabled={loading || items.length === 0}>
                      {loading ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

        </Tabs>

        {/* Modal de Parcelas */}
        <Dialog open={showInstallmentsModal} onOpenChange={setShowInstallmentsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Parcelas</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">Valor Total: {getTotalAmount().toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={numberOfInstallments}
                    onChange={(e) => setNumberOfInstallments(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={generateInstallments} className="w-full">
                    Gerar Parcelas
                  </Button>
                </div>
              </div>

              {installments.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Parcelas Configuradas</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Data de Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((installment, index) => (
                        <TableRow key={index}>
                          <TableCell>{installment.installment_number}ª</TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={installment.due_date}
                              onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={installment.amount}
                              onChange={(e) => updateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="font-semibold">
                      Total das Parcelas: {installments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowInstallmentsModal(false)}>
                  Cancelar
                </Button>
                {installments.length > 0 && (
                  <Button onClick={confirmInstallments}>
                    Confirmar Parcelas
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        {showPaymentModal && paymentAccount && (
          <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Receber Conta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Header with account info - gray background */}
                <div className="p-4 bg-gray-400 text-white rounded-lg">
                  <p className="font-medium">{paymentAccount.document_type} {paymentAccount.document_number}</p>
                  <p className="text-sm">
                    Credor: {(paymentAccount as any).suppliers?.name || '-'}
                  </p>
                  <p className="text-sm">
                    Vencimento: {new Date(paymentAccount.due_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-lg font-semibold text-green-400 mt-1">
                    Valor Original: {Number(paymentAccount.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>

                {/* Installments Selection */}
                {allInstallments.length > 0 && (
                  <div className="space-y-3">
                    <p className="font-semibold">Selecione as parcelas para receber:</p>
                    <div className="space-y-2 border rounded-lg p-3 max-h-[280px] overflow-y-auto">
                      {allInstallments.map((installment) => {
                        const isPaid = !!installment.payment_date;
                        const isSelected = selectedInstallmentId === installment.id;
                        
                        return (
                          <div
                            key={installment.id}
                            className={`p-3 rounded-lg border ${
                              isPaid 
                                ? 'bg-green-50 border-green-200' 
                                : isSelected 
                                  ? 'bg-primary/10 border-primary' 
                                  : 'bg-white border-gray-200 cursor-pointer hover:border-gray-300'
                            }`}
                            onClick={() => !isPaid && setSelectedInstallmentId(installment.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {!isPaid && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => setSelectedInstallmentId(isSelected ? "" : installment.id)}
                                    className="w-4 h-4 rounded border-gray-300"
                                  />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">Parcela {installment.installment_number}</span>
                                    {isPaid && (
                                      <span className="text-green-600 text-sm font-medium">(RECEBIDA)</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Vencimento: {new Date(installment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    {isPaid && installment.payment_date && (
                                      <span> - Recebida em: {new Date(installment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                    )}
                                  </p>
                                  {isPaid && installment.payment_account_name && (
                                    <p className="text-sm text-muted-foreground">
                                      Conta: {installment.payment_account_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="font-semibold text-lg">
                                {Number(installment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Account selection */}
                <div>
                  <Label>Conta para Recebimento *</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAccounts.map((account) => {
                        const accountTypeLabel = account.account_type === 'current' ? '[Conta Corrente]' : 
                                                account.account_type === 'cash' ? '[Caixa]' : 
                                                account.account_type === 'card' ? '[Cartão]' :
                                                account.account_type === 'delivery' ? '[Delivery]' : '';
                        return (
                          <SelectItem key={account.id} value={account.id}>
                            {accountTypeLabel} {account.name} - {account.bank}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment date */}
                <div>
                  <Label>Data de Recebimento *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                {/* Surcharge and Discount side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Acréscimo (R$)</Label>
                    <Input
                      type="number"
                      value={surcharge}
                      onChange={(e) => setSurcharge(Number(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>Desconto (R$)</Label>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Final value footer */}
                <div className="p-4 bg-primary/20 rounded-lg text-center">
                  <p className="text-lg font-bold">
                    Valor Final: R$ {(
                      (selectedInstallmentId 
                        ? (allInstallments.find(i => i.id === selectedInstallmentId)?.amount || 0)
                        : paymentAccount.amount
                      ) + surcharge - discount
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Anexos de Comprovante */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Comprovante de Recebimento
                  </Label>
                  
                  <input
                    ref={paymentFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handlePaymentFileSelect}
                    className="hidden"
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => paymentFileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivos
                  </Button>

                  {paymentAttachments.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paymentAttachments.map((att, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            value={att.title}
                            onChange={(e) => updatePaymentAttachmentTitle(index, e.target.value)}
                            placeholder="Título do anexo"
                            className="h-8 text-sm flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePaymentAttachment(index)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentAttachments([]);
                  }}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handlePayment} 
                    disabled={loading || uploadingPaymentAttachment || (allInstallments.length > 0 && !selectedInstallmentId)}
                  >
                    {uploadingPaymentAttachment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando anexos...
                      </>
                    ) : loading ? "Processando..." : "Confirmar Recebimento"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>

      {/* Modal de Estorno */}
      <Dialog open={showReverseModal} onOpenChange={setShowReverseModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estornar Recebimento</DialogTitle>
          </DialogHeader>
          
          {reverseAccount && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{reverseAccount.description}</p>
                <p className="text-sm text-muted-foreground">
                  Credor: {(reverseAccount as any).suppliers?.name || '-'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Loja: {reverseAccount.stores?.name || '-'}
                </p>
                <p className="text-lg font-semibold text-primary">
                  Valor: {reverseAccount.amount?.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </p>
              </div>

              {reverseInstallments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Selecione as parcelas para estornar:</h3>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {reverseInstallments.map((installment) => (
                        <div key={installment.id} className="flex items-center justify-between p-3 border rounded bg-green-50 border-green-200">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`reverse-${installment.id}`}
                              checked={selectedReverseInstallments.includes(installment.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReverseInstallments([...selectedReverseInstallments, installment.id]);
                                } else {
                                  setSelectedReverseInstallments(selectedReverseInstallments.filter(id => id !== installment.id));
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <div>
                              <p className="font-medium">
                                Parcela {installment.installment_number}
                                <span className="ml-2 text-green-600 text-sm">(RECEBIDA)</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Vencimento: {new Date(installment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                {installment.payment_date && (
                                  <span className="ml-2">
                                    - Recebida em: {new Date(installment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </p>
                              {installment.payment_account_name && (
                                <p className="text-sm text-muted-foreground">
                                  Conta: {installment.payment_account_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{Number(installment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">Atenção!</p>
                <p className="text-yellow-700 text-sm mt-1">
                  {reverseInstallments.length > 0 
                    ? "Ao confirmar o estorno, as parcelas selecionadas voltarão para o status pendente e poderão ser recebidas novamente."
                    : "Ao confirmar o estorno, esta conta voltará para o status \"pendente\" e poderá ser recebida novamente."
                  }
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReverseModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => performReversePayment(reverseAccount.id)} 
                  disabled={loading || (reverseInstallments.length > 0 && selectedReverseInstallments.length === 0)}
                  variant="destructive"
                >
                  {loading ? "Processando..." : "Confirmar Estorno"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Search Modal */}
      <ProductSearchModal
        open={showProductSearch}
        onOpenChange={setShowProductSearch}
        onSelectProduct={(product) => handleProductSelect(product)}
        functionType="credit"
      />
    </Dialog>
  );
}
