import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Package, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: {
    id: string;
    name: string;
    description: string;
    type: 'acrescimo' | 'desconto';
  } | null;
}

interface Product {
  id: string;
  name: string;
  code: string | null;
}

export const ProductParameterModal = ({ open, onOpenChange, parameter }: ProductParameterModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentProductId, setCurrentProductId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && parameter) {
      fetchProducts();
      loadCurrentParameter();
    }
  }, [open, parameter]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive",
      });
    }
  };

  const loadCurrentParameter = async () => {
    if (!parameter) return;

    try {
      // Aqui você pode implementar a lógica para carregar o parâmetro atual
      // Por enquanto, vamos apenas resetar
      setCurrentProductId("");
      setSelectedProductId("");
    } catch (error) {
      console.error('Erro ao carregar parâmetro atual:', error);
    }
  };

  const handleSave = async () => {
    if (!parameter || !selectedProductId) {
      toast({
        title: "Erro",
        description: "Selecione um produto para continuar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Aqui você implementará a lógica para salvar o parâmetro
      // Por enquanto vamos apenas simular o salvamento
      
      toast({
        title: "Sucesso",
        description: `Parâmetro ${parameter.name} configurado com sucesso!`,
      });

      setCurrentProductId(selectedProductId);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar parâmetro:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar parâmetro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedProductId("");
    setCurrentProductId("");
    toast({
      title: "Parâmetro limpo",
      description: `Parâmetro ${parameter?.name} foi removido`,
    });
  };

  if (!parameter) return null;

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const currentProduct = products.find(p => p.id === currentProductId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {parameter.type === 'acrescimo' ? (
              <ArrowUp className="h-5 w-5 text-green-600" />
            ) : (
              <ArrowDown className="h-5 w-5 text-red-600" />
            )}
            Configurar {parameter.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Parameter Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Informações do Parâmetro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tipo:</span>
                  <Badge variant={parameter.type === 'acrescimo' ? 'default' : 'destructive'}>
                    {parameter.type === 'acrescimo' ? 'ACRÉSCIMO' : 'DESCONTO'}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Descrição:</span>
                  <p className="text-sm text-muted-foreground mt-1">{parameter.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Configuration */}
          {currentProduct && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-700">
                  <Check className="h-4 w-4" />
                  Configuração Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{currentProduct.name}</p>
                    {currentProduct.code && (
                      <p className="text-sm text-muted-foreground">Código: {currentProduct.code}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Selection */}
          <div className="space-y-3">
            <Label htmlFor="product-select">Selecionar Produto</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      {product.code && (
                        <span className="text-xs text-muted-foreground">Código: {product.code}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">{selectedProduct.name}</p>
                      {selectedProduct.code && (
                        <p className="text-xs text-muted-foreground">Código: {selectedProduct.code}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={!selectedProductId || loading}
              className="flex-1"
            >
              {loading ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};