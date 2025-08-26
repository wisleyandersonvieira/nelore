import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Store {
  id: string;
  name: string;
}

interface DREStructure {
  id: string;
  name: string;
}

interface StructureItem {
  id: string;
  item_type: 'group' | 'subgroup' | 'sum_line';
  name: string;
  operation_type: 'credit' | 'debit';
  position_order: number;
  parent_id?: string;
  sum_items?: string[];
}

interface EntryValue {
  structure_item_id: string;
  value: number;
  comment: string;
}

export const DRERegister: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [structures, setStructures] = useState<DREStructure[]>([]);
  const [structureItems, setStructureItems] = useState<StructureItem[]>([]);
  const [entryValues, setEntryValues] = useState<Record<string, EntryValue>>({});
  
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedStructure, setSelectedStructure] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  useEffect(() => {
    fetchStores();
    fetchStructures();
  }, []);

  useEffect(() => {
    if (selectedStructure) {
      fetchStructureItems();
      loadExistingEntry();
    }
  }, [selectedStructure, selectedStore, selectedMonth, selectedYear]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('dre_structures')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStructures(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estruturas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStructureItems = async () => {
    if (!selectedStructure) return;

    try {
      const { data, error } = await supabase
        .from('dre_structure_items')
        .select('*')
        .eq('structure_id', selectedStructure)
        .order('position_order');

      if (error) throw error;
      
      const formattedItems = (data || []).map((item: any) => ({
        id: item.id,
        item_type: item.item_type as 'group' | 'subgroup' | 'sum_line',
        name: item.name,
        operation_type: item.operation_type as 'credit' | 'debit',
        position_order: item.position_order,
        parent_id: item.parent_id,
        sum_items: item.sum_items || []
      }));
      
      setStructureItems(formattedItems);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar itens da estrutura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadExistingEntry = async () => {
    if (!selectedStructure || !selectedStore || !selectedMonth || !selectedYear) return;

    try {
      const { data, error } = await supabase
        .from('dre_entries')
        .select(`
          *,
          dre_entry_values (
            structure_item_id,
            value,
            comment
          )
        `)
        .eq('structure_id', selectedStructure)
        .eq('store_id', selectedStore)
        .eq('month', parseInt(selectedMonth))
        .eq('year', parseInt(selectedYear))
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const values: Record<string, EntryValue> = {};
        data.dre_entry_values?.forEach((value: any) => {
          values[value.structure_item_id] = {
            structure_item_id: value.structure_item_id,
            value: parseFloat(value.value) || 0,
            comment: value.comment || ""
          };
        });
        setEntryValues(values);
      } else {
        setEntryValues({});
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados existentes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateEntryValue = (itemId: string, field: 'value' | 'comment', newValue: string) => {
    setEntryValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        structure_item_id: itemId,
        [field]: field === 'value' ? parseFloat(newValue) || 0 : newValue,
        comment: prev[itemId]?.comment || ""
      }
    }));
  };

  const calculateGroupTotal = (groupId: string): number => {
    const subgroups = structureItems.filter(item => 
      item.parent_id === groupId && item.item_type === 'subgroup'
    );
    
    return subgroups.reduce((total, subgroup) => {
      const value = entryValues[subgroup.id]?.value || 0;
      return total + (subgroup.operation_type === 'credit' ? value : -value);
    }, 0);
  };

  const calculateSumLineTotal = (sumItems: string[]): number => {
    return sumItems.reduce((total, itemId) => {
      const item = structureItems.find(i => i.id === itemId);
      if (!item) return total;

      if (item.item_type === 'group') {
        return total + calculateGroupTotal(itemId);
      } else if (item.item_type === 'subgroup') {
        const value = entryValues[itemId]?.value || 0;
        return total + (item.operation_type === 'credit' ? value : -value);
      }
      return total;
    }, 0);
  };

  const handleSave = async () => {
    if (!selectedStore || !selectedStructure || !selectedMonth || !selectedYear) {
      toast({
        title: "Dados incompletos",
        description: "Selecione loja, estrutura, mês e ano",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      // Verificar se já existe uma entrada
      const { data: existingEntry } = await supabase
        .from('dre_entries')
        .select('id')
        .eq('structure_id', selectedStructure)
        .eq('store_id', selectedStore)
        .eq('month', parseInt(selectedMonth))
        .eq('year', parseInt(selectedYear))
        .single();

      let entryId = existingEntry?.id;

      if (entryId) {
        // Deletar valores existentes
        await supabase
          .from('dre_entry_values')
          .delete()
          .eq('entry_id', entryId);
      } else {
        // Criar nova entrada
        const { data: newEntry, error: entryError } = await supabase
          .from('dre_entries')
          .insert({
            structure_id: selectedStructure,
            store_id: selectedStore,
            month: parseInt(selectedMonth),
            year: parseInt(selectedYear),
            created_by: user.user.id
          })
          .select()
          .single();

        if (entryError) throw entryError;
        entryId = newEntry.id;
      }

      // Inserir novos valores
      const valuesToInsert = Object.values(entryValues).filter(v => v.value !== 0 || v.comment.trim() !== '');
      
      if (valuesToInsert.length > 0) {
        const { error: valuesError } = await supabase
          .from('dre_entry_values')
          .insert(
            valuesToInsert.map(value => ({
              entry_id: entryId,
              structure_item_id: value.structure_item_id,
              value: value.value,
              comment: value.comment
            }))
          );

        if (valuesError) throw valuesError;
      }

      toast({
        title: "DRE salvo com sucesso",
        description: `Demonstrativo salvo para ${months[parseInt(selectedMonth) - 1]?.label} de ${selectedYear}`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao salvar DRE",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const canShowStructureItems = selectedStore && selectedStructure && selectedMonth && selectedYear;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Cadastrar DRE</h2>
        <p className="text-muted-foreground">Registre os valores do demonstrativo de resultados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleção de Parâmetros</CardTitle>
          <CardDescription>Escolha a loja, estrutura e período para o cadastro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estrutura DRE</Label>
              <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a estrutura" />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {canShowStructureItems && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Valores DRE</span>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar DRE"}
              </Button>
            </CardTitle>
            <CardDescription>
              Insira os valores para cada item da estrutura DRE
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead className="w-32">Valor</TableHead>
                  <TableHead className="w-48">Comentário</TableHead>
                  <TableHead>Total Calculado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structureItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={
                        item.item_type === 'group' ? 'default' : 
                        item.item_type === 'subgroup' ? 'secondary' : 'outline'
                      }>
                        {item.item_type === 'group' ? 'Grupo' : 
                         item.item_type === 'subgroup' ? 'Subgrupo' : 'Soma'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.operation_type === 'credit' ? 'default' : 'destructive'}>
                        {item.operation_type === 'credit' ? 'Crédito' : 'Débito'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.item_type === 'subgroup' && (
                        <Input
                          type="number"
                          step="0.01"
                          value={entryValues[item.id]?.value || ''}
                          onChange={(e) => updateEntryValue(item.id, 'value', e.target.value)}
                          placeholder="0,00"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.item_type === 'subgroup' && (
                        <Textarea
                          value={entryValues[item.id]?.comment || ''}
                          onChange={(e) => updateEntryValue(item.id, 'comment', e.target.value)}
                          placeholder="Comentário opcional"
                          className="min-h-8 text-sm"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.item_type === 'group' && (
                        <span className="font-medium">
                          {formatCurrency(calculateGroupTotal(item.id))}
                        </span>
                      )}
                      {item.item_type === 'sum_line' && item.sum_items && (
                        <span className="font-medium">
                          {formatCurrency(calculateSumLineTotal(item.sum_items))}
                        </span>
                      )}
                      {item.item_type === 'subgroup' && (
                        <span className="text-muted-foreground">
                          {formatCurrency(entryValues[item.id]?.value || 0)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};