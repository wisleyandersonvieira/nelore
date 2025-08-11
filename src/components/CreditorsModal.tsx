import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Creditor {
  id: string;
  name: string;
  cnpj_cpf?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreditorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditorsModal({ open, onOpenChange }: CreditorsModalProps) {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  const [activeTab, setActiveTab] = useState("register");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    cnpj_cpf: "",
    address: "",
    contact_person: "",
    phone: "",
    email: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    if (open) {
      fetchCreditors();
    }
  }, [open]);

  const fetchCreditors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("creditors")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCreditors(data || []);
    } catch (error) {
      console.error("Error fetching creditors:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar credores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCnpjCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    
    if (numbers.length <= 11) {
      // CPF format: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2");
    } else {
      // CNPJ format: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})/, "$1-$2");
    }
  };

  const handleCnpjCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpjCpf(e.target.value);
    setFormData({ ...formData, cnpj_cpf: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da empresa é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Check for duplicate CNPJ/CPF if provided
      if (formData.cnpj_cpf.trim()) {
        const { data: existingCreditor } = await supabase
          .from("creditors")
          .select("id")
          .eq("cnpj_cpf", formData.cnpj_cpf)
          .eq("is_active", true)
          .maybeSingle();

        if (existingCreditor && (!editingCreditor || existingCreditor.id !== editingCreditor.id)) {
          toast({
            title: "Erro",
            description: "CNPJ/CPF já cadastrado",
            variant: "destructive",
          });
          return;
        }
      }

      if (editingCreditor) {
        // Update existing creditor
        const { error } = await supabase
          .from("creditors")
          .update({
            name: formData.name,
            cnpj_cpf: formData.cnpj_cpf || null,
            address: formData.address || null,
            contact_person: formData.contact_person || null,
            phone: formData.phone || null,
            email: formData.email || null,
            city: formData.city || null,
            state: formData.state || null,
          })
          .eq("id", editingCreditor.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Credor atualizado com sucesso",
        });
      } else {
        // Create new creditor
        const { error } = await supabase
          .from("creditors")
          .insert({
            name: formData.name,
            cnpj_cpf: formData.cnpj_cpf || null,
            address: formData.address || null,
            contact_person: formData.contact_person || null,
            phone: formData.phone || null,
            email: formData.email || null,
            city: formData.city || null,
            state: formData.state || null,
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Credor cadastrado com sucesso",
        });
      }

      resetForm();
      fetchCreditors();
      setActiveTab("list");
    } catch (error) {
      console.error("Error saving creditor:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar credor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (creditor: Creditor) => {
    setEditingCreditor(creditor);
    setFormData({
      name: creditor.name,
      cnpj_cpf: creditor.cnpj_cpf || "",
      address: creditor.address || "",
      contact_person: creditor.contact_person || "",
      phone: creditor.phone || "",
      email: creditor.email || "",
      city: creditor.city || "",
      state: creditor.state || "",
    });
    setActiveTab("register");
  };

  const handleDelete = async (creditor: Creditor) => {
    if (!confirm("Tem certeza que deseja excluir este credor?")) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("creditors")
        .update({ is_active: false })
        .eq("id", creditor.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Credor excluído com sucesso",
      });

      fetchCreditors();
    } catch (error) {
      console.error("Error deleting creditor:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir credor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj_cpf: "",
      address: "",
      contact_person: "",
      phone: "",
      email: "",
      city: "",
      state: "",
    });
    setEditingCreditor(null);
  };

  const filteredCreditors = creditors.filter((creditor) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      creditor.name.toLowerCase().includes(searchLower) ||
      (creditor.cnpj_cpf && creditor.cnpj_cpf.includes(searchLower))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Credores</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register">
              {editingCreditor ? "Editar" : "Cadastrar"}
            </TabsTrigger>
            <TabsTrigger value="list">Listar</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Nome da empresa"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
                  <Input
                    id="cnpj_cpf"
                    value={formData.cnpj_cpf}
                    onChange={handleCnpjCpfChange}
                    placeholder="00.000.000/0000-00 ou 000.000.000-00"
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Pessoa de Contato</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value })
                    }
                    placeholder="Nome da pessoa de contato"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Endereço completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder="Estado"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCreditor ? "Atualizar" : "Cadastrar"}
                </Button>
                
                {editingCreditor && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Buscar por nome ou CNPJ/CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ/CPF</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCreditors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          {searchTerm ? "Nenhum credor encontrado" : "Nenhum credor cadastrado"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCreditors.map((creditor) => (
                        <TableRow key={creditor.id}>
                          <TableCell className="font-medium">
                            {creditor.name}
                          </TableCell>
                          <TableCell>{creditor.cnpj_cpf || "-"}</TableCell>
                          <TableCell>{creditor.contact_person || "-"}</TableCell>
                          <TableCell>{creditor.phone || "-"}</TableCell>
                          <TableCell>{creditor.email || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(creditor)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(creditor)}
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
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}