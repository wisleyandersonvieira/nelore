import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUp, ArrowDown, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountGroup {
  id: string;
  name: string;
  parent_id?: string;
}

interface StructureItem {
  id?: string;
  item_type: 'group' | 'subgroup' | 'sum_line';
  account_group_id?: string;
  parent_id?: string;
  name: string;
  description?: string; // Campo para descrição personalizada das linhas de soma
  operation_type: 'credit' | 'debit';
  position_order: number;
  sum_items?: string[];
  account_group?: AccountGroup;
}

interface DREStructureData {
  id?: string;
  name: string;
  items: StructureItem[];
}

export const DREStructure: React.FC = () => {
  const [structures, setStructures] = useState<DREStructureData[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [currentStructure, setCurrentStructure] = useState<DREStructureData>({ name: "", items: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStructures();
    fetchAccountGroups();
  }, []);

  const fetchStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('dre_structures')
        .select(`
          *,
          dre_structure_items (
            *,
            account_groups (id, name, parent_id)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedStructures = data?.map(structure => ({
        id: structure.id,
        name: structure.name,
        items: structure.dre_structure_items
          ?.sort((a: any, b: any) => a.position_order - b.position_order)
          .map((item: any) => ({
            id: item.id,
            item_type: item.item_type,
            account_group_id: item.account_group_id,
            parent_id: item.parent_id,
            name: item.name,
            description: item.description,
            operation_type: item.operation_type,
            position_order: item.position_order,
            sum_items: item.sum_items || [],
            account_group: item.account_groups
          })) || []
      })) || [];

      setStructures(formattedStructures);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estruturas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchAccountGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('account_groups')
        .select('id, name, parent_id')
        .order('name');

      if (error) throw error;
      setAccountGroups(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos de contas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveStructure = async () => {
    if (!currentStructure.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da estrutura DRE",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      let structureId = currentStructure.id;

      if (isEditing && structureId) {
        // Atualizar estrutura existente
        const { error: updateError } = await supabase
          .from('dre_structures')
          .update({ name: currentStructure.name })
          .eq('id', structureId);

        if (updateError) throw updateError;

        // Deletar itens existentes
        const { error: deleteError } = await supabase
          .from('dre_structure_items')
          .delete()
          .eq('structure_id', structureId);

        if (deleteError) throw deleteError;
      } else {
        // Criar nova estrutura
        const { data: structureData, error: structureError } = await supabase
          .from('dre_structures')
          .insert({
            name: currentStructure.name,
            created_by: user.user.id
          })
          .select()
          .single();

        if (structureError) throw structureError;
        structureId = structureData.id;
      }

      // Inserir itens da estrutura
      if (currentStructure.items.length > 0) {
        const itemsToInsert = currentStructure.items.map(item => ({
          structure_id: structureId,
          item_type: item.item_type,
          account_group_id: item.account_group_id,
          parent_id: item.parent_id,
          name: item.name,
          description: item.description,
          operation_type: item.operation_type,
          position_order: item.position_order,
          sum_items: item.sum_items || []
        }));

        const { error: itemsError } = await supabase
          .from('dre_structure_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: isEditing ? "Estrutura atualizada" : "Estrutura criada",
        description: `A estrutura "${currentStructure.name}" foi ${isEditing ? 'atualizada' : 'criada'} com sucesso`,
      });

      setCurrentStructure({ name: "", items: [] });
      setIsEditing(false);
      setShowDialog(false);
      await fetchStructures();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar estrutura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStructure = (structure: DREStructureData) => {
    setCurrentStructure(structure);
    setIsEditing(true);
    setShowDialog(true);
  };

  const handleDeleteStructure = async (structureId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta estrutura?")) return;

    try {
      // Primeiro excluir os itens da estrutura
      const { error: itemsError } = await supabase
        .from('dre_structure_items')
        .delete()
        .eq('structure_id', structureId);

      if (itemsError) throw itemsError;

      // Depois excluir as entradas relacionadas
      const { error: entriesError } = await supabase
        .from('dre_entries')
        .delete()
        .eq('structure_id', structureId);

      if (entriesError) throw entriesError;

      // Por fim, excluir a estrutura
      const { error } = await supabase
        .from('dre_structures')
        .delete()
        .eq('id', structureId);

      if (error) throw error;

      toast({
        title: "Estrutura excluída",
        description: "A estrutura foi excluída com sucesso",
      });

      await fetchStructures();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir estrutura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addItem = (type: 'group' | 'subgroup' | 'sum_line') => {
    const newItem: StructureItem = {
      item_type: type,
      name: type === 'sum_line' ? 'Linha de Soma' : "",
      description: type === 'sum_line' ? '' : undefined,
      operation_type: 'credit',
      position_order: currentStructure.items.length + 1,
      sum_items: type === 'sum_line' ? [] : undefined
    };

    setCurrentStructure({
      ...currentStructure,
      items: [...currentStructure.items, newItem]
    });
  };

  const updateItem = (index: number, updatedItem: Partial<StructureItem>) => {
    const items = [...currentStructure.items];
    items[index] = { ...items[index], ...updatedItem };
    
    // Se está atualizando o account_group_id, atualizar também o nome
    if (updatedItem.account_group_id) {
      const selectedGroup = accountGroups.find(g => g.id === updatedItem.account_group_id);
      if (selectedGroup) {
        items[index].name = selectedGroup.name;
      }
    }
    
    setCurrentStructure({ ...currentStructure, items });
  };

  // Função para obter apenas grupos (sem parent_id)
  const getMainGroups = () => {
    return accountGroups.filter(group => !group.parent_id);
  };

  // Função para obter subgrupos de um grupo específico
  const getSubgroups = (parentGroupId: string) => {
    return accountGroups.filter(group => group.parent_id === parentGroupId);
  };

  // Função para encontrar o grupo pai de um subgrupo (o último grupo adicionado antes do subgrupo)
  const findParentGroup = (currentIndex: number) => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (currentStructure.items[i].item_type === 'group') {
        return currentStructure.items[i].account_group_id;
      }
    }
    return null;
  };

  const removeItem = (index: number) => {
    const items = currentStructure.items.filter((_, i) => i !== index);
    const reorderedItems = items.map((item, i) => ({ ...item, position_order: i + 1 }));
    setCurrentStructure({ ...currentStructure, items: reorderedItems });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const items = [...currentStructure.items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < items.length) {
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      const reorderedItems = items.map((item, i) => ({ ...item, position_order: i + 1 }));
      setCurrentStructure({ ...currentStructure, items: reorderedItems });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Estruturas DRE</h2>
          <p className="text-muted-foreground">Configure as estruturas dos demonstrativos de resultados</p>
        </div>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setCurrentStructure({ name: "", items: [] });
                setIsEditing(false);
                setShowDialog(true);
              }}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Estrutura</span>
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Estrutura DRE" : "Nova Estrutura DRE"}
              </DialogTitle>
              <DialogDescription>
                Configure a estrutura do demonstrativo de resultados utilizando grupos e subgrupos cadastrados
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="structure-name">Nome da Estrutura</Label>
                <Input
                  id="structure-name"
                  value={currentStructure.name}
                  onChange={(e) => setCurrentStructure({ ...currentStructure, name: e.target.value })}
                  placeholder="Digite o nome da estrutura DRE"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Itens da Estrutura</h3>
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => addItem('group')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Grupo
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => addItem('subgroup')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Subgrupo  
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addItem('sum_line')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Linha Soma
                    </Button>
                  </div>
                </div>

                {currentStructure.items.length > 0 && (
                    <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>Tipo</TableHead>
                           <TableHead>Nome</TableHead>
                           <TableHead>Descrição</TableHead>
                           <TableHead>Grupo de Conta</TableHead>
                           <TableHead>Operação</TableHead>
                           <TableHead>Ordem</TableHead>
                           <TableHead>Ações</TableHead>
                         </TableRow>
                       </TableHeader>
                    <TableBody>
                      {currentStructure.items.map((item, index) => (
                        <TableRow key={index}>
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
                             <span className="font-medium">
                               {item.name || 
                                (item.item_type === 'sum_line' 
                                  ? 'Linha de Soma' 
                                  : 'Selecione um ' + (item.item_type === 'group' ? 'grupo' : 'subgrupo')
                                )
                               }
                             </span>
                           </TableCell>
                           <TableCell>
                             {item.item_type === 'sum_line' ? (
                               <Input
                                 placeholder="Digite a descrição da linha de soma"
                                 value={item.description || ''}
                                 onChange={(e) => updateItem(index, { description: e.target.value })}
                               />
                             ) : (
                               <span className="text-muted-foreground">-</span>
                             )}
                           </TableCell>
                           <TableCell>
                             {item.item_type !== 'sum_line' && (
                               <Select
                                 value={item.account_group_id || ''}
                                 onValueChange={(value) => updateItem(index, { account_group_id: value })}
                               >
                                 <SelectTrigger>
                                   <SelectValue placeholder={
                                     item.item_type === 'group' 
                                       ? "Selecione o grupo" 
                                       : "Selecione o subgrupo"
                                   } />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {(item.item_type === 'group' 
                                     ? getMainGroups()
                                     : item.item_type === 'subgroup' 
                                       ? getSubgroups(findParentGroup(index) || '')
                                       : []
                                   ).map((group) => (
                                     <SelectItem key={group.id} value={group.id}>
                                       {group.name}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             )}
                             {item.item_type === 'sum_line' && (
                               <span className="text-muted-foreground">-</span>
                             )}
                           </TableCell>
                          <TableCell>
                            <Select
                              value={item.operation_type}
                              onValueChange={(value: 'credit' | 'debit') => 
                                updateItem(index, { operation_type: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="credit">Crédito</SelectItem>
                                <SelectItem value="debit">Débito</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{item.position_order}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveItem(index, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === currentStructure.items.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveStructure}
                  disabled={loading || !currentStructure.name.trim()}
                >
                  {loading ? "Salvando..." : (isEditing ? "Atualizar" : "Salvar")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estruturas Cadastradas</CardTitle>
          <CardDescription>
            Lista de todas as estruturas DRE configuradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {structures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map((structure) => (
                  <TableRow key={structure.id}>
                    <TableCell className="font-medium">{structure.name}</TableCell>
                    <TableCell>{structure.items.length} itens</TableCell>
                    <TableCell>
                      {/* Placeholder para data de criação */}
                      -
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditStructure(structure)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => structure.id && handleDeleteStructure(structure.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma estrutura cadastrada ainda.</p>
              <p className="text-muted-foreground">Clique em "Nova Estrutura" para começar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};