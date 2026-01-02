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
import { ArrowLeft, Plus, Search, X, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

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
  animal_batches?: { name: string } | null;
}

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
  const [sessions, setSessions] = useState<WeighingSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAnimalSearchModalOpen, setIsAnimalSearchModalOpen] = useState(false);
  const [animalSearchFilter, setAnimalSearchFilter] = useState("");

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.store_id) return;

    const { data } = await supabase
      .from("weighing_sessions")
      .select(`
        id,
        date,
        weighing_type,
        observations,
        batch_id,
        created_at,
        animal_batches (name)
      `)
      .eq("store_id", profile.store_id)
      .order("date", { ascending: false });

    if (data) setSessions(data);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
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
        {sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pesagem cadastrada.</p>
            <p className="text-sm">Clique em "Cadastrar Pesagem" para começar.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>
                      {format(new Date(session.date + "T00:00:00"), "dd/MM/yyyy")}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {session.weighing_type === "lote"
                        ? `Lote: ${session.animal_batches?.name || "—"}`
                        : "Avulso"}
                    </span>
                  </CardTitle>
                </CardHeader>
                {session.observations && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{session.observations}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
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
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead className="w-32">Peso (kg)</TableHead>
                      {weighingType === "avulso" && (
                        <TableHead className="w-12"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={weighingType === "avulso" ? 6 : 5}
                          className="text-center text-muted-foreground"
                        >
                          {weighingType === "lote"
                            ? "Nenhum animal ativo neste lote"
                            : "Adicione animais para pesar"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      animals.map((animal) => (
                        <TableRow key={animal.id}>
                          <TableCell>{animal.code}</TableCell>
                          <TableCell>{animal.name}</TableCell>
                          <TableCell>{animal.ear_tag || "—"}</TableCell>
                          <TableCell>
                            {animal.sex === "M" ? "Macho" : "Fêmea"}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={animal.weight}
                              onChange={(e) =>
                                handleWeightChange(animal.id, e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full"
                            />
                          </TableCell>
                          {weighingType === "avulso" && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
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
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimalsForModal.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum animal encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnimalsForModal.map((animal) => (
                    <TableRow key={animal.id}>
                      <TableCell>{animal.code}</TableCell>
                      <TableCell>{animal.name}</TableCell>
                      <TableCell>{animal.ear_tag || "—"}</TableCell>
                      <TableCell>{animal.sex === "M" ? "Macho" : "Fêmea"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
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
    </div>
  );
};

export default AnimaisPesagem;
