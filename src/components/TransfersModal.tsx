import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Edit, Trash2, Eye, Search, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TransferFormModal } from "./TransferFormModal";
import { validateCashControlPeriod } from "@/utils/periodValidation";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Transfer {
  id: string;
  store_id: string;
  transfer_date: string;
  source_account_id: string;
  destination_account_id: string;
  source_account_type: 'current' | 'cash' | 'card' | 'delivery';
  destination_account_type: 'current' | 'cash' | 'card' | 'delivery';
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  source_account_name?: string;
  destination_account_name?: string;
}

interface Store {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
  store_name?: string;
}

interface TransfersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEMS_PER_PAGE = 20;

export function TransfersModal({ open, onOpenChange }: TransfersModalProps) {
  const [userStoreIds, setUserStoreIds] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [viewingTransfer, setViewingTransfer] = useState<Transfer | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();
  const { canEdit } = useFinanceiroPermissions();

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Dados paginados
  const totalPages = Math.ceil(transfers.length / ITEMS_PER_PAGE);
  const paginatedTransfers = transfers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (open) {
      // Reset state when modal opens
      setTransfers([]);
      setHasSearched(false);
      setCurrentPage(1);
      setSelectedAccount("");
      setStartDate(undefined);
      setEndDate(undefined);
      
      const loadData = async () => {
        await fetchUserStores();
      };
      loadData();
    }
  }, [open]);

  // Carregar contas após obter as lojas do usuário
  useEffect(() => {
    if (open && userStoreIds.length > 0) {
      fetchAccounts();
    }
  }, [open, userStoreIds]);

  const fetchUserStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      const storeIds: string[] = [];

      if (profile?.role === 'admin') {
        // Admin vê todas as lojas
        const { data: allStores } = await supabase
          .from('stores')
          .select('id');
        
        if (allStores) {
          allStores.forEach(s => storeIds.push(s.id));
        }
      } else {
        // Usuário normal: buscar lojas autorizadas
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
      }

      setUserStoreIds(storeIds);

      // Também carregar lojas para o formulário
      if (storeIds.length > 0) {
        const { data: storesData } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', storeIds)
          .order('name');
        
        setStores(storesData || []);
      }
    } catch (error) {
      console.error('Erro ao carregar lojas do usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lojas",
        variant: "destructive",
      });
    }
  };

  const fetchAccounts = async () => {
    if (userStoreIds.length === 0) return;

    try {
      const accountPromises = [
        // Buscar current accounts vinculadas às lojas do usuário
        supabase
          .from('current_accounts')
          .select(`
            id, name,
            current_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar cash accounts vinculadas às lojas do usuário
        supabase
          .from('cash_accounts')
          .select(`
            id, name,
            cash_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar card accounts vinculadas às lojas do usuário
        supabase
          .from('card_accounts')
          .select(`
            id, name,
            card_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true),
        // Buscar delivery accounts vinculadas às lojas do usuário
        supabase
          .from('delivery_accounts')
          .select(`
            id, name,
            delivery_account_stores!inner (
              store_id,
              stores!inner (name)
            )
          `)
          .eq('is_active', true)
      ];

      const [currentResult, cashResult, cardResult, deliveryResult] = await Promise.all(accountPromises);

      // Filtrar apenas contas vinculadas às lojas do usuário
      const filterByUserStores = (accounts: any[], storeRelation: string) => {
        return accounts.filter(acc => {
          const storeAssociations = acc[storeRelation];
          if (!storeAssociations || !Array.isArray(storeAssociations)) return false;
          return storeAssociations.some((sa: any) => userStoreIds.includes(sa.store_id));
        });
      };

      const filteredCurrentAccounts = filterByUserStores(currentResult.data || [], 'current_account_stores');
      const filteredCashAccounts = filterByUserStores(cashResult.data || [], 'cash_account_stores');
      const filteredCardAccounts = filterByUserStores(cardResult.data || [], 'card_account_stores');
      const filteredDeliveryAccounts = filterByUserStores(deliveryResult.data || [], 'delivery_account_stores');

      const allAccounts = [
        ...filteredCurrentAccounts.map(acc => ({ 
          id: acc.id, 
          name: acc.name, 
          type: 'current' as const,
          store_name: acc.current_account_stores?.[0]?.stores?.name || ''
        })),
        ...filteredCashAccounts.map(acc => ({ 
          id: acc.id, 
          name: acc.name, 
          type: 'cash' as const,
          store_name: acc.cash_account_stores?.[0]?.stores?.name || ''
        })),
        ...filteredCardAccounts.map(acc => ({ 
          id: acc.id, 
          name: acc.name, 
          type: 'card' as const,
          store_name: acc.card_account_stores?.[0]?.stores?.name || ''
        })),
        ...filteredDeliveryAccounts.map(acc => ({ 
          id: acc.id, 
          name: acc.name, 
          type: 'delivery' as const,
          store_name: acc.delivery_account_stores?.[0]?.stores?.name || ''
        }))
      ];

      setAccounts(allAccounts);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const fetchTransfers = async () => {
    // Validar que a conta foi selecionada
    if (!selectedAccount) {
      toast({
        title: "Atenção",
        description: "Selecione uma conta ou 'Todas as contas' para filtrar",
        variant: "destructive",
      });
      return;
    }

    if (accounts.length === 0) {
      toast({
        title: "Aguarde",
        description: "Carregando contas...",
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    let query = supabase
      .from('transfers')
      .select('*')
      .order('transfer_date', { ascending: false });

    if (startDate) {
      query = query.gte('transfer_date', format(startDate, 'yyyy-MM-dd'));
    }

    if (endDate) {
      query = query.lte('transfer_date', format(endDate, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar transferências",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Enriquecer com nomes das contas
    const enrichedTransfers = data?.map(transfer => {
      const sourceAccount = accounts.find(acc => 
        acc.id === transfer.source_account_id && acc.type === transfer.source_account_type
      );
      const destinationAccount = accounts.find(acc => 
        acc.id === transfer.destination_account_id && acc.type === transfer.destination_account_type
      );

      return {
        ...transfer,
        source_account_name: sourceAccount?.name || 'Conta não encontrada',
        destination_account_name: destinationAccount?.name || 'Conta não encontrada',
      } as Transfer;
    }) || [];

    // Filtrar por conta se selecionada
    let filteredTransfers = enrichedTransfers;
    if (selectedAccount && selectedAccount !== "ALL_ACCOUNTS") {
      filteredTransfers = enrichedTransfers.filter(transfer => 
        transfer.source_account_id === selectedAccount || transfer.destination_account_id === selectedAccount
      );
    }

    setTransfers(filteredTransfers);
    setLoading(false);
  };

  const handleDelete = async (id: string, transferDate: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transferência?")) return;

    const paymentValidation = await validateCashControlPeriod.pagamento(transferDate);

    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message || "O período está bloqueado para operações de transferência",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir transferência",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Transferência excluída com sucesso",
    });

    fetchTransfers();
  };

  const handleEdit = (transfer: Transfer) => {
    setEditingTransfer(transfer);
    setShowForm(true);
  };

  const handleView = (transfer: Transfer) => {
    setViewingTransfer(transfer);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTransfer(null);
    setViewingTransfer(null);
    if (hasSearched) {
      fetchTransfers();
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      current: 'Conta Corrente',
      cash: 'Conta Caixa',
      card: 'Conta Cartão',
      delivery: 'Delivery'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportToPDF = () => {
    if (transfers.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Transferências", 14, 20);
    
    // Adicionar filtros aplicados
    let yPos = 30;
    doc.setFontSize(10);
    if (startDate) {
      doc.text(`Data Início: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPos);
      yPos += 6;
    }
    if (endDate) {
      doc.text(`Data Fim: ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPos);
      yPos += 6;
    }
    if (selectedAccount && selectedAccount !== "ALL_ACCOUNTS") {
      const account = accounts.find(a => a.id === selectedAccount);
      doc.text(`Conta: ${account?.name || 'N/A'}`, 14, yPos);
      yPos += 6;
    }

    const tableData = transfers.map(transfer => [
      format(new Date(transfer.transfer_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      transfer.source_account_name || '-',
      transfer.destination_account_name || '-',
      formatCurrency(transfer.amount),
      transfer.description || '-'
    ]);

    autoTable(doc, {
      head: [['Data', 'Conta Origem', 'Conta Destino', 'Valor', 'Histórico']],
      body: tableData,
      startY: yPos + 5,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`transferencias_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    
    toast({
      title: "Sucesso",
      description: "PDF exportado com sucesso",
    });
  };

  const exportToExcel = () => {
    if (transfers.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }

    const excelData = transfers.map(transfer => ({
      'Data': format(new Date(transfer.transfer_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      'Conta Origem': transfer.source_account_name || '-',
      'Tipo Origem': getAccountTypeLabel(transfer.source_account_type),
      'Conta Destino': transfer.destination_account_name || '-',
      'Tipo Destino': getAccountTypeLabel(transfer.destination_account_type),
      'Valor': transfer.amount,
      'Histórico': transfer.description || '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Transferências');
    XLSX.writeFile(wb, `transferencias_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    
    toast({
      title: "Sucesso",
      description: "Excel exportado com sucesso",
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transferências</DialogTitle>
            <DialogDescription>
              Gerencie as transferências entre suas contas financeiras
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="space-y-4 border-b pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Conta <span className="text-destructive">*</span></label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className={cn(!selectedAccount && "border-destructive")}>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ACCOUNTS">Todas as contas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({getAccountTypeLabel(account.type)}){account.store_name ? ` - ${account.store_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <Button onClick={fetchTransfers} disabled={loading}>
                  <Search className="w-4 h-4 mr-2" />
                  Filtrar
                </Button>
                {hasSearched && transfers.length > 0 && (
                  <>
                    <Button variant="outline" onClick={exportToPDF}>
                      <FileText className="w-4 h-4 mr-2" />
                      Exportar PDF
                    </Button>
                    <Button variant="outline" onClick={exportToExcel}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </>
                )}
              </div>
              
              {canEdit && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Transferência
                </Button>
              )}
            </div>
          </div>

          {/* Tabela */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta Origem</TableHead>
                  <TableHead>Conta Destino</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasSearched ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Use os filtros acima e clique em "Filtrar" para buscar transferências
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Nenhuma transferência encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        {format(new Date(transfer.transfer_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transfer.source_account_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getAccountTypeLabel(transfer.source_account_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transfer.destination_account_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getAccountTypeLabel(transfer.destination_account_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transfer.amount)}
                      </TableCell>
                      <TableCell>{transfer.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(transfer)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(transfer)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(transfer.id, transfer.transfer_date)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {hasSearched && transfers.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, transfers.length)} de {transfers.length} transferências
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransferFormModal
        open={showForm}
        onOpenChange={handleFormClose}
        transfer={editingTransfer || viewingTransfer}
        readonly={!!viewingTransfer}
        stores={stores}
        accounts={accounts}
      />
    </>
  );
}
