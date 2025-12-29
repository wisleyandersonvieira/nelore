import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2, Plus, Search, Upload, X, FileText, Eye, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SupplierSearchModal } from "./SupplierSearchModal";
import { ProductSearchModal } from "./ProductSearchModal";
import { CashPaymentModal } from "./CashPaymentModal";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";

interface AttachmentInfo {
  path: string;
  originalName: string;
}

interface ExpenseData {
  id: string;
  issue_date: string;
  supplier: string;
  description: string;
  amount: number;
  attachments: AttachmentInfo[];
}

interface LinkToAccountsPayableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseData | null;
  storeId: string;
  onLinkSuccess?: () => void;
  expenseType?: "caixa_geral" | "banco";
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

const documentTypes = [
  { value: "NF", label: "Nota Fiscal (NF)" },
  { value: "RC", label: "Recibo (RC)" },
  { value: "CT", label: "Contrato (CT)" },
  { value: "CF", label: "Cupom Fiscal (CF)" },
  { value: "FAT", label: "Fatura (FAT)" },
  { value: "HOL", label: "Holerite (HOL)" },
];

export function LinkToAccountsPayableModal({ 
  open, 
  onOpenChange, 
  expense, 
  storeId,
  onLinkSuccess,
  expenseType = "caixa_geral"
}: LinkToAccountsPayableModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form fields
  const [supplierId, setSupplierId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dataCompetencia, setDataCompetencia] = useState("");
  const [notes, setNotes] = useState("");
  const [defaultStore, setDefaultStore] = useState("");

  // Item form fields
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedStore, setSelectedStore] = useState("");

  // Search modals
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  // Payment confirmation and modal states
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdAccountPayable, setCreatedAccountPayable] = useState<{
    id: string;
    description: string;
    amount: number;
    due_date: string;
    store_id: string;
    suppliers?: { name: string };
    attachments?: any[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchProducts();
      fetchStores();
      
      // Pre-fill form with expense data
      if (expense) {
        setIssueDate(expense.issue_date);
        setNotes(`Vinculado da despesa de caixa: ${expense.description}`);
        setDefaultStore(storeId);
        
        // Try to find supplier by name
        const findSupplierByName = async () => {
          const { data } = await supabase
            .from("suppliers")
            .select("id")
            .ilike("name", expense.supplier)
            .maybeSingle();
          
          if (data) {
            setSupplierId(data.id);
          }
          setSupplierSearchTerm(expense.supplier);
        };
        findSupplierByName();
      }
    } else {
      resetForm();
    }
  }, [open, expense, storeId]);

  const resetForm = () => {
    setSupplierId("");
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
    setSupplierSearchTerm("");
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
      // Verificar se é admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, store_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData?.role === 'admin') {
        // Admin vê todas as lojas
        const { data, error } = await supabase
          .from("stores")
          .select("id, name, code")
          .order("name");

        if (error) throw error;
        setStores(data || []);
      } else {
        // Não-admin: buscar lojas do user_stores + store_id do profile
        const { data: userStoresData, error: userStoresError } = await supabase
          .from("user_stores")
          .select("store_id")
          .eq("user_id", user.id);

        if (userStoresError) throw userStoresError;

        // Coletar todos os store_ids acessíveis
        const storeIds = new Set<string>();
        userStoresData?.forEach(us => storeIds.add(us.store_id));
        if (profileData?.store_id) {
          storeIds.add(profileData.store_id);
        }

        if (storeIds.size > 0) {
          const { data, error } = await supabase
            .from("stores")
            .select("id, name, code")
            .in("id", Array.from(storeIds))
            .order("name");

          if (error) throw error;
          setStores(data || []);
        } else {
          setStores([]);
        }
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const addItem = () => {
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
    
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    if (!defaultStore) {
      setSelectedStore("");
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  // Filtered products based on search term
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const searchLower = productSearchTerm.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(searchLower) ||
      (product.code && product.code.toLowerCase().includes(searchLower))
    );
  }, [products, productSearchTerm]);

  const selectedProductData = products.find(p => p.id === selectedProduct);

  const handleSupplierSelect = (supplier: Supplier) => {
    setSupplierId(supplier.id);
    setSupplierSearchTerm(supplier.name);
    setShowSupplierSearch(false);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product.id);
    setShowProductSearch(false);
  };

  const openAttachment = async (pathOrUrl: string) => {
    try {
      if (!pathOrUrl) {
        console.error("Path do anexo não encontrado");
        toast({
          title: "Erro",
          description: "Erro ao abrir anexo: caminho não encontrado",
          variant: "destructive",
        });
        return;
      }

      // Check if it's already a full URL (legacy data)
      if (pathOrUrl.startsWith('http')) {
        window.open(pathOrUrl, "_blank");
        return;
      }

      // Check if it's a PDF file
      const isPdf = pathOrUrl.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        // For PDFs, download the file and trigger download via hidden link
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("account-documents")
          .download(pathOrUrl);

        if (downloadError) {
          console.error("Erro ao baixar PDF:", downloadError, "Path:", pathOrUrl);
          toast({
            title: "Erro",
            description: "Erro ao abrir anexo PDF",
            variant: "destructive",
          });
          return;
        }

        // Create a blob URL and use a hidden link to open/download
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create a hidden link and click it to bypass popup blockers
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // Extract filename from path
        const fileName = pathOrUrl.split('/').pop() || 'documento.pdf';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } else {
        // For other file types, use signed URL
        const { data, error } = await supabase.storage
          .from("account-documents")
          .createSignedUrl(pathOrUrl, 3600);

        if (error) {
          console.error("Erro ao gerar URL:", error, "Path:", pathOrUrl);
          toast({
            title: "Erro",
            description: "Erro ao abrir anexo",
            variant: "destructive",
          });
          return;
        }

        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Erro ao abrir anexo:", error);
      toast({
        title: "Erro",
        description: "Erro ao abrir anexo",
        variant: "destructive",
      });
    }
  };

  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleSave = async () => {
    if (!supplierId || !documentType || !documentNumber || !issueDate || !dueDate || !dataCompetencia) {
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

    // Validate that total items amount equals expense amount
    const totalItemsAmount = getTotalAmount();
    const expenseAmount = expense?.amount || 0;
    
    if (Math.abs(totalItemsAmount - expenseAmount) > 0.01) {
      toast({
        title: "Erro de Validação",
        description: `O valor total dos itens (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalItemsAmount)}) deve ser igual ao valor da despesa (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expenseAmount)})`,
        variant: "destructive",
      });
      return;
    }

    // Validate period
    const competenceValidation = await validateAccountsPayablePeriod.competencia(dataCompetencia);
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Usuário não autenticado");

      const totalAmount = getTotalAmount();
      const storeToUse = items.length > 0 ? items[0].store_id : storeId;

      // Create the account payable
      const { data: payable, error: payableError } = await supabase
        .from("accounts_payable")
        .insert({
          store_id: storeToUse,
          supplier_id: supplierId,
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
          attachments: []
        })
        .select()
        .single();

      if (payableError) throw payableError;
      if (!payable) throw new Error("Falha ao criar conta a pagar");

      // Copy attachments from expense to accounts payable
      if (expense?.attachments && expense.attachments.length > 0) {
        const copiedAttachments: Array<{name: string, path: string, size: number}> = [];
        
        for (const att of expense.attachments) {
          try {
            // Download the file from the original location
            const { data: fileData, error: downloadError } = await supabase.storage
              .from("account-documents")
              .download(att.path);
            
            if (downloadError) {
              console.error("Error downloading attachment:", downloadError);
              continue;
            }

            // Upload to new location for accounts payable with storeId as first segment for RLS compliance
            const newFileName = `${storeId}/${payable.id}/${Date.now()}_${sanitizeFileName(att.originalName)}`;
            
            const { error: uploadError } = await supabase.storage
              .from("account-documents")
              .upload(newFileName, fileData);

            if (uploadError) {
              console.error("Error uploading attachment:", uploadError);
              continue;
            }

            copiedAttachments.push({
              name: att.originalName,
              path: newFileName,
              size: fileData.size
            });
          } catch (error) {
            console.error("Error copying attachment:", error);
          }
        }

        if (copiedAttachments.length > 0) {
          await supabase
            .from("accounts_payable")
            .update({ attachments: copiedAttachments })
            .eq("id", payable.id);
        }
      }

      // Insert items
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

      // Update cash_control_expenses to mark as linked and update supplier name
      if (expense?.id) {
        const selectedSupplierData = suppliers.find(s => s.id === supplierId);
        
        // Get user name for history
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        
        const userName = profile?.name || user.email || "Usuário";
        
        // Fetch current edit_history
        const { data: currentExpense } = await supabase
          .from("cash_control_expenses")
          .select("edit_history")
          .eq("id", expense.id)
          .single();
        
        const currentHistory = (currentExpense?.edit_history as Array<{ edited_at: string; edited_by_name: string }>) || [];
        const newHistory = [
          ...currentHistory,
          { edited_at: new Date().toISOString(), edited_by_name: `${userName} (vinculou ao contas a pagar)` }
        ];
        
        const { error: updateError } = await supabase
          .from("cash_control_expenses")
          .update({ 
            linked_account_payable_id: payable.id,
            supplier: selectedSupplierData?.name || expense.supplier,
            edit_history: newHistory
          })
          .eq("id", expense.id);

        if (updateError) {
          console.error("Error updating expense link:", updateError);
        }
      }

      toast({
        title: "Sucesso",
        description: "Conta a pagar criada e vinculada com sucesso",
      });

      // Buscar os dados atualizados da conta a pagar (incluindo anexos copiados)
      const { data: updatedPayable } = await supabase
        .from("accounts_payable")
        .select("attachments")
        .eq("id", payable.id)
        .single();

      // Store the created account payable for potential payment (with attachments)
      const selectedSupplierData = suppliers.find(s => s.id === supplierId);
      setCreatedAccountPayable({
        id: payable.id,
        description: `${documentType} ${documentNumber}`,
        amount: totalAmount,
        due_date: dueDate,
        store_id: storeToUse,
        suppliers: selectedSupplierData ? { name: selectedSupplierData.name } : undefined,
        attachments: Array.isArray(updatedPayable?.attachments) ? updatedPayable.attachments : []
      });

      // Close the main modal and show payment confirmation
      onOpenChange(false);
      setShowPaymentConfirmation(true);

    } catch (error) {
      console.error("Error saving account payable:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar conta a pagar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmationYes = () => {
    setShowPaymentConfirmation(false);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirmationNo = () => {
    setShowPaymentConfirmation(false);
    resetForm();
    onLinkSuccess?.();
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setCreatedAccountPayable(null);
    resetForm();
    onLinkSuccess?.();
  };

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const storeName = stores.find(s => s.id === storeId)?.name || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Despesa ao Contas a Pagar</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Expense Info */}
            {expense && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Dados da Despesa de Caixa</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fornecedor:</span>
                    <p className="font-medium">{expense.supplier}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Descrição:</span>
                    <p className="font-medium">{expense.description}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <p className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loja:</span>
                    <p className="font-medium">{storeName}</p>
                  </div>
                </div>
                
                {expense.attachments.length > 0 && (
                  <div className="mt-3">
                    <span className="text-muted-foreground text-sm">Anexos que serão copiados:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {expense.attachments.map((att, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 bg-background px-2 py-1 rounded text-xs"
                        >
                          <FileText className="h-3 w-3" />
                          <span>{att.originalName}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => openAttachment(att.path)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="supplier">Fornecedor *</Label>
                <div className="flex gap-2">
                  <Input
                    id="supplier"
                    value={selectedSupplier?.name || supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    placeholder="Buscar fornecedor..."
                    readOnly
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowSupplierSearch(true)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="documentType">Tipo de Documento *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="documentNumber">Nº Documento *</Label>
                <Input
                  id="documentNumber"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Número do documento"
                />
              </div>

              <div>
                <Label htmlFor="issueDate">Data de Emissão *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dueDate">Data de Vencimento *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dataCompetencia">Data de Competência *</Label>
                <Input
                  id="dataCompetencia"
                  type="date"
                  value={dataCompetencia}
                  onChange={(e) => setDataCompetencia(e.target.value)}
                />
              </div>
            </div>

            {/* Default Store */}
            <div>
              <Label>Loja Padrão para Itens</Label>
              <Select value={defaultStore} onValueChange={setDefaultStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja padrão..." />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Itens</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <div className="md:col-span-2">
                  <Label>Produto</Label>
                  <div className="flex gap-2">
                    <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedProductData
                            ? `${selectedProductData.code ? `${selectedProductData.code} - ` : ''}${selectedProductData.name}`
                            : "Digite para buscar..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Buscar produto..." 
                            value={productSearchTerm}
                            onValueChange={setProductSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.slice(0, 50).map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.id}
                                  onSelect={() => {
                                    setSelectedProduct(product.id);
                                    setProductSearchOpen(false);
                                    setProductSearchTerm("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProduct === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {product.code ? `${product.code} - ` : ''}{product.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setShowProductSearch(true)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div>
                  <Label>Valor Unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={addItem} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.store_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_price)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="font-semibold text-right">
                        Total:
                      </TableCell>
                      <TableCell className="font-semibold text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getTotalAmount())}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar Conta a Pagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierSearchModal
        open={showSupplierSearch}
        onOpenChange={setShowSupplierSearch}
        onSelectSupplier={handleSupplierSelect}
      />

      <ProductSearchModal
        open={showProductSearch}
        onOpenChange={setShowProductSearch}
        onSelectProduct={handleProductSelect}
      />

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={showPaymentConfirmation} onOpenChange={setShowPaymentConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Realizar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              A conta a pagar foi criada com sucesso. Deseja realizar o pagamento dessa conta agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePaymentConfirmationNo}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePaymentConfirmationYes}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cash Payment Modal */}
      <CashPaymentModal
        open={showPaymentModal}
        onOpenChange={(open) => {
          setShowPaymentModal(open);
          if (!open) {
            setCreatedAccountPayable(null);
            resetForm();
            onLinkSuccess?.();
          }
        }}
        accountPayable={createdAccountPayable}
        onPaymentSuccess={handlePaymentSuccess}
        showAllAccounts={expenseType === "banco"}
      />
    </>
  );
}
