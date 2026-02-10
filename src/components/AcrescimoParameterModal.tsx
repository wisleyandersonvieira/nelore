import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Package, Check, FileText, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface AcrescimoParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Product {
  id: string;
  name: string;
  code: string | null;
}

export const AcrescimoParameterModal = ({ open, onOpenChange }: AcrescimoParameterModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPagarProductId, setSelectedPagarProductId] = useState<string>("");
  const [selectedReceberProductId, setSelectedReceberProductId] = useState<string>("");
  const [currentPagarProductId, setCurrentPagarProductId] = useState<string>("");
  const [currentReceberProductId, setCurrentReceberProductId] = useState<string>("");
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
      // Buscar parâmetro para Contas a Pagar
      const { data: pagarData } = await supabase
        .from('system_parameters')
        .select('product_id')
        .eq('parameter_key', 'acrescimo_pagar')
        .maybeSingle();

      if (pagarData?.product_id) {
        setCurrentPagarProductId(pagarData.product_id);
        setSelectedPagarProductId(pagarData.product_id);
      } else {
        // Fallback para o parâmetro antigo "acrescimo" se existir
        const { data: legacyData } = await supabase
          .from('system_parameters')
          .select('product_id')
          .eq('parameter_key', 'acrescimo')
          .maybeSingle();
        
        if (legacyData?.product_id) {
          setCurrentPagarProductId(legacyData.product_id);
          setSelectedPagarProductId(legacyData.product_id);
        } else {
          setCurrentPagarProductId("");
          setSelectedPagarProductId("");
        }
      }

      // Buscar parâmetro para Contas a Receber
      const { data: receberData } = await supabase
        .from('system_parameters')
        .select('product_id')
        .eq('parameter_key', 'acrescimo_receber')
        .maybeSingle();

      if (receberData?.product_id) {
        setCurrentReceberProductId(receberData.product_id);
        setSelectedReceberProductId(receberData.product_id);
      } else {
        setCurrentReceberProductId("");
        setSelectedReceberProductId("");
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
      // Salvar parâmetro para Contas a Pagar
      if (selectedPagarProductId) {
        const { data: existingPagar } = await supabase
          .from('system_parameters')
          .select('id')
          .eq('parameter_key', 'acrescimo_pagar')
          .maybeSingle();

        if (existingPagar) {
          await supabase
            .from('system_parameters')
            .update({ product_id: selectedPagarProductId })
            .eq('id', existingPagar.id);
        } else {
          await supabase
            .from('system_parameters')
            .insert({
              parameter_key: 'acrescimo_pagar',
              product_id: selectedPagarProductId,
              matrix_id: matrixId
            });
        }
      }

      // Salvar parâmetro para Contas a Receber
      if (selectedReceberProductId) {
        const { data: existingReceber } = await supabase
          .from('system_parameters')
          .select('id')
          .eq('parameter_key', 'acrescimo_receber')
          .maybeSingle();

        if (existingReceber) {
          await supabase
            .from('system_parameters')
            .update({ product_id: selectedReceberProductId })
            .eq('id', existingReceber.id);
        } else {
          await supabase
            .from('system_parameters')
            .insert({
              parameter_key: 'acrescimo_receber',
              product_id: selectedReceberProductId,
              matrix_id: matrixId
            });
        }
      }

      // Também manter o parâmetro "acrescimo" legado sincronizado com acrescimo_pagar
      if (selectedPagarProductId) {
        const { data: existingLegacy } = await supabase
          .from('system_parameters')
          .select('id')
          .eq('parameter_key', 'acrescimo')
          .maybeSingle();

        if (existingLegacy) {
          await supabase
            .from('system_parameters')
            .update({ product_id: selectedPagarProductId })
            .eq('id', existingLegacy.id);
        } else {
          await supabase
            .from('system_parameters')
            .insert({
              parameter_key: 'acrescimo',
              product_id: selectedPagarProductId,
              matrix_id: matrixId
            });
        }
      }
      
      toast({
        title: "Sucesso",
        description: "Parâmetros de acréscimos configurados com sucesso!",
      });

      setCurrentPagarProductId(selectedPagarProductId);
      setCurrentReceberProductId(selectedReceberProductId);
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

  const handleClear = async (type: 'pagar' | 'receber') => {
    setLoading(true);
    try {
      const paramKey = type === 'pagar' ? 'acrescimo_pagar' : 'acrescimo_receber';
      
      await supabase
        .from('system_parameters')
        .delete()
        .eq('parameter_key', paramKey);

      if (type === 'pagar') {
        setSelectedPagarProductId("");
        setCurrentPagarProductId("");
        // Também limpar o parâmetro legado
        await supabase
          .from('system_parameters')
          .delete()
          .eq('parameter_key', 'acrescimo');
      } else {
        setSelectedReceberProductId("");
        setCurrentReceberProductId("");
      }
      
      toast({
        title: "Parâmetro limpo",
        description: `Parâmetro de acréscimo para ${type === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber'} foi removido`,
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

  const currentPagarProduct = products.find(p => p.id === currentPagarProductId);
  const currentReceberProduct = products.find(p => p.id === currentReceberProductId);
  const selectedPagarProduct = products.find(p => p.id === selectedPagarProductId);
  const selectedReceberProduct = products.find(p => p.id === selectedReceberProductId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5 text-green-600" />
            Configurar Acréscimos
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
                  <Badge variant="default">ACRÉSCIMO</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Descrição:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure produtos distintos para acréscimos (juros) no Contas a Pagar e no Contas a Receber. 
                    Cada módulo terá seu próprio produto configurado para tratamento correto no DRE.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contas a Pagar Section */}
          <Card className="border-orange-200">
            <CardHeader className="pb-3 bg-orange-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                <FileText className="h-4 w-4" />
                Contas a Pagar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {currentPagarProduct && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">Configuração Atual</p>
                        <p className="text-sm">{currentPagarProduct.name}</p>
                        {currentPagarProduct.code && (
                          <p className="text-xs text-muted-foreground">Código: {currentPagarProduct.code}</p>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleClear('pagar')} disabled={loading}>
                      Limpar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Selecionar Produto para Contas a Pagar</Label>
                <Select value={selectedPagarProductId} onValueChange={setSelectedPagarProductId}>
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
                {selectedPagarProduct && selectedPagarProductId !== currentPagarProductId && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Novo: {selectedPagarProduct.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contas a Receber Section */}
          <Card className="border-blue-200">
            <CardHeader className="pb-3 bg-blue-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                <Receipt className="h-4 w-4" />
                Contas a Receber
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {currentReceberProduct && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">Configuração Atual</p>
                        <p className="text-sm">{currentReceberProduct.name}</p>
                        {currentReceberProduct.code && (
                          <p className="text-xs text-muted-foreground">Código: {currentReceberProduct.code}</p>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleClear('receber')} disabled={loading}>
                      Limpar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Selecionar Produto para Contas a Receber</Label>
                <Select value={selectedReceberProductId} onValueChange={setSelectedReceberProductId}>
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
                {selectedReceberProduct && selectedReceberProductId !== currentReceberProductId && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Novo: {selectedReceberProduct.name}</span>
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
              disabled={(!selectedPagarProductId && !selectedReceberProductId) || loading}
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
