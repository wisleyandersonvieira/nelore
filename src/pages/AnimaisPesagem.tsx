import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Search, X, Scale, Eye, Pencil, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Batch {
  id: string;
  name: string;
  code: number;
}

interface Animal {
  id: string;
  code: number;
  name: string;
  ear_tag: number | null;
  sex: string;
}

interface WeighingAnimal extends Animal {
  weight: string;
}

interface WeighingSession {
  id: string;
  date: string;
  weighing_type: string;
  observations: string | null;
  batch_id: string | null;
  created_at: string;
  animal_batches?: { name: string; code: number } | null;
  animal_count?: number;
  total_weight?: number;
}

interface WeighingRecord {
  id: string;
  animal_id: string;
  weight: number;
  animals: {
    id: string;
    code: number;
    name: string;
    ear_tag: number | null;
    sex: string;
  };
}

const ITEMS_PER_PAGE = 20;

const AnimaisPesagem = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<"form" | "animals">("form");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weighingType, setWeighingType] = useState<"lote" | "avulso" | "">("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [observations, setObservations] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [animals, setAnimals] = useState<WeighingAnimal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [searchAnimal, setSearchAnimal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessions, setSessions] = useState<WeighingSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAnimalSearchModalOpen, setIsAnimalSearchModalOpen] = useState(false);
  const [animalSearchFilter, setAnimalSearchFilter] = useState("");
  
  // Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterAnimalName, setFilterAnimalName] = useState("");
  const [filterBatchCode, setFilterBatchCode] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // View/Edit modal
  const [viewSession, setViewSession] = useState<WeighingSession | null>(null);
  const [viewRecords, setViewRecords] = useState<WeighingRecord[]>([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editAnimalSearchFilter, setEditAnimalSearchFilter] = useState("");
  const [isEditAnimalSearchModalOpen, setIsEditAnimalSearchModalOpen] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchAllAnimals();
    fetchSessions();
  }, []);

  const fetchBatches = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.store_id) return;

    const { data } = await supabase
      .from("animal_batches")
      .select("id, name, code")
      .eq("store_id", profile.store_id)
      .order("name");

    if (data) setBatches(data);
  };

  const fetchAllAnimals = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.store_id) return;

    const { data } = await supabase
      .from("animals")
      .select("id, code, name, ear_tag, sex")
      .eq("store_id", profile.store_id)
      .eq("is_active", true)
      .order("code");

    if (data) setAllAnimals(data);
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.store_id) {
      setIsLoadingSessions(false);
      return;
    }

    // Fetch sessions with stats in a single optimized query
    const { data: sessionsData } = await supabase
      .from("weighing_sessions")
      .select(`
        id,
        date,
        weighing_type,
        observations,
        batch_id,
        created_at,
        animal_batches (name, code)
      `)
      .eq("store_id", profile.store_id)
      .order("date", { ascending: true });

    if (sessionsData) {
      // Fetch all weighing records for all sessions in one query
      const sessionIds = sessionsData.map(s => s.id);
      
      const { data: allRecords } = await supabase
        .from("weighing_records")
        .select("session_id, weight")
        .in("session_id", sessionIds);

      // Group records by session
      const recordsBySession = (allRecords || []).reduce((acc, record) => {
        if (!acc[record.session_id]) {
          acc[record.session_id] = [];
        }
        acc[record.session_id].push(record);
        return acc;
      }, {} as Record<string, { weight: number }[]>);

      const sessionsWithStats = sessionsData.map((session) => {
        const records = recordsBySession[session.id] || [];
        return {
          ...session,
          animal_count: records.length,
          total_weight: records.reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
        };
      });

      setSessions(sessionsWithStats);
    }
    
    setIsLoadingSessions(false);
  };

  const handleViewSession = async (session: WeighingSession) => {
    setViewSession(session);
    setIsEditMode(false);

    const { data: records } = await supabase
      .from("weighing_records")
      .select(`
        id,
        animal_id,
        weight,
        animals (id, code, name, ear_tag, sex)
      `)
      .eq("session_id", session.id);

    if (records) {
      setViewRecords(records as WeighingRecord[]);
    }
    setIsViewModalOpen(true);
  };

  const handleEditSession = async (session: WeighingSession) => {
    setViewSession(session);
    setIsEditMode(true);

    const { data: records } = await supabase
      .from("weighing_records")
      .select(`
        id,
        animal_id,
        weight,
        animals (id, code, name, ear_tag, sex)
      `)
      .eq("session_id", session.id);

    if (records) {
      setViewRecords(records as WeighingRecord[]);
    }
    setIsViewModalOpen(true);
  };

  const handleUpdateWeights = async () => {
    if (!viewSession) return;

    setIsLoading(true);
    try {
      for (const record of viewRecords) {
        await supabase
          .from("weighing_records")
          .update({ weight: record.weight })
          .eq("id", record.id);
      }
      toast.success("Pesos atualizados com sucesso!");
      setIsViewModalOpen(false);
      fetchSessions();
    } catch (error: any) {
      toast.error("Erro ao atualizar pesos: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordWeightChange = (recordId: string, weight: string) => {
    setViewRecords(
      viewRecords.map((r) =>
        r.id === recordId ? { ...r, weight: parseFloat(weight) || 0 } : r
      )
    );
  };

  // Add new animal to existing session
  const handleAddAnimalToSession = async (animal: Animal, weight: string) => {
    if (!viewSession) return;
    
    const weightValue = parseFloat(weight);
    if (!weightValue || weightValue <= 0) {
      toast.error("Informe um peso válido");
      return;
    }

    setIsLoading(true);
    try {
      const { data: newRecord, error } = await supabase
        .from("weighing_records")
        .insert({
          session_id: viewSession.id,
          animal_id: animal.id,
          weight: weightValue,
        })
        .select(`
          id,
          animal_id,
          weight,
          animals (id, code, name, ear_tag, sex)
        `)
        .single();

      if (error) throw error;

      setViewRecords([...viewRecords, newRecord as WeighingRecord]);
      setIsEditAnimalSearchModalOpen(false);
      setEditAnimalSearchFilter("");
      toast.success("Animal adicionado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao adicionar animal: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter animals not already in session for edit modal
  const filteredAnimalsForEditModal = allAnimals.filter(
    (a) =>
      !viewRecords.some((r) => r.animal_id === a.id) &&
      (editAnimalSearchFilter === "" ||
        a.name.toLowerCase().includes(editAnimalSearchFilter.toLowerCase()) ||
        a.code.toString().includes(editAnimalSearchFilter) ||
        (a.ear_tag && a.ear_tag.toString().includes(editAnimalSearchFilter)))
  );

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    // Date filter
    if (filterStartDate && session.date < filterStartDate) return false;
    if (filterEndDate && session.date > filterEndDate) return false;

    // Batch filter
    if (filterBatchCode && session.animal_batches) {
      if (!session.animal_batches.code.toString().includes(filterBatchCode)) {
        return false;
      }
    } else if (filterBatchCode && !session.animal_batches) {
      return false;
    }

    return true;
  });

  // For animal name filter, we need async check but for simplicity, store filtered IDs
  const [animalFilteredSessionIds, setAnimalFilteredSessionIds] = useState<string[]>([]);

  useEffect(() => {
    const filterByAnimal = async () => {
      if (!filterAnimalName) {
        setAnimalFilteredSessionIds([]);
        return;
      }

      const { data: matchingAnimals } = await supabase
        .from("animals")
        .select("id")
        .ilike("name", `%${filterAnimalName}%`);

      if (!matchingAnimals || matchingAnimals.length === 0) {
        setAnimalFilteredSessionIds([]);
        return;
      }

      const animalIds = matchingAnimals.map((a) => a.id);

      const { data: records } = await supabase
        .from("weighing_records")
        .select("session_id")
        .in("animal_id", animalIds);

      if (records) {
        const sessionIds = [...new Set(records.map((r) => r.session_id))];
        setAnimalFilteredSessionIds(sessionIds);
      }
    };

    filterByAnimal();
  }, [filterAnimalName]);

  const displayedSessions = filterAnimalName
    ? filteredSessions.filter((s) => animalFilteredSessionIds.includes(s.id))
    : filteredSessions;

  // Pagination
  const totalPages = Math.ceil(displayedSessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = displayedSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, filterAnimalName, filterBatchCode]);

  const handleCreateSession = async () => {
    if (!date || !weighingType) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (weighingType === "lote" && !selectedBatchId) {
      toast.error("Selecione um lote");
      return;
    }

    setIsLoading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id, id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.store_id) {
        toast.error("Erro ao obter dados do usuário");
        return;
      }

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from("weighing_sessions")
        .insert({
          store_id: profile.store_id,
          date,
          weighing_type: weighingType,
          batch_id: weighingType === "lote" ? selectedBatchId : null,
          observations: observations || null,
          created_by: profile.id,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setSessionId(session.id);

      // If batch type, load animals from that batch
      if (weighingType === "lote") {
        const { data: batchAnimals } = await supabase
          .from("animals")
          .select("id, code, name, ear_tag, sex")
          .eq("batch_id", selectedBatchId)
          .eq("is_active", true)
          .order("code");

        if (batchAnimals) {
          setAnimals(batchAnimals.map((a) => ({ ...a, weight: "" })));
        }
      } else {
        setAnimals([]);
      }

      setStep("animals");
    } catch (error: any) {
      toast.error("Erro ao criar sessão de pesagem: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnimal = (animal: Animal) => {
    if (animals.some((a) => a.id === animal.id)) {
      toast.error("Animal já adicionado");
      return;
    }
    setAnimals([...animals, { ...animal, weight: "" }]);
    setSearchAnimal("");
  };

  const handleRemoveAnimal = (animalId: string) => {
    setAnimals(animals.filter((a) => a.id !== animalId));
  };

  const handleWeightChange = (animalId: string, weight: string) => {
    setAnimals(
      animals.map((a) => (a.id === animalId ? { ...a, weight } : a))
    );
  };

  const handleSave = async () => {
    if (!sessionId) return;

    const animalsWithWeight = animals.filter((a) => a.weight && parseFloat(a.weight) > 0);

    if (animalsWithWeight.length === 0) {
      toast.error("Insira o peso de pelo menos um animal");
      return;
    }

    setIsLoading(true);

    try {
      const records = animalsWithWeight.map((a) => ({
        session_id: sessionId,
        animal_id: a.id,
        weight: parseFloat(a.weight),
      }));

      const { error } = await supabase
        .from("weighing_records")
        .insert(records);

      if (error) throw error;

      toast.success("Pesagem salva com sucesso!");
      handleCloseModal();
      fetchSessions();
    } catch (error: any) {
      toast.error("Erro ao salvar pesagem: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setStep("form");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setWeighingType("");
    setSelectedBatchId("");
    setObservations("");
    setAnimals([]);
    setSessionId(null);
  };

  const filteredAnimals = allAnimals.filter(
    (a) =>
      !animals.some((added) => added.id === a.id) &&
      (a.name.toLowerCase().includes(searchAnimal.toLowerCase()) ||
        a.code.toString().includes(searchAnimal) ||
        (a.ear_tag && a.ear_tag.toString().includes(searchAnimal)))
  );

  const filteredAnimalsForModal = allAnimals.filter(
    (a) =>
      !animals.some((added) => added.id === a.id) &&
      (animalSearchFilter === "" ||
        a.name.toLowerCase().includes(animalSearchFilter.toLowerCase()) ||
        a.code.toString().includes(animalSearchFilter) ||
        (a.ear_tag && a.ear_tag.toString().includes(animalSearchFilter)))
  );

  const handleAddAnimalFromModal = (animal: Animal) => {
    if (animals.some((a) => a.id === animal.id)) {
      toast.error("Animal já adicionado");
      return;
    }
    setAnimals([...animals, { ...animal, weight: "" }]);
  };

  // State for adding animal with weight in edit modal
  const [newAnimalWeight, setNewAnimalWeight] = useState<Record<string, string>>({});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Pesagem de Animais</h1>
              <p className="text-sm text-muted-foreground">Controle de pesagem dos animais</p>
            </div>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Pesagem
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="filter-start-date">Data Inicial</Label>
                    <Input
                      id="filter-start-date"
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="filter-end-date">Data Final</Label>
                    <Input
                      id="filter-end-date"
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="filter-animal">Nome do Animal</Label>
                    <Input
                      id="filter-animal"
                      placeholder="Buscar por nome..."
                      value={filterAnimalName}
                      onChange={(e) => setFilterAnimalName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="filter-batch">Número do Lote</Label>
                    <Input
                      id="filter-batch"
                      placeholder="Código do lote..."
                      value={filterBatchCode}
                      onChange={(e) => setFilterBatchCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilterStartDate("");
                      setFilterEndDate("");
                      setFilterAnimalName("");
                      setFilterBatchCode("");
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Sessions Table */}
        {isLoadingSessions ? (
          <div className="text-center text-muted-foreground py-12">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Carregando pesagens...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pesagem cadastrada.</p>
            <p className="text-sm">Clique em "Cadastrar Pesagem" para começar.</p>
          </div>
        ) : displayedSessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pesagem encontrada com os filtros aplicados.</p>
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Data</TableHead>
                    <TableHead className="text-center py-2">Qtd. Animais</TableHead>
                    <TableHead className="text-right py-2">Peso Total (kg)</TableHead>
                    <TableHead className="py-2">Lote</TableHead>
                    <TableHead className="text-center py-2">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSessions.map((session) => (
                    <TableRow key={session.id} className="h-10">
                      <TableCell className="py-1.5">
                        {format(new Date(session.date + "T00:00:00"), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        {session.animal_count || 0}
                      </TableCell>
                      <TableCell className="text-right py-1.5">
                        {(session.total_weight || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {session.weighing_type === "lote" && session.animal_batches
                          ? `${session.animal_batches.code} - ${session.animal_batches.name}`
                          : "—"}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleViewSession(session)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditSession(session)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, displayedSessions.length)} de {displayedSessions.length} pesagens
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "form" ? "Nova Pesagem" : "Registrar Pesos"}
            </DialogTitle>
          </DialogHeader>

          {step === "form" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="weighing-type">Tipo de Pesagem *</Label>
                <Select
                  value={weighingType}
                  onValueChange={(value: "lote" | "avulso") => {
                    setWeighingType(value);
                    if (value === "avulso") setSelectedBatchId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lote">Lote</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {weighingType === "lote" && (
                <div>
                  <Label htmlFor="batch">Lote *</Label>
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o lote" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.code} - {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observações sobre a pesagem..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateSession} disabled={isLoading}>
                  {isLoading ? "Criando..." : "Criar Pesagem"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {weighingType === "avulso" && (
                <div>
                  <Label>Adicionar Animal</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Buscar por código, nome ou brinco..."
                        value={searchAnimal}
                        onChange={(e) => setSearchAnimal(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setAnimalSearchFilter("");
                        setIsAnimalSearchModalOpen(true);
                      }}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {searchAnimal && filteredAnimals.length > 0 && (
                    <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                      {filteredAnimals.slice(0, 10).map((animal) => (
                        <div
                          key={animal.id}
                          className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                          onClick={() => handleAddAnimal(animal)}
                        >
                          <span>
                            {animal.code} - {animal.name}
                            {animal.ear_tag && ` (Brinco: ${animal.ear_tag})`}
                          </span>
                          <Plus className="h-4 w-4" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Código</TableHead>
                      <TableHead className="py-2">Nome</TableHead>
                      <TableHead className="py-2">Brinco</TableHead>
                      <TableHead className="py-2">Sexo</TableHead>
                      <TableHead className="w-32 py-2">Peso (kg)</TableHead>
                      {weighingType === "avulso" && (
                        <TableHead className="w-12 py-2"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={weighingType === "avulso" ? 6 : 5}
                          className="text-center text-muted-foreground py-4"
                        >
                          {weighingType === "lote"
                            ? "Nenhum animal ativo neste lote"
                            : "Adicione animais para pesar"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      animals.map((animal) => (
                        <TableRow key={animal.id} className="h-10">
                          <TableCell className="py-1.5">{animal.code}</TableCell>
                          <TableCell className="py-1.5">{animal.name}</TableCell>
                          <TableCell className="py-1.5">{animal.ear_tag || "—"}</TableCell>
                          <TableCell className="py-1.5">
                            {animal.sex === "M" ? "Macho" : "Fêmea"}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={animal.weight}
                              onChange={(e) =>
                                handleWeightChange(animal.id, e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full h-8"
                            />
                          </TableCell>
                          {weighingType === "avulso" && (
                            <TableCell className="py-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRemoveAnimal(animal.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de busca de animais */}
      <Dialog open={isAnimalSearchModalOpen} onOpenChange={setIsAnimalSearchModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Selecionar Animais</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por código, nome ou brinco..."
                value={animalSearchFilter}
                onChange={(e) => setAnimalSearchFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2">Código</TableHead>
                  <TableHead className="py-2">Nome</TableHead>
                  <TableHead className="py-2">Brinco</TableHead>
                  <TableHead className="py-2">Sexo</TableHead>
                  <TableHead className="w-12 py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimalsForModal.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Nenhum animal encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnimalsForModal.map((animal) => (
                    <TableRow key={animal.id} className="h-10">
                      <TableCell className="py-1.5">{animal.code}</TableCell>
                      <TableCell className="py-1.5">{animal.name}</TableCell>
                      <TableCell className="py-1.5">{animal.ear_tag || "—"}</TableCell>
                      <TableCell className="py-1.5">{animal.sex === "M" ? "Macho" : "Fêmea"}</TableCell>
                      <TableCell className="py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleAddAnimalFromModal(animal)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setIsAnimalSearchModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de visualização/edição de pesagem */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Editar Pesagem" : "Visualizar Pesagem"}
              {viewSession && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  - {format(new Date(viewSession.date + "T00:00:00"), "dd/MM/yyyy")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewSession && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                <span>
                  <strong>Tipo:</strong>{" "}
                  {viewSession.weighing_type === "lote" ? "Lote" : "Avulso"}
                </span>
                {viewSession.weighing_type === "lote" && viewSession.animal_batches && (
                  <span>
                    <strong>Lote:</strong> {viewSession.animal_batches.code} -{" "}
                    {viewSession.animal_batches.name}
                  </span>
                )}
                {viewSession.observations && (
                  <span>
                    <strong>Obs:</strong> {viewSession.observations}
                  </span>
                )}
              </div>

              {/* Add animal button when in edit mode */}
              {isEditMode && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditAnimalSearchFilter("");
                      setNewAnimalWeight({});
                      setIsEditAnimalSearchModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Animal
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Código</TableHead>
                      <TableHead className="py-2">Nome</TableHead>
                      <TableHead className="py-2">Brinco</TableHead>
                      <TableHead className="py-2">Sexo</TableHead>
                      <TableHead className="w-32 text-right py-2">Peso (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                          Nenhum registro de peso encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      viewRecords.map((record) => (
                        <TableRow key={record.id} className="h-10">
                          <TableCell className="py-1.5">{record.animals.code}</TableCell>
                          <TableCell className="py-1.5">{record.animals.name}</TableCell>
                          <TableCell className="py-1.5">{record.animals.ear_tag || "—"}</TableCell>
                          <TableCell className="py-1.5">
                            {record.animals.sex === "M" ? "Macho" : "Fêmea"}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {isEditMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={record.weight}
                                onChange={(e) =>
                                  handleRecordWeightChange(record.id, e.target.value)
                                }
                                className="w-full text-right h-8"
                              />
                            ) : (
                              <span className="block text-right">
                                {record.weight.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <strong>Total:</strong>{" "}
                  {viewRecords
                    .reduce((sum, r) => sum + (Number(r.weight) || 0), 0)
                    .toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                  kg ({viewRecords.length} animais)
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                    {isEditMode ? "Cancelar" : "Fechar"}
                  </Button>
                  {isEditMode && (
                    <Button onClick={handleUpdateWeights} disabled={isLoading}>
                      {isLoading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de busca de animais para adicionar em edição */}
      <Dialog open={isEditAnimalSearchModalOpen} onOpenChange={setIsEditAnimalSearchModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Animal à Pesagem</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por código, nome ou brinco..."
                value={editAnimalSearchFilter}
                onChange={(e) => setEditAnimalSearchFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2">Código</TableHead>
                  <TableHead className="py-2">Nome</TableHead>
                  <TableHead className="py-2">Brinco</TableHead>
                  <TableHead className="py-2">Sexo</TableHead>
                  <TableHead className="w-24 py-2">Peso (kg)</TableHead>
                  <TableHead className="w-12 py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimalsForEditModal.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                      Nenhum animal encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnimalsForEditModal.map((animal) => (
                    <TableRow key={animal.id} className="h-10">
                      <TableCell className="py-1.5">{animal.code}</TableCell>
                      <TableCell className="py-1.5">{animal.name}</TableCell>
                      <TableCell className="py-1.5">{animal.ear_tag || "—"}</TableCell>
                      <TableCell className="py-1.5">{animal.sex === "M" ? "Macho" : "Fêmea"}</TableCell>
                      <TableCell className="py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newAnimalWeight[animal.id] || ""}
                          onChange={(e) => setNewAnimalWeight(prev => ({ ...prev, [animal.id]: e.target.value }))}
                          className="w-full h-8"
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleAddAnimalToSession(animal, newAnimalWeight[animal.id] || "")}
                          disabled={isLoading}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setIsEditAnimalSearchModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnimaisPesagem;
