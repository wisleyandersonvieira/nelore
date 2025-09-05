import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Snowflake, ShoppingCart, Package2, Save, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface StockRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  storeId: string;
  mode: 'view' | 'edit' | 'create';
}

interface Product {
  id: string;
  name: string;
  code: string;
  cost_price: number | null;
  unit_id: string;
  units_of_measure?: {
    symbol: string;
  };
}

interface StockItem {
  productId: string;
  quantity: number;
  cost: number;
  total: number;
}

export const StockRegisterModal = ({ 
  open, 
  onOpenChange, 
  month, 
  year, 
  storeId, 
  mode 
}: StockRegisterModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stockControlId, setStockControlId] = useState<string | null>(null);
  const [sorveteProducts, setSorveteProducts] = useState<Product[]>([]);
  const [mercadoriasProducts, setMercadoriasProducts] = useState<Product[]>([]);
  const [embalagensProducts, setEmbalagensProducts] = useState<Product[]>([]);
  const [sorveteStock, setSorveteStock] = useState<Record<string, StockItem>>({});
  const [mercadoriasStock, setMercadoriasStock] = useState<Record<string, StockItem>>({});
  const [embalagensStock, setEmbalagensStock] = useState<Record<string, StockItem>>({});

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  useEffect(() => {
    if (open) {
      loadProducts();
      if (mode !== 'create') {
        loadExistingStock();
      }
    }
  }, [open, mode]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Buscar parâmetros configurados
      const { data: parameters, error: paramError } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id, account_groups!system_parameters_subgroup_id_fkey(name)')
        .in('parameter_key', ['sorvete', 'mercadorias_diversas', 'embalagens'])
        .not('subgroup_id', 'is', null);

      if (paramError) throw paramError;

      const sorveteSubgroup = parameters?.find(p => p.parameter_key === 'sorvete')?.subgroup_id;
      const mercadoriasSubgroup = parameters?.find(p => p.parameter_key === 'mercadorias_diversas')?.subgroup_id;
      const embalagensSubgroup = parameters?.find(p => p.parameter_key === 'embalagens')?.subgroup_id;

      // Buscar produtos por subgrupo
      if (sorveteSubgroup) {
        const { data: products, error } = await supabase
          .from('products')
          .select(`
            id, name, code, cost_price, unit_id,
            units_of_measure!inner(symbol)
          `)
          .eq('subgroup_id', sorveteSubgroup)
          .eq('is_active', true)
          .order('name');

        if (!error) setSorveteProducts(products || []);
      }

      if (mercadoriasSubgroup) {
        const { data: products, error } = await supabase
          .from('products')
          .select(`
            id, name, code, cost_price, unit_id,
            units_of_measure!inner(symbol)
          `)
          .eq('subgroup_id', mercadoriasSubgroup)
          .eq('is_active', true)
          .order('name');

        if (!error) setMercadoriasProducts(products || []);
      }

      if (embalagensSubgroup) {
        const { data: products, error } = await supabase
          .from('products')
          .select(`
            id, name, code, cost_price, unit_id,
            units_of_measure!inner(symbol)
          `)
          .eq('subgroup_id', embalagensSubgroup)
          .eq('is_active', true)
          .order('name');

        if (!error) setEmbalagensProducts(products || []);
      }

    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingStock = async () => {
    try {
      // Buscar controle de estoque existente
      const { data: stockControl, error: stockError } = await supabase
        .from('stock_control')
        .select('id, total_value, notes')
        .eq('store_id', storeId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (stockError) throw stockError;

      if (stockControl) {
        setStockControlId(stockControl.id);

        // Buscar itens do estoque
        const { data: stockItems, error: itemsError } = await supabase
          .from('stock_control_items')
          .select('product_id, category, quantity, unit_cost, total_cost')
          .eq('stock_control_id', stockControl.id);

        if (itemsError) throw itemsError;

        // Organizar itens por categoria
        const sorveteItems: Record<string, StockItem> = {};
        const mercadoriasItems: Record<string, StockItem> = {};
        const embalagensItems: Record<string, StockItem> = {};

        stockItems?.forEach((item) => {
          const stockItem = {
            productId: item.product_id,
            quantity: Number(item.quantity),
            cost: Number(item.unit_cost),
            total: Number(item.total_cost),
          };

          if (item.category === 'sorvete') {
            sorveteItems[item.product_id] = stockItem;
          } else if (item.category === 'mercadorias') {
            mercadoriasItems[item.product_id] = stockItem;
          } else if (item.category === 'embalagens') {
            embalagensItems[item.product_id] = stockItem;
          }
        });

        setSorveteStock(sorveteItems);
        setMercadoriasStock(mercadoriasItems);
        setEmbalagensStock(embalagensItems);
      }
    } catch (error) {
      console.error('Erro ao carregar estoque existente:', error);
      toast.error('Erro ao carregar dados do estoque');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const totalValue = calculateGrandTotal();
      
      let currentStockControlId = stockControlId;

      // Criar ou atualizar controle de estoque
      if (mode === 'create' || !currentStockControlId) {
        const { data: newStockControl, error: stockError } = await supabase
          .from('stock_control')
          .insert({
            store_id: storeId,
            month,
            year,
            created_by: user.id,
            total_value: totalValue,
          })
          .select('id')
          .single();

        if (stockError) throw stockError;
        currentStockControlId = newStockControl.id;
        setStockControlId(currentStockControlId);
      } else {
        const { error: updateError } = await supabase
          .from('stock_control')
          .update({ total_value: totalValue })
          .eq('id', currentStockControlId);

        if (updateError) throw updateError;
      }

      // Deletar itens existentes se estiver editando
      if (mode === 'edit' && currentStockControlId) {
        const { error: deleteError } = await supabase
          .from('stock_control_items')
          .delete()
          .eq('stock_control_id', currentStockControlId);

        if (deleteError) throw deleteError;
      }

      // Preparar itens para inserção
      const stockItems: any[] = [];

      // Adicionar itens de sorvete
      Object.values(sorveteStock).forEach((item) => {
        if (item.quantity > 0) {
          stockItems.push({
            stock_control_id: currentStockControlId,
            product_id: item.productId,
            category: 'sorvete',
            quantity: item.quantity,
            unit_cost: item.cost,
            total_cost: item.total,
          });
        }
      });

      // Adicionar itens de mercadorias
      Object.values(mercadoriasStock).forEach((item) => {
        if (item.quantity > 0) {
          stockItems.push({
            stock_control_id: currentStockControlId,
            product_id: item.productId,
            category: 'mercadorias',
            quantity: item.quantity,
            unit_cost: item.cost,
            total_cost: item.total,
          });
        }
      });

      // Adicionar itens de embalagens
      Object.values(embalagensStock).forEach((item) => {
        if (item.quantity > 0) {
          stockItems.push({
            stock_control_id: currentStockControlId,
            product_id: item.productId,
            category: 'embalagens',
            quantity: item.quantity,
            unit_cost: item.cost,
            total_cost: item.total,
          });
        }
      });

      // Inserir itens do estoque
      if (stockItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('stock_control_items')
          .insert(stockItems);

        if (itemsError) throw itemsError;
      }

      toast.success(
        mode === 'create' 
          ? 'Estoque cadastrado com sucesso!' 
          : 'Estoque atualizado com sucesso!'
      );
      
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar estoque:', error);
      toast.error('Erro ao salvar estoque. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      if (!stockControlId) {
        throw new Error('ID do controle de estoque não encontrado');
      }

      // Deletar todos os itens do estoque
      const { error: itemsError } = await supabase
        .from('stock_control_items')
        .delete()
        .eq('stock_control_id', stockControlId);

      if (itemsError) throw itemsError;

      // Deletar o controle de estoque
      const { error: stockError } = await supabase
        .from('stock_control')
        .delete()
        .eq('id', stockControlId);

      if (stockError) throw stockError;

      toast.success('Estoque excluído com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir estoque:', error);
      toast.error('Erro ao excluir estoque. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleStockChange = (
    category: 'sorvete' | 'mercadorias' | 'embalagens',
    productId: string,
    field: 'quantity' | 'cost',
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    const stockSetter = category === 'sorvete' ? setSorveteStock : 
                      category === 'mercadorias' ? setMercadoriasStock : 
                      setEmbalagensStock;
    
    const currentStock = category === 'sorvete' ? sorveteStock : 
                        category === 'mercadorias' ? mercadoriasStock : 
                        embalagensStock;

    // Buscar o produto para obter o custo padrão
    const productsList = category === 'sorvete' ? sorveteProducts : 
                        category === 'mercadorias' ? mercadoriasProducts : 
                        embalagensProducts;
    const product = productsList.find(p => p.id === productId);
    const defaultCost = product?.cost_price || 0;

    stockSetter(prev => {
      const current = prev[productId] || { 
        productId, 
        quantity: 0, 
        cost: defaultCost, 
        total: 0 
      };
      const updated = { ...current, [field]: numValue };
      updated.total = updated.quantity * updated.cost;
      return { ...prev, [productId]: updated };
    });
  };

  const calculateCategoryTotal = (stock: Record<string, StockItem>) => {
    return Object.values(stock).reduce((sum, item) => sum + item.total, 0);
  };

  const calculateGrandTotal = () => {
    return calculateCategoryTotal(sorveteStock) + 
           calculateCategoryTotal(mercadoriasStock) + 
           calculateCategoryTotal(embalagensStock);
  };

  const renderProductTable = (
    products: Product[], 
    stock: Record<string, StockItem>,
    category: 'sorvete' | 'mercadorias' | 'embalagens'
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Custo (R$)</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Total (R$)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          // Inicializar com custo do produto se não existir no estado
          const stockItem = stock[product.id] || { 
            productId: product.id, 
            quantity: 0, 
            cost: product.cost_price || 0, 
            total: 0 
          };
          
          // Garantir que o custo seja preservado se já foi inicializado
          const displayCost = stockItem.cost !== undefined ? stockItem.cost : (product.cost_price || 0);
          const displayQuantity = stockItem.quantity || 0;

          return (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.units_of_measure?.symbol || '-'}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={displayCost || ''}
                  onChange={(e) => handleStockChange(category, product.id, 'cost', e.target.value)}
                  className="w-20"
                  disabled={mode === 'view'}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={displayQuantity || ''}
                  onChange={(e) => handleStockChange(category, product.id, 'quantity', e.target.value)}
                  className="w-20"
                  disabled={mode === 'view'}
                />
              </TableCell>
              <TableCell className="font-medium">
                R$ {(displayQuantity * displayCost).toFixed(2)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {mode === 'create' ? 'Cadastrar' : mode === 'edit' ? 'Editar' : 'Visualizar'} Estoque - {monthNames[month]} {year}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sorvete" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sorvete" className="flex items-center gap-2">
              <Snowflake className="h-4 w-4" />
              Sorvete
            </TabsTrigger>
            <TabsTrigger value="mercadorias" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Mercadorias
            </TabsTrigger>
            <TabsTrigger value="embalagens" className="flex items-center gap-2">
              <Package2 className="h-4 w-4" />
              Embalagens
            </TabsTrigger>
            <TabsTrigger value="resumo" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Resumo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sorvete" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Produtos de Sorvete</h3>
              {sorveteProducts.length > 0 ? (
                <>
                  {renderProductTable(sorveteProducts, sorveteStock, 'sorvete')}
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      Total Sorvete: R$ {calculateCategoryTotal(sorveteStock).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Nenhum produto de sorvete encontrado. Configure o parâmetro "Sorvete" primeiro.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mercadorias" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Mercadorias Diversas</h3>
              {mercadoriasProducts.length > 0 ? (
                <>
                  {renderProductTable(mercadoriasProducts, mercadoriasStock, 'mercadorias')}
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      Total Mercadorias: R$ {calculateCategoryTotal(mercadoriasStock).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Nenhuma mercadoria encontrada. Configure o parâmetro "Mercadorias Diversas" primeiro.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="embalagens" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Embalagens</h3>
              {embalagensProducts.length > 0 ? (
                <>
                  {renderProductTable(embalagensProducts, embalagensStock, 'embalagens')}
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      Total Embalagens: R$ {calculateCategoryTotal(embalagensStock).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Nenhuma embalagem encontrada. Configure o parâmetro "Embalagens" primeiro.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="resumo" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="h-5 w-5 text-blue-500" />
                    Sorvete
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {calculateCategoryTotal(sorveteStock).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-green-500" />
                    Mercadorias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {calculateCategoryTotal(mercadoriasStock).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package2 className="h-5 w-5 text-purple-500" />
                    Embalagens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {calculateCategoryTotal(embalagensStock).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-xl">Total Geral do Estoque</CardTitle>
                <CardDescription>
                  Valor total do estoque em {monthNames[month]} {year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  R$ {calculateGrandTotal().toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
          <div>
            {mode === 'edit' && stockControlId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="flex items-center gap-2"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deleting ? 'Excluindo...' : 'Excluir Estoque'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o estoque de {monthNames[month]} {year}? 
                      Esta ação não pode ser desfeita e todos os dados serão perdidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmar Exclusão
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {mode !== 'view' && (
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving 
                  ? 'Salvando...' 
                  : mode === 'create' 
                    ? 'Salvar Estoque' 
                    : 'Atualizar Estoque'
                }
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};