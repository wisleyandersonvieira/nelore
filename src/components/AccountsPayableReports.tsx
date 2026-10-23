import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Download, FileSpreadsheet, Search, ChevronDown, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PayableAccount {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  status: string;
  document_number?: string;
  document_type?: string;
  issue_date?: string;
  data_competencia?: string;
  created_at: string;
  created_by: string;
  store_id: string;
  supplier_id?: string;
  account_id?: string;
  total_amount?: number;
  attachments?: any;
  notes?: string;
  suppliers?: {
    name: string;
  };
  stores?: {
    name: string;
  };
  installment_number?: number;
  total_installments?: number;
  accounts_payable_items?: Array<{
    products: {
      name: string;
    };
  }>;
}

interface Filters {
  due_date_start: string;
  due_date_end: string;
  payment_date_start: string;
  payment_date_end: string;
  competencia_start: string;
  competencia_end: string;
  created_start: string;
  created_end: string;
  supplier_id: string;
  store_id: string;
  product_id: string;
}

const AccountsPayableReports = () => {
  const [filters, setFilters] = useState<Filters>({
    due_date_start: "",
    due_date_end: "",
    payment_date_start: "",
    payment_date_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    supplier_id: "all",
    store_id: "all",
    product_id: "all",
  });

  const [pendingAccounts, setPendingAccounts] = useState<PayableAccount[]>([]);
  const [paidAccounts, setPaidAccounts] = useState<PayableAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [suppliersRes, storesRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("id, name").eq("is_active", true),
        supabase.from("stores").select("id, name"),
        supabase.from("products").select("id, name").eq("is_active", true),
      ]);

      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (storesRes.data) setStores(storesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados iniciais",
        variant: "destructive",
      });
    }
  };

  const buildQuery = (isPaid: boolean) => {
    let query = supabase
      .from("accounts_payable")
      .select(`
        *,
        suppliers(name),
        stores(name),
        accounts_payable_items(
          products(name)
        )
      `);

    // Filter by payment status
    if (isPaid) {
      query = query.not("payment_date", "is", null);
    } else {
      query = query.is("payment_date", null);
    }

    // Apply filters
    if (filters.due_date_start) {
      query = query.gte("due_date", filters.due_date_start);
    }
    if (filters.due_date_end) {
      query = query.lte("due_date", filters.due_date_end);
    }
    if (filters.payment_date_start && isPaid) {
      query = query.gte("payment_date", filters.payment_date_start);
    }
    if (filters.payment_date_end && isPaid) {
      query = query.lte("payment_date", filters.payment_date_end);
    }
    if (filters.competencia_start) {
      query = query.gte("data_competencia", filters.competencia_start);
    }
    if (filters.competencia_end) {
      query = query.lte("data_competencia", filters.competencia_end);
    }
    if (filters.created_start) {
      query = query.gte("created_at", filters.created_start);
    }
    if (filters.created_end) {
      query = query.lte("created_at", filters.created_end + "T23:59:59");
    }
    if (filters.supplier_id && filters.supplier_id !== "all") {
      query = query.eq("supplier_id", filters.supplier_id);
    }
    if (filters.store_id && filters.store_id !== "all") {
      query = query.eq("store_id", filters.store_id);
    }

    return query;
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const [pendingRes, paidRes] = await Promise.all([
        buildQuery(false),
        buildQuery(true),
      ]);

      let pendingData = (pendingRes.data || []) as PayableAccount[];
      let paidData = (paidRes.data || []) as PayableAccount[];

      // Filter by product if specified
      if (filters.product_id && filters.product_id !== "all") {
        const filterByProduct = (accounts: PayableAccount[]) =>
          accounts.filter((account) =>
            account.accounts_payable_items?.some((item) =>
              item.products?.name.toLowerCase().includes(
                products.find((p) => p.id === filters.product_id)?.name.toLowerCase() || ""
              )
            )
          );

        pendingData = filterByProduct(pendingData);
        paidData = filterByProduct(paidData);
      }

      setPendingAccounts(pendingData);
      setPaidAccounts(paidData);
    } catch (error) {
      console.error("Error filtering accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao filtrar contas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      due_date_start: "",
      due_date_end: "",
      payment_date_start: "",
      payment_date_end: "",
      competencia_start: "",
      competencia_end: "",
      created_start: "",
      created_end: "",
      supplier_id: "all",
      store_id: "all",
      product_id: "all",
    });
    setPendingAccounts([]);
    setPaidAccounts([]);
  };

  const exportToPDF = (data: PayableAccount[], title: string) => {
    const pdf = new jsPDF();
    pdf.text(title, 20, 20);

    const tableData = data.map((account) => [
      account.description,
      account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      `R$ ${account.amount.toFixed(2)}`,
      format(parseISO(account.due_date), "dd/MM/yyyy"),
      account.payment_date ? format(parseISO(account.payment_date), "dd/MM/yyyy") : "N/A",
      account.status === "paid" ? "Pago" : "Pendente",
      account.document_number || "N/A",
    ]);

    autoTable(pdf, {
      head: [["Descrição", "Fornecedor", "Loja", "Valor", "Vencimento", "Pagamento", "Status", "Documento"]],
      body: tableData,
      startY: 30,
    });

    pdf.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  const exportToPDFPorSubgrupo = async (data: PayableAccount[], title: string) => {
    // Fetch accounts with items and products including subgroup info
    const accountIds = data.map(acc => acc.id);
    
    if (accountIds.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhuma conta para exportar",
        variant: "destructive",
      });
      return;
    }

    const { data: accountsWithItems } = await supabase
      .from("accounts_payable")
      .select(`
        *,
        suppliers(name),
        stores(name),
        accounts_payable_items(
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products(id, name, subgroup_id, account_groups:subgroup_id(id, name))
        )
      `)
      .in("id", accountIds);

    if (!accountsWithItems) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Agrupado por Subgrupo", 105, 22, { align: "center" });

    // Group accounts by subgroup
    const accountsBySubgroup: { [key: string]: { subgroupName: string; items: any[] } } = {};
    
    accountsWithItems.forEach((account: any) => {
      // Process items
      if (account.accounts_payable_items && account.accounts_payable_items.length > 0) {
        account.accounts_payable_items.forEach((item: any) => {
          const subgroupId = item.products?.subgroup_id || 'sem-subgrupo';
          const subgroupName = item.products?.account_groups?.name || 'Sem Subgrupo';
          
          if (!accountsBySubgroup[subgroupId]) {
            accountsBySubgroup[subgroupId] = {
              subgroupName,
              items: []
            };
          }
          
          accountsBySubgroup[subgroupId].items.push({
            description: account.description,
            supplierName: account.suppliers?.name || "N/A",
            storeName: account.stores?.name || "N/A",
            dueDate: account.due_date,
            paymentDate: account.payment_date,
            amount: item.total_price || 0,
            productName: item.products?.name || "Produto"
          });
        });
      } else {
        // No items - add to "Sem Subgrupo"
        if (!accountsBySubgroup['sem-subgrupo']) {
          accountsBySubgroup['sem-subgrupo'] = {
            subgroupName: 'Sem Subgrupo',
            items: []
          };
        }
        accountsBySubgroup['sem-subgrupo'].items.push({
          description: account.description,
          supplierName: account.suppliers?.name || "N/A",
          storeName: account.stores?.name || "N/A",
          dueDate: account.due_date,
          paymentDate: account.payment_date,
          amount: account.amount || 0,
          productName: null
        });
      }
    });

    // Build table data
    const tableData: any[] = [];
    let grandTotal = 0;
    let totalItems = 0;
    
    Object.values(accountsBySubgroup).forEach(group => {
      // Subgroup header row
      tableData.push([
        { content: group.subgroupName, colSpan: 6, styles: { fontStyle: "bold", fillColor: [220, 220, 220], fontSize: 10 } }
      ]);
      
      // Items for this subgroup
      let subgroupTotal = 0;
      group.items.forEach(item => {
        tableData.push([
          item.description,
          item.supplierName,
          item.storeName,
          item.dueDate ? format(parseISO(item.dueDate), "dd/MM/yyyy") : "N/A",
          item.paymentDate ? format(parseISO(item.paymentDate), "dd/MM/yyyy") : "N/A",
          item.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A"
        ]);
        subgroupTotal += item.amount || 0;
        totalItems++;
      });
      
      // Subgroup subtotal
      tableData.push([
        { content: `Subtotal ${group.subgroupName}`, colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: subgroupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }
      ]);
      
      grandTotal += subgroupTotal;
    });
    
    // Grand total row
    tableData.push([
      { content: "TOTAL GERAL", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [59, 130, 246], textColor: 255 } },
      { content: grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), styles: { fontStyle: "bold", fillColor: [59, 130, 246], textColor: 255 } }
    ]);

    autoTable(doc, {
      head: [["Descrição", "Fornecedor", "Loja", "Vencimento", "Pagamento", "Valor"]],
      body: tableData,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold"
      },
      margin: { left: 10, right: 10 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, doc.internal.pageSize.height - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}-por-subgrupo.pdf`);
  };

  const exportToExcel = (data: PayableAccount[], title: string) => {
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((account) => ({
        Descrição: account.description,
        Fornecedor: account.suppliers?.name || "N/A",
        Loja: account.stores?.name || "N/A",
        Valor: account.amount,
        Vencimento: format(parseISO(account.due_date), "dd/MM/yyyy"),
        Pagamento: account.payment_date ? format(parseISO(account.payment_date), "dd/MM/yyyy") : "N/A",
        Status: account.status === "paid" ? "Pago" : "Pendente",
        Documento: account.document_number || "N/A",
        "Data Cadastro": format(parseISO(account.created_at), "dd/MM/yyyy"),
        "Data Competência": account.data_competencia
          ? format(parseISO(account.data_competencia), "dd/MM/yyyy")
          : "N/A",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
  };

  const renderTable = (data: PayableAccount[], showPaymentDate: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Vencimento</TableHead>
          {showPaymentDate && <TableHead>Pagamento</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Documento</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((account) => (
          <TableRow key={account.id}>
            <TableCell>{account.description}</TableCell>
            <TableCell>{account.suppliers?.name || "N/A"}</TableCell>
            <TableCell>{account.stores?.name || "N/A"}</TableCell>
            <TableCell>R$ {account.amount.toFixed(2)}</TableCell>
            <TableCell>{format(parseISO(account.due_date), "dd/MM/yyyy")}</TableCell>
            {showPaymentDate && (
              <TableCell>
                {account.payment_date ? format(parseISO(account.payment_date), "dd/MM/yyyy") : "N/A"}
              </TableCell>
            )}
            <TableCell>
              <Badge variant={account.status === "paid" ? "default" : "secondary"}>
                {account.status === "paid" ? "Pago" : "Pendente"}
              </Badge>
            </TableCell>
            <TableCell>{account.document_number || "N/A"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>Configure os filtros para gerar os relatórios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Vencimento (Início)</Label>
              <Input
                type="date"
                value={filters.due_date_start}
                onChange={(e) => setFilters({ ...filters, due_date_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Vencimento (Fim)</Label>
              <Input
                type="date"
                value={filters.due_date_end}
                onChange={(e) => setFilters({ ...filters, due_date_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Competência (Início)</Label>
              <Input
                type="date"
                value={filters.competencia_start}
                onChange={(e) => setFilters({ ...filters, competencia_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Competência (Fim)</Label>
              <Input
                type="date"
                value={filters.competencia_end}
                onChange={(e) => setFilters({ ...filters, competencia_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Cadastro (Início)</Label>
              <Input
                type="date"
                value={filters.created_start}
                onChange={(e) => setFilters({ ...filters, created_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Cadastro (Fim)</Label>
              <Input
                type="date"
                value={filters.created_end}
                onChange={(e) => setFilters({ ...filters, created_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={filters.supplier_id} onValueChange={(value) => setFilters({ ...filters, supplier_id: value })}>
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
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={filters.store_id} onValueChange={(value) => setFilters({ ...filters, store_id: value })}>
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
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={filters.product_id} onValueChange={(value) => setFilters({ ...filters, product_id: value })}>
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
            <Button onClick={handleFilter} disabled={loading}>
              {loading ? "Filtrando..." : "Filtrar"}
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">Contas a Pagar ({pendingAccounts.length})</TabsTrigger>
          <TabsTrigger value="paid">Contas Pagas ({paidAccounts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <CardTitle>Contas a Pagar</CardTitle>
                  <CardDescription>Contas ainda não pagas</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={pendingAccounts.length === 0}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => exportToPDF(pendingAccounts, "Relatório de Contas a Pagar")}>
                        Relatório Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportToPDFPorSubgrupo(pendingAccounts, "Relatório de Contas a Pagar")}>
                        Relatório por Subgrupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(pendingAccounts, "Relatório de Contas a Pagar")}
                    disabled={pendingAccounts.length === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingAccounts.length > 0 ? (
                renderTable(pendingAccounts)
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conta encontrada com os filtros aplicados
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <CardTitle>Contas Pagas</CardTitle>
                  <CardDescription>Contas já quitadas</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={paidAccounts.length === 0}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => exportToPDF(paidAccounts, "Relatório de Contas Pagas")}>
                        Relatório Resumido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportToPDFPorSubgrupo(paidAccounts, "Relatório de Contas Pagas")}>
                        Relatório por Subgrupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(paidAccounts, "Relatório de Contas Pagas")}
                    disabled={paidAccounts.length === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paidAccounts.length > 0 ? (
                renderTable(paidAccounts, true)
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conta encontrada com os filtros aplicados
                </p>
              )}
              <div className="space-y-2 mt-4">
                <Label>Filtros para Contas Pagas</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Pagamento (Início)</Label>
                    <Input
                      type="date"
                      value={filters.payment_date_start}
                      onChange={(e) => setFilters({ ...filters, payment_date_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Pagamento (Fim)</Label>
                    <Input
                      type="date"
                      value={filters.payment_date_end}
                      onChange={(e) => setFilters({ ...filters, payment_date_end: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountsPayableReports;