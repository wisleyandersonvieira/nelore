import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { ProductSupplierCodes } from "./ProductSupplierCodes";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface Unit {
  id: string;
  name: string;
  symbol: string;
}

interface Group {
  id: string;
  name: string;
}

interface ProductFormProps {
  onUnitsModalOpen: () => void;
  editingProduct?: Product | null;
  onSaveSuccess?: () => void;
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
}

export const ProductForm = ({ onUnitsModalOpen, editingProduct, onSaveSuccess }: ProductFormProps) => {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [nextCode, setNextCode] = useState<string>("");
  const [supplierCodes, setSupplierCodes] = useState<any[]>([]);
  const [currentProductId, setCurrentProductId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_id: undefined as string | undefined,
    group_id: undefined as string | undefined,
    subgroup_id: undefined as string | undefined,
    barcode: "",
    cost_price: "",
    product_type: "product" as "product" | "service",
    function_type: "debit" as "credit" | "debit"
  });
  const { toast } = useToast();
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [previousGroupId, setPreviousGroupId] = useState<string | undefined>(undefined);
  
  // Hook para obter matriz do usuário logado
  const { matrixId, matrixName, matrixCode, isLoading: matrixLoading } = useUserMatrix();
  const [userBrandId, setUserBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (matrixId) {
      fetchUserBrandId();
    }
  }, [matrixId]);

  useEffect(() => {
    if (userBrandId !== null) {
      fetchInitialData();
    }
  }, [userBrandId]);

  // Carregar dados do produto para edição - só após dados iniciais carregados
  useEffect(() => {
    if (!initialDataLoaded) return;
    
    if (editingProduct) {
      loadProductData(editingProduct);
    } else {
      resetForm();
    }
  }, [editingProduct, initialDataLoaded]);

  const loadProductData = async (product: any) => {
    console.log("Carregando dados do produto:", product);
    
    // Definir o ID do produto
    setCurrentProductId(product.id);
    
    // Se tem grupo, buscar subgrupos primeiro
    if (product.group_id) {
      const { data } = await supabase
        .from("account_groups")
        .select("id, name")
        .eq("parent_id", product.group_id)
        .order("name");
      setSubgroups(data || []);
    } else {
      setSubgroups([]);
    }
    
    // Definir os dados do formulário diretamente (como SuppliersModal faz)
    setFormData({
      name: product.name || "",
      description: product.description || "",
      unit_id: product.unit_id || undefined,
      group_id: product.group_id || undefined,
      subgroup_id: product.subgroup_id || undefined,
      barcode: product.barcode || "",
      cost_price: product.cost_price?.toString() || "",
      product_type: (product.product_type || "product") as "product" | "service",
      function_type: (product.function_type || "debit") as "credit" | "debit"
    });
    
    // Guardar o group_id atual para comparação no useEffect
    setPreviousGroupId(product.group_id || undefined);
    setNextCode(product.code);
    console.log("Dados carregados para produto:", product.id);
  };

  const resetForm = async () => {
    setCurrentProductId(undefined);
    setFormData({
      name: "",
      description: "",
      unit_id: undefined,
      group_id: undefined,
      subgroup_id: undefined,
      barcode: "",
      cost_price: "",
      product_type: "product",
      function_type: "debit"
    });
    setSubgroups([]);
    setSupplierCodes([]);
    setPreviousGroupId(undefined);
    
    try {
      const { data: codeData } = await supabase.rpc('get_next_product_code');
      setNextCode(codeData?.toString() || "1");
    } catch (error) {
      console.error("Error fetching next code:", error);
    }
  };

  // Add a function to refresh units when modal closes
  const refreshUnits = async () => {
    try {
      const { data: unitsData } = await supabase
        .from("units_of_measure")
        .select("id, name, symbol")
        .eq("is_active", true)
        .order("name");
      setUnits(unitsData || []);
    } catch (error) {
      console.error("Error refreshing units:", error);
    }
  };

  // Só buscar subgrupos quando o usuário MUDA o grupo manualmente (não durante load)
  useEffect(() => {
    // Se o group_id atual é igual ao previous, não fazer nada (evita reset durante load)
    if (formData.group_id === previousGroupId) return;
    
    // Atualizar o previousGroupId
    setPreviousGroupId(formData.group_id);
    
    if (formData.group_id) {
      fetchSubgroups(formData.group_id);
      // Resetar subgroup_id quando grupo muda manualmente
      setFormData(prev => ({ ...prev, subgroup_id: undefined }));
    } else {
      setSubgroups([]);
      setFormData(prev => ({ ...prev, subgroup_id: undefined }));
    }
  }, [formData.group_id]);

  const fetchUserBrandId = async () => {
    try {
      // Buscar o brand_id da matriz do usuário
      const { data: matrixData, error } = await supabase
        .from("matrices")
        .select("brand_id")
        .eq("id", matrixId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching matrix brand:", error);
      }
      setUserBrandId(matrixData?.brand_id || null);
    } catch (error) {
      console.error("Error fetching user brand:", error);
      setUserBrandId(null);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Fetch units
      const { data: unitsData } = await supabase
        .from("units_of_measure")
        .select("id, name, symbol")
        .eq("is_active", true)
        .order("name");
      setUnits(unitsData || []);

      // Fetch groups filtered by user's brand
      let groupsQuery = supabase
        .from("account_groups")
        .select("id, name")
        .is("parent_id", null)
        .order("name");
      
      if (userBrandId) {
        groupsQuery = groupsQuery.eq("brand_id", userBrandId);
      }
      
      const { data: groupsData } = await groupsQuery;
      setGroups(groupsData || []);
      
      // Marcar que dados iniciais foram carregados
      setInitialDataLoaded(true);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setInitialDataLoaded(true); // Marcar mesmo com erro para não bloquear
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome do produto é obrigatório.",
      });
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe produto com o mesmo nome
      const { data: existingProduct } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", formData.name.trim())
        .maybeSingle();
      
      // Se encontrou produto com mesmo nome e não é o produto sendo editado
      if (existingProduct && existingProduct.id !== editingProduct?.id) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Já existe um produto cadastrado com este nome.",
        });
        setLoading(false);
        return;
      }

      const productData: any = {
        code: nextCode,
        name: formData.name.trim(),
        description: formData.description || null,
        unit_id: formData.unit_id || null,
        group_id: formData.group_id || null,
        subgroup_id: formData.subgroup_id || null,
        barcode: formData.barcode || null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        product_type: formData.product_type,
        function_type: formData.function_type,
        is_active: true
      };
      
      // Adicionar matrix_id apenas para novos produtos
      if (!editingProduct && matrixId) {
        productData.matrix_id = matrixId;
      }

      let error;
      
      if (editingProduct) {
        // Atualizar produto existente
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        error = updateError;
      } else {
        // Criar novo produto
        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        
        error = insertError;
        
        // Se o produto foi criado com sucesso e há códigos de fornecedores, salvá-los
        if (!error && newProduct && supplierCodes.length > 0) {
          const codesToInsert = supplierCodes.map(code => ({
            product_id: newProduct.id,
            supplier_id: code.supplier_id,
            supplier_code: code.supplier_code
          }));

          const { error: codesError } = await supabase
            .from("product_supplier_codes")
            .insert(codesToInsert);

          if (codesError) {
            console.error("Error saving supplier codes:", codesError);
            // Não vamos falhar o produto por causa dos códigos, apenas alertar
            toast({
              variant: "destructive",
              title: "Aviso",
              description: "Produto criado, mas houve erro ao salvar códigos dos fornecedores.",
            });
          }
        }
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: editingProduct ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!",
      });

      // Reset form se não estiver editando
      if (!editingProduct) {
        setFormData({
          name: "",
          description: "",
          unit_id: undefined,
          group_id: undefined,
          subgroup_id: undefined,
          barcode: "",
          cost_price: "",
          product_type: "product",
          function_type: "debit"
        });
        
        // Get new next code
        const { data: newCodeData } = await supabase.rpc('get_next_product_code');
        setNextCode(newCodeData?.toString() || "1");
      }
      
      // Chamar callback de sucesso se fornecido
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || `Não foi possível ${editingProduct ? 'atualizar' : 'cadastrar'} o produto.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle barcode scanner input (typically ends with Enter)
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus next field or submit
      const form = e.currentTarget.form;
      const formElements = Array.from(form?.elements || []) as HTMLElement[];
      const currentIndex = formElements.indexOf(e.currentTarget);
      const nextElement = formElements[currentIndex + 1] as HTMLInputElement;
      
      if (nextElement && nextElement.focus) {
        nextElement.focus();
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Matriz (readonly) */}
        <div className="space-y-2">
          <Label htmlFor="matrix">Matriz</Label>
          <Input
            id="matrix"
            value={matrixLoading ? "Carregando..." : (matrixCode ? `${matrixCode} - ${matrixName}` : "Não definida")}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        {/* Código (readonly) */}
        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            value={nextCode}
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
          <Label htmlFor="unit_id">
            Unidade de Medida
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2 h-10 md:h-6 w-10 md:w-6 p-0"
              onClick={onUnitsModalOpen}
              title="Cadastrar nova unidade"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </Label>
          <Select value={formData.unit_id || ""} onValueChange={(value) => setFormData({ ...formData, unit_id: value })}>
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
          <Select value={formData.group_id || ""} onValueChange={(value) => setFormData({ ...formData, group_id: value })}>
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
            value={formData.subgroup_id || ""} 
            onValueChange={(value) => setFormData({ ...formData, subgroup_id: value })}
            disabled={!formData.group_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={!formData.group_id ? "Selecione um grupo primeiro" : "Selecione o subgrupo"} />
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
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="barcode">Código de Barras</Label>
          <Input
            id="barcode"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            onKeyDown={handleBarcodeInput}
            placeholder="Digite ou escaneie o código de barras"
          />
        </div>

        {/* Preço de Custo */}
        <div className="space-y-2">
          <Label htmlFor="cost_price">Preço de Custo</Label>
          <Input
            id="cost_price"
            type="number"
            step="0.01"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
            placeholder="0,00"
          />
        </div>

        {/* Função: Crédito ou Débito */}
        <div className="space-y-2">
          <Label htmlFor="function_type">Função *</Label>
          <Select value={formData.function_type} onValueChange={(value: "credit" | "debit") => setFormData({ ...formData, function_type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="debit">Débito</SelectItem>
            </SelectContent>
          </Select>
        </div>


        {/* Descrição adicional */}
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="description">Descrição Adicional</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Informações adicionais sobre o produto"
            rows={3}
          />
        </div>
      </div>

      {/* Códigos dos Fornecedores */}
      <ProductSupplierCodes 
        productId={currentProductId}
        onCodesChange={setSupplierCodes}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editingProduct ? 'Atualizar' : 'Cadastrar'} Produto
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setFormData({
            name: "",
            description: "",
            unit_id: undefined,
            group_id: undefined,
            subgroup_id: undefined,
            barcode: "",
            cost_price: "",
            product_type: "product",
            function_type: "debit"
          })}
        >
          Limpar
        </Button>
      </div>
      </form>
    </div>
  );
};