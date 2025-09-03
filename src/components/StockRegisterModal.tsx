import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Snowflake, ShoppingCart, Package2 } from "lucide-react";

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
    }
  }, [open]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Buscar parâmetros configurados
      const { data: parameters, error: paramError } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id, account_groups!inner(name)')
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
    } finally {
      setLoading(false);
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

    stockSetter(prev => {
      const current = prev[productId] || { productId, quantity: 0, cost: 0, total: 0 };
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
          const stockItem = stock[product.id] || { productId: product.id, quantity: 0, cost: product.cost_price || 0, total: 0 };
          return (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.units_of_measure?.symbol || '-'}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={stockItem.cost || ''}
                  onChange={(e) => handleStockChange(category, product.id, 'cost', e.target.value)}
                  className="w-20"
                  disabled={mode === 'view'}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={stockItem.quantity || ''}
                  onChange={(e) => handleStockChange(category, product.id, 'quantity', e.target.value)}
                  className="w-20"
                  disabled={mode === 'view'}
                />
              </TableCell>
              <TableCell className="font-medium">
                R$ {stockItem.total.toFixed(2)}
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

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {mode !== 'view' && (
            <Button>
              {mode === 'create' ? 'Salvar Estoque' : 'Atualizar Estoque'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};