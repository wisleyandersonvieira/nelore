import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

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
}

export const ProductForm = ({ onUnitsModalOpen }: ProductFormProps) => {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [nextCode, setNextCode] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_id: "",
    group_id: "",
    subgroup_id: "",
    barcode: "",
    cost_price: "",
    unit_price: "",
    category: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

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

  useEffect(() => {
    if (formData.group_id) {
      fetchSubgroups(formData.group_id);
    } else {
      setSubgroups([]);
      setFormData(prev => ({ ...prev, subgroup_id: "" }));
    }
  }, [formData.group_id]);

  const fetchInitialData = async () => {
    try {
      // Fetch next code
      const { data: codeData } = await supabase.rpc('get_next_product_code');
      setNextCode(codeData?.toString() || "1");

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
      const { error } = await supabase.from("products").insert({
        code: nextCode,
        name: formData.name,
        description: formData.description || null,
        unit_id: formData.unit_id || null,
        group_id: formData.group_id || null,
        subgroup_id: formData.subgroup_id || null,
        barcode: formData.barcode || null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        category: formData.category || null,
        is_active: true
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto cadastrado com sucesso!",
      });

      // Reset form and get next code
      setFormData({
        name: "",
        description: "",
        unit_id: "",
        group_id: "",
        subgroup_id: "",
        barcode: "",
        cost_price: "",
        unit_price: "",
        category: ""
      });
      
      // Get new next code
      const { data: newCodeData } = await supabase.rpc('get_next_product_code');
      setNextCode(newCodeData?.toString() || "1");
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o produto.",
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Nome/Descrição */}
        <div className="space-y-2 md:col-span-2">
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
              className="ml-2 h-6 w-6 p-0"
              onClick={onUnitsModalOpen}
              title="Cadastrar nova unidade"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </Label>
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
          <Select value={formData.group_id} onValueChange={(value) => setFormData({ ...formData, group_id: value })}>
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

        {/* Preço de Venda */}
        <div className="space-y-2">
          <Label htmlFor="unit_price">Preço de Venda</Label>
          <Input
            id="unit_price"
            type="number"
            step="0.01"
            value={formData.unit_price}
            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
            placeholder="0,00"
          />
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Categoria do produto"
          />
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

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cadastrar Produto
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setFormData({
            name: "",
            description: "",
            unit_id: "",
            group_id: "",
            subgroup_id: "",
            barcode: "",
            cost_price: "",
            unit_price: "",
            category: ""
          })}
        >
          Limpar
        </Button>
      </div>
    </form>
  );
};