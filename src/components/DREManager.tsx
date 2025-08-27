import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Store {
  id: string;
  name: string;
}

interface DREEntry {
  id: string;
  month: number;
  year: number;
  store_id: string;
  structure_id: string;
  created_at: string;
  stores: { name: string };
  dre_structures: { name: string };
}

export const DREManager: React.FC = () => {
  const [entries, setEntries] = useState<DREEntry[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const months = [
    { value: "all", label: "Todos os meses" },
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
    fetchEntries();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedStore, selectedMonth, selectedYear]);

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

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dre_entries')
        .select(`
          id,
          month,
          year,
          store_id,
          structure_id,
          created_at,
          stores (name),
          dre_structures (name)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedStore && selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }

      if (selectedMonth && selectedMonth !== 'all') {
        query = query.eq('month', parseInt(selectedMonth));
      }

      if (selectedYear && selectedYear !== 'all') {
        query = query.eq('year', parseInt(selectedYear));
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar DREs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entryId: string) => {
    // TODO: Navigate to edit mode or open edit modal
    toast({
      title: "Função em desenvolvimento",
      description: "A edição de DREs será implementada em breve",
    });
  };

  const handleDelete = async (entryId: string) => {
    try {
      // First delete the entry values
      const { error: valuesError } = await supabase
        .from('dre_entry_values')
        .delete()
        .eq('entry_id', entryId);

      if (valuesError) throw valuesError;

      // Then delete the entry
      const { error: entryError } = await supabase
        .from('dre_entries')
        .delete()
        .eq('id', entryId);

      if (entryError) throw entryError;

      toast({
        title: "DRE excluído",
        description: "O DRE foi excluído com sucesso",
      });

      fetchEntries();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir DRE",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getMonthName = (month: number) => {
    return months.find(m => m.value === month.toString())?.label || month.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Gerenciar DREs</h2>
        <p className="text-muted-foreground">Visualize e gerencie os DREs cadastrados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os DREs por loja, mês e ano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
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
                  <SelectValue placeholder="Todos os anos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
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

            <div className="flex items-end">
              <Button onClick={fetchEntries} disabled={loading}>
                <Filter className="h-4 w-4 mr-2" />
                {loading ? "Filtrando..." : "Filtrar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DREs Cadastrados</CardTitle>
          <CardDescription>
            {entries.length} DRE(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Estrutura</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {getMonthName(entry.month)}/{entry.year}
                    </TableCell>
                    <TableCell>{entry.stores?.name}</TableCell>
                    <TableCell>{entry.dre_structures?.name}</TableCell>
                    <TableCell>{formatDate(entry.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este DRE? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(entry.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {entries.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum DRE encontrado com os filtros selecionados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};