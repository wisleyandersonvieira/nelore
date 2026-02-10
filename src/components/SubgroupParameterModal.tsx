import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Package, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface SubgroupParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: {
    id: string;
    name: string;
    description: string;
    type: 'sorvete' | 'mercadorias_diversas' | 'embalagens';
    category: 'subgroup';
  } | null;
}

interface Subgroup {
  id: string;
  name: string;
  parent_name?: string;
}

export const SubgroupParameterModal = ({ open, onOpenChange, parameter }: SubgroupParameterModalProps) => {
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string>("");
  const [currentSubgroupId, setCurrentSubgroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { matrixId } = useUserMatrix();

  useEffect(() => {
    if (open && parameter && matrixId) {
      fetchSubgroups();
      loadCurrentParameter();
    }
  }, [open, parameter, matrixId]);

  const fetchSubgroups = async () => {
    if (!matrixId) return;

    try {
      // First get the brand_id from the matrix
      const { data: matrixData } = await supabase
        .from('matrices')
        .select('brand_id')
        .eq('id', matrixId)
        .single();

      if (!matrixData?.brand_id) {
        toast({
          title: "Erro",
          description: "Matriz não possui marca vinculada",
          variant: "destructive",
        });
        return;
      }

      // Buscar subgrupos (itens com parent_id) filtered by brand
      const { data: subgroupsData, error } = await supabase
        .from('account_groups')
        .select('id, name, parent_id')
        .not('parent_id', 'is', null)
        .eq('brand_id', matrixData.brand_id)
        .order('name');

      if (error) throw error;

      // Buscar informações dos grupos pais
      if (subgroupsData && subgroupsData.length > 0) {
        const parentIds = [...new Set(subgroupsData.map(s => s.parent_id))];
        const { data: parentsData } = await supabase
          .from('account_groups')
          .select('id, name')
          .in('id', parentIds);

        const formattedSubgroups = subgroupsData.map(item => ({
          id: item.id,
          name: item.name,
          parent_name: parentsData?.find(p => p.id === item.parent_id)?.name
        }));

        setSubgroups(formattedSubgroups);
      } else {
        setSubgroups([]);
      }
    } catch (error) {
      console.error('Erro ao carregar subgrupos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar subgrupos",
        variant: "destructive",
      });
    }
  };

  const loadCurrentParameter = async () => {
    if (!parameter) return;

    try {
      const { data, error } = await supabase
        .from('system_parameters')
        .select('subgroup_id')
        .eq('parameter_key', parameter.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.subgroup_id) {
        setCurrentSubgroupId(data.subgroup_id);
        setSelectedSubgroupId(data.subgroup_id);
      } else {
        setCurrentSubgroupId("");
        setSelectedSubgroupId("");
      }
    } catch (error) {
      console.error('Erro ao carregar parâmetro atual:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração atual",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!parameter || !selectedSubgroupId || !matrixId) {
      toast({
        title: "Erro",
        description: "Selecione um subgrupo para continuar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe um parâmetro configurado
      const { data: existing, error: checkError } = await supabase
        .from('system_parameters')
        .select('id')
        .eq('parameter_key', parameter.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Atualizar parâmetro existente
        const { error: updateError } = await supabase
          .from('system_parameters')
          .update({ subgroup_id: selectedSubgroupId })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Inserir novo parâmetro
        const { error: insertError } = await supabase
          .from('system_parameters')
          .insert({
            parameter_key: parameter.id,
            subgroup_id: selectedSubgroupId,
            matrix_id: matrixId
          });

        if (insertError) throw insertError;
      }
      
      toast({
        title: "Sucesso",
        description: `Parâmetro ${parameter.name} configurado com sucesso!`,
      });

      setCurrentSubgroupId(selectedSubgroupId);
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

  const handleClear = async () => {
    if (!parameter) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_parameters')
        .delete()
        .eq('parameter_key', parameter.id);

      if (error) throw error;

      setSelectedSubgroupId("");
      setCurrentSubgroupId("");
      
      toast({
        title: "Parâmetro limpo",
        description: `Parâmetro ${parameter.name} foi removido`,
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

  if (!parameter) return null;

  const selectedSubgroup = subgroups.find(s => s.id === selectedSubgroupId);
  const currentSubgroup = subgroups.find(s => s.id === currentSubgroupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
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
                  <Badge variant="default">
                    ESTOQUE - SUBGRUPO
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
          {currentSubgroup && (
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
                    <p className="font-medium">{currentSubgroup.name}</p>
                    {currentSubgroup.parent_name && (
                      <p className="text-sm text-muted-foreground">Grupo: {currentSubgroup.parent_name}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClear} disabled={loading}>
                    {loading ? "Limpando..." : "Limpar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subgroup Selection */}
          <div className="space-y-3">
            <Label htmlFor="subgroup-select">Selecionar Subgrupo</Label>
            <Select value={selectedSubgroupId} onValueChange={setSelectedSubgroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um subgrupo..." />
              </SelectTrigger>
              <SelectContent>
                {subgroups.map((subgroup) => (
                  <SelectItem key={subgroup.id} value={subgroup.id}>
                    <div className="flex flex-col">
                      <span>{subgroup.name}</span>
                      {subgroup.parent_name && (
                        <span className="text-xs text-muted-foreground">Grupo: {subgroup.parent_name}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSubgroup && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">{selectedSubgroup.name}</p>
                      {selectedSubgroup.parent_name && (
                        <p className="text-xs text-muted-foreground">Grupo: {selectedSubgroup.parent_name}</p>
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
              disabled={!selectedSubgroupId || loading}
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
