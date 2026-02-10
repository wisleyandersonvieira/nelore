import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Calendar, Shield, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";

interface PeriodControlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PeriodBlock {
  id: string;
  store_id: string;
  matrix_id: string;
  matrix_name?: string;
  year: number;
  month: number;
  block_type: 'competencia' | 'pagamento';
  blocked_modules: string[];
  created_at: string;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

const MODULES = [
  { id: 'contas_pagar', label: 'Contas a Pagar' },
  { id: 'contas_receber', label: 'Contas a Receber' },
  { id: 'transferencias', label: 'Transferências' },
  { id: 'aportes_retiradas', label: 'Aportes e Retiradas' },
  { id: 'caixa', label: 'Controle de Caixa' },
  { id: 'estoque', label: 'Estoque' }
];

const BLOCK_TYPES = [
  { value: 'competencia', label: 'Bloquear Competência' },
  { value: 'pagamento', label: 'Bloquear Pagamento' }
];

export const PeriodControlModal = ({ open, onOpenChange }: PeriodControlModalProps) => {
  const [periodBlocks, setPeriodBlocks] = useState<PeriodBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // User matrix data
  const { matrixId, matrixName, isLoading: matrixLoading } = useUserMatrix();
  
  // Financeiro permissions
  const { canEdit } = useFinanceiroPermissions();
  
  // Filter state
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterMonths, setFilterMonths] = useState<number[]>([]);
  
  // Form state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedBlockType, setSelectedBlockType] = useState<'competencia' | 'pagamento' | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadPeriodBlocks();
    }
  }, [open]);

  const loadPeriodBlocks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("period_blocks")
        .select(`
          *,
          matrices:matrix_id (name)
        `)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      
      // Map data to include matrix_name
      const mappedData = (data || []).map(block => ({
        ...block,
        matrix_name: block.matrices?.name || 'N/A'
      }));
      
      setPeriodBlocks(mappedData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar períodos bloqueados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlock = async () => {
    if (!selectedMonth || !selectedBlockType || selectedModules.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione o mês, tipo de bloqueio e pelo menos um módulo.",
        variant: "destructive",
      });
      return;
    }

    if (!matrixId) {
      toast({
        title: "Erro",
        description: "Usuário não está associado a uma matriz.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("period_blocks")
        .insert({
          matrix_id: matrixId,
          year: selectedYear,
          month: selectedMonth,
          block_type: selectedBlockType,
          blocked_modules: selectedModules,
          created_by: user?.id
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error("Já existe um bloqueio deste tipo para este período");
        }
        throw error;
      }

      toast({
        title: "Período bloqueado com sucesso",
        description: `${MONTHS.find(m => m.value === selectedMonth)?.label}/${selectedYear} - ${selectedBlockType === 'competencia' ? 'Competência' : 'Pagamento'}`,
      });

      // Reset form
      setSelectedMonth(null);
      setSelectedBlockType(null);
      setSelectedModules([]);
      setShowForm(false);
      
      await loadPeriodBlocks();
    } catch (error: any) {
      toast({
        title: "Erro ao bloquear período",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("period_blocks")
        .delete()
        .eq("id", blockId);

      if (error) throw error;

      toast({
        title: "Período liberado",
        description: "O bloqueio foi removido com sucesso.",
      });

      await loadPeriodBlocks();
    } catch (error: any) {
      toast({
        title: "Erro ao liberar período",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (moduleId: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || '';
  };

  const getBlockTypeLabel = (type: string) => {
    return type === 'competencia' ? 'Competência' : 'Pagamento';
  };

  const getModuleLabels = (modules: string[]) => {
    return modules.map(moduleId => 
      MODULES.find(m => m.id === moduleId)?.label || moduleId
    );
  };

  const handleFilterMonthToggle = (month: number) => {
    setFilterMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const getSelectedMonthsLabel = () => {
    if (filterMonths.length === 0) return "Todos os meses";
    if (filterMonths.length === 12) return "Todos os meses";
    return filterMonths.map(m => MONTHS.find(month => month.value === m)?.label).join(", ");
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  };

  const filteredPeriodBlocks = periodBlocks.filter(block => {
    const yearMatch = block.year === filterYear;
    const monthMatch = filterMonths.length === 0 || filterMonths.includes(block.month);
    return yearMatch && monthMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Controle de Períodos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Botão para criar novo bloqueio - apenas para usuários com permissão de escrita */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Gerencie os períodos bloqueados para evitar novos cadastros nos módulos selecionados.
            </p>
            {canEdit && (
              <Button 
                onClick={() => setShowForm(!showForm)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Bloqueio
              </Button>
            )}
          </div>

          {/* Formulário de criação */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Criar Novo Bloqueio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campo Matriz - readonly, preenchido automaticamente */}
                <div>
                  <Label htmlFor="matrix">Matriz</Label>
                  <Input
                    id="matrix"
                    value={matrixLoading ? "Carregando..." : matrixName || "Não definida"}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      min="2020"
                      max="2030"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="month">Mês</Label>
                    <Select value={selectedMonth?.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="blockType">Tipo de Bloqueio</Label>
                    <Select value={selectedBlockType || ""} onValueChange={(value: 'competencia' | 'pagamento') => setSelectedBlockType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOCK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Módulos a Bloquear</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {MODULES.map((module) => (
                      <div key={module.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={module.id}
                          checked={selectedModules.includes(module.id)}
                          onCheckedChange={() => handleModuleToggle(module.id)}
                        />
                        <Label htmlFor={module.id} className="text-sm">
                          {module.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateBlock} disabled={loading || matrixLoading || !matrixId}>
                    Criar Bloqueio
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de períodos bloqueados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Períodos Bloqueados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="flex items-center gap-3 pb-4 border-b">
                {/* Year Selector */}
                <Select value={filterYear.toString()} onValueChange={(val) => setFilterYear(parseInt(val))}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYearOptions().map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Month Multi-Select Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-52 justify-between">
                      <span className="truncate text-sm">
                        {getSelectedMonthsLabel()}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-3 bg-background border" align="start">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Meses</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={() => setFilterMonths([])}
                        >
                          Limpar
                        </Button>
                      </div>
                      {MONTHS.map((month) => (
                        <div key={month.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-month-${month.value}`}
                            checked={filterMonths.includes(month.value)}
                            onCheckedChange={() => handleFilterMonthToggle(month.value)}
                          />
                          <Label htmlFor={`filter-month-${month.value}`} className="text-sm cursor-pointer">
                            {month.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Lista */}
              {loading ? (
                <div className="text-center py-4">Carregando...</div>
              ) : filteredPeriodBlocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum período bloqueado encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPeriodBlocks.map((block) => (
                    <div key={block.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="bg-primary/10">
                          {block.matrix_name}
                        </Badge>
                        <Badge variant="outline">
                          {getMonthName(block.month)}/{block.year}
                        </Badge>
                        <Badge variant={block.block_type === 'competencia' ? 'default' : 'secondary'}>
                          {getBlockTypeLabel(block.block_type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Criado em: {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBlock(block.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Liberar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};