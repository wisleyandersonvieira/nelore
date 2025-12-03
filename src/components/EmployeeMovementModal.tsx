import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Building2, User, FileText, Download, Calendar, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EmployeeObligationsTab from "./EmployeeObligationsTab";
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

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const EmployeeMovementModal = ({ isOpen, onClose }: EmployeeMovementModalProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payableAccounts, setPayableAccounts] = useState<PayableAccount[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
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

  const fetchPayableAccounts = async (employeeId: string, year: number, months: number[]) => {
    try {
      setIsLoading(true);
      
      // Se não há meses selecionados, busca todos do ano
      if (months.length === 0) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        const { data, error } = await supabase
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
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date", { ascending: false });

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
        return;
      }

      // Buscar contas para cada mês selecionado
      const allAccounts: PayableAccount[] = [];
      
      for (const month of months) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const { data, error } = await supabase
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
          .gte("payment_date", startDateStr)
          .lte("payment_date", endDateStr);

        if (error) throw error;
        
        if (data) {
          data.forEach(account => {
            allAccounts.push({
              id: account.id,
              amount: Number(account.amount) || 0,
              payment_date: account.payment_date || '',
              description: account.description || '',
              notes: account.notes || '',
              document_type: account.document_type || '',
              document_number: account.document_number || '',
              status: account.status || ''
            });
          });
        }
      }

      // Ordenar por data de pagamento
      allAccounts.sort((a, b) => 
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
      
      setPayableAccounts(allAccounts);
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
      fetchPayableAccounts(selectedEmployee.id, selectedYear, selectedMonths);
    }
  }, [selectedEmployee, selectedYear, selectedMonths]);

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
      setSelectedMonths([]);
    } else if (selectedStore) {
      setSelectedStore(null);
      setEmployees([]);
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  };

  const handleMonthToggle = (month: number) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const getSelectedMonthsLabel = () => {
    if (selectedMonths.length === 0) return "Todos os meses";
    if (selectedMonths.length === 12) return "Todos os meses";
    return selectedMonths.map(m => MONTHS.find(month => month.value === m)?.label).join(", ");
  };

  const getFilterDescription = () => {
    if (selectedMonths.length === 0) {
      return `Ano ${selectedYear}`;
    }
    const monthNames = selectedMonths.map(m => MONTHS.find(month => month.value === m)?.label).join(", ");
    return `${monthNames} de ${selectedYear}`;
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

  const exportReport = () => {
    if (!selectedEmployee || payableAccounts.length === 0) {
      toast({
        title: "Atenção",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }

    // Criar dados para exportação
    const exportData = payableAccounts.map(account => ({
      'Data Pagamento': account.payment_date 
        ? format(new Date(account.payment_date), "dd/MM/yyyy") 
        : "-",
      'Valor': formatCurrency(Number(account.amount)),
      'Descrição': account.description,
      'Documento': account.document_type && account.document_number
        ? `${account.document_type} ${account.document_number}`
        : "-",
      'Observações': account.notes || "-"
    }));

    // Adicionar linha do total
    exportData.push({
      'Data Pagamento': '',
      'Valor': formatCurrency(calculateTotal()),
      'Descrição': 'TOTAL DO PERÍODO',
      'Documento': '',
      'Observações': ''
    });

    // Usar XLSX para exportar
    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    
    const periodText = ` - ${getFilterDescription()}`;
    
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `Movimentacoes_${selectedEmployee.name.replace(/\s+/g, '_')}${periodText.replace(/\s+/g, '_')}.xlsx`);

    toast({
      title: "Sucesso",
      description: "Relatório exportado com sucesso",
    });
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
              </div>

              <Tabs defaultValue="financeiro" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
                </TabsList>

                <TabsContent value="financeiro" className="space-y-4">
                  {/* Filters and Export - only in Financeiro tab */}
                  <div className="flex items-center justify-end gap-3">
                    {/* Year Selector */}
                    <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateYearOptions().map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Month Multi-Select Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-52 justify-between">
                          <span className="truncate text-sm">
                            {getSelectedMonthsLabel()}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3 bg-background border" align="end">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Meses</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => setSelectedMonths([])}
                            >
                              Limpar
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {MONTHS.map((month) => (
                              <div key={month.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`month-${month.value}`}
                                  checked={selectedMonths.includes(month.value)}
                                  onCheckedChange={() => handleMonthToggle(month.value)}
                                />
                                <label
                                  htmlFor={`month-${month.value}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {month.label.slice(0, 3)}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportReport}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Movimentações Financeiras</CardTitle>
                      <CardDescription>
                        Contas pagas vinculadas ao funcionário - {getFilterDescription()}
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
                  <EmployeeObligationsTab
                    employeeId={selectedEmployee.id}
                    employeeName={selectedEmployee.name}
                    storeId={selectedStore.id}
                  />
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