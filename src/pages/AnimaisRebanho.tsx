import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Beef, Baby, Dna, Microscope, Search, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type HerdCategory = "animals" | "pregnancy" | "embryo_transfer" | "aspiration";

interface HerdSummary {
  animals: number;
  pregnancy: number;
  embryo_transfer: number;
  aspiration: number;
}

interface HerdRecord {
  id: string;
  category: HerdCategory;
  code: number | null;
  name: string;
  status: string | null;
  createdAt: string | null;
  birthDate: string | null;
  expectedDate: string | null;
  aspirationDate: string | null;
  transferDate: string | null;
  ultrasoundDate: string | null;
  embryoCount: number | null;
  auctionName: string | null;
  photoUrl: string | null;
  purchaseValue: number | null;
  revenueValue: number | null;
}

const ITEMS_PER_PAGE = 12;

const formatDateBR = (date?: string | null) => {
  if (!date) return "Não informado";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleDateString("pt-BR");
};

const formatCurrencyBR = (value: number | null) => {
  if (value === null) return "Não informado";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const categoryTitle: Record<HerdCategory, string> = {
  animals: "Animais",
  pregnancy: "Prenhez",
  embryo_transfer: "Pós-Transferência de Embrião",
  aspiration: "Aspirações",
};

const statusLabel = (status?: string | null) => {
  if (!status) return "Não informado";
  const labels: Record<string, string> = {
    in_progress: "Em andamento",
    pending: "Pendente",
    finalized: "Finalizado",
    finalized_empty: "Finalizado vazio",
    sold: "Vendido",
    active: "Ativo",
  };
  return labels[status] || status;
};

const getAnimalPhoto = (animal: any): string | null => {
  if (animal?.cover_photo) return animal.cover_photo;
  if (Array.isArray(animal?.photos) && typeof animal.photos[0] === "string") {
    return animal.photos[0];
  }
  return null;
};

const AnimaisRebanho = () => {
  const navigate = useNavigate();
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [summary, setSummary] = useState<HerdSummary>({
    animals: 0,
    pregnancy: 0,
    embryo_transfer: 0,
    aspiration: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeCategory, setActiveCategory] = useState<HerdCategory>("animals");
  const [detailsCache, setDetailsCache] = useState<Partial<Record<HerdCategory, HerdRecord[]>>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchUserStoreIds = async () => {
      setLoadingStores(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) {
          setStoreIds([]);
          return;
        }

        const [{ data: profile }, { data: userStores }] = await Promise.all([
          supabase
            .from("profiles")
            .select("store_id, matrix_id")
            .eq("id", userId)
            .maybeSingle(),
          supabase.from("user_stores").select("store_id").eq("user_id", userId),
        ]);

        const candidateStoreIds = new Set<string>();
        if (profile?.store_id) candidateStoreIds.add(profile.store_id);
        (userStores || []).forEach((us) => candidateStoreIds.add(us.store_id));

        if (profile?.matrix_id && candidateStoreIds.size > 0) {
          const { data: matrixStores } = await supabase
            .from("stores")
            .select("id")
            .eq("matrix_id", profile.matrix_id)
            .in("id", Array.from(candidateStoreIds));
          setStoreIds((matrixStores || []).map((s) => s.id));
        } else {
          setStoreIds(Array.from(candidateStoreIds));
        }
      } finally {
        setLoadingStores(false);
      }
    };

    fetchUserStoreIds();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      if (storeIds.length === 0) {
        setSummary({ animals: 0, pregnancy: 0, embryo_transfer: 0, aspiration: 0 });
        return;
      }

      setLoadingSummary(true);
      try {
        const [animalsRes, pregnancyRes, transferRes, aspirationRes] = await Promise.all([
          supabase
            .from("animals")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .in("store_id", storeIds),
          supabase
            .from("pregnancy_management")
            .select("id", { count: "exact", head: true })
            .in("store_id", storeIds),
          supabase
            .from("embryo_transfer_management")
            .select("id", { count: "exact", head: true })
            .in("store_id", storeIds),
          supabase
            .from("aspiration_management")
            .select("id", { count: "exact", head: true })
            .in("store_id", storeIds),
        ]);

        setSummary({
          animals: animalsRes.count || 0,
          pregnancy: pregnancyRes.count || 0,
          embryo_transfer: transferRes.count || 0,
          aspiration: aspirationRes.count || 0,
        });
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [storeIds]);

  const fetchFinancialByAllocation = async (
    allocationField: "animal_id" | "pregnancy_id" | "embryo_transfer_id" | "aspiration_id",
    ids: string[],
  ) => {
    const purchaseMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    if (ids.length === 0) return { purchaseMap, revenueMap };

    const [expenseAlloc, revenueAlloc] = await Promise.all([
      fetchAllPaginated(() =>
        supabase
          .from("accounts_payable_item_allocations")
          .select(`${allocationField}, accounts_payable_items!inner(total_price)`)
          .in(allocationField, ids),
      ),
      fetchAllPaginated(() =>
        supabase
          .from("accounts_receivable_item_allocations")
          .select(`${allocationField}, accounts_receivable_items!inner(total_price)`)
          .in(allocationField, ids),
      ),
    ]);

    (expenseAlloc || []).forEach((item: any) => {
      const refId = item?.[allocationField];
      if (!refId) return;
      const value = Number(item?.accounts_payable_items?.total_price || 0);
      purchaseMap.set(refId, (purchaseMap.get(refId) || 0) + value);
    });

    (revenueAlloc || []).forEach((item: any) => {
      const refId = item?.[allocationField];
      if (!refId) return;
      const value = Number(item?.accounts_receivable_items?.total_price || 0);
      revenueMap.set(refId, (revenueMap.get(refId) || 0) + value);
    });

    return { purchaseMap, revenueMap };
  };

  const fetchAuctionsMap = async (auctionIds: string[]) => {
    if (auctionIds.length === 0) return new Map<string, string>();
    const { data: auctions } = await supabase.from("leiloes").select("id, name").in("id", auctionIds);
    const map = new Map<string, string>();
    (auctions || []).forEach((auction) => map.set(auction.id, auction.name));
    return map;
  };

  const loadDetails = async (category: HerdCategory) => {
    if (storeIds.length === 0) return;
    if (detailsCache[category]) return;

    setLoadingDetails(true);
    try {
      if (category === "animals") {
        const animals = await fetchAllPaginated(() =>
          supabase
            .from("animals")
            .select("id, code, name, birth_date, created_at, auction_id, cover_photo, photos")
            .eq("is_active", true)
            .in("store_id", storeIds)
            .order("created_at", { ascending: false }),
        );

        const ids = (animals || []).map((a: any) => a.id);
        const auctionIds = Array.from(
          new Set((animals || []).map((a: any) => a.auction_id).filter(Boolean)),
        ) as string[];
        const [auctionMap, finance] = await Promise.all([
          fetchAuctionsMap(auctionIds),
          fetchFinancialByAllocation("animal_id", ids),
        ]);

        const records: HerdRecord[] = (animals || []).map((animal: any) => ({
          id: animal.id,
          category,
          code: animal.code || null,
          name: animal.name || "Sem nome",
          status: "active",
          createdAt: animal.created_at || null,
          birthDate: animal.birth_date || null,
          expectedDate: null,
          aspirationDate: null,
          transferDate: null,
          ultrasoundDate: null,
          embryoCount: null,
          auctionName: animal.auction_id ? auctionMap.get(animal.auction_id) || null : null,
          photoUrl: getAnimalPhoto(animal),
          purchaseValue: finance.purchaseMap.has(animal.id) ? finance.purchaseMap.get(animal.id)! : null,
          revenueValue: finance.revenueMap.has(animal.id) ? finance.revenueMap.get(animal.id)! : null,
        }));

        setDetailsCache((prev) => ({ ...prev, animals: records }));
      }

      if (category === "pregnancy") {
        const recordsDb = await fetchAllPaginated(() =>
          supabase
            .from("pregnancy_management")
            .select(
              "id, code, name, status, expected_birth_month, transfer_date, ultrasound_date, created_at, auction_id",
            )
            .in("store_id", storeIds)
            .order("created_at", { ascending: false }),
        );

        const ids = (recordsDb || []).map((r: any) => r.id);
        const auctionIds = Array.from(
          new Set((recordsDb || []).map((r: any) => r.auction_id).filter(Boolean)),
        ) as string[];
        const [auctionMap, finance] = await Promise.all([
          fetchAuctionsMap(auctionIds),
          fetchFinancialByAllocation("pregnancy_id", ids),
        ]);

        const records: HerdRecord[] = (recordsDb || []).map((record: any) => ({
          id: record.id,
          category,
          code: record.code || null,
          name: record.name || "Sem nome",
          status: record.status || null,
          createdAt: record.created_at || null,
          birthDate: null,
          expectedDate: record.expected_birth_month || null,
          aspirationDate: null,
          transferDate: record.transfer_date || null,
          ultrasoundDate: record.ultrasound_date || null,
          embryoCount: null,
          auctionName: record.auction_id ? auctionMap.get(record.auction_id) || null : null,
          photoUrl: null,
          purchaseValue: finance.purchaseMap.has(record.id) ? finance.purchaseMap.get(record.id)! : null,
          revenueValue: finance.revenueMap.has(record.id) ? finance.revenueMap.get(record.id)! : null,
        }));

        setDetailsCache((prev) => ({ ...prev, pregnancy: records }));
      }

      if (category === "embryo_transfer") {
        const recordsDb = await fetchAllPaginated(() =>
          supabase
            .from("embryo_transfer_management")
            .select(
              "id, code, name, status, aspiration_date, transfer_date, ultrasound_date, created_at, auction_id",
            )
            .in("store_id", storeIds)
            .order("created_at", { ascending: false }),
        );

        const ids = (recordsDb || []).map((r: any) => r.id);
        const auctionIds = Array.from(
          new Set((recordsDb || []).map((r: any) => r.auction_id).filter(Boolean)),
        ) as string[];
        const [auctionMap, finance] = await Promise.all([
          fetchAuctionsMap(auctionIds),
          fetchFinancialByAllocation("embryo_transfer_id", ids),
        ]);

        const records: HerdRecord[] = (recordsDb || []).map((record: any) => ({
          id: record.id,
          category,
          code: record.code || null,
          name: record.name || "Sem nome",
          status: record.status || null,
          createdAt: record.created_at || null,
          birthDate: null,
          expectedDate: null,
          aspirationDate: record.aspiration_date || null,
          transferDate: record.transfer_date || null,
          ultrasoundDate: record.ultrasound_date || null,
          embryoCount: null,
          auctionName: record.auction_id ? auctionMap.get(record.auction_id) || null : null,
          photoUrl: null,
          purchaseValue: finance.purchaseMap.has(record.id) ? finance.purchaseMap.get(record.id)! : null,
          revenueValue: finance.revenueMap.has(record.id) ? finance.revenueMap.get(record.id)! : null,
        }));

        setDetailsCache((prev) => ({ ...prev, embryo_transfer: records }));
      }

      if (category === "aspiration") {
        const recordsDb = await fetchAllPaginated(() =>
          supabase
            .from("aspiration_management")
            .select(
              "id, code, name, status, expected_aspiration_month, aspiration_date, transfer_date, embryo_count, created_at, auction_id",
            )
            .in("store_id", storeIds)
            .order("created_at", { ascending: false }),
        );

        const ids = (recordsDb || []).map((r: any) => r.id);
        const auctionIds = Array.from(
          new Set((recordsDb || []).map((r: any) => r.auction_id).filter(Boolean)),
        ) as string[];
        const [auctionMap, finance] = await Promise.all([
          fetchAuctionsMap(auctionIds),
          fetchFinancialByAllocation("aspiration_id", ids),
        ]);

        const records: HerdRecord[] = (recordsDb || []).map((record: any) => ({
          id: record.id,
          category,
          code: record.code || null,
          name: record.name || "Sem nome",
          status: record.status || null,
          createdAt: record.created_at || null,
          birthDate: null,
          expectedDate: record.expected_aspiration_month || null,
          aspirationDate: record.aspiration_date || null,
          transferDate: record.transfer_date || null,
          ultrasoundDate: null,
          embryoCount: record.embryo_count ?? null,
          auctionName: record.auction_id ? auctionMap.get(record.auction_id) || null : null,
          photoUrl: null,
          purchaseValue: finance.purchaseMap.has(record.id) ? finance.purchaseMap.get(record.id)! : null,
          revenueValue: finance.revenueMap.has(record.id) ? finance.revenueMap.get(record.id)! : null,
        }));

        setDetailsCache((prev) => ({ ...prev, aspiration: records }));
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (storeIds.length > 0) {
      loadDetails(activeCategory);
    }
  }, [activeCategory, storeIds]);

  const activeRecords = detailsCache[activeCategory] || [];

  const filteredAndSorted = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = activeRecords.filter((record) => {
      if (!term) return true;
      const content = [
        record.name,
        String(record.code || ""),
        record.auctionName || "",
        record.status || "",
      ]
        .join(" ")
        .toLowerCase();
      return content.includes(term);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "code_desc") return (b.code || 0) - (a.code || 0);
      if (sortBy === "purchase_desc") return (b.purchaseValue || 0) - (a.purchaseValue || 0);
      if (sortBy === "revenue_desc") return (b.revenueValue || 0) - (a.revenueValue || 0);
      if (sortBy === "oldest") {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aDate - bDate;
      }
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    return sorted;
  }, [activeRecords, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = filteredAndSorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [activeCategory, search, sortBy]);

  const summaryCards = [
    {
      key: "animals" as HerdCategory,
      title: "Animais",
      value: summary.animals,
      icon: Beef,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      key: "pregnancy" as HerdCategory,
      title: "Prenhez",
      value: summary.pregnancy,
      icon: Baby,
      color: "text-sky-700",
      bg: "bg-sky-50",
      border: "border-sky-200",
    },
    {
      key: "embryo_transfer" as HerdCategory,
      title: "Pós-Transferência",
      value: summary.embryo_transfer,
      icon: Dna,
      color: "text-violet-700",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
    {
      key: "aspiration" as HerdCategory,
      title: "Aspirações",
      value: summary.aspiration,
      icon: Microscope,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rebanho</h1>
            <p className="text-sm text-slate-600">Visão consolidada do módulo de animais</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((item) => {
            const Icon = item.icon;
            const isActive = activeCategory === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveCategory(item.key)}
                className={cn(
                  "text-left rounded-2xl border p-4 transition-all",
                  "hover:shadow-md hover:-translate-y-0.5",
                  item.bg,
                  item.border,
                  isActive && "ring-2 ring-offset-2 ring-slate-400",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{item.title}</p>
                    <p className={cn("text-3xl font-bold mt-1", item.color)}>
                      {loadingSummary || loadingStores ? "..." : item.value}
                    </p>
                  </div>
                  <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center bg-white/70", item.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900">Detalhamento: {categoryTitle[activeCategory]}</CardTitle>
            <CardDescription>
              Clique em um card superior para alternar a categoria. Apenas uma categoria fica ativa por vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="herd-search">Busca</Label>
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="herd-search"
                    placeholder="Buscar por nome, código, status ou leilão"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ordenação</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigos</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                    <SelectItem value="code_desc">Maior código</SelectItem>
                    <SelectItem value="purchase_desc">Maior valor de compra</SelectItem>
                    <SelectItem value="revenue_desc">Maior valor de faturamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingDetails || loadingStores ? (
              <div className="py-10 text-center text-slate-500">Carregando registros...</div>
            ) : pagedRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-500">Nenhum registro encontrado</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pagedRecords.map((record) => (
                  <Card key={`${record.category}-${record.id}`} className="border-slate-200 bg-white">
                    <CardContent className="p-4 space-y-3">
                      {record.category === "animals" && (
                        <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                          {record.photoUrl ? (
                            <img
                              src={record.photoUrl}
                              alt={record.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-slate-400 flex flex-col items-center gap-1">
                              <ImageOff className="h-6 w-6" />
                              <span className="text-xs">Sem foto</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{record.name}</p>
                          <p className="text-xs text-slate-500">
                            Código: {record.code ?? "Não informado"}
                          </p>
                        </div>
                        <Badge variant="outline">{statusLabel(record.status)}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {record.category === "animals" && (
                          <>
                            <div>
                              <p className="text-slate-500 text-xs">Nascimento</p>
                              <p className="font-medium">{formatDateBR(record.birthDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Leilão</p>
                              <p className="font-medium truncate">{record.auctionName || "Não informado"}</p>
                            </div>
                          </>
                        )}

                        {record.category === "pregnancy" && (
                          <>
                            <div>
                              <p className="text-slate-500 text-xs">Parto previsto</p>
                              <p className="font-medium">{formatDateBR(record.expectedDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Transferência</p>
                              <p className="font-medium">{formatDateBR(record.transferDate)}</p>
                            </div>
                          </>
                        )}

                        {record.category === "embryo_transfer" && (
                          <>
                            <div>
                              <p className="text-slate-500 text-xs">Aspiração</p>
                              <p className="font-medium">{formatDateBR(record.aspirationDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Transferência</p>
                              <p className="font-medium">{formatDateBR(record.transferDate)}</p>
                            </div>
                          </>
                        )}

                        {record.category === "aspiration" && (
                          <>
                            <div>
                              <p className="text-slate-500 text-xs">Aspiração prevista</p>
                              <p className="font-medium">{formatDateBR(record.expectedDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Embriões</p>
                              <p className="font-medium">{record.embryoCount ?? "Não informado"}</p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Valor da compra</p>
                          <p className="font-semibold text-rose-700">{formatCurrencyBR(record.purchaseValue)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Valor de faturamento</p>
                          <p className="font-semibold text-emerald-700">{formatCurrencyBR(record.revenueValue)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Exibindo {pagedRecords.length} de {filteredAndSorted.length} registro(s)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AnimaisRebanho;
