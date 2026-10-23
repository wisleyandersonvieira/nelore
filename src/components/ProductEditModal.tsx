import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

import { ProductSupplierCodes } from "./ProductSupplierCodes";

interface Unit {
  id: string;
  name: string;
  symbol: string;
}

interface Group {
  id: string;
  name: string;
}

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
}

interface ProductEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSaveSuccess?: () => void;
}

export const ProductEditModal = ({ open, onOpenChange, product, onSaveSuccess }: ProductEditModalProps) => {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_id: "",
    group_id: "",
    subgroup_id: "",
    barcode: "",
    cost_price: "",
    product_type: "product" as "product" | "service",
    function_type: "debit" as "credit" | "debit"
  });
  const { toast } = useToast();

  // Carregar dados iniciais quando o modal abre
  useEffect(() => {
    if (open && product) {
      fetchInitialData();
    }
  }, [open, product]);

  const fetchInitialData = async () => {
    if (!product) return;
    
    try {
      // Fetch units
      const { data: unitsData } = await supabase
        .from("units_of_measure")
        .select("id, name, symbol")
        .eq("is_active", true)
        .order("name");
      setUnits(unitsData || []);

      // Fetch groups (parent_id is null)
      const { data: groupsData } = await supabase
        .from("account_groups")
        .select("id, name")
        .is("parent_id", null)
        .order("name");
      setGroups(groupsData || []);

      // Se tem grupo, buscar subgrupos
      if (product.group_id) {
        const { data: subgroupsData } = await supabase
          .from("account_groups")
          .select("id, name")
          .eq("parent_id", product.group_id)
          .order("name");
        setSubgroups(subgroupsData || []);
      }

      // Setar os dados do formulário diretamente
      setFormData({
        name: product.name || "",
        description: product.description || "",
        unit_id: product.unit_id || "",
        group_id: product.group_id || "",
        subgroup_id: product.subgroup_id || "",
        barcode: product.barcode || "",
        cost_price: product.cost_price?.toString() || "",
        product_type: (product.product_type || "product") as "product" | "service",
        function_type: (product.function_type || "debit") as "credit" | "debit"
      });
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  };

  const fetchSubgroups = async (groupId: string) => {
    try {
      const { data } = await supabase
        .from("account_groups")
        .select("id, name")
        .eq("parent_id", groupId)
        .order("name");
      setSubgroups(data || []);
    } catch (error) {
      console.error("Error fetching subgroups:", error);
    }
  };

  const handleGroupChange = (value: string) => {
    setFormData({ ...formData, group_id: value, subgroup_id: "" });
    if (value) {
      fetchSubgroups(value);
    } else {
      setSubgroups([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Descrição do produto é obrigatória.",
      });
      return;
    }

    // Validar nome duplicado
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .ilike("name", formData.name.trim())
      .neq("id", product.id)
      .maybeSingle();

    if (checkError) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao verificar nome do produto.",
      });
      return;
    }

    if (existingProduct) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe um produto cadastrado com este nome.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description || null,
          unit_id: formData.unit_id || null,
          group_id: formData.group_id || null,
          subgroup_id: formData.subgroup_id || null,
          barcode: formData.barcode || null,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price.replace(",", ".")) : null,
          product_type: formData.product_type,
          function_type: formData.function_type,
        })
        .eq("id", product.id);

      if (error) throw error;

      // Salvar códigos dos fornecedores
      if (supplierCodes.length > 0) {
        // Remover códigos existentes
        await supabase
          .from("product_supplier_codes")
          .delete()
          .eq("product_id", product.id);

        // Inserir novos códigos
        const codesToInsert = supplierCodes
          .filter(sc => sc.supplier_id && sc.supplier_code)
          .map(sc => ({
            product_id: product.id,
            supplier_id: sc.supplier_id,
            supplier_code: sc.supplier_code,
          }));

        if (codesToInsert.length > 0) {
          await supabase.from("product_supplier_codes").insert(codesToInsert);
        }
      }

      toast({
        title: "Sucesso",
        description: "Produto atualizado com sucesso!",
      });

      onOpenChange(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível atualizar o produto.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>
            Edite os dados do produto. Código: {product.code}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Código (readonly) */}
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={product.code}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                {/* Tipo: Produto ou Serviço */}
                <div className="space-y-2">
                  <Label htmlFor="product_type">Tipo *</Label>
                  <Select value={formData.product_type} onValueChange={(value: "product" | "service") => setFormData({ ...formData, product_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="service">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nome/Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="name">Descrição do Produto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do produto"
                    required
                  />
                </div>

                {/* Unidade de Medida */}
                <div className="space-y-2">
                  <Label htmlFor="unit_id">Unidade de Medida</Label>
                  <Select value={formData.unit_id} onValueChange={(value) => setFormData({ ...formData, unit_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Grupo */}
                <div className="space-y-2">
                  <Label htmlFor="group_id">Grupo</Label>
                  <Select value={formData.group_id} onValueChange={handleGroupChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subgrupo */}
                <div className="space-y-2">
                  <Label htmlFor="subgroup_id">Subgrupo</Label>
                  <Select 
                    value={formData.subgroup_id} 
                    onValueChange={(value) => setFormData({ ...formData, subgroup_id: value })}
                    disabled={!formData.group_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.group_id ? "Selecione o subgrupo" : "Selecione um grupo primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subgroups.map((subgroup) => (
                        <SelectItem key={subgroup.id} value={subgroup.id}>
                          {subgroup.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Código de Barras */}
                <div className="space-y-2">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Digite ou escaneie o código de barras"
                  />
                </div>

                {/* Preço de Custo */}
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Preço de Custo</Label>
                  <Input
                    id="cost_price"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>

                {/* Função */}
                <div className="space-y-2">
                  <Label htmlFor="function_type">Função *</Label>
                  <Select value={formData.function_type} onValueChange={(value: "credit" | "debit") => setFormData({ ...formData, function_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Descrição Adicional */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição Adicional</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Informações adicionais sobre o produto"
                  rows={3}
                />
              </div>

              {/* Códigos dos Fornecedores */}
              <div className="border rounded-lg p-4">
                <ProductSupplierCodes
                  productId={product.id}
                  onCodesChange={setSupplierCodes}
                />
              </div>
            </div>
          </div>

          {/* Botões fixos no rodapé */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
