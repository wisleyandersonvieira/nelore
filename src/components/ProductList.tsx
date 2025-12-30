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
import { Search, Edit, Ban, Trash2, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  onEditProduct?: (product: Product) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ProductList = ({ onEditProduct, canEdit = true, canDelete = true }: ProductListProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    description: "",
    code: "",
    group_id: undefined as string | undefined,
    subgroup_id: undefined as string | undefined
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

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
          unit:units_of_measure!unit_id(name, symbol)
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

      // Fetch groups for filters
      const { data: groupsData } = await supabase
        .from("account_groups")
        .select("id, name")
        .is("parent_id", null)
        .order("name");
      setGroups(groupsData || []);

      // Fetch subgroups for filters
      const { data: subgroupsData } = await supabase
        .from("account_groups")
        .select("id, name")
        .not("parent_id", "is", null)
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
  };

  const handleToggleBlock = async (product: Product) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_blocked: !product.is_blocked })
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Produto ${!product.is_blocked ? 'bloqueado' : 'desbloqueado'} com sucesso!`,
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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label htmlFor="filter-description" className="text-xs">Descrição</Label>
              <Input
                id="filter-description"
                placeholder="Buscar por nome ou descrição"
                value={filters.description}
                onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                className="h-8"
              />
            </div>
            
            <div className="space-y-1 w-[100px]">
              <Label htmlFor="filter-code" className="text-xs">Código</Label>
              <Input
                id="filter-code"
                placeholder="Código"
                value={filters.code}
                onChange={(e) => setFilters({ ...filters, code: e.target.value })}
                className="h-8"
              />
            </div>
            
            <div className="space-y-1 w-[140px]">
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
            
            <div className="space-y-1 w-[140px]">
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

            <Button variant="outline" onClick={clearFilters} size="sm" className="h-8">
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
          <Table>
            <TableHeader className="bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[8%] h-9 py-1">Código</TableHead>
                <TableHead className="w-[27%] h-9 py-1">Descrição</TableHead>
                <TableHead className="w-[15%] h-9 py-1">Grupo</TableHead>
                <TableHead className="w-[15%] h-9 py-1">Subgrupo</TableHead>
                <TableHead className="w-[12%] h-9 py-1">Unidade</TableHead>
                <TableHead className="w-[10%] h-9 py-1">Status</TableHead>
                <TableHead className="text-right w-[13%] h-9 py-1">Ações</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          {/* Corpo com scroll */}
          <ScrollArea className="flex-1">
            <Table>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-12">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-12">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="h-10">
                      <TableCell className="font-mono py-1 w-[8%]">{product.code}</TableCell>
                      <TableCell className="py-1 w-[27%]">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 w-[15%]">{product.group?.name || "-"}</TableCell>
                      <TableCell className="py-1 w-[15%]">{product.subgroup?.name || "-"}</TableCell>
                      <TableCell className="py-1 w-[12%]">
                        {product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-"}
                      </TableCell>
                      <TableCell className="py-1 w-[10%]">
                        <div className="flex gap-1">
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                            {product.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          {product.is_blocked && (
                            <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-1 w-[13%]">
                        <div className="flex gap-1 justify-end">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (onEditProduct) {
                                  onEditProduct(product);
                                }
                              }}
                              title="Editar"
                              className="h-7 w-7 p-0"
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
                              className="h-7 w-7 p-0"
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
                              className="text-destructive hover:text-destructive h-7 w-7 p-0"
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
      </Card>

    </div>
  );
};