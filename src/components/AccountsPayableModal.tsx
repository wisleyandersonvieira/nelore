import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Edit, RefreshCw, Upload, X, FileText, FileDown, DollarSign, Eye, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NFEItemsValidationModal } from "./NFEItemsValidationModal";
import { SupplierSearchModal } from "./SupplierSearchModal";
import { ProductSearchModal } from "./ProductSearchModal";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";
import * as pdfjsLib from 'pdfjs-dist';

interface AccountsPayableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Supplier {
  id: string;
  name: string;
  cnpj_cpf?: string;
}

interface Employee {
  id: string;
  name: string;
  cpf: string;
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
  account_type: string; // 'current', 'cash', 'card', 'delivery'
}

interface PayableItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  store_id: string;
  store_name: string;
}

interface AccountPayable {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  document_type?: string;
  document_number?: string;
  issue_date?: string;
  data_competencia?: string;
  notes?: string;
  store_id?: string;
  supplier_id?: string;
  employee_id?: string;
  account_id?: string;
  suppliers?: { name: string };
  employees?: { name: string };
  stores?: { name: string };
  created_at: string;
  payment_date?: string;
  attachments?: Array<{name: string, url: string, size: number}>;
}

interface Installment {
  id?: string;
  installment_number: number;
  due_date: string;
  amount: number;
}

const documentTypes = [
  { value: "NF", label: "Nota Fiscal (NF)" },
  { value: "RC", label: "Recibo (RC)" },
  { value: "CT", label: "Contrato (CT)" },
  { value: "CF", label: "Cupom Fiscal (CF)" },
  { value: "FAT", label: "Fatura (FAT)" },
  { value: "HOL", label: "Holerite (HOL)" },
];

export function AccountsPayableModal({ open, onOpenChange }: AccountsPayableModalProps) {
  const [activeTab, setActiveTab] = useState("view");
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<AccountPayable | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [accountInstallments, setAccountInstallments] = useState<any[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);

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
  const [reverseAccount, setReverseAccount] = useState<AccountPayable | null>(null);
  const [reverseInstallments, setReverseInstallments] = useState<any[]>([]);
  const [selectedReverseInstallments, setSelectedReverseInstallments] = useState<string[]>([]);
  const [paymentAccountInfo, setPaymentAccountInfo] = useState<CurrentAccount | null>(null);
  const { toast } = useToast();

  // Filter fields
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterDocumentNumber, setFilterDocumentNumber] = useState("");
  const [filterCurrentAccount, setFilterCurrentAccount] = useState("");
  const [filterDueDateFrom, setFilterDueDateFrom] = useState("");
  const [filterDueDateTo, setFilterDueDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilteredData, setShowFilteredData] = useState(false);

  // Payment tab filters
  const [paymentFilterDateFrom, setPaymentFilterDateFrom] = useState("");
  const [paymentFilterDateTo, setPaymentFilterDateTo] = useState("");
  const [paymentFilterSupplier, setPaymentFilterSupplier] = useState("");
  const [paymentFilterStore, setPaymentFilterStore] = useState("");
  const [paymentFilterDocumentNumber, setPaymentFilterDocumentNumber] = useState("");
  const [paymentFilterCurrentAccount, setPaymentFilterCurrentAccount] = useState("");
  const [paymentFilterDueDateFrom, setPaymentFilterDueDateFrom] = useState("");
  const [paymentFilterDueDateTo, setPaymentFilterDueDateTo] = useState("");
  const [paymentShowFilteredData, setPaymentShowFilteredData] = useState(false);

  // Edit mode
  const [editingAccount, setEditingAccount] = useState<AccountPayable | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // Estado para controlar se é edição real (carregada da lista) ou apenas nota gravada
  const [isRealEdit, setIsRealEdit] = useState(false);

  // View-only mode
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [viewOnlyAccount, setViewOnlyAccount] = useState<AccountPayable | null>(null);

  // NFE validation modal
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [nfeItems, setNfeItems] = useState<any[]>([]);

  // Form fields
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
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
  const [defaultStore, setDefaultStore] = useState(""); // Loja padrão para todos os itens

  // File upload fields
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Array<{name: string, url: string, size: number}>>([]);

  // Search modals state
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchEmployees();
      fetchProducts();
      fetchStores();
      fetchCurrentAccounts();
      if (activeTab === "view") {
        // Buscar as 5 últimas contas por padrão na aba visualizar
        fetchLatestAccounts();
      }
      if (activeTab === "payment") {
        clearPaymentFilters();
      }
    } else {
      // Reset form quando modal for fechado
      setIsEmployeeMode(false);
      setSupplierId("");
      setEmployeeId("");
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
      setAttachments([]);
      setExistingAttachments([]);
      setNoteRecorded(false);
      setInstallments([]);
      setEditingAccount(null);
      setIsEditing(false);
      setIsRealEdit(false);
      setIsViewOnly(false);
      setViewOnlyAccount(null);
    }
  }, [open, activeTab]);

  // Recarregar produtos quando o modo funcionário mudar
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [isEmployeeMode]);

  const fetchLatestAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(name),
          employees(name),
          stores(name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments as Array<{name: string, url: string, size: number}> : []
      }));
      setAccountsPayable(formattedData);
      setShowFilteredData(true);
    } catch (error) {
      console.error("Error fetching latest accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar últimas contas cadastradas",
        variant: "destructive",
      });
    }
  };

  const fetchAccountsPayable = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(name),
          employees(name),
          stores(name)
        `)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments as Array<{name: string, url: string, size: number}> : []
      }));
      setAccountsPayable(formattedData);
    } catch (error) {
      console.error("Error fetching accounts payable:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a pagar",
        variant: "destructive",
      });
    }
  };

  const fetchFilteredPaymentAccounts = async () => {
    try {
      let query = supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(name),
          employees(name),
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
      if (paymentFilterSupplier && paymentFilterSupplier !== "all") {
        query = query.eq("supplier_id", paymentFilterSupplier);
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
      const formattedData = (data || []).map(item => ({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments as Array<{name: string, url: string, size: number}> : []
      }));
      setAccountsPayable(formattedData);
      setPaymentShowFilteredData(true);
    } catch (error) {
      console.error("Error fetching filtered payment accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a pagar filtradas",
        variant: "destructive",
      });
    }
  };

  const clearPaymentFilters = () => {
    setPaymentFilterDateFrom("");
    setPaymentFilterDateTo("");
    setPaymentFilterSupplier("all");
    setPaymentFilterStore("all");
    setPaymentFilterDocumentNumber("");
    setPaymentFilterCurrentAccount("");
    setPaymentFilterDueDateFrom("");
    setPaymentFilterDueDateTo("");
    setAccountsPayable([]);
    setPaymentShowFilteredData(false);
  };

  const fetchFilteredAccountsPayable = async () => {
    try {
      let query = supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(name),
          employees(name),
          stores(name)
        `);

      // Apply filters only if they have values
      if (filterDateFrom || filterDateTo) {
        // Para filtro de data de baixa, precisamos buscar contas que tenham payment_date
        // OU que tenham parcelas com payment_date dentro do período
        
        let accountsWithPaymentDate = [];
        let accountsWithInstallmentPaymentDate = [];
        
        // Buscar contas com payment_date principal
        if (filterDateFrom && filterDateTo) {
          const { data: mainPaymentData } = await supabase
            .from("accounts_payable")
            .select("id")
            .gte("payment_date", filterDateFrom)
            .lte("payment_date", filterDateTo);
          accountsWithPaymentDate = mainPaymentData?.map(item => item.id) || [];
        } else if (filterDateFrom) {
          const { data: mainPaymentData } = await supabase
            .from("accounts_payable")
            .select("id")
            .gte("payment_date", filterDateFrom);
          accountsWithPaymentDate = mainPaymentData?.map(item => item.id) || [];
        } else if (filterDateTo) {
          const { data: mainPaymentData } = await supabase
            .from("accounts_payable")
            .select("id")
            .lte("payment_date", filterDateTo);
          accountsWithPaymentDate = mainPaymentData?.map(item => item.id) || [];
        }
        
        // Buscar contas que têm parcelas com payment_date no período
        let installmentQuery = supabase
          .from("accounts_payable_installments")
          .select("account_payable_id")
          .not("payment_date", "is", null);
        
        if (filterDateFrom) {
          installmentQuery = installmentQuery.gte("payment_date", filterDateFrom);
        }
        if (filterDateTo) {
          installmentQuery = installmentQuery.lte("payment_date", filterDateTo);
        }
        
        const { data: installmentData } = await installmentQuery;
        accountsWithInstallmentPaymentDate = installmentData?.map(item => item.account_payable_id) || [];
        
        // Combinar IDs de ambas as buscas
        const allAccountIds = [...new Set([...accountsWithPaymentDate, ...accountsWithInstallmentPaymentDate])];
        
        if (allAccountIds.length > 0) {
          query = query.in("id", allAccountIds);
        } else {
          // Se não encontrou nenhuma conta com pagamento no período, retornar vazio
          setAccountsPayable([]);
          setShowFilteredData(true);
          return;
        }
      }
      
      if (filterSupplier && filterSupplier !== "all" && filterSupplier !== "") {
        query = query.eq("supplier_id", filterSupplier);
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
      
      // Apply status filter
      if (filterStatus && filterStatus !== "all") {
        if (filterStatus === "pending") {
          query = query.eq("status", "pending");
        } else if (filterStatus === "paid") {
          query = query.eq("status", "paid");
        } else if (filterStatus === "partial") {
          query = query.eq("status", "partial");
        }
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments as Array<{name: string, url: string, size: number}> : []
      }));
      
      console.log('📊 Dados das contas buscadas:', formattedData.map(item => ({
        id: item.id,
        description: item.description,
        attachments: item.attachments
      })));
      
      setAccountsPayable(formattedData);
      setShowFilteredData(true);
    } catch (error) {
      console.error("Error fetching filtered accounts payable:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a pagar filtradas",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSupplier("all");
    setFilterStore("all");
    setFilterDocumentNumber("");
    setFilterCurrentAccount("");
    setFilterDueDateFrom("");
    setFilterDueDateTo("");
    setFilterStatus("all");
    fetchLatestAccounts(); // Voltar para as 5 últimas contas
  };

  // Filtered supplier list for combobox
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  // Filtered product list for combobox
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const handleSupplierSelect = (supplier: Supplier) => {
    setSupplierId(supplier.id);
    setSupplierSearchTerm(supplier.name);
    setShowSupplierDropdown(false);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product.id);
    setProductSearchTerm(product.name);
    setShowProductDropdown(false);
  };

  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearchTerm(value);
    setShowSupplierDropdown(value.trim().length > 0 && filteredSuppliers.length > 0);
    if (value.trim().length === 0) {
      setSupplierId("");
    }
  };

  const handleProductSearchChange = (value: string) => {
    setProductSearchTerm(value);
    setShowProductDropdown(value.trim().length > 0 && filteredProducts.length > 0);
    if (value.trim().length === 0) {
      setSelectedProduct("");
    }
  };

  const openPaymentModal = async (account: AccountPayable) => {
    console.log('💰 Abrindo modal de pagamento para conta:', account.id);
    setPaymentAccount(account);
    setSelectedAccountId("");
    setPaymentDate("");
    setSurcharge(0);
    setDiscount(0);
    setAccountInstallments([]);
    setSelectedInstallments([]);

    // Check if account has installments
    try {
      console.log('🔍 Verificando parcelas para conta:', account.id);
      const { data: installmentsData, error } = await supabase
        .from("accounts_payable_installments")
        .select("*")
        .eq("account_payable_id", account.id)
        .order("installment_number");

      if (error) {
        console.error('❌ Erro ao buscar parcelas:', error);
        throw error;
      }

      console.log('📋 Parcelas encontradas para pagamento:', installmentsData?.length || 0, 'parcelas');
      console.log('📋 Detalhes das parcelas:', installmentsData);
      
      setAccountInstallments(installmentsData || []);
      
      if (installmentsData && installmentsData.length > 0) {
        console.log('✅ Conta tem parcelas - exibindo seleção de parcelas');
      } else {
        console.log('ℹ️ Conta não tem parcelas - exibindo pagamento total');
      }
    } catch (error) {
      console.error("❌ Erro ao buscar parcelas:", error);
    }

    setShowPaymentModal(true);
  };

  const handleEditAccount = async (account: AccountPayable) => {
    console.log('🔍 Editando conta:', account);
    
    // Verificar se a conta tem parcelas pagas para determinar se é somente anexo ou edição completa
    const { data: installmentsData, error: installmentsError } = await supabase
      .from("accounts_payable_installments")
      .select("payment_date")
      .eq("account_payable_id", account.id)
      .not("payment_date", "is", null);
    
    if (installmentsError) {
      console.error("❌ Erro ao verificar parcelas pagas:", installmentsError);
      toast({
        title: "Erro",
        description: "Erro ao verificar status dos pagamentos",
        variant: "destructive",
      });
      return;
    }
    
    const hasPayments = installmentsData && installmentsData.length > 0;
    
    if (hasPayments) {
      // Se há pagamentos, permitir apenas upload de arquivos
      toast({
        title: "Modo somente anexos",
        description: "Esta conta possui pagamentos realizados. Apenas upload de arquivos será permitido.",
        variant: "default",
      });
      setIsViewOnly(true);
    } else {
      setIsViewOnly(false);
    }
    
    console.log('📎 Anexos da conta:', account.attachments);
    console.log('📎 Tipo dos anexos:', typeof account.attachments);
    console.log('📎 É array?', Array.isArray(account.attachments));
    console.log('📎 Anexos stringified:', JSON.stringify(account.attachments));
    
    setEditingAccount(account);
    setIsEditing(true);
    setIsRealEdit(true); // Esta é uma edição real de conta existente
    
    // Verificar se é fornecedor ou funcionário
    if (account.employee_id) {
      setIsEmployeeMode(true);
      const employee = employees.find(e => e.name === account.employees?.name);
      setEmployeeId(employee?.id || "");
      setSupplierId("");
      setSupplierSearchTerm("");
    } else {
      setIsEmployeeMode(false);
      const supplier = suppliers.find(s => s.name === account.suppliers?.name);
      setSupplierId(supplier?.id || "");
      setEmployeeId("");
      setSupplierSearchTerm(supplier?.name || "");
    }
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
    setDataCompetencia(account.data_competencia || "");
    setNotes(account.notes || "");
    setNoteRecorded(true); // Ao editar, considerar como nota já gravada

    // Load existing attachments
    if (account.attachments && Array.isArray(account.attachments)) {
      console.log('✅ Carregando anexos existentes:', account.attachments);
      setExistingAttachments(account.attachments);
    } else {
      console.log('❌ Nenhum anexo encontrado ou anexos inválidos:', account.attachments);
      setExistingAttachments([]);
    }
    setAttachments([]);
    
    // Fetch items for this account
    try {
      const { data: itemsData, error } = await supabase
        .from("accounts_payable_items")
        .select(`
          *,
          products(name),
          stores(name)
        `)
        .eq("account_payable_id", account.id);

      if (error) throw error;

      const formattedItems: PayableItem[] = (itemsData || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || "",
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
        store_id: item.store_id,
        store_name: item.stores?.name || ""
      }));

      setItems(formattedItems);
    } catch (error) {
      console.error("Error fetching account items:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar itens da conta",
        variant: "destructive",
      });
    }
    
    setActiveTab("create");
  };

  const handleViewOnlyAccount = async (account: AccountPayable) => {
    console.log('👁️ Visualizando conta:', account);
    
    setViewOnlyAccount(account);
    setIsViewOnly(true);
    setIsEditing(false);
    setIsRealEdit(false);
    
    // Verificar se é fornecedor ou funcionário
    if (account.employee_id) {
      setIsEmployeeMode(true);
      const employee = employees.find(e => e.name === account.employees?.name);
      setEmployeeId(employee?.id || "");
      setSupplierId("");
      setSupplierSearchTerm("");
    } else {
      setIsEmployeeMode(false);
      const supplier = suppliers.find(s => s.name === account.suppliers?.name);
      setSupplierId(supplier?.id || "");
      setEmployeeId("");
      setSupplierSearchTerm(supplier?.name || "");
    }
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
    setDataCompetencia(account.data_competencia || "");
    setNotes(account.notes || "");
    setNoteRecorded(true);

    // Load existing attachments
    if (account.attachments && Array.isArray(account.attachments)) {
      setExistingAttachments(account.attachments);
    } else {
      setExistingAttachments([]);
    }
    setAttachments([]);
    
    // Fetch items for this account
    try {
      const { data: itemsData, error } = await supabase
        .from("accounts_payable_items")
        .select(`
          *,
          products(name),
          stores(name)
        `)
        .eq("account_payable_id", account.id);

      if (error) throw error;

      const formattedItems: PayableItem[] = (itemsData || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || "",
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
        store_id: item.store_id,
        store_name: item.stores?.name || ""
      }));

      setItems(formattedItems);
    } catch (error) {
      console.error("Error fetching account items:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar itens da conta",
        variant: "destructive",
      });
    }
    
    setActiveTab("create");
  };

  const handleReversePayment = async (account: AccountPayable) => {
    setReverseAccount(account);
    setSelectedReverseInstallments([]);
    setPaymentAccountInfo(null);

    // Check if account has installments
    try {
      const { data: installmentsData, error } = await supabase
        .from("accounts_payable_installments")
        .select("*")
        .eq("account_payable_id", account.id)
        .order("installment_number");

      if (error) throw error;

      const paidInstallments = (installmentsData || []).filter(inst => inst.payment_date !== null);
      setReverseInstallments(paidInstallments);

      // Fetch payment account information from financial transactions
      let referenceId = account.id;
      let referenceType = "accounts_payable";

      // If there are paid installments, use the first one to get the payment account
      if (paidInstallments.length > 0) {
        referenceId = paidInstallments[0].id;
        referenceType = "accounts_payable_installments";
      }

      const { data: transactionData, error: transactionError } = await supabase
        .from("financial_transactions")
        .select("account_id")
        .eq("reference_id", referenceId)
        .eq("reference_type", referenceType)
        .limit(1)
        .single();

      if (!transactionError && transactionData) {
        const paymentAccount = currentAccounts.find(acc => acc.id === transactionData.account_id);
        setPaymentAccountInfo(paymentAccount || null);
      }

      // Always show modal (both for accounts with and without installments)
      setShowReverseModal(true);
    } catch (error) {
      console.error("Error fetching installments for reverse:", error);
      // Still show modal even if there's an error
      setReverseInstallments([]);
      setShowReverseModal(true);
    }
  };

  const performReversePayment = async (accountId: string, installmentIds?: string[]) => {
    setLoading(true);
    try {
      if (installmentIds && installmentIds.length > 0) {
        // Reverse specific installments
        for (const installmentId of installmentIds) {
          // Update installment payment_date to null
          const { error: updateInstallmentError } = await supabase
            .from("accounts_payable_installments")
            .update({ payment_date: null })
            .eq("id", installmentId);

          if (updateInstallmentError) throw updateInstallmentError;

          // Delete financial transaction for this installment
          const { error: deleteError } = await supabase
            .from("financial_transactions")
            .delete()
            .eq("reference_id", installmentId)
            .eq("reference_type", "accounts_payable_installments");

          if (deleteError) throw deleteError;
        }

        // Check if any installments are still paid
        const { data: remainingPaidInstallments, error: checkError } = await supabase
          .from("accounts_payable_installments")
          .select("payment_date")
          .eq("account_payable_id", accountId)
          .not("payment_date", "is", null);

        if (checkError) throw checkError;

        const newStatus = (remainingPaidInstallments?.length || 0) > 0 ? "partial" : "pending";
        
        // Update account status
        const { error: updateAccountError } = await supabase
          .from("accounts_payable")
          .update({
            status: newStatus,
            payment_date: newStatus === "pending" ? null : undefined,
          })
          .eq("id", accountId);

        if (updateAccountError) throw updateAccountError;

        toast({
          title: "Sucesso",
          description: `${installmentIds.length} parcela(s) estornada(s) com sucesso`,
        });
      } else {
        // Original reverse logic for accounts without installments
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({
            status: "pending",
            payment_date: null,
          })
          .eq("id", accountId);

        if (updateError) throw updateError;

        // Delete financial transaction record
        const { error: deleteError } = await supabase
          .from("financial_transactions")
          .delete()
          .eq("reference_id", accountId)
          .eq("reference_type", "accounts_payable");

        if (deleteError) throw deleteError;

        toast({
          title: "Sucesso",
          description: "Baixa estornada com sucesso",
        });
      }

      fetchFilteredAccountsPayable();
      setShowReverseModal(false);
      setReverseAccount(null);
    } catch (error) {
      console.error("Error reversing payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao estornar baixa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string, status: string) => {
    if (status === 'paid' || status === 'partial') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir uma conta paga ou parcialmente paga. Estorne o pagamento primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja excluir esta conta a pagar?")) {
      return;
    }

    setLoading(true);
    try {
      // Delete items first (foreign key constraint)
      const { error: itemsError } = await supabase
        .from("accounts_payable_items")
        .delete()
        .eq("account_payable_id", accountId);

      if (itemsError) throw itemsError;

      // Delete the account
      const { error: accountError } = await supabase
        .from("accounts_payable")
        .delete()
        .eq("id", accountId);

      if (accountError) throw accountError;

      toast({
        title: "Sucesso",
        description: "Conta a pagar excluída com sucesso",
      });

      fetchFilteredAccountsPayable();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta a pagar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, cnpj_cpf")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar fornecedores",
        variant: "destructive",
      });
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, cpf")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar funcionários",
        variant: "destructive",
      });
    }
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true);

      // Se estiver no modo funcionário, filtrar por grupo do parâmetro FUNCIONÁRIOS
      if (isEmployeeMode) {
        const { data: paramData, error: paramError } = await supabase
          .from("system_parameters")
          .select("group_id")
          .eq("parameter_key", "funcionarios")
          .maybeSingle();

        if (paramError) {
          console.warn("Error fetching FUNCIONÁRIOS parameter:", paramError);
        } else if (paramData?.group_id) {
          query = query.eq("group_id", paramData.group_id);
        }
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar produtos",
        variant: "destructive",
      });
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar lojas",
        variant: "destructive",
      });
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
      toast({
        title: "Erro",
        description: "Erro ao buscar contas",
        variant: "destructive",
      });
    }
  };

  const addItem = () => {
    // Usar loja padrão se não houver loja selecionada e houver loja padrão definida
    const storeToUse = selectedStore || defaultStore;
    
    if (!selectedProduct || !storeToUse || quantity <= 0 || unitPrice <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do item",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    const store = stores.find(s => s.id === storeToUse);

    if (!product || !store) return;

    const totalPrice = Math.round((quantity * unitPrice) * 100) / 100;

    const newItem: PayableItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      store_id: storeToUse,
      store_name: store.name,
    };

    setItems([...items, newItem]);
    
    // Reset item form
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    // Só resetar a loja selecionada se não houver loja padrão
    if (!defaultStore) {
      setSelectedStore("");
    }
  };

  // Função para aplicar loja padrão a todos os itens existentes
  const applyDefaultStoreToAllItems = (defaultStoreId: string) => {
    if (!defaultStoreId) return;
    
    const store = stores.find(s => s.id === defaultStoreId);
    if (!store) return;

    const updatedItems = items.map(item => ({
      ...item,
      store_id: defaultStoreId,
      store_name: store.name
    }));
    
    setItems(updatedItems);
  };

  // Função chamada quando muda a loja padrão
  const handleDefaultStoreChange = (storeId: string) => {
    setDefaultStore(storeId);
    
    if (storeId) {
      // Se há itens existentes, perguntar se quer aplicar a loja padrão neles
      if (items.length > 0) {
        applyDefaultStoreToAllItems(storeId);
      }
      // Limpar a seleção individual se houver loja padrão
      setSelectedStore("");
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files).filter(file => {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: `Arquivo ${file.name} é muito grande. Máximo 10MB.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    
    setAttachments(prev => [...prev, ...newFiles]);
    event.target.value = ''; // Reset input
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Função para sanitizar nome de arquivo para storage
  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .normalize('NFD') // Decompor caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Substituir caracteres especiais por underscore
      .replace(/_{2,}/g, '_') // Substituir múltiplos underscores por um só
      .replace(/^_|_$/g, ''); // Remover underscores do início e fim
  };

  const uploadAttachments = async (accountId: string): Promise<Array<{name: string, url: string, size: number}>> => {
    const uploadedFiles: Array<{name: string, url: string, size: number}> = [];
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Usuário não autenticado");

    for (const file of attachments) {
      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${user.id}/${accountId}/${Date.now()}_${sanitizedName}`;
      
      console.log(`📎 Fazendo upload do arquivo: ${file.name} -> ${fileName}`);
      
      const { data, error } = await supabase.storage
        .from('account-documents')
        .upload(fileName, file);

      if (error) {
        console.error('❌ Erro no upload:', error);
        throw error;
      }

      console.log(`✅ Upload realizado: ${fileName}`);

      // Store the file path instead of public URL for private buckets
      uploadedFiles.push({
        name: file.name, // Manter nome original para exibição
        url: fileName, // Store file path for private bucket
        size: file.size
      });
    }

    return uploadedFiles;
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      console.log('📥 Iniciando download do arquivo:', filePath);
      
      // Detectar se é PDF para forçar download
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      const isPdf = fileExtension === 'pdf';
      
      // Se já é uma URL completa (anexos antigos), abrir diretamente
      if (filePath.startsWith('http')) {
        // Para downloads, usar fetch + blob para evitar bloqueio
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
          // Fallback para método anterior
          const link = document.createElement('a');
          link.href = filePath;
          link.download = fileName || filePath.split('/').pop() || 'arquivo';
          link.click();
        }
        return;
      }
      
      // Para paths do bucket, gerar signed URL
      const { data, error } = await supabase.storage
        .from('account-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('❌ Erro ao criar URL assinada:', error);
        throw error;
      }

      console.log('✅ URL assinada criada:', data.signedUrl);

      // Usar fetch + blob para evitar bloqueio do navegador
      try {
        const response = await fetch(data.signedUrl);
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
        console.log('✅ Download iniciado com sucesso');
        toast({
          title: "Sucesso",
          description: "Download realizado com sucesso",
        });
      } catch (fetchError) {
        console.error('Erro no fetch do arquivo:', fetchError);
        // Fallback para método simples
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
          title: "Sucesso",
          description: "Download iniciado com sucesso",
        });
      }
      
    } catch (error) {
      console.error('❌ Erro no download:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar arquivo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const extractDataFromPDF = async (file: File) => {
    console.log('🔄 Iniciando extração de dados do PDF:', file.name);
    
    try {
      console.log('📄 Convertendo arquivo para ArrayBuffer...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ ArrayBuffer criado, tamanho:', arrayBuffer.byteLength);
      
      // Configure pdfjs for browser usage - use cdnjs for better CORS support
      console.log('⚙️ Configurando PDF.js worker via cdnjs...');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      console.log('📖 Carregando documento PDF...');
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableAutoFetch: true,
        disableStream: true,
      });
      
      const pdf = await loadingTask.promise;
      console.log('✅ PDF carregado, páginas:', pdf.numPages);
      
      // Extrair texto de todas as páginas para encontrar itens
      let allText = '';
      const textContent = [];
      
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
        console.log(`📋 Extraindo texto da página ${pageNum}...`);
        const page = await pdf.getPage(pageNum);
        const pageTextContent = await page.getTextContent();
        
        const pageText = pageTextContent.items
          .map((item: any) => {
            if (item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .trim();
        
        allText += pageText + ' ';
        textContent.push(...pageTextContent.items);
      }

      console.log('✅ Texto extraído, comprimento:', allText.length);
      console.log('📝 Primeiros 200 caracteres:', allText.substring(0, 200));

      // Extrair CNPJ (formato XX.XXX.XXX/XXXX-XX ou apenas números)
      console.log('🔍 Procurando CNPJ...');
      const cnpjMatch = allText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || 
                      allText.match(/(\d{14})/);
      let cnpj = cnpjMatch ? cnpjMatch[1] : null;
      
      // Se encontrou CNPJ sem formatação, aplicar formatação
      if (cnpj && cnpj.length === 14 && !/[.\-\/]/.test(cnpj)) {
        cnpj = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      console.log('🆔 CNPJ encontrado:', cnpj || 'Não encontrado');

      // Extrair número do documento
      console.log('🔍 Procurando número do documento...');
      const docNumberMatch = allText.match(/N[ºo°]\s*(\d+)/i) || 
                           allText.match(/SÉRIE:\s*\d+\s*(\d+)/) ||
                           allText.match(/NOTA\s*FISCAL\s*(\d+)/i) ||
                           allText.match(/NF[-\s]*(\d+)/i) ||
                           allText.match(/DOCUMENTO\s*(\d+)/i);
      const documentNumber = docNumberMatch ? docNumberMatch[1] : null;
      console.log('📄 Número do documento:', documentNumber || 'Não encontrado');

      // Extrair data de emissão
      console.log('🔍 Procurando data de emissão...');
      const dateMatch = allText.match(/(\d{2}\/\d{2}\/\d{4})/) || 
                       allText.match(/(\d{2}\/\d{2}\/\d{2})/);
      let issueDate = dateMatch ? dateMatch[1] : null;
      
      // Se data no formato YY, converter para YYYY
      if (issueDate && issueDate.length === 8) {
        const parts = issueDate.split('/');
        if (parts[2].length === 2) {
          const year = parseInt(parts[2]);
          parts[2] = year > 50 ? `19${year}` : `20${year}`;
          issueDate = parts.join('/');
        }
      }
      console.log('📅 Data de emissão:', issueDate || 'Não encontrada');

      // Procurar valor total
      console.log('🔍 Procurando valor total...');
      const valueMatch = allText.match(/TOTAL[\s\w]*:?\s*R?\$?\s*([\d.,]+)/i) ||
                        allText.match(/VALOR[\s\w]*:?\s*R?\$?\s*([\d.,]+)/i) ||
                        allText.match(/R\$\s*([\d.,]+)/) ||
                        allText.match(/VALOR\s+TOTAL\s+([\d.,]+)/i);
      
      let totalValue = null;
      if (valueMatch) {
        const cleanValue = valueMatch[1].replace(/\./g, '').replace(',', '.');
        totalValue = parseFloat(cleanValue);
        if (isNaN(totalValue)) totalValue = null;
      }
      console.log('💰 Valor total:', totalValue || 'Não encontrado');

      // Extrair itens da NFE
      console.log('🔍 Procurando itens da NFE...');
      const items = await extractNFEItems(allText, textContent, supplierId);
      console.log('📦 Itens encontrados:', items.length);

      const result = {
        cnpj,
        documentNumber,
        issueDate,
        totalValue,
        items,
        text: allText.substring(0, 300) + '...' // Texto truncado para debug
      };

      console.log('✅ Extração concluída com sucesso:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Erro ao extrair dados do PDF:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Sem stack trace');
      throw error;
    }
  };

  // Função para extrair itens da NFE
  const extractNFEItems = async (text: string, textContent: any[], supplierId: string) => {
    console.log('🔍 Iniciando extração de itens da NFE...');
    console.log('📄 Texto completo da NFE (primeiros 500 chars):', text.substring(0, 500));
    
    try {
      const items = [];
      
      // Buscar códigos de produtos vinculados ao fornecedor
      const { data: supplierCodes } = await supabase
        .from('product_supplier_codes')
        .select('supplier_code, product_id')
        .eq('supplier_id', supplierId);

      // Buscar informações dos produtos
      const productIds = supplierCodes?.map(sc => sc.product_id) || [];
      const { data: products } = productIds.length > 0 ? await supabase
        .from('products')
        .select('id, name, code')
        .in('id', productIds) : { data: [] };

      console.log('🔗 Códigos do fornecedor encontrados:', supplierCodes?.length || 0);
      console.log('🔗 Códigos cadastrados:', supplierCodes?.map(sc => sc.supplier_code) || []);

      // Procurar por todos os códigos possíveis no texto
      const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
      console.log('📋 Total de linhas no PDF:', lines.length);

      // Primeiro, vamos procurar especificamente pelos códigos 1202 e 1683
      const targetCodes = ['1202', '1683'];
      
      for (const targetCode of targetCodes) {
        console.log(`🔍 Procurando pelo código ${targetCode}...`);
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Verificar se a linha contém o código
          if (line.includes(targetCode)) {
            console.log(`🎯 Código ${targetCode} encontrado na linha ${i}: "${line}"`);
            
            // Tentar extrair informações da linha
            const extractedItem = extractItemFromLine(line, targetCode, supplierCodes, products);
            if (extractedItem) {
              console.log(`✅ Item extraído:`, extractedItem);
              items.push(extractedItem);
            }
          }
        }
      }

      // Se não encontrou pelos códigos específicos, tentar busca mais ampla
      if (items.length === 0) {
        console.log('🔄 Tentando busca ampla por códigos de 3-4 dígitos...');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Procurar qualquer código de 3-4 dígitos no início da linha
          const codeMatch = line.match(/^\s*(\d{3,4})\s+(.+)/);
          if (codeMatch) {
            const codigo = codeMatch[1];
            console.log(`🔍 Código genérico ${codigo} encontrado na linha ${i}: "${line}"`);
            
            const extractedItem = extractItemFromLine(line, codigo, supplierCodes, products);
            if (extractedItem && !items.find(item => item.codigo === extractedItem.codigo)) {
              console.log(`✅ Item genérico extraído:`, extractedItem);
              items.push(extractedItem);
            }
          }
        }
      }

      console.log(`📦 ${items.length} itens extraídos da NFE`);
      return items;
      
    } catch (error) {
      console.error('❌ Erro ao extrair itens da NFE:', error);
      return [];
    }
  };

  // Função auxiliar para extrair item de uma linha
  const extractItemFromLine = (line: string, codigo: string, supplierCodes: any[], products: any[]) => {
    console.log(`🔎 Extraindo item da linha: "${line}"`);
    
    // Remover o código do início da linha para pegar o resto
    const withoutCode = line.replace(new RegExp(`^\\s*${codigo}\\s+`), '');
    console.log(`📝 Linha sem código: "${withoutCode}"`);
    
    // Procurar por números na linha (quantidade, valor unitário, valor total)
    const numbers = withoutCode.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/g) || [];
    console.log(`🔢 Números encontrados:`, numbers);
    
    if (numbers.length >= 3) {
      // Pegar os últimos 3 números como quantidade, valor unitário e valor total
      const quantidade = parseFloat(numbers[numbers.length - 3].replace(/\./g, '').replace(',', '.'));
      const valorUnitario = parseFloat(numbers[numbers.length - 2].replace(/\./g, '').replace(',', '.'));
      const valorTotal = parseFloat(numbers[numbers.length - 1].replace(/\./g, '').replace(',', '.'));
      
      console.log(`📊 Valores extraídos: Qtd=${quantidade}, Unit=${valorUnitario}, Total=${valorTotal}`);
      
      // Validar se os valores fazem sentido
      if (quantidade > 0 && valorUnitario > 0 && valorTotal > 0) {
        // Extrair descrição (tudo antes dos números)
        let descricao = withoutCode.replace(/\s*\d.*$/, '').trim();
        
        // Se não conseguiu extrair descrição, usar uma padrão baseada no código
        if (!descricao || descricao.length < 3) {
          switch (codigo) {
            case '1202':
              descricao = 'CREME ACAI ULTRACAI TRADICIONAL';
              break;
            case '1683':
              descricao = 'CREME DE ACAI C/ CREME DE AVELA';
              break;
            default:
              descricao = `PRODUTO ${codigo}`;
          }
        }
        
        console.log(`📝 Descrição extraída: "${descricao}"`);
        
        const currentProduct = {
          codigo,
          descricao,
          quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          found: false,
          product_id: null,
          product_name: null
        };
        
        // Verificar se temos esse código vinculado ao fornecedor
        const supplierCode = supplierCodes?.find(sc => sc.supplier_code === codigo);
        const product = supplierCode ? products?.find(p => p.id === supplierCode.product_id) : null;
        
        if (supplierCode && product) {
          currentProduct.found = true;
          currentProduct.product_id = product.id;
          currentProduct.product_name = product.name;
          console.log(`✅ Código ${codigo}: produto encontrado no cadastro →`, product.name);
        } else {
          console.log(`⚠️ Código ${codigo}: produto não encontrado no cadastro`);
        }
        
        return currentProduct;
      }
    }
    
    console.log(`❌ Não foi possível extrair valores válidos da linha`);
    return null;
  };

  const handleNFEUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚀 Iniciando processo de upload da NFE...');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('❌ Nenhum arquivo selecionado');
      return;
    }

    console.log('📁 Arquivo selecionado:', file.name, 'Tipo:', file.type, 'Tamanho:', file.size);

    if (file.type !== 'application/pdf') {
      console.log('❌ Tipo de arquivo inválido:', file.type);
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos PDF",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('📊 Extraindo dados do PDF...');
      // Extrair dados do PDF
      const extractedData = await extractDataFromPDF(file);
      console.log('✅ Dados extraídos com sucesso:', extractedData);

      // Verificar se encontrou CNPJ
      if (!extractedData.cnpj) {
        console.log('❌ CNPJ não encontrado no PDF');
        toast({
          title: "Aviso",
          description: "CNPJ do fornecedor não foi encontrado no PDF. Você pode preencher manualmente.",
          variant: "destructive",
        });
        // Não retorna aqui, continua o processo mesmo sem CNPJ
      } else {
        console.log('🔍 Buscando fornecedor pelo CNPJ:', extractedData.cnpj);
        
        // Buscar fornecedor pelo CNPJ
        const { data: supplier, error: supplierError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('cnpj_cpf', extractedData.cnpj)
          .eq('is_active', true)
          .single();

        if (supplierError || !supplier) {
          console.log('❌ Fornecedor não encontrado para CNPJ:', extractedData.cnpj);
          toast({
            title: "Fornecedor não encontrado",
            description: `O fornecedor com CNPJ ${extractedData.cnpj} não está cadastrado. Cadastre o fornecedor primeiro ou preencha manualmente.`,
            variant: "destructive",
          });
          // Continua mesmo sem encontrar fornecedor
        } else {
          console.log('✅ Fornecedor encontrado:', supplier.name);
          setSupplierId(supplier.id);
        }
      }

      console.log('💾 Fazendo upload do arquivo...');
      
      // Get current user's store ID for organizing files
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.store_id) {
        throw new Error('Usuário sem loja definida');
      }

      // Upload do arquivo com store_id no path para atender as políticas RLS
      const fileName = `${userProfile.store_id}/nfe_${Date.now()}_${file.name}`;
      console.log('📁 Caminho do arquivo:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('account-documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw uploadError;
      }
      console.log('✅ Upload realizado:', fileName);

      // Pré-preencher formulário
      console.log('📝 Preenchendo formulário...');
      setDocumentType('NF');
      setDocumentNumber(extractedData.documentNumber || '');
      setIssueDate(extractedData.issueDate ? formatDateForInput(extractedData.issueDate) : '');
      
      // Se encontrou itens, abrir modal de validação
      console.log('🔍 Verificando se deve abrir modal. Itens encontrados:', extractedData.items?.length || 0);
      if (extractedData.items && extractedData.items.length > 0) {
        console.log('📦 Abrindo modal de validação dos itens...', extractedData.items);
        setNfeItems(extractedData.items);
        setShowValidationModal(true);
        console.log('✅ Modal de validação configurada para abrir');
      } else {
        console.log('❌ Nenhum item encontrado, não abrindo modal de validação');
        // Se encontrou valor total, criar um item genérico
        if (extractedData.totalValue && extractedData.totalValue > 0) {
          console.log('💰 Criando item com valor:', extractedData.totalValue);
          const genericItem: PayableItem = {
            product_id: '', // Será preenchido pelo usuário
            product_name: 'Item da NFE', // Nome genérico
            quantity: 1,
            unit_price: extractedData.totalValue,
            total_price: extractedData.totalValue,
            store_id: '',
            store_name: ''
          };
          setItems([genericItem]);
        }
      }
      
      // Adicionar arquivo aos anexos existentes
      console.log('📎 Adicionando anexo...');
      setExistingAttachments(prev => [
        ...prev,
        {
          name: file.name,
          url: fileName,
          size: file.size
        }
      ]);

      console.log('🎉 Processo concluído com sucesso!');
      toast({
        title: "NFE processada com sucesso",
        description: `${extractedData.cnpj ? `CNPJ: ${extractedData.cnpj}` : 'CNPJ não encontrado'}${extractedData.documentNumber ? `\nDocumento: ${extractedData.documentNumber}` : ''}${extractedData.issueDate ? `\nData: ${extractedData.issueDate}` : ''}${extractedData.totalValue ? `\nValor: R$ ${extractedData.totalValue.toFixed(2)}` : ''}`,
      });

    } catch (error) {
      console.error('❌ Erro ao processar NFE:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Sem stack trace');
      
      let errorMessage = 'Erro ao processar arquivo da NFE';
      if (error instanceof Error) {
        if (error.message.includes('worker')) {
          errorMessage = 'Erro no carregamento do PDF. Tente novamente.';
        } else if (error.message.includes('Invalid PDF')) {
          errorMessage = 'Arquivo PDF inválido ou corrompido.';
        } else {
          errorMessage = `Erro: ${error.message}`;
        }
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }

    // Limpar input
    event.target.value = '';
  };

  const formatDateForInput = (dateString: string) => {
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
  };

  const handleValidatedItems = (validatedItems: any[]) => {
    // Se há loja padrão definida, aplicar aos itens que não têm loja
    const itemsWithDefaultStore = validatedItems.map(item => {
      if (!item.store_id && defaultStore) {
        const store = stores.find(s => s.id === defaultStore);
        return {
          ...item,
          store_id: defaultStore,
          store_name: store?.name || ''
        };
      }
      return item;
    });
    
    setItems(itemsWithDefaultStore);
    setShowValidationModal(false);
    toast({
      title: "Sucesso",
      description: `${validatedItems.length} itens importados da NFE com sucesso!`,
    });
  };

  const handleRecordNote = async () => {
    console.log('🚀 Iniciando handleRecordNote...');
    console.log('📎 existingAttachments:', existingAttachments);
    console.log('📎 attachments:', attachments);
    
    // Validar campos baseado no modo (fornecedor ou funcionário)
    const requiredEntityId = isEmployeeMode ? employeeId : supplierId;
    const entityType = isEmployeeMode ? "funcionário" : "fornecedor";
    
    if (!requiredEntityId || !documentType || !documentNumber || !issueDate || !dueDate || !dataCompetencia) {
      toast({
        title: "Erro",
        description: `Preencha todos os campos obrigatórios (${entityType})`,
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item",
        variant: "destructive",
      });
      return;
    }

    // Validar se o período de competência não está bloqueado
    const competenceValidation = await validateAccountsPayablePeriod.competencia(dataCompetencia);
    if (competenceValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Obter usuário atual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Usuário não autenticado");

      // Primeiro, criar a conta a pagar
      const userProfile = (await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single()).data;

      if (!userProfile?.store_id) {
        throw new Error('Usuário sem loja definida');
      }

      const totalAmount = getTotalAmount();
      
      // Usar a loja do primeiro item se houver itens, senão usar a loja do usuário
      const storeToUse = items.length > 0 ? items[0].store_id : userProfile.store_id;
      
      const { data: payable, error: payableError } = await supabase
        .from("accounts_payable")
        .insert({
          store_id: storeToUse,
          supplier_id: isEmployeeMode ? null : supplierId,
          employee_id: isEmployeeMode ? employeeId : null,
          account_id: null, // Será definido quando pagar a conta
          description: `${documentType} ${documentNumber}`,
          document_type: documentType,
          document_number: documentNumber,
          issue_date: issueDate,
          due_date: dueDate,
          data_competencia: dataCompetencia,
          amount: totalAmount,
          total_amount: totalAmount,
          status: "pending",
          notes: notes,
          created_by: user.id,
          attachments: [] // Inicialmente vazio, será atualizado abaixo
        })
        .select()
        .single();

      if (payableError) throw payableError;
      if (!payable) throw new Error("Falha ao criar conta a pagar");

      console.log('💾 Conta criada com ID:', payable.id);

      // Upload dos anexos se existirem
      let uploadedAttachments: Array<{name: string, url: string, size: number}> = [];
      if (attachments.length > 0) {
        console.log('📤 Fazendo upload de novos anexos:', attachments.length);
        uploadedAttachments = await uploadAttachments(payable.id);
      }
      
      // Combinar anexos existentes (como NFE) com novos anexos
      const allAttachments = [...existingAttachments, ...uploadedAttachments];
      console.log('📋 Total de anexos para salvar:', allAttachments.length);
      console.log('📋 Anexos detalhados:', allAttachments);
      
      if (allAttachments.length > 0) {
        console.log('💾 Atualizando conta com anexos:', allAttachments);
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({ attachments: allAttachments })
          .eq("id", payable.id);
          
        if (updateError) {
          console.error('❌ Erro ao atualizar anexos:', updateError);
          throw updateError;
        }
        console.log('✅ Anexos salvos com sucesso');
      }

      // Inserir os itens
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          account_payable_id: payable.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id
        }));

        const { error: itemsError } = await supabase
          .from("accounts_payable_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Configurar como editando a conta recém criada
      const accountWithAttachments = {
        ...payable,
        attachments: allAttachments // CORRIGIDO: usar allAttachments em vez de uploadedAttachments
      } as AccountPayable;
      
      console.log('🔧 Configurando conta para edição:', accountWithAttachments);
      console.log('🔧 Anexos na conta configurada:', accountWithAttachments.attachments);
      
      setEditingAccount(accountWithAttachments);
      setIsEditing(true);
      setIsRealEdit(false); // Esta é uma nova conta, não uma edição real
      setExistingAttachments(allAttachments); // CORRIGIDO: usar allAttachments
      setAttachments([]); // Limpar anexos novos
      
      setNoteRecorded(true);
      toast({
        title: "Sucesso",
        description: "Nota gravada com anexos! Agora você pode configurar parcelas ou finalizar.",
      });

    } catch (error) {
      console.error("Error recording note:", error);
      toast({
        title: "Erro",
        description: "Erro ao gravar nota",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Se está no modo apenas anexos (isViewOnly), permitir salvar apenas anexos
    if (isViewOnly && editingAccount) {
      setLoading(true);
      try {
        // Upload new attachments if any
        let newAttachments: Array<{name: string, url: string, size: number}> = [];
        if (attachments.length > 0) {
          newAttachments = await uploadAttachments(editingAccount.id);
        }
        
        // Combine existing and new attachments
        const allAttachments = [...existingAttachments, ...newAttachments];

        // Update only attachments
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({
            attachments: allAttachments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingAccount.id);

        if (updateError) throw updateError;

        toast({
          title: "Anexos atualizados",
          description: "Arquivos foram adicionados com sucesso à conta.",
        });
        
        // Reset form and close
        setAttachments([]);
        setExistingAttachments([]);
        setIsEditing(false);
        setIsViewOnly(false);
        setEditingAccount(null);
        onOpenChange(false);
        
      } catch (error) {
        console.error("Error updating attachments:", error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar anexos",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!noteRecorded) {
      toast({
        title: "Erro",
        description: "Primeiro grave a nota antes de salvar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Usuário não autenticado");

      const totalAmount = getTotalAmount();
      
      // Validar se o período de competência não está bloqueado (tanto para edição quanto criação)
      const competenceValidation = await validateAccountsPayablePeriod.competencia(dataCompetencia);
      if (competenceValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: competenceValidation.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Upload new attachments if any
      let newAttachments: Array<{name: string, url: string, size: number}> = [];
      if (attachments.length > 0) {
        newAttachments = await uploadAttachments(isEditing && editingAccount ? editingAccount.id : '');
      }
      
      // Combine existing and new attachments
      const allAttachments = [...existingAttachments, ...newAttachments];

      if (isEditing && editingAccount) {
        // Verificar se houve mudança no valor total
        const currentTotal = editingAccount.amount;
        const newTotal = totalAmount;
        let shouldDeleteInstallments = false;
        
        if (Math.abs(newTotal - currentTotal) > 0.01) { // Comparação com tolerância para decimais
          console.log('💸 Valor alterado de', currentTotal, 'para', newTotal, '- verificando parcelas existentes');
          
          // Verificar se existem parcelas
          const { data: existingInstallments, error: installmentsError } = await supabase
            .from("accounts_payable_installments")
            .select("id")
            .eq("account_payable_id", editingAccount.id);
            
          if (installmentsError) throw installmentsError;
          
          if (existingInstallments && existingInstallments.length > 0) {
            shouldDeleteInstallments = true;
            console.log('🗑️ Parcelas serão excluídas devido à mudança de valor');
          }
        }

        // Se deve excluir parcelas, excluir e atualizar o valor da conta para evitar detecção futura
        if (shouldDeleteInstallments) {
          console.log('🗑️ Excluindo parcelas antigas devido à mudança de valor');
          const { error: deleteInstallmentsError } = await supabase
            .from("accounts_payable_installments")
            .delete()
            .eq("account_payable_id", editingAccount.id);
            
          if (deleteInstallmentsError) throw deleteInstallmentsError;

          // Atualizar o valor da conta no banco para evitar detecção de mudança futura
          const { error: updateAmountError } = await supabase
            .from("accounts_payable")
            .update({
              amount: newTotal,
              total_amount: newTotal,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingAccount.id);
            
          if (updateAmountError) throw updateAmountError;

          // Atualizar o valor local também
          setEditingAccount({...editingAccount, amount: newTotal});
          
          toast({
            title: "Parcelas excluídas",
            description: "As parcelas foram excluídas devido à alteração do valor. Configure novas parcelas antes de salvar a conta.",
            variant: "destructive",
          });
          
          console.log('🛑 Não salvando conta devido à exclusão de parcelas - aguardando nova configuração');
          // NÃO salva a conta, apenas retorna para aguardar configuração de parcelas
          return;
        }

        // Update existing account (só executa se não houver exclusão de parcelas)
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({
            supplier_id: isEmployeeMode ? null : supplierId,
            employee_id: isEmployeeMode ? employeeId : null,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            due_date: dueDate,
            data_competencia: dataCompetencia,
            description: `${documentType} ${documentNumber}`,
            amount: totalAmount,
            total_amount: totalAmount,
            notes,
            attachments: allAttachments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingAccount.id);

        if (updateError) throw updateError;

        // Delete existing items
        const { error: deleteItemsError } = await supabase
          .from("accounts_payable_items")
          .delete()
          .eq("account_payable_id", editingAccount.id);

        if (deleteItemsError) throw deleteItemsError;

        // Insert new items
        const itemsToInsert = items.map(item => ({
          account_payable_id: editingAccount.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id,
        }));

        const { error: itemsError } = await supabase
          .from("accounts_payable_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Se há parcelas configuradas durante a edição, inserir as parcelas
        // APENAS se não for uma edição real (pois edições reais já inserem parcelas no confirmInstallments)
        if (installments.length > 0 && !isRealEdit) {
          const installmentsToInsert = installments.map(installment => ({
            account_payable_id: editingAccount.id,
            installment_number: installment.installment_number,
            due_date: installment.due_date,
            amount: installment.amount,
          }));

          const { error: installmentsError } = await supabase
            .from("accounts_payable_installments")
            .insert(installmentsToInsert);

          if (installmentsError) throw installmentsError;
        }

        toast({
          title: "Sucesso",
          description: "Conta a pagar atualizada com sucesso",
        });
      } else {
        // Create new account
        const userStore = await supabase.from("profiles").select("store_id").eq("id", user.id).single();

        // Usar a loja do primeiro item se houver itens, senão usar a loja do usuário
        const storeToUse = items.length > 0 ? items[0].store_id : userStore.data?.store_id;

        const { data: payable, error: payableError } = await supabase
          .from("accounts_payable")
          .insert({
            supplier_id: isEmployeeMode ? null : supplierId,
            employee_id: isEmployeeMode ? employeeId : null,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            data_competencia: dataCompetencia,
            description: `${documentType} ${documentNumber}`,
            amount: totalAmount,
            total_amount: totalAmount,
            notes,
            store_id: storeToUse,
            created_by: user.id,
            due_date: installments.length > 0 ? installments[0].due_date : dueDate,
            account_id: "11111111-1111-1111-1111-111111111111",
          })
          .select()
          .single();

        if (payableError) throw payableError;
        if (!payable) throw new Error("Falha ao criar conta a pagar");

        // Upload attachments for new account
        if (attachments.length > 0) {
          newAttachments = await uploadAttachments(payable.id);
          
          // Update the account with attachments
          await supabase
            .from("accounts_payable")
            .update({ attachments: newAttachments })
            .eq("id", payable.id);
        }


        // Insert items
        const itemsToInsert = items.map(item => ({
          account_payable_id: payable.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.store_id,
        }));

        const { error: itemsError } = await supabase
          .from("accounts_payable_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Se há parcelas, inserir as parcelas
        if (installments.length > 0) {
          const installmentsToInsert = installments.map(installment => ({
            account_payable_id: payable.id,
            installment_number: installment.installment_number,
            due_date: installment.due_date,
            amount: installment.amount,
          }));

          const { error: installmentsError } = await supabase
            .from("accounts_payable_installments")
            .insert(installmentsToInsert);

          if (installmentsError) throw installmentsError;
        }

        toast({
          title: "Sucesso",
          description: "Conta a pagar criada com sucesso",
        });
      }

      // Reset form and switch to view (não executar se excluiu parcelas durante edição)
      // O return já deveria ter impedido chegar aqui, mas adicionar flag para segurança
      setSupplierId("");
      setDocumentType("");
      setDocumentNumber("");
      setIssueDate("");
      setDueDate("");
      setDataCompetencia("");
      setNotes("");
      setItems([]);
      setDefaultStore(""); // Reset loja padrão
      setSelectedStore("");
      setAttachments([]);
      setExistingAttachments([]);
      setNoteRecorded(false);
      setInstallments([]);
      setIsEditing(false);
      setIsRealEdit(false);
      setEditingAccount(null);
      setActiveTab("view");

    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar conta a pagar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

    // If account has installments, check if at least one is selected
    if (accountInstallments.length > 0 && selectedInstallments.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma parcela para pagar",
        variant: "destructive",
      });
      return;
    }

    // Validar se o período de pagamento não está bloqueado
    const paymentValidation = await validateAccountsPayablePeriod.pagamento(paymentDate);
    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message,
        variant: "destructive",
      });
      return;
    }

    // Buscar produtos configurados para acréscimo e desconto
    let surchargeProduct = null;
    let discountProduct = null;
    
    if (surcharge > 0) {
      const { data: surchargeParam } = await supabase
        .from("system_parameters")
        .select("product_id, products!inner(id, name, code)")
        .eq("parameter_key", "acrescimo")
        .single();
      surchargeProduct = surchargeParam?.products;
    }
    
    if (discount > 0) {
      const { data: discountParam } = await supabase
        .from("system_parameters")
        .select("product_id, products!inner(id, name, code)")
        .eq("parameter_key", "desconto")
        .single();
      discountProduct = discountParam?.products;
    }

    // Verificar se a conta está vinculada às lojas dos itens (Regra 2)
    try {
      // Buscar itens da conta para obter as lojas
      const { data: accountItems, error: itemsError } = await supabase
        .from("accounts_payable_items")
        .select("store_id")
        .eq("account_payable_id", paymentAccount.id);

      if (itemsError) throw itemsError;

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
      const itemStoreIds = [...new Set(accountItems?.map(item => item.store_id) || [])];
      const allowedStoreIds = accountStores?.map(store => store.store_id) || [];

      const unauthorizedStores = itemStoreIds.filter(storeId => !allowedStoreIds.includes(storeId));

      if (unauthorizedStores.length > 0) {
        const accountTypeName = selectedAccount.account_type === 'current' ? 'conta corrente' : 
                               selectedAccount.account_type === 'cash' ? 'conta caixa' : 
                               selectedAccount.account_type === 'card' ? 'conta cartão' :
                               selectedAccount.account_type === 'delivery' ? 'conta delivery' : 'conta';
        toast({
          title: "Conta não autorizada",
          description: `A ${accountTypeName} selecionada não está vinculada a todas as lojas dos itens desta conta a pagar.`,
          variant: "destructive",
        });
        return;
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
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Get user's store_id for the transaction
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.warn("Could not get user store_id:", profileError);
      }

      if (accountInstallments.length > 0) {
        // Payment with installments
        const installmentsToPay = accountInstallments.filter(inst => 
          selectedInstallments.includes(inst.id)
        );

        let totalPaymentAmount = 0;

        // Update each selected installment
        for (const installment of installmentsToPay) {
          const installmentAmount = Number(installment.amount);
          const finalAmount = installmentAmount + surcharge - discount;
          totalPaymentAmount += finalAmount;

          // Inserir item de acréscimo se houver
          if (surcharge > 0 && surchargeProduct) {
            const { error: surchargeItemError } = await supabase
              .from("accounts_payable_items")
              .insert({
                account_payable_id: paymentAccount.id,
                product_id: surchargeProduct.id,
                quantity: 1,
                unit_price: surcharge,
                total_price: surcharge,
                store_id: userProfile?.store_id || paymentAccount.store_id,
              });
            
            if (surchargeItemError) throw surchargeItemError;
            
            // Atualizar o valor da parcela
            const { error: updateInstallmentAmountError } = await supabase
              .from("accounts_payable_installments")
              .update({
                amount: finalAmount
              })
              .eq("id", installment.id);
              
            if (updateInstallmentAmountError) throw updateInstallmentAmountError;
          }

          // Inserir item de desconto se houver
          if (discount > 0 && discountProduct) {
            const { error: discountItemError } = await supabase
              .from("accounts_payable_items")
              .insert({
                account_payable_id: paymentAccount.id,
                product_id: discountProduct.id,
                quantity: 1,
                unit_price: -discount, // Valor negativo para desconto
                total_price: -discount,
                store_id: userProfile?.store_id || paymentAccount.store_id,
              });
            
            if (discountItemError) throw discountItemError;
            
            // Atualizar o valor da parcela se ainda não foi atualizado
            if (surcharge === 0) {
              const { error: updateInstallmentAmountError } = await supabase
                .from("accounts_payable_installments")
                .update({
                  amount: finalAmount
                })
                .eq("id", installment.id);
                
              if (updateInstallmentAmountError) throw updateInstallmentAmountError;
            }
          }

          // Mark installment as paid
          const { error: updateInstallmentError } = await supabase
            .from("accounts_payable_installments")
            .update({
              payment_date: formatDateForDatabase(paymentDate)
            })
            .eq("id", installment.id);

          if (updateInstallmentError) throw updateInstallmentError;

          // Create financial transaction for each installment
          const { error: transactionError } = await supabase
            .from("financial_transactions")
            .insert({
              store_id: userProfile?.store_id || paymentAccount.store_id || null,
              account_id: selectedAccountId,
              transaction_type: "saida",
              amount: finalAmount,
              transaction_date: formatDateForDatabase(paymentDate),
              description: `Pagamento Parcela ${installment.installment_number}: ${paymentAccount.description}${surcharge > 0 ? ` + Acréscimo: R$ ${surcharge.toFixed(2)}` : ''}${discount > 0 ? ` - Desconto: R$ ${discount.toFixed(2)}` : ''}`,
              reference_id: installment.id,
              reference_type: "accounts_payable_installments",
              created_by: user.id
            });

          if (transactionError) throw transactionError;
        }

        // Check if all installments are now paid
        const { data: updatedInstallments, error: checkError } = await supabase
          .from("accounts_payable_installments")
          .select("payment_date")
          .eq("account_payable_id", paymentAccount.id);

        if (checkError) throw checkError;

        const allPaid = updatedInstallments?.every(inst => inst.payment_date !== null);
        const accountStatus = allPaid ? "paid" : "partial";
        
        // Update account status
        const { error: updateAccountError } = await supabase
          .from("accounts_payable")
          .update({
            status: accountStatus,
            payment_date: accountStatus === "paid" ? formatDateForDatabase(paymentDate) : null,
          })
          .eq("id", paymentAccount.id);

        if (updateAccountError) throw updateAccountError;

        toast({
          title: "Sucesso",
          description: `${selectedInstallments.length} parcela(s) paga(s) com sucesso${(surcharge > 0 || discount > 0) ? " e itens de ajuste adicionados" : ""}`,
        });
      } else {
        // Payment without installments (original logic)
        const originalAmount = Number(paymentAccount.amount);
        const finalAmount = originalAmount + surcharge - discount;

        // Inserir item de acréscimo se houver
        if (surcharge > 0 && surchargeProduct) {
          const { error: surchargeItemError } = await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: paymentAccount.id,
              product_id: surchargeProduct.id,
              quantity: 1,
              unit_price: surcharge,
              total_price: surcharge,
              store_id: userProfile?.store_id || paymentAccount.store_id,
            });
          
          if (surchargeItemError) throw surchargeItemError;
        }

        // Inserir item de desconto se houver
        if (discount > 0 && discountProduct) {
          const { error: discountItemError } = await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: paymentAccount.id,
              product_id: discountProduct.id,
              quantity: 1,
              unit_price: -discount, // Valor negativo para desconto
              total_price: -discount,
              store_id: userProfile?.store_id || paymentAccount.store_id,
            });
          
          if (discountItemError) throw discountItemError;
        }

        // Atualizar o valor total da conta se houver acréscimo ou desconto
        const updatedTotalAmount = originalAmount + surcharge - discount;

        // Update account status to paid
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({
            status: "paid",
            payment_date: formatDateForDatabase(paymentDate),
            amount: finalAmount,
            total_amount: updatedTotalAmount,
          })
          .eq("id", paymentAccount.id);

        if (updateError) throw updateError;

        // Create financial transaction
        const { error: transactionError } = await supabase
          .from("financial_transactions")
          .insert({
            store_id: userProfile?.store_id || paymentAccount.store_id || null,
            account_id: selectedAccountId,
            transaction_type: "saida",
            amount: finalAmount,
            transaction_date: formatDateForDatabase(paymentDate),
            description: `Pagamento: ${paymentAccount.description}${surcharge > 0 ? ` + Acréscimo: R$ ${surcharge.toFixed(2)}` : ''}${discount > 0 ? ` - Desconto: R$ ${discount.toFixed(2)}` : ''}`,
            reference_id: paymentAccount.id,
            reference_type: "accounts_payable",
            created_by: user.id
          });

        if (transactionError) throw transactionError;

        toast({
          title: "Sucesso",
          description: `Pagamento processado com sucesso${(surcharge > 0 || discount > 0) ? " e itens de ajuste adicionados" : ""}`,
        });
      }

      setShowPaymentModal(false);
      setPaymentAccount(null);
      fetchFilteredAccountsPayable();

    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openInstallmentsModal = () => {
    if (!noteRecorded) {
      toast({
        title: "Erro",
        description: "Primeiro grave a nota antes de configurar parcelas",
        variant: "destructive",
      });
      return;
    }
    setShowInstallmentsModal(true);
  };

  const generateInstallments = () => {
    const totalAmount = getTotalAmount();
    const installmentAmount = totalAmount / numberOfInstallments;
    const newInstallments: Installment[] = [];
    
    for (let i = 1; i <= numberOfInstallments; i++) {
      const installmentDate = new Date(dueDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
      
      newInstallments.push({
        installment_number: i,
        due_date: installmentDate.toISOString().split('T')[0],
        amount: i === numberOfInstallments 
          ? totalAmount - (installmentAmount * (numberOfInstallments - 1)) // Ajustar última parcela
          : installmentAmount
      });
    }
    
    setInstallments(newInstallments);
  };

  const updateInstallment = (index: number, field: string, value: string | number) => {
    const updatedInstallments = [...installments];
    updatedInstallments[index] = {
      ...updatedInstallments[index],
      [field]: value
    };
    setInstallments(updatedInstallments);
  };

  const confirmInstallments = async () => {
    // Validar se a soma das parcelas é igual ao valor total da conta
    const installmentsTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
    const accountTotal = editingAccount?.amount || getTotalAmount();
    
    if (Math.abs(installmentsTotal - accountTotal) > 0.01) { // Tolerância para decimais
      toast({
        title: "Soma incorreta",
        description: `A soma das parcelas (R$ ${installmentsTotal.toFixed(2)}) deve ser igual ao valor total da conta (R$ ${accountTotal.toFixed(2)}).`,
        variant: "destructive",
      });
      return;
    }

    // Para contas novas (apenas gravadas, não editadas de verdade), apenas fechar o modal
    // As parcelas serão inseridas no handleSave
    if (!isRealEdit || !editingAccount?.id) {
      setShowInstallmentsModal(false);
      toast({
        title: "Parcelas configuradas",
        description: `${installments.length} parcelas configuradas. Clique em "Salvar" para finalizar.`,
      });
      return;
    }

    try {
      setLoading(true);

      // Apenas para contas existentes sendo editadas:
      // Primeiro, remover parcelas existentes
      const { error: deleteError } = await supabase
        .from("accounts_payable_installments")
        .delete()
        .eq("account_payable_id", editingAccount.id);

      if (deleteError) throw deleteError;

      // Inserir novas parcelas
      const installmentsToInsert = installments.map(installment => ({
        account_payable_id: editingAccount.id,
        installment_number: installment.installment_number,
        due_date: installment.due_date,
        amount: installment.amount,
      }));

      const { error: insertError } = await supabase
        .from("accounts_payable_installments")
        .insert(installmentsToInsert);

      if (insertError) throw insertError;

      // Recarregar parcelas para atualizar o state
      const { data: reloadedInstallments, error: reloadError } = await supabase
        .from("accounts_payable_installments")
        .select("*")
        .eq("account_payable_id", editingAccount.id)
        .order("installment_number");

      if (reloadError) throw reloadError;

      setAccountInstallments(reloadedInstallments || []);
      setShowInstallmentsModal(false);

      toast({
        title: "Sucesso",
        description: `${installments.length} parcelas salvas com sucesso!`,
      });
    } catch (error) {
      console.error("Erro ao salvar parcelas:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar parcelas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contas a Pagar</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">Visualizar Contas</TabsTrigger>
            <TabsTrigger value="create">Cadastrar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="view">
            <div className="space-y-4">
              {/* Filtros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros de Busca
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {showFilteredData ? 
                      (filterDateFrom || filterDateTo || filterSupplier !== "" || filterStore !== "" || filterDocumentNumber || filterDueDateFrom || filterDueDateTo || filterStatus !== "all" 
                        ? `${accountsPayable.length} conta(s) encontrada(s) com os filtros aplicados`
                        : `Exibindo as 5 contas mais recentes`
                      )
                      : "Configure os filtros para buscar contas específicas ou veja as últimas cadastradas"
                    }
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="filter-date-from">Data Baixa (De)</Label>
                      <Input
                        id="filter-date-from"
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-date-to">Data Baixa (Até)</Label>
                      <Input
                        id="filter-date-to"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-supplier">Fornecedor</Label>
                      <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="filter-store">Loja</Label>
                      <Select value={filterStore} onValueChange={setFilterStore}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja" />
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
                      <Label htmlFor="filter-document">Número Documento</Label>
                      <Input
                        id="filter-document"
                        value={filterDocumentNumber}
                        onChange={(e) => setFilterDocumentNumber(e.target.value)}
                        placeholder="Digite o número do documento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-due-date-from">Vencimento (De)</Label>
                      <Input
                        id="filter-due-date-from"
                        type="date"
                        value={filterDueDateFrom}
                        onChange={(e) => setFilterDueDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filter-due-date-to">Vencimento (Até)</Label>
                      <Input
                        id="filter-due-date-to"
                        type="date"
                        value={filterDueDateTo}
                        onChange={(e) => setFilterDueDateTo(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-status">Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="partial">Parcial</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={fetchFilteredAccountsPayable}>
                      Aplicar Filtros
                    </Button>
                    <Button variant="outline" onClick={clearFilters}>
                      Limpar Filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Resultados */}
              {showFilteredData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Contas a Pagar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Pagamento</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountsPayable.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell>{account.description}</TableCell>
                            <TableCell>{account.suppliers?.name || account.employees?.name || '-'}</TableCell>
                            <TableCell>{account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                            <TableCell>R$ {Number(account.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                account.status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : account.status === 'partial'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {account.status === 'paid' ? 'Pago' : account.status === 'partial' ? 'Parcial' : 'Pendente'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {account.payment_date 
                                ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewOnlyAccount(account)}
                                  disabled={loading}
                                  title="Visualizar conta"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                {account.status !== 'paid' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditAccount(account)}
                                    disabled={loading}
                                    title="Editar conta"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                
                                {account.status === 'paid' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReversePayment(account)}
                                    disabled={loading}
                                    title="Estornar pagamento"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                                
                                {account.status === 'partial' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openPaymentModal(account)}
                                      disabled={loading}
                                      title="Pagar conta"
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleReversePayment(account)}
                                      disabled={loading}
                                      title="Estornar pagamento"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                
                                {account.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openPaymentModal(account)}
                                      disabled={loading}
                                      title="Pagar conta"
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteAccount(account.id, account.status)}
                                      disabled={loading}
                                      title="Excluir conta"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {accountsPayable.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              {showFilteredData 
                                ? "Nenhuma conta encontrada com os filtros aplicados"
                                : "Carregando contas..."
                              }
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create">
            <div className="space-y-6">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form">Formulário</TabsTrigger>
                  <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="employee-mode"
                          checked={isEmployeeMode}
                          onChange={(e) => {
                            setIsEmployeeMode(e.target.checked);
                            // Limpar seleções ao trocar de modo
                            setSupplierId("");
                            setEmployeeId("");
                          }}
                          disabled={isViewOnly}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="employee-mode" className="text-sm font-medium">
                          Funcionário
                        </Label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="supplier">{isEmployeeMode ? "Funcionário *" : "Fornecedor *"}</Label>
                        {isEmployeeMode ? (
                          <Select value={employeeId} onValueChange={setEmployeeId} disabled={isViewOnly}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um funcionário" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.name} {employee.cpf && `(${employee.cpf})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="relative">
                            <Input
                              placeholder="Digite o nome do fornecedor..."
                              value={supplierSearchTerm}
                              onChange={(e) => handleSupplierSearchChange(e.target.value)}
                              onFocus={() => setShowSupplierDropdown(supplierSearchTerm.trim().length > 0 && filteredSuppliers.length > 0)}
                              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                              disabled={isViewOnly}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowSupplierSearch(true)}
                              disabled={isViewOnly}
                              className="absolute right-0 top-0 h-full px-3"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            
                            {showSupplierDropdown && filteredSuppliers.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                                {filteredSuppliers.slice(0, 5).map((supplier) => (
                                  <div
                                    key={supplier.id}
                                    className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                    onMouseDown={() => handleSupplierSelect(supplier)}
                                  >
                                    <div className="font-medium">{supplier.name}</div>
                                    {supplier.cnpj_cpf && (
                                      <div className="text-sm text-muted-foreground">{supplier.cnpj_cpf}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="documentType">Tipo do Documento *</Label>
                        <Select value={documentType} onValueChange={setDocumentType} disabled={isViewOnly}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="documentNumber">Número do Documento *</Label>
                        <Input
                          id="documentNumber"
                          value={documentNumber}
                          onChange={(e) => setDocumentNumber(e.target.value)}
                          placeholder="Ex: 12345"
                          disabled={isViewOnly}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="issueDate">Data de Emissão *</Label>
                        <Input
                          id="issueDate"
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          disabled={isViewOnly}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Data de Vencimento *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          disabled={isViewOnly}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dataCompetencia">Data de Competência *</Label>
                        <Input
                          id="dataCompetencia"
                          type="date"
                          value={dataCompetencia}
                          onChange={(e) => setDataCompetencia(e.target.value)}
                          disabled={isViewOnly}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações adicionais..."
                      rows={3}
                      disabled={isViewOnly}
                    />
                  </div>

                  {/* Seção de Anexos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Anexos de Documentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Upload de novos arquivos */}
                      <div className="space-y-2">
                        <Label>Documentos</Label>
                        
                        {/* Upload area */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                          <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <input
                            id="nfe-upload"
                            type="file"
                            accept=".pdf"
                            onChange={handleNFEUpload}
                            className="hidden"
                          />
                          <div className="text-center">
                            <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                            <div className="space-y-2">
                              <div className="flex justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => document.getElementById('file-upload')?.click()}
                                  className="flex items-center gap-2"
                                >
                                  <Upload className="h-4 w-4" />
                                  Selecionar Arquivos
                                </Button>
                                <Button
                                  type="button"
                                  variant="default"
                                  onClick={() => document.getElementById('nfe-upload')?.click()}
                                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                >
                                  <FileDown className="h-4 w-4" />
                                  Cadastrar NFE
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                PDF, imagens, documentos (máx. 10MB cada)
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lista de anexos existentes */}
                      {existingAttachments.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Arquivos salvos:</Label>
                          <div className="space-y-2">
                            {existingAttachments.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded border">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span className="text-sm">{file.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadFile(file.url, file.name)}
                                    className="flex items-center gap-1"
                                  >
                                    <FileDown className="h-3 w-3" />
                                    Download
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExistingAttachment(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lista de novos anexos */}
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Novos arquivos:</Label>
                          <div className="space-y-2">
                            {attachments.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded border">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span className="text-sm">{file.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAttachment(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {attachments.length === 0 && existingAttachments.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          Nenhum documento anexado
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </TabsContent>

                <TabsContent value="items" className="space-y-4">
                  {/* Seção de Loja Padrão */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Loja Padrão (Opcional)</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Selecione uma loja padrão para aplicar automaticamente a todos os itens. 
                        {items.length > 0 && " Será aplicada aos itens existentes também."}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <Label>Loja Padrão</Label>
                          <Select value={defaultStore} onValueChange={handleDefaultStoreChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhuma loja padrão selecionada" />
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
                        <div className="flex items-center gap-2">
                          {defaultStore && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDefaultStoreChange("")}
                            >
                              Limpar Loja Padrão
                            </Button>
                          )}
                          {defaultStore && (
                            <div className="text-sm text-green-600 font-medium">
                              ✓ Loja padrão ativa
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Adicionar Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Produto</Label>
                          <div className="relative">
                            <Input
                              placeholder="Digite o nome do produto..."
                              value={productSearchTerm}
                              onChange={(e) => handleProductSearchChange(e.target.value)}
                              onFocus={() => setShowProductDropdown(productSearchTerm.trim().length > 0 && filteredProducts.length > 0)}
                              onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                              disabled={isViewOnly}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowProductSearch(true)}
                              disabled={isViewOnly}
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
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            disabled={isViewOnly}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Valor Unitário</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={unitPrice}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || value === "0") {
                                setUnitPrice(0);
                              } else {
                                setUnitPrice(parseFloat(value) || 0);
                              }
                            }}
                            disabled={isViewOnly}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Loja {defaultStore && <span className="text-sm text-muted-foreground">(opcional - loja padrão ativa)</span>}
                          </Label>
                          <Select value={selectedStore} onValueChange={setSelectedStore} disabled={!!defaultStore || isViewOnly}>
                            <SelectTrigger>
                              <SelectValue placeholder={defaultStore ? 
                                stores.find(s => s.id === defaultStore)?.name : "Selecione"} />
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

                        <div className="flex justify-between items-center">
                          <div className="text-lg font-semibold">
                            Total do Item: R$ {(Math.round((quantity * unitPrice) * 100) / 100).toFixed(2)}
                          </div>
                        <Button onClick={addItem} disabled={isViewOnly}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>R$ {item.unit_price.toFixed(2)}</TableCell>
                          <TableCell>R$ {item.total_price.toFixed(2)}</TableCell>
                          <TableCell>{item.store_name}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {items.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Total Geral</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">
                          R$ {getTotalAmount().toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4">
                {isViewOnly ? (
                  <>
                    <Button variant="outline" onClick={() => {
                      setIsViewOnly(false);
                      setViewOnlyAccount(null);
                      setActiveTab("view");
                    }}>
                      Voltar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? "Salvando..." : "Salvar Anexos"}
                    </Button>
                  </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                      </Button>
                      
                      {!noteRecorded ? (
                        <Button onClick={handleRecordNote} disabled={loading}>
                          Gravar Nota
                        </Button>
                       ) : (
                        <>
                          <Button variant="outline" onClick={openInstallmentsModal}>
                            Parcelas {installments.length > 0 && `(${installments.length})`}
                          </Button>
                          
                          
                          <Button onClick={handleSave} disabled={loading}>
                            {loading ? "Salvando..." : "Salvar"}
                          </Button>
                        </>
                      )}
                    </>
                  )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Validação dos Itens da NFE */}
        <NFEItemsValidationModal
          open={showValidationModal}
          onOpenChange={setShowValidationModal}
          nfeItems={nfeItems}
          stores={stores}
          supplierId={supplierId}
          onItemsValidated={handleValidatedItems}
        />

        {/* Modal de Parcelas */}
        <Dialog open={showInstallmentsModal} onOpenChange={setShowInstallmentsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Parcelas</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">Valor Total: R$ {getTotalAmount().toFixed(2)}</p>
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
                      Total das Parcelas: R$ {installments.reduce((sum, inst) => sum + inst.amount, 0).toFixed(2)}
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

        {/* Modal de Pagamento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pagar Conta</DialogTitle>
            </DialogHeader>
            
            {paymentAccount && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{paymentAccount.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Fornecedor: {paymentAccount.suppliers?.name || paymentAccount.employees?.name || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {new Date(paymentAccount.due_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    Valor Original: R$ {Number(paymentAccount.amount).toFixed(2)}
                  </p>
                </div>

                {/* Installments Section */}
                {accountInstallments.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Selecione as parcelas para pagar:</h3>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {accountInstallments.map((installment) => {
                          const isPaid = installment.payment_date !== null;
                          return (
                            <div key={installment.id} className={`flex items-center justify-between p-3 border rounded ${isPaid ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                              <div className="flex items-center space-x-3">
                                {!isPaid && (
                                  <input
                                    type="checkbox"
                                    id={installment.id}
                                    checked={selectedInstallments.includes(installment.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedInstallments([...selectedInstallments, installment.id]);
                                      } else {
                                        setSelectedInstallments(selectedInstallments.filter(id => id !== installment.id));
                                      }
                                    }}
                                    className="h-4 w-4"
                                  />
                                )}
                                <div>
                                  <p className="font-medium">
                                    Parcela {installment.installment_number}
                                    {isPaid && <span className="ml-2 text-green-600 text-sm">(PAGA)</span>}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Vencimento: {new Date(installment.due_date).toLocaleDateString('pt-BR')}
                                     {isPaid && (
                                       <span className="ml-2">
                                         - Paga em: {new Date(installment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                       </span>
                                     )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">R$ {Number(installment.amount).toFixed(2)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {selectedInstallments.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="font-medium text-blue-800">
                          {selectedInstallments.length} parcela(s) selecionada(s) - 
                          Total: R$ {accountInstallments
                            .filter(inst => selectedInstallments.includes(inst.id))
                            .reduce((sum, inst) => sum + Number(inst.amount), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Conta para Pagamento *</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} - {
                            account.account_type === 'current' ? 'Conta Corrente' : 
                            account.account_type === 'cash' ? 'Conta Caixa' : 
                            account.account_type === 'card' ? 'Conta Cartão' : 
                            account.account_type === 'delivery' ? 'Conta Delivery' : 
                            'Conta'
                          }
                          {account.account_type === 'current' && ` - ${account.bank} (${account.account_number})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data de Pagamento *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Acréscimo (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={surcharge}
                      onChange={(e) => setSurcharge(Number(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-lg font-bold text-center">
                    Valor Final: R$ {(() => {
                      const baseAmount = accountInstallments.length > 0 
                        ? accountInstallments
                            .filter(inst => selectedInstallments.includes(inst.id))
                            .reduce((sum, inst) => sum + Number(inst.amount), 0)
                        : Number(paymentAccount.amount);
                      return (baseAmount + surcharge - discount).toFixed(2);
                    })()}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handlePayment} 
                    disabled={loading || !selectedAccountId || !paymentDate || (accountInstallments.length > 0 && selectedInstallments.length === 0)}
                  >
                    {loading ? "Processando..." : "Confirmar Pagamento"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Estorno */}
        <Dialog open={showReverseModal} onOpenChange={setShowReverseModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Estornar Pagamento</DialogTitle>
            </DialogHeader>
            
            {reverseAccount && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{reverseAccount.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Fornecedor: {reverseAccount.suppliers?.name || reverseAccount.employees?.name || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {new Date(reverseAccount.due_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    Valor Original: R$ {Number(reverseAccount.amount).toFixed(2)}
                  </p>
                  {paymentAccountInfo && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Conta de Pagamento:</span> {paymentAccountInfo.name} - {
                        paymentAccountInfo.account_type === 'current' ? 'Conta Corrente' : 
                        paymentAccountInfo.account_type === 'cash' ? 'Conta Caixa' : 
                        paymentAccountInfo.account_type === 'card' ? 'Conta Cartão' : 
                        paymentAccountInfo.account_type === 'delivery' ? 'Conta Delivery' : 
                        'Conta'
                      }
                      {paymentAccountInfo.account_type === 'current' && ` - ${paymentAccountInfo.bank} (${paymentAccountInfo.account_number})`}
                    </p>
                  )}
                </div>

                {/* Paid Installments Section */}
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
                                  <span className="ml-2 text-green-600 text-sm">(PAGA)</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Vencimento: {new Date(installment.due_date).toLocaleDateString('pt-BR')}
                                   <span className="ml-2">
                                     - Paga em: {new Date(installment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                   </span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">R$ {Number(installment.amount).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {selectedReverseInstallments.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="font-medium text-red-800">
                          {selectedReverseInstallments.length} parcela(s) selecionada(s) para estorno - 
                          Total: R$ {reverseInstallments
                            .filter(inst => selectedReverseInstallments.includes(inst.id))
                            .reduce((sum, inst) => sum + Number(inst.amount), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowReverseModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => performReversePayment(reverseAccount.id, reverseInstallments.length > 0 ? selectedReverseInstallments : undefined)} 
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

        {/* Supplier Search Modal */}
        <SupplierSearchModal
          open={showSupplierSearch}
          onOpenChange={setShowSupplierSearch}
          onSelectSupplier={handleSupplierSelect}
        />

        {/* Product Search Modal */}
        <ProductSearchModal
          open={showProductSearch}
          onOpenChange={setShowProductSearch}
          onSelectProduct={handleProductSelect}
          isEmployeeMode={isEmployeeMode}
        />
      </DialogContent>
    </Dialog>
  );
}

export default AccountsPayableModal;