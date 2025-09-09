import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FaturamentoParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: {
    id: string;
    name: string;
    description: string;
    type: 'faturamento';
    category: 'faturamento';
  } | null;
}

interface Subgroup {
  id: string;
  name: string;
  parent_name?: string;
}

interface FaturamentoConfig {
  venda_dinheiro?: string;
  venda_cartao?: string;
  venda_contas?: string;
  venda_delivery?: string;
}

export const FaturamentoParameterModal = ({ open, onOpenChange, parameter }: FaturamentoParameterModalProps) => {
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [config, setConfig] = useState<FaturamentoConfig>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && parameter) {
      fetchSubgroups();
      loadCurrentConfig();
    }
  }, [open, parameter]);

  const fetchSubgroups = async () => {
    try {
      const result = await supabase
        .from('account_groups')
        .select(`
          id, 
          name, 
          parent_id,
          account_groups!parent_id(name)
        `)
        .not('parent_id', 'is', null)
        .order('name');

      if (result.error) {
        throw result.error;
      }

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
    if (!parameter) return;

    try {
      const { data } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id')
        .in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery']);

      const currentConfig: FaturamentoConfig = {};
      data?.forEach(param => {
        const key = param.parameter_key as keyof FaturamentoConfig;
        if (param.subgroup_id) {
          currentConfig[key] = param.subgroup_id;
        }
      });

      setConfig(currentConfig);
    } catch (error) {
      console.error('Erro ao carregar configuração atual:', error);
      toast.error('Erro ao carregar configuração');
    }
  };

  const handleSave = async () => {
    if (!parameter) return;

    setLoading(true);
    try {
      // Remover configurações existentes
      await supabase
        .from('system_parameters')
        .delete()
        .in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery']);

      // Inserir novas configurações
      const inserts = [];
      if (config.venda_dinheiro) {
        inserts.push({
          parameter_key: 'venda_dinheiro',
          subgroup_id: config.venda_dinheiro
        });
      }
      if (config.venda_cartao) {
        inserts.push({
          parameter_key: 'venda_cartao',
          subgroup_id: config.venda_cartao
        });
      }
      if (config.venda_contas) {
        inserts.push({
          parameter_key: 'venda_contas',
          subgroup_id: config.venda_contas
        });
      }
      if (config.venda_delivery) {
        inserts.push({
          parameter_key: 'venda_delivery',
          subgroup_id: config.venda_delivery
        });
      }

      if (inserts.length > 0) {
        await supabase.from('system_parameters').insert(inserts);
      }

      toast.success('Configuração de faturamento salva com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!parameter) return;

    setLoading(true);
    try {
      await supabase
        .from('system_parameters')
        .delete()
        .in('parameter_key', ['venda_dinheiro', 'venda_cartao', 'venda_contas', 'venda_delivery']);

      setConfig({});
      toast.success('Configuração limpa com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao limpar configuração:', error);
      toast.error('Erro ao limpar configuração');
    } finally {
      setLoading(false);
    }
  };

  if (!parameter) return null;

  const getSubgroupName = (subgroupId: string) => {
    const subgroup = subgroups.find(s => s.id === subgroupId);
    return subgroup ? subgroup.name : '';
  };

  const hasCurrentConfig = config.venda_dinheiro || config.venda_cartao || config.venda_contas || config.venda_delivery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurar Parâmetro - {parameter.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Parâmetro */}
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
                  <span className="font-medium">Nome:</span>
                  <span>{parameter.name}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="font-medium">Descrição:</span>
                  <span className="text-right max-w-sm">{parameter.description}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Categoria:</span>
                  <Badge variant="secondary">FATURAMENTO</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração Atual */}
          {hasCurrentConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {config.venda_dinheiro && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Venda Dinheiro:</span>
                      <Badge variant="outline">{getSubgroupName(config.venda_dinheiro)}</Badge>
                    </div>
                  )}
                  {config.venda_cartao && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Venda Cartão:</span>
                      <Badge variant="outline">{getSubgroupName(config.venda_cartao)}</Badge>
                    </div>
                  )}
                  {config.venda_contas && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Venda Contas:</span>
                      <Badge variant="outline">{getSubgroupName(config.venda_contas)}</Badge>
                    </div>
                  )}
                  {config.venda_delivery && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Venda Delivery:</span>
                      <Badge variant="outline">{getSubgroupName(config.venda_delivery)}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuração dos Subgrupos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurar Subgrupos de Faturamento</CardTitle>
              <CardDescription>
                Selecione os subgrupos para cada tipo de venda. Deixe em branco os tipos que não deseja configurar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Venda Dinheiro */}
              <div className="space-y-2">
                <Label htmlFor="venda-dinheiro">Venda Dinheiro</Label>
                <Select 
                  value={config.venda_dinheiro || "none"} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, venda_dinheiro: value === "none" ? undefined : value }))}
                >
                  <SelectTrigger id="venda-dinheiro">
                    <SelectValue placeholder="Selecione um subgrupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum selecionado</SelectItem>
                    {subgroups.map((subgroup) => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Venda Cartão */}
              <div className="space-y-2">
                <Label htmlFor="venda-cartao">Venda Cartão</Label>
                <Select 
                  value={config.venda_cartao || "none"} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, venda_cartao: value === "none" ? undefined : value }))}
                >
                  <SelectTrigger id="venda-cartao">
                    <SelectValue placeholder="Selecione um subgrupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum selecionado</SelectItem>
                    {subgroups.map((subgroup) => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Venda Contas */}
              <div className="space-y-2">
                <Label htmlFor="venda-contas">Venda Contas</Label>
                <Select 
                  value={config.venda_contas || "none"} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, venda_contas: value === "none" ? undefined : value }))}
                >
                  <SelectTrigger id="venda-contas">
                    <SelectValue placeholder="Selecione um subgrupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum selecionado</SelectItem>
                    {subgroups.map((subgroup) => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Venda Delivery */}
              <div className="space-y-2">
                <Label htmlFor="venda-delivery">Venda Delivery</Label>
                <Select 
                  value={config.venda_delivery || "none"} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, venda_delivery: value === "none" ? undefined : value }))}
                >
                  <SelectTrigger id="venda-delivery">
                    <SelectValue placeholder="Selecione um subgrupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum selecionado</SelectItem>
                    {subgroups.map((subgroup) => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          {hasCurrentConfig && (
            <Button 
              variant="destructive" 
              onClick={handleClear}
              disabled={loading}
            >
              Limpar Configuração
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};