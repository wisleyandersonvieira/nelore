import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Unit {
  id: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
}

interface UnitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inlineMode?: boolean;
}

export const UnitsModal = ({ open, onOpenChange, inlineMode = false }: UnitsModalProps) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    symbol: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open || inlineMode) {
      fetchUnits();
    }
  }, [open, inlineMode]);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("units_of_measure")
        .select("id, name, symbol, is_active, created_at")
        .order("name");

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as unidades.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.symbol.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e símbolo são obrigatórios.",
      });
      return;
    }

    // Verificar se já existe uma unidade com esse nome ou símbolo
    const nameExists = units.some(
      unit => (unit.name.toLowerCase() === formData.name.toLowerCase() ||
               unit.symbol.toLowerCase() === formData.symbol.toLowerCase()) &&
               unit.id !== editingUnit?.id
    );

    if (nameExists) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe uma unidade com esse nome ou símbolo.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingUnit) {
        // Editar unidade existente
        const { error } = await supabase
          .from("units_of_measure")
          .update({
            name: formData.name,
            symbol: formData.symbol.toUpperCase(),
          })
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Unidade atualizada com sucesso!" });
      } else {
        // Criar nova unidade
        const { error } = await supabase
          .from("units_of_measure")
          .insert({
            name: formData.name,
            symbol: formData.symbol.toUpperCase(),
            is_active: true
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Unidade criada com sucesso!" });
      }

      setFormData({ name: "", symbol: "" });
      setEditingUnit(null);
      setShowForm(false);
      await fetchUnits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível salvar a unidade.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      symbol: unit.symbol,
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (unit: Unit) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("units_of_measure")
        .update({ is_active: !unit.is_active })
        .eq("id", unit.id);

      if (error) throw error;
      toast({ 
        title: "Sucesso", 
        description: `Unidade ${!unit.is_active ? 'ativada' : 'desativada'} com sucesso!` 
      });
      await fetchUnits();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível alterar o status da unidade.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`Tem certeza que deseja excluir a unidade ${unit.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("units_of_measure")
        .delete()
        .eq("id", unit.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Unidade excluída com sucesso!" });
      await fetchUnits();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a unidade.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", symbol: "" });
    setEditingUnit(null);
    setShowForm(false);
  };

  const content = (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Botão Novo */}
      <Button
        onClick={() => setShowForm(true)}
        className="self-start"
        disabled={loading}
      >
        <Plus className="h-4 w-4 mr-2" />
        Nova Unidade
      </Button>

      {/* Formulário */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingUnit ? "Editar Unidade" : "Nova Unidade"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Quilograma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbol">Símbolo</Label>
                <Input
                  id="symbol"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="Ex: KG"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading}>
                {editingUnit ? "Atualizar" : "Salvar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Unidades */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader>
          <CardTitle>Unidades Cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma unidade encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell className="font-mono">{unit.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={unit.is_active ? "default" : "secondary"}>
                          {unit.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(unit)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(unit)}
                            title={unit.is_active ? "Desativar" : "Ativar"}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(unit)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (inlineMode) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Unidades de Medida</DialogTitle>
          <DialogDescription>
            Gerencie as unidades de medida disponíveis para os produtos
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};