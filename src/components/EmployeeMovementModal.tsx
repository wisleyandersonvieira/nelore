import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Building2, User, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

interface PayableAccount {
  id: string;
  amount: number;
  payment_date: string;
  description: string;
  notes: string;
  document_type: string;
  document_number: string;
  status: string;
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
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchStores = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id,
          name,
          code
        `)
        .order("name");

      if (error) throw error;
      
      const storesData = data?.map(store => ({
        id: store.id,
        name: store.name || '',
        code: store.code || ''
      })) || [];
      
      setStores(storesData);
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar lojas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async (storeId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          name,
          cpf,
          is_active
        `)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      const employeesData = data?.map(employee => ({
        id: employee.id,
        name: employee.name || '',
        cpf: employee.cpf || '',
        is_active: employee.is_active || false
      })) || [];
      
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar funcionários",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayableAccounts = async (employeeId: string, month?: string) => {
    try {
      setIsLoading(true);
      let query = supabase
        .from("accounts_payable")
        .select(`
          id,
          amount,
          payment_date,
          description,
          notes,
          document_type,
          document_number,
          status
        `)
        .eq("employee_id", employeeId)
        .eq("status", "paid")
        .not("payment_date", "is", null)
        .order("payment_date", { ascending: false });

      if (month) {
        const [year, monthNum] = month.split("-");
        const startDate = `${year}-${monthNum}-01`;
        const endDate = `${year}-${monthNum}-31`;
        query = query.gte("payment_date", startDate).lte("payment_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const accountsData = data?.map(account => ({
        id: account.id,
        amount: Number(account.amount) || 0,
        payment_date: account.payment_date || '',
        description: account.description || '',
        notes: account.notes || '',
        document_type: account.document_type || '',
        document_number: account.document_number || '',
        status: account.status || ''
      })) || [];
      
      setPayableAccounts(accountsData);
    } catch (error) {
      console.error("Error fetching payable accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar movimentações",
        variant: "destructive",
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
      setSelectedEmployee(null);
      setPayableAccounts([]);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchPayableAccounts(selectedEmployee.id, selectedMonth);
    }
  }, [selectedEmployee, selectedMonth]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
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
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM yyyy", { locale: ptBR });
      options.push({ value, label });
    }
    
    return options;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateTotal = () => {
    return payableAccounts.reduce((sum, account) => sum + Number(account.amount), 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(selectedStore || selectedEmployee) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-2xl font-bold">
              Movimentação Funcionários
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {!selectedStore ? (
            // Store Selection
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Selecione uma Loja
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => (
                  <Card
                    key={store.id}
                    className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                    onClick={() => handleStoreSelect(store)}
                  >
                    <CardHeader className="text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-2">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <CardDescription>Código: {store.code}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline">
                        Selecionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : !selectedEmployee ? (
            // Employee Selection
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Funcionários Ativos - {selectedStore.name}
              </h3>
              <div className="space-y-2">
                {employees.map((employee) => (
                  <Card
                    key={employee.id}
                    className="cursor-pointer transition-all duration-200 hover:shadow-md"
                    onClick={() => handleEmployeeSelect(employee)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{employee.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            CPF: {employee.cpf}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Ver Movimentações
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            // Employee Movement Details
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Movimentações - {selectedEmployee.name}
                </h3>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os meses</SelectItem>
                    {generateMonthOptions().map((option) => (
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
                      <CardTitle>Movimentações Financeiras</CardTitle>
                      <CardDescription>
                        Contas pagas vinculadas ao funcionário
                        {selectedMonth && (
                          <span className="ml-2">
                            - {generateMonthOptions().find(o => o.value === selectedMonth)?.label}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {payableAccounts.length > 0 ? (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data Pagamento</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead>Observações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payableAccounts.map((account) => (
                                <TableRow key={account.id}>
                                  <TableCell>
                                    {account.payment_date
                                      ? format(new Date(account.payment_date), "dd/MM/yyyy")
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(Number(account.amount))}
                                  </TableCell>
                                  <TableCell>{account.description}</TableCell>
                                  <TableCell>
                                    {account.document_type && account.document_number
                                      ? `${account.document_type} ${account.document_number}`
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate">
                                    {account.notes || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Total do Período:</span>
                              <span className="text-lg font-bold">
                                {formatCurrency(calculateTotal())}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma movimentação encontrada para este funcionário no período selecionado.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="obrigacoes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Obrigações</CardTitle>
                      <CardDescription>
                        Funcionalidade em desenvolvimento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Esta funcionalidade será implementada em breve.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeMovementModal;