import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, FileSpreadsheet, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { compareByName } from "@/lib/sortByName";

interface ReceivableAccount {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  status: string;
  document_number?: string;
  document_type?: string;
  issue_date?: string;
  created_at: string;
  created_by: string;
  store_id: string;
  creditor_id?: string;
  account_id?: string;
  total_amount?: number;
  notes?: string;
  suppliers?: {
    name: string;
  };
  creditors?: {
    name: string;
  };
  stores?: {
    name: string;
  };
  installment_number?: number;
  total_installments?: number;
  accounts_receivable_items?: Array<{
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
  creditor_id: string;
  store_id: string;
  product_id: string;
}

const AccountsReceivableReports = () => {
  const [filters, setFilters] = useState<Filters>({
    due_date_start: "",
    due_date_end: "",
    payment_date_start: "",
    payment_date_end: "",
    competencia_start: "",
    competencia_end: "",
    created_start: "",
    created_end: "",
    creditor_id: "all",
    store_id: "all",
    product_id: "all",
  });

  const [pendingAccounts, setPendingAccounts] = useState<ReceivableAccount[]>([]);
  const [paidAccounts, setPaidAccounts] = useState<ReceivableAccount[]>([]);
  const [creditors, setCreditors] = useState<Array<{ id: string; name: string }>>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [creditorsRes, storesRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("id, name").eq("is_active", true).eq("is_creditor", true),
        supabase.from("stores").select("id, name"),
        supabase.from("products").select("id, name").eq("is_active", true),
      ]);

      if (creditorsRes.data) setCreditors(creditorsRes.data);
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
      .from("accounts_receivable")
      .select(`
        *,
        suppliers!accounts_receivable_creditor_id_fkey(name),
        stores(name),
        accounts_receivable_items(
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
      query = query.gte("issue_date", filters.competencia_start);
    }
    if (filters.competencia_end) {
      query = query.lte("issue_date", filters.competencia_end);
    }
    if (filters.created_start) {
      query = query.gte("created_at", filters.created_start);
    }
    if (filters.created_end) {
      query = query.lte("created_at", filters.created_end + "T23:59:59");
    }
    if (filters.creditor_id && filters.creditor_id !== "all") {
      query = query.eq("creditor_id", filters.creditor_id);
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

      let pendingData = (pendingRes.data || []) as unknown as ReceivableAccount[];
      let paidData = (paidRes.data || []) as unknown as ReceivableAccount[];

      // Filter by product if specified
      if (filters.product_id && filters.product_id !== "all") {
        const filterByProduct = (accounts: ReceivableAccount[]) =>
          accounts.filter((account) =>
            account.accounts_receivable_items?.some((item) =>
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
      creditor_id: "all",
      store_id: "all",
      product_id: "all",
    });
    setPendingAccounts([]);
    setPaidAccounts([]);
  };

  const exportToPDF = (data: ReceivableAccount[], title: string) => {
    const pdf = new jsPDF();
    pdf.text(title, 20, 20);

    const tableData = data.map((account) => [
      account.description,
      account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      `R$ ${account.amount.toFixed(2)}`,
      format(parseISO(account.due_date), "dd/MM/yyyy"),
      account.payment_date ? format(parseISO(account.payment_date), "dd/MM/yyyy") : "N/A",
      account.status === "paid" ? "Recebido" : "Pendente",
      account.document_number || "N/A",
    ]);

    autoTable(pdf, {
      head: [["Descrição", "Credor", "Loja", "Valor", "Vencimento", "Recebimento", "Status", "Documento"]],
      body: tableData,
      startY: 30,
    });

    pdf.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  const exportToExcel = (data: ReceivableAccount[], title: string) => {
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((account) => ({
        Descrição: account.description,
        Credor: account.suppliers?.name || "N/A",
        Loja: account.stores?.name || "N/A",
        Valor: account.amount,
        Vencimento: format(parseISO(account.due_date), "dd/MM/yyyy"),
        Recebimento: account.payment_date ? format(parseISO(account.payment_date), "dd/MM/yyyy") : "N/A",
        Status: account.status === "paid" ? "Recebido" : "Pendente",
        Documento: account.document_number || "N/A",
        "Data Cadastro": format(parseISO(account.created_at), "dd/MM/yyyy"),
        "Data Competência": account.issue_date
          ? format(parseISO(account.issue_date), "dd/MM/yyyy")
          : "N/A",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
  };

  const renderTable = (data: ReceivableAccount[], showPaymentDate: boolean = false) => (
    <Table className="table-sticky-first">
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Credor</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Vencimento</TableHead>
          {showPaymentDate && <TableHead>Recebimento</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Documento</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((account) => (
          <TableRow key={account.id}>
            <TableCell>{account.description}</TableCell>
            <TableCell>{(account as any).suppliers?.name || "N/A"}</TableCell>
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
                {account.status === "paid" ? "Recebido" : "Pendente"}
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
              <Label>Credor</Label>
              <Select value={filters.creditor_id} onValueChange={(value) => setFilters({ ...filters, creditor_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar credor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {[...creditors].sort(compareByName).map((creditor) => (
                    <SelectItem key={creditor.id} value={creditor.id}>
                      {creditor.name}
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
          <TabsTrigger value="pending">Contas a Receber ({pendingAccounts.length})</TabsTrigger>
          <TabsTrigger value="paid">Contas Recebidas ({paidAccounts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <CardTitle>Contas a Receber</CardTitle>
                  <CardDescription>Contas ainda não recebidas</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToPDF(pendingAccounts, "Relatório de Contas a Receber")}
                    disabled={pendingAccounts.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(pendingAccounts, "Relatório de Contas a Receber")}
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
                  <CardTitle>Contas Recebidas</CardTitle>
                  <CardDescription>Contas já recebidas</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToPDF(paidAccounts, "Relatório de Contas Recebidas")}
                    disabled={paidAccounts.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(paidAccounts, "Relatório de Contas Recebidas")}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountsReceivableReports;