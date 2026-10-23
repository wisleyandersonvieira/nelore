// @ts-nocheck
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Download,
  Eye,
  Gavel,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AuctionSortField = "code" | "name" | "date" | "city" | "linked_records_count" | "sales_count";
type SortDirection = "asc" | "desc";
type ModalMode = "create" | "edit" | "view";
type ModalTab = "details" | "linked";

const PAGE_SIZE = 20;

interface AuctionAttachment {
  name: string;
  path: string;
  url?: string | null;
}

interface AuctionOverviewRpcRow {
  id: string;
  code: number;
  name: string;
  date: string;
  city: string;
  is_active: boolean;
  observations: string | null;
  attachments: AuctionAttachment[] | null;
  store_id: string;
  matrix_id: string | null;
  created_at: string;
  updated_at: string;
  animal_count: number | string;
  pregnancy_count: number | string;
  aspiration_count: number | string;
  linked_records_count: number | string;
  sales_count: number | string;
  total_count: number | string;
}

interface AuctionRow {
  id: string;
  code: number;
  name: string;
  date: string;
  city: string;
  isActive: boolean;
  observations: string | null;
  attachments: AuctionAttachment[];
  storeId: string;
  matrixId: string | null;
  createdAt: string;
  updatedAt: string;
  animalCount: number;
  pregnancyCount: number;
  aspirationCount: number;
  linkedRecordsCount: number;
  salesCount: number;
  totalCount: number;
}

interface AuctionScope {
  defaultStoreId: string | null;
  matrixId: string | null;
  storeIds: string[] | null;
}

interface AnimalLinkedRow {
  id: string;
  code: number;
  name: string;
  sex: string;
  registration: string | null;
  auction_lot: string | null;
  is_active: boolean;
  created_at: string;
}

interface PregnancyLinkedRow {
  id: string;
  code: number;
  name: string;
  status: string;
  sex: string;
  expected_birth_month: string | null;
  ultrasound_date: string | null;
  auction_lot: string | null;
  created_at: string;
}

interface AspirationLinkedRow {
  id: string;
  code: number;
  name: string;
  status: string;
  aspiration_date: string | null;
  embryo_count: number | null;
  auction_lot: string | null;
  created_at: string;
}

interface SaleLinkedRow {
  id: string;
  tipo: string;
  registro: string;
  code: number | null;
  auction_lot: string | null;
  sale_date: string | null;
  sale_value: number | null;
  cliente: string | null;
}

const emptyFormData = {
  name: "",
  date: "",
  city: "",
  observations: "",
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const normalizeAttachments = (value: unknown): AuctionAttachment[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const attachment = item as Record<string, unknown>;
      return {
        name: String(attachment.name || "Arquivo"),
        path: String(attachment.path || ""),
        url: attachment.url ? String(attachment.url) : null,
      };
    })
    .filter((item) => item.path);
};

const normalizeAuctionRow = (row: AuctionOverviewRpcRow): AuctionRow => ({
  id: row.id,
  code: Number(row.code || 0),
  name: row.name,
  date: row.date,
  city: row.city,
  isActive: Boolean(row.is_active),
  observations: row.observations,
  attachments: normalizeAttachments(row.attachments),
  storeId: row.store_id,
  matrixId: row.matrix_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  animalCount: Number(row.animal_count || 0),
  pregnancyCount: Number(row.pregnancy_count || 0),
  aspirationCount: Number(row.aspiration_count || 0),
  linkedRecordsCount: Number(row.linked_records_count || 0),
  salesCount: Number(row.sales_count || 0),
  totalCount: Number(row.total_count || 0),
});

const SortableHeader = ({
  label,
  field,
  currentField,
  currentDirection,
  onToggle,
  align = "left",
}: {
  label: string;
  field: AuctionSortField;
  currentField: AuctionSortField;
  currentDirection: SortDirection;
  onToggle: (field: AuctionSortField) => void;
  align?: "left" | "center" | "right";
}) => {
  const icon =
    currentField !== field ? (
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
    ) : currentDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-foreground" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-foreground" />
    );

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={cn(
        "inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
        align === "center" && "mx-auto flex",
        align === "right" && "ml-auto flex",
      )}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
};

const LinkedSectionCard = ({
  title,
  description,
  emptyMessage,
  loading,
  children,
  count,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  loading: boolean;
  children: ReactNode;
  count: number;
}) => (
  <Card className="border-border/70 bg-card/70 shadow-sm">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {count}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="flex min-h-28 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const AnimaisLeiloes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [defaultStoreId, setDefaultStoreId] = useState<string | null>(null);

  const [nameFilter, setNameFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<AuctionSortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [listPage, setListPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalTab, setModalTab] = useState<ModalTab>("details");
  const [selectedAuction, setSelectedAuction] = useState<AuctionRow | null>(null);
  const [nextCode, setNextCode] = useState(1);
  const [formData, setFormData] = useState(emptyFormData);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AuctionAttachment[]>([]);

  const [linkedLoading, setLinkedLoading] = useState(false);
  const [linkedAnimals, setLinkedAnimals] = useState<AnimalLinkedRow[]>([]);
  const [linkedPregnancies, setLinkedPregnancies] = useState<PregnancyLinkedRow[]>([]);
  const [linkedAspirations, setLinkedAspirations] = useState<AspirationLinkedRow[]>([]);
  const [linkedSales, setLinkedSales] = useState<SaleLinkedRow[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [auctionToDelete, setAuctionToDelete] = useState<AuctionRow | null>(null);

  const getAuctionScope = useCallback(async (): Promise<AuctionScope> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { defaultStoreId: null, matrixId: null, storeIds: [] };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, store_id, matrix_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (profile?.role === "admin") {
      return {
        defaultStoreId: profile.store_id || null,
        matrixId: profile.matrix_id || null,
        storeIds: null,
      };
    }

    const storeIds = new Set<string>();

    if (profile?.store_id) {
      storeIds.add(profile.store_id);
    }

    const { data: userStores, error: userStoresError } = await supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", user.id);

    if (userStoresError) {
      throw userStoresError;
    }

    (userStores || []).forEach((row) => {
      if (row.store_id) {
        storeIds.add(row.store_id);
      }
    });

    return {
      defaultStoreId: profile?.store_id || Array.from(storeIds)[0] || null,
      matrixId: profile?.matrix_id || null,
      storeIds: Array.from(storeIds),
    };
  }, []);

  const loadNextCode = useCallback(
    async (storeId: string) => {
      const { data, error } = await supabase.rpc("get_next_leilao_code", {
        store_uuid: storeId,
      });

      if (error) {
        throw error;
      }

      setNextCode(Number(data || 1));
    },
    [],
  );

  const loadLinkedRecords = useCallback(async (auctionId: string) => {
    setLinkedLoading(true);
    try {
      const [animalsRes, pregnanciesRes, aspirationsRes, animalSalesRes, pregnancySalesRes, aspirationSalesRes] = await Promise.all([
        supabase
          .from("animals")
          .select("id, code, name, sex, registration, auction_lot, is_active, created_at")
          .eq("auction_id", auctionId)
          .order("name"),
        supabase
          .from("pregnancy_management")
          .select("id, code, name, status, sex, expected_birth_month, ultrasound_date, auction_lot, created_at")
          .eq("auction_id", auctionId)
          .order("name"),
        supabase
          .from("aspiration_management")
          .select("id, code, name, status, aspiration_date, embryo_count, auction_lot, created_at")
          .eq("auction_id", auctionId)
          .order("name"),
        (supabase as any)
          .from("animal_sales")
          .select("id, sale_date, sale_value, auction_lot, animals(code, name), suppliers(name)")
          .eq("auction_id", auctionId),
        (supabase as any)
          .from("pregnancy_sales")
          .select("id, sale_date, sale_value, auction_lot, pregnancy_management(code, name), suppliers(name)")
          .eq("auction_id", auctionId),
        (supabase as any)
          .from("aspiration_sales")
          .select("id, sale_date, sale_value, auction_lot, aspiration_management(code, name), suppliers(name)")
          .eq("auction_id", auctionId),
      ]);

      if (animalsRes.error) throw animalsRes.error;
      if (pregnanciesRes.error) throw pregnanciesRes.error;
      if (aspirationsRes.error) throw aspirationsRes.error;

      setLinkedAnimals((animalsRes.data || []) as AnimalLinkedRow[]);
      setLinkedPregnancies((pregnanciesRes.data || []) as PregnancyLinkedRow[]);
      setLinkedAspirations((aspirationsRes.data || []) as AspirationLinkedRow[]);

      const mapSale = (rows: any[], tipo: string, itemKey: string): SaleLinkedRow[] =>
        (rows || []).map((s) => ({
          id: s.id,
          tipo,
          registro: s[itemKey]?.name || "N/D",
          code: s[itemKey]?.code ?? null,
          auction_lot: s.auction_lot,
          sale_date: s.sale_date,
          sale_value: s.sale_value != null ? Number(s.sale_value) : null,
          cliente: s.suppliers?.name || null,
        }));
      setLinkedSales([
        ...mapSale(animalSalesRes.data, "Animal", "animals"),
        ...mapSale(pregnancySalesRes.data, "Prenhez", "pregnancy_management"),
        ...mapSale(aspirationSalesRes.data, "Aspiração", "aspiration_management"),
      ]);
    } catch (error) {
      console.error("Erro ao carregar cadastros vinculados do leilão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cadastros vinculados ao leilão.",
        variant: "destructive",
      });
      setLinkedAnimals([]);
      setLinkedPregnancies([]);
      setLinkedAspirations([]);
      setLinkedSales([]);
    } finally {
      setLinkedLoading(false);
    }
  }, [toast]);

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const scope = await getAuctionScope();
      setDefaultStoreId(scope.defaultStoreId);

      if (!scope.matrixId && Array.isArray(scope.storeIds) && scope.storeIds.length === 0) {
        setAuctions([]);
        setTotalCount(0);
        return;
      }

      const { data, error } = await (supabase as any).rpc("list_leiloes_overview", {
        p_store_ids: scope.matrixId ? null : scope.storeIds,
        p_matrix_id: scope.matrixId,
        p_name: nameFilter.trim() || null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_sort_field: sortField,
        p_sort_direction: sortDirection,
        p_page: listPage,
        p_page_size: PAGE_SIZE,
      });

      if (error) {
        throw error;
      }

      const normalizedRows = ((data || []) as AuctionOverviewRpcRow[]).map(normalizeAuctionRow);

      if (normalizedRows.length === 0 && listPage > 1) {
        setListPage((current) => Math.max(current - 1, 1));
        return;
      }

      setAuctions(normalizedRows);
      setTotalCount(normalizedRows[0]?.totalCount || 0);
    } catch (error) {
      console.error("Erro ao buscar leilões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os leilões.",
        variant: "destructive",
      });
      setAuctions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, getAuctionScope, listPage, nameFilter, sortDirection, sortField, toast]);

  useEffect(() => {
    void loadAuctions();
  }, [loadAuctions]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (listPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + auctions.length - 1;

  const linkedCountOnPage = useMemo(
    () => auctions.reduce((sum, auction) => sum + auction.linkedRecordsCount, 0),
    [auctions],
  );

  const auctionsWithLinksOnPage = useMemo(
    () => auctions.filter((auction) => auction.linkedRecordsCount > 0).length,
    [auctions],
  );

  const modalLinkedCount = selectedAuction?.linkedRecordsCount || 0;
  const modalSalesCount = selectedAuction?.salesCount || 0;

  const resetModalState = () => {
    setModalMode("create");
    setModalTab("details");
    setSelectedAuction(null);
    setFormData(emptyFormData);
    setAttachmentFiles([]);
    setExistingAttachments([]);
    setLinkedAnimals([]);
    setLinkedPregnancies([]);
    setLinkedAspirations([]);
    setLinkedSales([]);
    setLinkedLoading(false);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);

    if (!open) {
      resetModalState();
    }
  };

  const openCreateModal = async () => {
    try {
      const scope = await getAuctionScope();
      if (!scope.defaultStoreId) {
        toast({
          title: "Acesso indisponível",
          description: "Não foi possível identificar a fazenda padrão para cadastrar o leilão.",
          variant: "destructive",
        });
        return;
      }

      await loadNextCode(scope.defaultStoreId);
      resetModalState();
      setModalMode("create");
      setIsModalOpen(true);
    } catch (error) {
      console.error("Erro ao preparar cadastro do leilão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível preparar o cadastro do leilão.",
        variant: "destructive",
      });
    }
  };

  const openAuctionModal = async (mode: ModalMode, auction: AuctionRow) => {
    resetModalState();
    setModalMode(mode);
    setSelectedAuction(auction);
    setFormData({
      name: auction.name,
      date: auction.date,
      city: auction.city,
      observations: auction.observations || "",
    });
    setExistingAttachments(auction.attachments);
    setIsModalOpen(true);

    await loadLinkedRecords(auction.id);
  };

  const uploadAttachments = async (auctionId: string) => {
    const uploaded: AuctionAttachment[] = [];

    for (const file of attachmentFiles) {
      const filePath = `leiloes/${auctionId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("attachments").upload(filePath, file);

      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);
      uploaded.push({
        name: file.name,
        path: filePath,
        url: data.publicUrl,
      });
    }

    return uploaded;
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.date || !formData.city.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, data e cidade do leilão antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const scope = await getAuctionScope();

      if (!scope.defaultStoreId) {
        throw new Error("Não foi possível identificar a fazenda padrão do usuário.");
      }

      if (modalMode === "create") {
        const { data: createdAuction, error: createError } = await supabase
          .from("leiloes")
          .insert({
            code: nextCode,
            name: formData.name.trim(),
            date: formData.date,
            city: formData.city.trim(),
            observations: formData.observations.trim() || null,
            store_id: scope.defaultStoreId,
            matrix_id: scope.matrixId,
          })
          .select("id")
          .single();

        if (createError) throw createError;

        if (attachmentFiles.length > 0) {
          const uploaded = await uploadAttachments(createdAuction.id);
          const { error: updateAttachmentsError } = await supabase
            .from("leiloes")
            .update({ attachments: uploaded })
            .eq("id", createdAuction.id);

          if (updateAttachmentsError) throw updateAttachmentsError;
        }

        toast({
          title: "Leilão cadastrado",
          description: "O leilão foi cadastrado com sucesso.",
        });
      }

      if (modalMode === "edit" && selectedAuction) {
        let allAttachments = [...existingAttachments];

        if (attachmentFiles.length > 0) {
          const uploaded = await uploadAttachments(selectedAuction.id);
          allAttachments = [...allAttachments, ...uploaded];
        }

        const { error: updateError } = await supabase
          .from("leiloes")
          .update({
            name: formData.name.trim(),
            date: formData.date,
            city: formData.city.trim(),
            observations: formData.observations.trim() || null,
            attachments: allAttachments,
          })
          .eq("id", selectedAuction.id);

        if (updateError) throw updateError;

        toast({
          title: "Leilão atualizado",
          description: "As informações do leilão foram atualizadas com sucesso.",
        });
      }

      handleModalOpenChange(false);
      await loadAuctions();
    } catch (error: any) {
      console.error("Erro ao salvar leilão:", error);
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar o leilão.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadAttachment = async (attachment: AuctionAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.path, 60, { download: attachment.name });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Erro ao baixar anexo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o anexo selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleRequestDelete = (auction: AuctionRow) => {
    if (auction.linkedRecordsCount > 0) {
      toast({
        title: "Exclusão bloqueada",
        description: "Este leilão não pode ser excluído porque possui cadastros vinculados.",
        variant: "destructive",
      });
      return;
    }

    setAuctionToDelete(auction);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!auctionToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("leiloes").delete().eq("id", auctionToDelete.id);
      if (error) throw error;

      toast({
        title: "Leilão excluído",
        description: "O leilão foi removido com sucesso.",
      });

      setDeleteDialogOpen(false);
      setAuctionToDelete(null);
      await loadAuctions();
    } catch (error: any) {
      console.error("Erro ao excluir leilão:", error);
      toast({
        title: "Erro ao excluir",
        description:
          error?.message || "Não foi possível excluir o leilão selecionado.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSort = (field: AuctionSortField) => {
    setListPage(1);
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "date" ? "desc" : "asc");
  };

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              className="mt-1"
              onClick={() => navigate("/animais/cadastros-gerais")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                  <Gavel className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Leilões</h1>
                  <p className="text-muted-foreground">
                    Gerencie os leilões no padrão visual atual e acompanhe os cadastros vinculados sem perder performance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={() => void openCreateModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo leilão
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Leilões encontrados</p>
                <p className="mt-1 text-2xl font-semibold">{totalCount}</p>
              </div>
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Cadastros na página</p>
                <p className="mt-1 text-2xl font-semibold">{linkedCountOnPage}</p>
              </div>
              <Search className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Leilões com vínculos</p>
                <p className="mt-1 text-2xl font-semibold">{auctionsWithLinksOnPage}</p>
                <p className="text-xs text-muted-foreground">Nesta página</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              Filtre por nome e período. A ordenação e a paginação são preservadas durante a navegação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.7fr))_auto]">
            <div className="space-y-2">
              <Label>Nome do leilão</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={nameFilter}
                  onChange={(event) => {
                    setNameFilter(event.target.value);
                    setListPage(1);
                  }}
                  placeholder="Pesquisar por nome"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setListPage(1);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setListPage(1);
                }}
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setNameFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setSortField("date");
                  setSortDirection("desc");
                  setListPage(1);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Painel de leilões</CardTitle>
            <CardDescription>
              Listagem paginada com ordenação por código, nome, data, cidade e quantidade total de cadastros vinculados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">
                      <SortableHeader
                        label="Código"
                        field="code"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Nome"
                        field="name"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <SortableHeader
                        label="Data"
                        field="date"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Cidade"
                        field="city"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[110px] text-center">
                      <SortableHeader
                        label="Compras"
                        field="linked_records_count"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                        align="center"
                      />
                    </TableHead>
                    <TableHead className="w-[110px] text-center">
                      <SortableHeader
                        label="Vendas"
                        field="sales_count"
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onToggle={toggleSort}
                        align="center"
                      />
                    </TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando leilões...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : auctions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                        Nenhum leilão encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auctions.map((auction) => (
                      <TableRow key={auction.id}>
                        <TableCell className="font-medium">#{auction.code}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{auction.name}</p>
                            {auction.observations && (
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {auction.observations}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDateBR(auction.date)}</TableCell>
                        <TableCell>{auction.city}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "min-w-12 justify-center rounded-full",
                              auction.linkedRecordsCount > 0 && "border-amber-200 bg-amber-50 text-amber-800",
                            )}
                          >
                            {auction.linkedRecordsCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "min-w-12 justify-center rounded-full",
                              auction.salesCount > 0 && "border-emerald-200 bg-emerald-50 text-emerald-800",
                            )}
                          >
                            {auction.salesCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void openAuctionModal("view", auction)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void openAuctionModal("edit", auction)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRequestDelete(auction)}
                              className={cn(
                                auction.linkedRecordsCount > 0
                                  ? "text-muted-foreground hover:text-destructive"
                                  : "text-destructive",
                              )}
                              title={
                                auction.linkedRecordsCount > 0
                                  ? "Leilão com cadastros vinculados não pode ser excluído"
                                  : "Excluir leilão"
                              }
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {rangeStart} a {rangeEnd} de {totalCount} leilões.
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setListPage((current) => Math.max(current - 1, 1))}
                  disabled={listPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {listPage} de {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setListPage((current) => Math.min(current + 1, pageCount))}
                  disabled={listPage === pageCount}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-amber-600" />
              {modalMode === "create" && "Novo leilão"}
              {modalMode === "edit" && `Editar leilão #${selectedAuction?.code ?? ""}`}
              {modalMode === "view" && `Visualizar leilão #${selectedAuction?.code ?? ""}`}
            </DialogTitle>
            <DialogDescription>
              Mantenha o cadastro do leilão e acompanhe os animais, prenhezes e aspirações vinculados na mesma tela.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={modalTab} onValueChange={(value) => setModalTab(value as ModalTab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Cadastro</TabsTrigger>
              <TabsTrigger value="linked" disabled={!selectedAuction}>
                Compras e vendas {selectedAuction ? `(${modalLinkedCount + modalSalesCount})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={selectedAuction?.code ?? nextCode} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                    disabled={modalMode === "view"}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    disabled={modalMode === "view"}
                    placeholder="Nome do leilão"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.city}
                    onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
                    disabled={modalMode === "view"}
                    placeholder="Cidade do leilão"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, observations: event.target.value }))
                  }
                  disabled={modalMode === "view"}
                  rows={4}
                  placeholder="Observações sobre o leilão"
                />
              </div>

              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Anexos</CardTitle>
                  <CardDescription>
                    Centralize contratos, relatórios e documentos de apoio do leilão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {modalMode !== "view" && (
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => {
                        if (!event.target.files) return;
                        setAttachmentFiles((current) => [...current, ...Array.from(event.target.files || [])]);
                        event.target.value = "";
                      }}
                    />
                  )}

                  {attachmentFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Novos arquivos</p>
                      <div className="space-y-2">
                        {attachmentFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                setAttachmentFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingAttachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Arquivos salvos</p>
                      <div className="space-y-2">
                        {existingAttachments.map((attachment, index) => (
                          <div
                            key={`${attachment.path}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{attachment.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => void handleDownloadAttachment(attachment)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {modalMode !== "view" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setExistingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attachmentFiles.length === 0 && existingAttachments.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum anexo vinculado a este leilão.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="linked" className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                A aba reúne os cadastros já vinculados ao leilão usando a relação existente por <code>auction_id</code>.
              </div>

              <LinkedSectionCard
                title="Animais"
                description="Cadastros de animais vinculados a este leilão."
                emptyMessage="Nenhum animal vinculado a este leilão."
                loading={linkedLoading}
                count={linkedAnimals.length}
              >
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Sexo</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedAnimals.map((animal) => (
                        <TableRow key={animal.id}>
                          <TableCell className="font-medium">#{animal.code}</TableCell>
                          <TableCell>{animal.name}</TableCell>
                          <TableCell>{animal.sex || "N/D"}</TableCell>
                          <TableCell>{animal.registration || "N/D"}</TableCell>
                          <TableCell>{animal.auction_lot || "N/D"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={animal.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}>
                              {animal.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </LinkedSectionCard>

              <LinkedSectionCard
                title="Prenhez"
                description="Cadastros de prenhez vinculados a este leilão."
                emptyMessage="Nenhum cadastro de prenhez vinculado a este leilão."
                loading={linkedLoading}
                count={linkedPregnancies.length}
              >
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sexo</TableHead>
                        <TableHead>Ultrassom</TableHead>
                        <TableHead>Lote</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedPregnancies.map((pregnancy) => (
                        <TableRow key={pregnancy.id}>
                          <TableCell className="font-medium">#{pregnancy.code}</TableCell>
                          <TableCell>{pregnancy.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pregnancy.status || "N/D"}</Badge>
                          </TableCell>
                          <TableCell>{pregnancy.sex || "N/D"}</TableCell>
                          <TableCell>{formatDateBR(pregnancy.ultrasound_date)}</TableCell>
                          <TableCell>{pregnancy.auction_lot || "N/D"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </LinkedSectionCard>

              <LinkedSectionCard
                title="Aspiração"
                description="Cadastros de aspiração vinculados a este leilão."
                emptyMessage="Nenhum cadastro de aspiração vinculado a este leilão."
                loading={linkedLoading}
                count={linkedAspirations.length}
              >
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Embriões</TableHead>
                        <TableHead>Lote</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedAspirations.map((aspiration) => (
                        <TableRow key={aspiration.id}>
                          <TableCell className="font-medium">#{aspiration.code}</TableCell>
                          <TableCell>{aspiration.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{aspiration.status || "N/D"}</Badge>
                          </TableCell>
                          <TableCell>{formatDateBR(aspiration.aspiration_date)}</TableCell>
                          <TableCell>{aspiration.embryo_count ?? 0}</TableCell>
                          <TableCell>{aspiration.auction_lot || "N/D"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </LinkedSectionCard>

              <LinkedSectionCard
                title="Vendas"
                description="Vendas realizadas neste leilão (animais, prenhezes e aspirações)."
                emptyMessage="Nenhuma venda vinculada a este leilão."
                loading={linkedLoading}
                count={linkedSales.length}
              >
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Cliente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell><Badge variant="outline">{sale.tipo}</Badge></TableCell>
                          <TableCell>{sale.code != null ? `#${sale.code} ` : ""}{sale.registro}</TableCell>
                          <TableCell>{sale.auction_lot || "N/D"}</TableCell>
                          <TableCell>{formatDateBR(sale.sale_date)}</TableCell>
                          <TableCell>{sale.sale_value != null ? sale.sale_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "N/D"}</TableCell>
                          <TableCell>{sale.cliente || "N/D"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </LinkedSectionCard>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleModalOpenChange(false)} disabled={saving}>
              {modalMode === "view" ? "Fechar" : "Cancelar"}
            </Button>
            {modalMode !== "view" && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {modalMode === "edit" ? "Salvar alterações" : "Salvar leilão"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leilão</AlertDialogTitle>
            <AlertDialogDescription>
              {auctionToDelete
                ? `Você está prestes a excluir o leilão "${auctionToDelete.name}". Esta ação não pode ser desfeita.`
                : "Você está prestes a excluir o leilão selecionado."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AnimaisLeiloes;
