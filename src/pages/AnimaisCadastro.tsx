import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Plus, Eye, Pencil, Trash2, CalendarIcon, Upload, X, Image, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Animal {
  id: string;
  code: number;
  name: string;
  registration: string | null;
  ear_tag: number | null;
  batch_id: string | null;
  sex: string;
  farm_entry_date: string | null;
  birth_date: string | null;
  first_weighing_date: string | null;
  first_weight: number | null;
  breed_id: string | null;
  category_id: string | null;
  auction_id: string | null;
  auction_lot: string | null;
  sire_id: string | null;
  dam_id: string | null;
  observations: string | null;
  photos: string[];
  cover_photo: string | null;
  store_id: string;
  is_active: boolean;
}

interface Batch {
  id: string;
  name: string;
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

const AnimaisCadastro = () => {
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState<Animal | null>(null);
  const [activeTab, setActiveTab] = useState("dados");

  // Filter state
  const [filters, setFilters] = useState({
    name: "",
    status: "ambos",
    sex: "",
    breed_id: "",
    dam_id: "",
    sire_id: "",
    auction_id: "",
    category_id: "",
    birth_date_start: null as Date | null,
    birth_date_end: null as Date | null,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: 0,
    name: "",
    registration: "",
    ear_tag: "",
    batch_id: "",
    sex: "",
    farm_entry_date: null as Date | null,
    birth_date: null as Date | null,
    first_weighing_date: null as Date | null,
    first_weight: "",
    breed_id: "",
    category_id: "",
    auction_id: "",
    auction_lot: "",
    sire_id: "",
    dam_id: "",
    observations: "",
    photos: [] as string[],
    cover_photo: "",
    is_active: "ativo",
  });

  // Dropdown options
  const [batches, setBatches] = useState<Batch[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sires, setSires] = useState<BreedingAnimal[]>([]);
  const [dams, setDams] = useState<BreedingAnimal[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    fetchAnimals();
    fetchDropdownData();
  }, []);

  const fetchAnimals = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return;

      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("code", { ascending: true });

      if (error) throw error;
      setAnimals((data || []).map(a => ({ 
        ...a, 
        photos: Array.isArray(a.photos) ? a.photos as string[] : [] 
      })));
    } catch (error) {
      console.error("Error fetching animals:", error);
      toast({ title: "Erro ao carregar animais", variant: "destructive" });
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
      const [batchesRes, breedsRes, categoriesRes, auctionsRes, breedingAnimalsRes] = await Promise.all([
        supabase.from("animal_batches").select("id, name").eq("store_id", profile.store_id),
        supabase.from("animal_breeds").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("animal_categories").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("leiloes").select("id, name").eq("store_id", profile.store_id).eq("is_active", true),
        supabase.from("breeding_animals").select("id, name, sex, sire_id, dam_id").eq("store_id", profile.store_id).eq("is_active", true),
      ]);

      setBatches(batchesRes.data || []);
      setBreeds(breedsRes.data || []);
      setCategories(categoriesRes.data || []);
      setAuctions(auctionsRes.data || []);
      setSires((breedingAnimalsRes.data || []).filter(a => a.sex === "macho"));
      setDams((breedingAnimalsRes.data || []).filter(a => a.sex === "femea"));
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const getNextCode = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return 1;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) return 1;

      const { data, error } = await supabase.rpc("get_next_animal_code", {
        store_uuid: profile.store_id,
      });

      if (error) throw error;
      return data || 1;
    } catch (error) {
      console.error("Error getting next code:", error);
      return 1;
    }
  };

  const handleOpenModal = async (mode: "view" | "edit" | "create", animal?: Animal) => {
    setModalMode(mode);
    setActiveTab("dados");

    if (mode === "create") {
      const nextCode = await getNextCode();
      setFormData({
        code: nextCode,
        name: "",
        registration: "",
        ear_tag: "",
        batch_id: "",
        sex: "",
        farm_entry_date: null,
        birth_date: null,
        first_weighing_date: null,
        first_weight: "",
        breed_id: "",
        category_id: "",
        auction_id: "",
        auction_lot: "",
        sire_id: "",
        dam_id: "",
        observations: "",
        photos: [],
        cover_photo: "",
        is_active: "ativo",
      });
      setSelectedAnimal(null);
    } else if (animal) {
      setSelectedAnimal(animal);
      setFormData({
        code: animal.code,
        name: animal.name,
        registration: animal.registration || "",
        ear_tag: animal.ear_tag?.toString() || "",
        batch_id: animal.batch_id || "",
        sex: animal.sex,
        farm_entry_date: animal.farm_entry_date ? new Date(animal.farm_entry_date) : null,
        birth_date: animal.birth_date ? new Date(animal.birth_date) : null,
        first_weighing_date: animal.first_weighing_date ? new Date(animal.first_weighing_date) : null,
        first_weight: animal.first_weight?.toString() || "",
        breed_id: animal.breed_id || "",
        category_id: animal.category_id || "",
        auction_id: animal.auction_id || "",
        auction_lot: animal.auction_lot || "",
        sire_id: animal.sire_id || "",
        dam_id: animal.dam_id || "",
        observations: animal.observations || "",
        photos: animal.photos || [],
        cover_photo: animal.cover_photo || "",
        is_active: animal.is_active ? "ativo" : "inativo",
      });
    }

    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAnimal(null);
    setActiveTab("dados");
  };

  const handleUploadPhoto = async (file: File, isCover: boolean = false) => {
    try {
      if (isCover) setUploadingCover(true);
      else setUploadingPhoto(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${userData.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("animal-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("animal-photos")
        .getPublicUrl(fileName);

      if (isCover) {
        setFormData(prev => ({ ...prev, cover_photo: urlData.publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, photos: [...prev.photos, urlData.publicUrl] }));
      }

      toast({ title: "Foto enviada com sucesso!" });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      if (isCover) setUploadingCover(false);
      else setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p !== photoUrl),
    }));
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: "Nome é obrigatório", variant: "destructive" });
        return;
      }

      if (!formData.sex) {
        toast({ title: "Sexo é obrigatório", variant: "destructive" });
        return;
      }

      if (formData.auction_id && !formData.auction_lot.trim()) {
        toast({ title: "Lote é obrigatório quando Leilão está selecionado", variant: "destructive" });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) throw new Error("Store não encontrada");

      // Check for duplicate name
      const { data: existingAnimal } = await supabase
        .from("animals")
        .select("id")
        .eq("store_id", profile.store_id)
        .eq("name", formData.name.trim())
        .eq("is_active", true)
        .neq("id", selectedAnimal?.id || "00000000-0000-0000-0000-000000000000")
        .single();

      if (existingAnimal) {
        toast({ title: "Já existe um animal com este nome", variant: "destructive" });
        return;
      }

      const animalData = {
        name: formData.name.trim(),
        registration: formData.registration || null,
        ear_tag: formData.ear_tag ? parseInt(formData.ear_tag) : null,
        batch_id: formData.batch_id || null,
        sex: formData.sex,
        farm_entry_date: formData.farm_entry_date ? format(formData.farm_entry_date, "yyyy-MM-dd") : null,
        birth_date: formData.birth_date ? format(formData.birth_date, "yyyy-MM-dd") : null,
        first_weighing_date: formData.first_weighing_date ? format(formData.first_weighing_date, "yyyy-MM-dd") : null,
        first_weight: formData.first_weight ? parseFloat(formData.first_weight) : null,
        breed_id: formData.breed_id || null,
        category_id: formData.category_id || null,
        auction_id: formData.auction_id || null,
        auction_lot: formData.auction_lot || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        observations: formData.observations || null,
        photos: formData.photos,
        cover_photo: formData.cover_photo || null,
        store_id: profile.store_id,
        is_active: formData.is_active === "ativo",
      };

      if (modalMode === "create") {
        const { error } = await supabase.from("animals").insert({
          ...animalData,
          code: formData.code,
        });
        if (error) throw error;
        toast({ title: "Animal cadastrado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("animals")
          .update(animalData)
          .eq("id", selectedAnimal!.id);
        if (error) throw error;
        toast({ title: "Animal atualizado com sucesso!" });
      }

      handleCloseModal();
      fetchAnimals();
    } catch (error: any) {
      console.error("Error saving animal:", error);
      toast({ title: error.message || "Erro ao salvar animal", variant: "destructive" });
    }
  };

  const openDeleteDialog = (animal: Animal) => {
    setAnimalToDelete(animal);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!animalToDelete) return;

    try {
      const { error } = await supabase
        .from("animals")
        .update({ is_active: false })
        .eq("id", animalToDelete.id);

      if (error) throw error;

      toast({ title: "Animal excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setAnimalToDelete(null);
      fetchAnimals();
    } catch (error) {
      console.error("Error deleting animal:", error);
      toast({ title: "Erro ao excluir animal", variant: "destructive" });
    }
  };

  const DatePickerField = ({
    label,
    value,
    onChange,
    disabled = false,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | undefined) => void;
    disabled?: boolean;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
          <Calendar
            mode="single"
            selected={value || undefined}
            onSelect={onChange}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  const isReadOnly = modalMode === "view";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Cadastro de Animais</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de animais</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)} 
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? "Ocultar Filtros" : "Exibir Filtros"}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button onClick={() => handleOpenModal("create")} className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Animal
          </Button>
        </div>

        {/* Filters Section */}
        {showFilters && (
        <div className="bg-card border rounded-lg p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Name filter */}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                placeholder="Buscar por nome..."
              />
            </div>

            {/* Status filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sex filter */}
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select
                value={filters.sex || "_all"}
                onValueChange={(value) => setFilters({ ...filters, sex: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar sexo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Breed filter */}
            <div className="space-y-2">
              <Label>Raça</Label>
              <Select
                value={filters.breed_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, breed_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar raça" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {breeds.map((breed) => (
                    <SelectItem key={breed.id} value={breed.id}>
                      {breed.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dam filter */}
            <div className="space-y-2">
              <Label>Nome Mãe</Label>
              <Select
                value={filters.dam_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, dam_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar mãe" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {dams.map((dam) => (
                    <SelectItem key={dam.id} value={dam.id}>
                      {dam.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sire filter */}
            <div className="space-y-2">
              <Label>Nome Pai</Label>
              <Select
                value={filters.sire_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, sire_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar pai" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  {sires.map((sire) => (
                    <SelectItem key={sire.id} value={sire.id}>
                      {sire.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auction filter */}
            <div className="space-y-2">
              <Label>Leilão</Label>
              <Select
                value={filters.auction_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, auction_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar leilão" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todos</SelectItem>
                  {auctions.map((auction) => (
                    <SelectItem key={auction.id} value={auction.id}>
                      {auction.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={filters.category_id || "_all"}
                onValueChange={(value) => setFilters({ ...filters, category_id: value === "_all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="_all">Todas</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Birth date start */}
            <div className="space-y-2">
              <Label>Data Nasc. Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.birth_date_start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.birth_date_start
                      ? format(filters.birth_date_start, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.birth_date_start || undefined}
                    onSelect={(date) => setFilters({ ...filters, birth_date_start: date || null })}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Birth date end */}
            <div className="space-y-2">
              <Label>Data Nasc. Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.birth_date_end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.birth_date_end
                      ? format(filters.birth_date_end, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.birth_date_end || undefined}
                    onSelect={(date) => setFilters({ ...filters, birth_date_end: date || null })}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear filters button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setFilters({
                name: "",
                status: "ambos",
                sex: "",
                breed_id: "",
                dam_id: "",
                sire_id: "",
                auction_id: "",
                category_id: "",
                birth_date_start: null,
                birth_date_end: null,
              })}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
        )}

        {(() => {
          // Apply filters
          const filteredAnimals = animals.filter((animal) => {
            // Name filter
            if (filters.name && !animal.name.toLowerCase().includes(filters.name.toLowerCase())) {
              return false;
            }
            // Status filter
            if (filters.status === "ativo" && !animal.is_active) return false;
            if (filters.status === "inativo" && animal.is_active) return false;
            // Sex filter
            if (filters.sex && animal.sex !== filters.sex) return false;
            // Breed filter
            if (filters.breed_id && animal.breed_id !== filters.breed_id) return false;
            // Dam filter
            if (filters.dam_id && animal.dam_id !== filters.dam_id) return false;
            // Sire filter
            if (filters.sire_id && animal.sire_id !== filters.sire_id) return false;
            // Auction filter
            if (filters.auction_id && animal.auction_id !== filters.auction_id) return false;
            // Category filter
            if (filters.category_id && animal.category_id !== filters.category_id) return false;
            // Birth date range filter
            if (filters.birth_date_start && animal.birth_date) {
              const birthDate = new Date(animal.birth_date);
              if (birthDate < filters.birth_date_start) return false;
            }
            if (filters.birth_date_end && animal.birth_date) {
              const birthDate = new Date(animal.birth_date);
              if (birthDate > filters.birth_date_end) return false;
            }
            return true;
          });

          if (loading) {
            return <p className="text-center text-muted-foreground">Carregando...</p>;
          }
          
          if (animals.length === 0) {
            return <p className="text-center text-muted-foreground">Nenhum animal cadastrado.</p>;
          }
          
          if (filteredAnimals.length === 0) {
            return <p className="text-center text-muted-foreground">Nenhum animal encontrado com os filtros selecionados.</p>;
          }

          return (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Raça</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimals.map((animal) => (
                  <TableRow key={animal.id} className={!animal.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{animal.code}</TableCell>
                    <TableCell>
                      {animal.cover_photo ? (
                        <img
                          src={animal.cover_photo}
                          alt={animal.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{animal.name}</TableCell>
                    <TableCell>{animal.ear_tag || "-"}</TableCell>
                    <TableCell>{animal.sex === "macho" ? "Macho" : "Fêmea"}</TableCell>
                    <TableCell>
                      {breeds.find((b) => b.id === animal.breed_id)?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        animal.is_active 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      )}>
                        {animal.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal("view", animal)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal("edit", animal)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(animal)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          );
        })()}
      </main>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create"
                ? "Cadastrar Animal"
                : modalMode === "edit"
                ? "Editar Animal"
                : "Visualizar Animal"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
              <TabsTrigger value="observacoes">Observações e Fotos</TabsTrigger>
              <TabsTrigger value="financeiro" disabled>Financeiro</TabsTrigger>
              <TabsTrigger value="proprietarios" disabled>Proprietários</TabsTrigger>
            </TabsList>

            {/* Tab: Dados Cadastrais */}
            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={formData.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Nome do animal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registro</Label>
                  <Input
                    value={formData.registration}
                    onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número de registro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brinco</Label>
                  <Input
                    type="number"
                    value={formData.ear_tag}
                    onChange={(e) => setFormData({ ...formData, ear_tag: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número do brinco"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lote</Label>
                  <Select
                    value={formData.batch_id}
                    onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar lote" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sexo *</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({ ...formData, sex: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar sexo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="femea">Fêmea</SelectItem>
                      <SelectItem value="macho">Macho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data Entrada na Fazenda"
                  value={formData.farm_entry_date}
                  onChange={(date) => setFormData({ ...formData, farm_entry_date: date || null })}
                  disabled={isReadOnly}
                />
                <DatePickerField
                  label="Data Nascimento"
                  value={formData.birth_date}
                  onChange={(date) => setFormData({ ...formData, birth_date: date || null })}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data Primeira Pesagem"
                  value={formData.first_weighing_date}
                  onChange={(date) => setFormData({ ...formData, first_weighing_date: date || null })}
                  disabled={isReadOnly}
                />
                <div className="space-y-2">
                  <Label>Primeiro Peso (kg)</Label>
                  <Input
                    type="number"
                    value={formData.first_weight}
                    onChange={(e) => setFormData({ ...formData, first_weight: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Peso em kg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Raça</Label>
                  <Select
                    value={formData.breed_id}
                    onValueChange={(value) => setFormData({ ...formData, breed_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar raça" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {breeds.map((breed) => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Leilão</Label>
                  <Select
                    value={formData.auction_id}
                    onValueChange={(value) => setFormData({ ...formData, auction_id: value })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar leilão" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {auctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          {auction.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lote (Leilão) {formData.auction_id && "*"}</Label>
                  <Input
                    value={formData.auction_lot}
                    onChange={(e) => setFormData({ ...formData, auction_lot: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="Número do lote no leilão"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Genealogia */}
            <TabsContent value="genealogia" className="space-y-6 mt-4">
              {/* Pais */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Pais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Reprodutor (Pai)</Label>
                    <Select
                      value={formData.sire_id}
                      onValueChange={(value) => setFormData({ ...formData, sire_id: value })}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar reprodutor" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {sires.map((sire) => (
                          <SelectItem key={sire.id} value={sire.id}>
                            {sire.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Matriz (Mãe)</Label>
                    <Select
                      value={formData.dam_id}
                      onValueChange={(value) => setFormData({ ...formData, dam_id: value })}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar matriz" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {dams.map((dam) => (
                          <SelectItem key={dam.id} value={dam.id}>
                            {dam.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Avós - exibição somente leitura */}
              {(formData.sire_id || formData.dam_id) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Avós (somente exibição)</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Avós Paternos */}
                    {formData.sire_id && (() => {
                      const selectedSire = sires.find(s => s.id === formData.sire_id);
                      const sireGrandsire = selectedSire?.sire_id ? [...sires, ...dams].find(a => a.id === selectedSire.sire_id) : null;
                      const sireGranddam = selectedSire?.dam_id ? [...sires, ...dams].find(a => a.id === selectedSire.dam_id) : null;
                      
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Paternos (Pais do Reprodutor)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avô:</Label>
                              <span className="text-sm">{sireGrandsire?.name || "Não informado"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avó:</Label>
                              <span className="text-sm">{sireGranddam?.name || "Não informada"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Avós Maternos */}
                    {formData.dam_id && (() => {
                      const selectedDam = dams.find(d => d.id === formData.dam_id);
                      const damGrandsire = selectedDam?.sire_id ? [...sires, ...dams].find(a => a.id === selectedDam.sire_id) : null;
                      const damGranddam = selectedDam?.dam_id ? [...sires, ...dams].find(a => a.id === selectedDam.dam_id) : null;
                      
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm text-muted-foreground">Avós Maternos (Pais da Matriz)</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avô:</Label>
                              <span className="text-sm">{damGrandsire?.name || "Não informado"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">Avó:</Label>
                              <span className="text-sm">{damGranddam?.name || "Não informada"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Observações e Fotos */}
            <TabsContent value="observacoes" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Observações sobre o animal"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Foto de Capa</Label>
                {formData.cover_photo ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.cover_photo}
                      alt="Cover"
                      className="w-40 h-40 object-cover rounded border"
                    />
                    {!isReadOnly && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setFormData({ ...formData, cover_photo: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : !isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="cover-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPhoto(file, true);
                      }}
                    />
                    <label htmlFor="cover-upload">
                      <Button variant="outline" asChild disabled={uploadingCover}>
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingCover ? "Enviando..." : "Adicionar Foto de Capa"}
                        </span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma foto de capa</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fotos do Animal</Label>
                <div className="flex flex-wrap gap-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-24 h-24 object-cover rounded border"
                      />
                      {!isReadOnly && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-5 w-5"
                          onClick={() => handleRemovePhoto(photo)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="photos-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadPhoto(file, false);
                        }}
                      />
                      <label htmlFor="photos-upload">
                        <div className="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                          {uploadingPhoto ? (
                            <span className="text-xs text-muted-foreground">Enviando...</span>
                          ) : (
                            <Plus className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Financeiro (disabled) */}
            <TabsContent value="financeiro" className="mt-4">
              <p className="text-muted-foreground text-center py-8">
                Esta aba será configurada posteriormente.
              </p>
            </TabsContent>

            {/* Tab: Proprietários (disabled) */}
            <TabsContent value="proprietarios" className="mt-4">
              <p className="text-muted-foreground text-center py-8">
                Esta aba será configurada posteriormente.
              </p>
            </TabsContent>
          </Tabs>

          {!isReadOnly && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {modalMode === "create" ? "Cadastrar" : "Salvar"}
              </Button>
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
              Tem certeza que deseja excluir o animal "{animalToDelete?.name}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisCadastro;
