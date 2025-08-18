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
import { Trash2, Plus, Edit, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountsPayableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Supplier {
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
  notes?: string;
  suppliers?: { name: string };
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

export function AccountsPayableModal({ open, onOpenChange }: AccountsPayableModalProps) {
  const [activeTab, setActiveTab] = useState("view");
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Payment form fields
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
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

  // Form fields
  const [supplierId, setSupplierId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Item form fields
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedStore, setSelectedStore] = useState("");

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchProducts();
      fetchStores();
      fetchCurrentAccounts();
      if (activeTab === "view") {
        // Buscar todas as contas por padrão na aba visualizar
        fetchFilteredAccountsPayable();
      }
      if (activeTab === "payment") {
        clearPaymentFilters();
      }
    }
  }, [open, activeTab]);

  const fetchAccountsPayable = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(name),
          stores(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccountsPayable(data || []);
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
          stores(name)
        `)
        .eq("status", "pending");

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
      setAccountsPayable(data || []);
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
          stores(name)
        `);

      // Apply filters only if they have values
      if (filterDateFrom) {
        query = query.gte("payment_date", filterDateFrom);
      }
      if (filterDateTo) {
        query = query.lte("payment_date", filterDateTo);
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

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAccountsPayable(data || []);
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
    setAccountsPayable([]);
    setShowFilteredData(false);
  };

  const handleEditAccount = async (account: AccountPayable) => {
    setEditingAccount(account);
    setIsEditing(true);
    // Find the actual supplier ID from the suppliers array
    const supplier = suppliers.find(s => s.name === account.suppliers?.name);
    setSupplierId(supplier?.id || "");
    setDocumentType(account.document_type || "");
    setDocumentNumber(account.document_number || "");
    setIssueDate(account.issue_date || "");
    setDueDate(account.due_date || "");
    setNotes(account.notes || "");
    
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

  const handleReversePayment = async (accountId: string) => {
    setLoading(true);
    try {
      // Update account status back to pending
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

      fetchFilteredAccountsPayable();
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
    if (status === 'paid') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir uma conta paga. Estorne o pagamento primeiro.",
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
      const { data, error } = await supabase
        .from("current_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCurrentAccounts(data || []);
    } catch (error) {
      console.error("Error fetching current accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas correntes",
        variant: "destructive",
      });
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

    const totalPrice = quantity * unitPrice;

    const newItem: PayableItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      store_id: selectedStore,
      store_name: store.name,
    };

    setItems([...items, newItem]);
    
    // Reset item form
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    setSelectedStore("");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSave = async () => {
    if (!supplierId || !documentType || !documentNumber || !issueDate || !dueDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
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

    setLoading(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Usuário não autenticado");

      const totalAmount = getTotalAmount();

      if (isEditing && editingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from("accounts_payable")
          .update({
            supplier_id: supplierId,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            due_date: dueDate,
            description: `${documentType} ${documentNumber}`,
            amount: totalAmount,
            total_amount: totalAmount,
            notes,
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

        toast({
          title: "Sucesso",
          description: "Conta a pagar atualizada com sucesso",
        });
      } else {
        // Create new account
        const userStore = await supabase.from("profiles").select("store_id").eq("id", user.id).single();

        const { data: payable, error: payableError } = await supabase
          .from("accounts_payable")
          .insert({
            supplier_id: supplierId,
            document_type: documentType,
            document_number: documentNumber,
            issue_date: issueDate,
            description: `${documentType} ${documentNumber}`,
            amount: totalAmount,
            total_amount: totalAmount,
            notes,
            store_id: userStore.data?.store_id,
            created_by: user.id,
            due_date: dueDate,
            account_id: "11111111-1111-1111-1111-111111111111",
          })
          .select()
          .single();

        if (payableError) throw payableError;

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

        toast({
          title: "Sucesso",
          description: "Conta a pagar criada com sucesso",
        });
      }

      // Reset form and switch to view
      setSupplierId("");
      setDocumentType("");
      setDocumentNumber("");
      setIssueDate("");
      setDueDate("");
      setNotes("");
      setItems([]);
      setIsEditing(false);
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

  const handlePayment = async (accountId: string) => {
    if (!selectedAccountId || !paymentDate) {
      toast({
        title: "Erro",
        description: "Selecione a conta corrente e data de pagamento",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          payment_date: paymentDate,
        })
        .eq("id", accountId);

      if (error) throw error;

      // Create financial transaction record
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const userStore = await supabase.from("profiles").select("store_id").eq("id", user.id).single();
        
        const account = accountsPayable.find(acc => acc.id === accountId);
        if (account) {
          await supabase
            .from("financial_transactions")
            .insert({
              account_id: selectedAccountId,
              store_id: userStore.data?.store_id,
              transaction_type: "saida",
              amount: account.amount,
              transaction_date: paymentDate,
              description: `Pagamento - ${account.description}`,
              reference_type: "accounts_payable",
              reference_id: accountId,
              created_by: user.id,
            });
        }
      }

      toast({
        title: "Sucesso",
        description: "Pagamento registrado com sucesso",
      });

      // Reset form and refresh data
      setSelectedAccountId("");
      setPaymentDate("");
      fetchAccountsPayable();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contas a Pagar</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="view">Visualizar Contas</TabsTrigger>
            <TabsTrigger value="payment">Baixar Contas</TabsTrigger>
            <TabsTrigger value="create">Cadastrar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="view">
            <div className="space-y-4">
              {/* Filtros */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtros de Busca</CardTitle>
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
                            <TableCell>{account.suppliers?.name || '-'}</TableCell>
                            <TableCell>{new Date(account.due_date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>R$ {Number(account.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                account.status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {account.status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {account.payment_date 
                                ? new Date(account.payment_date).toLocaleDateString('pt-BR')
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditAccount(account)}
                                  disabled={loading}
                                  title="Editar conta"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                
                                {account.status === 'paid' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReversePayment(account.id)}
                                    disabled={loading}
                                    title="Estornar pagamento"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                ) : (
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

          <TabsContent value="payment">
            <div className="space-y-4">
              {/* Filtros da aba de pagamento */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtros de Busca</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="payment-filter-supplier">Fornecedor</Label>
                      <Select value={paymentFilterSupplier} onValueChange={setPaymentFilterSupplier}>
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
                      <Label htmlFor="payment-filter-store">Loja</Label>
                      <Select value={paymentFilterStore} onValueChange={setPaymentFilterStore}>
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
                      <Label htmlFor="payment-filter-document">Número Documento</Label>
                      <Input
                        id="payment-filter-document"
                        value={paymentFilterDocumentNumber}
                        onChange={(e) => setPaymentFilterDocumentNumber(e.target.value)}
                        placeholder="Digite o número do documento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-filter-due-date-from">Vencimento (De)</Label>
                      <Input
                        id="payment-filter-due-date-from"
                        type="date"
                        value={paymentFilterDueDateFrom}
                        onChange={(e) => setPaymentFilterDueDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-filter-due-date-to">Vencimento (Até)</Label>
                      <Input
                        id="payment-filter-due-date-to"
                        type="date"
                        value={paymentFilterDueDateTo}
                        onChange={(e) => setPaymentFilterDueDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={fetchFilteredPaymentAccounts}>
                      Aplicar Filtros
                    </Button>
                    <Button variant="outline" onClick={clearPaymentFilters}>
                      Limpar Filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Baixar Contas a Pagar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Conta Corrente *</Label>
                      <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} - {account.bank} ({account.account_number})
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
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountsPayable.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.description}</TableCell>
                          <TableCell>{account.suppliers?.name || '-'}</TableCell>
                          <TableCell>{new Date(account.due_date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>R$ {Number(account.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                              Pendente
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handlePayment(account.id)}
                              disabled={loading || !selectedAccountId || !paymentDate}
                            >
                              {loading ? "Processando..." : "Baixar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {accountsPayable.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {paymentShowFilteredData 
                              ? "Nenhuma conta pendente encontrada com os filtros aplicados"
                              : "Use os filtros acima para buscar contas pendentes"
                            }
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Fornecedor *</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name} {supplier.cnpj_cpf && `(${supplier.cnpj_cpf})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="documentType">Tipo do Documento *</Label>
                      <Select value={documentType} onValueChange={setDocumentType}>
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

                    <div className="space-y-2">
                      <Label htmlFor="documentNumber">Número do Documento *</Label>
                      <Input
                        id="documentNumber"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        placeholder="Ex: 12345"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="issueDate">Data de Emissão *</Label>
                      <Input
                        id="issueDate"
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Data de Vencimento *</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
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
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Adicionar Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Produto</Label>
                          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.code ? `${product.code} - ` : ""}{product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Valor Unitário</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Loja</Label>
                          <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
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
                          Total do Item: R$ {(quantity * unitPrice).toFixed(2)}
                        </div>
                        <Button onClick={addItem}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="items" className="space-y-4">
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
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AccountsPayableModal;