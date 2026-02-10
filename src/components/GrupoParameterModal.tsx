import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface GrupoParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: {
    id: string;
    name: string;
    description: string;
    type: 'funcionarios';
    category: 'group';
  } | null;
}

interface AccountGroup {
  id: string;
  name: string;
  parent_name?: string;
}

export const GrupoParameterModal = ({ open, onOpenChange, parameter }: GrupoParameterModalProps) => {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [currentGroupId, setCurrentGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { matrixId } = useUserMatrix();

  useEffect(() => {
    if (open && parameter && matrixId) {
      fetchGroups();
      loadCurrentParameter();
    }
  }, [open, parameter, matrixId]);

  const fetchGroups = async () => {
    if (!matrixId) return;

    try {
      // First get the brand_id from the matrix
      const { data: matrixData } = await supabase
        .from('matrices')
        .select('brand_id')
        .eq('id', matrixId)
        .single();

      if (!matrixData?.brand_id) {
        toast.error("Matriz não possui marca vinculada");
        return;
      }

      // Fetch groups (parent_id is null) filtered by brand
      const { data, error } = await supabase
        .from('account_groups')
        .select('id, name')
        .is('parent_id', null)
        .eq('brand_id', matrixData.brand_id)
        .order('name');

      if (error) throw error;

      const formattedGroups = data?.map((group: any) => ({
        id: group.id,
        name: group.name,
      })) || [];

      setGroups(formattedGroups);
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      toast.error("Erro ao carregar grupos");
    }
  };

  const loadCurrentParameter = async () => {
    if (!parameter) return;

    try {
      const { data, error } = await supabase
        .from('system_parameters')
        .select('group_id')
        .eq('parameter_key', parameter.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.group_id) {
        setCurrentGroupId(data.group_id);
        setSelectedGroupId(data.group_id);
      } else {
        setCurrentGroupId("");
        setSelectedGroupId("");
      }
    } catch (error) {
      console.error('Erro ao carregar parâmetro atual:', error);
      toast.error("Erro ao carregar configuração atual");
    }
  };

  const handleSave = async () => {
    if (!parameter || !selectedGroupId || !matrixId) {
      toast.error("Selecione um grupo");
      return;
    }

    setLoading(true);
    try {
      if (currentGroupId) {
        // Atualizar parâmetro existente
        const { error } = await supabase
          .from('system_parameters')
          .update({ group_id: selectedGroupId, updated_at: new Date().toISOString() })
          .eq('parameter_key', parameter.id);

        if (error) throw error;
      } else {
        // Criar novo parâmetro
        const { error } = await supabase
          .from('system_parameters')
          .insert({
            parameter_key: parameter.id,
            group_id: selectedGroupId,
            matrix_id: matrixId
          });

        if (error) throw error;
      }

      toast.success("Parâmetro configurado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar parâmetro:', error);
      toast.error("Erro ao salvar parâmetro");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!parameter || !currentGroupId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_parameters')
        .delete()
        .eq('parameter_key', parameter.id);

      if (error) throw error;

      toast.success("Configuração removida com sucesso!");
      setCurrentGroupId("");
      setSelectedGroupId("");
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao remover configuração:', error);
      toast.error("Erro ao remover configuração");
    } finally {
      setLoading(false);
    }
  };

  const currentGroup = groups.find(g => g.id === currentGroupId);
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Parâmetro - {parameter?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Parâmetro */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Informações do Parâmetro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Nome:</span>
                <span>{parameter?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Descrição:</span>
                <span className="text-sm text-muted-foreground">{parameter?.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Categoria:</span>
                <Badge variant="outline">GRUPO</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Configuração Atual */}
          {currentGroup && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configuração Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{currentGroup.name}</p>
                  </div>
                  <Badge variant="default">Configurado</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seleção de Grupo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selecionar Grupo</CardTitle>
              <CardDescription>
                Escolha o grupo que será associado a este parâmetro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="font-medium">{group.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedGroup && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedGroup.name}</p>
                      </div>
                      <Badge variant="secondary">Selecionado</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          {currentGroupId && (
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={loading}
            >
              Limpar Configuração
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !selectedGroupId}
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
