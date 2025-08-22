import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Supplier {
  id: string;
  name: string;
}

interface SupplierCode {
  id?: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name?: string;
}

interface ProductSupplierCodesProps {
  productId?: string;
  onCodesChange?: (codes: SupplierCode[]) => void;
}

export const ProductSupplierCodes = ({ productId, onCodesChange }: ProductSupplierCodesProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<SupplierCode[]>([]);
  const [newCode, setNewCode] = useState({ supplier_id: "", supplier_code: "" });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log("ProductSupplierCodes - productId changed:", productId);
    fetchSuppliers();
    if (productId) {
      fetchProductSupplierCodes();
    } else {
      setSupplierCodes([]);
    }
  }, [productId]);

  useEffect(() => {
    if (onCodesChange) {
      onCodesChange(supplierCodes);
    }
  }, [supplierCodes, onCodesChange]);

  const fetchSuppliers = async () => {
    try {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchProductSupplierCodes = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      // Primeiro buscar os códigos
      const { data: codesData } = await supabase
        .from("product_supplier_codes")
        .select("id, supplier_id, supplier_code")
        .eq("product_id", productId);

      if (!codesData || codesData.length === 0) {
        setSupplierCodes([]);
        return;
      }

      // Buscar os nomes dos fornecedores
      const supplierIds = codesData.map(code => code.supplier_id);
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds);

      // Combinar os dados
      const codes = codesData.map(code => {
        const supplier = suppliersData?.find(s => s.id === code.supplier_id);
        return {
          id: code.id,
          supplier_id: code.supplier_id,
          supplier_code: code.supplier_code,
          supplier_name: supplier?.name || "Fornecedor não encontrado"
        };
      });

      setSupplierCodes(codes);
      console.log("Códigos carregados:", codes);
    } catch (error) {
      console.error("Error fetching product supplier codes:", error);
    } finally {
      setLoading(false);
    }
  };

  const addSupplierCode = async () => {
    if (!newCode.supplier_id || !newCode.supplier_code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um fornecedor e digite o código do produto.",
      });
      return;
    }

    // Check if this combination already exists
    const exists = supplierCodes.some(
      code => code.supplier_id === newCode.supplier_id && code.supplier_code === newCode.supplier_code
    );

    if (exists) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Este código já está cadastrado para este fornecedor.",
      });
      return;
    }

    const supplier = suppliers.find(s => s.id === newCode.supplier_id);
    const codeToAdd: SupplierCode = {
      supplier_id: newCode.supplier_id,
      supplier_code: newCode.supplier_code,
      supplier_name: supplier?.name
    };

    // If productId exists, save to database immediately
    if (productId) {
      setSaveLoading(true);
      try {
        const { data, error } = await supabase
          .from("product_supplier_codes")
          .insert({
            product_id: productId,
            supplier_id: newCode.supplier_id,
            supplier_code: newCode.supplier_code
          })
          .select("id")
          .single();

        if (error) throw error;

        codeToAdd.id = data.id;
        setSupplierCodes([...supplierCodes, codeToAdd]);
        setNewCode({ supplier_id: "", supplier_code: "" });

        toast({
          title: "Sucesso",
          description: "Código do fornecedor adicionado com sucesso!",
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.message || "Não foi possível adicionar o código do fornecedor.",
        });
      } finally {
        setSaveLoading(false);
      }
    } else {
      // Just add to local state for new products
      setSupplierCodes([...supplierCodes, codeToAdd]);
      setNewCode({ supplier_id: "", supplier_code: "" });
    }
  };

  const removeSupplierCode = async (index: number) => {
    const codeToRemove = supplierCodes[index];

    // If productId exists and code has id, remove from database
    if (productId && codeToRemove.id) {
      setSaveLoading(true);
      try {
        const { error } = await supabase
          .from("product_supplier_codes")
          .delete()
          .eq("id", codeToRemove.id);

        if (error) throw error;

        const updatedCodes = supplierCodes.filter((_, i) => i !== index);
        setSupplierCodes(updatedCodes);

        toast({
          title: "Sucesso",
          description: "Código do fornecedor removido com sucesso!",
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.message || "Não foi possível remover o código do fornecedor.",
        });
      } finally {
        setSaveLoading(false);
      }
    } else {
      // Just remove from local state
      const updatedCodes = supplierCodes.filter((_, i) => i !== index);
      setSupplierCodes(updatedCodes);
    }
  };

  const saveAllCodes = async (newProductId: string) => {
    if (supplierCodes.length === 0) return;

    try {
      const codesToInsert = supplierCodes.map(code => ({
        product_id: newProductId,
        supplier_id: code.supplier_id,
        supplier_code: code.supplier_code
      }));

      const { error } = await supabase
        .from("product_supplier_codes")
        .insert(codesToInsert);

      if (error) throw error;

      // Refresh the codes with the new ids
      await fetchProductSupplierCodes();
    } catch (error) {
      console.error("Error saving supplier codes:", error);
      throw error;
    }
  };

  // Expose saveAllCodes method
  (ProductSupplierCodes as any).saveAllCodes = saveAllCodes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Códigos dos Fornecedores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new supplier code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select 
              value={newCode.supplier_id} 
              onValueChange={(value) => setNewCode({ ...newCode, supplier_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Código do Produto</Label>
            <Input
              value={newCode.supplier_code}
              onChange={(e) => setNewCode({ ...newCode, supplier_code: e.target.value })}
              placeholder="Código do fornecedor"
            />
          </div>

          <div className="flex items-end">
            <Button 
              type="button"
              onClick={addSupplierCode}
              disabled={saveLoading}
              className="w-full"
            >
              {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* List existing supplier codes */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : supplierCodes.length > 0 ? (
          <div className="space-y-2">
            <Label>Códigos Cadastrados:</Label>
            {supplierCodes.map((code, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div>
                  <span className="font-medium">{code.supplier_name}</span>
                  <span className="ml-3 text-muted-foreground">Código: {code.supplier_code}</span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeSupplierCode(index)}
                  disabled={saveLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhum código de fornecedor cadastrado.</p>
        )}
      </CardContent>
    </Card>
  );
};