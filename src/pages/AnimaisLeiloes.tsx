import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Leilao {
  id: string;
  code: number;
  name: string;
  date: string;
  city: string;
  is_active: boolean;
}

const AnimaisLeiloes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leiloes, setLeiloes] = useState<Leilao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedLeilao, setSelectedLeilao] = useState<Leilao | null>(null);
  const [formData, setFormData] = useState({ name: "", city: "" });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateText, setDateText] = useState("");
  const [nextCode, setNextCode] = useState(1);

  useEffect(() => {
    fetchLeiloes();
  }, []);

  const getUserData = async (): Promise<{ storeId: string | null; matrixId: string | null }> => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return { storeId: null, matrixId: null };
    const { data: profile } = await supabase.from("profiles").select("store_id, matrix_id").eq("id", userId).maybeSingle();
    let storeId = profile?.store_id || null;
    if (!storeId) {
      const { data: userStores } = await supabase.from("user_stores").select("store_id").eq("user_id", userId).limit(1);
      storeId = userStores?.[0]?.store_id || null;
    }
    return { storeId, matrixId: profile?.matrix_id || null };
  };

  const fetchLeiloes = async () => {
    try {
      const storeId = await getStoreId();
      if (!storeId) return;

      const { data, error } = await supabase
        .from("leiloes")
        .select("*")
        .eq("store_id", storeId)
        .order("code", { ascending: true });

      if (error) throw error;
      setLeiloes(data || []);

      const { data: codeData } = await supabase.rpc("get_next_leilao_code", {
        store_uuid: storeId,
      });
      setNextCode(codeData || 1);
    } catch (error) {
      console.error("Erro ao buscar leilões:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateTextChange = (text: string) => {
    // Allow only digits and slashes, auto-format as dd/MM/yyyy
    const digits = text.replace(/\D/g, "").substring(0, 8);
    let formatted = "";
    if (digits.length > 0) formatted = digits.substring(0, 2);
    if (digits.length > 2) formatted += "/" + digits.substring(2, 4);
    if (digits.length > 4) formatted += "/" + digits.substring(4, 8);
    setDateText(formatted);

    if (digits.length === 8) {
      const day = parseInt(digits.substring(0, 2));
      const month = parseInt(digits.substring(2, 4)) - 1;
      const year = parseInt(digits.substring(4, 8));
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month) {
        setSelectedDate(d);
      } else {
        setSelectedDate(undefined);
      }
    } else {
      setSelectedDate(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setDateText(date ? format(date, "dd/MM/yyyy") : "");
  };

  const handleOpenModal = (mode: "create" | "edit" | "view", leilao?: Leilao) => {
    setModalMode(mode);
    if (leilao) {
      setSelectedLeilao(leilao);
      setFormData({ name: leilao.name, city: leilao.city });
      const d = new Date(leilao.date);
      setSelectedDate(d);
      setDateText(format(d, "dd/MM/yyyy"));
    } else {
      setSelectedLeilao(null);
      setFormData({ name: "", city: "" });
      setSelectedDate(undefined);
      setDateText("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const storeId = await getStoreId();
      if (!storeId) return;

      if (!formData.name.trim() || !selectedDate) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      if (modalMode === "create") {
        const { error } = await supabase.from("leiloes").insert({
          code: nextCode,
          name: formData.name.trim(),
          date: format(selectedDate, "yyyy-MM-dd"),
          city: formData.city.trim() || null,
          store_id: storeId,
        });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Leilão cadastrado com sucesso!" });
      } else if (modalMode === "edit" && selectedLeilao) {
        const { error } = await supabase
          .from("leiloes")
          .update({
            name: formData.name.trim(),
            date: format(selectedDate, "yyyy-MM-dd"),
            city: formData.city.trim() || null,
          })
          .eq("id", selectedLeilao.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Leilão atualizado com sucesso!" });
      }

      setIsModalOpen(false);
      fetchLeiloes();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar leilão.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (leilao: Leilao) => {
    // Check if there are linked animals
    const { count } = await supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("auction_id", leilao.id)
      .eq("is_active", true);

    if (count && count > 0) {
      toast({
        title: "Erro",
        description: `Não é possível excluir. Existem ${count} animal(is) vinculado(s) a este leilão.`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Deseja excluir o leilão "${leilao.name}"?`)) return;

    try {
      const { error } = await supabase.from("leiloes").delete().eq("id", leilao.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Leilão excluído com sucesso!" });
      fetchLeiloes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir leilão.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/animais/cadastros-gerais")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Leilões</h1>
        </div>

        <div className="mb-6">
          <Button onClick={() => handleOpenModal("create")} className="bg-purple-500 hover:bg-purple-600">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="py-1">
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-2">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : leiloes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-2">
                    Nenhum leilão cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                leiloes.map((leilao) => (
                  <TableRow key={leilao.id} className="py-1">
                    <TableCell className="py-1">{leilao.code}</TableCell>
                    <TableCell className="py-1">{leilao.name}</TableCell>
                    <TableCell className="py-1">
                      {format(new Date(leilao.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="py-1">{leilao.city}</TableCell>
                    <TableCell className="py-1">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal("view", leilao)}
                          className="h-7 w-7"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal("edit", leilao)}
                          className="h-7 w-7"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(leilao)}
                          className="h-7 w-7 text-destructive"
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

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {modalMode === "create" && "Cadastrar Leilão"}
                {modalMode === "edit" && "Editar Leilão"}
                {modalMode === "view" && "Visualizar Leilão"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {modalMode === "create" && (
                <div>
                  <Label>Código</Label>
                  <Input value={nextCode} disabled />
                </div>
              )}

              <div>
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={modalMode === "view"}
                  placeholder="Nome do leilão"
                />
              </div>

              <div>
                <Label>Data</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="dd/MM/yyyy"
                    value={dateText}
                    onChange={(e) => handleDateTextChange(e.target.value)}
                    disabled={modalMode === "view"}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" disabled={modalMode === "view"}>
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleCalendarSelect}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  disabled={modalMode === "view"}
                  placeholder="Cidade do leilão"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                {modalMode === "view" ? "Fechar" : "Cancelar"}
              </Button>
              {modalMode !== "view" && (
                <Button onClick={handleSave} className="bg-purple-500 hover:bg-purple-600">
                  Salvar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AnimaisLeiloes;
