import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Brand {
  id: string;
  name: string;
}

interface Matrix {
  id: string;
  code: number;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  brand_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MatrixFormData {
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  brand_id: string;
  is_active: boolean;
}

const initialFormData: MatrixFormData = {
  name: "",
  cnpj: "",
  address: "",
  city: "",
  state: "",
  phone: "",
  email: "",
  brand_id: "",
  is_active: true,
};

const MatricesTab = () => {
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMatrix, setSelectedMatrix] = useState<Matrix | null>(null);
  const [formData, setFormData] = useState<MatrixFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMatrices();
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchMatrices = async () => {
    try {
      const { data, error } = await supabase
        .from('matrices')
        .select('*')
        .order('code');

      if (error) throw error;
      setMatrices(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar matrizes: " + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedMatrix(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (matrix: Matrix) => {
    setSelectedMatrix(matrix);
    setFormData({
      name: matrix.name,
      cnpj: matrix.cnpj || "",
      address: matrix.address || "",
      city: matrix.city || "",
      state: matrix.state || "",
      phone: matrix.phone || "",
      email: matrix.email || "",
      brand_id: matrix.brand_id || "",
      is_active: matrix.is_active,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (matrix: Matrix) => {
    setSelectedMatrix(matrix);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O nome da matriz é obrigatório.",
      });
      return;
    }

    setSaving(true);
    try {
      if (selectedMatrix) {
        // Update - only include brand_id if matrix doesn't have one yet
        const updateData: Record<string, any> = {
          name: formData.name,
          cnpj: formData.cnpj || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null,
          email: formData.email || null,
          is_active: formData.is_active,
        };
        
        // Only allow setting brand_id if it wasn't already set
        if (!selectedMatrix.brand_id && formData.brand_id) {
          updateData.brand_id = formData.brand_id;
        }
        
        const { error } = await supabase
          .from('matrices')
          .update(updateData)
          .eq('id', selectedMatrix.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Matriz atualizada com sucesso.",
        });
      } else {
        // Create
        const { error } = await supabase
          .from('matrices')
          .insert({
            name: formData.name,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null,
            email: formData.email || null,
            brand_id: formData.brand_id || null,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Matriz criada com sucesso.",
        });
      }

      setIsDialogOpen(false);
      fetchMatrices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar matriz: " + error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMatrix) return;

    try {
      const { error } = await supabase
        .from('matrices')
        .delete()
        .eq('id', selectedMatrix.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Matriz excluída com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      setSelectedMatrix(null);
      fetchMatrices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir matriz: " + error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Matrizes (Empresas Mãe)
          </CardTitle>
          <Button onClick={openCreateDialog} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Matriz
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma matriz cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                matrices.map((matrix) => (
                  <TableRow key={matrix.id}>
                    <TableCell className="font-medium">{matrix.code}</TableCell>
                    <TableCell className="font-medium">{matrix.name}</TableCell>
                    <TableCell>{matrix.cnpj || "-"}</TableCell>
                    <TableCell>
                      {matrix.city && matrix.state
                        ? `${matrix.city}/${matrix.state}`
                        : matrix.city || matrix.state || "-"}
                    </TableCell>
                    <TableCell>{matrix.phone || "-"}</TableCell>
                    <TableCell>{matrix.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={matrix.is_active ? "default" : "secondary"}>
                        {matrix.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(matrix)}
                          className="h-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(matrix)}
                          className="h-8"
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
        </CardContent>
      </Card>

      {/* Dialog para criar/editar matriz */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMatrix ? "Editar Matriz" : "Nova Matriz"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da matriz"
              />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, bairro"
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>
            <div>
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="brand_id">Marca</Label>
              {selectedMatrix?.brand_id ? (
                <Input
                  id="brand_id"
                  value={brands.find(b => b.id === formData.brand_id)?.name || "Marca vinculada"}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <Select
                  value={formData.brand_id}
                  onValueChange={(value) => setFormData({ ...formData, brand_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma marca (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedMatrix?.brand_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  O vínculo com a marca não pode ser alterado após definido.
                </p>
              )}
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Matriz ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedMatrix ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a matriz "{selectedMatrix?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MatricesTab;
