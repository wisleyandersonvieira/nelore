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
import { Trash2, Plus, Edit, RefreshCw, Upload, X, FileText, FileDown, DollarSign, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  creditors?: { name: string };
  stores?: { name: string };
  created_at: string;
  payment_date?: string;
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

export function AccountsReceivableModal({ open, onOpenChange }: AccountsReceivableModalProps) {
  const [activeTab, setActiveTab] = useState("view");
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [items, setItems] = useState<ReceivableItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<AccountReceivable | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

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

  // View-only mode
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [viewOnlyAccount, setViewOnlyAccount] = useState<AccountReceivable | null>(null);

  // Form fields
  const [creditorId, setCreditorId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
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

  useEffect(() => {
    if (open) {
      fetchCreditors();
      fetchProducts();
      fetchStores();
      fetchCurrentAccounts();
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
      setNotes("");
      setItems([]);
      setDefaultStore("");
      setSelectedStore("");
      setSelectedProduct("");
      setQuantity(1);
      setUnitPrice(0);
      setNoteRecorded(false);
      setInstallments([]);
      setEditingAccount(null);
      setIsEditing(false);
      setIsRealEdit(false);
      setIsViewOnly(false);
      setViewOnlyAccount(null);
    }
  }, [open, activeTab]);

  const fetchAccountsReceivable = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select(`
          *,
          creditors(name),
          stores(name)
        `)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccountsReceivable(data || []);
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
          creditors(name),
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
      setAccountsReceivable(data || []);
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
          creditors(name),
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

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAccountsReceivable(data || []);
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
    setAccountsReceivable([]);
    setShowFilteredData(false);
  };

  const openPaymentModal = async (account: AccountReceivable) => {
    setPaymentAccount(account);
    setSelectedAccountId("");
    setPaymentDate("");
    setSurcharge(0);
    setDiscount(0);
    setShowPaymentModal(true);
  };

  const handleEditAccount = async (account: AccountReceivable) => {
    console.log('Editing account:', account);
    setEditingAccount(account);
    setIsEditing(true);
    setIsRealEdit(true);
    setActiveTab("create");
    
    // Load form data
    setCreditorId(account.creditors ? "" : "");
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
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

      const formattedItems = (itemsData || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || "",
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        store_id: item.store_id,
        store_name: item.stores?.name || "",
      }));

      setItems(formattedItems);
      setNoteRecorded(true);

    } catch (error) {
      console.error("Error loading account items:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar itens da conta",
        variant: "destructive",
      });
    }
  };

  const handleViewAccount = (account: AccountReceivable) => {
    setViewOnlyAccount(account);
    setIsViewOnly(true);
    setActiveTab("create");
  };

  const handleReversePayment = (account: AccountReceivable) => {
    setReverseAccount(account);
    setShowReverseModal(true);
  };

  const performReversePayment = async (accountId: string) => {
    setLoading(true);
    try {
      // Update the account status back to pending and clear payment_date
      const { error } = await supabase
        .from("accounts_receivable")
        .update({ 
          status: 'pending',
          payment_date: null 
        })
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recebimento estornado com sucesso",
      });

      fetchFilteredAccountsReceivable(); // Refresh data
      setShowReverseModal(false);
      setReverseAccount(null);
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

  const handleDeleteAccount = async (accountId: string, status: string) => {
    if (status === 'paid' || status === 'partial') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir uma conta paga ou parcialmente paga. Estorne o recebimento primeiro.",
        variant: "destructive",
      });
      return;
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
        .from("creditors")
        .select("id, name, cnpj_cpf")
        .eq("is_active", true)
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
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
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
    }
  };

  const fetchCurrentAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("current_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCurrentAccounts(data || []);
    } catch (error) {
      console.error("Error fetching current accounts:", error);
    }
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

    const newItem: ReceivableItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
      store_id: selectedStore,
      store_name: store.name,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    setSelectedStore(defaultStore);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleRecordNote = () => {
    if (!creditorId || !issueDate || !dueDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (Credor, Data Emissão, Data Vencimento)",
        variant: "destructive",
      });
      return;
    }

    setNoteRecorded(true);
    toast({
      title: "Sucesso",
      description: "Nota gravada! Agora adicione os itens.",
    });
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
    const difference = totalAmount - totalInstallments;
    if (difference !== 0) {
      newInstallments[newInstallments.length - 1].amount += difference;
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
    if (getTotalAmount() <= 0) {
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
    if (!creditorId || items.length === 0 || !issueDate || !dueDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios e adicione pelo menos um item",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const totalAmount = getTotalAmount();

      if (isEditing && editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from("accounts_receivable")
          .update({
            creditor_id: creditorId,
            description: `Conta a Receber - ${documentType} ${documentNumber}`,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            due_date: dueDate,
            amount: totalAmount,
            notes,
            status: "pending",
          })
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

        const { error: itemsError } = await supabase
          .from("accounts_receivable_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast({
          title: "Sucesso",
          description: "Conta a receber atualizada com sucesso",
        });
      } else {
        // Create new account
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error("Usuário não autenticado");
        }

        const { data: accountData, error } = await supabase
          .from("accounts_receivable")
          .insert({
            creditor_id: creditorId,
            description: `Conta a Receber - ${documentType} ${documentNumber}`,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            due_date: dueDate,
            amount: totalAmount,
            notes,
            status: "pending",
            store_id: items[0]?.store_id,
            account_id: null, // Será definido quando receber o pagamento
            created_by: user.id,
          })
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

        const { error: itemsError } = await supabase
          .from("accounts_receivable_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

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
      setNotes("");
      setItems([]);
      setNoteRecorded(false);
      setInstallments([]);
      setIsEditing(false);
      setEditingAccount(null);
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

  const handlePayment = async () => {
    if (!paymentAccount || !selectedAccountId || !paymentDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
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

      const finalAmount = paymentAccount.amount + surcharge - discount;

      // Update account status
      const { error: updateError } = await supabase
        .from("accounts_receivable")
        .update({
          status: "paid",
          payment_date: formatDateForDatabase(paymentDate),
          amount: finalAmount,
        })
        .eq("id", paymentAccount.id);

      if (updateError) throw updateError;

      // Create financial transaction
      const { error: transactionError } = await supabase
        .from("financial_transactions")
        .insert({
          store_id: paymentAccount.store_id || "",
          account_id: selectedAccountId,
          transaction_type: "entrada",
          amount: finalAmount,
          transaction_date: formatDateForDatabase(paymentDate),
          description: `Recebimento - ${paymentAccount.description}`,
          reference_id: paymentAccount.id,
          reference_type: "accounts_receivable",
          created_by: user.id,
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Sucesso",
        description: "Recebimento processado com sucesso",
      });

      setShowPaymentModal(false);
      setPaymentAccount(null);
      
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="view">Visualizar</TabsTrigger>
            <TabsTrigger value="create">
              {isEditing ? "Editar" : "Criar"}
            </TabsTrigger>
            <TabsTrigger value="payment">Recebimento</TabsTrigger>
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
                        <TableHead>Descrição</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountsReceivable.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.description}</TableCell>
                          <TableCell>{account.creditors?.name || "N/A"}</TableCell>
                          <TableCell>{account.stores?.name || "N/A"}</TableCell>
                          <TableCell>
                            R$ {account.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {new Date(account.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              account.status === "paid" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {account.status === "paid" ? "Recebido" : "Pendente"}
                            </span>
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
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleEditAccount(account)}
                               >
                                 <Edit className="h-4 w-4" />
                               </Button>
                               
                               {account.status === 'paid' && (
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
                               
                               {account.status === 'pending' && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Credor *</Label>
                <Select 
                  value={creditorId} 
                  onValueChange={setCreditorId}
                  disabled={isViewOnly}
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

              <div>
                <Label>Tipo Documento</Label>
                <Select 
                  value={documentType} 
                  onValueChange={setDocumentType}
                  disabled={isViewOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
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

              <div>
                <Label>Número Documento</Label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Número do documento"
                  disabled={isViewOnly}
                />
              </div>

              <div>
                <Label>Data Emissão *</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={isViewOnly}
                />
              </div>

              <div>
                <Label>Data Vencimento *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isViewOnly}
                />
              </div>

              <div>
                <Label>Loja Padrão</Label>
                <Select 
                  value={defaultStore} 
                  onValueChange={(value) => {
                    setDefaultStore(value);
                    setSelectedStore(value);
                  }}
                  disabled={isViewOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar loja padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais"
                disabled={isViewOnly}
              />
            </div>

            {!isViewOnly && (
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="items">Itens</TabsTrigger>
                </TabsList>
                
                <TabsContent value="items" className="space-y-4">
                  {!noteRecorded ? (
                    <div className="text-center p-8 bg-muted rounded-lg">
                      <p className="text-muted-foreground mb-4">
                        Preencha os dados principais e clique em "Gravar Nota" para adicionar itens
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Produto *</Label>
                          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Quantidade *</Label>
                          <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            min="0.01"
                            step="0.01"
                          />
                        </div>

                        <div>
                          <Label>Preço Unitário *</Label>
                          <Input
                            type="number"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(Number(e.target.value))}
                            min="0.01"
                            step="0.01"
                          />
                        </div>

                        <div>
                          <Label>Loja *</Label>
                          <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar loja" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button onClick={addItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Item
                      </Button>

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
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end gap-2 pt-4">
              {isViewOnly ? (
                <Button variant="outline" onClick={() => {
                  setIsViewOnly(false);
                  setViewOnlyAccount(null);
                  setActiveTab("view");
                }}>
                  Voltar
                </Button>
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
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            {/* Payment Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros para Recebimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Credor</Label>
                    <Select value={paymentFilterCreditor} onValueChange={setPaymentFilterCreditor}>
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
                    <Select value={paymentFilterStore} onValueChange={setPaymentFilterStore}>
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
                    <Label>Vencimento (De)</Label>
                    <Input
                      type="date"
                      value={paymentFilterDueDateFrom}
                      onChange={(e) => setPaymentFilterDueDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Vencimento (Até)</Label>
                    <Input
                      type="date"
                      value={paymentFilterDueDateTo}
                      onChange={(e) => setPaymentFilterDueDateTo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={fetchFilteredPaymentAccounts}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={clearPaymentFilters}>
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Contas para Recebimento {paymentShowFilteredData && `(${accountsReceivable.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountsReceivable.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.description}</TableCell>
                          <TableCell>{account.creditors?.name || "N/A"}</TableCell>
                          <TableCell>{account.stores?.name || "N/A"}</TableCell>
                          <TableCell>
                            R$ {account.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {new Date(account.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => openPaymentModal(account)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Receber
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
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

        {/* Payment Modal */}
        {showPaymentModal && paymentAccount && (
          <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Processar Recebimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{paymentAccount.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Credor: {paymentAccount.creditors?.name || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {new Date(paymentAccount.due_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    Valor Original: R$ {Number(paymentAccount.amount).toFixed(2)}
                  </p>
                </div>

                <div>
                  <Label>Acréscimo</Label>
                  <Input
                    type="number"
                    value={surcharge}
                    onChange={(e) => setSurcharge(Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <Label>Desconto</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <Label>Valor Final</Label>
                  <Input 
                    value={`R$ ${(paymentAccount.amount + surcharge - discount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    disabled 
                  />
                </div>

                <div>
                  <Label>Conta Corrente *</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} - {account.bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data Recebimento *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handlePayment} disabled={loading}>
                    {loading ? "Processando..." : "Confirmar Recebimento"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                    Cancelar
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
                  Credor: {reverseAccount.creditors?.name || '-'}
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

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">Atenção!</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Ao confirmar o estorno, esta conta voltará para o status "pendente" e poderá ser recebida novamente.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReverseModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => performReversePayment(reverseAccount.id)} 
                  disabled={loading}
                  variant="destructive"
                >
                  {loading ? "Processando..." : "Confirmar Estorno"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}