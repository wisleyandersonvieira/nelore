import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface EstoqueParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Subgroup {
  id: string;
  name: string;
  parent_name?: string;
}

const ESTOQUE_PARAMETERS = [
  { key: 'sorvete', label: 'Insumos Reprodutivos' },
  { key: 'mercadorias_diversas', label: 'Medicamentos e prod. veterinários' },
  { key: 'embalagens', label: 'Nutrição' },
  { key: 'materiais_manejo', label: 'Materiais de Manejo' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'estoque_operacional', label: 'Estoque Operacional' },
];

export const EstoqueParameterModal = ({ open, onOpenChange }: EstoqueParameterModalProps) => {
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [config, setConfig] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const { matrixId } = useUserMatrix();

  useEffect(() => {
    if (open && matrixId) {
      fetchSubgroups();
      loadCurrentConfig();
    }
  }, [open, matrixId]);

  const fetchSubgroups = async () => {
    if (!matrixId) return;

    try {
      const { data: matrixData } = await supabase
        .from('matrices')
        .select('brand_id')
        .eq('id', matrixId)
        .single();

      if (!matrixData?.brand_id) {
        toast.error("Matriz não possui marca vinculada");
        return;
      }

      const result = await supabase
        .from('account_groups')
        .select(`id, name, parent_id, account_groups!parent_id(name)`)
        .not('parent_id', 'is', null)
        .eq('brand_id', matrixData.brand_id)
        .order('name');

      if (result.error) throw result.error;

      if (result.data) {
        const subgroupsData: Subgroup[] = result.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          parent_name: item.account_groups?.name || 'Subgrupo'
        }));
        setSubgroups(subgroupsData);
      }
    } catch (error) {
      console.error('Erro ao buscar subgrupos:', error);
      toast.error('Erro ao carregar subgrupos');
    }
  };

  const loadCurrentConfig = async () => {
    try {
      const paramKeys = ESTOQUE_PARAMETERS.map(p => p.key);
      const { data } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id')
        .in('parameter_key', paramKeys)
        .not('subgroup_id', 'is', null);

      const currentConfig: Record<string, string[]> = {};
      data?.forEach(param => {
        if (param.subgroup_id) {
          if (!currentConfig[param.parameter_key]) {
            currentConfig[param.parameter_key] = [];
          }
          currentConfig[param.parameter_key].push(param.subgroup_id);
        }
      });

      setConfig(currentConfig);
    } catch (error) {
      console.error('Erro ao carregar configuração atual:', error);
      toast.error('Erro ao carregar configuração');
    }
  };

  const toggleSubgroup = (paramKey: string, subgroupId: string) => {
    setConfig(prev => {
      const current = prev[paramKey] || [];
      const isSelected = current.includes(subgroupId);
      return {
        ...prev,
        [paramKey]: isSelected
          ? current.filter(id => id !== subgroupId)
          : [...current, subgroupId]
      };
    });
  };

  const handleSave = async () => {
    if (!matrixId) return;

    setLoading(true);
    try {
      const paramKeys = ESTOQUE_PARAMETERS.map(p => p.key);

      // Remove all existing
      await supabase
        .from('system_parameters')
        .delete()
        .in('parameter_key', paramKeys);

      // Insert new config
      const inserts: { parameter_key: string; subgroup_id: string; matrix_id: string }[] = [];
      for (const paramKey of paramKeys) {
        const selectedIds = config[paramKey] || [];
        for (const subgroupId of selectedIds) {
          inserts.push({
            parameter_key: paramKey,
            subgroup_id: subgroupId,
            matrix_id: matrixId,
          });
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('system_parameters').insert(inserts);
        if (error) throw error;
      }

      toast.success('Configuração de estoque salva com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      const paramKeys = ESTOQUE_PARAMETERS.map(p => p.key);
      await supabase
        .from('system_parameters')
        .delete()
        .in('parameter_key', paramKeys);

      setConfig({});
      toast.success('Configuração limpa com sucesso!');
    } catch (error) {
      console.error('Erro ao limpar configuração:', error);
      toast.error('Erro ao limpar configuração');
    } finally {
      setLoading(false);
    }
  };

  const getSubgroupName = (id: string) => subgroups.find(s => s.id === id)?.name || '';

  const hasAnyConfig = Object.values(config).some(arr => arr.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Configurar Parâmetro - Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Informações do Parâmetro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Categoria:</span>
                  <Badge variant="secondary">ESTOQUE</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure quais subgrupos estarão vinculados a cada tipo de estoque. Cada parâmetro permite selecionar múltiplos subgrupos.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Current config summary */}
          {hasAnyConfig && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configuração Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ESTOQUE_PARAMETERS.map(param => {
                    const selected = config[param.key] || [];
                    if (selected.length === 0) return null;
                    return (
                      <div key={param.key}>
                        <span className="text-sm font-medium">{param.label}:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selected.map(id => (
                            <Badge key={id} variant="outline" className="text-xs">
                              {getSubgroupName(id)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parameter config sections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurar Subgrupos por Tipo</CardTitle>
              <CardDescription>
                Marque os subgrupos que deseja vincular a cada tipo de estoque.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {ESTOQUE_PARAMETERS.map(param => (
                <div key={param.key} className="space-y-2">
                  <Label className="text-sm font-semibold">{param.label}</Label>
                  {/* Selected badges */}
                  {(config[param.key] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(config[param.key] || []).map(id => (
                        <Badge
                          key={id}
                          variant="default"
                          className="text-xs cursor-pointer gap-1"
                          onClick={() => toggleSubgroup(param.key, id)}
                        >
                          {getSubgroupName(id)}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {subgroups.map(subgroup => {
                      const isChecked = (config[param.key] || []).includes(subgroup.id);
                      return (
                        <div key={subgroup.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${param.key}-${subgroup.id}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleSubgroup(param.key, subgroup.id)}
                          />
                          <label
                            htmlFor={`${param.key}-${subgroup.id}`}
                            className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {subgroup.name}
                            {subgroup.parent_name && (
                              <span className="text-xs text-muted-foreground ml-1">({subgroup.parent_name})</span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                    {subgroups.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-2">
                        Nenhum subgrupo disponível
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {hasAnyConfig && (
            <Button variant="destructive" onClick={handleClear} disabled={loading}>
              Limpar Tudo
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
