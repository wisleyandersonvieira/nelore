import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  code?: string;
}

interface ProductSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (product: Product) => void;
  isEmployeeMode?: boolean;
  functionType?: "credit" | "debit";
}

export function ProductSearchModal({ 
  open, 
  onOpenChange, 
  onSelectProduct,
  isEmployeeMode = false,
  functionType = "debit"
}: ProductSearchModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open, isEmployeeMode, functionType]);

  useEffect(() => {
    filterProducts();
  }, [searchName, searchCode, products]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("function_type", functionType);

      // Se estiver no modo funcionário, filtrar por grupo do parâmetro FUNCIONÁRIOS
      if (isEmployeeMode) {
        const { data: paramData, error: paramError } = await supabase
          .from("system_parameters")
          .select("group_id")
          .eq("parameter_key", "funcionarios")
          .maybeSingle();

        if (paramError) {
          console.warn("Error fetching FUNCIONÁRIOS parameter:", paramError);
        } else if (paramData?.group_id) {
          query = query.eq("group_id", paramData.group_id);
        }
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar produtos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchName.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (searchCode.trim()) {
      filtered = filtered.filter(product =>
        product.code?.includes(searchCode)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product);
    onOpenChange(false);
    setSearchName("");
    setSearchCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pesquisar Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do produto..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Código</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o código do produto..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="border rounded-md max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-20">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>{product.code || "-"}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelectProduct(product)}
                          variant="ghost"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}