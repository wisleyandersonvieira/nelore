import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

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
  account_group_id?: string;
}

interface DREData {
  month: number;
  year: number;
  store_id: string;
  store_name: string;
  values: Record<string, number>;
}

export const DREView: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [structures, setStructures] = useState<DREStructure[]>([]);
  const [structureItems, setStructureItems] = useState<StructureItem[]>([]);
  const [dreData, setDreData] = useState<DREData[]>([]);
  
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedStructure, setSelectedStructure] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
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
    }
  }, [selectedStructure]);

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
        .select('*, account_group_id')
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
        sum_items: item.sum_items || [],
        account_group_id: item.account_group_id
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

  const handleStoreSelection = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores(prev => [...prev, storeId]);
    } else {
      setSelectedStores(prev => prev.filter(id => id !== storeId));
    }
  };

  const handleMonthSelection = (monthId: string, checked: boolean) => {
    if (checked) {
      setSelectedMonths(prev => [...prev, monthId]);
    } else {
      setSelectedMonths(prev => prev.filter(id => id !== monthId));
    }
  };

  const loadDREData = async () => {
    if (!selectedStructure || selectedStores.length === 0 || selectedMonths.length === 0) {
      toast({
        title: "Seleção incompleta",
        description: "Selecione estrutura, lojas e meses para visualizar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar contas a pagar com produtos
      const { data: accountsPayableData, error: apError } = await supabase
        .from('accounts_payable')
        .select(`
          id,
          store_id,
          data_competencia,
          accounts_payable_items (
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              subgroup_id
            )
          ),
          stores (name)
        `)
        .in('store_id', selectedStores)
        .gte('data_competencia', `${selectedYear}-01-01`)
        .lte('data_competencia', `${selectedYear}-12-31`);

      if (apError) throw apError;

      // Agrupar dados por mês, loja e subgrupo
      const groupedData: Record<string, DREData> = {};

      accountsPayableData?.forEach((account: any) => {
        const competenciaDate = new Date(account.data_competencia);
        const month = competenciaDate.getMonth() + 1;
        const year = competenciaDate.getFullYear();

        // Verificar se o mês está selecionado
        if (!selectedMonths.includes(month.toString()) || year !== parseInt(selectedYear)) {
          return;
        }

        const storeId = account.store_id;
        const storeName = account.stores?.name || 'Loja sem nome';
        const key = `${storeId}-${month}`;

        // Inicializar se não existir
        if (!groupedData[key]) {
          groupedData[key] = {
            month,
            year: parseInt(selectedYear),
            store_id: storeId,
            store_name: storeName,
            values: {}
          };
        }

        account.accounts_payable_items?.forEach((item: any) => {
          if (item.products?.subgroup_id) {
            const subgroupId = item.products.subgroup_id;
            const value = parseFloat(item.total_price) || 0;

            // Encontrar o item da estrutura que corresponde a este subgrupo
            const structureItem = structureItems.find(si => 
              si.item_type === 'subgroup' && 
              si.account_group_id === subgroupId
            );

            if (structureItem) {
              if (!groupedData[key].values[structureItem.id]) {
                groupedData[key].values[structureItem.id] = 0;
              }
              groupedData[key].values[structureItem.id] += value;
            }
          }
        });
      });

      // Converter para array
      const formattedData: DREData[] = Object.values(groupedData);
      setDreData(formattedData);

      if (formattedData.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não foram encontradas contas a pagar para os filtros selecionados",
          variant: "default",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados DRE",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateGroupTotal = (groupId: string, data: DREData): number => {
    const subgroups = structureItems.filter(item => 
      item.parent_id === groupId && item.item_type === 'subgroup'
    );
    
    return subgroups.reduce((total, subgroup) => {
      const value = data.values[subgroup.id] || 0;
      // Para grupos, simplesmente somamos todos os valores dos subgrupos
      // A operação de débito/crédito já será considerada na exibição
      return total + value;
    }, 0);
  };

  const calculateSumLineTotal = (sumLineId: string, data: DREData): number => {
    // Find the current sum line position
    const currentSumLineIndex = structureItems.findIndex(item => item.id === sumLineId);
    if (currentSumLineIndex === -1) return 0;
    
    // Sum all subgroups that are above this sum line
    const itemsAbove = structureItems.slice(0, currentSumLineIndex);
    
    return itemsAbove.reduce((total, item) => {
      if (item.item_type === 'subgroup') {
        const value = data.values[item.id] || 0;
        return total + (item.operation_type === 'credit' ? value : -value);
      }
      return total;
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return months[month - 1]?.label || month.toString();
  };

  // Agrupar dados por mês
  const groupedData = dreData.reduce((acc, data) => {
    const key = `${data.year}-${data.month}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(data);
    return acc;
  }, {} as Record<string, DREData[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visualizar DRE</h2>
        <p className="text-muted-foreground">Consulte e compare os demonstrativos de resultados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de Consulta</CardTitle>
          <CardDescription>Selecione os parâmetros para visualização do DRE</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Estrutura */}
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

            {/* Ano */}
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

            {/* Lojas */}
            <div className="space-y-2">
              <Label>Lojas</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={(checked) => 
                        handleStoreSelection(store.id, checked as boolean)
                      }
                    />
                    <label htmlFor={`store-${store.id}`} className="text-sm">
                      {store.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Meses */}
            <div className="space-y-2">
              <Label>Meses</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {months.map((month) => (
                  <div key={month.value} className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id={`month-${month.value}`}
                      checked={selectedMonths.includes(month.value)}
                      onCheckedChange={(checked) => 
                        handleMonthSelection(month.value, checked as boolean)
                      }
                    />
                    <label htmlFor={`month-${month.value}`} className="text-sm">
                      {month.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={loadDREData} disabled={loading}>
              <Eye className="h-4 w-4 mr-2" />
              {loading ? "Carregando..." : "Visualizar DRE"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {Object.keys(groupedData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Demonstrativo de Resultados</span>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardTitle>
            <CardDescription>
              Comparativo dos resultados por período e loja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    {Object.entries(groupedData).map(([periodKey, periodData]) => {
                      const [year, month] = periodKey.split('-');
                      return (
                        <TableHead key={periodKey} colSpan={periodData.length} className="text-center">
                          {getMonthName(parseInt(month))} {year}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                    {Object.entries(groupedData).map(([periodKey, periodData]) => 
                      periodData.map((data, index) => (
                        <TableHead key={`${periodKey}-${index}`} className="text-center">
                          {data.store_name}
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structureItems.map((item) => (
                    <TableRow key={item.id} className={item.item_type === 'group' ? 'font-bold' : ''}>
                      <TableCell className={item.item_type === 'group' ? 'font-bold' : 'font-medium'}>
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          item.item_type === 'group' ? 'default' : 
                          item.item_type === 'subgroup' ? 'secondary' : 'outline'
                        }>
                          {item.item_type === 'group' ? 'Grupo' : 
                           item.item_type === 'subgroup' ? 'Subgrupo' : 'Soma'}
                        </Badge>
                      </TableCell>
                      {Object.entries(groupedData).map(([periodKey, periodData]) => 
                        periodData.map((data, index) => (
                          <TableCell key={`${periodKey}-${index}`} className={`text-right ${item.item_type === 'group' ? 'font-bold' : ''} ${item.operation_type === 'debit' ? 'text-destructive' : ''}`}>
                            {item.item_type === 'subgroup' && formatCurrency(data.values[item.id] || 0)}
                            {item.item_type === 'group' && formatCurrency(calculateGroupTotal(item.id, data))}
                            {item.item_type === 'sum_line' && formatCurrency(calculateSumLineTotal(item.id, data))}
                          </TableCell>
                        ))
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(groupedData).length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
            <p className="text-muted-foreground">
              Verifique se existem DREs cadastrados para o período e lojas selecionadas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};