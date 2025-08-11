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
import { Trash2, Plus } from "lucide-react";
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
  suppliers?: { name: string };
  stores?: { name: string };
  created_at: string;
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
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form fields
  const [supplierId, setSupplierId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
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
      if (activeTab === "view") {
        fetchAccountsPayable();
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
    if (!supplierId || !documentType || !documentNumber || !issueDate) {
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
      const userStore = await supabase.from("profiles").select("store_id").eq("id", user.id).single();

      // Insert accounts payable
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
          due_date: issueDate,
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

      // Reset form and switch to view
      setSupplierId("");
      setDocumentType("");
      setDocumentNumber("");
      setIssueDate("");
      setNotes("");
      setItems([]);
      setActiveTab("view");
      fetchAccountsPayable();

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
              <Card>
                <CardHeader>
                  <CardTitle>Contas a Pagar Cadastradas</CardTitle>
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
                        <TableHead>Tipo Doc.</TableHead>
                        <TableHead>Número Doc.</TableHead>
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
                              account.status === 'paid' ? 'bg-green-100 text-green-800' :
                              account.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {account.status === 'paid' ? 'Pago' :
                               account.status === 'pending' ? 'Pendente' : 'Vencido'}
                            </span>
                          </TableCell>
                          <TableCell>{account.document_type || '-'}</TableCell>
                          <TableCell>{account.document_number || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {accountsPayable.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Nenhuma conta a pagar encontrada
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