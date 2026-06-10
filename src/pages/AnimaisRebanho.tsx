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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Beef, Baby, Dna, Microscope, Search, ImageOff, ExternalLink, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";

type HerdCategory = "animals" | "pregnancy" | "embryo_transfer" | "aspiration" | "recipient";

type AllocationField = "animal_id" | "pregnancy_id" | "embryo_transfer_id" | "aspiration_id" | "recipient_id";

interface HerdSummary {
  animals: number;
  pregnancy: number;
  embryo_transfer: number;
  aspiration: number;
  recipient: number;
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
  farmName: string | null;
  batchName: string | null;
}

interface DetailSectionItem {
  label: string;
  value: string;
}

interface DetailSection {
  title: string;
  items: DetailSectionItem[];
}

interface DetailFinanceItem {
  id: string;
  recordType: "expense" | "revenue";
  allocationType: string;
  documentNumber: string | null;
  status: string | null;
  dueDate: string | null;
  paymentDate: string | null;
  partnerName: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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

const formatText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Não informado";
  return String(value);
};

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) return "Não informado";
  return value ? "Sim" : "Não";
};

const categoryTitle: Record<HerdCategory, string> = {
  animals: "Animais",
  pregnancy: "Prenhez",
  embryo_transfer: "Pós-Transferência de Embrião",
  aspiration: "Aspirações",
  recipient: "Receptoras",
};

const categoryModuleRoute: Record<HerdCategory, string> = {
  animals: "/animais/cadastro",
  pregnancy: "/animais/prenhez",
  embryo_transfer: "/animais/transferencia-embriao",
  aspiration: "/animais/aspiracoes",
  recipient: "/animais/receptoras",
};

const allocationFieldByCategory: Record<HerdCategory, AllocationField> = {
  animals: "animal_id",
  pregnancy: "pregnancy_id",
  embryo_transfer: "embryo_transfer_id",
  aspiration: "aspiration_id",
  recipient: "recipient_id",
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
    inactive: "Inativo",
    paid: "Pago",
    partial: "Parcial",
  };
  return labels[status] || status;
};

const getAllocationTypeLabel = (type: string) => {
  switch (type) {
    case "animal":
      return "Animal";
    case "pregnancy":
      return "Prenhez";
    case "embryo_transfer":
      return "Pós-Transferência";
    case "aspiration":
      return "Aspiração";
    case "recipient":
      return "Receptora";
    case "aspiration_rateio":
      return "Rateio Aspiração";
    case "te_rateio":
      return "Rateio Pós TE";
    case "pregnancy_rateio":
      return "Rateio Prenhez";
    default:
      return type;
  }
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
    recipient: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeCategory, setActiveCategory] = useState<HerdCategory>("animals");
  const [detailsCache, setDetailsCache] = useState<Partial<Record<HerdCategory, HerdRecord[]>>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<HerdRecord | null>(null);
  const [detailSections, setDetailSections] = useState<DetailSection[]>([]);
  const [detailExpenses, setDetailExpenses] = useState<DetailFinanceItem[]>([]);
  const [detailRevenues, setDetailRevenues] = useState<DetailFinanceItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

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
        setSummary({ animals: 0, pregnancy: 0, embryo_transfer: 0, aspiration: 0, recipient: 0 });
        return;
      }

      setLoadingSummary(true);
      try {
        const recipientCategoryIds = await fetchRecipientCategoryIds({ storeIds });
        const animalsBaseQuery = supabase
          .from("animals")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .in("store_id", storeIds);

        const [animalsRes, pregnancyRes, transferRes, aspirationRes, recipientRes] = await Promise.all([
          recipientCategoryIds.length > 0
            ? animalsBaseQuery.not("category_id", "in", `("${recipientCategoryIds.join('","')}")`)
            : animalsBaseQuery,
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
          recipientCategoryIds.length > 0
            ? supabase
                .from("animals")
                .select("id", { count: "exact", head: true })
                .eq("is_active", true)
                .in("store_id", storeIds)
                .in("category_id", recipientCategoryIds)
            : Promise.resolve({ count: 0 }),
        ]);

        setSummary({
          animals: animalsRes.count || 0,
          pregnancy: pregnancyRes.count || 0,
          embryo_transfer: transferRes.count || 0,
          aspiration: aspirationRes.count || 0,
          recipient: recipientRes.count || 0,
        });
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [storeIds]);

  const fetchFinancialByAllocation = async (allocationField: AllocationField, ids: string[]) => {
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

  const fetchRecipientFinancial = async (ids: string[]) => {
    const purchaseMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    if (ids.length === 0) return { purchaseMap, revenueMap };

    const [expenseByAnimal, expenseByRecipient, revenueByAnimal, revenueByRecipient] = await Promise.all([
      fetchAllPaginated(() =>
        supabase
          .from("accounts_payable_item_allocations")
          .select("animal_id, accounts_payable_items!inner(total_price)")
          .in("animal_id", ids),
      ),
      fetchAllPaginated(() =>
        supabase
          .from("accounts_payable_item_allocations")
          .select("recipient_id, accounts_payable_items!inner(total_price)")
          .in("recipient_id", ids),
      ),
      fetchAllPaginated(() =>
        supabase
          .from("accounts_receivable_item_allocations")
          .select("animal_id, accounts_receivable_items!inner(total_price)")
          .in("animal_id", ids),
      ),
      fetchAllPaginated(() =>
        supabase
          .from("accounts_receivable_item_allocations")
          .select("recipient_id, accounts_receivable_items!inner(total_price)")
          .in("recipient_id", ids),
      ),
    ]);

    [...(expenseByAnimal || []), ...(expenseByRecipient || [])].forEach((item: any) => {
      const refId = item?.recipient_id || item?.animal_id;
      if (!refId) return;
      const value = Number(item?.accounts_payable_items?.total_price || 0);
      purchaseMap.set(refId, (purchaseMap.get(refId) || 0) + value);
    });

    [...(revenueByAnimal || []), ...(revenueByRecipient || [])].forEach((item: any) => {
      const refId = item?.recipient_id || item?.animal_id;
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

  const fetchSimpleMap = async (table: string, ids: string[]) => {
    const validIds = Array.from(new Set(ids.filter(Boolean)));
    if (validIds.length === 0) return new Map<string, string>();
    const { data } = await supabase.from(table as any).select("id, name").in("id", validIds);
    const map = new Map<string, string>();
    (data || []).forEach((item: any) => map.set(item.id, item.name));
    return map;
  };

  const fetchFarmMap = async (records: Array<{ farm_type: string | null; farm_id: string | null }>) => {
    const ownIds = Array.from(
      new Set(records.filter((record) => record.farm_id && record.farm_type !== "third_party").map((record) => record.farm_id!)),
    );
    const thirdPartyIds = Array.from(
      new Set(records.filter((record) => record.farm_id && record.farm_type === "third_party").map((record) => record.farm_id!)),
    );

    const [ownFarms, thirdPartyFarms] = await Promise.all([
      ownIds.length > 0
        ? supabase.from("stores").select("id, name").in("id", ownIds)
        : Promise.resolve({ data: [] as any[] }),
      thirdPartyIds.length > 0
        ? supabase.from("third_party_farms").select("id, name").in("id", thirdPartyIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const map = new Map<string, string>();
    (ownFarms.data || []).forEach((farm: any) => map.set(`own-${farm.id}`, farm.name));
    (thirdPartyFarms.data || []).forEach((farm: any) => map.set(`third-${farm.id}`, farm.name));
    return map;
  };

  const loadDetails = async (category: HerdCategory) => {
    if (storeIds.length === 0) return;
    if (detailsCache[category]) return;

    setLoadingDetails(true);
    try {
      if (category === "animals") {
        const recipientCategoryIds = await fetchRecipientCategoryIds({ storeIds });
        const animals = await fetchAllPaginated(() =>
          (recipientCategoryIds.length > 0
            ? supabase
                .from("animals")
                .select("id, code, name, birth_date, created_at, auction_id, cover_photo, photos")
                .eq("is_active", true)
                .in("store_id", storeIds)
                .not("category_id", "in", `("${recipientCategoryIds.join('","')}")`)
                .order("created_at", { ascending: false })
            : supabase
                .from("animals")
                .select("id, code, name, birth_date, created_at, auction_id, cover_photo, photos")
                .eq("is_active", true)
                .in("store_id", storeIds)
                .order("created_at", { ascending: false })),
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
          farmName: null,
          batchName: null,
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
          farmName: null,
          batchName: null,
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
          farmName: null,
          batchName: null,
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
          farmName: null,
          batchName: null,
        }));

        setDetailsCache((prev) => ({ ...prev, aspiration: records }));
      }

      if (category === "recipient") {
        const recipientCategoryIds = await fetchRecipientCategoryIds({ storeIds });
        if (recipientCategoryIds.length === 0) {
          setDetailsCache((prev) => ({ ...prev, recipient: [] }));
        } else {
          const recipientDb = await fetchAllPaginated(() =>
            supabase
              .from("animals")
              .select("id, code, name, birth_date, created_at, batch_id, is_active, cover_photo, photos, farm_type, farm_id")
              .eq("is_active", true)
              .in("store_id", storeIds)
              .in("category_id", recipientCategoryIds)
              .order("created_at", { ascending: false }),
          );

          const ids = (recipientDb || []).map((record: any) => record.id);
          const batchIds = Array.from(
            new Set((recipientDb || []).map((record: any) => record.batch_id).filter(Boolean)),
          ) as string[];
          const [batchMap, farmMap, finance] = await Promise.all([
            fetchSimpleMap("animal_batches", batchIds),
            fetchFarmMap(recipientDb || []),
            fetchRecipientFinancial(ids),
          ]);

          const records: HerdRecord[] = (recipientDb || []).map((record: any) => ({
            id: record.id,
            category,
            code: record.code || null,
            name: record.name || "Sem nome",
            status: record.is_active ? "active" : "inactive",
            createdAt: record.created_at || null,
            birthDate: record.birth_date || null,
            expectedDate: null,
            aspirationDate: null,
            transferDate: null,
            ultrasoundDate: null,
            embryoCount: null,
            auctionName: null,
            photoUrl: getAnimalPhoto(record),
            purchaseValue: finance.purchaseMap.has(record.id) ? finance.purchaseMap.get(record.id)! : null,
            revenueValue: finance.revenueMap.has(record.id) ? finance.revenueMap.get(record.id)! : null,
            farmName: record.farm_id ? farmMap.get(`${record.farm_type === "third_party" ? "third" : "own"}-${record.farm_id}`) || null : null,
            batchName: record.batch_id ? batchMap.get(record.batch_id) || null : null,
          }));

          setDetailsCache((prev) => ({ ...prev, recipient: records }));
        }
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchNameById = async (table: string, id: string | null | undefined) => {
    if (!id) return null;
    const { data } = await supabase.from(table as any).select("name").eq("id", id).maybeSingle();
    return (data as any)?.name || null;
  };

  const fetchFarmName = async (farmType: string | null, farmId: string | null) => {
    if (!farmId) return null;
    if (farmType === "third_party") {
      const { data } = await supabase.from("third_party_farms").select("name").eq("id", farmId).maybeSingle();
      return data?.name || null;
    }
    const { data } = await supabase.from("stores").select("name").eq("id", farmId).maybeSingle();
    return data?.name || null;
  };

  const fetchFinancialDetails = async (category: HerdCategory, recordId: string) => {
    if (category === "recipient") {
      const [expenseAnimal, expenseRecipient, revenueAnimal, revenueRecipient] = await Promise.all([
        supabase
          .from("accounts_payable_item_allocations")
          .select(
            `id, allocation_type, accounts_payable_items!inner(account_payable_id, product_id, quantity, unit_price, total_price)`,
          )
          .eq("animal_id", recordId),
        supabase
          .from("accounts_payable_item_allocations")
          .select(
            `id, allocation_type, accounts_payable_items!inner(account_payable_id, product_id, quantity, unit_price, total_price)`,
          )
          .eq("recipient_id", recordId),
        supabase
          .from("accounts_receivable_item_allocations")
          .select(
            `id, allocation_type, accounts_receivable_items!inner(account_receivable_id, product_id, quantity, unit_price, total_price)`,
          )
          .eq("animal_id", recordId),
        supabase
          .from("accounts_receivable_item_allocations")
          .select(
            `id, allocation_type, accounts_receivable_items!inner(account_receivable_id, product_id, quantity, unit_price, total_price)`,
          )
          .eq("recipient_id", recordId),
      ]);

      const expenseRows = [...(expenseAnimal.data || []), ...(expenseRecipient.data || [])];
      const revenueRows = [...(revenueAnimal.data || []), ...(revenueRecipient.data || [])];

      const payableIds = Array.from(
        new Set(expenseRows.map((row: any) => row.accounts_payable_items?.account_payable_id).filter(Boolean)),
      ) as string[];
      const receivableIds = Array.from(
        new Set(revenueRows.map((row: any) => row.accounts_receivable_items?.account_receivable_id).filter(Boolean)),
      ) as string[];

      const productIds = Array.from(
        new Set(
          [...expenseRows, ...revenueRows]
            .map((row: any) => row.accounts_payable_items?.product_id || row.accounts_receivable_items?.product_id)
            .filter(Boolean),
        ),
      ) as string[];

      const [payableAccountsRes, receivableAccountsRes, productsRes] = await Promise.all([
        payableIds.length > 0
          ? supabase
              .from("accounts_payable")
              .select("id, document_number, due_date, payment_date, status, supplier_id")
              .in("id", payableIds)
          : Promise.resolve({ data: [] as any[] }),
        receivableIds.length > 0
          ? supabase
              .from("accounts_receivable")
              .select("id, document_number, due_date, payment_date, status, creditor_id")
              .in("id", receivableIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const payableAccounts = payableAccountsRes.data || [];
      const receivableAccounts = receivableAccountsRes.data || [];

      const supplierIds = Array.from(
        new Set(payableAccounts.map((acc: any) => acc.supplier_id).filter(Boolean)),
      ) as string[];
      const creditorIds = Array.from(
        new Set(receivableAccounts.map((acc: any) => acc.creditor_id).filter(Boolean)),
      ) as string[];

      const [suppliersRes, creditorsRes] = await Promise.all([
        supplierIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
          : Promise.resolve({ data: [] as any[] }),
        creditorIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", creditorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const payableMap = new Map((payableAccounts || []).map((acc: any) => [acc.id, acc]));
      const receivableMap = new Map((receivableAccounts || []).map((acc: any) => [acc.id, acc]));
      const productMap = new Map((productsRes.data || []).map((product: any) => [product.id, product.name]));
      const supplierMap = new Map((suppliersRes.data || []).map((supplier: any) => [supplier.id, supplier.name]));
      const creditorMap = new Map((creditorsRes.data || []).map((creditor: any) => [creditor.id, creditor.name]));

      const expenses: DetailFinanceItem[] = expenseRows.map((row: any) => {
        const item = row.accounts_payable_items;
        const account = payableMap.get(item?.account_payable_id);
        return {
          id: row.id,
          recordType: "expense",
          allocationType: row.allocation_type,
          documentNumber: account?.document_number || null,
          status: account?.status || null,
          dueDate: account?.due_date || null,
          paymentDate: account?.payment_date || null,
          partnerName: account?.supplier_id ? supplierMap.get(account.supplier_id) || null : null,
          productName: item?.product_id ? productMap.get(item.product_id) || null : null,
          quantity: Number(item?.quantity || 0),
          unitPrice: Number(item?.unit_price || 0),
          totalPrice: Number(item?.total_price || 0),
        };
      });

      const revenues: DetailFinanceItem[] = revenueRows.map((row: any) => {
        const item = row.accounts_receivable_items;
        const account = receivableMap.get(item?.account_receivable_id);
        return {
          id: row.id,
          recordType: "revenue",
          allocationType: row.allocation_type,
          documentNumber: account?.document_number || null,
          status: account?.status || null,
          dueDate: account?.due_date || null,
          paymentDate: account?.payment_date || null,
          partnerName: account?.creditor_id ? creditorMap.get(account.creditor_id) || null : null,
          productName: item?.product_id ? productMap.get(item.product_id) || null : null,
          quantity: Number(item?.quantity || 0),
          unitPrice: Number(item?.unit_price || 0),
          totalPrice: Number(item?.total_price || 0),
        };
      });

      return { expenses, revenues };
    }

    const allocationField = allocationFieldByCategory[category];

    const [expenseAlloc, revenueAlloc] = await Promise.all([
      supabase
        .from("accounts_payable_item_allocations")
        .select(
          `id, allocation_type, accounts_payable_items!inner(account_payable_id, product_id, quantity, unit_price, total_price)`,
        )
        .eq(allocationField, recordId),
      supabase
        .from("accounts_receivable_item_allocations")
        .select(
          `id, allocation_type, accounts_receivable_items!inner(account_receivable_id, product_id, quantity, unit_price, total_price)`,
        )
        .eq(allocationField, recordId),
    ]);

    const expenseRows = expenseAlloc.data || [];
    const revenueRows = revenueAlloc.data || [];

    const payableIds = Array.from(
      new Set(expenseRows.map((row: any) => row.accounts_payable_items?.account_payable_id).filter(Boolean)),
    ) as string[];
    const receivableIds = Array.from(
      new Set(revenueRows.map((row: any) => row.accounts_receivable_items?.account_receivable_id).filter(Boolean)),
    ) as string[];

    const productIds = Array.from(
      new Set(
        [...expenseRows, ...revenueRows]
          .map((row: any) => row.accounts_payable_items?.product_id || row.accounts_receivable_items?.product_id)
          .filter(Boolean),
      ),
    ) as string[];

    const [payableAccountsRes, receivableAccountsRes, productsRes] = await Promise.all([
      payableIds.length > 0
        ? supabase
            .from("accounts_payable")
            .select("id, document_number, due_date, payment_date, status, supplier_id")
            .in("id", payableIds)
        : Promise.resolve({ data: [] as any[] }),
      receivableIds.length > 0
        ? supabase
            .from("accounts_receivable")
            .select("id, document_number, due_date, payment_date, status, creditor_id")
            .in("id", receivableIds)
        : Promise.resolve({ data: [] as any[] }),
      productIds.length > 0
        ? supabase.from("products").select("id, name").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const payableAccounts = payableAccountsRes.data || [];
    const receivableAccounts = receivableAccountsRes.data || [];

    const supplierIds = Array.from(
      new Set(payableAccounts.map((acc: any) => acc.supplier_id).filter(Boolean)),
    ) as string[];
    const creditorIds = Array.from(
      new Set(receivableAccounts.map((acc: any) => acc.creditor_id).filter(Boolean)),
    ) as string[];

    const [suppliersRes, creditorsRes] = await Promise.all([
      supplierIds.length > 0
        ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
        : Promise.resolve({ data: [] as any[] }),
      creditorIds.length > 0
        ? supabase.from("suppliers").select("id, name").in("id", creditorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const payableMap = new Map((payableAccounts || []).map((acc: any) => [acc.id, acc]));
    const receivableMap = new Map((receivableAccounts || []).map((acc: any) => [acc.id, acc]));
    const productMap = new Map((productsRes.data || []).map((product: any) => [product.id, product.name]));
    const supplierMap = new Map((suppliersRes.data || []).map((supplier: any) => [supplier.id, supplier.name]));
    const creditorMap = new Map((creditorsRes.data || []).map((creditor: any) => [creditor.id, creditor.name]));

    const expenses: DetailFinanceItem[] = expenseRows.map((row: any) => {
      const item = row.accounts_payable_items;
      const account = payableMap.get(item?.account_payable_id);
      return {
        id: row.id,
        recordType: "expense",
        allocationType: row.allocation_type,
        documentNumber: account?.document_number || null,
        status: account?.status || null,
        dueDate: account?.due_date || null,
        paymentDate: account?.payment_date || null,
        partnerName: account?.supplier_id ? supplierMap.get(account.supplier_id) || null : null,
        productName: item?.product_id ? productMap.get(item.product_id) || null : null,
        quantity: Number(item?.quantity || 0),
        unitPrice: Number(item?.unit_price || 0),
        totalPrice: Number(item?.total_price || 0),
      };
    });

    const revenues: DetailFinanceItem[] = revenueRows.map((row: any) => {
      const item = row.accounts_receivable_items;
      const account = receivableMap.get(item?.account_receivable_id);
      return {
        id: row.id,
        recordType: "revenue",
        allocationType: row.allocation_type,
        documentNumber: account?.document_number || null,
        status: account?.status || null,
        dueDate: account?.due_date || null,
        paymentDate: account?.payment_date || null,
        partnerName: account?.creditor_id ? creditorMap.get(account.creditor_id) || null : null,
        productName: item?.product_id ? productMap.get(item.product_id) || null : null,
        quantity: Number(item?.quantity || 0),
        unitPrice: Number(item?.unit_price || 0),
        totalPrice: Number(item?.total_price || 0),
      };
    });

    return { expenses, revenues };
  };

  const loadDetailModal = async (record: HerdRecord) => {
    setSelectedDetail(record);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSections([]);
    setDetailExpenses([]);
    setDetailRevenues([]);

    try {
      if (record.category === "animals") {
        const { data: animal } = await supabase.from("animals").select("*").eq("id", record.id).maybeSingle();
        if (!animal) return;

        const [breedName, categoryName, auctionName, batchName, sireName, damName, recipientName, veterinarianName, laboratoryName, storeName, farmName] =
          await Promise.all([
            fetchNameById("animal_breeds", animal.breed_id),
            fetchNameById("animal_categories", animal.category_id),
            fetchNameById("leiloes", animal.auction_id),
            fetchNameById("animal_batches", animal.batch_id),
            fetchNameById("breeding_animals", animal.sire_id),
            fetchNameById("breeding_animals", animal.dam_id),
            fetchNameById("animals", animal.recipient_id),
            fetchNameById("veterinarians", animal.veterinarian_id),
            fetchNameById("laboratories", animal.laboratory_id),
            fetchNameById("stores", animal.store_id),
            fetchFarmName(animal.farm_type, animal.farm_id),
          ]);

        setDetailSections([
          {
            title: "Dados Gerais",
            items: [
              { label: "Código", value: formatText(animal.code) },
              { label: "Nome", value: formatText(animal.name) },
              { label: "Registro", value: formatText(animal.registration) },
              { label: "Brinco", value: formatText(animal.ear_tag) },
              { label: "Sexo", value: formatText(animal.sex) },
              { label: "Nascimento", value: formatDateBR(animal.birth_date) },
              { label: "Entrada na fazenda", value: formatDateBR(animal.farm_entry_date) },
              { label: "Raça", value: formatText(breedName) },
              { label: "Categoria", value: formatText(categoryName) },
              { label: "Lote", value: formatText(batchName) },
              { label: "Leilão", value: formatText(auctionName) },
              { label: "Lote do leilão", value: formatText(animal.auction_lot) },
              { label: "Ativo", value: animal.is_active ? "Sim" : "Não" },
            ],
          },
          {
            title: "Dados Reprodutivos e Vinculados",
            items: [
              { label: "Pai", value: formatText(sireName) },
              { label: "Mãe", value: formatText(damName) },
              { label: "Receptora", value: formatText(recipientName) },
              { label: "Data aspiração", value: formatDateBR(animal.aspiration_date) },
              { label: "Data transferência", value: formatDateBR(animal.transfer_date) },
              { label: "Data ultrassom", value: formatDateBR(animal.ultrasound_date) },
              { label: "Veterinário", value: formatText(veterinarianName) },
              { label: "Laboratório", value: formatText(laboratoryName) },
              { label: "Fazenda", value: formatText(farmName) },
              { label: "Tipo fazenda", value: formatText(animal.farm_type) },
              { label: "Unidade", value: formatText(storeName) },
              { label: "Observações", value: formatText(animal.observations) },
            ],
          },
        ]);
      }

      if (record.category === "pregnancy") {
        const { data: pregnancy } = await supabase
          .from("pregnancy_management")
          .select("*")
          .eq("id", record.id)
          .maybeSingle();
        if (!pregnancy) return;

        const [breedName, categoryName, auctionName, sireName, damName, recipientName, veterinarianName, laboratoryName, storeName, farmName] =
          await Promise.all([
            fetchNameById("animal_breeds", pregnancy.breed_id),
            fetchNameById("animal_categories", pregnancy.category_id),
            fetchNameById("leiloes", pregnancy.auction_id),
            fetchNameById("breeding_animals", pregnancy.sire_id),
            fetchNameById("breeding_animals", pregnancy.dam_id),
            fetchNameById("animals", pregnancy.recipient_id),
            fetchNameById("veterinarians", pregnancy.veterinarian_id),
            fetchNameById("laboratories", pregnancy.laboratory_id),
            fetchNameById("stores", pregnancy.store_id),
            fetchFarmName(pregnancy.farm_type, pregnancy.farm_id),
          ]);

        setDetailSections([
          {
            title: "Dados Gerais",
            items: [
              { label: "Código", value: formatText(pregnancy.code) },
              { label: "Nome", value: formatText(pregnancy.name) },
              { label: "Status", value: statusLabel(pregnancy.status) },
              { label: "Sexo", value: formatText(pregnancy.sex) },
              { label: "Parto previsto", value: formatDateBR(pregnancy.expected_birth_month) },
              { label: "Raça", value: formatText(breedName) },
              { label: "Categoria", value: formatText(categoryName) },
              { label: "Leilão", value: formatText(auctionName) },
              { label: "Lote do leilão", value: formatText(pregnancy.auction_lot) },
              { label: "Financeiro liberado", value: formatBoolean(pregnancy.financial_released) },
            ],
          },
          {
            title: "Dados Reprodutivos e Vinculados",
            items: [
              { label: "Pai", value: formatText(sireName) },
              { label: "Mãe", value: formatText(damName) },
              { label: "Receptora", value: formatText(recipientName) },
              { label: "Data aspiração", value: formatDateBR(pregnancy.aspiration_date) },
              { label: "Data transferência", value: formatDateBR(pregnancy.transfer_date) },
              { label: "Data ultrassom", value: formatDateBR(pregnancy.ultrasound_date) },
              { label: "Pós-Transferência ID", value: formatText(pregnancy.embryo_transfer_id) },
              { label: "Veterinário", value: formatText(veterinarianName) },
              { label: "Laboratório", value: formatText(laboratoryName) },
              { label: "Fazenda", value: formatText(farmName) },
              { label: "Tipo fazenda", value: formatText(pregnancy.farm_type) },
              { label: "Unidade", value: formatText(storeName) },
            ],
          },
        ]);
      }

      if (record.category === "embryo_transfer") {
        const { data: transfer } = await supabase
          .from("embryo_transfer_management")
          .select("*")
          .eq("id", record.id)
          .maybeSingle();
        if (!transfer) return;

        const [breedName, categoryName, auctionName, sireName, damName, recipientName, veterinarianName, laboratoryName, storeName, farmName] =
          await Promise.all([
            fetchNameById("animal_breeds", transfer.breed_id),
            fetchNameById("animal_categories", transfer.category_id),
            fetchNameById("leiloes", transfer.auction_id),
            fetchNameById("breeding_animals", transfer.sire_id),
            fetchNameById("breeding_animals", transfer.dam_id),
            fetchNameById("animals", transfer.recipient_id),
            fetchNameById("veterinarians", transfer.veterinarian_id),
            fetchNameById("laboratories", transfer.laboratory_id),
            fetchNameById("stores", transfer.store_id),
            fetchFarmName(transfer.farm_type, transfer.farm_id),
          ]);

        setDetailSections([
          {
            title: "Dados Gerais",
            items: [
              { label: "Código", value: formatText(transfer.code) },
              { label: "Nome", value: formatText(transfer.name) },
              { label: "Status", value: statusLabel(transfer.status) },
              { label: "Aspiração prevista", value: formatDateBR(transfer.expected_aspiration_month) },
              { label: "Raça", value: formatText(breedName) },
              { label: "Categoria", value: formatText(categoryName) },
              { label: "Leilão", value: formatText(auctionName) },
              { label: "Lote do leilão", value: formatText(transfer.auction_lot) },
            ],
          },
          {
            title: "Dados Reprodutivos e Vinculados",
            items: [
              { label: "Pai", value: formatText(sireName) },
              { label: "Mãe", value: formatText(damName) },
              { label: "Receptora", value: formatText(recipientName) },
              { label: "Data aspiração", value: formatDateBR(transfer.aspiration_date) },
              { label: "Data transferência", value: formatDateBR(transfer.transfer_date) },
              { label: "Data ultrassom", value: formatDateBR(transfer.ultrasound_date) },
              { label: "Aspiração ID", value: formatText(transfer.aspiration_id) },
              { label: "Veterinário", value: formatText(veterinarianName) },
              { label: "Laboratório", value: formatText(laboratoryName) },
              { label: "Fazenda", value: formatText(farmName) },
              { label: "Tipo fazenda", value: formatText(transfer.farm_type) },
              { label: "Unidade", value: formatText(storeName) },
            ],
          },
        ]);
      }

      if (record.category === "aspiration") {
        const { data: aspiration } = await supabase
          .from("aspiration_management")
          .select("*")
          .eq("id", record.id)
          .maybeSingle();
        if (!aspiration) return;

        const [breedName, categoryName, auctionName, sireName, damName, veterinarianName, laboratoryName, storeName, farmName] =
          await Promise.all([
            fetchNameById("animal_breeds", aspiration.breed_id),
            fetchNameById("animal_categories", aspiration.category_id),
            fetchNameById("leiloes", aspiration.auction_id),
            Promise.resolve(null),
            fetchNameById("breeding_animals", aspiration.dam_id),
            fetchNameById("veterinarians", aspiration.veterinarian_id),
            fetchNameById("laboratories", aspiration.laboratory_id),
            fetchNameById("stores", aspiration.store_id),
            fetchFarmName(aspiration.farm_type, aspiration.farm_id),
          ]);

        setDetailSections([
          {
            title: "Dados Gerais",
            items: [
              { label: "Código", value: formatText(aspiration.code) },
              { label: "Nome", value: formatText(aspiration.name) },
              { label: "Status", value: statusLabel(aspiration.status) },
              { label: "Aspiração prevista", value: formatDateBR(aspiration.expected_aspiration_month) },
              { label: "Data aspiração", value: formatDateBR(aspiration.aspiration_date) },
              { label: "Data transferência", value: formatDateBR(aspiration.transfer_date) },
              { label: "Embriões", value: formatText(aspiration.embryo_count) },
              { label: "Raça", value: formatText(breedName) },
              { label: "Categoria", value: formatText(categoryName) },
              { label: "Leilão", value: formatText(auctionName) },
              { label: "Lote do leilão", value: formatText(aspiration.auction_lot) },
              { label: "Financeiro liberado", value: formatBoolean(aspiration.financial_released) },
            ],
          },
          {
            title: "Dados Reprodutivos e Vinculados",
            items: [
              { label: "Pai", value: formatText(sireName) },
              { label: "Mãe", value: formatText(damName) },
              { label: "Veterinário", value: formatText(veterinarianName) },
              { label: "Laboratório", value: formatText(laboratoryName) },
              { label: "Fazenda", value: formatText(farmName) },
              { label: "Tipo fazenda", value: formatText(aspiration.farm_type) },
              { label: "Unidade", value: formatText(storeName) },
            ],
          },
        ]);
      }

      if (record.category === "recipient") {
        const { data: recipient } = await supabase.from("animals").select("*").eq("id", record.id).maybeSingle();
        if (!recipient) return;

        const [breedName, categoryName, auctionName, batchName, storeName, farmName] = await Promise.all([
          fetchNameById("animal_breeds", recipient.breed_id),
          fetchNameById("animal_categories", recipient.category_id),
          fetchNameById("leiloes", recipient.auction_id),
          fetchNameById("animal_batches", recipient.batch_id),
          fetchNameById("stores", recipient.store_id),
          fetchFarmName(recipient.farm_type, recipient.farm_id),
        ]);

        setDetailSections([
          {
            title: "Dados Cadastrais",
            items: [
              { label: "Código", value: formatText(recipient.code) },
              { label: "Nome", value: formatText(recipient.name) },
              { label: "Registro", value: formatText(recipient.registration) },
              { label: "Brinco", value: formatText(recipient.ear_tag) },
              { label: "Status", value: recipient.is_active ? "Ativo" : "Inativo" },
              { label: "Sexo", value: formatText(recipient.sex) },
              { label: "Nascimento", value: formatDateBR(recipient.birth_date) },
              { label: "Entrada na fazenda", value: formatDateBR(recipient.farm_entry_date) },
              { label: "Raça", value: formatText(breedName) },
              { label: "Categoria", value: formatText(categoryName) },
              { label: "Lote", value: formatText(batchName) },
              { label: "Fazenda", value: formatText(farmName) },
              { label: "Tipo fazenda", value: formatText(recipient.farm_type) },
              { label: "Unidade", value: formatText(storeName) },
              { label: "Leilão", value: formatText(auctionName) },
              { label: "Lote do leilão", value: formatText(recipient.auction_lot) },
              { label: "Observações", value: formatText(recipient.observations) },
            ],
          },
        ]);
      }

      const financial = await fetchFinancialDetails(record.category, record.id);
      setDetailExpenses(financial.expenses);
      setDetailRevenues(financial.revenues);
    } finally {
      setDetailLoading(false);
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
        record.farmName || "",
        record.batchName || "",
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
    {
      key: "recipient" as HerdCategory,
      title: "Receptoras",
      value: summary.recipient,
      icon: Users,
      color: "text-cyan-700",
      bg: "bg-cyan-50",
      border: "border-cyan-200",
    },
  ];

  const totalExpenses = detailExpenses.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalRevenues = detailRevenues.reduce((sum, item) => sum + item.totalPrice, 0);

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
            <p className="text-sm text-slate-600">Visão consolidada do rebanho, incluindo receptoras</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
              Clique em um card superior para alternar a categoria. Clique no card individual para abrir o cadastro em modal.
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
                    placeholder="Buscar por nome, código, status, leilão, fazenda ou lote"
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
                  <button
                    key={`${record.category}-${record.id}`}
                    type="button"
                    onClick={() => loadDetailModal(record)}
                    className="text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <Card className="border-slate-200 bg-white h-full transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5">
                      <CardContent className="p-4 space-y-3">
                        {(record.category === "animals" || record.category === "recipient") && (
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
                            <p className="text-xs text-slate-500">Código: {record.code ?? "Não informado"}</p>
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

                          {record.category === "recipient" && (
                            <>
                              <div>
                                <p className="text-slate-500 text-xs">Nascimento</p>
                                <p className="font-medium">{formatDateBR(record.birthDate)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Fazenda</p>
                                <p className="font-medium truncate">{record.farmName || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Lote</p>
                                <p className="font-medium truncate">{record.batchName || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Status</p>
                                <p className="font-medium">{statusLabel(record.status)}</p>
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
                  </button>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[88vh] overflow-hidden p-0 flex flex-col">
          <div className="p-6 border-b bg-slate-50/70 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-slate-900">
                {selectedDetail ? `${categoryTitle[selectedDetail.category]} - ${selectedDetail.name}` : "Detalhes"}
              </DialogTitle>
              <DialogDescription>
                Visualização do cadastro com dados reais do módulo e aba financeiro.
              </DialogDescription>
            </DialogHeader>
            {selectedDetail && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`${categoryModuleRoute[selectedDetail.category]}?open=${selectedDetail.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir cadastro completo
                </Button>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
            {detailLoading ? (
              <div className="py-10 text-center text-slate-500">Carregando detalhes do cadastro...</div>
            ) : (
              <Tabs defaultValue="dados" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 mt-4">
                  {detailSections.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhum dado encontrado.</div>
                  ) : (
                    detailSections.map((section) => (
                      <Card key={section.title} className="border-slate-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{section.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {section.items.map((item) => (
                              <div key={`${section.title}-${item.label}`} className="rounded-lg border bg-slate-50/60 p-3">
                                <p className="text-xs text-slate-500">{item.label}</p>
                                <p className="text-sm font-medium text-slate-900 break-words">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="financeiro" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="border-rose-200 bg-rose-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-rose-800">Despesas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-rose-700 font-semibold">{formatCurrencyBR(totalExpenses)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-emerald-200 bg-emerald-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-emerald-800">Receitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-emerald-700 font-semibold">{formatCurrencyBR(totalRevenues)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Lançamentos vinculados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {detailExpenses.length === 0 && detailRevenues.length === 0 ? (
                        <div className="text-sm text-slate-500">Nenhum vínculo financeiro encontrado.</div>
                      ) : (
                        [...detailExpenses, ...detailRevenues].map((item) => (
                          <div key={`${item.recordType}-${item.id}`} className="rounded-lg border p-3 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <Badge variant={item.recordType === "expense" ? "secondary" : "default"}>
                                {item.recordType === "expense" ? "Despesa" : "Receita"}
                              </Badge>
                              <Badge variant="outline">{getAllocationTypeLabel(item.allocationType)}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs">Documento</p>
                                <p>{formatText(item.documentNumber)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Parceiro</p>
                                <p>{formatText(item.partnerName)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Produto</p>
                                <p>{formatText(item.productName)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Vencimento</p>
                                <p>{formatDateBR(item.dueDate)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Pagamento/Recebimento</p>
                                <p>{formatDateBR(item.paymentDate)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Status</p>
                                <p>{statusLabel(item.status)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Quantidade</p>
                                <p>{item.quantity.toLocaleString("pt-BR")}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Valor unitário</p>
                                <p>{formatCurrencyBR(item.unitPrice)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Valor total</p>
                                <p className="font-semibold">{formatCurrencyBR(item.totalPrice)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnimaisRebanho;
