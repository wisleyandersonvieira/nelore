import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Grupo {
  id: string;
  name: string;
  account_type: string;
  created_at: string;
}

interface GrupoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GrupoModal = ({ open, onOpenChange }: GrupoModalProps) => {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    account_type: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchGrupos();
    }
  }, [open]);

  const fetchGrupos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_groups")
        .select("id, name, account_type, created_at")
        .is("parent_id", null) // Apenas grupos principais (não subgrupos)
        .order("name");

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os grupos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.account_type) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e classe são obrigatórios.",
      });
      return;
    }

    // Verificar se já existe um grupo com esse nome
    const nameExists = grupos.some(
      grupo => grupo.name.toLowerCase() === formData.name.toLowerCase() &&
      grupo.id !== editingGrupo?.id
    );

    if (nameExists) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe um grupo com esse nome.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingGrupo) {
        // Editar grupo existente
        const { error } = await supabase
          .from("account_groups")
          .update({
            name: formData.name,
            account_type: formData.account_type as "receita" | "despesa" | "ativo" | "passivo",
          })
          .eq("id", editingGrupo.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Grupo atualizado com sucesso!" });
      } else {
        // Criar novo grupo
        const { error } = await supabase
          .from("account_groups")
          .insert({
            name: formData.name,
            account_type: formData.account_type as "receita" | "despesa" | "ativo" | "passivo",
            code: `${Date.now()}`, // Código temporário único
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Grupo criado com sucesso!" });
      }

      setFormData({ name: "", account_type: "" });
      setEditingGrupo(null);
      setShowForm(false);
      await fetchGrupos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível salvar o grupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (grupo: Grupo) => {
    setEditingGrupo(grupo);
    setFormData({
      name: grupo.name,
      account_type: grupo.account_type,
    });
    setShowForm(true);
  };

  const handleDelete = async (grupo: Grupo) => {
    if (!confirm(`Tem certeza que deseja excluir o grupo ${grupo.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      // Verificar se existem contas ATIVAS associadas a este grupo
      const { data: accounts, error: checkError } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("group_id", grupo.id)
        .eq("is_active", true)
        .limit(1);

      if (checkError) throw checkError;

      if (accounts && accounts.length > 0) {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: "Este grupo possui contas associadas. Remova as contas antes de excluir o grupo.",
        });
        return;
      }

      const { error } = await supabase
        .from("account_groups")
        .delete()
        .eq("id", grupo.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Grupo excluído com sucesso!" });
      await fetchGrupos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível excluir o grupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (grupo: Grupo) => {
    // Funcionalidade removida pois a tabela não tem campo is_active
    toast({
      variant: "destructive",
      title: "Funcionalidade não disponível",
      description: "A funcionalidade de bloquear/desbloquear não está implementada.",
    });
  };

  const resetForm = () => {
    setFormData({ name: "", account_type: "" });
    setEditingGrupo(null);
    setShowForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cadastro de Grupos</DialogTitle>
          <DialogDescription>
            Gerencie os grupos de contas financeiras
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Botão Novo */}
          <Button
            onClick={() => setShowForm(true)}
            className="self-start"
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Grupo
          </Button>

          {/* Formulário */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingGrupo ? "Editar Grupo" : "Novo Grupo"}
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
                      placeholder="Nome do grupo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Classe</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a classe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="investimento">Investimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={loading}>
                    {editingGrupo ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Grupos */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader>
              <CardTitle>Grupos Cadastrados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Classe</TableHead>
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
                    ) : grupos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Nenhum grupo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      grupos.map((grupo) => (
                        <TableRow key={grupo.id}>
                          <TableCell className="font-medium">{grupo.name}</TableCell>
                          <TableCell className="capitalize">{grupo.account_type}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              Ativo
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(grupo)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(grupo)}
                                title="Bloquear/Desbloquear"
                                disabled
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(grupo)}
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
      </DialogContent>
    </Dialog>
  );
};