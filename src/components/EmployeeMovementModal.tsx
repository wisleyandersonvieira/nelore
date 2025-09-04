import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Users, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface Employee {
  id: string;
  name: string;
  cpf: string;
  is_active: boolean;
  job_functions?: { name: string };
}

interface PayableAccount {
  id: string;
  description: string;
  amount: number;
  payment_date: string;
  notes?: string;
  document_type?: string;
  document_number?: string;
}

interface EmployeeMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmployeeMovementModal = ({ isOpen, onClose }: EmployeeMovementModalProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payableAccounts, setPayableAccounts] = useState<PayableAccount[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lojas",
        variant: "destructive"
      });
    }
  };

  const fetchEmployees = async (storeId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("employees")
        .select(`
          *,
          job_functions(name)
        `)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar funcionários",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayableAccounts = async (employeeId: string, month: string) => {
    try {
      setIsLoading(true);
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "paid")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      setPayableAccounts(data || []);
    } catch (error) {
      console.error("Erro ao buscar contas pagas:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar movimentações",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStores();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedStore) {
      fetchEmployees(selectedStore.id);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedEmployee && selectedMonth) {
      fetchPayableAccounts(selectedEmployee.id, selectedMonth);
    }
  }, [selectedEmployee, selectedMonth]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setSelectedEmployee(null);
    setPayableAccounts([]);
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleBack = () => {
    if (selectedEmployee) {
      setSelectedEmployee(null);
      setPayableAccounts([]);
    } else if (selectedStore) {
      setSelectedStore(null);
      setEmployees([]);
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('pt-BR', { 
        year: 'numeric', 
        month: 'long' 
      });
      options.push({ value, label });
    }
    return options;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            {selectedEmployee || selectedStore ? (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            ) : null}
            <Users className="w-6 h-6" />
            Movimentação de Funcionários
            {selectedStore && (
              <span className="text-lg font-normal">- {selectedStore.name}</span>
            )}
            {selectedEmployee && (
              <span className="text-lg font-normal">- {selectedEmployee.name}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!selectedStore && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Selecione uma Loja</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => (
                  <Card 
                    key={store.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleStoreSelect(store)}
                  >
                    <CardHeader className="text-center">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">Código: {store.code}</p>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {selectedStore && !selectedEmployee && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Funcionários Ativos - {selectedStore.name}</h3>
              {isLoading ? (
                <div className="text-center py-8">Carregando funcionários...</div>
              ) : (
                <div className="grid gap-4">
                  {employees.map((employee) => (
                    <Card 
                      key={employee.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEmployeeSelect(employee)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <h4 className="font-semibold">{employee.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            CPF: {employee.cpf} | Função: {employee.job_functions?.name || '-'}
                          </p>
                        </div>
                        <Badge variant="default">Ativo</Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {employees.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum funcionário ativo encontrado nesta loja
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Movimentações - {selectedEmployee.name}
                </h3>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs defaultValue="financeiro" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
                </TabsList>
                
                <TabsContent value="financeiro" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Contas Pagas Vinculadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="text-center py-8">Carregando movimentações...</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data Pagamento</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Documento</TableHead>
                              <TableHead>Observações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payableAccounts.map((account) => (
                              <TableRow key={account.id}>
                                <TableCell>
                                  {new Date(account.payment_date).toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell>
                                  R$ {Number(account.amount).toFixed(2)}
                                </TableCell>
                                <TableCell>{account.description}</TableCell>
                                <TableCell>
                                  {account.document_type && account.document_number
                                    ? `${account.document_type} ${account.document_number}`
                                    : '-'
                                  }
                                </TableCell>
                                <TableCell>{account.notes || '-'}</TableCell>
                              </TableRow>
                            ))}
                            {payableAccounts.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  Nenhuma movimentação encontrada para este período
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      )}
                      
                      {payableAccounts.length > 0 && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">Total do período:</span>
                            <span className="font-bold text-lg">
                              R$ {payableAccounts.reduce((sum, account) => sum + Number(account.amount), 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="obrigacoes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Obrigações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        Funcionalidade em desenvolvimento
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeMovementModal;