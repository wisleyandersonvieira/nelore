import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Filter, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

  const [accounts, setAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchStores();
    fetchProducts();
  }, []);

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

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Fetch accounts with suppliers, stores and installments
      const { data: allAccounts, error } = await supabase
        .from("accounts_payable")
        .select(`
          *,
          suppliers(id, name),
          stores(id, name),
          accounts_payable_installments(*)
        `) as { data: any[] | null; error: any };

      if (error) throw error;

      // Filter for unpaid accounts only and expand installments
      let accountsData: any[] = [];
      (allAccounts || []).forEach((account: any) => {
        if (account.status === 'paid') return;
        
        if (account.accounts_payable_installments && account.accounts_payable_installments.length > 0) {
          // Has installments - create one row per unpaid installment
          account.accounts_payable_installments.forEach((installment: any) => {
            if (!installment.payment_date) { // Only unpaid installments
              accountsData.push({
                ...account,
                due_date: installment.due_date,
                amount: installment.amount,
                installment_number: installment.installment_number,
                total_installments: account.accounts_payable_installments.length,
                installment_id: installment.id
              });
            }
          });
        } else {
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
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE CONTAS A PAGAR", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Contas ainda não pagas", 105, 28, { align: "center" });
    
    // Date range info
    let filterInfo = [];
    if (filters.due_start || filters.due_end) {
      const start = filters.due_start ? new Date(filters.due_start).toLocaleDateString("pt-BR") : "Início";
      const end = filters.due_end ? new Date(filters.due_end).toLocaleDateString("pt-BR") : "Hoje";
      filterInfo.push(`Vencimento: ${start} a ${end}`);
    }
    if (filters.supplier_id !== "all") {
      const supplier = suppliers.find(s => s.id === filters.supplier_id);
      if (supplier) filterInfo.push(`Fornecedor: ${supplier.name}`);
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
      account.description,
      account.suppliers?.name || "N/A",
      account.stores?.name || "N/A",
      new Date(account.due_date).toLocaleDateString("pt-BR"),
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
      head: [["Título", "Fornecedor", "Loja", "Vencimento", "Valor", "Parcelas"]],
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

    doc.save("contas-a-pagar.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: account.description,
      Fornecedor: account.suppliers?.name || "N/A",
      Loja: account.stores?.name || "N/A",
      Vencimento: new Date(account.due_date).toLocaleDateString("pt-BR"),
      Valor: account.amount || 0,
      Parcelas: account.total_installments > 1 ? `${account.installment_number}/${account.total_installments}` : "À vista"
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
          <Button onClick={() => navigate("/reports/accounts-payable")} variant="outline" size="sm">
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
                  <Button onClick={exportToPDF} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
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
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account, index) => (
                    <TableRow key={`${account.id}-${account.installment_id || index}`}>
                      <TableCell>{account.description}</TableCell>
                      <TableCell>{account.suppliers?.name || "N/A"}</TableCell>
                      <TableCell>{account.stores?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(account.due_date).toLocaleDateString("pt-BR")}</TableCell>
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

export default AccountsPayableReport;