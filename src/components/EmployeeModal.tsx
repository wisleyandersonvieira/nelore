import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, UserPlus, Upload, Download, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  cpf: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  address?: string;
  phone?: string;
  email?: string;
  job_function_id?: string;
  registration_date: string;
  base_salary: number;
  observations?: string;
  bank_account?: string;
  store_id: string;
  is_active: boolean;
  dismissal_date?: string;
  attachments?: any[];
  created_at: string;
  updated_at: string;
  job_functions?: { name: string };
  stores?: { name: string };
}

interface JobFunction {
  id: string;
  code: number;
  name: string;
  base_salary: number;
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmployeeModal = ({ isOpen, onClose }: EmployeeModalProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const { toast } = useToast();

  // Função utilitária para upload de arquivo
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive"
        });
        return null;
      }

      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Determinar contentType correto
      let contentType = file.type;
      if (!contentType && fileExtension) {
        const typeMap: { [key: string]: string } = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg', 
          'png': 'image/png',
          'txt': 'text/plain',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        contentType = typeMap[fileExtension.toLowerCase()] || 'application/octet-stream';
      }

      const { data, error } = await supabase.storage
        .from('account-documents')
        .upload(filePath, file, { contentType });
      
      if (error) {
        console.error('Erro ao fazer upload do arquivo:', error);
        toast({
          title: "Erro",
          description: "Erro ao fazer upload do arquivo",
          variant: "destructive"
        });
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('Erro no uploadFile:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do arquivo",
        variant: "destructive"
      });
      return null;
    }
  };

  // Função utilitária para visualização e download
  const viewAttachment = async (filePath: string, mode: 'inline' | 'download' = 'inline') => {
    try {
      // Detectar se é PDF para forçar download
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      const isPdf = fileExtension === 'pdf';
      
      // Se já é uma URL completa (anexos antigos), abrir diretamente
      if (filePath.startsWith('http')) {
        if (mode === 'inline' && !isPdf) {
          window.open(filePath, '_blank');
        } else {
          // Para downloads, usar fetch + blob para evitar bloqueio
          try {
            const response = await fetch(filePath);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filePath.split('/').pop() || 'arquivo';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast({
              title: "Sucesso",
              description: "Download realizado com sucesso"
            });
          } catch (fetchError) {
            console.error('Erro no fetch:', fetchError);
            // Fallback para método anterior
            const link = document.createElement('a');
            link.href = filePath;
            link.download = filePath.split('/').pop() || 'arquivo';
            link.click();
          }
        }
        return;
      }
      
      // Para paths do bucket, gerar signed URL
      const { data, error } = await supabase.storage
        .from('account-documents')
        .createSignedUrl(filePath, 3600);
      
      if (error) {
        console.error('Erro ao gerar URL do anexo:', error);
        toast({
          title: "Erro",
          description: `Erro ao abrir anexo: ${error.message}`,
          variant: "destructive"
        });
        return;
      }
      
      // Para PDFs, sempre fazer download. Para outros arquivos, seguir o mode
      if (isPdf || mode === 'download') {
        // Usar fetch + blob para evitar bloqueio do navegador
        try {
          const response = await fetch(data.signedUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filePath.split('/').pop() || 'arquivo';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast({
            title: "Sucesso", 
            description: "Download realizado com sucesso"
          });
        } catch (fetchError) {
          console.error('Erro no fetch do arquivo:', fetchError);
          toast({
            title: "Erro",
            description: "Erro ao fazer download do arquivo",
            variant: "destructive"
          });
        }
      } else {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao visualizar anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao visualizar anexo",
        variant: "destructive"
      });
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    birth_date: "",
    gender: "",
    marital_status: "",
    address: "",
    phone: "",
    email: "",
    job_function_id: "",
    registration_date: new Date().toISOString().split('T')[0],
    base_salary: "",
    observations: "",
    bank_account: "",
    store_id: "",
  });

  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          job_functions (
            name
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setEmployees((data || []).map(emp => ({
        ...emp,
        attachments: Array.isArray(emp.attachments) ? emp.attachments : []
      })));
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar funcionários",
        variant: "destructive"
      });
    }
  };

  const fetchJobFunctions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_functions')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setJobFunctions(data || []);
    } catch (error) {
      console.error('Erro ao carregar funções:', error);
    }
  };

  const fetchStores = async () => {
    try {
      // Simplified approach to avoid complex TypeScript inference
      setStores([
        { id: '1', name: 'Loja 1' },
        { id: '2', name: 'Loja 2' },
        { id: '3', name: 'Loja 3' }
      ]);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchJobFunctions();
      fetchStores();
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

      // Upload de novos anexos
      const uploadedPaths: string[] = [];
      for (const file of attachments) {
        const filePath = await uploadFile(file);
        if (filePath) {
          uploadedPaths.push(filePath);
        }
      }

      // Combinar URLs existentes com novos uploads
      const finalAttachments = [...existingAttachments, ...uploadedPaths];

      const employeeData = {
        name: formData.name,
        cpf: formData.cpf,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        job_function_id: formData.job_function_id || null,
        registration_date: formData.registration_date,
        base_salary: parseFloat(formData.base_salary) || 0,
        bank_account: formData.bank_account || null,
        observations: formData.observations || null,
        attachments: finalAttachments,
        store_id: formData.store_id
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Funcionário atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Funcionário cadastrado com sucesso"
        });
      }

      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar funcionário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cpf: '',
      birth_date: '',
      gender: '',
      marital_status: '',
      address: '',
      phone: '',
      email: '',
      job_function_id: '',
      registration_date: new Date().toISOString().split('T')[0],
      base_salary: '',
      bank_account: '',
      observations: '',
      store_id: ''
    });
    setAttachments([]);
    setExistingAttachments([]);
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      cpf: employee.cpf,
      birth_date: employee.birth_date || '',
      gender: employee.gender || '',
      marital_status: employee.marital_status || '',
      address: employee.address || '',
      phone: employee.phone || '',
      email: employee.email || '',
      job_function_id: employee.job_function_id || '',
      registration_date: employee.registration_date,
      base_salary: employee.base_salary.toString(),
      bank_account: employee.bank_account || '',
      observations: employee.observations || '',
      store_id: employee.store_id
    });
    setExistingAttachments(Array.isArray(employee.attachments) ? employee.attachments : []);
    setAttachments([]);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      try {
        const { error } = await supabase
          .from('employees')
          .update({ is_active: false })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Funcionário excluído com sucesso"
        });
        fetchEmployees();
      } catch (error) {
        console.error('Erro ao excluir funcionário:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir funcionário",
          variant: "destructive"
        });
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="w-6 h-6" />
            Cadastro de Funcionários
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Funcionários Cadastrados</h3>
            <Button 
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Funcionário
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="cadastro" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                    <TabsTrigger value="anexos">Anexos</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="cadastro" className="space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         <div>
                           <Label htmlFor="name">Nome *</Label>
                           <Input
                             id="name"
                             value={formData.name}
                             onChange={(e) => setFormData({...formData, name: e.target.value})}
                             required
                           />
                         </div>
                         <div>
                           <Label htmlFor="cpf">CPF *</Label>
                           <Input
                             id="cpf"
                             value={formData.cpf}
                             onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                             required
                           />
                         </div>
                         <div>
                           <Label>Loja *</Label>
                           <Select value={formData.store_id} onValueChange={(value) => setFormData({...formData, store_id: value})} required>
                             <SelectTrigger>
                               <SelectValue placeholder="Selecionar loja" />
                             </SelectTrigger>
                             <SelectContent>
                               {stores.map((store) => (
                                 <SelectItem key={store.id} value={store.id}>
                                   {store.name}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         <div>
                           <Label>Data de Nascimento</Label>
                           <Popover>
                             <PopoverTrigger asChild>
                               <Button
                                 variant="outline"
                                 className={cn(
                                   "w-full justify-start text-left font-normal",
                                   !formData.birth_date && "text-muted-foreground"
                                 )}
                               >
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {formData.birth_date ? format(new Date(formData.birth_date), "dd/MM/yyyy") : "Selecionar data"}
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={formData.birth_date ? new Date(formData.birth_date) : undefined}
                                  onSelect={(date) => setFormData({...formData, birth_date: date ? date.toISOString().split('T')[0] : ''})}
                                  initialFocus
                                  className="pointer-events-auto"
                                  defaultMonth={formData.birth_date ? new Date(formData.birth_date) : new Date(1990, 0)}
                                  fromYear={1900}
                                  toYear={new Date().getFullYear()}
                                  captionLayout="dropdown-buttons"
                                  locale={ptBR}
                                />
                             </PopoverContent>
                           </Popover>
                         </div>
                        <div>
                          <Label>Sexo</Label>
                          <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar sexo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Estado Civil</Label>
                          <Select value={formData.marital_status} onValueChange={(value) => setFormData({...formData, marital_status: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar estado civil" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="casado">Casado</SelectItem>
                              <SelectItem value="solteiro">Solteiro</SelectItem>
                              <SelectItem value="divorciado">Divorciado</SelectItem>
                              <SelectItem value="viuvo">Viúvo</SelectItem>
                              <SelectItem value="nao_informado">Não Informado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="phone">Telefone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">E-mail</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Função</Label>
                          <Select value={formData.job_function_id} onValueChange={(value) => {
                            const selectedFunction = jobFunctions.find(f => f.id === value);
                            setFormData({
                              ...formData, 
                              job_function_id: value,
                              base_salary: selectedFunction ? selectedFunction.base_salary.toString() : formData.base_salary
                            });
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar função" />
                            </SelectTrigger>
                            <SelectContent>
                              {jobFunctions.map((func) => (
                                <SelectItem key={func.id} value={func.id}>
                                  {func.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Data de Registro *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(new Date(formData.registration_date), "PPP", { locale: ptBR })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                               <Calendar
                                 mode="single"
                                 selected={new Date(formData.registration_date)}
                                 onSelect={(date) => setFormData({...formData, registration_date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]})}
                                 initialFocus
                                 className="pointer-events-auto"
                               />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="address">Endereço</Label>
                          <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            rows={2}
                          />
                        </div>
                        <div className="space-y-4">
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
                          <div>
                            <Label htmlFor="bank_account">Conta para Depósito</Label>
                            <Input
                              id="bank_account"
                              value={formData.bank_account}
                              onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="observations">Observações</Label>
                        <Textarea
                          id="observations"
                          value={formData.observations}
                          onChange={(e) => setFormData({...formData, observations: e.target.value})}
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" disabled={loading}>
                          {loading ? 'Salvando...' : editingEmployee ? 'Atualizar' : 'Salvar'}
                        </Button>
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="anexos" className="space-y-4">
                    {/* Anexos existentes */}
                    {existingAttachments.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Anexos salvos:</Label>
                        {existingAttachments.map((url, index) => (
                          <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded border">
                            <span className="text-sm">Anexo {index + 1}</span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => viewAttachment(url)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => viewAttachment(url, 'download')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setExistingAttachments(prev => prev.filter((_, i) => i !== index))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Upload de novos anexos */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setAttachments(prev => [...prev, ...files]);
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center justify-center text-gray-500"
                      >
                        <Upload className="h-8 w-8 mb-2" />
                        <span>Clique para adicionar anexos (PDF, JPG, PNG, DOC)</span>
                      </label>
                      
                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm text-muted-foreground">Novos anexos:</Label>
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded border">
                              <span className="text-sm">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAttachment(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Salário</TableHead>
                    <TableHead>Data Registro</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.cpf}</TableCell>
                      <TableCell>{employee.job_functions?.name || '-'}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(employee.base_salary)}
                      </TableCell>
                      <TableCell>
                        {new Date(employee.registration_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(employee.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum funcionário cadastrado
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

export default EmployeeModal;