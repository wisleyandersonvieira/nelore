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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, User, FileText, Download, ChevronDown, FileSpreadsheet, UserX, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EmployeeObligationsTab from "./EmployeeObligationsTab";
import { ptBR } from "date-fns/locale";
import { useFuncionariosPermissions } from "@/hooks/useFuncionariosPermissions";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  is_registered: boolean;
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
  subgroups: string;
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
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { canEdit } = useFuncionariosPermissions();
  const { toast } = useToast();

  const fetchStores = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar se é admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      let storesData: Store[] = [];

      if (profile?.role === 'admin') {
        // Admin vê todas as lojas
        const { data, error } = await supabase
          .from("stores")
          .select("id, name, code")
          .order("name");

        if (error) throw error;
        storesData = data?.map(store => ({
          id: store.id,
          name: store.name || '',
          code: store.code || ''
        })) || [];
      } else {
        // Usuário normal: buscar lojas autorizadas
        const storeIds: string[] = [];
        
        if (profile?.store_id) {
          storeIds.push(profile.store_id);
        }
        
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);
        
        if (userStores) {
          userStores.forEach(us => {
            if (!storeIds.includes(us.store_id)) {
              storeIds.push(us.store_id);
            }
          });
        }

        if (storeIds.length > 0) {
          const { data, error } = await supabase
            .from("stores")
            .select("id, name, code")
            .in('id', storeIds)
            .order("name");

          if (error) throw error;
          storesData = data?.map(store => ({
            id: store.id,
            name: store.name || '',
            code: store.code || ''
          })) || [];
        }
      }
      
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

  const fetchEmployees = async (storeId: string, inactive: boolean = false) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          name,
          cpf,
          is_active,
          is_registered
        `)
        .eq("store_id", storeId)
        .eq("is_active", !inactive)
        .order("name");

      if (error) throw error;
      
      const employeesData = data?.map(employee => ({
        id: employee.id,
        name: employee.name || '',
        cpf: employee.cpf || '',
        is_active: employee.is_active || false,
        is_registered: employee.is_registered ?? false
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
      
      const fetchSubgroupsForAccount = async (accountId: string): Promise<string> => {
        const { data: items } = await supabase
          .from("accounts_payable_items")
          .select(`
            product_id,
            products!inner (
              subgroup_id,
              account_groups!products_subgroup_id_fkey (
                name
              )
            )
          `)
          .eq("account_payable_id", accountId);
        
        if (!items || items.length === 0) return "-";
        
        const subgroupNames = new Set<string>();
        items.forEach((item: any) => {
          if (item.products?.account_groups?.name) {
            subgroupNames.add(item.products.account_groups.name);
          }
        });
        
        return subgroupNames.size > 0 ? Array.from(subgroupNames).join(", ") : "-";
      };
      
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
        
        const accountsData = await Promise.all((data || []).map(async account => ({
          id: account.id,
          amount: Number(account.amount) || 0,
          payment_date: account.payment_date || '',
          description: account.description || '',
          notes: account.notes || '',
          document_type: account.document_type || '',
          document_number: account.document_number || '',
          status: account.status || '',
          subgroups: await fetchSubgroupsForAccount(account.id)
        })));
        
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
          for (const account of data) {
            allAccounts.push({
              id: account.id,
              amount: Number(account.amount) || 0,
              payment_date: account.payment_date || '',
              description: account.description || '',
              notes: account.notes || '',
              document_type: account.document_type || '',
              document_number: account.document_number || '',
              status: account.status || '',
              subgroups: await fetchSubgroupsForAccount(account.id)
            });
          }
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
      setCurrentPage(1);
    }
  }, [selectedEmployee, selectedYear, selectedMonths]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setShowInactiveEmployees(false);
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
      setShowInactiveEmployees(false);
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

  // Parse date string without timezone issues
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const calculateTotal = () => {
    return payableAccounts.reduce((sum, account) => sum + Number(account.amount), 0);
  };

  // Pagination calculations
  const totalItems = payableAccounts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = payableAccounts.slice(startIndex, endIndex);

  const exportToExcel = () => {
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
        ? format(parseLocalDate(account.payment_date), "dd/MM/yyyy")
        : "-",
      'Valor': formatCurrency(Number(account.amount)),
      'Subgrupo': account.subgroups || "-",
      'Documento': account.document_type && account.document_number
        ? `${account.document_type} ${account.document_number}`
        : "-",
      'Observações': account.notes || "-"
    }));

    // Adicionar linha do total
    exportData.push({
      'Data Pagamento': '',
      'Valor': formatCurrency(calculateTotal()),
      'Subgrupo': 'TOTAL DO PERÍODO',
      'Documento': '',
      'Observações': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    
    const periodText = `_${getFilterDescription().replace(/\s+/g, '_')}`;
    
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `Movimentacoes_${selectedEmployee.name.replace(/\s+/g, '_')}${periodText}.xlsx`);

    toast({
      title: "Sucesso",
      description: "Relatório Excel exportado com sucesso",
    });
  };

  const exportToPDF = () => {
    if (!selectedEmployee || !selectedStore || payableAccounts.length === 0) {
      toast({
        title: "Atenção",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Movimentações Financeiras - Funcionário", pageWidth / 2, 20, { align: "center" });
    
    // Info do funcionário e loja
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Loja: ${selectedStore.name}`, 14, 35);
    doc.text(`Funcionário: ${selectedEmployee.name}`, 14, 42);
    doc.text(`CPF: ${selectedEmployee.cpf}`, 14, 49);
    doc.text(`Período: ${getFilterDescription()}`, 14, 56);
    doc.text(`Data de emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 63);

    // Tabela de movimentações
    const tableData = payableAccounts.map(account => [
      account.payment_date ? format(parseLocalDate(account.payment_date), "dd/MM/yyyy") : "-",
      account.subgroups || "-",
      account.document_type && account.document_number
        ? `${account.document_type} ${account.document_number}`
        : "-",
      formatCurrency(Number(account.amount)),
      account.notes || "-",
    ]);

    autoTable(doc, {
      startY: 70,
      head: [["Data Pagamento", "Subgrupo", "Documento", "Valor", "Observações"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 45 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 45 },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total do Período: ${formatCurrency(calculateTotal())}`, pageWidth - 14, finalY, { align: "right" });

    const periodText = `_${getFilterDescription().replace(/\s+/g, '_')}`;
    doc.save(`Movimentacoes_${selectedEmployee.name.replace(/\s+/g, '_')}${periodText}.pdf`);

    toast({
      title: "Sucesso",
      description: "Relatório PDF exportado com sucesso",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90dvh]">
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

        <ScrollArea className="max-h-[70dvh]">
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
              <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {showInactiveEmployees ? "Funcionários Inativos" : "Funcionários Ativos"} - {selectedStore.name}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInactiveEmployees(!showInactiveEmployees);
                    fetchEmployees(selectedStore.id, !showInactiveEmployees);
                  }}
                  className="flex items-center gap-2"
                >
                  {showInactiveEmployees ? (
                    <>
                      <Users className="w-4 h-4" />
                      Funcionários Ativos
                    </>
                  ) : (
                    <>
                      <UserX className="w-4 h-4" />
                      Funcionários Inativos
                    </>
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                {employees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum funcionário {showInactiveEmployees ? "inativo" : "ativo"} encontrado
                  </div>
                ) : null}
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
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={employee.is_registered ? "default" : "secondary"}
                            className={employee.is_registered 
                              ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100" 
                              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-100"
                            }
                          >
                            {employee.is_registered ? "Registrado" : "Sem Registro"}
                          </Badge>
                          <Button variant="outline" size="sm">
                            Ver Movimentações
                          </Button>
                        </div>
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
                <TabsList className={`grid w-full ${canEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  {canEdit && <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>}
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Exportar
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Exportar Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer">
                          <FileText className="w-4 h-4 mr-2" />
                          Exportar PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                                <TableHead className="py-2">Data Pagamento</TableHead>
                                <TableHead className="py-2">Valor</TableHead>
                                <TableHead className="py-2">Subgrupo</TableHead>
                                <TableHead className="py-2">Documento</TableHead>
                                <TableHead className="py-2">Observações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedAccounts.map((account) => (
                                <TableRow key={account.id}>
                                  <TableCell className="py-2">
                                    {account.payment_date
                                      ? format(parseLocalDate(account.payment_date), "dd/MM/yyyy")
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="py-2 font-medium">
                                    {formatCurrency(Number(account.amount))}
                                  </TableCell>
                                  <TableCell className="py-2">{account.subgroups || "-"}</TableCell>
                                  <TableCell className="py-2">
                                    {account.document_type && account.document_number
                                      ? `${account.document_type} ${account.document_number}`
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="py-2 max-w-xs truncate">
                                    {account.notes || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          
                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <span className="text-sm text-muted-foreground">
                                {totalItems} movimentação(ões) • Página {currentPage} de {totalPages}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                  disabled={currentPage === 1}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  Anterior
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                  disabled={currentPage === totalPages}
                                >
                                  Próxima
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                          
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

                {canEdit && (
                  <TabsContent value="obrigacoes" className="space-y-4">
                    <EmployeeObligationsTab
                      employeeId={selectedEmployee.id}
                      employeeName={selectedEmployee.name}
                      storeId={selectedStore.id}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeMovementModal;