import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Users, Check, X } from "lucide-react";

interface Owner {
  id: string;
  owner_id: string;
  owner_name: string;
  percentage: number;
}

interface OwnersTabProps {
  entityId: string | null;
  entityType: "animal" | "pregnancy" | "aspiration";
  isReadOnly?: boolean;
}

export function OwnersTab({ entityId, entityType, isReadOnly = false }: OwnersTabProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fkColumn = entityType === "animal"
    ? "animal_id"
    : entityType === "pregnancy"
    ? "pregnancy_id"
    : "aspiration_id";

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (entityId) {
      fetchOwners();
    } else {
      setOwners([]);
    }
  }, [entityId]);

  const fetchSuppliers = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", userData.user.id)
        .single();
      if (!profile?.matrix_id) return;
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("matrix_id", profile.matrix_id)
        .eq("is_active", true)
        .eq("is_owner", true)
        .order("name");
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const queryOwners = async (id: string) => {
    if (entityType === "animal") {
      return supabase.from("animal_owners").select("id, owner_id, percentage").eq("animal_id", id).order("created_at", { ascending: true });
    } else if (entityType === "pregnancy") {
      return supabase.from("pregnancy_owners").select("id, owner_id, percentage").eq("pregnancy_id", id).order("created_at", { ascending: true });
    } else {
      return supabase.from("aspiration_owners").select("id, owner_id, percentage").eq("aspiration_id", id).order("created_at", { ascending: true });
    }
  };

  const insertOwner = async (record: any) => {
    if (entityType === "animal") return supabase.from("animal_owners").insert(record);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").insert(record);
    return supabase.from("aspiration_owners").insert(record);
  };

  const updateOwner = async (id: string, record: any) => {
    if (entityType === "animal") return supabase.from("animal_owners").update(record).eq("id", id);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").update(record).eq("id", id);
    return supabase.from("aspiration_owners").update(record).eq("id", id);
  };

  const deleteOwner = async (id: string) => {
    if (entityType === "animal") return supabase.from("animal_owners").delete().eq("id", id);
    if (entityType === "pregnancy") return supabase.from("pregnancy_owners").delete().eq("id", id);
    return supabase.from("aspiration_owners").delete().eq("id", id);
  };

  const fetchOwners = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const { data, error } = await queryOwners(entityId);
      if (error) throw error;

      const ownersWithNames: Owner[] = [];
      for (const row of data || []) {
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("name")
          .eq("id", row.owner_id)
          .single();
        ownersWithNames.push({
          id: row.id,
          owner_id: row.owner_id,
          owner_name: supplier?.name || "Não encontrado",
          percentage: Number(row.percentage),
        });
      }
      setOwners(ownersWithNames);
    } catch (error) {
      console.error("Error fetching owners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!entityId || !selectedOwnerId || !percentage) {
      toast({ title: "Erro", description: "Selecione o proprietário e informe a %.", variant: "destructive" });
      return;
    }
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0.01 e 100.", variant: "destructive" });
      return;
    }
    const currentTotal = owners.reduce((s, o) => s + o.percentage, 0);
    if (currentTotal + pct > 100) {
      toast({ title: "Erro", description: `Soma ultrapassa 100%. Disponível: ${(100 - currentTotal).toFixed(2)}%`, variant: "destructive" });
      return;
    }
    // Check duplicate
    if (owners.some(o => o.owner_id === selectedOwnerId)) {
      toast({ title: "Erro", description: "Este proprietário já foi adicionado.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const record = {
        [fkColumn]: entityId,
        owner_id: selectedOwnerId,
        percentage: pct,
        created_by: userData.user?.id,
      };
      const { error } = await insertOwner(record);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário adicionado." });
      setShowAddForm(false);
      setSelectedOwnerId("");
      setPercentage("");
      fetchOwners();
    } catch (error) {
      console.error("Error adding owner:", error);
      toast({ title: "Erro", description: "Erro ao adicionar proprietário.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (owner: Owner) => {
    setEditingId(owner.id);
    setSelectedOwnerId(owner.owner_id);
    setPercentage(owner.percentage.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingId || !percentage) return;
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Erro", description: "A porcentagem deve ser entre 0.01 e 100.", variant: "destructive" });
      return;
    }
    const currentTotal = owners.filter(o => o.id !== editingId).reduce((s, o) => s + o.percentage, 0);
    if (currentTotal + pct > 100) {
      toast({ title: "Erro", description: `Soma ultrapassa 100%. Disponível: ${(100 - currentTotal).toFixed(2)}%`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ percentage: pct, owner_id: selectedOwnerId } as any)
        .eq("id", editingId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário atualizado." });
      setEditingId(null);
      setSelectedOwnerId("");
      setPercentage("");
      fetchOwners();
    } catch (error) {
      console.error("Error updating owner:", error);
      toast({ title: "Erro", description: "Erro ao atualizar proprietário.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ownerId: string) => {
    if (!confirm("Tem certeza que deseja remover este proprietário?")) return;
    try {
      const { error } = await supabase.from(tableName).delete().eq("id", ownerId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Proprietário removido." });
      fetchOwners();
    } catch (error) {
      console.error("Error deleting owner:", error);
      toast({ title: "Erro", description: "Erro ao remover proprietário.", variant: "destructive" });
    }
  };

  const totalPercentage = owners.reduce((s, o) => s + o.percentage, 0);

  // Filter suppliers not already added (except when editing)
  const availableSuppliers = suppliers.filter(
    s => !owners.some(o => o.owner_id === s.id) || (editingId && owners.find(o => o.id === editingId)?.owner_id === s.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Proprietários
        </h3>
        {!isReadOnly && !showAddForm && !editingId && entityId && (
          <Button size="sm" onClick={() => { setShowAddForm(true); setSelectedOwnerId(""); setPercentage(""); }}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Proprietário
          </Button>
        )}
      </div>

      {!entityId && (
        <p className="text-center text-muted-foreground py-4">
          Salve o registro primeiro para gerenciar proprietários.
        </p>
      )}

      {/* Add Form */}
      {showAddForm && entityId && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>Proprietário *</Label>
              <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o proprietário" />
                </SelectTrigger>
                <SelectContent>
                  {availableSuppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Participação (%) *</Label>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percentage}
                onChange={e => setPercentage(e.target.value)}
                placeholder="Ex: 50"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setSelectedOwnerId(""); setPercentage(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Owners List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : owners.length === 0 && entityId ? (
        <p className="text-center text-muted-foreground py-8">Nenhum proprietário registrado.</p>
      ) : owners.length > 0 ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proprietário</TableHead>
                  <TableHead className="text-right">Participação (%)</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map(owner => (
                  <TableRow key={owner.id}>
                    {editingId === owner.id ? (
                      <>
                        <TableCell>
                          <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSuppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={percentage}
                            onChange={e => setPercentage(e.target.value)}
                            className="w-24 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingId(null); setSelectedOwnerId(""); setPercentage(""); }}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{owner.owner_name}</TableCell>
                        <TableCell className="text-right">{owner.percentage.toFixed(2)}%</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(owner)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(owner.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">Total</span>
            <span className="font-semibold">{totalPercentage.toFixed(2)}%</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
