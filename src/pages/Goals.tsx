import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Target, Plus, Pencil, Copy, Search, ArrowLeft } from "lucide-react";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface GoalData {
  month: number;
  goal_value: number;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const Goals = () => {
  const navigate = useNavigate();
  const { canEdit } = useCadastrosPermissions();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isReplicateMode, setIsReplicateMode] = useState(false);
  const [modalStore, setModalStore] = useState<string>("");
  const [modalYear, setModalYear] = useState<string>("");
  const [modalGoals, setModalGoals] = useState<number[]>(Array(12).fill(0));
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single();

    // Admin sees all stores
    if (profile?.role === 'admin') {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code")
        .order("name");

      if (error) {
        toast.error("Erro ao carregar lojas");
        return;
      }
      setStores(data || []);
      return;
    }

    // Non-admin: get user's linked stores
    const storeIds: string[] = [];
    if (profile?.store_id) storeIds.push(profile.store_id);

    const { data: userStores } = await supabase
      .from('user_stores')
      .select('store_id')
      .eq('user_id', user.id);

    userStores?.forEach(us => {
      if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
    });

    if (storeIds.length === 0) {
      setStores([]);
      return;
    }

    const { data, error } = await supabase
      .from("stores")
      .select("id, name, code")
      .in('id', storeIds)
      .order("name");

    if (error) {
      toast.error("Erro ao carregar lojas");
      return;
    }

    setStores(data || []);
  };

  const handleSearch = async () => {
    if (!selectedStore || !selectedYear) {
      toast.error("Selecione a loja e o ano para buscar");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("store_goals")
      .select("month, goal_value")
      .eq("store_id", selectedStore)
      .eq("year", parseInt(selectedYear))
      .order("month");

    setLoading(false);

    if (error) {
      toast.error("Erro ao buscar metas");
      return;
    }

    setGoals(data || []);
    setShowResults(true);
  };

  const handleOpenRegister = () => {
    setIsEditMode(false);
    setIsReplicateMode(false);
    setModalStore("");
    setModalYear("");
    setModalGoals(Array(12).fill(0));
    setIsRegisterModalOpen(true);
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setIsReplicateMode(false);
    setModalStore(selectedStore);
    setModalYear(selectedYear);
    const newGoals = Array(12).fill(0);
    goals.forEach((g) => {
      newGoals[g.month - 1] = g.goal_value;
    });
    setModalGoals(newGoals);
    setIsRegisterModalOpen(true);
  };

  const handleReplicate = () => {
    setIsEditMode(false);
    setIsReplicateMode(true);
    setModalStore(selectedStore);
    setModalYear("");
    const newGoals = Array(12).fill(0);
    goals.forEach((g) => {
      newGoals[g.month - 1] = g.goal_value;
    });
    setModalGoals(newGoals);
    setIsRegisterModalOpen(true);
  };

  const checkExistingGoals = async (storeId: string, year: number) => {
    const { data, error } = await supabase
      .from("store_goals")
      .select("id")
      .eq("store_id", storeId)
      .eq("year", year)
      .limit(1);

    if (error) {
      return false;
    }

    return (data?.length || 0) > 0;
  };

  const handleSaveGoals = async () => {
    if (!modalStore || !modalYear) {
      toast.error("Selecione a loja e o ano");
      return;
    }

    const yearNum = parseInt(modalYear);

    // Check if goals already exist (only for new registration)
    if (!isEditMode) {
      const exists = await checkExistingGoals(modalStore, yearNum);
      if (exists) {
        toast.error(
          "Já existem metas cadastradas para esta loja e ano. Busque o cadastro existente para editar."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // If editing, delete existing goals first
      if (isEditMode) {
        await supabase
          .from("store_goals")
          .delete()
          .eq("store_id", modalStore)
          .eq("year", yearNum);
      }

      // Insert new goals
      const goalsToInsert = modalGoals.map((value, index) => ({
        store_id: modalStore,
        year: yearNum,
        month: index + 1,
        goal_value: value || 0,
        created_by: userId,
      }));

      const { error } = await supabase.from("store_goals").insert(goalsToInsert);

      if (error) throw error;

      toast.success(
        isEditMode
          ? "Metas atualizadas com sucesso!"
          : isReplicateMode
          ? "Metas replicadas com sucesso!"
          : "Metas cadastradas com sucesso!"
      );

      setIsRegisterModalOpen(false);

      // Refresh the search if we were viewing results
      if (showResults && selectedStore === modalStore && selectedYear === modalYear) {
        handleSearch();
      } else if (isEditMode || (isReplicateMode && selectedStore === modalStore)) {
        setSelectedStore(modalStore);
        setSelectedYear(modalYear);
        setTimeout(() => handleSearch(), 100);
      }
    } catch (error: any) {
      toast.error("Erro ao salvar metas: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const parseCurrencyInput = (value: string) => {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const getStoreName = (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    return store ? `${store.code} - ${store.name}` : "";
  };

  const totalGoals = goals.reduce((sum, g) => sum + g.goal_value, 0);
  const modalTotalGoals = modalGoals.reduce((sum, g) => sum + g, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-primary">Metas de Faturamento</h1>
            </div>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie as metas de faturamento por loja</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Button - only show for users with edit permission */}
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={handleOpenRegister}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar
              </Button>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[200px]">
                  <Label>Loja</Label>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 sm:flex-none sm:w-[150px]">
                  <Label>Ano</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {showResults && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">
                    Metas - {getStoreName(selectedStore)} - {selectedYear}
                  </CardTitle>
                  {goals.length > 0 && canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleReplicate}>
                        <Copy className="h-4 w-4 mr-2" />
                        Replicar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {goals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma meta cadastrada para esta loja e ano.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MONTHS.map((month, index) => {
                        const goal = goals.find((g) => g.month === index + 1);
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{month}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(goal?.goal_value || 0)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total Anual</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totalGoals)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Register/Edit Modal */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode
                ? "Editar Metas"
                : isReplicateMode
                ? "Replicar Metas"
                : "Cadastrar Metas"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Loja</Label>
                <Select
                  value={modalStore}
                  onValueChange={setModalStore}
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.code} - {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select
                  value={modalYear}
                  onValueChange={setModalYear}
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modalStore && modalYear && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Meta (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MONTHS.map((month, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{month}</TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          value={modalGoals[index] || ""}
                          onChange={(e) => {
                            const newGoals = [...modalGoals];
                            newGoals[index] = parseCurrencyInput(e.target.value);
                            setModalGoals(newGoals);
                          }}
                          placeholder="0,00"
                          className="w-40"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total Anual</TableCell>
                    <TableCell>{formatCurrency(modalTotalGoals)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRegisterModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveGoals} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Goals;
