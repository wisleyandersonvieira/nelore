// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import elitebovLogo from "@/assets/elitebov-logo.png";

interface BreedingAnimal {
  id: string;
  name: string;
  sex: string;
  registration: string | null;
  store_id: string;
  sire_id: string | null;
  dam_id: string | null;
  animal_id: string | null;
}

interface BreedingAnimalWithCounts extends BreedingAnimal {
  offspringCount: number;
  grandchildrenCount: number;
}

interface ActiveAnimalSummary {
  id: string;
  code: number | null;
  name: string;
  ear_tag: number | null;
  birth_date: string | null;
  registration: string | null;
  sex: string;
  sire_id: string | null;
  dam_id: string | null;
}

interface ActivePregnancySummary {
  id: string;
  code: number | null;
  name: string;
  recipient_id: string | null;
  sex: string | null;
  sire_id: string | null;
  dam_id: string | null;
  status: string;
  transfer_date: string | null;
  ultrasound_date: string | null;
  expected_birth_month: string | null;
}

interface ActiveEmbryoTransferSummary {
  id: string;
  code: number | null;
  name: string;
  recipient_id: string | null;
  sire_id: string | null;
  dam_id: string | null;
  status: string;
  transfer_date: string | null;
  ultrasound_date: string | null;
  expected_aspiration_month: string | null;
}

interface ActiveAspirationSummary {
  id: string;
  code: number | null;
  name: string;
  dam_id: string | null;
  embryo_count: number | null;
  status: string;
  aspiration_date: string | null;
  expected_aspiration_month: string | null;
  transfer_date: string | null;
}

type RelationshipType = "children" | "grandchildren";
type LinkedRecordType = "animal" | "pregnancy" | "embryo_transfer" | "aspiration";

interface LinkedRecordSummary {
  key: string;
  id: string;
  type: LinkedRecordType;
  label: string;
  displayName: string;
  code: string;
  name: string;
  earTag: string | null;
  registration: string | null;
  sex: string | null;
  sireId: string | null;
  damId: string | null;
  recipientId: string | null;
  embryoCount: number | null;
  status: string;
  date: string | null;
  transferDate: string | null;
  ultrasoundDate: string | null;
  expectedBirthDate: string | null;
  expectedDiagnosisDate: string | null;
  aspirationDate: string | null;
}

interface DetailedLinkedRecord extends LinkedRecordSummary {
  sireName: string;
  damName: string;
  recipientName: string;
  totalPurchaseAmount: number | null;
  firstInstallmentAmount: number | null;
}

interface RelationshipSummary {
  totalAnimais: number;
  totalPrenhezes: number;
  totalPosTransferencias: number;
  totalAspiracoes: number;
  totalGeral: number;
}

interface RelationshipReportData {
  animalSelecionado: BreedingAnimalWithCounts;
  tipoRelatorio: RelationshipType;
  resumo: RelationshipSummary;
  records: DetailedLinkedRecord[];
  animais: DetailedLinkedRecord[];
  prenhezes: DetailedLinkedRecord[];
  posTransferencias: DetailedLinkedRecord[];
  aspiracoes: DetailedLinkedRecord[];
}

interface RelationshipModalState {
  open: boolean;
  type: RelationshipType;
  animal: BreedingAnimalWithCounts | null;
  records: DetailedLinkedRecord[];
  loading: boolean;
}

const ACTIVE_PREGNANCY_STATUSES = ["in_progress"];
const ACTIVE_EMBRYO_TRANSFER_STATUSES = ["in_progress"];
const ACTIVE_ASPIRATION_STATUSES = ["pending", "in_progress"];

const recordTypeLabels: Record<LinkedRecordType, string> = {
  animal: "Animal",
  pregnancy: "Prenhez",
  embryo_transfer: "Pós-transferência",
  aspiration: "Aspiração",
};

const recordTypeOrder: Record<LinkedRecordType, number> = {
  animal: 0,
  pregnancy: 1,
  embryo_transfer: 2,
  aspiration: 3,
};

const formatCurrencyBR = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDateDisplay = (value: string | null | undefined) => {
  if (!value) return "Não informado";
  const normalized = value.slice(0, 10);
  const parts = normalized.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return value;
};

const formatDateTimeDisplay = (value: Date) =>
  value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const getLinkedRecordStatusLabel = (type: LinkedRecordType, status: string) => {
  if (type === "animal") return "Ativo";
  if (type === "pregnancy") {
    if (status === "in_progress") return "Em Andamento";
    if (status === "finalized_stillborn") return "Finalizado: Natimorto";
    if (status === "sold") return "Vendido";
    return "Finalizado";
  }
  if (type === "embryo_transfer") {
    if (status === "in_progress") return "Em Andamento";
    if (status === "finalized_pregnant") return "Finalizada: Prenha";
    if (status === "finalized_empty") return "Finalizada: Vazia";
    return status;
  }
  if (status === "pending") return "Pendente";
  if (status === "in_progress") return "Em Andamento";
  if (status === "finalized") return "Finalizado";
  if (status === "sold") return "Vendido";
  return status;
};

const getStatusBadgeClasses = (type: LinkedRecordType, status: string) => {
  if (type === "animal") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "pregnancy") {
    if (status === "in_progress") return "border-yellow-200 bg-yellow-50 text-yellow-700";
    if (status === "finalized_stillborn") return "border-red-200 bg-red-50 text-red-700";
    if (status === "sold") return "border-slate-200 bg-slate-50 text-slate-700";
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (type === "embryo_transfer") {
    if (status === "in_progress") return "border-yellow-200 bg-yellow-50 text-yellow-700";
    if (status === "finalized_pregnant") return "border-green-200 bg-green-50 text-green-700";
    if (status === "finalized_empty") return "border-red-200 bg-red-50 text-red-700";
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  if (status === "pending") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "in_progress") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (status === "finalized") return "border-green-200 bg-green-50 text-green-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const sortLinkedRecords = <T extends LinkedRecordSummary>(records: T[]) =>
  [...records].sort((a, b) => {
    const typeOrderDiff = recordTypeOrder[a.type] - recordTypeOrder[b.type];
    if (typeOrderDiff !== 0) return typeOrderDiff;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

const AnimaisMatrizes = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [breedingAnimals, setBreedingAnimals] = useState<BreedingAnimalWithCounts[]>([]);
  const [allBreedingAnimals, setAllBreedingAnimals] = useState<BreedingAnimal[]>([]);
  const [activeAnimals, setActiveAnimals] = useState<ActiveAnimalSummary[]>([]);
  const [activePregnancies, setActivePregnancies] = useState<ActivePregnancySummary[]>([]);
  const [activeEmbryoTransfers, setActiveEmbryoTransfers] = useState<ActiveEmbryoTransferSummary[]>([]);
  const [activeAspirations, setActiveAspirations] = useState<ActiveAspirationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<BreedingAnimalWithCounts | null>(null);
  const [relationshipModal, setRelationshipModal] = useState<RelationshipModalState>({
    open: false,
    type: "children",
    animal: null,
    records: [],
    loading: false,
  });
  const [formData, setFormData] = useState({
    name: "",
    sex: "",
    registration: "",
    sire_id: "",
    dam_id: "",
    animal_id: "",
  });
  const [filters, setFilters] = useState({
    name: "",
    sex: "",
  });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const relationshipRequestRef = useRef(0);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchBreedingAnimals();
  }, []);

  const getUserStoreId = async (userId: string): Promise<string | null> => {
    const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", userId).single();
    if (profile?.store_id) return profile.store_id;

    const { data: userStore } = await supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return userStore?.store_id || null;
  };

  const fetchBreedingAnimals = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        setIsLoading(false);
        return;
      }

      const storeId = await getUserStoreId(user.id);
      if (!storeId) {
        toast.error("Loja não encontrada");
        setIsLoading(false);
        return;
      }

      const [
        { data: breedingData, error: breedingError },
        { data: activeAnimalsData, error: animalsError },
        { data: pregnancyData, error: pregnancyError },
        { data: embryoTransferData, error: embryoTransferError },
        { data: aspirationData, error: aspirationError },
      ] = await Promise.all([
        supabase
          .from("breeding_animals")
          .select("id, name, sex, registration, store_id, sire_id, dam_id, animal_id")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("animals")
          .select("id, code, name, ear_tag, birth_date, registration, sex, sire_id, dam_id")
          .eq("store_id", storeId)
          .eq("is_active", true),
        supabase
          .from("pregnancy_management")
          .select("id, code, name, recipient_id, sex, sire_id, dam_id, status, transfer_date, ultrasound_date, expected_birth_month")
          .eq("store_id", storeId)
          .in("status", ACTIVE_PREGNANCY_STATUSES),
        supabase
          .from("embryo_transfer_management")
          .select("id, code, name, recipient_id, sire_id, dam_id, status, transfer_date, ultrasound_date, expected_aspiration_month")
          .eq("store_id", storeId)
          .in("status", ACTIVE_EMBRYO_TRANSFER_STATUSES),
        supabase
          .from("aspiration_management")
          .select("id, code, name, dam_id, embryo_count, status, aspiration_date, expected_aspiration_month, transfer_date")
          .eq("store_id", storeId)
          .in("status", ACTIVE_ASPIRATION_STATUSES),
      ]);

      if (breedingError) throw breedingError;
      if (animalsError) throw animalsError;
      if (pregnancyError) throw pregnancyError;
      if (embryoTransferError) throw embryoTransferError;
      if (aspirationError) throw aspirationError;

      const allAnimals = (breedingData || []) as BreedingAnimal[];
      const activeAnimalRows = (activeAnimalsData || []) as ActiveAnimalSummary[];
      const activePregnancyRows = (pregnancyData || []) as ActivePregnancySummary[];
      const activeEmbryoTransferRows = (embryoTransferData || []) as ActiveEmbryoTransferSummary[];
      const activeAspirationRows = (aspirationData || []) as ActiveAspirationSummary[];

      setAllBreedingAnimals(allAnimals);
      setActiveAnimals(activeAnimalRows);
      setActivePregnancies(activePregnancyRows);
      setActiveEmbryoTransfers(activeEmbryoTransferRows);
      setActiveAspirations(activeAspirationRows);
    } catch (error: any) {
      toast.error("Erro ao carregar matrizes e genitores: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (animal?: BreedingAnimalWithCounts) => {
    if (animal) {
      setSelectedAnimal(animal);
      setFormData({
        name: animal.name,
        sex: animal.sex,
        registration: animal.registration || "",
        sire_id: animal.sire_id || "",
        dam_id: animal.dam_id || "",
        animal_id: animal.animal_id || "",
      });
    } else {
      setSelectedAnimal(null);
      setFormData({
        name: "",
        sex: "",
        registration: "",
        sire_id: "",
        dam_id: "",
        animal_id: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.sex) {
      toast.error("Sexo é obrigatório");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const storeId = await getUserStoreId(user.id);
      if (!storeId) {
        toast.error("Loja não encontrada");
        return;
      }

      // Fetch user's matrix_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("matrix_id")
        .eq("id", user.id)
        .maybeSingle();

      // Check for duplicate name
      const { data: existingAnimal } = await supabase
        .from("breeding_animals")
        .select("id")
        .eq("store_id", storeId)
        .eq("name", formData.name.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (existingAnimal && (!selectedAnimal || existingAnimal.id !== selectedAnimal.id)) {
        toast.error("Já existe uma matriz/genitor com este nome");
        return;
      }

      // Um animal só pode estar vinculado a uma única matriz/genitor
      if (formData.animal_id) {
        const { data: existingLink } = await supabase
          .from("breeding_animals")
          .select("id")
          .eq("animal_id", formData.animal_id)
          .maybeSingle();

        if (existingLink && (!selectedAnimal || existingLink.id !== selectedAnimal.id)) {
          toast.error("Este animal já está vinculado a outra matriz/genitor");
          return;
        }
      }

      const animalData: any = {
        name: formData.name.trim(),
        sex: formData.sex,
        registration: formData.registration.trim() || null,
        sire_id: formData.sire_id || null,
        dam_id: formData.dam_id || null,
        animal_id: formData.animal_id || null,
        store_id: storeId,
        matrix_id: profileData?.matrix_id || null,
      };

      if (selectedAnimal) {
        const { error } = await supabase.from("breeding_animals").update(animalData).eq("id", selectedAnimal.id);

        if (error) throw error;
        toast.success("Matriz/Genitor atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("breeding_animals").insert(animalData);

        if (error) throw error;
        toast.success("Matriz/Genitor cadastrado com sucesso!");
      }

      setIsModalOpen(false);
      fetchBreedingAnimals();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedAnimal) return;

    try {
      const { error } = await supabase
        .from("breeding_animals")
        .update({ is_active: false, animal_id: null })
        .eq("id", selectedAnimal.id);

      if (error) throw error;
      toast.success("Matriz/Genitor excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setSelectedAnimal(null);
      fetchBreedingAnimals();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const openDeleteDialog = async (animal: BreedingAnimalWithCounts) => {
    const totalLinked = animal.offspringCount;

    if (totalLinked > 0) {
      toast.error(`Não é possível excluir. Existem ${totalLinked} animal(is) vinculado(s) a esta matriz/genitor.`);
      return;
    }

    setSelectedAnimal(animal);
    setIsDeleteDialogOpen(true);
  };

  const generateOffspringReport = async (animal: BreedingAnimalWithCounts) => {
    await generateRelationshipReport(animal, "children");
  };

  const generateGrandchildrenReport = async (animal: BreedingAnimalWithCounts) => {
    await generateRelationshipReport(animal, "grandchildren");
  };

  const getSexLabel = (sex: string) => {
    return sex === "macho" ? "Macho" : "Fêmea";
  };

  const getOptionalSexLabel = (sex: string | null) => {
    if (sex === "macho") return "Macho";
    if (sex === "femea") return "Fêmea";
    return "Não informado";
  };

  const breedingAnimalNameById = useMemo(
    () => new Map(allBreedingAnimals.map((animal) => [animal.id, animal.name])),
    [allBreedingAnimals],
  );

  const activeAnimalById = useMemo(
    () => new Map(activeAnimals.map((animal) => [animal.id, animal])),
    [activeAnimals],
  );

  const breedingChildrenByParentId = useMemo(() => {
    const childrenByParentId = new Map<string, string[]>();

    allBreedingAnimals.forEach((animal) => {
      if (animal.sire_id) {
        const current = childrenByParentId.get(animal.sire_id) || [];
        current.push(animal.id);
        childrenByParentId.set(animal.sire_id, current);
      }

      if (animal.dam_id) {
        const current = childrenByParentId.get(animal.dam_id) || [];
        current.push(animal.id);
        childrenByParentId.set(animal.dam_id, current);
      }
    });

    return childrenByParentId;
  }, [allBreedingAnimals]);

  const directLinkedRecordsByParentId = useMemo(() => {
    const recordsByParentId = new Map<string, Map<string, LinkedRecordSummary>>();

    const registerRecord = (parentId: string | null, record: LinkedRecordSummary) => {
      if (!parentId) return;

      if (!recordsByParentId.has(parentId)) {
        recordsByParentId.set(parentId, new Map());
      }

      recordsByParentId.get(parentId)!.set(record.key, record);
    };

    activeAnimals.forEach((animal) => {
      const record: LinkedRecordSummary = {
        key: `animal:${animal.id}`,
        id: animal.id,
        type: "animal",
        label: recordTypeLabels.animal,
        displayName: `${animal.code ?? "-"} - ${animal.name}`,
        code: animal.code?.toString() || "Não informado",
        name: animal.name,
        earTag: animal.ear_tag?.toString() || null,
        registration: animal.registration || null,
        sex: animal.sex,
        sireId: animal.sire_id,
        damId: animal.dam_id,
        recipientId: null,
        embryoCount: null,
        status: "active",
        date: animal.birth_date,
        transferDate: null,
        ultrasoundDate: null,
        expectedBirthDate: null,
        expectedDiagnosisDate: null,
        aspirationDate: null,
      };

      registerRecord(animal.sire_id, record);
      registerRecord(animal.dam_id, record);
    });

    activePregnancies.forEach((pregnancy) => {
      const record: LinkedRecordSummary = {
        key: `pregnancy:${pregnancy.id}`,
        id: pregnancy.id,
        type: "pregnancy",
        label: recordTypeLabels.pregnancy,
        displayName: `${pregnancy.code ?? "-"} - ${pregnancy.name}`,
        code: pregnancy.code?.toString() || "Não informado",
        name: pregnancy.name,
        earTag: null,
        registration: null,
        sex: pregnancy.sex,
        sireId: pregnancy.sire_id,
        damId: pregnancy.dam_id,
        recipientId: pregnancy.recipient_id,
        embryoCount: null,
        status: pregnancy.status,
        date: pregnancy.ultrasound_date || pregnancy.transfer_date || pregnancy.expected_birth_month,
        transferDate: pregnancy.transfer_date,
        ultrasoundDate: pregnancy.ultrasound_date,
        expectedBirthDate: pregnancy.expected_birth_month,
        expectedDiagnosisDate: null,
        aspirationDate: null,
      };

      registerRecord(pregnancy.sire_id, record);
      registerRecord(pregnancy.dam_id, record);
    });

    activeEmbryoTransfers.forEach((transfer) => {
      const record: LinkedRecordSummary = {
        key: `embryo_transfer:${transfer.id}`,
        id: transfer.id,
        type: "embryo_transfer",
        label: recordTypeLabels.embryo_transfer,
        displayName: `${transfer.code ?? "-"} - ${transfer.name}`,
        code: transfer.code?.toString() || "Não informado",
        name: transfer.name,
        earTag: null,
        registration: null,
        sex: null,
        sireId: transfer.sire_id,
        damId: transfer.dam_id,
        recipientId: transfer.recipient_id,
        embryoCount: null,
        status: transfer.status,
        date: transfer.transfer_date || transfer.ultrasound_date || transfer.expected_aspiration_month,
        transferDate: transfer.transfer_date,
        ultrasoundDate: null,
        expectedBirthDate: null,
        expectedDiagnosisDate: transfer.ultrasound_date || transfer.expected_aspiration_month,
        aspirationDate: null,
      };

      registerRecord(transfer.sire_id, record);
      registerRecord(transfer.dam_id, record);
    });

    activeAspirations.forEach((aspiration) => {
      const record: LinkedRecordSummary = {
        key: `aspiration:${aspiration.id}`,
        id: aspiration.id,
        type: "aspiration",
        label: recordTypeLabels.aspiration,
        displayName: `${aspiration.code ?? "-"} - ${aspiration.name}`,
        code: aspiration.code?.toString() || "Não informado",
        name: aspiration.name,
        earTag: null,
        registration: null,
        sex: null,
        sireId: null,
        damId: aspiration.dam_id,
        recipientId: null,
        embryoCount: aspiration.embryo_count,
        status: aspiration.status,
        date: aspiration.aspiration_date || aspiration.expected_aspiration_month || aspiration.transfer_date,
        transferDate: aspiration.transfer_date,
        ultrasoundDate: null,
        expectedBirthDate: null,
        expectedDiagnosisDate: aspiration.expected_aspiration_month,
        aspirationDate: aspiration.aspiration_date,
      };

      registerRecord(aspiration.dam_id, record);
    });

    return recordsByParentId;
  }, [activeAnimals, activeAspirations, activeEmbryoTransfers, activePregnancies]);

  const getRelatedRecords = (animalId: string, relationshipType: RelationshipType) => {
    if (relationshipType === "children") {
      return sortLinkedRecords(Array.from(directLinkedRecordsByParentId.get(animalId)?.values() || []));
    }

    const uniqueRecords = new Map<string, LinkedRecordSummary>();
    const childIds = breedingChildrenByParentId.get(animalId) || [];

    childIds.forEach((childId) => {
      const childRecords = directLinkedRecordsByParentId.get(childId);
      childRecords?.forEach((record, key) => {
        uniqueRecords.set(key, record);
      });
    });

    return sortLinkedRecords(Array.from(uniqueRecords.values()));
  };

  const fetchFinancialDetailsForRecords = async (records: LinkedRecordSummary[]) => {
    const purchaseSummaries = new Map<string, { totalPurchaseAmount: number | null; firstInstallmentAmount: number | null }>();
    const animalIds = Array.from(new Set(records.filter((record) => record.type === "animal").map((record) => record.id)));
    const pregnancyIds = Array.from(new Set(records.filter((record) => record.type === "pregnancy").map((record) => record.id)));
    const aspirationIds = Array.from(new Set(records.filter((record) => record.type === "aspiration").map((record) => record.id)));

    const purchaseQueries: Array<Promise<{ data: any[] | null; error: any }>> = [
      animalIds.length > 0
        ? supabase
            .from("purchases")
            .select("id, total_amount, animal_id")
            .eq("purchase_type", "animal")
            .in("animal_id", animalIds)
        : Promise.resolve({ data: [], error: null }),
      pregnancyIds.length > 0
        ? supabase
            .from("purchases")
            .select("id, total_amount, pregnancy_id")
            .eq("purchase_type", "pregnancy")
            .in("pregnancy_id", pregnancyIds)
        : Promise.resolve({ data: [], error: null }),
      aspirationIds.length > 0
        ? supabase
            .from("purchases")
            .select("id, total_amount, aspiration_id")
            .eq("purchase_type", "aspiration")
            .in("aspiration_id", aspirationIds)
        : Promise.resolve({ data: [], error: null }),
    ];

    const [animalPurchases, pregnancyPurchases, aspirationPurchases] = await Promise.all(purchaseQueries);

    if (animalPurchases.error) throw animalPurchases.error;
    if (pregnancyPurchases.error) throw pregnancyPurchases.error;
    if (aspirationPurchases.error) throw aspirationPurchases.error;

    const purchases = [
      ...((animalPurchases.data || []) as Array<{ id: string; total_amount: number; animal_id: string | null }>),
      ...((pregnancyPurchases.data || []) as Array<{ id: string; total_amount: number; pregnancy_id: string | null }>),
      ...((aspirationPurchases.data || []) as Array<{ id: string; total_amount: number; aspiration_id: string | null }>),
    ];

    if (purchases.length > 0) {
      const purchaseIds = purchases.map((purchase) => purchase.id);
      const { data: linkedPayables, error: linkedPayablesError } = await supabase
        .from("accounts_payable")
        .select("id, purchase_id")
        .in("purchase_id", purchaseIds);

      if (linkedPayablesError) throw linkedPayablesError;

      const payablesByPurchaseId = new Map<string, string[]>();
      (linkedPayables || []).forEach((payable) => {
        if (!payable.purchase_id) return;
        const current = payablesByPurchaseId.get(payable.purchase_id) || [];
        current.push(payable.id);
        payablesByPurchaseId.set(payable.purchase_id, current);
      });

      const payableIds = (linkedPayables || []).map((payable) => payable.id);
      const { data: firstInstallments, error: installmentsError } = payableIds.length > 0
        ? await supabase
            .from("accounts_payable_installments")
            .select("account_payable_id, amount")
            .eq("installment_number", 1)
            .in("account_payable_id", payableIds)
        : { data: [], error: null };

      if (installmentsError) throw installmentsError;

      const firstInstallmentByPayableId = new Map<string, number>();
      (firstInstallments || []).forEach((installment) => {
        firstInstallmentByPayableId.set(
          installment.account_payable_id,
          (firstInstallmentByPayableId.get(installment.account_payable_id) || 0) + Number(installment.amount || 0),
        );
      });

      purchases.forEach((purchase) => {
        const key = purchase.animal_id
          ? `animal:${purchase.animal_id}`
          : purchase.pregnancy_id
            ? `pregnancy:${purchase.pregnancy_id}`
            : purchase.aspiration_id
              ? `aspiration:${purchase.aspiration_id}`
              : null;

        if (!key) return;

        const current = purchaseSummaries.get(key) || { totalPurchaseAmount: 0, firstInstallmentAmount: 0 };
        const payableFirstInstallment = (payablesByPurchaseId.get(purchase.id) || []).reduce(
          (sum, payableId) => sum + (firstInstallmentByPayableId.get(payableId) || 0),
          0,
        );

        purchaseSummaries.set(key, {
          totalPurchaseAmount: Number(current.totalPurchaseAmount || 0) + Number(purchase.total_amount || 0),
          firstInstallmentAmount: Number(current.firstInstallmentAmount || 0) + payableFirstInstallment,
        });
      });
    }

    const allocationQueries: Array<Promise<{ data: any[] | null; error: any }>> = [
      animalIds.length > 0
        ? supabase
            .from("accounts_payable_item_allocations")
            .select("account_payable_item_id, animal_id")
            .eq("allocation_type", "animal")
            .in("animal_id", animalIds)
        : Promise.resolve({ data: [], error: null }),
      pregnancyIds.length > 0
        ? supabase
            .from("accounts_payable_item_allocations")
            .select("account_payable_item_id, pregnancy_id")
            .eq("allocation_type", "pregnancy")
            .in("pregnancy_id", pregnancyIds)
        : Promise.resolve({ data: [], error: null }),
      Array.from(new Set(records.filter((record) => record.type === "embryo_transfer").map((record) => record.id))).length > 0
        ? supabase
            .from("accounts_payable_item_allocations")
            .select("account_payable_item_id, embryo_transfer_id")
            .eq("allocation_type", "embryo_transfer")
            .in("embryo_transfer_id", Array.from(new Set(records.filter((record) => record.type === "embryo_transfer").map((record) => record.id))))
        : Promise.resolve({ data: [], error: null }),
      aspirationIds.length > 0
        ? supabase
            .from("accounts_payable_item_allocations")
            .select("account_payable_item_id, aspiration_id")
            .eq("allocation_type", "aspiration")
            .in("aspiration_id", aspirationIds)
        : Promise.resolve({ data: [], error: null }),
    ];

    const [animalAllocations, pregnancyAllocations, embryoAllocations, aspirationAllocations] = await Promise.all(allocationQueries);

    if (animalAllocations.error) throw animalAllocations.error;
    if (pregnancyAllocations.error) throw pregnancyAllocations.error;
    if (embryoAllocations.error) throw embryoAllocations.error;
    if (aspirationAllocations.error) throw aspirationAllocations.error;

    const allocationRows = [
      ...((animalAllocations.data || []) as Array<{ account_payable_item_id: string; animal_id: string | null }>),
      ...((pregnancyAllocations.data || []) as Array<{ account_payable_item_id: string; pregnancy_id: string | null }>),
      ...((embryoAllocations.data || []) as Array<{ account_payable_item_id: string; embryo_transfer_id: string | null }>),
      ...((aspirationAllocations.data || []) as Array<{ account_payable_item_id: string; aspiration_id: string | null }>),
    ];

    const accountPayableItemIds = Array.from(new Set(allocationRows.map((row) => row.account_payable_item_id)));
    if (accountPayableItemIds.length === 0) {
      return purchaseSummaries;
    }

    const { data: payableItems, error: payableItemsError } = await supabase
      .from("accounts_payable_items")
      .select("id, account_payable_id, total_price")
      .in("id", accountPayableItemIds);

    if (payableItemsError) throw payableItemsError;

    const payableItemById = new Map(
      (payableItems || []).map((item) => [item.id, { accountPayableId: item.account_payable_id, totalPrice: Number(item.total_price || 0) }]),
    );

    const fallbackPayableIds = Array.from(
      new Set(
        (payableItems || [])
          .map((item) => item.account_payable_id)
          .filter(Boolean),
      ),
    );

    const { data: fallbackFirstInstallments, error: fallbackInstallmentsError } = fallbackPayableIds.length > 0
      ? await supabase
          .from("accounts_payable_installments")
          .select("account_payable_id, amount")
          .eq("installment_number", 1)
          .in("account_payable_id", fallbackPayableIds)
      : { data: [], error: null };

    if (fallbackInstallmentsError) throw fallbackInstallmentsError;

    const fallbackFirstInstallmentByPayableId = new Map<string, number>();
    (fallbackFirstInstallments || []).forEach((installment) => {
      fallbackFirstInstallmentByPayableId.set(
        installment.account_payable_id,
        (fallbackFirstInstallmentByPayableId.get(installment.account_payable_id) || 0) + Number(installment.amount || 0),
      );
    });

    allocationRows.forEach((allocation) => {
      const key = "animal_id" in allocation && allocation.animal_id
        ? `animal:${allocation.animal_id}`
        : "pregnancy_id" in allocation && allocation.pregnancy_id
          ? `pregnancy:${allocation.pregnancy_id}`
          : "embryo_transfer_id" in allocation && allocation.embryo_transfer_id
            ? `embryo_transfer:${allocation.embryo_transfer_id}`
            : "aspiration_id" in allocation && allocation.aspiration_id
              ? `aspiration:${allocation.aspiration_id}`
              : null;

      if (!key || purchaseSummaries.has(key)) return;

      const payableItem = payableItemById.get(allocation.account_payable_item_id);
      if (!payableItem) return;

      const current = purchaseSummaries.get(key) || { totalPurchaseAmount: 0, firstInstallmentAmount: 0 };
      purchaseSummaries.set(key, {
        totalPurchaseAmount: Number(current.totalPurchaseAmount || 0) + payableItem.totalPrice,
        firstInstallmentAmount:
          Number(current.firstInstallmentAmount || 0) +
          (fallbackFirstInstallmentByPayableId.get(payableItem.accountPayableId) || 0),
      });
    });

    return purchaseSummaries;
  };

  const buildDetailedRelationshipRecords = async (records: LinkedRecordSummary[]) => {
    const financialDetails = await fetchFinancialDetailsForRecords(records);

    return records.map((record) => {
      const financial = financialDetails.get(record.key);
      const recipientAnimal = record.recipientId ? activeAnimalById.get(record.recipientId) : null;
      return {
        ...record,
        recipientName: recipientAnimal
          ? `${recipientAnimal.code ?? "-"} - ${recipientAnimal.name}`
          : "Não informado",
        sireName: record.sireId ? breedingAnimalNameById.get(record.sireId) || "Não informado" : "Não informado",
        damName: record.damId ? breedingAnimalNameById.get(record.damId) || "Não informado" : "Não informado",
        totalPurchaseAmount: typeof financial?.totalPurchaseAmount === "number" ? financial.totalPurchaseAmount : null,
        firstInstallmentAmount:
          typeof financial?.firstInstallmentAmount === "number" && financial.firstInstallmentAmount > 0
            ? financial.firstInstallmentAmount
            : null,
      } as DetailedLinkedRecord;
    });
  };

  const getRelatorioVinculosAnimal = async (
    animal: BreedingAnimalWithCounts,
    tipoRelatorio: RelationshipType,
  ): Promise<RelationshipReportData> => {
    const baseRecords = getRelatedRecords(animal.id, tipoRelatorio);
    const detailedRecords = await buildDetailedRelationshipRecords(baseRecords);

    const animais = detailedRecords.filter((record) => record.type === "animal");
    const prenhezes = detailedRecords.filter((record) => record.type === "pregnancy");
    const posTransferencias = detailedRecords.filter((record) => record.type === "embryo_transfer");
    const aspiracoes = detailedRecords.filter((record) => record.type === "aspiration");

    return {
      animalSelecionado: animal,
      tipoRelatorio,
      resumo: {
        totalAnimais: animais.length,
        totalPrenhezes: prenhezes.length,
        totalPosTransferencias: posTransferencias.length,
        totalAspiracoes: aspiracoes.length,
        totalGeral: detailedRecords.length,
      },
      records: detailedRecords,
      animais,
      prenhezes,
      posTransferencias,
      aspiracoes,
    };
  };

  const loadLogoForPdf = async () => {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = elitebovLogo;
    });
  };

  const generateRelationshipReport = async (animal: BreedingAnimalWithCounts, tipoRelatorio: RelationshipType) => {
    try {
      const reportData = await getRelatorioVinculosAnimal(animal, tipoRelatorio);
      const generatedAt = new Date();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const headerTop = 12;
      const title = tipoRelatorio === "children" ? "Relatório de Filhos Ativos" : "Relatório de Netos Ativos";
      const safeAnimalName = sanitizeFileName(animal.name || "animal");
      const fileName = `${tipoRelatorio === "children" ? "relatorio_filhos" : "relatorio_netos"}_${safeAnimalName}.pdf`;
      const logo = await loadLogoForPdf();

      const addFooter = (pageNumber: number) => {
        doc.setDrawColor(224, 229, 236);
        doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);
        doc.setFontSize(8.5);
        doc.setTextColor(92, 102, 116);
        doc.text("EliteBov", marginX, pageHeight - 5.5);
        doc.text(`Gerado em ${formatDateTimeDisplay(generatedAt)}`, pageWidth / 2, pageHeight - 5.5, { align: "center" });
        doc.text(`Página ${pageNumber}`, pageWidth - marginX, pageHeight - 5.5, { align: "right" });
      };

      const drawHeader = () => {
        doc.setFillColor(24, 36, 56);
        doc.roundedRect(marginX, headerTop, pageWidth - marginX * 2, 28, 4, 4, "F");

        if (logo) {
          doc.addImage(logo, "PNG", marginX + 5, headerTop + 4, 20, 20);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(title, logo ? marginX + 30 : marginX + 6, headerTop + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Matriz/Genitor: ${reportData.animalSelecionado.name}`, logo ? marginX + 30 : marginX + 6, headerTop + 17);
        doc.text(`Emitido em ${formatDateTimeDisplay(generatedAt)}`, logo ? marginX + 30 : marginX + 6, headerTop + 23);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Total geral: ${reportData.resumo.totalGeral}`, pageWidth - marginX - 6, headerTop + 12, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(animal.registration ? `Registro: ${animal.registration}` : "Registro: Não informado", pageWidth - marginX - 6, headerTop + 19, {
          align: "right",
        });
      };

      const summaryCards = [
        { label: "Animais ativos", value: reportData.resumo.totalAnimais, fill: [232, 242, 255] as [number, number, number] },
        { label: "Prenhezes", value: reportData.resumo.totalPrenhezes, fill: [255, 248, 220] as [number, number, number] },
        { label: "Pós-transferências", value: reportData.resumo.totalPosTransferencias, fill: [235, 248, 238] as [number, number, number] },
        { label: "Aspirações", value: reportData.resumo.totalAspiracoes, fill: [237, 245, 255] as [number, number, number] },
        { label: "Total geral", value: reportData.resumo.totalGeral, fill: [242, 236, 251] as [number, number, number] },
      ];

      drawHeader();

      const cardGap = 4;
      const cardWidth = (pageWidth - marginX * 2 - cardGap * 4) / 5;
      const cardTop = headerTop + 34;

      summaryCards.forEach((card, index) => {
        const x = marginX + index * (cardWidth + cardGap);
        doc.setFillColor(card.fill[0], card.fill[1], card.fill[2]);
        doc.setDrawColor(223, 228, 235);
        doc.roundedRect(x, cardTop, cardWidth, 18, 3, 3, "FD");
        doc.setTextColor(90, 101, 117);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(card.label, x + 3, cardTop + 6);
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(15);
        doc.text(String(card.value), x + 3, cardTop + 13);
      });

      let currentY = cardTop + 24;

      if (reportData.resumo.totalGeral === 0) {
        doc.setTextColor(78, 88, 104);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.text("Nenhum vínculo ativo encontrado para este animal.", marginX, currentY + 10);
        for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
          doc.setPage(page);
          addFooter(page);
        }
        doc.save(fileName);
        toast.success("Relatório gerado com sucesso!");
        return;
      }

      const sectionConfigs: Array<{
        title: string;
        subtitle: string;
        rows: DetailedLinkedRecord[];
        head: string[][];
        body: (record: DetailedLinkedRecord) => string[];
      }> = [
        {
          title: "Bloco 1 — Animais ativos",
          subtitle: `${reportData.animais.length} registro(s)`,
          rows: reportData.animais,
          head: [["Código", "Nome", "Brinco", "Sexo", "Pai", "Mãe", "Valor de compra", "1ª parcela", "Status"]],
          body: (record) => [
            record.code,
            record.name || "Não informado",
            record.earTag || "Não informado",
            getOptionalSexLabel(record.sex),
            record.sireName,
            record.damName,
            formatCurrencyBR(record.totalPurchaseAmount),
            formatCurrencyBR(record.firstInstallmentAmount),
            getLinkedRecordStatusLabel(record.type, record.status),
          ],
        },
        {
          title: "Bloco 2 — Prenhezes em andamento",
          subtitle: `${reportData.prenhezes.length} registro(s)`,
          rows: reportData.prenhezes,
          head: [["Código/ID", "Identificação", "Pai", "Mãe", "Receptora", "Confirmação", "Previsão de parto", "Valor de compra", "1ª parcela", "Status"]],
          body: (record) => [
            record.code,
            record.name || "Não informado",
            record.sireName,
            record.damName,
            record.recipientName,
            formatDateDisplay(record.ultrasoundDate),
            formatDateDisplay(record.expectedBirthDate),
            formatCurrencyBR(record.totalPurchaseAmount),
            formatCurrencyBR(record.firstInstallmentAmount),
            getLinkedRecordStatusLabel(record.type, record.status),
          ],
        },
        {
          title: "Bloco 3 — Pós-transferências de embrião em andamento",
          subtitle: `${reportData.posTransferencias.length} registro(s)`,
          rows: reportData.posTransferencias,
          head: [["Código/ID", "Identificação", "Pai", "Mãe", "Receptora", "Data transf.", "Prev. diagnóstico", "Valor de compra", "1ª parcela", "Status"]],
          body: (record) => [
            record.code,
            record.name || "Não informado",
            record.sireName,
            record.damName,
            record.recipientName,
            formatDateDisplay(record.transferDate),
            formatDateDisplay(record.expectedDiagnosisDate),
            formatCurrencyBR(record.totalPurchaseAmount),
            formatCurrencyBR(record.firstInstallmentAmount),
            getLinkedRecordStatusLabel(record.type, record.status),
          ],
        },
        {
          title: "Bloco 4 — Aspirações em andamento",
          subtitle: `${reportData.aspiracoes.length} registro(s)`,
          rows: reportData.aspiracoes,
          head: [["Código/ID", "Identificação", "Doadora/Mãe", "Reprodutor/Pai", "Data aspiração", "Embriões", "Valor de compra", "1ª parcela", "Status"]],
          body: (record) => [
            record.code,
            record.name || "Não informado",
            record.damName,
            record.sireName,
            formatDateDisplay(record.aspirationDate),
            record.embryoCount !== null && record.embryoCount !== undefined ? String(record.embryoCount) : "Não informado",
            formatCurrencyBR(record.totalPurchaseAmount),
            formatCurrencyBR(record.firstInstallmentAmount),
            getLinkedRecordStatusLabel(record.type, record.status),
          ],
        },
      ];

      sectionConfigs.forEach((section, index) => {
        const minimumHeight = section.rows.length === 0 ? 18 : 30;
        if (currentY + minimumHeight > pageHeight - 18) {
          addFooter(doc.getNumberOfPages());
          doc.addPage();
          currentY = 16;
        }

        doc.setFillColor(246, 248, 251);
        doc.setDrawColor(225, 229, 235);
        doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 10, 2, 2, "FD");
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.text(section.title, marginX + 3, currentY + 6.3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(95, 105, 120);
        doc.text(section.subtitle, pageWidth - marginX - 3, currentY + 6.3, { align: "right" });
        currentY += 13;

        if (section.rows.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(100, 110, 124);
          doc.text("Nenhum registro encontrado.", marginX + 2, currentY + 4);
          currentY += 10;
          return;
        }

        autoTable(doc, {
          startY: currentY,
          head: section.head,
          body: section.rows.map(section.body),
          margin: { left: marginX, right: marginX },
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            textColor: [33, 37, 41],
            lineColor: [227, 232, 238],
            lineWidth: 0.1,
            valign: "middle",
          },
          headStyles: {
            fillColor: [32, 44, 67],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [249, 250, 251],
          },
          bodyStyles: {
            minCellHeight: 6,
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        if (index < sectionConfigs.length - 1 && currentY > pageHeight - 26) {
          addFooter(doc.getNumberOfPages());
          doc.addPage();
          currentY = 16;
        }
      });

      for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
        doc.setPage(page);
        addFooter(page);
      }
      doc.save(fileName);
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar relatório: " + error.message);
    }
  };

  const handleOpenRelationshipModal = async (animal: BreedingAnimalWithCounts, type: RelationshipType) => {
    const requestId = relationshipRequestRef.current + 1;
    relationshipRequestRef.current = requestId;

    setRelationshipModal({
      open: true,
      type,
      animal,
      records: [],
      loading: true,
    });

    try {
      const reportData = await getRelatorioVinculosAnimal(animal, type);

      if (relationshipRequestRef.current !== requestId) return;

      setRelationshipModal({
        open: true,
        type,
        animal,
        records: reportData.records,
        loading: false,
      });
    } catch (error: any) {
      if (relationshipRequestRef.current !== requestId) return;
      toast.error(`Erro ao carregar ${type === "children" ? "filhos" : "netos"} ativos: ${error.message}`);
      setRelationshipModal({
        open: true,
        type,
        animal,
        records: [],
        loading: false,
      });
    }
  };

  // Get available sires (males) for dropdown, excluding the current animal being edited
  const availableSires = useMemo(
    () => allBreedingAnimals.filter((a) => a.sex === "macho" && (!selectedAnimal || a.id !== selectedAnimal.id)),
    [allBreedingAnimals, selectedAnimal],
  );

  // Get available dams (females) for dropdown, excluding the current animal being edited
  const availableDams = useMemo(
    () => allBreedingAnimals.filter((a) => a.sex === "femea" && (!selectedAnimal || a.id !== selectedAnimal.id)),
    [allBreedingAnimals, selectedAnimal],
  );

  // Animais do rebanho já vinculados a alguma matriz/genitor (exceto o registro em edição)
  const linkedAnimalIds = useMemo(
    () =>
      new Set(
        allBreedingAnimals
          .filter((a) => a.animal_id && (!selectedAnimal || a.id !== selectedAnimal.id))
          .map((a) => a.animal_id as string),
      ),
    [allBreedingAnimals, selectedAnimal],
  );

  // Animais disponíveis para vincular: mesmo sexo da matriz/genitor e ainda não vinculados
  const availableAnimalsForLink = useMemo(
    () =>
      activeAnimals.filter(
        (a) =>
          (!formData.sex || a.sex === formData.sex) &&
          (!linkedAnimalIds.has(a.id) || a.id === formData.animal_id),
      ),
    [activeAnimals, formData.sex, formData.animal_id, linkedAnimalIds],
  );

  useEffect(() => {
    const animalsWithCounts = allBreedingAnimals.map((animal) => ({
      ...animal,
      offspringCount: getRelatedRecords(animal.id, "children").length,
      grandchildrenCount: getRelatedRecords(animal.id, "grandchildren").length,
    }));

    setBreedingAnimals(animalsWithCounts);
  }, [allBreedingAnimals, directLinkedRecordsByParentId, breedingChildrenByParentId]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const filteredAnimals = useMemo(
    () =>
      breedingAnimals.filter((animal) => {
        const matchesName = animal.name.toLowerCase().includes(filters.name.toLowerCase());
        const matchesSex = !filters.sex || filters.sex === "todos" || animal.sex === filters.sex;
        return matchesName && matchesSex;
      }),
    [breedingAnimals, filters.name, filters.sex],
  );

  const sortedAnimals = useMemo(() => {
    const items = [...filteredAnimals];
    items.sort((a, b) => {
      if (!sortColumn) return 0;
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortColumn === "name") return a.name.localeCompare(b.name) * dir;
      if (sortColumn === "sex") return a.sex.localeCompare(b.sex) * dir;
      if (sortColumn === "offspringCount") return (a.offspringCount - b.offspringCount) * dir;
      if (sortColumn === "grandchildrenCount") return (a.grandchildrenCount - b.grandchildrenCount) * dir;
      return 0;
    });
    return items;
  }, [filteredAnimals, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedAnimals.length / itemsPerPage);
  const paginatedAnimals = useMemo(
    () => sortedAnimals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [currentPage, itemsPerPage, sortedAnimals],
  );

  const relationshipModalTitle = relationshipModal.type === "children" ? "Filhos ativos" : "Netos ativos";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card/80 backdrop-blur">
        <div className="page-content flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9 shrink-0 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Matrizes & Genitores</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">Consulta e gestão de matrizes e reprodutores cadastrados.</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()} className="h-10 w-full gap-2 rounded-lg px-4 shadow-sm sm:w-auto">
            <Plus className="h-4 w-4" />
            Cadastrar
          </Button>
        </div>
      </header>

      <main className="page-content px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 rounded-xl border border-border/70 bg-card/70 px-4 py-4 shadow-sm sm:mb-5 sm:px-5 sm:py-5">
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">Filtros</p>
            <p className="text-xs text-muted-foreground">Refine a listagem com uma visualização mais compacta e direta.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Nome</Label>
              <Input
                placeholder="Filtrar por nome"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                className="mt-1 h-10 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Sexo</Label>
              <Select value={filters.sex} onValueChange={(value) => setFilters({ ...filters, sex: value })}>
                <SelectTrigger className="mt-1 h-10 rounded-lg">
                  <SelectValue placeholder="Filtrar por sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          {isMobile ? (
            <div className="space-y-3 p-3">
              {isLoading ? (
                <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : paginatedAnimals.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma matriz ou genitor encontrado
                </div>
              ) : (
                paginatedAnimals.map((animal) => (
                  <article key={animal.id} className="rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-foreground">{animal.name}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registro: <span className="font-medium text-foreground/85">{animal.registration || "-"}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                        {getSexLabel(animal.sex)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {animal.offspringCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRelationshipModal(animal, "children")}
                          className="rounded-lg bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Filhos ativos</p>
                          <p className="mt-1 text-base font-semibold text-primary">{animal.offspringCount}</p>
                        </button>
                      ) : (
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Filhos ativos</p>
                          <p className="mt-1 text-base font-semibold text-foreground">{animal.offspringCount}</p>
                        </div>
                      )}
                      {animal.grandchildrenCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRelationshipModal(animal, "grandchildren")}
                          className="rounded-lg bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Netos ativos</p>
                          <p className="mt-1 text-base font-semibold text-primary">{animal.grandchildrenCount}</p>
                        </button>
                      ) : (
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Netos ativos</p>
                          <p className="mt-1 text-base font-semibold text-foreground">{animal.grandchildrenCount}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-10 w-full justify-between rounded-lg">
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Relatórios
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background">
                          <DropdownMenuItem onClick={() => generateOffspringReport(animal)}>
                            PDF - Animais Filhos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateGrandchildrenReport(animal)}>
                            PDF - Animais Netos
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="h-10 rounded-lg"
                          onClick={() => handleOpenModal(animal)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 rounded-lg"
                          onClick={() => openDeleteDialog(animal)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <Table className="min-w-[900px] table-sticky-first table-sticky-last">
                <TableHeader className="bg-muted/35 [&_tr]:border-border/70">
                  <TableRow>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">Nome <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("sex")}>
                      <div className="flex items-center gap-1">Sexo <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Registro</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("offspringCount")}>
                      <div className="flex items-center gap-1">Animais Filhos Ativos <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("grandchildrenCount")}>
                      <div className="flex items-center gap-1">Animais Netos Ativos <ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : paginatedAnimals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                        Nenhuma matriz ou genitor encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAnimals.map((animal) => (
                      <TableRow key={animal.id} className="border-border/60 hover:bg-muted/25">
                        <TableCell className="px-4 py-3 font-medium text-foreground">{animal.name}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">{getSexLabel(animal.sex)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">{animal.registration || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {animal.offspringCount > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto px-0 py-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
                              onClick={() => handleOpenRelationshipModal(animal, "children")}
                            >
                              {animal.offspringCount}
                            </Button>
                          ) : (
                            animal.offspringCount
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-foreground">
                          {animal.grandchildrenCount > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto px-0 py-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
                              onClick={() => handleOpenRelationshipModal(animal, "grandchildren")}
                            >
                              {animal.grandchildrenCount}
                            </Button>
                          ) : (
                            animal.grandchildrenCount
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 max-md:h-10 rounded-lg">
                                  <FileText className="mr-1 h-3 w-3" />
                                  Relatório
                                  <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => generateOffspringReport(animal)}>
                                  PDF - Animais Filhos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generateGrandchildrenReport(animal)}>
                                  PDF - Animais Netos
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 md:h-8 w-10 md:w-8 rounded-lg"
                              onClick={() => handleOpenModal(animal)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 md:h-8 w-10 md:w-8 rounded-lg"
                              onClick={() => openDeleteDialog(animal)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-center text-sm text-muted-foreground sm:text-left">
                Página {currentPage} de {totalPages} ({sortedAnimals.length} registros)
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg sm:w-auto"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg sm:w-auto"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAnimal ? "Editar Matriz/Genitor" : "Cadastrar Matriz/Genitor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do animal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sexo *</Label>
              <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registro</Label>
              <Input
                id="registration"
                value={formData.registration}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                placeholder="Número de registro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="animal_id">Animal vinculado</Label>
              <Select
                value={formData.animal_id || "_none"}
                onValueChange={(value) => setFormData({ ...formData, animal_id: value === "_none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o animal do rebanho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {availableAnimalsForLink.map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.name}
                      {animal.ear_tag ? ` - Brinco: ${animal.ear_tag}` : ""}
                      {animal.registration ? ` (${animal.registration})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincule esta matriz/genitor a um animal do rebanho para carregar a genealogia na reprodução.
              </p>
            </div>

            {/* Genealogy Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-3">Genealogia</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sire_id">Nome do Reprodutor (Pai)</Label>
                  <Select
                    value={formData.sire_id || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, sire_id: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o reprodutor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {availableSires.map((sire) => (
                        <SelectItem key={sire.id} value={sire.id}>
                          {sire.name} {sire.registration ? `(${sire.registration})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dam_id">Nome da Matriz (Mãe)</Label>
                  <Select
                    value={formData.dam_id || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, dam_id: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a matriz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {availableDams.map((dam) => (
                        <SelectItem key={dam.id} value={dam.id}>
                          {dam.name} {dam.registration ? `(${dam.registration})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={relationshipModal.open}
        onOpenChange={(open) =>
          setRelationshipModal((current) => ({
            ...current,
            open,
          }))
        }
      >
        <DialogContent className="flex max-h-[85dvh] max-w-5xl flex-col overflow-hidden p-0 sm:p-0">
          <DialogHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
            <DialogTitle className="text-left text-lg font-semibold text-foreground sm:text-xl">
              {relationshipModalTitle}
            </DialogTitle>
            <p className="text-left text-sm text-muted-foreground">
              {relationshipModal.animal?.name || "-"}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {relationshipModal.loading ? (
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                Carregando vínculos...
              </div>
            ) : relationshipModal.records.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum vínculo encontrado.
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {relationshipModal.records.map((record) => (
                  <article key={record.key} className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{record.label}</p>
                        <h3 className="mt-1 text-sm font-semibold text-foreground">{record.displayName}</h3>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          getStatusBadgeClasses(record.type, record.status),
                        )}
                      >
                        {getLinkedRecordStatusLabel(record.type, record.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/25 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pai</p>
                          <p className="mt-1 text-sm text-foreground">{record.sireName}</p>
                        </div>
                        <div className="rounded-lg bg-muted/25 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mãe</p>
                          <p className="mt-1 text-sm text-foreground">{record.damName}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/25 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Valor de compra</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyBR(record.totalPurchaseAmount)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/25 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">1ª parcela</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyBR(record.firstInstallmentAmount)}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/25 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data</p>
                          <p className="mt-1 text-sm text-foreground">{formatDateDisplay(record.date)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-responsive rounded-xl border border-border/70 bg-card/80">
                <Table className="min-w-[1080px] table-sticky-first">
                  <TableHeader className="bg-muted/35 [&_tr]:border-border/70">
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Pai</TableHead>
                      <TableHead>Mãe</TableHead>
                      <TableHead>Valor de compra</TableHead>
                      <TableHead>1ª parcela</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationshipModal.records.map((record) => (
                      <TableRow key={record.key}>
                        <TableCell className="font-medium text-foreground">{record.label}</TableCell>
                        <TableCell className="text-foreground">{record.displayName}</TableCell>
                        <TableCell className="text-foreground">{record.sireName}</TableCell>
                        <TableCell className="text-foreground">{record.damName}</TableCell>
                        <TableCell className="text-foreground">{formatCurrencyBR(record.totalPurchaseAmount)}</TableCell>
                        <TableCell className="text-foreground">{formatCurrencyBR(record.firstInstallmentAmount)}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              getStatusBadgeClasses(record.type, record.status),
                            )}
                          >
                            {getLinkedRecordStatusLabel(record.type, record.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground">{formatDateDisplay(record.date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="border-t border-border/70 px-4 py-4 sm:px-6">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  setRelationshipModal((current) => ({
                    ...current,
                    open: false,
                  }))
                }
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedAnimal?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimaisMatrizes;
