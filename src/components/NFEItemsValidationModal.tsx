import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Edit2, Save, X } from "lucide-react";

interface NFEItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  product_id?: string;
  product_name?: string;
  store_id?: string;
  store_name?: string;
  found?: boolean;
}

interface Store {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
}

interface NFEItemsValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeItems: NFEItem[];
  stores: Store[];
  supplierId: string;
  onItemsValidated: (validatedItems: any[]) => void;
}

export const NFEItemsValidationModal = ({
  open,
  onOpenChange,
  nfeItems,
  stores,
  supplierId,
  onItemsValidated
}: NFEItemsValidationModalProps) => {
  const [items, setItems] = useState<NFEItem[]>([]);
  const [globalStoreId, setGlobalStoreId] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<NFEItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && nfeItems.length > 0) {
      setItems([...nfeItems]);
    }
  }, [open, nfeItems]);

  const handleGlobalStoreChange = (storeId: string) => {
    setGlobalStoreId(storeId);
    const store = stores.find(s => s.id === storeId);
    if (store) {
      const updatedItems = items.map(item => ({
        ...item,
        store_id: storeId,
        store_name: store.name
      }));
      setItems(updatedItems);
    }
  };

  const handleEditItem = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...items[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingItem) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = { ...editingItem };
      setItems(updatedItems);
      setEditingIndex(null);
      setEditingItem(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  const handleItemStoreChange = (index: number, storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      const updatedItems = [...items];
      updatedItems[index] = {
        ...updatedItems[index],
        store_id: storeId,
        store_name: store.name
      };
      setItems(updatedItems);
    }
  };

  const adjustItemValue = (index: number, newValue: number) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      valor_total: newValue
    };
    setItems(updatedItems);
  };

  const getTotalValue = () => {
    return items.reduce((sum, item) => sum + item.valor_total, 0);
  };

  const getFoundItemsCount = () => {
    return items.filter(item => item.found).length;
  };

  const handleConfirm = () => {
    // Verificar se todos os itens têm loja selecionada
    const itemsWithoutStore = items.filter(item => !item.store_id);
    if (itemsWithoutStore.length > 0) {
      toast({
        title: "Erro",
        description: "Todos os itens devem ter uma loja selecionada",
        variant: "destructive",
      });
      return;
    }

    // Converter para formato esperado pelo componente pai
    const validatedItems = items.map(item => ({
      product_id: item.product_id || "",
      product_name: item.product_name || item.descricao,
      quantity: item.quantidade,
      unit_price: item.valor_unitario,
      total_price: item.valor_total,
      store_id: item.store_id,
      store_name: item.store_name,
      supplier_code: item.codigo // Manter código do fornecedor para referência
    }));

    onItemsValidated(validatedItems);
    onOpenChange(false);

    toast({
      title: "Sucesso",
      description: `${items.length} itens validados e importados da NFE`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Validação de Itens da NFE
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da Importação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{items.length}</div>
                  <div className="text-sm text-muted-foreground">Total de Itens</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{getFoundItemsCount()}</div>
                  <div className="text-sm text-muted-foreground">Produtos Encontrados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{items.length - getFoundItemsCount()}</div>
                  <div className="text-sm text-muted-foreground">Não Encontrados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">R$ {getTotalValue().toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Valor Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração Global */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuração Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Aplicar Loja para Todos os Itens</Label>
                  <Select value={globalStoreId} onValueChange={handleGlobalStoreChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma loja" />
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
            </CardContent>
          </Card>

          {/* Lista de Itens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Itens da NFE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Vlr Unit.</TableHead>
                      <TableHead>Vlr Total</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {item.found ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              value={editingItem?.descricao || ""}
                              onChange={(e) => setEditingItem(prev => prev ? {...prev, descricao: e.target.value} : null)}
                              className="min-w-[200px]"
                            />
                          ) : (
                            <div>
                              <div className="font-medium">{item.product_name || item.descricao}</div>
                              {item.found && item.product_name && (
                                <div className="text-xs text-green-600">✓ Produto cadastrado</div>
                              )}
                              {!item.found && (
                                <div className="text-xs text-orange-600">⚠ Código não encontrado</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem?.quantidade || 0}
                              onChange={(e) => setEditingItem(prev => prev ? {...prev, quantidade: Number(e.target.value)} : null)}
                              className="w-20"
                            />
                          ) : (
                            item.quantidade
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem?.valor_unitario || 0}
                              onChange={(e) => setEditingItem(prev => prev ? {...prev, valor_unitario: Number(e.target.value)} : null)}
                              className="w-24"
                            />
                          ) : (
                            `R$ ${item.valor_unitario.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItem?.valor_total || 0}
                              onChange={(e) => setEditingItem(prev => prev ? {...prev, valor_total: Number(e.target.value)} : null)}
                              className="w-24"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>R$ {item.valor_total.toFixed(2)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newValue = prompt("Ajustar valor total:", item.valor_total.toString());
                                  if (newValue) {
                                    adjustItemValue(index, parseFloat(newValue));
                                  }
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.store_id || ""}
                            onValueChange={(value) => handleItemStoreChange(index, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(index)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
              Confirmar e Importar Itens
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};