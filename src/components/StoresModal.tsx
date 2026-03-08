import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Search, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Store {
  id: string;
  name: string;
  code: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  opening_date: string | null;
  matrix_id: string;
  created_at: string;
  updated_at: string;
}

interface Matrix {
  id: string;
  code: number;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

interface StorePartner {
  partner_id: string;
  partner_name: string;
  percentage: number;
}

interface StoresModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  viewOnlyUserStores?: boolean; // When true, show only stores linked to logged user
}

export const StoresModal = ({ 
  open, 
  onOpenChange, 
  canEdit = true, 
  canDelete = true,
  viewOnlyUserStores = false 
}: StoresModalProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState(canEdit ? "register" : "list");
  const [userMatrixId, setUserMatrixId] = useState<string>("");
  const [userMatrixName, setUserMatrixName] = useState<string>("");
  const [isMasterUser, setIsMasterUser] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    cnpj: "",
    address: "",
    phone: "",
    manager_name: "",
    opening_date: "",
    matrix_id: "",
  });

  // Store partners state
  const [storePartners, setStorePartners] = useState<StorePartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [partnerPercentage, setPartnerPercentage] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchUserMatrix();
      fetchPartners();
    }
  }, [open]);

  // Fetch stores after userMatrixId is set
  useEffect(() => {
    if (open && (userMatrixId || isMasterUser)) {
      fetchStores();
    }
  }, [open, userMatrixId, isMasterUser]);

  const fetchUserMatrix = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if master user
      const masterUser = user.email === 'wisley_anderson@hotmail.com';
      setIsMasterUser(masterUser);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('matrix_id')
        .eq('id', user.id)
        .single();

      if (error || !profile?.matrix_id) {
        console.error("Error fetching user matrix:", error);
        return;
      }

      // Fetch matrix details
      const { data: matrix, error: matrixError } = await supabase
        .from('matrices')
        .select('id, code, name')
        .eq('id', profile.matrix_id)
        .single();

      if (matrixError || !matrix) {
        console.error("Error fetching matrix:", matrixError);
        return;
      }

      setUserMatrixId(matrix.id);
      setUserMatrixName(`${matrix.code} - ${matrix.name}`);
      setFormData(prev => ({ ...prev, matrix_id: matrix.id }));
    } catch (error) {
      console.error("Error in fetchUserMatrix:", error);
    }
  };

  const fetchUserStoreIds = async (): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') return [];

    const storeIds: string[] = [];
    if (profile?.store_id) storeIds.push(profile.store_id);

    const { data: userStores } = await supabase
      .from('user_stores')
      .select('store_id')
      .eq('user_id', user.id);

    userStores?.forEach(us => {
      if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
    });

    return storeIds;
  };

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const masterUser = user.email === 'wisley_anderson@hotmail.com';
      
      // If viewOnlyUserStores is true, filter by user's linked stores
      if (viewOnlyUserStores) {
        const userStoreIds = await fetchUserStoreIds();
        
        if (userStoreIds.length === 0) {
          setStores([]);
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .in("id", userStoreIds)
          .order("name");
        
        if (error) throw error;
        setStores(data || []);
      } else {
        let query = supabase.from("stores").select("*").order("name");
        
        // If not master user, filter by user's matrix
        if (!masterUser && userMatrixId) {
          query = query.eq('matrix_id', userMatrixId);
        }
        
        const { data, error } = await query;

        if (error) throw error;
        setStores(data || []);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as fazendas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      // Partners are already filtered by matrix via RLS policies
      // This ensures only partners from the user's matrix are returned
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, matrix_id")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
    }
  };

  const fetchStorePartners = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from("store_partners")
        .select(`
          partner_id,
          percentage,
          partners:partner_id (name)
        `)
        .eq("store_id", storeId);

      if (error) throw error;

      const formattedPartners: StorePartner[] = (data || []).map((sp: any) => ({
        partner_id: sp.partner_id,
        partner_name: sp.partners?.name || "",
        percentage: Number(sp.percentage),
      }));

      setStorePartners(formattedPartners);
    } catch (error) {
      console.error("Error fetching store partners:", error);
    }
  };

  const handleAddPartner = () => {
    if (!selectedPartnerId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um sócio.",
      });
      return;
    }

    const percentage = parseFloat(partnerPercentage) || 0;
    if (percentage < 0 || percentage > 100) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O percentual deve estar entre 0 e 100.",
      });
      return;
    }

    // Check if partner already added
    if (storePartners.some(sp => sp.partner_id === selectedPartnerId)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Este sócio já foi adicionado.",
      });
      return;
    }

    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return;

    setStorePartners([
      ...storePartners,
      {
        partner_id: selectedPartnerId,
        partner_name: partner.name,
        percentage,
      },
    ]);

    setSelectedPartnerId("");
    setPartnerPercentage("");
  };

  const handleRemovePartner = (partnerId: string) => {
    setStorePartners(storePartners.filter(sp => sp.partner_id !== partnerId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da fazenda é obrigatório.",
      });
      return;
    }

    if (!formData.code.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Código da fazenda é obrigatório.",
      });
      return;
    }

    // Validar código duplicado - apenas dentro da mesma matriz
    const { data: existingStore, error: checkError } = await supabase
      .from("stores")
      .select("id")
      .eq("code", formData.code)
      .eq("matrix_id", formData.matrix_id)
      .maybeSingle();

    if (checkError) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao verificar código da fazenda.",
      });
      return;
    }

    if (existingStore && (!editingStore || existingStore.id !== editingStore.id)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Já existe uma fazenda cadastrada com este código nesta matriz.",
      });
      return;
    }

    // Validar CNPJ duplicado se preenchido
    if (formData.cnpj.trim()) {
      const { data: existingCnpj, error: cnpjError } = await supabase
        .from("stores")
        .select("id")
        .eq("cnpj", formData.cnpj)
        .maybeSingle();

      if (cnpjError) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Erro ao verificar CNPJ da fazenda.",
        });
        return;
      }

      if (existingCnpj && (!editingStore || existingCnpj.id !== editingStore.id)) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Já existe uma fazenda cadastrada com este CNPJ.",
        });
        return;
      }
    }

    setLoading(true);
    try {
      let storeId: string;

      // Sanitize empty strings to null for optional fields
      const sanitizedData = {
        ...formData,
        address: formData.address || null,
        phone: formData.phone || null,
        manager_name: formData.manager_name || null,
        opening_date: formData.opening_date || null,
      };

      if (editingStore) {
        const { error } = await supabase
          .from("stores")
          .update(sanitizedData)
          .eq("id", editingStore.id);

        if (error) throw error;
        storeId = editingStore.id;

        // Delete existing store partners
        await supabase
          .from("store_partners")
          .delete()
          .eq("store_id", storeId);

        toast({
          title: "Sucesso",
          description: "Fazenda atualizada com sucesso!",
        });
      } else {
        const { data, error } = await supabase
          .from("stores")
          .insert([sanitizedData])
          .select()
          .single();

        if (error) throw error;
        storeId = data.id;

        toast({
          title: "Sucesso",
          description: "Fazenda cadastrada com sucesso!",
        });
      }

      // Insert store partners
      if (storePartners.length > 0) {
        const partnersToInsert = storePartners.map(sp => ({
          store_id: storeId,
          partner_id: sp.partner_id,
          percentage: sp.percentage,
        }));

        const { error: partnersError } = await supabase
          .from("store_partners")
          .insert(partnersToInsert);

        if (partnersError) {
          console.error("Error saving partners:", partnersError);
        }
      }

      resetForm();
      await fetchStores();
      setActiveTab("list");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a fazenda.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (store: Store) => {
    setFormData({
      name: store.name,
      code: store.code,
      cnpj: store.cnpj || "",
      address: store.address || "",
      phone: store.phone || "",
      manager_name: store.manager_name || "",
      opening_date: store.opening_date || "",
      matrix_id: store.matrix_id,
    });
    setEditingStore(store);
    await fetchStorePartners(store.id);
    setActiveTab("register");
  };

  const handleDelete = async (store: Store) => {
    setLoading(true);
    try {
      // Verificar se existem contas a pagar vinculadas à loja
      const { data: relatedPayables, error: payablesError } = await supabase
        .from("accounts_payable")
        .select("id")
        .eq("store_id", store.id)
        .limit(1);

      if (payablesError) throw payablesError;

      if (relatedPayables && relatedPayables.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Esta fazenda possui contas a pagar vinculadas e não pode ser excluída.",
        });
        setLoading(false);
        return;
      }

      // Verificar se existem controles de caixa vinculados à loja
      const { data: relatedCashControl, error: cashError } = await supabase
        .from("cash_control")
        .select("id")
        .eq("store_id", store.id)
        .limit(1);

      if (cashError) throw cashError;

      if (relatedCashControl && relatedCashControl.length > 0) {
        toast({
          variant: "destructive",
          title: "Exclusão não permitida",
          description: "Esta fazenda possui controles de caixa vinculados e não pode ser excluída.",
        });
        setLoading(false);
        return;
      }

      if (!confirm(`Tem certeza que deseja excluir a fazenda ${store.name}?`)) {
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", store.id);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Fazenda excluída com sucesso!",
      });
      
      await fetchStores();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a fazenda.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      cnpj: "",
      address: "",
      phone: "",
      manager_name: "",
      opening_date: "",
      matrix_id: userMatrixId,
    });
    setEditingStore(null);
    setStorePartners([]);
    setSelectedPartnerId("");
    setPartnerPercentage("");
  };

  const formatCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, "");
    
    if (cleaned.length <= 14) {
      const formatted = formatCnpj(cleaned);
      setFormData({ ...formData, cnpj: formatted });
    }
  };

  const filteredStores = stores.filter(store => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      store.name.toLowerCase().includes(searchLower) ||
      store.code.toLowerCase().includes(searchLower) ||
      (store.cnpj && store.cnpj.includes(searchTerm))
    );
  });

  // Filter out already added partners
  const availablePartners = partners.filter(
    p => !storePartners.some(sp => sp.partner_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Fazendas</DialogTitle>
          <DialogDescription>
            Cadastro e gestão de fazendas
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={canEdit ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            {canEdit && (
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            )}
            <TabsTrigger value="list">Exibir Cadastros</TabsTrigger>
          </TabsList>

          {/* Register Tab */}
          <TabsContent value="register" className="max-h-[70vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingStore ? "Editar Fazenda" : "Nova Fazenda"}
                </CardTitle>
                <CardDescription>
                  {editingStore 
                    ? "Atualize as informações da fazenda" 
                    : "Preencha os dados da nova fazenda"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Campo Matriz - sempre visível mas não editável */}
                  <div className="space-y-2">
                    <Label htmlFor="matrix">Matriz *</Label>
                    <Input
                      id="matrix"
                      value={userMatrixName}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Código *</Label>
                      <Input
                        id="code"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Código único da fazenda"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <Input
                        id="cnpj"
                        required
                        value={formData.cnpj}
                        onChange={handleCnpjChange}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Fazenda *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome da fazenda"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="opening_date">Data de Abertura</Label>
                      <Input
                        id="opening_date"
                        type="date"
                        value={formData.opening_date}
                        onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="manager_name">Gerente</Label>
                      <Input
                        id="manager_name"
                        value={formData.manager_name}
                        onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                        placeholder="Nome do gerente"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Endereço completo"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>

                  {/* Partners Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold">Sócios</Label>
                    
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="partner">Sócio</Label>
                        <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um sócio" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePartners.map((partner) => (
                              <SelectItem key={partner.id} value={partner.id}>
                                {partner.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-32 space-y-2">
                        <Label htmlFor="percentage">% Participação</Label>
                        <Input
                          id="percentage"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={partnerPercentage}
                          onChange={(e) => setPartnerPercentage(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={handleAddPartner}
                        disabled={!selectedPartnerId}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {storePartners.length > 0 && (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Sócio</TableHead>
                              <TableHead className="w-32">%</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {storePartners.map((sp) => (
                              <TableRow key={sp.partner_id}>
                                <TableCell>{sp.partner_name}</TableCell>
                                <TableCell>{sp.percentage.toFixed(2)}%</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemovePartner(sp.partner_id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : (editingStore ? "Atualizar" : "Cadastrar")}
                    </Button>
                    {editingStore && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Fazendas</CardTitle>
                <CardDescription>
                  Gerencie todas as fazendas cadastradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, código ou CNPJ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Gerente</TableHead>
                        <TableHead>Data Abertura</TableHead>
                        {(canEdit || canDelete) && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredStores.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            {stores.length === 0 ? "Nenhuma fazenda cadastrada" : "Nenhuma fazenda encontrada para a busca"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStores.map((store) => (
                          <TableRow key={store.id}>
                            <TableCell className="font-medium">
                              {store.name}
                            </TableCell>
                            <TableCell>
                              {store.code}
                            </TableCell>
                            <TableCell>
                              {store.cnpj || "-"}
                            </TableCell>
                            <TableCell>
                              {store.phone || "-"}
                            </TableCell>
                            <TableCell>
                              {store.manager_name || "-"}
                            </TableCell>
                            <TableCell>
                              {store.opening_date ? new Date(store.opening_date).toLocaleDateString('pt-BR') : "-"}
                            </TableCell>
                            {(canEdit || canDelete) && (
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {canEdit && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(store)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(store)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
