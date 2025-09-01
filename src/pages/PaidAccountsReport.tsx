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
import "jspdf-autotable";
import * as XLSX from "xlsx";

const PaidAccountsReport = () => {
  const navigate = useNavigate();
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
      let query = supabase
        .from("accounts_payable")
        .select("*")
        .eq("is_paid", true);

      if (filters.payment_start) {
        query = query.gte("payment_date", filters.payment_start);
      }
      if (filters.payment_end) {
        query = query.lte("payment_date", filters.payment_end);
      }
      if (filters.competencia_start) {
        query = query.gte("data_competencia", filters.competencia_start);
      }
      if (filters.competencia_end) {
        query = query.lte("data_competencia", filters.competencia_end);
      }
      if (filters.created_start) {
        query = query.gte("created_at", filters.created_start + "T00:00:00");
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

      const { data, error } = await query;

      if (error) throw error;

      let accountsData = data || [];

      // Remove product filtering for now since we're not joining the related tables
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
    });
    setAccounts([]);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Contas Pagas", 20, 20);
    
    const tableData = accounts.map(account => [
      account.description,
      "N/A", // Supplier name - would need join to get actual name
      "N/A", // Store name - would need join to get actual name  
      account.payment_date ? new Date(account.payment_date).toLocaleDateString("pt-BR") : "N/A",
      account.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      (account.installments || 1) > 1 ? `Parcelado (${account.installments}x)` : "À vista"
    ]);

    (doc as any).autoTable({
      head: [["Título", "Fornecedor", "Loja", "Data Pagamento", "Valor", "Parcelas"]],
      body: tableData,
      startY: 30,
    });

    doc.save("contas-pagas.pdf");
  };

  const exportToExcel = () => {
    const excelData = accounts.map(account => ({
      Título: account.description,
      Fornecedor: "N/A", // Would need join to get actual name
      Loja: "N/A", // Would need join to get actual name
      "Data Pagamento": account.payment_date ? new Date(account.payment_date).toLocaleDateString("pt-BR") : "N/A",
      Valor: account.amount || 0,
      Parcelas: (account.installments || 1) > 1 ? `Parcelado (${account.installments}x)` : "À vista"
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
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.description}</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>
                        {account.payment_date ? new Date(account.payment_date).toLocaleDateString("pt-BR") : "N/A"}
                      </TableCell>
                      <TableCell>
                        {account.amount?.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        }) || "N/A"}
                      </TableCell>
                      <TableCell>
                        {(account.installments || 1) > 1 ? `Parcelado (${account.installments}x)` : "À vista"}
                      </TableCell>
                    </TableRow>
                  ))}
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