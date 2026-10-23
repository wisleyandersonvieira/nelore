import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, RefreshCw, X, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserMatrix } from "@/hooks/useUserMatrix";
import { Badge } from "@/components/ui/badge";

interface DocumentTypesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  matrix_id: string | null;
  created_at: string;
  updated_at: string;
}

export function DocumentTypesModal({ open, onOpenChange, canEdit = true, canDelete = true }: DocumentTypesModalProps) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const { toast } = useToast();
  const { matrixId, matrixName, isLoading: matrixLoading } = useUserMatrix();

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      fetchDocumentTypes();
    }
  }, [open]);

  const fetchDocumentTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .order("code");

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tipos de documento",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setIsActive(true);
  };

  // Check if document type is a default (system) type
  const isDefaultType = (docType: DocumentType) => docType.matrix_id === null;

  const handleEdit = (docType: DocumentType) => {
    // Don't allow editing default types
    if (isDefaultType(docType)) return;
    
    setEditingId(docType.id);
    setCode(docType.code);
    setName(docType.name);
    setIsActive(docType.is_active);
    setActiveTab("form");
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código e nome são obrigatórios.",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("document_types")
          .update({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            is_active: isActive,
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Tipo de documento atualizado com sucesso.",
        });
      } else {
        if (!matrixId) {
          throw new Error("Usuário não está vinculado a uma matriz.");
        }

        const { error } = await supabase
          .from("document_types")
          .insert({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            is_active: isActive,
            matrix_id: matrixId,
          });

        if (error) {
          if (error.code === "23505") {
            throw new Error("Já existe um tipo de documento com este código.");
          }
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Tipo de documento cadastrado com sucesso.",
        });
      }

      resetForm();
      fetchDocumentTypes();
      setActiveTab("list");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docType: DocumentType) => {
    // Don't allow deleting default types
    if (isDefaultType(docType)) {
      toast({
        variant: "destructive",
        title: "Não permitido",
        description: "Tipos de documento padrão não podem ser excluídos.",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if document type is linked to accounts payable
      const { count: payableCount, error: payableError } = await supabase
        .from("accounts_payable")
        .select("*", { count: "exact", head: true })
        .eq("document_type", docType.code);

      if (payableError) throw payableError;

      // Check if document type is linked to accounts receivable
      const { count: receivableCount, error: receivableError } = await supabase
        .from("accounts_receivable")
        .select("*", { count: "exact", head: true })
        .eq("document_type", docType.code);

      if (receivableError) throw receivableError;

      const totalLinks = (payableCount || 0) + (receivableCount || 0);

      if (totalLinks > 0) {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: `Este tipo de documento está vinculado a ${totalLinks} registro(s) de contas a pagar/receber. Você pode desativá-lo ao invés de excluir.`,
        });
        setLoading(false);
        return;
      }

      if (!window.confirm("Tem certeza que deseja excluir este tipo de documento?")) {
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("document_types")
        .delete()
        .eq("id", docType.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tipo de documento excluído com sucesso.",
      });

      fetchDocumentTypes();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (docType: DocumentType) => {
    // Don't allow toggling default types
    if (isDefaultType(docType)) {
      toast({
        variant: "destructive",
        title: "Não permitido",
        description: "Tipos de documento padrão não podem ser alterados.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("document_types")
        .update({ is_active: !docType.is_active })
        .eq("id", docType.id);

      if (error) throw error;

      setDocumentTypes(prev =>
        prev.map(dt => (dt.id === docType.id ? { ...dt, is_active: !docType.is_active } : dt))
      );

      toast({
        title: "Sucesso",
        description: `Tipo de documento ${!docType.is_active ? "ativado" : "desativado"} com sucesso.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tipos de Documento</DialogTitle>
        </DialogHeader>

        <Tabs value={canEdit ? activeTab : "list"} onValueChange={(value) => canEdit && setActiveTab(value)}>
          {canEdit ? (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="form">{editingId ? "Editar" : "Novo"}</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="list">Lista</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="list" className="space-y-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDocumentTypes}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setActiveTab("form");
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Tipo
                </Button>
              )}
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum tipo de documento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    documentTypes.map((docType) => {
                      const isDefault = isDefaultType(docType);
                      return (
                        <TableRow key={docType.id} className={isDefault ? "bg-muted/30" : ""}>
                          <TableCell className="font-mono font-medium">{docType.code}</TableCell>
                          <TableCell>{docType.name}</TableCell>
                          <TableCell>
                            {isDefault ? (
                              <Badge variant="secondary" className="gap-1">
                                <Lock className="h-3 w-3" />
                                Padrão
                              </Badge>
                            ) : (
                              <Badge variant="outline">Personalizado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={docType.is_active}
                              onCheckedChange={() => handleToggleActive(docType)}
                              disabled={!canEdit || isDefault}
                            />
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {canEdit && !isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(docType)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && !isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(docType)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            {isDefault && (
                              <span className="text-xs text-muted-foreground px-2">Protegido</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {canEdit && (
            <TabsContent value="form" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex: NF, RC, CT"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Nota Fiscal"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Matriz</Label>
                <Input
                  value={matrixLoading ? "Carregando..." : matrixName || "Não vinculado"}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Ativo</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setActiveTab("list");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
