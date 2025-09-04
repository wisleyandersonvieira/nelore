import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface JobFunction {
  id: string;
  code: number;
  name: string;
  description: string | null;
  base_salary: number;
  store_id: string;
  is_active: boolean;
  created_at: string;
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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_salary: ''
  });

  const fetchJobFunctions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_functions')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      setJobFunctions(data || []);
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
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

      if (!profile?.store_id) throw new Error('Store ID não encontrado');

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
          .rpc('get_next_job_function_code', { store_uuid: profile.store_id });

        const { error } = await supabase
          .from('job_functions')
          .insert([{
            code: nextCode,
            name: formData.name,
            description: formData.description,
            base_salary: parseFloat(formData.base_salary),
            store_id: profile.store_id
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

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta função?')) {
      try {
        const { error } = await supabase
          .from('job_functions')
          .update({ is_active: false })
          .eq('id', id);

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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UserCog className="w-6 h-6" />
            Cadastro de Funções
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Funções Cadastradas</h3>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Salário Base</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobFunctions.map((jobFunction) => (
                    <TableRow key={jobFunction.id}>
                      <TableCell>{jobFunction.code}</TableCell>
                      <TableCell className="font-medium">{jobFunction.name}</TableCell>
                      <TableCell>{jobFunction.description || '-'}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(jobFunction.base_salary)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(jobFunction)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(jobFunction.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobFunctions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma função cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobFunctionModal;