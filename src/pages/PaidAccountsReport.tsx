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
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const PaidAccountsReport = () => {
  const navigate = useNavigate();
  
  // Function to convert date input to local timezone format - prevents timezone issues
  const formatDateForDatabase = (dateString: string): string => {
    if (!dateString) return dateString;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Parse the date string and format properly
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return dateString;
  };

  const [filters, setFilters] = useState({
    payment_start: "",
    payment_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    supplier_id: "all",
    store_id: "all",
    product_id: "all",
    account_id: "all",
  });

  const [accounts, setAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchStores();
    fetchProducts();
  }, []);

  // Fetch available accounts when store is selected
  useEffect(() => {
    if (filters.store_id && filters.store_id !== "all") {
      fetchAccountsForStore(filters.store_id);
    } else {
      setAvailableAccounts([]);
      setFilters(prev => ({ ...prev, account_id: "all" }));
    }
  }, [filters.store_id]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name");
    setSuppliers(data || []);
  };

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("id, name");
    setStores(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name");
    setProducts(data || []);
  };

  const fetchAccountsForStore = async (storeId: string) => {
    try {
      const allAccounts: any[] = [];

      // Fetch cash accounts for the store
      const { data: cashAccountStores } = await supabase
        .from("cash_account_stores")
        .select("account_id, cash_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (cashAccountStores) {
        cashAccountStores.forEach((cas: any) => {
          if (cas.cash_accounts) {
            allAccounts.push({
              id: cas.cash_accounts.id,
              name: cas.cash_accounts.name,
              type: "Caixa"
            });
          }
        });
      }

      // Fetch current accounts for the store
      const { data: currentAccountStores } = await supabase
        .from("current_account_stores")
        .select("account_id, current_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (currentAccountStores) {
        currentAccountStores.forEach((cas: any) => {
          if (cas.current_accounts) {
            allAccounts.push({
              id: cas.current_accounts.id,
              name: cas.current_accounts.name,
              type: "Conta Corrente"
            });
          }
        });
      }

      // Fetch card accounts for the store
      const { data: cardAccountStores } = await supabase
        .from("card_account_stores")
        .select("account_id, card_accounts(id, name)")
        .eq("store_id", storeId);
      
      if (cardAccountStores) {
        cardAccountStores.forEach((cas: any) => {
          if (cas.card_accounts) {
            allAccounts.push({
              id: cas.card_accounts.id,
              name: cas.card_accounts.name,
              type: "Cartão"
            });
          }
        });
      }

      setAvailableAccounts(allAccounts);
    } catch (error) {
      console.error("Error fetching accounts for store:", error);
      setAvailableAccounts([]);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Fetch paid accounts with suppliers, employees, stores, installments and items with products
      const { data: allAccounts, error } = await supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(id, name),
          employees(id, name),
          stores(id, name),
          accounts_payable_installments(*),
          accounts_payable_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products(id, name, subgroup_id, account_groups:subgroup_id(id, name))
          )
        `) as { data: any[] | null; error: any };

      if (error) throw error;

      // If filtering by account, fetch the financial transactions to get the payment account
      let transactionsByPayable: { [key: string]: string } = {};
      if (filters.account_id && filters.account_id !== "all") {
        const { data: transactions } = await supabase
          .from("financial_transactions")
          .select("reference_id, account_id")
          .eq("reference_type", "accounts_payable")
          .eq("account_id", filters.account_id);
        
        if (transactions) {
          transactions.forEach((t: any) => {
            transactionsByPayable[t.reference_id] = t.account_id;
          });
        }
      }

      // Filter for paid accounts only and expand installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        if (account.status !== 'paid') return;

        // If filtering by account, check if this account was paid with the selected account
        if (filters.account_id && filters.account_id !== "all") {
          if (!transactionsByPayable[account.id]) return;
        }
        
        if (account.accounts_payable_installments && account.accounts_payable_installments.length > 0) {
          // Has installments - create one row per paid installment
          account.accounts_payable_installments.forEach((installment: any) => {
            if (installment.payment_date) { // Only paid installments
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                payment_date: installment.payment_date,
                installment_number: installment.installment_number,
                total_installments: account.accounts_payable_installments.length,
                installment_id: installment.id,
                payment_account_id: transactionsByPayable[account.id] || null
              });
            }
          });
        } else if (account.payment_date) {
          // No installments - single payment
          accountsData.push({
            ...account,
            installment_number: 1,
            total_installments: 1,
            payment_account_id: transactionsByPayable[account.id] || null
          });
        }
      });

      // Apply client-side filtering
      if (filters.payment_start || filters.payment_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.payment_date) return false;
          // Parse dates without timezone conversion to avoid date shifting
          const paymentDate = account.payment_date; // Keep as string YYYY-MM-DD
          const startDate = filters.payment_start;
          const endDate = filters.payment_end;
          
          if (startDate && paymentDate < startDate) return false;
          if (endDate && paymentDate > endDate) return false;
          return true;
        });
      }

      if (filters.competencia_start || filters.competencia_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.data_competencia) return false;
          // Parse dates without timezone conversion to avoid date shifting
          const competenciaDate = account.data_competencia; // Keep as string YYYY-MM-DD
          const startDate = filters.competencia_start;
          const endDate = filters.competencia_end;
          
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

      if (filters.supplier_id && filters.supplier_id !== "all") {
        accountsData = accountsData.filter((account: any) => account.supplier_id === filters.supplier_id);
      }

      if (filters.store_id && filters.store_id !== "all") {
        accountsData = accountsData.filter((account: any) => account.store_id === filters.store_id);
      }

      setAccounts(accountsData);
      toast({
        title: "Pesquisa realizada",
        description: `${accountsData.length} conta(s) encontrada(s)`,
      });
    } catch (error) {
      console.error("Error searching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas pagas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      payment_start: "",
      payment_end: "",
      competencia_start: "",
      competencia_end: "",
      created_start: "",
      created_end: "",
      supplier_id: "all",
      store_id: "all",
      product_id: "all",
      account_id: "all",
    });
    setAvailableAccounts([]);
    setAccounts([]);
  };

  const getFilterInfo = () => {
    let filterInfo = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Pagamento: ${start} a ${end}`);
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find(s => s.id === filters.supplier_id);
      if (supplier) filterInfo.push(`Fornecedor: ${supplier.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) filterInfo.push(`Loja: ${store.name}`);
    }
    if (filters.account_id !== "all") {
      const account = availableAccounts.find(a => a.id === filters.account_id);
      if (account) filterInfo.push(`Conta: ${account.name}`);
    }
    return filterInfo;
  };

  const getSupplierOrEmployeeName = (account: any) => {
    if (account.employee_id && account.employees?.name) {
      return account.employees.name;
    }
    return account.suppliers?.name || "N/A";
  };

  const exportToPDFResumido = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS PAGAS", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas já quitadas - Resumido", 105, 28, { align: "center" });
    
    const filterInfo = getFilterInfo();
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Table data
    const tableData = accounts.map(account => [
      account.description,
      getSupplierOrEmployeeName(account),
      account.stores?.name || "N/A",
      account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    ]);

    // Calculate total
    const total = accounts.reduce((sum, account) => sum + (account.amount || 0), 0);
    
    // Add total row
    tableData.push([
      { content: "TOTAL", colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
      { content: `${accounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Vencimento", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [34, 197, 94],
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

    doc.save("contas-pagas-resumido.pdf");
  };

  const exportToPDFDetalhado = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS PAGAS", 105, 20, { align: "center" });
    
    const filterInfo = getFilterInfo();
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 30);
    }
    
    // Build table data with product details
    const tableData: any[] = [];
    
    accounts.forEach(account => {
      // Main account row
      tableData.push([
        { content: account.description, styles: { fontStyle: "bold" } },
        { content: getSupplierOrEmployeeName(account), styles: { fontStyle: "bold" } },
        { content: account.stores?.name || "N/A", styles: { fontStyle: "bold" } },
        { content: account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A", styles: { fontStyle: "bold" } },
        { content: account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A", styles: { fontStyle: "bold" } },
        { content: account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A", styles: { fontStyle: "bold" } },
        { content: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista", styles: { fontStyle: "bold" } }
      ]);
      
      // Product detail rows
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const productName = item.products?.name || "Produto não encontrado";
          const subgroupName = item.products?.account_groups?.name || "-";
          const quantity = item.quantity || 0;
          const unitPrice = item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          const totalPrice = item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          
          tableData.push([
            { content: "", styles: { fontSize: 8 } },
            { content: `   ${productName}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: subgroupName, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: `${quantity}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: "", styles: { fontSize: 8 } },
            { content: totalPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: unitPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } }
          ]);
        });
      }
    });

    // Calculate total
    const total = accounts.reduce((sum, account) => sum + (account.amount || 0), 0);
    
    // Add total row
    tableData.push([
      { content: "TOTAL", colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
      { content: `${accounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Vencimento", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 37 : 27,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: "bold"
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

    doc.save("contas-pagas-detalhado.pdf");
  };

  const exportToPDFPorSubgrupo = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS PAGAS POR SUBGRUPO", 105, 20, { align: "center" });
    
    const filterInfo = getFilterInfo();
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 30);
    }
    
    // Group accounts by subgroup
    const accountsBySubgroup: { [key: string]: { subgroupName: string; accounts: any[] } } = {};
    
    accounts.forEach(account => {
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const subgroupId = item.products?.subgroup_id || 'sem-subgrupo';
          const subgroupName = item.products?.account_groups?.name || 'Sem Subgrupo';
          
          if (!accountsBySubgroup[subgroupId]) {
            accountsBySubgroup[subgroupId] = {
              subgroupName,
              accounts: []
            };
          }
          
          // Check if this account is already added for this subgroup
          const existingAccount = accountsBySubgroup[subgroupId].accounts.find(
            (a: any) => a.id === account.id && a.installment_id === account.installment_id
          );
          
          if (!existingAccount) {
            accountsBySubgroup[subgroupId].accounts.push({
              ...account,
              itemAmount: item.total_price || 0
            });
          }
        });
      } else {
        // Accounts without items go to "Sem Subgrupo"
        if (!accountsBySubgroup['sem-subgrupo']) {
          accountsBySubgroup['sem-subgrupo'] = {
            subgroupName: 'Sem Subgrupo',
            accounts: []
          };
        }
        accountsBySubgroup['sem-subgrupo'].accounts.push(account);
      }
    });
    
    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalAccounts = 0;
    
    Object.values(accountsBySubgroup).forEach(group => {
      // Subgroup header row
      tableData.push([
        { content: group.subgroupName, colSpan: 6, styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 } }
      ]);
      
      // Accounts for this subgroup
      let subgroupTotal = 0;
      group.accounts.forEach(account => {
        tableData.push([
          account.description,
          getSupplierOrEmployeeName(account),
          account.stores?.name || "N/A",
          account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
        ]);
        subgroupTotal += account.amount || 0;
        totalAccounts++;
      });
      
      // Subgroup subtotal
      tableData.push([
        { content: `Subtotal ${group.subgroupName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: `${group.accounts.length} conta(s)`, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }
      ]);
      
      grandTotal += subgroupTotal;
    });
    
    // Grand total row
    tableData.push([
      { content: "TOTAL GERAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [34, 197, 94], textColor: 255 } },
      { content: grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [34, 197, 94], textColor: 255 } },
      { content: `${totalAccounts} conta(s)`, styles: { fontStyle: "bold", fillColor: [34, 197, 94], textColor: 255 } }
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Loja", "Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 37 : 27,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: "bold"
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

    doc.save("contas-pagas-por-subgrupo.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: account.description,
      Fornecedor: getSupplierOrEmployeeName(account),
      Loja: account.stores?.name || "N/A",
      Vencimento: account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      Pagamento: account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A",
      Valor: account.amount || 0,
      Parcelas: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas Pagas");
    XLSX.writeFile(wb, "contas-pagas.xlsx");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/reports/accounts-payable")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Contas Pagas</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas já pagas</p>
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
                <Label htmlFor="payment_start">Data Pagamento (Início)</Label>
                <Input
                  id="payment_start"
                  type="date"
                  value={filters.payment_start}
                  onChange={(e) => setFilters(prev => ({...prev, payment_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="payment_end">Data Pagamento (Fim)</Label>
                <Input
                  id="payment_end"
                  type="date"
                  value={filters.payment_end}
                  onChange={(e) => setFilters(prev => ({...prev, payment_end: e.target.value}))}
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
                <Label>Fornecedor</Label>
                <Select value={filters.supplier_id} onValueChange={(value) => setFilters(prev => ({...prev, supplier_id: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
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
              <div>
                <Label>Conta</Label>
                <Select 
                  value={filters.account_id} 
                  onValueChange={(value) => setFilters(prev => ({...prev, account_id: value}))}
                  disabled={filters.store_id === "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filters.store_id === "all" ? "Selecione uma loja primeiro" : "Selecionar conta"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
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
                <CardTitle>Contas Pagas ({accounts.length})</CardTitle>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={exportToPDFResumido}>
                        Relatório Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFDetalhado}>
                        Relatório Detalhado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorSubgrupo}>
                        Relatório por Subgrupo
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
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account, index) => (
                    <TableRow key={`${account.id}-${account.installment_id || index}`}>
                      <TableCell>{account.description}</TableCell>
                      <TableCell>{account.employee_id && account.employees?.name ? account.employees.name : (account.suppliers?.name || "N/A")}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{account.due_date ? new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A"}</TableCell>
                      <TableCell>
                        {account.payment_date ? new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR") : "N/A"}
                      </TableCell>
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
                    <TableCell colSpan={5} className="text-right">Total:</TableCell>
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

export default PaidAccountsReport;