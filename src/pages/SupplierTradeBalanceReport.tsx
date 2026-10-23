import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Filter } from "lucide-react";

import { EntityCombobox } from "@/components/EntityCombobox";
import {
  SupplierTradeBalanceModal,
  type SupplierTradeBalanceSupplier,
} from "@/components/SupplierTradeBalanceModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccessibleStoreScope } from "@/lib/sales";
import type { SupplierTradeBalanceFilters } from "@/lib/supplierTradeBalance";
import { fetchAllPaginated } from "@/utils/supabasePagination";

const ALL_STORES = "all";

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

const SupplierTradeBalanceReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierTradeBalanceSupplier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [accessibleStoreIds, setAccessibleStoreIds] = useState<string[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [selectedStore, setSelectedStore] = useState<string>(ALL_STORES);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SupplierTradeBalanceFilters | null>(null);
  const [appliedSupplier, setAppliedSupplier] = useState<SupplierTradeBalanceSupplier | null>(null);
  const [appliedStoreLabel, setAppliedStoreLabel] = useState("");

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const { storeIds } = await fetchAccessibleStoreScope();
        setAccessibleStoreIds(storeIds);

        let storesQuery = supabase.from("stores").select("id, name, code").order("name");
        if (storeIds && storeIds.length > 0) {
          storesQuery = storesQuery.in("id", storeIds);
        }

        const [storesRes, supplierRows] = await Promise.all([
          storesQuery,
          // Mesmo cadastro para fornecedor e credor; inclui inativos para manter o histórico.
          fetchAllPaginated<SupplierTradeBalanceSupplier>(() =>
            supabase
              .from("suppliers")
              .select("id, name, cnpj_cpf, city, state")
              .or("is_supplier.eq.true,is_creditor.eq.true")
              .order("name")
              .order("id"),
          ),
        ]);

        if (storesRes.error) throw storesRes.error;
        setStores((storesRes.data || []) as StoreOption[]);
        setSuppliers(supplierRows);
      } catch (error) {
        console.error("Erro ao carregar filtros do relatório:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar fornecedores e fazendas.",
          variant: "destructive",
        });
      }
    };

    void loadOptions();
  }, [toast]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) || null,
    [suppliers, supplierId],
  );

  const storeLabel = useMemo(() => {
    if (selectedStore === ALL_STORES) return "Todas as fazendas";
    const store = stores.find((item) => item.id === selectedStore);
    return store ? `${store.code} - ${store.name}` : "Fazenda selecionada";
  }, [selectedStore, stores]);

  const generateReport = () => {
    if (!supplierId) {
      toast({
        title: "Selecione um fornecedor",
        description: "O fornecedor/credor é obrigatório para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      toast({
        title: "Período inválido",
        description: "A data inicial não pode ser maior que a data final.",
        variant: "destructive",
      });
      return;
    }

    setAppliedFilters({
      supplierId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      storeId: selectedStore === ALL_STORES ? null : selectedStore,
      accessibleStoreIds,
    });
    setAppliedSupplier(selectedSupplier);
    setAppliedStoreLabel(storeLabel);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center space-x-4 px-4 py-4">
          <Button onClick={() => navigate("/reports")} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-primary">Compras e Vendas por Fornecedor</h1>
            <p className="text-sm text-muted-foreground">
              Animais, prenhezes e aspirações comprados e vendidos por fornecedor/credor, com saldo
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Escolha o fornecedor/credor e, se quiser, o período e a fazenda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2 lg:col-span-1">
                <Label htmlFor="supplier">Fornecedor/Credor *</Label>
                <EntityCombobox
                  id="supplier"
                  items={suppliers}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  showAll={false}
                  placeholder="Selecionar fornecedor"
                  searchPlaceholder="Buscar fornecedor..."
                  emptyText="Nenhum fornecedor encontrado."
                />
              </div>

              <div className="grid grid-cols-2 gap-2 md:col-span-2 md:gap-4 lg:col-span-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="startDate">Data inicial</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="endDate">Data final</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store">Fazenda</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Selecione uma fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STORES}>Todas as fazendas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.code} - {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={generateReport} className="w-full sm:w-auto">
              <ArrowLeftRight className="h-4 w-4" />
              Gerar relatório
            </Button>
          </CardContent>
        </Card>
      </main>

      <SupplierTradeBalanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        supplier={appliedSupplier}
        filters={appliedFilters}
        storeLabel={appliedStoreLabel}
      />
    </div>
  );
};

export default SupplierTradeBalanceReport;
