import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Download, Filter, FileDown, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const AccountsReceivableReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    due_start: "",
    due_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    creditor_id: "all",
    store_id: "all",
    product_id: "all",
  });

  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCreditors();
    fetchStores();
    fetchProducts();
  }, []);

  const fetchCreditors = async () => {
    const { data } = await supabase.from("suppliers").select("id, name").eq("is_active", true).eq("is_creditor", true);
    setCreditors(data || []);
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
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name");
    setProducts(data || []);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Fetch accounts with creditors, stores and installments - only pending or partial
      // Using paginated fetch to avoid Supabase 1000-row limit
      const allAccounts = await fetchAllPaginated(() =>
        supabase
          .from("accounts_receivable")
          .select(`
            *,
            suppliers!accounts_receivable_creditor_id_fkey(id, name),
            stores(id, name),
            accounts_receivable_installments(*),
            accounts_receivable_items(
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              accounts_receivable_item_allocations(
                allocation_type,
                animal_id,
                aspiration_id,
                embryo_transfer_id,
                pregnancy_id
              )
            )
          `)
          .in('status', ['pending', 'partial'])
      );

      // Expand installments - show only pending installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        if (account.accounts_receivable_installments && account.accounts_receivable_installments.length > 0) {
          // Has installments - create one row per pending installment
          account.accounts_receivable_installments.forEach((installment: any) => {
            if (!installment.payment_date) { // Only pending installments
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                installment_number: installment.installment_number,
                total_installments: account.accounts_receivable_installments.length,
                installment_id: installment.id
              });
            }
          });
        } else if (account.status === 'pending') {
          // No installments - single payment
          accountsData.push({
            ...account,
            installment_number: 1,
            total_installments: 1
          });
        }
      });

      // Apply client-side filtering for all filters
      if (filters.due_start || filters.due_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.due_date) return false;
          const dueDate = new Date(account.due_date);
          const startDate = filters.due_start ? new Date(filters.due_start) : null;
          const endDate = filters.due_end ? new Date(filters.due_end) : null;
          
          if (startDate && dueDate < startDate) return false;
          if (endDate && dueDate > endDate) return false;
          return true;
        });
      }

      if (filters.competencia_start || filters.competencia_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.issue_date) return false;
          const competenciaDate = new Date(account.issue_date);
          const startDate = filters.competencia_start ? new Date(filters.competencia_start) : null;
          const endDate = filters.competencia_end ? new Date(filters.competencia_end) : null;
          
          if (startDate && competenciaDate < startDate) return false;
          if (endDate && competenciaDate > endDate) return false;
          return true;
        });
      }

      if (filters.created_start || filters.created_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.created_at) return false;
          const createdDate = new Date(account.created_at);
          const startDate = filters.created_start ? new Date(filters.created_start + "T00:00:00") : null;
          const endDate = filters.created_end ? new Date(filters.created_end + "T23:59:59") : null;
          
          if (startDate && createdDate < startDate) return false;
          if (endDate && createdDate > endDate) return false;
          return true;
        });
      }

      if (filters.creditor_id && filters.creditor_id !== "all") {
        accountsData = accountsData.filter((account: any) => account.creditor_id === filters.creditor_id);
      }

      if (filters.store_id && filters.store_id !== "all") {
        accountsData = accountsData.filter((account: any) => account.store_id === filters.store_id);
      }

      // Sort by due_date ascending (earliest first)
      accountsData.sort((a: any, b: any) => {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return dateA - dateB;
      });

      setAccounts(accountsData);
      toast({
        title: "Pesquisa realizada",
        description: `${accountsData.length} conta(s) encontrada(s)`,
      });
    } catch (error) {
      console.error("Error searching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas a receber",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      due_start: "",
      due_end: "",
      competencia_start: "",
      competencia_end: "",
      created_start: "",
      created_end: "",
      creditor_id: "all",
      store_id: "all",
      product_id: "all",
    });
    setAccounts([]);
  };

  const getFilterInfo = () => {
    let filterInfo: string[] = [];
    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? new Date(filters.due_start + 'T00:00:00').toLocaleDateString("pt-BR") : "Início";
      const end = filters.due_end ? new Date(filters.due_end + 'T00:00:00').toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Vencimento: ${start} a ${end}`);
    }
    if (filters.creditor_id !== "all") {
      const creditor = creditors.find(s => s.id === filters.creditor_id);
      if (creditor) filterInfo.push(`Credor: ${creditor.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) filterInfo.push(`Loja: ${store.name}`);
    }
    return filterInfo;
  };

  const exportToPDFGeral = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A RECEBER", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não recebidas", 105, 28, { align: "center" });
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }
    
    // Table data
    const tableData = accounts.map(account => [
      getAccountTitle(account),
      account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    ]);

    // Calculate total
    const total = accounts.reduce((sum, account) => sum + (account.amount || 0), 0);
    
    // Add total row
    tableData.push([
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
      { content: `${accounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
    ]);

    autoTable(doc, {
      head: [["Título", "Credor", "Loja", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 20, right: 20 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-receber-geral.pdf");
  };

  const exportToPDFByCreditor = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A RECEBER", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Agrupado por Credor", 105, 28, { align: "center" });
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Group accounts by creditor
    const groupedByCreditor = accounts.reduce((groups: Record<string, any[]>, account) => {
      const creditorName = account.suppliers?.name || "Sem Credor";
      if (!groups[creditorName]) {
        groups[creditorName] = [];
      }
      groups[creditorName].push(account);
      return groups;
    }, {});

    let startY = filterInfo.length > 0 ? 45 : 35;
    let grandTotal = 0;
    let grandCount = 0;

    // Sort creditors alphabetically
    const sortedCreditors = Object.keys(groupedByCreditor).sort();

    sortedCreditors.forEach((creditorName, index) => {
      const creditorAccounts = groupedByCreditor[creditorName];
      const creditorTotal = creditorAccounts.reduce((sum: number, acc: any) => sum + (acc.amount || 0), 0);
      grandTotal += creditorTotal;
      grandCount += creditorAccounts.length;

      // Creditor header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Credor: ${creditorName}`, 20, startY);
      startY += 5;

      const tableData = creditorAccounts.map((account: any) => [
        getAccountTitle(account),
        account.stores?.name || "N/A",
        new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
      ]);

      // Add subtotal row
      tableData.push([
        { content: `Subtotal ${creditorName}`, colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
        { content: creditorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${creditorAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Loja", "Vencimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: startY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: 20, right: 20 }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // Check if we need a new page
      if (startY > 250 && index < sortedCreditors.length - 1) {
        doc.addPage();
        startY = 20;
      }
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${grandCount} parcelas)`, 20, startY + 5);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-receber-por-credor.pdf");
  };

  const exportToPDFByMonth = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A RECEBER", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Agrupado por Mês de Vencimento", 105, 28, { align: "center" });
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Group accounts by month/year
    const groupedByMonth = accounts.reduce((groups: Record<string, { name: string; accounts: any[] }>, account) => {
      const date = new Date(account.due_date + 'T00:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      if (!groups[monthKey]) {
        groups[monthKey] = { name: monthName, accounts: [] };
      }
      groups[monthKey].accounts.push(account);
      return groups;
    }, {});

    let startY = filterInfo.length > 0 ? 45 : 35;
    let grandTotal = 0;
    let grandCount = 0;

    // Sort months chronologically
    const sortedMonths = Object.keys(groupedByMonth).sort();

    sortedMonths.forEach((monthKey, index) => {
      const monthData = groupedByMonth[monthKey];
      const monthAccounts = monthData.accounts;
      const monthTotal = monthAccounts.reduce((sum: number, acc: any) => sum + (acc.amount || 0), 0);
      grandTotal += monthTotal;
      grandCount += monthAccounts.length;

      // Month header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Mês: ${monthData.name.charAt(0).toUpperCase() + monthData.name.slice(1)}`, 20, startY);
      startY += 5;

      const tableData = monthAccounts.map((account: any) => [
        getAccountTitle(account),
        account.suppliers?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
      ]);

      // Add subtotal row
      tableData.push([
        { content: `Subtotal ${monthData.name.charAt(0).toUpperCase() + monthData.name.slice(1)}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
        { content: monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${monthAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Credor", "Loja", "Vencimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: startY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: 20, right: 20 }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // Check if we need a new page
      if (startY > 250 && index < sortedMonths.length - 1) {
        doc.addPage();
        startY = 20;
      }
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${grandCount} parcelas)`, 20, startY + 5);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-receber-por-mes.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: getAccountTitle(account),
      Credor: account.suppliers?.name || "N/A",
      Loja: account.stores?.name || "N/A",
      Vencimento: new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      Valor: account.amount || 0,
      Parcelas: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
    XLSX.writeFile(wb, "contas-a-receber.xlsx");
  };

  // Helper function to get the title based on document type and number
  const getAccountTitle = (account: any) => {
    const docType = account.document_type || '';
    const docNumber = account.document_number || '';
    
    if (docType && docNumber) {
      return `${docType} ${docNumber}`;
    } else if (docType) {
      return docType;
    } else if (docNumber) {
      return docNumber;
    }
    return account.description || 'N/A';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Contas a Receber</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas a receber</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Configure os filtros para o relatório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="due_start">Data Vencimento (Início)</Label>
                <Input
                  id="due_start"
                  type="date"
                  value={filters.due_start}
                  onChange={(e) => setFilters(prev => ({...prev, due_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="due_end">Data Vencimento (Fim)</Label>
                <Input
                  id="due_end"
                  type="date"
                  value={filters.due_end}
                  onChange={(e) => setFilters(prev => ({...prev, due_end: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_start">Data Competência (Início)</Label>
                <Input
                  id="competencia_start"
                  type="date"
                  value={filters.competencia_start}
                  onChange={(e) => setFilters(prev => ({...prev, competencia_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_end">Data Competência (Fim)</Label>
                <Input
                  id="competencia_end"
                  type="date"
                  value={filters.competencia_end}
                  onChange={(e) => setFilters(prev => ({...prev, competencia_end: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="created_start">Data Cadastro (Início)</Label>
                <Input
                  id="created_start"
                  type="date"
                  value={filters.created_start}
                  onChange={(e) => setFilters(prev => ({...prev, created_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="created_end">Data Cadastro (Fim)</Label>
                <Input
                  id="created_end"
                  type="date"
                  value={filters.created_end}
                  onChange={(e) => setFilters(prev => ({...prev, created_end: e.target.value}))}
                />
              </div>
              <div>
                <Label>Credor</Label>
                <Select value={filters.creditor_id} onValueChange={(value) => setFilters(prev => ({...prev, creditor_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar credor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {creditors.map((creditor) => (
                      <SelectItem key={creditor.id} value={creditor.id}>
                        {creditor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja</Label>
                <Select value={filters.store_id} onValueChange={(value) => setFilters(prev => ({...prev, store_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar loja" />
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
              <div>
                <Label>Produto</Label>
                <Select value={filters.product_id} onValueChange={(value) => setFilters(prev => ({...prev, product_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Pesquisando..." : "Pesquisar"}
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Contas a Receber ({accounts.length})</CardTitle>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={exportToPDFGeral}>
                        Geral
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFByCreditor}>
                        Por Credor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFByMonth}>
                        Por Mês
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={exportToExcel} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account, index) => (
                    <TableRow key={`${account.id}-${index}`}>
                      <TableCell>{getAccountTitle(account)}</TableCell>
                      <TableCell>{account.suppliers?.name || "N/A"}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {account.amount?.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        }) || "N/A"}
                      </TableCell>
                      <TableCell>
                        {account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="border-t-2 font-bold bg-muted/50">
                    <TableCell colSpan={4} className="text-right">Total:</TableCell>
                    <TableCell>
                      {accounts.reduce((sum, account) => sum + (account.amount || 0), 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </TableCell>
                    <TableCell>{accounts.length} parcela(s)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AccountsReceivableReport;