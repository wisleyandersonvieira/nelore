import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, UserCog, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JobFunctionObligationsModal from "./JobFunctionObligationsModal";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { useFuncionariosPermissions } from "@/hooks/useFuncionariosPermissions";

interface JobFunction {
  id: string;
  code: number;
  name: string;
  description: string | null;
  base_salary: number;
  store_id: string;
  matrix_id: string;
  is_active: boolean;
  created_at: string;
  employee_count?: number;
}

interface JobFunctionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JobFunctionModal = ({ isOpen, onClose }: JobFunctionModalProps) => {
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingFunction, setEditingFunction] = useState<JobFunction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showObligationsModal, setShowObligationsModal] = useState(false);
  const [selectedFunctionForObligations, setSelectedFunctionForObligations] = useState<JobFunction | null>(null);
  const { toast } = useToast();
  const { matrixId, matrixName, matrixCode } = useUserMatrix();
  const { canEdit } = useFuncionariosPermissions();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_salary: ''
  });

  const fetchJobFunctions = async () => {
    try {
      // RLS already filters by matrix_id
      const { data, error } = await supabase
        .from('job_functions')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;

      // Get employee counts for each function
      const functionsWithCounts = await Promise.all(
        (data || []).map(async (fn) => {
          const { count } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('job_function_id', fn.id)
            .eq('is_active', true);
          
          return { ...fn, employee_count: count || 0 };
        })
      );

      setJobFunctions(functionsWithCounts);
    } catch (error) {
      console.error('Erro ao carregar funções:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar funções",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchJobFunctions();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar campo obrigatório
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O campo Função é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!matrixId) {
      toast({
        title: "Erro",
        description: "Matriz não encontrada. Por favor, recarregue a página.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar store_id do profile primeiro, depois de user_stores
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

      let storeId = profile?.store_id;

      // Se não tiver store_id no profile, buscar de user_stores
      if (!storeId) {
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        storeId = userStores?.store_id;
      }

      if (!storeId) throw new Error('Store ID não encontrado. Verifique se você tem uma loja atribuída.');

      if (editingFunction) {
        const { error } = await supabase
          .from('job_functions')
          .update({
            name: formData.name,
            description: formData.description,
            base_salary: parseFloat(formData.base_salary)
          })
          .eq('id', editingFunction.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Função atualizada com sucesso"
        });
      } else {
        // Buscar próximo código
        const { data: nextCode } = await supabase
          .rpc('get_next_job_function_code', { store_uuid: storeId });

        const { error } = await supabase
          .from('job_functions')
          .insert([{
            code: nextCode,
            name: formData.name,
            description: formData.description,
            base_salary: parseFloat(formData.base_salary),
            store_id: storeId,
            matrix_id: matrixId
          }]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Função cadastrada com sucesso"
        });
      }

      setFormData({ name: '', description: '', base_salary: '' });
      setEditingFunction(null);
      setShowForm(false);
      fetchJobFunctions();
    } catch (error) {
      console.error('Erro ao salvar função:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar função",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (jobFunction: JobFunction) => {
    setEditingFunction(jobFunction);
    setFormData({
      name: jobFunction.name,
      description: jobFunction.description || '',
      base_salary: jobFunction.base_salary.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (jobFunction: JobFunction) => {
    // Check if function has linked employees
    if (jobFunction.employee_count && jobFunction.employee_count > 0) {
      toast({
        title: "Não é possível excluir",
        description: `Esta função possui ${jobFunction.employee_count} funcionário(s) vinculado(s). Remova os vínculos antes de excluir.`,
        variant: "destructive"
      });
      return;
    }

    if (confirm('Tem certeza que deseja excluir esta função?')) {
      try {
        const { error } = await supabase
          .from('job_functions')
          .update({ is_active: false })
          .eq('id', jobFunction.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Função excluída com sucesso"
        });
        fetchJobFunctions();
      } catch (error) {
        console.error('Erro ao excluir função:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir função",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UserCog className="w-6 h-6" />
            Cadastro de Funções
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Funções Cadastradas</h3>
            {canEdit && (
              <Button 
                onClick={() => {
                  setShowForm(true);
                  setEditingFunction(null);
                  setFormData({ name: '', description: '', base_salary: '' });
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nova Função
              </Button>
            )}
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingFunction ? 'Editar Função' : 'Nova Função'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="matrix">Matriz</Label>
                      <Input
                        id="matrix"
                        value={matrixCode && matrixName ? `${matrixCode} - ${matrixName}` : 'Carregando...'}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div>
                      <Label htmlFor="name">Nome da Função *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="base_salary">Salário Base *</Label>
                      <Input
                        id="base_salary"
                        type="number"
                        step="0.01"
                        value={formData.base_salary}
                        onChange={(e) => setFormData({...formData, base_salary: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={4}
                      placeholder="Digite a descrição da função..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : editingFunction ? 'Atualizar' : 'Salvar'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowForm(false);
                        setEditingFunction(null);
                        setFormData({ name: '', description: '', base_salary: '' });
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Matriz</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Salário Base</TableHead>
                    <TableHead>Funcionários</TableHead>
                    {canEdit && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobFunctions.map((jobFunction) => (
                    <TableRow key={jobFunction.id}>
                      <TableCell>{jobFunction.code}</TableCell>
                      <TableCell>{matrixCode && matrixName ? `${matrixCode} - ${matrixName}` : '-'}</TableCell>
                      <TableCell className="font-medium">{jobFunction.name}</TableCell>
                      <TableCell>{jobFunction.description || '-'}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(jobFunction.base_salary)}
                      </TableCell>
                      <TableCell>{jobFunction.employee_count || 0}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(jobFunction)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedFunctionForObligations(jobFunction);
                                setShowObligationsModal(true);
                              }}
                              title="Vincular Obrigações"
                            >
                              <ClipboardList className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(jobFunction)}
                              title={jobFunction.employee_count && jobFunction.employee_count > 0 
                                ? "Não é possível excluir - possui funcionários vinculados" 
                                : "Excluir"}
                              disabled={!!(jobFunction.employee_count && jobFunction.employee_count > 0)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {jobFunctions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">
                        Nenhuma função cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {selectedFunctionForObligations && (
          <JobFunctionObligationsModal
            isOpen={showObligationsModal}
            onClose={() => {
              setShowObligationsModal(false);
              setSelectedFunctionForObligations(null);
            }}
            jobFunctionId={selectedFunctionForObligations.id}
            jobFunctionName={selectedFunctionForObligations.name}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default JobFunctionModal;