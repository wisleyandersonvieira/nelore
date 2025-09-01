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

  // Note recorded state
  const [noteRecorded, setNoteRecorded] = useState(false);

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

      // Apply filters only if they have values
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
            total_amount: totalAmount,
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
            account_id: selectedAccountId || currentAccounts[0]?.id || "",
            created_by: "system",
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
      const finalAmount = paymentAccount.amount + surcharge - discount;

      // Update account status
      const { error: updateError } = await supabase
        .from("accounts_receivable")
        .update({
          status: "paid",
          payment_date: paymentDate,
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
          transaction_date: paymentDate,
          description: `Recebimento - ${paymentAccount.description}`,
          reference_id: paymentAccount.id,
          reference_type: "account_receivable",
          created_by: "system",
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Sucesso",
        description: "Pagamento processado com sucesso",
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
                              {account.status === "paid" ? "Pago" : "Pendente"}
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
              <div className="flex gap-2">
                <Button 
                  onClick={() => setNoteRecorded(true)}
                  disabled={!creditorId || !issueDate || !dueDate}
                >
                  Gravar Nota
                </Button>
              </div>
            )}

            {(noteRecorded || isViewOnly) && (
              <Card>
                <CardHeader>
                  <CardTitle>Itens da Conta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isViewOnly && (
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
                  )}

                  {!isViewOnly && (
                    <Button onClick={addItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Item
                    </Button>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Preço Unit.</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Loja</TableHead>
                          {!isViewOnly && <TableHead>Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              R$ {item.unit_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              R$ {item.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>{item.store_name}</TableCell>
                            {!isViewOnly && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
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
                  </div>

                  {items.length > 0 && (
                    <div className="flex justify-end">
                      <div className="text-lg font-semibold">
                        Total: R$ {getTotalAmount().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!isViewOnly && (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("view");
                    setIsEditing(false);
                    setEditingAccount(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {isViewOnly && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("view");
                    setIsViewOnly(false);
                    setViewOnlyAccount(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            )}
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

        {/* Payment Modal */}
        {showPaymentModal && paymentAccount && (
          <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Processar Recebimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <Input value={paymentAccount.description} disabled />
                </div>
                
                <div>
                  <Label>Valor Original</Label>
                  <Input 
                    value={`R$ ${paymentAccount.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    disabled 
                  />
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
    </Dialog>
  );
}