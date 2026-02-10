import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Package, Check, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface AportesRetiradaParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Product {
  id: string;
  name: string;
  code: string | null;
}

export const AportesRetiradaParameterModal = ({ open, onOpenChange }: AportesRetiradaParameterModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedAporteProductId, setSelectedAporteProductId] = useState<string>("");
  const [selectedRetiradaProductId, setSelectedRetiradaProductId] = useState<string>("");
  const [currentAporteProductId, setCurrentAporteProductId] = useState<string>("");
  const [currentRetiradaProductId, setCurrentRetiradaProductId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { matrixId } = useUserMatrix();

  useEffect(() => {
    if (open) {
      fetchProducts();
      loadCurrentParameters();
    }
  }, [open]);

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

  const loadCurrentParameters = async () => {
    try {
      // Buscar parâmetro para Aporte
      const { data: aporteData } = await supabase
        .from('system_parameters')
        .select('product_id')
        .eq('parameter_key', 'aporte_socios')
        .maybeSingle();

      if (aporteData?.product_id) {
        setCurrentAporteProductId(aporteData.product_id);
        setSelectedAporteProductId(aporteData.product_id);
      } else {
        setCurrentAporteProductId("");
        setSelectedAporteProductId("");
      }

      // Buscar parâmetro para Retirada
      const { data: retiradaData } = await supabase
        .from('system_parameters')
        .select('product_id')
        .eq('parameter_key', 'retirada_socios')
        .maybeSingle();

      if (retiradaData?.product_id) {
        setCurrentRetiradaProductId(retiradaData.product_id);
        setSelectedRetiradaProductId(retiradaData.product_id);
      } else {
        setCurrentRetiradaProductId("");
        setSelectedRetiradaProductId("");
      }
    } catch (error) {
      console.error('Erro ao carregar parâmetros atuais:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração atual",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!matrixId) {
      toast({
        title: "Erro",
        description: "Matriz não identificada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Salvar parâmetro para Aporte
      if (selectedAporteProductId) {
        const { data: existingAporte } = await supabase
          .from('system_parameters')
          .select('id')
          .eq('parameter_key', 'aporte_socios')
          .maybeSingle();

        if (existingAporte) {
          await supabase
            .from('system_parameters')
            .update({ product_id: selectedAporteProductId })
            .eq('id', existingAporte.id);
        } else {
          await supabase
            .from('system_parameters')
            .insert({
              parameter_key: 'aporte_socios',
              product_id: selectedAporteProductId,
              matrix_id: matrixId
            });
        }
      }

      // Salvar parâmetro para Retirada
      if (selectedRetiradaProductId) {
        const { data: existingRetirada } = await supabase
          .from('system_parameters')
          .select('id')
          .eq('parameter_key', 'retirada_socios')
          .maybeSingle();

        if (existingRetirada) {
          await supabase
            .from('system_parameters')
            .update({ product_id: selectedRetiradaProductId })
            .eq('id', existingRetirada.id);
        } else {
          await supabase
            .from('system_parameters')
            .insert({
              parameter_key: 'retirada_socios',
              product_id: selectedRetiradaProductId,
              matrix_id: matrixId
            });
        }
      }
      
      toast({
        title: "Sucesso",
        description: "Parâmetros de aportes e retiradas configurados com sucesso!",
      });

      setCurrentAporteProductId(selectedAporteProductId);
      setCurrentRetiradaProductId(selectedRetiradaProductId);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar parâmetros:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar parâmetros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async (type: 'aporte' | 'retirada') => {
    setLoading(true);
    try {
      const paramKey = type === 'aporte' ? 'aporte_socios' : 'retirada_socios';
      
      await supabase
        .from('system_parameters')
        .delete()
        .eq('parameter_key', paramKey);

      if (type === 'aporte') {
        setSelectedAporteProductId("");
        setCurrentAporteProductId("");
      } else {
        setSelectedRetiradaProductId("");
        setCurrentRetiradaProductId("");
      }
      
      toast({
        title: "Parâmetro limpo",
        description: `Parâmetro de ${type === 'aporte' ? 'Aporte' : 'Retirada'} foi removido`,
      });
    } catch (error) {
      console.error('Erro ao limpar parâmetro:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar parâmetro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentAporteProduct = products.find(p => p.id === currentAporteProductId);
  const currentRetiradaProduct = products.find(p => p.id === currentRetiradaProductId);
  const selectedAporteProduct = products.find(p => p.id === selectedAporteProductId);
  const selectedRetiradaProduct = products.find(p => p.id === selectedRetiradaProductId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-600" />
            Configurar Aportes e Retiradas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Card */}
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
                  <Badge className="bg-orange-500">APORTES E RETIRADAS</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Descrição:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure produtos distintos para aportes (entradas de capital dos sócios) e retiradas (saídas de capital para sócios).
                    Esses produtos serão usados para classificação no DRE e relatórios financeiros.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aporte Section */}
          <Card className="border-green-200">
            <CardHeader className="pb-3 bg-green-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2 text-green-700">
                <ArrowUpCircle className="h-4 w-4" />
                Aporte (Entrada de Capital)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {currentAporteProduct && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">Configuração Atual</p>
                        <p className="text-sm">{currentAporteProduct.name}</p>
                        {currentAporteProduct.code && (
                          <p className="text-xs text-muted-foreground">Código: {currentAporteProduct.code}</p>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleClear('aporte')} disabled={loading}>
                      Limpar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Selecionar Produto para Aporte</Label>
                <Select value={selectedAporteProductId} onValueChange={setSelectedAporteProductId}>
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
                {selectedAporteProduct && selectedAporteProductId !== currentAporteProductId && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Novo: {selectedAporteProduct.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Retirada Section */}
          <Card className="border-red-200">
            <CardHeader className="pb-3 bg-red-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <ArrowDownCircle className="h-4 w-4" />
                Retirada (Saída de Capital)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {currentRetiradaProduct && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">Configuração Atual</p>
                        <p className="text-sm">{currentRetiradaProduct.name}</p>
                        {currentRetiradaProduct.code && (
                          <p className="text-xs text-muted-foreground">Código: {currentRetiradaProduct.code}</p>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleClear('retirada')} disabled={loading}>
                      Limpar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Selecionar Produto para Retirada</Label>
                <Select value={selectedRetiradaProductId} onValueChange={setSelectedRetiradaProductId}>
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
                {selectedRetiradaProduct && selectedRetiradaProductId !== currentRetiradaProductId && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Novo: {selectedRetiradaProduct.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={(!selectedAporteProductId && !selectedRetiradaProductId) || loading}
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
