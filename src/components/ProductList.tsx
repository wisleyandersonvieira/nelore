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

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  is_blocked: boolean;
  group_id?: string;
  subgroup_id?: string;
  unit_id?: string;
  group?: { name: string };
  subgroup?: { name: string };
  unit?: { name: string; symbol: string };
  cost_price?: number;
  unit_price?: number;
  barcode?: string;
}

interface Group {
  id: string;
  name: string;
}

interface ProductListProps {
  onEditProduct?: (product: Product) => void;
}

export const ProductList = ({ onEditProduct }: ProductListProps) => {
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
          id, code, name, description, category, is_active, is_blocked, barcode, cost_price, unit_price,
          group_id, subgroup_id, unit_id,
          group:account_groups!group_id(name),
          subgroup:account_groups!subgroup_id(name),
          unit:units_of_measure!unit_id(name, symbol)
        `)
        .order("code");

      if (productsError) throw productsError;
      setProducts(productsData || []);

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar produtos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-description">Descrição</Label>
              <Input
                id="filter-description"
                placeholder="Buscar por nome ou descrição"
                value={filters.description}
                onChange={(e) => setFilters({ ...filters, description: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filter-code">Código</Label>
              <Input
                id="filter-code"
                placeholder="Buscar por código"
                value={filters.code}
                onChange={(e) => setFilters({ ...filters, code: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filter-group">Grupo</Label>
              <Select value={filters.group_id} onValueChange={(value) => setFilters({ ...filters, group_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
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
            
            <div className="space-y-2">
              <Label htmlFor="filter-subgroup">Subgrupo</Label>
              <Select value={filters.subgroup_id} onValueChange={(value) => setFilters({ ...filters, subgroup_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os subgrupos" />
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
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos Cadastrados ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Subgrupo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono">{product.code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.group?.name || "-"}</TableCell>
                      <TableCell>{product.subgroup?.name || "-"}</TableCell>
                      <TableCell>
                        {product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          {product.is_blocked && (
                            <Badge variant="destructive">Bloqueado</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (onEditProduct) {
                                onEditProduct(product);
                              }
                            }}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleBlock(product)}
                            title={product.is_blocked ? "Desbloquear" : "Bloquear"}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};