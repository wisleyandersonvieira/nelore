import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PregnancyRecord {
  id: string;
  code: number;
  name: string;
  sex: string;
  expected_birth_month: string | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  sire_id: string | null;
  dam_id: string | null;
  farm_id: string | null;
  farm_type: string | null;
  status: string;
  store_id: string;
}

interface Breed {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Auction {
  id: string;
  name: string;
}

interface BreedingAnimal {
  id: string;
  name: string;
  sex: string;
  sire_id: string | null;
  dam_id: string | null;
}

const AnimaisGestaoPrenhez = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PregnancyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedRecord, setSelectedRecord] = useState<PregnancyRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PregnancyRecord | null>(null);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [recordToFinalize, setRecordToFinalize] = useState<PregnancyRecord | null>(null);
  const [activeTab, setActiveTab] = useState("dados");
  const [storeId, setStoreId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    sex: "",
    expected_birth_month: null as Date | null,
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    sire_id: "",
    dam_id: "",
    farm: "",
  });

  // Dropdown options
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [ownFarms, setOwnFarms] = useState<{ id: string; name: string }[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchRecords();
    fetchDropdownData();
  }, []);

  const fetchRecords = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;
      setStoreId(profile.store_id);

      const { data, error } = await supabase
        .from("pregnancy_management")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("code", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching pregnancy records:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registros de prenhez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;

      // Fetch all dropdown data in parallel
      const [breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes, storesRes, thirdPartyFarmsRes] = await Promise.all([
        supabase.from("animal_breeds").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("animal_categories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("leiloes").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("stores").select("id, name"),
        supabase.from("third_party_farms").select("id, name").eq("is_active", true),
      ]);

      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      setSires((breedingAnimalsRes.data || []).filter(a => a.sex === "macho"));
      setDams((breedingAnimalsRes.data || []).filter(a => a.sex === "femea"));
      setOwnFarms(storesRes.data || []);
      setThirdPartyFarms(thirdPartyFarmsRes.data || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const getNextCode = async () => {
    if (!storeId) return 1;
    const { data } = await supabase
      .from("pregnancy_management")
      .select("code")
      .eq("store_id", storeId)
      .order("code", { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0].code + 1 : 1;
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", record?: PregnancyRecord) => {
    setModalMode(mode);
    setActiveTab("dados");

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode,
        name: "",
        sex: "",
        expected_birth_month: null,
        breed_id: "",
        category_id: "",
        auction_id: "",
        auction_lot: "",
        sire_id: "",
        dam_id: "",
        farm: "",
      });
      setSelectedRecord(null);
    } else if (record) {
      setSelectedRecord(record);
      let farmValue = "";
      if (record.farm_id && record.farm_type) {
        farmValue = `${record.farm_type}-${record.farm_id}`;
      }
      setFormData({
        code: record.code,
        name: record.name,
        sex: record.sex,
        expected_birth_month: record.expected_birth_month ? new Date(record.expected_birth_month) : null,
        breed_id: record.breed_id || "",
        category_id: record.category_id || "",
        auction_id: record.auction_id || "",
        auction_lot: record.auction_lot || "",
        sire_id: record.sire_id || "",
        dam_id: record.dam_id || "",
        farm: farmValue,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sex) {
      toast({
        title: "Erro",
        description: "O sexo é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;

      // Parse farm value
      let farmId: string | null = null;
      let farmType: string | null = null;
      if (formData.farm) {
        const dashIndex = formData.farm.indexOf("-");
        if (dashIndex > 0) {
          farmType = formData.farm.substring(0, dashIndex);
          farmId = formData.farm.substring(dashIndex + 1);
        }
      }

      const recordData = {
        code: formData.code,
        name: formData.name.trim(),
        sex: formData.sex,
        expected_birth_month: formData.expected_birth_month
          ? format(formData.expected_birth_month, "yyyy-MM-dd")
          : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        farm_id: farmId,
        farm_type: farmType,
        store_id: profile.store_id,
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("pregnancy_management").insert(recordData);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso." });
      } else {
        const { error } = await supabase
          .from("pregnancy_management")
          .update(recordData)
          .eq("id", selectedRecord!.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso." });
      }

      setModalOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving record:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase
        .from("pregnancy_management")
        .delete()
        .eq("id", recordToDelete.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Registro excluído com sucesso." });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir registro.",
        variant: "destructive",
      });
    }
  };

  const handleFinalize = async () => {
    if (!recordToFinalize || !storeId) return;

    try {
      // Get next animal code
      const { data: codeData } = await supabase.rpc("get_next_animal_code", {
        store_uuid: storeId,
      }) as { data: number | null };

      // Create animal from pregnancy record
      const animalData = {
        code: codeData || 1,
        name: recordToFinalize.name,
        sex: recordToFinalize.sex,
        breed_id: recordToFinalize.breed_id,
        category_id: recordToFinalize.category_id,
        auction_id: recordToFinalize.auction_id,
        auction_lot: recordToFinalize.auction_lot,
        sire_id: recordToFinalize.sire_id,
        dam_id: recordToFinalize.dam_id,
        farm_id: recordToFinalize.farm_id,
        farm_type: recordToFinalize.farm_type,
        birth_date: recordToFinalize.expected_birth_month,
        store_id: storeId,
        is_active: true,
      };

      const { error: animalError } = await supabase.from("animals").insert(animalData);
      if (animalError) throw animalError;

      // Update pregnancy record status
      const { error: updateError } = await supabase
        .from("pregnancy_management")
        .update({ status: "finalized" })
        .eq("id", recordToFinalize.id);
      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Animal criado com sucesso a partir do registro de prenhez.",
      });

      setFinalizeDialogOpen(false);
      setRecordToFinalize(null);
      fetchRecords();
      navigate("/animais/cadastro");
    } catch (error) {
      console.error("Error finalizing record:", error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar registro.",
        variant: "destructive",
      });
    }
  };

  const getBreedName = (breedId: string | null) => {
    if (!breedId) return "-";
    return breeds.find((b) => b.id === breedId)?.name || "-";
  };

  const getFarmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") {
      return ownFarms.find((f) => f.id === farmId)?.name || "-";
    }
    return thirdPartyFarms.find((f) => f.id === farmId)?.name || "-";
  };

  const getSireName = (sireId: string | null) => {
    if (!sireId) return "-";
    return sires.find((s) => s.id === sireId)?.name || "-";
  };

  const getDamName = (damId: string | null) => {
    if (!damId) return "-";
    return dams.find((d) => d.id === damId)?.name || "-";
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "-";
    return categories.find((c) => c.id === categoryId)?.name || "-";
  };

  const getAuctionName = (auctionId: string | null) => {
    if (!auctionId) return "-";
    return auctions.find((a) => a.id === auctionId)?.name || "-";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gestão de Prenhez</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de gestações</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Button onClick={() => handleOpenModal("create")}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Raça</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Mês Prev. Nascimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.code}</TableCell>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>{getBreedName(record.breed_id)}</TableCell>
                      <TableCell>{getFarmName(record.farm_id, record.farm_type)}</TableCell>
                      <TableCell>
                        {record.expected_birth_month
                          ? format(new Date(record.expected_birth_month), "MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            record.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          )}
                        >
                          {record.status === "in_progress" ? "Em Andamento" : "Finalizado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal("view", record)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {record.status === "in_progress" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenModal("edit", record)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRecordToDelete(record);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRecordToFinalize(record);
                                  setFinalizeDialogOpen(true);
                                }}
                                title="Finalizar"
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "view"
                ? "Visualizar Registro"
                : modalMode === "edit"
                ? "Editar Registro"
                : "Novo Registro de Prenhez"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="financeiro" disabled>
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="proprietarios" disabled>
                Proprietários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={modalMode === "view"}
                  />
                </div>
                <div>
                  <Label>Sexo *</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({ ...formData, sex: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="macho">Macho</SelectItem>
                      <SelectItem value="femea">Fêmea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Mês Previsto de Nascimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.expected_birth_month && "text-muted-foreground"
                        )}
                        disabled={modalMode === "view"}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expected_birth_month
                          ? format(formData.expected_birth_month, "MM/yyyy", { locale: ptBR })
                          : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.expected_birth_month || undefined}
                        onSelect={(date) => setFormData({ ...formData, expected_birth_month: date || null })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Raça</Label>
                  <Select
                    value={formData.breed_id}
                    onValueChange={(value) => setFormData({ ...formData, breed_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {breeds.map((breed) => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fazenda</Label>
                  <Select
                    value={formData.farm}
                    onValueChange={(value) => setFormData({ ...formData, farm: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ownFarms.length > 0 && (
                        <>
                          <SelectItem value="header-own" disabled className="font-semibold">
                            Fazendas Próprias
                          </SelectItem>
                          {ownFarms.map((farm) => (
                            <SelectItem key={`own-${farm.id}`} value={`own-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {thirdPartyFarms.length > 0 && (
                        <>
                          <SelectItem value="header-third" disabled className="font-semibold border-t mt-2 pt-2">
                            Fazendas Terceiras
                          </SelectItem>
                          {thirdPartyFarms.map((farm) => (
                            <SelectItem key={`third_party-${farm.id}`} value={`third_party-${farm.id}`}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Leilão</Label>
                  <Select
                    value={formData.auction_id}
                    onValueChange={(value) => setFormData({ ...formData, auction_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {auctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          {auction.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote Leilão</Label>
                  <Input
                    value={formData.auction_lot}
                    onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })}
                    disabled={modalMode === "view"}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="genealogia" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pai (Genitor)</Label>
                  <Select
                    value={formData.sire_id}
                    onValueChange={(value) => setFormData({ ...formData, sire_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sires.map((sire) => (
                        <SelectItem key={sire.id} value={sire.id}>
                          {sire.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mãe (Matriz)</Label>
                  <Select
                    value={formData.dam_id}
                    onValueChange={(value) => setFormData({ ...formData, dam_id: value })}
                    disabled={modalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dams.map((dam) => (
                        <SelectItem key={dam.id} value={dam.id}>
                          {dam.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Genealogy info display */}
              {(formData.sire_id || formData.dam_id) && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-4">Árvore Genealógica</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pai:</p>
                      <p className="font-medium">{getSireName(formData.sire_id) || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mãe:</p>
                      <p className="font-medium">{getDamName(formData.dam_id) || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="financeiro" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidade em desenvolvimento.
              </div>
            </TabsContent>

            <TabsContent value="proprietarios" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidade em desenvolvimento.
              </div>
            </TabsContent>
          </Tabs>

          {modalMode !== "view" && (
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro "{recordToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finalize Dialog */}
      <AlertDialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar registro</AlertDialogTitle>
            <AlertDialogDescription>
              Ao finalizar, um novo animal será criado no cadastro de animais com os dados deste registro de prenhez.
              <br />
              <br />
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisGestaoPrenhez;
