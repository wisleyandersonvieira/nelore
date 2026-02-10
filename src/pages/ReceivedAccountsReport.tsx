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

const ReceivedAccountsReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    payment_start: "",
    payment_end: "",
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
    const { data } = await supabase.from("creditors").select("id, name");
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
      // Fetch accounts with creditors, stores, installments and items with products including subgroups
      const { data: allAccounts, error } = await supabase
        .from("accounts_receivable")
        .select(`
          *,
          creditors(id, name),
          stores(id, name),
          accounts_receivable_installments(*),
          accounts_receivable_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products(id, name, subgroup_id, account_groups:subgroup_id(id, name))
          )
        `) as { data: any[] | null; error: any };

      if (error) throw error;

      // Fetch payments data
      const { data: paymentsData } = await supabase
        .from("accounts_receivable_payments")
        .select(`*`);

      // Create a map of payments by installment_id
      const paymentsByInstallmentId: { [key: string]: any } = {};
      (paymentsData || []).forEach((payment: any) => {
        paymentsByInstallmentId[payment.installment_id] = payment;
      });

      // Filter for paid or partial accounts and expand installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        // Include both 'paid' and 'partial' status - we want to show paid installments
        if (account.status !== 'paid' && account.status !== 'partial') return;
        
        if (account.accounts_receivable_installments && account.accounts_receivable_installments.length > 0) {
          // Has installments - create one row per paid installment
          account.accounts_receivable_installments.forEach((installment: any) => {
            if (installment.payment_date) { // Only paid installments
              const payment = paymentsByInstallmentId[installment.id];
              const interestAmount = payment?.interest_amount || 0;
              const discountAmount = payment?.discount_amount || 0;
              // Calculate actual received amount: installment + interest - discount
              const actualAmount = parseFloat(installment.amount) + parseFloat(interestAmount) - parseFloat(discountAmount);
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: actualAmount,
                original_amount: installment.amount,
                payment_date: installment.payment_date,
                installment_number: installment.installment_number,
                total_installments: account.accounts_receivable_installments.length,
                installment_id: installment.id,
                interest_amount: interestAmount,
                discount_amount: discountAmount
              });
            }
          });
        } else if (account.payment_date) {
          // No installments - single payment
          accountsData.push({
            ...account,
            original_amount: account.amount,
            installment_number: 1,
            total_installments: 1,
            interest_amount: 0,
            discount_amount: 0
          });
        }
      });

      // Apply client-side filtering
      if (filters.payment_start || filters.payment_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.payment_date) return false;
          const paymentDate = new Date(account.payment_date);
          const startDate = filters.payment_start ? new Date(filters.payment_start) : null;
          const endDate = filters.payment_end ? new Date(filters.payment_end) : null;
          
          if (startDate && paymentDate < startDate) return false;
          if (endDate && paymentDate > endDate) return false;
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

      setAccounts(accountsData);
      toast({
        title: "Pesquisa realizada",
        description: `${accountsData.length} conta(s) encontrada(s)`,
      });
    } catch (error) {
      console.error("Error searching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas recebidas",
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
      creditor_id: "all",
      store_id: "all",
      product_id: "all",
    });
    setAccounts([]);
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS RECEBIDAS", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas já recebidas", 105, 28, { align: "center" });
    
    // Date range info
    let filterInfo = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Recebimento: ${start} a ${end}`);
    }
    if (filters.creditor_id !== "all") {
      const creditor = creditors.find(s => s.id === filters.creditor_id);
      if (creditor) filterInfo.push(`Credor: ${creditor.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) filterInfo.push(`Loja: ${store.name}`);
    }
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }
    
    // Table data
    const tableData = accounts.map(account => [
      getAccountTitle(account),
      account.creditors?.name || "N/A",
      account.stores?.name || "N/A",
      new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
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
      head: [["Título", "Credor", "Loja", "Vencimento", "Recebimento", "Valor", "Parcelas"]],
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

    doc.save("contas-recebidas.pdf");
  };

  // Get filter info for PDF headers
  const getFilterInfo = () => {
    let filterInfo = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Recebimento: ${start} a ${end}`);
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

  // Export PDF by Creditor
  const exportToPDFPorCredor = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Group accounts by creditor
    const accountsByCreditor: { [key: string]: any[] } = {};
    accounts.forEach(account => {
      const creditorName = account.creditors?.name || "Sem Credor";
      if (!accountsByCreditor[creditorName]) {
        accountsByCreditor[creditorName] = [];
      }
      accountsByCreditor[creditorName].push(account);
    });

    // Sort creditors alphabetically
    const sortedCreditors = Object.keys(accountsByCreditor).sort();
    
    let currentY = 20;
    let isFirstPage = true;
    let grandTotal = 0;
    let grandCount = 0;

    sortedCreditors.forEach((creditorName, creditorIndex) => {
      const creditorAccounts = accountsByCreditor[creditorName];
      const creditorTotal = creditorAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);
      grandTotal += creditorTotal;
      grandCount += creditorAccounts.length;

      // Check if we need a new page
      if (!isFirstPage && currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      if (isFirstPage) {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DE CONTAS RECEBIDAS POR CREDOR", 105, currentY, { align: "center" });
        currentY += 10;
        
        if (filterInfo.length > 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`Filtros: ${filterInfo.join(" | ")}`, 20, currentY);
          currentY += 10;
        }
        isFirstPage = false;
      }

      // Creditor header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${creditorName}`, 20, currentY);
      currentY += 2;

      const tableData = creditorAccounts.map(account => [
        getAccountTitle(account),
        account.stores?.name || "N/A",
        new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
      ]);

      // Add subtotal row
      tableData.push([
        { content: `Subtotal ${creditorName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
        { content: creditorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${creditorAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Loja", "Vencimento", "Recebimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 20, right: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${grandCount} parcela(s))`, 20, currentY);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-recebidas-por-credor.pdf");
  };

  // Export PDF by Month
  const exportToPDFPorMes = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Group accounts by month/year of payment_date
    const accountsByMonth: { [key: string]: any[] } = {};
    accounts.forEach(account => {
      const paymentDate = new Date(account.payment_date + 'T00:00:00');
      const monthYear = `${String(paymentDate.getMonth() + 1).padStart(2, '0')}/${paymentDate.getFullYear()}`;
      if (!accountsByMonth[monthYear]) {
        accountsByMonth[monthYear] = [];
      }
      accountsByMonth[monthYear].push(account);
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(accountsByMonth).sort((a, b) => {
      const [monthA, yearA] = a.split('/').map(Number);
      const [monthB, yearB] = b.split('/').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
    
    let currentY = 20;
    let isFirstPage = true;
    let grandTotal = 0;
    let grandCount = 0;

    sortedMonths.forEach((monthYear) => {
      const monthAccounts = accountsByMonth[monthYear];
      const monthTotal = monthAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);
      grandTotal += monthTotal;
      grandCount += monthAccounts.length;

      if (!isFirstPage && currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      if (isFirstPage) {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DE CONTAS RECEBIDAS POR MÊS", 105, currentY, { align: "center" });
        currentY += 10;
        
        if (filterInfo.length > 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`Filtros: ${filterInfo.join(" | ")}`, 20, currentY);
          currentY += 10;
        }
        isFirstPage = false;
      }

      // Month header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Mês: ${monthYear}`, 20, currentY);
      currentY += 2;

      const tableData = monthAccounts.map(account => [
        getAccountTitle(account),
        account.creditors?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
      ]);

      // Add subtotal row
      tableData.push([
        { content: `Subtotal ${monthYear}`, colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
        { content: monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${monthAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Credor", "Loja", "Vencimento", "Recebimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 20, right: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${grandCount} parcela(s))`, 20, currentY);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-recebidas-por-mes.pdf");
  };

  // Export PDF by Subgroup
  const exportToPDFPorSubgrupo = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    // Process accounts and group by subgroup
    const accountsBySubgroup: { [key: string]: any[] } = {};
    
    accounts.forEach(account => {
      const items = account.accounts_receivable_items || [];
      const originalTotalAmount = parseFloat(account.total_amount) || parseFloat(account.original_amount) || parseFloat(account.amount) || 0;
      const interestAmount = parseFloat(account.interest_amount) || 0;
      const discountAmount = parseFloat(account.discount_amount) || 0;
      
      // Calculate installment proportion for parceled accounts
      const installmentProportion = account.total_installments > 1 
        ? 1 / account.total_installments 
        : 1;
      
      if (items.length > 0) {
        // Calculate total of items
        const itemsTotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.total_price) || 0), 0);
        
        items.forEach((item: any) => {
          const subgroupName = item.products?.account_groups?.name || "Sem Subgrupo";
          const itemProportion = itemsTotal > 0 ? (parseFloat(item.total_price) || 0) / itemsTotal : 1 / items.length;
          
          // Calculate proportional amount for this item considering installment
          let itemAmount = (parseFloat(item.total_price) || 0) * installmentProportion;
          
          // Distribute interest and discount proportionally to each item
          const itemInterest = interestAmount * itemProportion;
          const itemDiscount = discountAmount * itemProportion;
          itemAmount = itemAmount + itemInterest - itemDiscount;
          
          if (!accountsBySubgroup[subgroupName]) {
            accountsBySubgroup[subgroupName] = [];
          }
          
          accountsBySubgroup[subgroupName].push({
            ...account,
            amount: itemAmount,
            productName: item.products?.name || "N/A",
            installmentInfo: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
          });
        });
      } else {
        // No items - use full amount with installment proportion
        const subgroupName = "Sem Subgrupo";
        if (!accountsBySubgroup[subgroupName]) {
          accountsBySubgroup[subgroupName] = [];
        }
        
        let amount = parseFloat(account.amount) || 0;
        
        accountsBySubgroup[subgroupName].push({
          ...account,
          amount: amount,
          productName: "N/A",
          installmentInfo: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
        });
      }
    });

    // Sort subgroups alphabetically
    const sortedSubgroups = Object.keys(accountsBySubgroup).sort();
    
    let currentY = 20;
    let isFirstPage = true;
    let grandTotal = 0;
    let grandCount = 0;

    sortedSubgroups.forEach((subgroupName) => {
      const subgroupAccounts = accountsBySubgroup[subgroupName];
      const subgroupTotal = subgroupAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);
      grandTotal += subgroupTotal;
      grandCount += subgroupAccounts.length;

      if (!isFirstPage && currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      if (isFirstPage) {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DE CONTAS RECEBIDAS POR SUBGRUPO", 105, currentY, { align: "center" });
        currentY += 10;
        
        if (filterInfo.length > 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`Filtros: ${filterInfo.join(" | ")}`, 20, currentY);
          currentY += 10;
        }
        isFirstPage = false;
      }

      // Subgroup header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${subgroupName}`, 20, currentY);
      currentY += 2;

      const tableData = subgroupAccounts.map(account => [
        getAccountTitle(account),
        account.creditors?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.installmentInfo
      ]);

      // Add subtotal row
      tableData.push([
        { content: `Subtotal ${subgroupName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
        { content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${subgroupAccounts.length} item(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Credor", "Loja", "Recebimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 20, right: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${grandCount} item(s))`, 20, currentY);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-recebidas-por-subgrupo.pdf");
  };

  // Export PDF Detailed (with products)
  const exportToPDFDetalhado = () => {
    const doc = new jsPDF();
    const filterInfo = getFilterInfo();
    
    let currentY = 20;
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DETALHADO DE CONTAS RECEBIDAS", 105, currentY, { align: "center" });
    currentY += 10;
    
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Filtros: ${filterInfo.join(" | ")}`, 20, currentY);
      currentY += 10;
    }

    let grandTotal = 0;

    accounts.forEach((account, index) => {
      const items = account.accounts_receivable_items || [];
      
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Account header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(20, currentY - 4, doc.internal.pageSize.width - 40, 8, 'F');
      doc.text(`${getAccountTitle(account)} - ${account.creditors?.name || "N/A"} - ${account.stores?.name || "N/A"}`, 22, currentY);
      currentY += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Vencimento: ${new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR")} | Recebimento: ${new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR")} | Parcelas: ${account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"}`, 22, currentY);
      currentY += 6;

      if (items.length > 0) {
        const tableData = items.map((item: any) => [
          item.products?.name || "N/A",
          item.products?.account_groups?.name || "N/A",
          item.quantity?.toLocaleString("pt-BR") || "1",
          item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A"
        ]);

        autoTable(doc, {
          head: [["Produto", "Subgrupo", "Qtd", "Preço Unit.", "Total"]],
          body: tableData,
          startY: currentY,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: "bold" },
          margin: { left: 22, right: 22 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 2;
      }

      // Account totals
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      
      let totalLine = `Valor Recebido: ${account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      if (account.interest_amount > 0) {
        totalLine += ` (Juros: ${account.interest_amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
      }
      if (account.discount_amount > 0) {
        totalLine += ` (Desconto: ${account.discount_amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
      }
      doc.text(totalLine, 22, currentY);
      currentY += 8;

      grandTotal += account.amount || 0;
    });

    // Grand total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${accounts.length} parcela(s))`, 20, currentY + 5);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-recebidas-detalhado.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: getAccountTitle(account),
      Credor: account.creditors?.name || "N/A",
      Loja: account.stores?.name || "N/A",
      Vencimento: new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      Recebimento: new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      Valor: account.amount || 0,
      Parcelas: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas Recebidas");
    XLSX.writeFile(wb, "contas-recebidas.xlsx");
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
            <h1 className="text-2xl font-bold text-primary">Contas Recebidas</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas já recebidas</p>
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
                <Label htmlFor="payment_start">Data Recebimento (Início)</Label>
                <Input
                  id="payment_start"
                  type="date"
                  value={filters.payment_start}
                  onChange={(e) => setFilters(prev => ({...prev, payment_start: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="payment_end">Data Recebimento (Fim)</Label>
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
                <CardTitle>Contas Recebidas ({accounts.length})</CardTitle>
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
                      <DropdownMenuItem onClick={exportToPDF}>
                        Relatório Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorCredor}>
                        Por Credor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorMes}>
                        Por Mês
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorSubgrupo}>
                        Por Subgrupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFDetalhado}>
                        Detalhado (com produtos)
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
                    <TableHead>Data Recebimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account, index) => (
                    <TableRow key={`${account.id}-${index}`}>
                      <TableCell>{getAccountTitle(account)}</TableCell>
                      <TableCell>{account.creditors?.name || "N/A"}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR")}</TableCell>
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

export default ReceivedAccountsReport;