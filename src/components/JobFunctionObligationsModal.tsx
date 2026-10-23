import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Obligation {
  id: string;
  name: string;
  recurrence_type: string;
}

interface JobFunctionObligationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobFunctionId: string;
  jobFunctionName: string;
}

const JobFunctionObligationsModal = ({ 
  isOpen, 
  onClose, 
  jobFunctionId,
  jobFunctionName 
}: JobFunctionObligationsModalProps) => {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [selectedObligations, setSelectedObligations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar todas as obrigações ativas
      const { data: obligationsData, error: obligationsError } = await supabase
        .from('employee_obligations')
        .select('id, name, recurrence_type')
        .eq('is_active', true)
        .order('name');

      if (obligationsError) throw obligationsError;
      setObligations(obligationsData || []);

      // Buscar vínculos existentes
      const { data: linksData, error: linksError } = await supabase
        .from('job_function_obligations')
        .select('obligation_id')
        .eq('job_function_id', jobFunctionId);

      if (linksError) throw linksError;
      
      const linkedIds = new Set(linksData?.map(l => l.obligation_id) || []);
      setSelectedObligations(linkedIds);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar obrigações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && jobFunctionId) {
      fetchData();
    }
  }, [isOpen, jobFunctionId]);

  const handleToggleObligation = (obligationId: string) => {
    setSelectedObligations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(obligationId)) {
        newSet.delete(obligationId);
      } else {
        newSet.add(obligationId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Remover todos os vínculos existentes
      const { error: deleteError } = await supabase
        .from('job_function_obligations')
        .delete()
        .eq('job_function_id', jobFunctionId);

      if (deleteError) throw deleteError;

      // Inserir novos vínculos
      if (selectedObligations.size > 0) {
        const newLinks = Array.from(selectedObligations).map(obligationId => ({
          job_function_id: jobFunctionId,
          obligation_id: obligationId
        }));

        const { error: insertError } = await supabase
          .from('job_function_obligations')
          .insert(newLinks);

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso",
        description: "Obrigações vinculadas com sucesso"
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar vínculos:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar vínculos",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getRecurrenceLabel = (type: string) => {
    return type === 'periodica' ? 'Periódica' : 'Única';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Obrigações - {jobFunctionName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : obligations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma obrigação cadastrada. Cadastre obrigações primeiro.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione as obrigações que devem ser vinculadas a esta função:
              </p>
              <div className="space-y-3">
                {obligations.map((obligation) => (
                  <div
                    key={obligation.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={obligation.id}
                      checked={selectedObligations.has(obligation.id)}
                      onCheckedChange={() => handleToggleObligation(obligation.id)}
                    />
                    <Label 
                      htmlFor={obligation.id} 
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-medium">{obligation.name}</span>
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        {getRecurrenceLabel(obligation.recurrence_type)}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobFunctionObligationsModal;
