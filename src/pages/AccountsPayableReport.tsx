import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download, Filter, FileDown, ChevronDown, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const AccountsPayableReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    due_start: "",
    due_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    supplier_id: "all",
    store_id: "all",
    product_id: "all",
  });

  const [allocationType, setAllocationType] = useState<string>("none");
  const [allocationItems, setAllocationItems] = useState<Array<{ id: string; name: string; code?: number }>>([]);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<string[]>([]);
  const [allocationPopoverOpen, setAllocationPopoverOpen] = useState(false);
  const [allocationSearch, setAllocationSearch] = useState("");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchStores();
    fetchProducts();
  }, []);

  useEffect(() => {
    setSelectedAllocationIds([]);
    setAllocationItems([]);
    setAllocationSearch("");
    if (allocationType === "none") return;

    const fetchAllocationItems = async () => {
      if (allocationType === "aspiration") {
        const { data } = await supabase
          .from("aspiration_management")
          .select("id, name, code")
          .order("code", { ascending: false });
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "pregnancy") {
        const { data } = await supabase
          .from("pregnancy_management")
          .select("id, name, code")
          .order("code", { ascending: false });
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      } else if (allocationType === "animal") {
        const { data } = await supabase
          .from("animals")
          .select("id, name, code")
          .order("code", { ascending: false });
        setAllocationItems((data || []).map(d => ({ id: d.id, name: `${d.code} - ${d.name}`, code: d.code })));
      }
    };
    fetchAllocationItems();
  }, [allocationType]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name");
    setSuppliers(data || []);
  };

  const fetchStores = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role, store_id").eq("id", user.id).single();

      if (profile?.role === "admin") {
        const { data } = await supabase.from("stores").select("id, name").order("name");
        setStores(data || []);
      } else {
        const storeIds: string[] = [];
        if (profile?.store_id) storeIds.push(profile.store_id);

        const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", user.id);

        userStores?.forEach((us) => {
          if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
        });

        if (storeIds.length > 0) {
          const { data } = await supabase.from("stores").select("id, name").in("id", storeIds).order("name");
          setStores(data || []);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar fazendas:", error);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name");
    setProducts(data || []);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Fetch accounts with suppliers, employees, stores, installments and items with products
      // Using paginated fetch to avoid Supabase 1000-row limit
      const allAccounts = await fetchAllPaginated(() =>
        supabase.from("accounts_payable").select(`
          *,
          suppliers(id, name),
          employees(id, name),
          stores(id, name),
          accounts_payable_installments(*),
          accounts_payable_payments(
            id,
            installment_id,
            interest_amount,
            discount_amount
          ),
          accounts_payable_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products(id, name, subgroup_id, account_groups:subgroup_id(id, name))
          )
        `)
      );

      // Filter for unpaid accounts only and expand installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        if (account.status === "paid") return;

        if (account.accounts_payable_installments && account.accounts_payable_installments.length > 0) {
          // Has installments - create one row per unpaid installment
          account.accounts_payable_installments.forEach((installment: any) => {
            if (!installment.payment_date) {
              // Only unpaid installments
              // Check if there are any reversed payments with interest/discount for this installment
              const installmentPayments = (account.accounts_payable_payments || []).filter(
                (p: any) => p.installment_id === installment.id,
              );

              // Sum up all interest and discount from payments (including reversed ones)
              let totalInterest = 0;
              let totalDiscount = 0;
              installmentPayments.forEach((payment: any) => {
                totalInterest += payment.interest_amount || 0;
                totalDiscount += payment.discount_amount || 0;
              });

              // The installment.amount already reflects the adjusted value from payments
              // So we use it directly
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                installment_number: installment.installment_number,
                total_installments: account.accounts_payable_installments.length,
                installment_id: installment.id,
              });
            }
          });
        } else {
          // No installments - single payment
          // Check if there were any reversed payments with adjustments
          const payments = account.accounts_payable_payments || [];
          let adjustedAmount = account.amount;

          if (payments.length > 0) {
            // Sum up all interest and discount from all payments
            let totalInterest = 0;
            let totalDiscount = 0;
            payments.forEach((payment: any) => {
              totalInterest += payment.interest_amount || 0;
              totalDiscount += payment.discount_amount || 0;
            });

            // Adjust the amount with interest and discount
            adjustedAmount = account.amount + totalInterest - totalDiscount;
          }

          accountsData.push({
            ...account,
            amount: adjustedAmount,
            installment_number: 1,
            total_installments: 1,
          });
        }
      });

      // Apply client-side filtering for all filters
      if (filters.due_start || filters.due_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.due_date) return false;
          const dueDate = account.due_date; // String no formato YYYY-MM-DD

          if (filters.due_start && dueDate < filters.due_start) return false;
          if (filters.due_end && dueDate > filters.due_end) return false;
          return true;
        });
      }

      if (filters.competencia_start || filters.competencia_end) {
        accountsData = accountsData.filter((account: any) => {
          if (!account.data_competencia) return false;
          const competenciaDate = account.data_competencia; // String no formato YYYY-MM-DD

          if (filters.competencia_start && competenciaDate < filters.competencia_start) return false;
          if (filters.competencia_end && competenciaDate > filters.competencia_end) return false;
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

      // Filter by allocation (aspiration/pregnancy/animal)
      if (allocationType !== "none" && selectedAllocationIds.length > 0) {
        let allocationQuery = supabase
          .from("accounts_payable_item_allocations")
          .select("account_payable_item_id");

        if (allocationType === "aspiration") {
          allocationQuery = allocationQuery.in("aspiration_id", selectedAllocationIds);
        } else if (allocationType === "pregnancy") {
          allocationQuery = allocationQuery.in("pregnancy_id", selectedAllocationIds);
        } else if (allocationType === "animal") {
          allocationQuery = allocationQuery.in("animal_id", selectedAllocationIds);
        }

        const { data: allocations } = await allocationQuery;

        if (allocations && allocations.length > 0) {
          const itemIds = allocations.map(a => a.account_payable_item_id);
          
          const { data: items } = await supabase
            .from("accounts_payable_items")
            .select("account_payable_id")
            .in("id", itemIds);

          if (items && items.length > 0) {
            const allowedAccountIds = new Set(items.map(i => i.account_payable_id));
            accountsData = accountsData.filter((account: any) => allowedAccountIds.has(account.id));
          } else {
            accountsData = [];
          }
        } else {
          accountsData = [];
        }
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
        description: "Erro ao buscar contas a pagar",
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
      supplier_id: "all",
      store_id: "all",
      product_id: "all",
    });
    setAccounts([]);
    setAllocationType("none");
    setSelectedAllocationIds([]);
    setAllocationItems([]);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const sortedAccounts = React.useMemo(() => {
    if (!sortColumn) return accounts;
    return [...accounts].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "description":
          valA = (a.description || "").toLowerCase();
          valB = (b.description || "").toLowerCase();
          break;
        case "supplier":
          valA = (a.employees?.name || a.suppliers?.name || "").toLowerCase();
          valB = (b.employees?.name || b.suppliers?.name || "").toLowerCase();
          break;
        case "due_date":
          valA = a.due_date || "";
          valB = b.due_date || "";
          break;
        case "amount":
          valA = a.amount || 0;
          valB = b.amount || 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [accounts, sortColumn, sortDirection]);

  const getFilterInfo = () => {
    let filterInfo = [];
    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? new Date(filters.due_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.due_end ? new Date(filters.due_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Vencimento: ${start} a ${end}`);
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find((s) => s.id === filters.supplier_id);
      if (supplier) filterInfo.push(`Fornecedor: ${supplier.name}`);
    }
    if (filters.store_id !== "all") {
      const store = stores.find((s) => s.id === filters.store_id);
      if (store) filterInfo.push(`Fazenda: ${store.name}`);
    }
    return filterInfo;
  };

  const exportToPDFResumido = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não pagas - Resumido", 105, 28, { align: "center" });

    const filterInfo = getFilterInfo();

    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Table data
    const tableData = sortedAccounts.map((account) => [
      account.description,
      account.employees?.name || account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
      account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
    ]);

    // Calculate total
    const total = sortedAccounts.reduce((sum, account) => sum + (account.amount || 0), 0);

    // Add total row
    tableData.push([
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
      { content: `${sortedAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } },
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 20, right: 20 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-resumido.pdf");
  };

  const exportToPDFResumidoPorMes = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não pagas - Resumido por Mês", 105, 28, { align: "center" });

    const filterInfo = getFilterInfo();

    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Group accounts by month/year
    const accountsByMonth: { [key: string]: { monthLabel: string; accounts: any[]; sortKey: string } } = {};

    sortedAccounts.forEach((account) => {
      const dueDate = new Date(account.due_date + "T00:00:00");
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth();
      const key = `${year}-${String(month).padStart(2, "0")}`;

      const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const monthLabel = `${monthNames[month]} / ${year}`;

      if (!accountsByMonth[key]) {
        accountsByMonth[key] = {
          monthLabel,
          accounts: [],
          sortKey: key,
        };
      }

      accountsByMonth[key].accounts.push(account);
    });

    // Sort by month/year
    const sortedMonths = Object.values(accountsByMonth).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Build table data with month grouping
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalInstallments = 0;

    sortedMonths.forEach((monthGroup) => {
      // Month header row
      tableData.push([
        {
          content: monthGroup.monthLabel,
          colSpan: 6,
          styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 },
        },
      ]);

      // Items for this month
      let monthTotal = 0;
      monthGroup.accounts.forEach((account) => {
        tableData.push([
          account.description,
          account.employees?.name || account.suppliers?.name || "N/A",
          account.stores?.name || "N/A",
          new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
        ]);
        monthTotal += account.amount || 0;
      });

      // Month subtotal
      tableData.push([
        {
          content: `Subtotal ${monthGroup.monthLabel}`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] },
        },
        {
          content: monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
        },
        {
          content: `${monthGroup.accounts.length} parcela(s)`,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
        },
      ]);

      grandTotal += monthTotal;
      totalInstallments += monthGroup.accounts.length;
    });

    // Grand total row
    tableData.push([
      {
        content: "TOTAL GERAL",
        colSpan: 4,
        styles: { fontStyle: "bold", halign: "right", fillColor: [41, 128, 185], textColor: 255 },
      },
      {
        content: grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        styles: { fontStyle: "bold", fillColor: [41, 128, 185], textColor: 255 },
      },
      {
        content: `${totalInstallments} parcela(s)`,
        styles: { fontStyle: "bold", fillColor: [41, 128, 185], textColor: 255 },
      },
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: 10, right: 10 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-resumido-por-mes.pdf");
  };

  const exportToPDFResumidoPorDia = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não pagas - Resumido por Dia", 105, 28, { align: "center" });

    const filterInfo = getFilterInfo();

    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Group accounts by day (YYYY-MM-DD)
    const accountsByDay: { [key: string]: { dayLabel: string; accounts: any[]; sortKey: string } } = {};

    sortedAccounts.forEach((account) => {
      const dueDate = new Date(account.due_date + "T00:00:00");
      const key = account.due_date; // Already in YYYY-MM-DD format
      const dayLabel = dueDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      if (!accountsByDay[key]) {
        accountsByDay[key] = {
          dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
          accounts: [],
          sortKey: key,
        };
      }

      accountsByDay[key].accounts.push(account);
    });

    // Sort by day (ascending)
    const sortedDays = Object.values(accountsByDay).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Build table data with day grouping
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalInstallments = 0;

    sortedDays.forEach((dayGroup) => {
      // Day header row
      tableData.push([
        {
          content: dayGroup.dayLabel,
          colSpan: 6,
          styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 },
        },
      ]);

      // Items for this day
      let dayTotal = 0;
      dayGroup.accounts.forEach((account) => {
        tableData.push([
          account.description,
          account.employees?.name || account.suppliers?.name || "N/A",
          account.stores?.name || "N/A",
          new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
        ]);
        dayTotal += account.amount || 0;
      });

      // Day subtotal
      tableData.push([
        {
          content: `Subtotal do dia`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] },
        },
        {
          content: dayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
        },
        {
          content: `${dayGroup.accounts.length} parcela(s)`,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
        },
      ]);

      grandTotal += dayTotal;
      totalInstallments += dayGroup.accounts.length;
    });

    // Grand total row
    tableData.push([
      {
        content: "TOTAL GERAL",
        colSpan: 4,
        styles: { fontStyle: "bold", halign: "right", fillColor: [41, 128, 185], textColor: 255 },
      },
      {
        content: grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        styles: { fontStyle: "bold", fillColor: [41, 128, 185], textColor: 255 },
      },
      {
        content: `${totalInstallments} parcela(s)`,
        styles: { fontStyle: "bold", fillColor: [41, 128, 185], textColor: 255 },
      },
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: 10, right: 10 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-resumido-por-dia.pdf");
  };

  const exportToPDFDetalhado = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });

    const filterInfo = getFilterInfo();

    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 30);
    }

    // Build table data with product details
    const tableData: any[] = [];

    sortedAccounts.forEach((account) => {
      // Main account row
      tableData.push([
        { content: account.description, styles: { fontStyle: "bold" } },
        { content: account.employees?.name || account.suppliers?.name || "N/A", styles: { fontStyle: "bold" } },
        { content: account.stores?.name || "N/A", styles: { fontStyle: "bold" } },
        {
          content: new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
          styles: { fontStyle: "bold" },
        },
        {
          content: account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
          styles: { fontStyle: "bold" },
        },
        {
          content:
            account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
          styles: { fontStyle: "bold" },
        },
      ]);

      // Product detail rows
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const productName = item.products?.name || "Produto não encontrado";
          const subgroupName = item.products?.account_groups?.name || "-";
          const quantity = item.quantity || 0;
          const unitPrice =
            item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
          const totalPrice =
            item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

          tableData.push([
            { content: "", styles: { fontSize: 8 } },
            { content: `   ${productName}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: subgroupName, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: `${quantity}`, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: totalPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } },
            { content: unitPrice, styles: { fontSize: 8, textColor: [100, 100, 100] } },
          ]);
        });
      }
    });

    // Calculate total
    const total = sortedAccounts.reduce((sum, account) => sum + (account.amount || 0), 0);

    // Add total row
    tableData.push([
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } },
      { content: `${sortedAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } },
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 37 : 27,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: 20, right: 20 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-detalhado.pdf");
  };

  const exportToPDFPorSubgrupo = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Agrupado por Subgrupo", 105, 28, { align: "center" });

    const filterInfo = getFilterInfo();

    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    // Group accounts by subgroup
    const accountsBySubgroup: { [key: string]: { subgroupName: string; items: any[] } } = {};

    sortedAccounts.forEach((account: any) => {
      // Calculate the installment proportion for parcelado accounts
      // For installment accounts: proportion = installment_amount / total_title_amount
      // Interest and discounts are applied fully to each installment

      let installmentProportion = 1; // Default: full amount (à vista)
      let interestAmount = 0;
      let discountAmount = 0;

      if (account.total_installments > 1) {
        // This is a parcelado account - calculate proportion
        // We need to get the original total amount (sum of all installments or total_amount)
        const originalTotalAmount = account.total_amount || account.amount * account.total_installments;

        if (originalTotalAmount > 0) {
          // Get the installment base amount (without interest/discount adjustments from payments)
          const installmentBaseAmount = originalTotalAmount / account.total_installments;
          installmentProportion = installmentBaseAmount / originalTotalAmount;
        }

        // Check for interest/discount from payments on this specific installment
        const payments = account.accounts_payable_payments || [];
        if (payments.length > 0) {
          payments.forEach((payment: any) => {
            interestAmount += payment.interest_amount || 0;
            discountAmount += payment.discount_amount || 0;
          });
        }
      } else {
        // À vista - check for interest/discount
        const payments = account.accounts_payable_payments || [];
        if (payments.length > 0) {
          payments.forEach((payment: any) => {
            interestAmount += payment.interest_amount || 0;
            discountAmount += payment.discount_amount || 0;
          });
        }
      }

      // Process items
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        // Calculate total of all items to distribute interest/discount proportionally
        const totalItemsValue = account.accounts_payable_items.reduce(
          (sum: number, item: any) => sum + (item.total_price || 0),
          0,
        );

        account.accounts_payable_items.forEach((item: any) => {
          const subgroupId = item.products?.subgroup_id || "sem-subgrupo";
          const subgroupName = item.products?.account_groups?.name || "Sem Subgrupo";

          if (!accountsBySubgroup[subgroupId]) {
            accountsBySubgroup[subgroupId] = {
              subgroupName,
              items: [],
            };
          }

          // Calculate proportional item amount for this installment
          let itemAmount = (item.total_price || 0) * installmentProportion;

          // Distribute interest/discount proportionally to items based on their value
          if (totalItemsValue > 0 && (interestAmount > 0 || discountAmount > 0)) {
            const itemProportion = (item.total_price || 0) / totalItemsValue;
            itemAmount += interestAmount * itemProportion - discountAmount * itemProportion;
          }

          accountsBySubgroup[subgroupId].items.push({
            description: account.description,
            supplierName: account.employees?.name || account.suppliers?.name || "N/A",
            storeName: account.stores?.name || "N/A",
            dueDate: account.due_date,
            amount: itemAmount,
            productName: item.products?.name || "Produto",
            installmentInfo:
              account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : null,
          });
        });
      } else {
        // No items - add to "Sem Subgrupo"
        if (!accountsBySubgroup["sem-subgrupo"]) {
          accountsBySubgroup["sem-subgrupo"] = {
            subgroupName: "Sem Subgrupo",
            items: [],
          };
        }

        // For accounts without items, use the already adjusted amount
        accountsBySubgroup["sem-subgrupo"].items.push({
          description: account.description,
          supplierName: account.employees?.name || account.suppliers?.name || "N/A",
          storeName: account.stores?.name || "N/A",
          dueDate: account.due_date,
          amount: account.amount || 0,
          productName: null,
          installmentInfo:
            account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : null,
        });
      }
    });

    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;

    Object.values(accountsBySubgroup).forEach((group) => {
      // Subgroup header row
      tableData.push([
        {
          content: group.subgroupName,
          colSpan: 5,
          styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 },
        },
      ]);

      // Items for this subgroup
      let subgroupTotal = 0;
      group.items.forEach((item) => {
        tableData.push([
          item.description,
          item.supplierName,
          item.storeName,
          item.dueDate ? new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "N/A",
          item.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        ]);
        subgroupTotal += item.amount || 0;
      });

      // Subgroup subtotal
      tableData.push([
        {
          content: `Subtotal ${group.subgroupName}`,
          colSpan: 4,
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] },
        },
        {
          content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
        },
      ]);

      grandTotal += subgroupTotal;
    });

    // Grand total row
    tableData.push([
      {
        content: "TOTAL GERAL",
        colSpan: 4,
        styles: { fontStyle: "bold", halign: "right", fillColor: [41, 128, 185], textColor: 255 },
      },
      {
        content: grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        styles: { fontStyle: "bold", fillColor: [41, 128, 185], textColor: 255 },
      },
    ]);

    autoTable(doc, {
      head: [["Descrição", "Fornecedor", "Fazenda", "Vencimento", "Valor"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: 10, right: 10 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-por-subgrupo.pdf");
  };

  const fetchAllocationsForAccounts = async (accountsList: any[]) => {
    // Collect all item IDs from all accounts
    const allItemIds: string[] = [];
    accountsList.forEach((account) => {
      if (account.accounts_payable_items) {
        account.accounts_payable_items.forEach((item: any) => {
          allItemIds.push(item.id);
        });
      }
    });

    if (allItemIds.length === 0) return new Map<string, string[]>();

    // Fetch allocations with linked entity names
    const { data: allocations } = await supabase
      .from("accounts_payable_item_allocations")
      .select(`
        account_payable_item_id,
        allocation_type,
        animal_id,
        aspiration_id,
        pregnancy_id,
        animals:animal_id(name, code),
        aspiration_management:aspiration_id(name, code),
        pregnancy_management:pregnancy_id(name, code)
      `)
      .in("account_payable_item_id", allItemIds);

    // Build a map: account_payable_id -> list of vínculo labels
    const itemToAccount = new Map<string, string>();
    accountsList.forEach((account) => {
      if (account.accounts_payable_items) {
        account.accounts_payable_items.forEach((item: any) => {
          itemToAccount.set(item.id, account.id);
        });
      }
    });

    const accountAllocations = new Map<string, Set<string>>();

    (allocations || []).forEach((alloc: any) => {
      const accountId = itemToAccount.get(alloc.account_payable_item_id);
      if (!accountId) return;

      if (!accountAllocations.has(accountId)) {
        accountAllocations.set(accountId, new Set());
      }

      let label = "";
      if (alloc.animal_id && alloc.animals) {
        label = `Animal: ${(alloc.animals as any).code} - ${(alloc.animals as any).name}`;
      } else if (alloc.aspiration_id && alloc.aspiration_management) {
        label = `Aspiração: ${(alloc.aspiration_management as any).code} - ${(alloc.aspiration_management as any).name}`;
      } else if (alloc.pregnancy_id && alloc.pregnancy_management) {
        label = `Prenhez: ${(alloc.pregnancy_management as any).code} - ${(alloc.pregnancy_management as any).name}`;
      }

      if (label) {
        accountAllocations.get(accountId)!.add(label);
      }
    });

    // Convert sets to arrays
    const result = new Map<string, string[]>();
    accountAllocations.forEach((labels, accountId) => {
      result.set(accountId, Array.from(labels));
    });
    return result;
  };

  const exportToPDFResumidoComVinculo = async () => {
    const allocMap = await fetchAllocationsForAccounts(sortedAccounts);

    const doc = new jsPDF("landscape");

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 148, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não pagas - Resumido com Vínculo", 148, 28, { align: "center" });

    const filterInfo = getFilterInfo();
    if (filterInfo.length > 0) {
      doc.setFontSize(10);
      doc.text(`Filtros aplicados: ${filterInfo.join(" | ")}`, 20, 38);
    }

    const tableData = sortedAccounts.map((account) => {
      const vinculos = allocMap.get(account.id) || [];
      return [
        account.description,
        account.employees?.name || account.suppliers?.name || "N/A",
        account.stores?.name || "N/A",
        new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
        account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
        vinculos.join("\n") || "-",
      ];
    });

    const total = sortedAccounts.reduce((sum, account) => sum + (account.amount || 0), 0);

    tableData.push([
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } } as any,
      { content: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold" } } as any,
      { content: `${sortedAccounts.length} parcela(s)`, styles: { fontStyle: "bold" } } as any,
      { content: "", styles: {} } as any,
    ]);

    autoTable(doc, {
      head: [["Título", "Fornecedor", "Fazenda", "Vencimento", "Valor", "Parcelas", "Vínculo"]],
      body: tableData,
      startY: filterInfo.length > 0 ? 45 : 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 },
      columnStyles: { 6: { cellWidth: 60 } },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save("contas-a-pagar-resumido-com-vinculo.pdf");
  };

  const exportToExcel = () => {
    const excelData = sortedAccounts.map((account) => ({
      Título: account.description,
      Fornecedor: account.employees?.name || account.suppliers?.name || "N/A",
      Fazenda: account.stores?.name || "N/A",
      Vencimento: new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR"),
      Valor: account.amount || 0,
      Parcelas:
        account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, "contas-a-pagar.xlsx");
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
            <h1 className="text-2xl font-bold text-primary">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Relatório de contas ainda não pagas</p>
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
            <CardDescription>Configure os filtros para o relatório</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="due_start">Data Vencimento (Início)</Label>
                <Input
                  id="due_start"
                  type="date"
                  value={filters.due_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, due_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="due_end">Data Vencimento (Fim)</Label>
                <Input
                  id="due_end"
                  type="date"
                  value={filters.due_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, due_end: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_start">Data Competência (Início)</Label>
                <Input
                  id="competencia_start"
                  type="date"
                  value={filters.competencia_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, competencia_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="competencia_end">Data Competência (Fim)</Label>
                <Input
                  id="competencia_end"
                  type="date"
                  value={filters.competencia_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, competencia_end: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="created_start">Data Cadastro (Início)</Label>
                <Input
                  id="created_start"
                  type="date"
                  value={filters.created_start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, created_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="created_end">Data Cadastro (Fim)</Label>
                <Input
                  id="created_end"
                  type="date"
                  value={filters.created_end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, created_end: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Select
                  value={filters.supplier_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, supplier_id: value }))}
                >
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
                <Label>Fazenda</Label>
                <Select
                  value={filters.store_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, store_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar Fazenda" />
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
                <Select
                  value={filters.product_id}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, product_id: value }))}
                >
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
                <Label>Tipo de Vínculo</Label>
                <Select
                  value={allocationType}
                  onValueChange={(value) => setAllocationType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="aspiration">Aspiração</SelectItem>
                    <SelectItem value="pregnancy">Prenhez</SelectItem>
                    <SelectItem value="animal">Animais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {allocationType !== "none" && allocationItems.length > 0 && (
                <div>
                  <Label>
                    {allocationType === "aspiration" ? "Aspirações" : allocationType === "pregnancy" ? "Prenhez" : "Animais"}
                  </Label>
                  <Popover open={allocationPopoverOpen} onOpenChange={setAllocationPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {selectedAllocationIds.length === 0
                          ? "Selecionar..."
                          : selectedAllocationIds.length === allocationItems.length
                          ? "Todos selecionados"
                          : `${selectedAllocationIds.length} selecionado(s)`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar pelo nome..."
                          value={allocationSearch}
                          onChange={(e) => setAllocationSearch(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="p-2 border-b">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all"
                            checked={selectedAllocationIds.length === allocationItems.length && allocationItems.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAllocationIds(allocationItems.map(i => i.id));
                              } else {
                                setSelectedAllocationIds([]);
                              }
                            }}
                          />
                          <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                            Selecionar todos
                          </label>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px]">
                        <div className="p-2 space-y-1">
                          {allocationItems
                            .filter(item => item.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                            .map((item) => (
                            <div key={item.id} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                id={`alloc-${item.id}`}
                                checked={selectedAllocationIds.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedAllocationIds(prev => [...prev, item.id]);
                                  } else {
                                    setSelectedAllocationIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                              />
                              <label htmlFor={`alloc-${item.id}`} className="text-sm cursor-pointer">
                                {item.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
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
                <CardTitle>Contas a Pagar ({accounts.length})</CardTitle>
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
                      <DropdownMenuItem onClick={exportToPDFResumido}>Relatório Resumido</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFDetalhado}>Relatório Detalhado</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFPorSubgrupo}>Relatório por Subgrupo</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFResumidoPorMes}>
                        Relatório Resumido por Mês
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFResumidoPorDia}>
                        Relatório Resumido por Dia
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportToPDFResumidoComVinculo}>
                        Relatório Resumido com Vínculo
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
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("description")}>
                      Título {getSortIcon("description")}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("supplier")}>
                      Fornecedor {getSortIcon("supplier")}
                    </TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("due_date")}>
                      Vencimento {getSortIcon("due_date")}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("amount")}>
                      Valor {getSortIcon("amount")}
                    </TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAccounts.map((account, index) => (
                    <TableRow key={`${account.id}-${account.installment_id || index}`}>
                      <TableCell>{account.description}</TableCell>
                      <TableCell>{account.employees?.name || account.suppliers?.name || "N/A"}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(account.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {account.amount?.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }) || "N/A"}
                      </TableCell>
                      <TableCell>
                        {account.total_installments > 1
                          ? `${account.installment_number}/${account.total_installments}`
                          : "À vista"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="border-t-2 font-bold bg-muted/50">
                    <TableCell colSpan={4} className="text-right">
                      Total:
                    </TableCell>
                    <TableCell>
                      {sortedAccounts
                        .reduce((sum, account) => sum + (account.amount || 0), 0)
                        .toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                    </TableCell>
                    <TableCell>{sortedAccounts.length} parcela(s)</TableCell>
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

export default AccountsPayableReport;
