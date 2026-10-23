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
import { createPdfReportLayout, getVinculoBadge, REPORT_COLORS, type PdfSummaryCard, type TotalizerItem } from "@/lib/pdfReportLayout";

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
  const [allocationNames, setAllocationNames] = useState<Record<string, string>>({});

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
      const toEndOfDayIso = (date: string) => `${date}T23:59:59.999`;

      let accountIdsByProduct: string[] | null = null;
      if (filters.product_id && filters.product_id !== "all") {
        const { data: productItems } = await supabase
          .from("accounts_receivable_items")
          .select("account_receivable_id")
          .eq("product_id", filters.product_id);

        const uniqueIds = Array.from(new Set((productItems || []).map((item) => item.account_receivable_id)));
        if (uniqueIds.length === 0) {
          setAccounts([]);
          setAllocationNames({});
          toast({
            title: "Pesquisa realizada",
            description: "0 conta(s) encontrada(s)",
          });
          return;
        }
        accountIdsByProduct = uniqueIds;
      }

      // Fetch accounts with server-side filters whenever possible
      const allAccounts = await fetchAllPaginated(() => {
        let query = supabase
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
                products(id, name, subgroup_id, account_groups:subgroup_id(id, name)),
                accounts_receivable_item_allocations(
                  allocation_type,
                  animal_id,
                  aspiration_id,
                  embryo_transfer_id,
                  pregnancy_id,
                  recipient_id
                )
              )
            `)
          .in("status", ["paid", "partial"]);

        if (filters.creditor_id && filters.creditor_id !== "all") {
          query = query.eq("creditor_id", filters.creditor_id);
        }
        if (filters.store_id && filters.store_id !== "all") {
          query = query.eq("store_id", filters.store_id);
        }
        if (filters.competencia_start) {
          query = query.gte("issue_date", filters.competencia_start);
        }
        if (filters.competencia_end) {
          query = query.lte("issue_date", filters.competencia_end);
        }
        if (filters.created_start) {
          query = query.gte("created_at", filters.created_start);
        }
        if (filters.created_end) {
          query = query.lte("created_at", toEndOfDayIso(filters.created_end));
        }
        if (accountIdsByProduct && accountIdsByProduct.length > 0) {
          query = query.in("id", accountIdsByProduct);
        }

        return query;
      });

      const accountIds = Array.from(new Set((allAccounts || []).map((account: any) => account.id)));
      if (accountIds.length === 0) {
        setAccounts([]);
        setAllocationNames({});
        toast({
          title: "Pesquisa realizada",
          description: "0 conta(s) encontrada(s)",
        });
        return;
      }

      // Fetch payments data with pagination
      const paymentsData = await fetchAllPaginated(() =>
        supabase
          .from("accounts_receivable_payments")
          .select(`*`)
          .in("account_receivable_id", accountIds)
      );

      // Create a map of payments by installment_id
      const paymentsByInstallmentId: { [key: string]: any } = {};
      (paymentsData || []).forEach((payment: any) => {
        paymentsByInstallmentId[payment.installment_id] = payment;
      });

      // Filter for paid or partial accounts and expand installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
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

      // creditor/store/competence/created/product filters are now applied before or during query

      // Fetch allocation names (animals, aspirations, pregnancies, embryo transfers)
      const animalIds = new Set<string>();
      const aspirationIds = new Set<string>();
      const pregnancyIds = new Set<string>();
      const embryoTransferIds = new Set<string>();
      const recipientIds = new Set<string>();

      accountsData.forEach((account: any) => {
        (account.accounts_receivable_items || []).forEach((item: any) => {
          (item.accounts_receivable_item_allocations || []).forEach((alloc: any) => {
            if (alloc.animal_id) animalIds.add(alloc.animal_id);
            if (alloc.aspiration_id) aspirationIds.add(alloc.aspiration_id);
            if (alloc.pregnancy_id) pregnancyIds.add(alloc.pregnancy_id);
            if (alloc.embryo_transfer_id) embryoTransferIds.add(alloc.embryo_transfer_id);
            if (alloc.recipient_id) recipientIds.add(alloc.recipient_id);
          });
        });
      });

      const namesMap: Record<string, string> = {};
      const fetchPromises: Promise<void>[] = [];

      if (animalIds.size > 0) {
        fetchPromises.push(
          Promise.resolve(supabase.from("animals").select("id, name, code").in("id", Array.from(animalIds)))
            .then(({ data }) => { (data || []).forEach((a: any) => { namesMap[`animal-${a.id}`] = `${a.code} - ${a.name}`; }); })
        );
      }
      if (aspirationIds.size > 0) {
        fetchPromises.push(
          Promise.resolve(supabase.from("aspiration_management").select("id, name, code").in("id", Array.from(aspirationIds)))
            .then(({ data }) => { (data || []).forEach((a: any) => { namesMap[`aspiration-${a.id}`] = `${a.code} - ${a.name}`; }); })
        );
      }
      if (pregnancyIds.size > 0) {
        fetchPromises.push(
          Promise.resolve(supabase.from("pregnancy_management").select("id, name, code").in("id", Array.from(pregnancyIds)))
            .then(({ data }) => { (data || []).forEach((a: any) => { namesMap[`pregnancy-${a.id}`] = `${a.code} - ${a.name}`; }); })
        );
      }
      if (embryoTransferIds.size > 0) {
        fetchPromises.push(
          Promise.resolve(supabase.from("embryo_transfer_management").select("id, name, code").in("id", Array.from(embryoTransferIds)))
            .then(({ data }) => { (data || []).forEach((a: any) => { namesMap[`embryo-${a.id}`] = `${a.code} - ${a.name}`; }); })
        );
      }
      if (recipientIds.size > 0) {
        fetchPromises.push(
          Promise.resolve(supabase.from("animals").select("id, name, code").in("id", Array.from(recipientIds)))
            .then(({ data }) => { (data || []).forEach((a: any) => { namesMap[`recipient-${a.id}`] = `${a.code} - ${a.name}`; }); })
        );
      }

      await Promise.all(fetchPromises);
      setAllocationNames(namesMap);

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

  const exportToPDF = async () => {
    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Geral",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Table data
    const tableData = accounts.map(account => [
      getAccountTitle(account),
      account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
      account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
    ]);

    autoTable(doc, {
      head: [["Título", "Credor", "Loja", "Vencimento", "Recebimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: layout.startY,
      margin: layout.tableMargin,
      willDrawPage: layout.willDrawPage,
      ...layout.tableStyles({
        styles: { fontSize: 7.5 },
        columnStyles: {
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "center", cellWidth: 24 },
          5: { halign: "right", cellWidth: 30 },
          6: { halign: "center", cellWidth: 20 },
        },
      }),
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

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

  const formatBRL = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Structured filter items for the reusable PDF layout (mirrors getFilterInfo)
  const getFilterItems = (): { label: string; value: string }[] => {
    const items: { label: string; value: string }[] = [];
    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      items.push({ label: "Recebimento", value: `${start} a ${end}` });
    }
    if (filters.creditor_id !== "all") {
      const creditor = creditors.find(s => s.id === filters.creditor_id);
      if (creditor) items.push({ label: "Credor", value: creditor.name });
    }
    if (filters.store_id !== "all") {
      const store = stores.find(s => s.id === filters.store_id);
      if (store) items.push({ label: "Loja", value: store.name });
    }
    return items;
  };

  const buildSummaryCards = (): PdfSummaryCard[] => {
    const total = accounts.reduce((sum, account) => sum + (account.amount || 0), 0);
    const registros = new Set(accounts.map((account) => account.id)).size;
    const parcelas = accounts.length;

    const cards: PdfSummaryCard[] = [
      { label: "Total geral", value: formatBRL(total), tone: "gold" },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(parcelas) },
      { label: "Situação", value: "Recebidas", tone: "success" },
    ];

    if (filters.store_id !== "all") {
      const store = stores.find((s) => s.id === filters.store_id);
      if (store) cards.push({ label: "Loja", value: store.name });
    }

    if (filters.payment_start || filters.payment_end) {
      const start = filters.payment_start ? new Date(filters.payment_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.payment_end ? new Date(filters.payment_end).toLocaleDateString("pt-BR") : "Hoje";
      cards.push({ label: "Período", value: `${start} a ${end}` });
    }

    return cards;
  };

  const buildTotalizerItems = (): TotalizerItem[] => {
    const total = accounts.reduce((sum, account) => sum + (account.amount || 0), 0);
    const registros = new Set(accounts.map((account) => account.id)).size;
    const parcelas = accounts.length;
    return [
      { label: "Total geral", value: formatBRL(total), emphasis: true },
      { label: "Registros", value: String(registros) },
      { label: "Parcelas", value: String(parcelas) },
    ];
  };

  // Export PDF by Creditor
  const exportToPDFPorCredor = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Por credor",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    // Group accounts by creditor
    const accountsByCreditor: { [key: string]: any[] } = {};
    accounts.forEach(account => {
      const creditorName = account.suppliers?.name || "Sem Credor";
      if (!accountsByCreditor[creditorName]) {
        accountsByCreditor[creditorName] = [];
      }
      accountsByCreditor[creditorName].push(account);
    });

    // Sort creditors alphabetically
    const sortedCreditors = Object.keys(accountsByCreditor).sort();

    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = layout.startY;

    sortedCreditors.forEach((creditorName) => {
      const creditorAccounts = accountsByCreditor[creditorName];
      const creditorTotal = creditorAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);

      // Check if we need a new page
      if (currentY > pageHeight - 47) {
        doc.addPage();
        layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
        currentY = layout.tableMargin.top;
      }

      // Creditor header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(`${creditorName}`, layout.tableMargin.left, currentY + 3);
      currentY += 5;

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
        margin: layout.tableMargin,
        willDrawPage: layout.willDrawPage,
        ...layout.tableStyles({
          columnStyles: {
            2: { halign: "center", cellWidth: 24 },
            3: { halign: "center", cellWidth: 24 },
            4: { halign: "right", cellWidth: 28 },
            5: { halign: "center", cellWidth: 20 },
          },
        }),
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-recebidas-por-credor.pdf");
  };

  // Export PDF by Month
  const exportToPDFPorMes = async () => {
    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Por mês",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

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

    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = layout.startY;

    sortedMonths.forEach((monthYear) => {
      const monthAccounts = accountsByMonth[monthYear];
      const monthTotal = monthAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);

      if (currentY > pageHeight - 40) {
        doc.addPage();
        layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
        currentY = layout.tableMargin.top;
      }

      // Month header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(`Mês: ${monthYear}`, layout.tableMargin.left, currentY + 3);
      currentY += 5;

      const tableData = monthAccounts.map(account => [
        getAccountTitle(account),
        account.suppliers?.name || "N/A",
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
        margin: layout.tableMargin,
        willDrawPage: layout.willDrawPage,
        ...layout.tableStyles({
          styles: { fontSize: 7.5 },
          columnStyles: {
            3: { halign: "center", cellWidth: 24 },
            4: { halign: "center", cellWidth: 24 },
            5: { halign: "right", cellWidth: 30 },
            6: { halign: "center", cellWidth: 20 },
          },
        }),
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-recebidas-por-mes.pdf");
  };

  // Export PDF by Subgroup
  const exportToPDFPorSubgrupo = async () => {
    const doc = new jsPDF();

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

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Por subgrupo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = layout.startY;

    sortedSubgroups.forEach((subgroupName) => {
      const subgroupAccounts = accountsBySubgroup[subgroupName];
      const subgroupTotal = subgroupAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);

      if (currentY > pageHeight - 47) {
        doc.addPage();
        layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
        currentY = layout.tableMargin.top;
      }

      // Subgroup header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(`${subgroupName}`, layout.tableMargin.left, currentY + 3);
      currentY += 5;

      const tableData = subgroupAccounts.map(account => [
        getAccountTitle(account),
        account.suppliers?.name || "N/A",
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
        margin: layout.tableMargin,
        willDrawPage: layout.willDrawPage,
        ...layout.tableStyles({
          columnStyles: {
            3: { halign: "center", cellWidth: 26 },
            4: { halign: "right", cellWidth: 30 },
            5: { halign: "center", cellWidth: 22 },
          },
        }),
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-recebidas-por-subgrupo.pdf");
  };

  // Export PDF Detailed (with products)
  const exportToPDFDetalhado = async () => {
    const doc = new jsPDF();

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Detalhado (com produtos)",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    const marginLeft = layout.tableMargin.left;
    const contentWidth = doc.internal.pageSize.getWidth() - layout.tableMargin.left - layout.tableMargin.right;
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = layout.startY;

    accounts.forEach((account) => {
      const items = account.accounts_receivable_items || [];

      if (currentY > pageHeight - 47) {
        doc.addPage();
        layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
        currentY = layout.tableMargin.top;
      }

      // Account header (navy band with gold accent)
      const headerH = 8;
      doc.setFillColor(...REPORT_COLORS.navy);
      doc.rect(marginLeft, currentY, contentWidth, headerH, 'F');
      doc.setFillColor(...REPORT_COLORS.gold);
      doc.rect(marginLeft, currentY, 1.6, headerH, 'F');
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.white);
      doc.text(`${getAccountTitle(account)} - ${account.suppliers?.name || "N/A"} - ${account.stores?.name || "N/A"}`, marginLeft + 4, currentY + 5.4);
      currentY += headerH + 3;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...REPORT_COLORS.textPrimary);
      doc.text(`Vencimento: ${new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR")} | Recebimento: ${new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR")} | Parcelas: ${account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"}`, marginLeft + 2, currentY);
      currentY += 5;

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
          margin: layout.tableMargin,
          willDrawPage: layout.willDrawPage,
          ...layout.tableStyles({
            styles: { fontSize: 8 },
            columnStyles: {
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "right", cellWidth: 30 },
              4: { halign: "right", cellWidth: 30 },
            },
          }),
        });

        currentY = (doc as any).lastAutoTable.finalY + 2;
      }

      // Account totals
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);

      let totalLine = `Valor Recebido: ${account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      if (account.interest_amount > 0) {
        totalLine += ` (Juros: ${account.interest_amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
      }
      if (account.discount_amount > 0) {
        totalLine += ` (Desconto: ${account.discount_amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
      }
      doc.text(totalLine, marginLeft + 2, currentY + 3);
      currentY += 10;
    });

    layout.drawTotalizer(currentY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-recebidas-detalhado.pdf");
  };

  // Export PDF by Creditor and Allocation (Vínculo)
  const exportToPDFByCreditorAndVinculo = async () => {
    const doc = new jsPDF("landscape");

    const layout = await createPdfReportLayout(doc, {
      title: "Relatório de Contas Recebidas",
      subtitle: "Contas recebidas — Por credor e vínculo",
      filters: getFilterItems(),
      summaryCards: buildSummaryCards(),
    });

    const groupedByCreditor = accounts.reduce((groups: Record<string, any[]>, account) => {
      const creditorName = account.suppliers?.name || "Sem Credor";
      if (!groups[creditorName]) groups[creditorName] = [];
      groups[creditorName].push(account);
      return groups;
    }, {});

    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = layout.startY;
    const sortedCreditors = Object.keys(groupedByCreditor).sort();

    sortedCreditors.forEach((creditorName) => {
      const creditorAccounts = groupedByCreditor[creditorName];
      const creditorTotal = creditorAccounts.reduce((sum: number, acc: any) => sum + (acc.amount || 0), 0);

      if (currentY > pageHeight - 40) {
        doc.addPage();
        layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
        currentY = layout.tableMargin.top;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...REPORT_COLORS.navy);
      doc.text(`Credor: ${creditorName}`, layout.tableMargin.left, currentY + 3);
      currentY += 5;

      const tableData: any[] = [];
      creditorAccounts.forEach((account: any) => {
        tableData.push([
          getAccountTitle(account),
          account.stores?.name || "N/A",
          new Date(account.due_date + 'T00:00:00').toLocaleDateString("pt-BR"),
          new Date(account.payment_date + 'T00:00:00').toLocaleDateString("pt-BR"),
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
        ]);

        const allocations: { tipo: string; descricao: string }[] = [];
        (account.accounts_receivable_items || []).forEach((item: any) => {
          (item.accounts_receivable_item_allocations || []).forEach((alloc: any) => {
            if (alloc.animal_id && allocationNames[`animal-${alloc.animal_id}`]) {
              allocations.push({ tipo: "Animal", descricao: allocationNames[`animal-${alloc.animal_id}`] });
            }
            if (alloc.aspiration_id && allocationNames[`aspiration-${alloc.aspiration_id}`]) {
              allocations.push({ tipo: "Aspiração", descricao: allocationNames[`aspiration-${alloc.aspiration_id}`] });
            }
            if (alloc.pregnancy_id && allocationNames[`pregnancy-${alloc.pregnancy_id}`]) {
              allocations.push({ tipo: "Prenhez", descricao: allocationNames[`pregnancy-${alloc.pregnancy_id}`] });
            }
            if (alloc.embryo_transfer_id && allocationNames[`embryo-${alloc.embryo_transfer_id}`]) {
              allocations.push({ tipo: "Pós TE", descricao: allocationNames[`embryo-${alloc.embryo_transfer_id}`] });
            }
            if (alloc.recipient_id && allocationNames[`recipient-${alloc.recipient_id}`]) {
              allocations.push({ tipo: "Receptora", descricao: allocationNames[`recipient-${alloc.recipient_id}`] });
            }
          });
        });

        if (allocations.length > 0) {
          const seen = new Set<string>();
          allocations.forEach(({ tipo, descricao }) => {
            const key = `${tipo}:${descricao}`;
            if (seen.has(key)) return;
            seen.add(key);
            const badge = getVinculoBadge(tipo);
            tableData.push([
              {
                content: `[${badge.label}] ${descricao}`,
                colSpan: 6,
                styles: {
                  fontStyle: "italic",
                  textColor: badge.color,
                  fillColor: badge.soft,
                  fontSize: 7,
                  cellPadding: { top: 1, bottom: 1, left: 8, right: 2 },
                },
              },
            ]);
          });
        }
      });

      tableData.push([
        { content: `Subtotal ${creditorName}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
        { content: creditorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
        { content: `${creditorAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } }
      ]);

      autoTable(doc, {
        head: [["Título", "Loja", "Vencimento", "Recebimento", "Valor", "Parcelas"]],
        body: tableData,
        startY: currentY,
        margin: layout.tableMargin,
        willDrawPage: layout.willDrawPage,
        ...layout.tableStyles({
          styles: { fontSize: 7.5 },
          columnStyles: {
            2: { halign: "center", cellWidth: 26 },
            3: { halign: "center", cellWidth: 26 },
            4: { halign: "right", cellWidth: 32 },
            5: { halign: "center", cellWidth: 22 },
          },
        }),
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? layout.startY;
    layout.drawTotalizer(finalY, buildTotalizerItems());
    layout.finalize();

    doc.save("contas-recebidas-por-credor-vinculo.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: getAccountTitle(account),
      Credor: account.suppliers?.name || "N/A",
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
              <div className="flex flex-wrap justify-between items-center gap-3">
                <CardTitle>Contas Recebidas ({accounts.length})</CardTitle>
                <div className="flex flex-wrap gap-2">
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
                      <DropdownMenuItem onClick={exportToPDFByCreditorAndVinculo}>
                        Por Credor e Vínculo
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
                      <TableCell>{account.suppliers?.name || "N/A"}</TableCell>
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
