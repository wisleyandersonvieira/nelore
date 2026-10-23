import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  cost_price?: number;
  barcode?: string;
  product_type?: string;
  function_type?: string;
  group?: { name: string };
  subgroup?: { name: string };
  unit?: { name: string; symbol: string };
}

interface SupplierCode {
  id: string;
  supplier_code: string;
  supplier: {
    name: string;
  };
}

interface ProductViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export const ProductViewModal = ({ open, onOpenChange, product }: ProductViewModalProps) => {
  const [supplierCodes, setSupplierCodes] = useState<SupplierCode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      fetchSupplierCodes();
    }
  }, [open, product]);

  const fetchSupplierCodes = async () => {
    if (!product) return;
    
    setLoading(true);
    try {
      // First get supplier codes
      const { data: codesData, error: codesError } = await supabase
        .from("product_supplier_codes")
        .select("id, supplier_code, supplier_id")
        .eq("product_id", product.id);

      if (codesError) throw codesError;

      // Then get supplier names
      if (codesData && codesData.length > 0) {
        const supplierIds = codesData.map(c => c.supplier_id);
        const { data: suppliersData } = await supabase
          .from("suppliers")
          .select("id, name")
          .in("id", supplierIds);

        const suppliersMap = new Map(suppliersData?.map(s => [s.id, s.name]) || []);

        const enrichedCodes = codesData.map(c => ({
          id: c.id,
          supplier_code: c.supplier_code,
          supplier: { name: suppliersMap.get(c.supplier_id) || "-" }
        }));

        setSupplierCodes(enrichedCodes);
      } else {
        setSupplierCodes([]);
      }
    } catch (error) {
      console.error("Error fetching supplier codes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const productTypeLabel = product.product_type === "service" ? "Serviço" : "Produto";
  const functionTypeLabel = product.function_type === "credit" ? "Crédito" : "Débito";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Visualizar Produto</DialogTitle>
          <DialogDescription>
            Detalhes do produto - Código: {product.code}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Informações Básicas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Código</Label>
                <p className="font-mono font-medium">{product.code}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <p className="font-medium">{productTypeLabel}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Função</Label>
                <p className="font-medium">{functionTypeLabel}</p>
              </div>
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="font-medium">{product.name}</p>
              </div>
              {product.description && (
                <div className="col-span-2 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Descrição Adicional</Label>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Classificação */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Classificação</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Grupo</Label>
                <p className="font-medium">{product.group?.name || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Subgrupo</Label>
                <p className="font-medium">{product.subgroup?.name || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unidade de Medida</Label>
                <p className="font-medium">
                  {product.unit ? `${product.unit.name} (${product.unit.symbol})` : "-"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Informações Comerciais */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Informações Comerciais</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Código de Barras</Label>
                <p className="font-mono font-medium">{product.barcode || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Preço de Custo</Label>
                <p className="font-medium">
                  {product.cost_price 
                    ? product.cost_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) 
                    : "-"
                  }
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="flex gap-2 mt-1">
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  {product.is_blocked && (
                    <Badge variant="destructive">Bloqueado</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Códigos dos Fornecedores */}
          {supplierCodes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Códigos dos Fornecedores</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Código do Fornecedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierCodes.map((sc) => (
                      <TableRow key={sc.id}>
                        <TableCell>{sc.supplier?.name || "-"}</TableCell>
                        <TableCell className="font-mono">{sc.supplier_code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Botão de fechar */}
        <div className="flex justify-end pt-4 border-t mt-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
