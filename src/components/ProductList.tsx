import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, Ban, Trash2, Package, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Download, FileSpreadsheet, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProductEditModal } from "./ProductEditModal";
import { ProductViewModal } from "./ProductViewModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  is_blocked: boolean;
  group_id?: string;
  subgroup_id?: string;
  unit_id?: string;
  group?: { name: string };
  subgroup?: { name: string };
  unit?: { name: string; symbol: string };
  matrix?: { name: string; code: number };
  cost_price?: number;
  barcode?: string;
  product_type?: string;
  function_type?: string;
}

interface Group {
  id: string;
  name: string;
}

interface ProductListProps {
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ProductList = ({ canEdit = true, canDelete = true }: ProductListProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [userBrandId, setUserBrandId] = useState<string | null>(null);
  
  const { matrixId, isLoading: isLoadingMatrix } = useUserMatrix();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Filters
  const [filters, setFilters] = useState({
    description: "",
    code: "",
    group_id: undefined as string | undefined,
    subgroup_id: undefined as string | undefined
  });

  const { toast } = useToast();

  useEffect(() => {
    if (matrixId) {
      fetchUserBrand();
    }
  }, [matrixId]);

  useEffect(() => {
    if (userBrandId) {
      fetchInitialData();
    }
  }, [userBrandId]);

  const fetchUserBrand = async () => {
    try {
      const { data: matrixData } = await supabase
        .from('matrices')
        .select('brand_id')
        .eq('id', matrixId)
        .single();
      
      if (matrixData?.brand_id) {
        setUserBrandId(matrixData.brand_id);
      }
    } catch (error) {
      console.error('Error fetching user brand:', error);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [products, filters]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch products with related data including group_id and subgroup_id
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id, code, name, description, is_active, is_blocked, barcode, cost_price,
          group_id, subgroup_id, unit_id, product_type, function_type,
          group:account_groups!group_id(name),
          subgroup:account_groups!subgroup_id(name),
          unit:units_of_measure!unit_id(name, symbol),
          matrix:matrices!matrix_id(name, code)
        `)
        .order("code");

      if (productsError) throw productsError;
      
      // Sort products by code numerically (ascending)
      const sortedProducts = (productsData || []).sort((a, b) => {
        const codeA = parseInt(a.code || "0", 10);
        const codeB = parseInt(b.code || "0", 10);
        return codeA - codeB;
      });
      setProducts(sortedProducts);

      // Fetch groups for filters - filter by user's brand
      const { data: groupsData } = await supabase
        .from("account_groups")
        .select("id, name")
        .is("parent_id", null)
        .eq("brand_id", userBrandId)
        .order("name");
      setGroups(groupsData || []);

      // Fetch subgroups for filters - filter by user's brand
      const { data: subgroupsData } = await supabase
        .from("account_groups")
        .select("id, name")
        .not("parent_id", "is", null)
        .eq("brand_id", userBrandId)
        .order("name");
      setSubgroups(subgroupsData || []);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível carregar os produtos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    if (filters.description) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(filters.description.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(filters.description.toLowerCase()))
      );
    }

    if (filters.code) {
      filtered = filtered.filter(product => 
        product.code.includes(filters.code)
      );
    }

    if (filters.group_id && filters.group_id !== "__all__") {
      filtered = filtered.filter(product => 
        product.group?.name === groups.find(g => g.id === filters.group_id)?.name
      );
    }

    if (filters.subgroup_id && filters.subgroup_id !== "__all__") {
      filtered = filtered.filter(product => 
        product.subgroup?.name === subgroups.find(s => s.id === filters.subgroup_id)?.name
      );
    }

    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleToggleBlock = async (product: Product) => {
    try {
      const newBlockedState = !product.is_blocked;
      
      // Quando bloqueia, também inativa; quando desbloqueia, mantém inativo (usuário deve ativar manualmente)
      const updateData = newBlockedState 
        ? { is_blocked: true, is_active: false }
        : { is_blocked: false };

      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Produto ${newBlockedState ? 'bloqueado' : 'desbloqueado'} com sucesso!`,
      });

      fetchInitialData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível alterar o status do produto.",
      });
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir o produto ${product.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso!",
      });

      fetchInitialData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível excluir o produto.",
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      description: "",
      code: "",
      group_id: undefined,
      subgroup_id: undefined
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Produtos", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
    doc.text(`Total de produtos: ${filteredProducts.length}`, 14, 34);

    const tableData = filteredProducts.map((product) => [
      product.code,
      product.name,
      product.group?.name || "-",
      product.subgroup?.name || "-",
      product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-",
      product.is_active ? "Ativo" : "Inativo",
      product.is_blocked ? "Sim" : "Não",
    ]);

    autoTable(doc, {
      head: [["Código", "Descrição", "Grupo", "Subgrupo", "Unidade", "Status", "Bloqueado"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("produtos.pdf");
    toast({
      title: "Sucesso",
      description: "PDF exportado com sucesso!",
    });
  };

  const exportToExcel = () => {
    const data = filteredProducts.map((product) => ({
      Código: product.code,
      Descrição: product.name,
      "Descrição Detalhada": product.description || "",
      Grupo: product.group?.name || "-",
      Subgrupo: product.subgroup?.name || "-",
      Unidade: product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-",
      "Preço de Custo": product.cost_price ? product.cost_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-",
      "Código de Barras": product.barcode || "-",
      Status: product.is_active ? "Ativo" : "Inativo",
      Bloqueado: product.is_blocked ? "Sim" : "Não",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos.xlsx");
    
    toast({
      title: "Sucesso",
      description: "Excel exportado com sucesso!",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Filtros de Busca
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 max-md:h-10">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[200px]">
              <Label htmlFor="filter-description" className="text-xs">Descrição</Label>
              <Input
                id="filter-description"
                placeholder="Buscar por nome ou descrição"
                value={filters.description}
                onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                className="h-8"
              />
            </div>
            
            <div className="space-y-1 min-w-0 flex-1 sm:flex-none sm:w-[100px]">
              <Label htmlFor="filter-code" className="text-xs">Código</Label>
              <Input
                id="filter-code"
                placeholder="Código"
                value={filters.code}
                onChange={(e) => setFilters({ ...filters, code: e.target.value })}
                className="h-8"
              />
            </div>
            
            <div className="space-y-1 min-w-0 flex-1 sm:flex-none sm:w-[140px]">
              <Label htmlFor="filter-group" className="text-xs">Grupo</Label>
              <Select value={filters.group_id} onValueChange={(value) => setFilters({ ...filters, group_id: value })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os grupos</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1 min-w-0 flex-1 sm:flex-none sm:w-[140px]">
              <Label htmlFor="filter-subgroup" className="text-xs">Subgrupo</Label>
              <Select value={filters.subgroup_id} onValueChange={(value) => setFilters({ ...filters, subgroup_id: value })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os subgrupos</SelectItem>
                  {subgroups.map((subgroup) => (
                    <SelectItem key={subgroup.id} value={subgroup.id}>
                      {subgroup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={clearFilters} size="sm" className="h-8 max-md:h-10">
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Produtos */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="shrink-0 py-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos Cadastrados ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Cabeçalho fixo */}
          <Table className="table-sticky-first table-sticky-last">
            <TableHeader className="bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[8%] h-9 py-1">Código</TableHead>
                <TableHead className="w-[28%] h-9 py-1">Descrição</TableHead>
                <TableHead className="w-[14%] h-9 py-1">Grupo</TableHead>
                <TableHead className="w-[14%] h-9 py-1">Subgrupo</TableHead>
                <TableHead className="w-[12%] h-9 py-1">Unidade</TableHead>
                <TableHead className="w-[12%] h-9 py-1">Status</TableHead>
                <TableHead className="text-right w-[12%] h-9 py-1">Ações</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          {/* Corpo com scroll */}
          <ScrollArea className="flex-1">
            <Table>
              <TableBody>
                {loading || isLoadingMatrix ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-12">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-12">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id} className="h-10">
                      <TableCell className="font-mono py-1 w-[8%]">{product.code}</TableCell>
                      <TableCell className="py-1 w-[28%]">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 w-[14%]">{product.group?.name || "-"}</TableCell>
                      <TableCell className="py-1 w-[14%]">{product.subgroup?.name || "-"}</TableCell>
                      <TableCell className="py-1 w-[12%]">
                        {product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-"}
                      </TableCell>
                      <TableCell className="py-1 w-[12%]">
                        <div className="flex gap-1">
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                            {product.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          {product.is_blocked && (
                            <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-1 w-[12%]">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setViewingProduct(product);
                              setViewModalOpen(true);
                            }}
                            title="Visualizar"
                            className="h-10 md:h-7 w-10 md:w-7 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(product);
                                setEditModalOpen(true);
                              }}
                              title="Editar"
                              className="h-10 md:h-7 w-10 md:w-7 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleBlock(product)}
                              title={product.is_blocked ? "Desbloquear" : "Bloquear"}
                              className="h-10 md:h-7 w-10 md:w-7 p-0"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(product)}
                              title="Excluir"
                              className="text-destructive hover:text-destructive h-10 md:h-7 w-10 md:w-7 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="border-t px-4 py-3 flex items-center justify-between bg-card shrink-0">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProducts.length)} de {filteredProducts.length} produtos
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="h-10 md:h-8 w-10 md:w-8 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-10 md:h-8 w-10 md:w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
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
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      className="h-10 md:h-8 w-10 md:w-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-10 md:h-8 w-10 md:w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-10 md:h-8 w-10 md:w-8 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de Edição */}
      <ProductEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        product={editingProduct}
        onSaveSuccess={() => {
          setEditModalOpen(false);
          setEditingProduct(null);
          fetchInitialData();
        }}
      />

      {/* Modal de Visualização */}
      <ProductViewModal
        open={viewModalOpen}
        onOpenChange={(open) => {
          setViewModalOpen(open);
          if (!open) setViewingProduct(null);
        }}
        product={viewingProduct}
      />
    </div>
  );
};