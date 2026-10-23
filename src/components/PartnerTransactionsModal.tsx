import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Pencil, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown, FileDown, FileText, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { validatePartnerTransactionPeriod } from "@/utils/partnerTransactionValidation";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PartnerTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Store {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
}

interface PartnerTransaction {
  id: string;
  store_id: string;
  partner_id: string;
  account_id: string;
  account_type: string;
  transaction_type: string;
  payment_date: string;
  competence_date: string;
  amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  stores?: { name: string };
  partners?: { name: string };
}

type SortField = 'payment_date' | 'partner' | 'store' | 'transaction_type' | 'amount';
type SortDirection = 'asc' | 'desc';

export const PartnerTransactionsModal = ({ open, onOpenChange }: PartnerTransactionsModalProps) => {
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<PartnerTransaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<PartnerTransaction | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('payment_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPartnerId, setFilterPartnerId] = useState("");
  const [filterStoreId, setFilterStoreId] = useState("");
  const [filterType, setFilterType] = useState("");

  // Form state
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAccountType, setSelectedAccountType] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>('aporte');
  const [paymentDate, setPaymentDate] = useState("");
  const [competenceDate, setCompetenceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const { canEdit } = useFinanceiroPermissions();

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply filters
    if (filterStartDate) {
      filtered = filtered.filter(t => t.payment_date >= filterStartDate);
    }
    if (filterEndDate) {
      filtered = filtered.filter(t => t.payment_date <= filterEndDate);
    }
    if (filterPartnerId) {
      filtered = filtered.filter(t => t.partner_id === filterPartnerId);
    }
    if (filterStoreId) {
      filtered = filtered.filter(t => t.store_id === filterStoreId);
    }
    if (filterType) {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'payment_date':
          comparison = a.payment_date.localeCompare(b.payment_date);
          break;
        case 'partner':
          comparison = (a.partners?.name || '').localeCompare(b.partners?.name || '');
          break;
        case 'store':
          comparison = (a.stores?.name || '').localeCompare(b.stores?.name || '');
          break;
        case 'transaction_type':
          comparison = a.transaction_type.localeCompare(b.transaction_type);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filterStartDate, filterEndDate, filterPartnerId, filterStoreId, filterType, sortField, sortDirection]);

  // Paginated transactions for current page
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedTransactions, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPartnerId("");
    setFilterStoreId("");
    setFilterType("");
    setCurrentPage(1);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_transactions")
        .select(`
          *,
          stores:store_id(name),
          partners:partner_id(name)
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar transações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        const { data } = await supabase.from("stores").select("id, name").order('name');
        setStores(data || []);
      } else {
        const storeIds: string[] = [];
        if (profile?.store_id) storeIds.push(profile.store_id);
        
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);
        
        userStores?.forEach(us => {
          if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
        });

        if (storeIds.length > 0) {
          const { data } = await supabase.from("stores").select("id, name").in('id', storeIds).order('name');
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchAllPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setAllPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
    }
  };

  const fetchPartnersByStore = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from("store_partners")
        .select(`
          partner_id,
          partners:partner_id(id, name)
        `)
        .eq("store_id", storeId);

      if (error) throw error;
      
      const partnersList = data?.map(sp => ({
        id: (sp.partners as any).id,
        name: (sp.partners as any).name
      })) || [];
      
      setPartners(partnersList);
    } catch (error) {
      console.error("Error fetching partners:", error);
      setPartners([]);
    }
  };

  const fetchAccountsByStore = async (storeId: string) => {
    try {
      const accountsList: Account[] = [];

      // Fetch current accounts
      const { data: currentAccounts } = await supabase
        .from("current_account_stores")
        .select("current_accounts:account_id(id, name)")
        .eq("store_id", storeId);
      
      currentAccounts?.forEach(ca => {
        if (ca.current_accounts) {
          accountsList.push({
            id: (ca.current_accounts as any).id,
            name: `Conta Corrente - ${(ca.current_accounts as any).name}`,
            type: 'current'
          });
        }
      });

      // Fetch cash accounts
      const { data: cashAccounts } = await supabase
        .from("cash_account_stores")
        .select("cash_accounts:account_id(id, name)")
        .eq("store_id", storeId);
      
      cashAccounts?.forEach(ca => {
        if (ca.cash_accounts) {
          accountsList.push({
            id: (ca.cash_accounts as any).id,
            name: `Caixa - ${(ca.cash_accounts as any).name}`,
            type: 'cash'
          });
        }
      });

      // Fetch card accounts
      const { data: cardAccounts } = await supabase
        .from("card_account_stores")
        .select("card_accounts:account_id(id, name)")
        .eq("store_id", storeId);
      
      cardAccounts?.forEach(ca => {
        if (ca.card_accounts) {
          accountsList.push({
            id: (ca.card_accounts as any).id,
            name: `Cartão - ${(ca.card_accounts as any).name}`,
            type: 'card'
          });
        }
      });

      // Fetch delivery accounts
      const { data: deliveryAccounts } = await supabase
        .from("delivery_account_stores")
        .select("delivery_accounts:account_id(id, name)")
        .eq("store_id", storeId);
      
      deliveryAccounts?.forEach(da => {
        if (da.delivery_accounts) {
          accountsList.push({
            id: (da.delivery_accounts as any).id,
            name: `Delivery - ${(da.delivery_accounts as any).name}`,
            type: 'delivery'
          });
        }
      });

      setAccounts(accountsList);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTransactions();
      fetchStores();
      fetchAllPartners();
    }
  }, [open]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchPartnersByStore(selectedStoreId);
      fetchAccountsByStore(selectedStoreId);
      setSelectedPartnerId("");
      setSelectedAccountId("");
      setSelectedAccountType("");
    } else {
      setPartners([]);
      setAccounts([]);
    }
  }, [selectedStoreId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, filterPartnerId, filterStoreId, filterType]);

  const resetForm = () => {
    setSelectedStoreId("");
    setSelectedPartnerId("");
    setSelectedAccountId("");
    setSelectedAccountType("");
    setTransactionType("aporte");
    setPaymentDate("");
    setCompetenceDate("");
    setAmount("");
    setNotes("");
    setEditingId(null);
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setSelectedAccountType(account.type);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedPartnerId || !selectedAccountId || !paymentDate || !competenceDate || !amount) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validar período antes de salvar
      const competenceValidation = await validatePartnerTransactionPeriod.competencia(competenceDate, selectedStoreId);
      if (competenceValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: competenceValidation.message,
          variant: "destructive",
        });
        return;
      }

      const paymentValidation = await validatePartnerTransactionPeriod.pagamento(paymentDate, selectedStoreId);
      if (paymentValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: paymentValidation.message,
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const transactionData = {
        store_id: selectedStoreId,
        partner_id: selectedPartnerId,
        account_id: selectedAccountId,
        account_type: selectedAccountType,
        transaction_type: transactionType,
        payment_date: paymentDate,
        competence_date: competenceDate,
        amount: parseFloat(amount),
        notes: notes || null,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("partner_transactions")
          .update(transactionData)
          .eq("id", editingId);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Transação atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("partner_transactions")
          .insert(transactionData);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Transação cadastrada com sucesso",
        });
      }

      resetForm();
      setShowForm(false);
      fetchTransactions();
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar transação",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (transaction: PartnerTransaction) => {
    // Validate period before editing - use store_id from transaction
    const paymentValidation = await validatePartnerTransactionPeriod.pagamento(transaction.payment_date, transaction.store_id);
    const competenceValidation = await validatePartnerTransactionPeriod.competencia(transaction.competence_date, transaction.store_id);

    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (competenceValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    setEditingId(transaction.id);
    setSelectedStoreId(transaction.store_id);
    setTransactionType(transaction.transaction_type);
    setPaymentDate(transaction.payment_date);
    setCompetenceDate(transaction.competence_date);
    setAmount(transaction.amount.toString());
    setNotes(transaction.notes || "");
    
    // Load partners and accounts for the store
    await fetchPartnersByStore(transaction.store_id);
    await fetchAccountsByStore(transaction.store_id);
    
    setSelectedPartnerId(transaction.partner_id);
    setSelectedAccountId(transaction.account_id);
    setSelectedAccountType(transaction.account_type);
    setShowForm(true);
  };

  const handleDeleteClick = async (transaction: PartnerTransaction) => {
    // Validate period before deleting - use store_id from transaction
    const paymentValidation = await validatePartnerTransactionPeriod.pagamento(transaction.payment_date, transaction.store_id);
    const competenceValidation = await validatePartnerTransactionPeriod.competencia(transaction.competence_date, transaction.store_id);

    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (competenceValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    try {
      const { error } = await supabase
        .from("partner_transactions")
        .delete()
        .eq("id", transactionToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso",
      });
      fetchTransactions();
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir transação",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  // Export functions
  const getFilterInfo = () => {
    const parts: string[] = [];
    if (filterStartDate) parts.push(`De: ${format(new Date(filterStartDate + 'T00:00:00'), 'dd/MM/yyyy')}`);
    if (filterEndDate) parts.push(`Até: ${format(new Date(filterEndDate + 'T00:00:00'), 'dd/MM/yyyy')}`);
    if (filterStoreId) {
      const store = stores.find(s => s.id === filterStoreId);
      if (store) parts.push(`Loja: ${store.name}`);
    }
    if (filterPartnerId) {
      const partner = allPartners.find(p => p.id === filterPartnerId);
      if (partner) parts.push(`Sócio: ${partner.name}`);
    }
    if (filterType) parts.push(`Tipo: ${filterType === 'aporte' ? 'Aporte' : 'Retirada'}`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos os registros';
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Aportes e Retiradas", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Filtros: ${getFilterInfo()}`, 14, 22);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    const tableData = filteredAndSortedTransactions.map(t => [
      format(new Date(t.payment_date + 'T00:00:00'), 'dd/MM/yyyy'),
      t.partners?.name || '-',
      t.stores?.name || '-',
      t.transaction_type === 'aporte' ? 'Aporte' : 'Retirada',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)
    ]);

    const total = filteredAndSortedTransactions.reduce((sum, t) => {
      return sum + (t.transaction_type === 'aporte' ? t.amount : -t.amount);
    }, 0);

    autoTable(doc, {
      startY: 35,
      head: [['Data Pagamento', 'Sócio', 'Loja', 'Tipo', 'Valor']],
      body: tableData,
      foot: [['', '', '', 'Total Líquido:', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.save(`aportes-retiradas-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
    toast({ title: "Sucesso", description: "PDF exportado com sucesso" });
  };

  const exportToExcel = () => {
    const data = filteredAndSortedTransactions.map(t => ({
      'Data Pagamento': format(new Date(t.payment_date + 'T00:00:00'), 'dd/MM/yyyy'),
      'Data Competência': format(new Date(t.competence_date + 'T00:00:00'), 'dd/MM/yyyy'),
      'Sócio': t.partners?.name || '-',
      'Loja': t.stores?.name || '-',
      'Tipo': t.transaction_type === 'aporte' ? 'Aporte' : 'Retirada',
      'Valor': t.amount,
      'Observações': t.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aportes e Retiradas");
    XLSX.writeFile(wb, `aportes-retiradas-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
    toast({ title: "Sucesso", description: "Excel exportado com sucesso" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aportes e Retiradas</DialogTitle>
            <DialogDescription>
              Gerencie os aportes e retiradas dos sócios
            </DialogDescription>
          </DialogHeader>

          {!showForm && !viewingTransaction ? (
            <>
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <div className="space-y-1">
                  <Label className="text-xs">Data Inicial</Label>
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Final</Label>
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Loja</Label>
                  <Select value={filterStoreId} onValueChange={setFilterStoreId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sócio</Label>
                  <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {allPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aporte">Aporte</SelectItem>
                      <SelectItem value="retirada">Retirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions bar */}
              <div className="flex justify-between items-center mb-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={exportToPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToExcel}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {canEdit && (
                    <Button size="sm" onClick={() => setShowForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar
                    </Button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 py-1"
                          onClick={() => handleSort('payment_date')}
                        >
                          <div className="flex items-center">
                            Data Pagamento
                            {getSortIcon('payment_date')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 py-1"
                          onClick={() => handleSort('partner')}
                        >
                          <div className="flex items-center">
                            Sócio
                            {getSortIcon('partner')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 py-1"
                          onClick={() => handleSort('store')}
                        >
                          <div className="flex items-center">
                            Loja
                            {getSortIcon('store')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 py-1"
                          onClick={() => handleSort('transaction_type')}
                        >
                          <div className="flex items-center">
                            Tipo
                            {getSortIcon('transaction_type')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-right py-1"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center justify-end">
                            Valor
                            {getSortIcon('amount')}
                          </div>
                        </TableHead>
                        <TableHead className="text-center py-1">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                            Nenhuma transação encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="h-8">
                            <TableCell className="py-1">
                              {format(new Date(transaction.payment_date + 'T00:00:00'), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="py-1">{transaction.partners?.name}</TableCell>
                            <TableCell className="py-1">{transaction.stores?.name}</TableCell>
                            <TableCell className="py-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                transaction.transaction_type === 'aporte' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {transaction.transaction_type === 'aporte' ? 'Aporte' : 'Retirada'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right py-1">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(transaction.amount)}
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setViewingTransaction(transaction)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canEdit && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(transaction)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleDeleteClick(transaction)}
                                    >
                                      <Trash2 className="h-4 w-4" />
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Exibindo {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedTransactions.length)} de {filteredAndSortedTransactions.length} registros
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
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
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </>
          ) : viewingTransaction ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Detalhes da Transação</h3>
                <Button variant="ghost" size="icon" onClick={() => setViewingTransaction(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Loja</Label>
                  <p className="font-medium">{viewingTransaction.stores?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sócio</Label>
                  <p className="font-medium">{viewingTransaction.partners?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <p className="font-medium capitalize">{viewingTransaction.transaction_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor</Label>
                  <p className="font-medium">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(viewingTransaction.amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Pagamento</Label>
                  <p className="font-medium">
                    {format(new Date(viewingTransaction.payment_date + 'T00:00:00'), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Competência</Label>
                  <p className="font-medium">
                    {format(new Date(viewingTransaction.competence_date + 'T00:00:00'), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Observações</Label>
                  <p className="font-medium">{viewingTransaction.notes || "-"}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingTransaction(null)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {editingId ? "Editar Transação" : "Nova Transação"}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => { resetForm(); setShowForm(false); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loja *</Label>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId} disabled={!!editingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
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

                <div className="space-y-2">
                  <Label>Sócio *</Label>
                  <Select 
                    value={selectedPartnerId} 
                    onValueChange={setSelectedPartnerId}
                    disabled={!selectedStoreId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedStoreId ? "Selecione o sócio" : "Selecione a loja primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Conta *</Label>
                  <Select 
                    value={selectedAccountId} 
                    onValueChange={handleAccountSelect}
                    disabled={!selectedStoreId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedStoreId ? "Selecione a conta" : "Selecione a loja primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={transactionType} onValueChange={(v) => setTransactionType(v as 'aporte' | 'retirada')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aporte">Aporte</SelectItem>
                      <SelectItem value="retirada">Retirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Pagamento *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Competência *</Label>
                  <Input
                    type="date"
                    value={competenceDate}
                    onChange={(e) => setCompetenceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações opcionais..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingId ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
