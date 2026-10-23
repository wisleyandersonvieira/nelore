// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, PlusCircle, WalletCards, Trash2, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SuppliersModal } from "@/components/SuppliersModal";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import {
  buildSaleItemLabel,
  fetchAccessibleStoreScope,
  formatCurrencyBRL,
  generateSaleInstallments,
  SaleInstallmentDraft,
  SaleItemOption,
  sumInstallments,
} from "@/lib/sales";
import {
  createPurchaseWithPayable,
  getPurchaseInvoiceUrl,
  PURCHASE_INVOICE_ACCEPT,
  PURCHASE_TYPE_LABELS,
  PURCHASE_TYPE_OPTIONS,
  PurchaseInvoice,
  PurchaseSemenItemDraft,
  PurchaseType,
  removePurchaseInvoice,
  updatePurchaseWithPayable,
  uploadPurchaseInvoice,
} from "@/lib/purchases";

interface PurchasesCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
  mode: "create" | "edit";
  purchaseId?: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
  cnpj_cpf: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  code: string | null;
}

interface DocumentTypeOption {
  id: string;
  name: string;
  code: string;
}

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

interface PurchaseRow {
  id: string;
  supplier_id: string;
  product_id: string;
  purchase_type: PurchaseType;
  animal_id: string | null;
  pregnancy_id: string | null;
  aspiration_id: string | null;
  recipient_id: string | null;
  semen_id: string | null;
  invoice_file_path: string | null;
  invoice_file_name: string | null;
  purchase_date: string;
  issue_date: string;
  competence_date: string;
  first_due_date: string;
  document_type: string | null;
  document_number: string | null;
  negotiation_method: string | null;
  description: string;
  notes: string | null;
  total_amount: number;
  installment_count: number;
}

interface PayableRow {
  id: string;
  due_date: string;
  total_amount: number | null;
}

const EMPTY_ITEMS: Record<PurchaseType, SaleItemOption[]> = {
  animal: [],
  pregnancy: [],
  aspiration: [],
  recipient: [],
  semen: [],
};

const todayISO = () => new Date().toISOString().split("T")[0];

export function PurchasesCreateModal({
  open,
  onOpenChange,
  onSaved,
  mode,
  purchaseId,
}: PurchasesCreateModalProps) {
  const { toast } = useToast();
  const { canEdit: canEditCadastros, canDelete: canDeleteCadastros } = useCadastrosPermissions();
  const isEditMode = mode === "edit";
  const [loading, setLoading] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [debitProducts, setDebitProducts] = useState<ProductOption[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Record<PurchaseType, SaleItemOption[]>>(EMPTY_ITEMS);
  const [storesMap, setStoresMap] = useState<Record<string, StoreOption>>({});

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("animal");
  const [itemId, setItemId] = useState("");
  const [productId, setProductId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [issueDate, setIssueDate] = useState(todayISO());
  const [competenceDate, setCompetenceDate] = useState(todayISO());
  const [firstDueDate, setFirstDueDate] = useState(todayISO());
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [negotiationMethod, setNegotiationMethod] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [installments, setInstallments] = useState<SaleInstallmentDraft[]>([]);
  const [semenItems, setSemenItems] = useState<PurchaseSemenItemDraft[]>([]);
  const [semenPurchaseIds, setSemenPurchaseIds] = useState<Set<string>>(new Set());
  const [semenPickerIndex, setSemenPickerIndex] = useState<number | null>(null);
  const [semenItemSearchTerm, setSemenItemSearchTerm] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceRemoved, setInvoiceRemoved] = useState(false);

  const resetForm = () => {
    const today = todayISO();
    setSupplierId("");
    setPurchaseType("animal");
    setItemId("");
    setProductId("");
    setPurchaseDate(today);
    setIssueDate(today);
    setCompetenceDate(today);
    setFirstDueDate(today);
    setDocumentType("");
    setDocumentNumber("");
    setNegotiationMethod("");
    setDescription("");
    setNotes("");
    setTotalAmount(0);
    setInstallmentCount(1);
    setInstallments([]);
    setSemenItems([]);
    setSemenPickerIndex(null);
    setSemenItemSearchTerm("");
    setSupplierSearchTerm("");
    setItemSearchTerm("");
    setSupplierPopoverOpen(false);
    setItemPopoverOpen(false);
    setInvoiceFile(null);
    setExistingInvoice(null);
    setInvoiceRemoved(false);
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, cnpj_cpf")
      .eq("is_active", true)
      .eq("is_supplier", true)
      .order("name");

    if (error) {
      throw error;
    }

    setSuppliers((data || []) as SupplierOption[]);
  };

  const loadReferenceData = async () => {
    setLoadingReferenceData(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setStoresMap({});
        setDebitProducts([]);
        setDocumentTypes([]);
        setPurchaseItems(EMPTY_ITEMS);
        return;
      }

      const storesQuery = supabase.from("stores").select("id, name, code").order("name");
      const suppliersPromise = loadSuppliers();
      const productsPromise = supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("function_type", "debit")
        .order("name");
      const documentTypesPromise = supabase
        .from("document_types")
        .select("id, name, code")
        .eq("is_active", true)
        .order("code");

      const [storesRes, productsRes, documentTypesRes] = await Promise.all([
        storeIds ? storesQuery.in("id", storeIds) : storesQuery,
        productsPromise,
        documentTypesPromise,
        suppliersPromise,
      ]);

      if (storesRes.error) throw storesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (documentTypesRes.error) throw documentTypesRes.error;

      const stores = (storesRes.data || []) as StoreOption[];
      const nextStoresMap = stores.reduce<Record<string, StoreOption>>((acc, store) => {
        acc[store.id] = store;
        return acc;
      }, {});
      setStoresMap(nextStoresMap);
      setDebitProducts((productsRes.data || []) as ProductOption[]);
      setDocumentTypes((documentTypesRes.data || []) as DocumentTypeOption[]);

      const recipientCategoryIds = await fetchRecipientCategoryIds({
        storeIds: storeIds || undefined,
      });

      let animalsQuery = supabase.from("animals").select("id, name, code, store_id, category_id");
      let pregnanciesQuery = supabase.from("pregnancy_management").select("id, name, code, store_id");
      let aspirationsQuery = supabase.from("aspiration_management").select("id, name, code, store_id");
      let semenQuery = supabase.from("semen" as any).select("id, name, code, store_id");

      if (storeIds && storeIds.length > 0) {
        animalsQuery = animalsQuery.in("store_id", storeIds);
        pregnanciesQuery = pregnanciesQuery.in("store_id", storeIds);
        aspirationsQuery = aspirationsQuery.in("store_id", storeIds);
        semenQuery = semenQuery.in("store_id", storeIds);
      }

      const [animalsRes, pregnanciesRes, aspirationsRes, semenRes] = await Promise.all([
        animalsQuery.order("name"),
        pregnanciesQuery.order("name"),
        aspirationsQuery.order("name"),
        semenQuery.order("name"),
      ]);

      if (animalsRes.error) throw animalsRes.error;
      if (pregnanciesRes.error) throw pregnanciesRes.error;
      if (aspirationsRes.error) throw aspirationsRes.error;
      if (semenRes.error) throw semenRes.error;

      const animals = (animalsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
        category_id: string | null;
      }>;

      const animalOptions = animals
        .filter((animal) => !animal.category_id || !recipientCategoryIds.includes(animal.category_id))
        .map((animal) => ({
          id: animal.id,
          code: String(animal.code),
          name: animal.name,
          store_id: animal.store_id,
          store_name: nextStoresMap[animal.store_id]?.name || null,
        }));

      const recipientOptions = animals
        .filter((animal) => animal.category_id && recipientCategoryIds.includes(animal.category_id))
        .map((animal) => ({
          id: animal.id,
          code: String(animal.code),
          name: animal.name,
          store_id: animal.store_id,
          store_name: nextStoresMap[animal.store_id]?.name || null,
        }));

      const pregnancyOptions = ((pregnanciesRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: nextStoresMap[record.store_id]?.name || null,
      }));

      const aspirationOptions = ((aspirationsRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: nextStoresMap[record.store_id]?.name || null,
      }));

      const semenOptions = ((semenRes.data || []) as Array<{
        id: string;
        name: string;
        code: number;
        store_id: string;
      }>).map((record) => ({
        id: record.id,
        code: String(record.code),
        name: record.name,
        store_id: record.store_id,
        store_name: nextStoresMap[record.store_id]?.name || null,
      }));

      setPurchaseItems({
        animal: animalOptions,
        pregnancy: pregnancyOptions,
        aspiration: aspirationOptions,
        recipient: recipientOptions,
        semen: semenOptions,
      });

      // Load list of semen IDs already linked to a purchase (for green/red highlight)
      const [existingLinkedRes, existingItemsRes] = await Promise.all([
        supabase.from("purchases").select("semen_id").eq("purchase_type", "semen").not("semen_id", "is", null),
        supabase.from("purchase_semen_items" as any).select("semen_id"),
      ]);
      const linkedIds = new Set<string>();
      (((existingLinkedRes.data as unknown) || []) as Array<{ semen_id: string | null }>).forEach((r) => {
        if (r?.semen_id) linkedIds.add(r.semen_id);
      });
      (((existingItemsRes.data as unknown) || []) as Array<{ semen_id: string | null }>).forEach((r) => {
        if (r?.semen_id) linkedIds.add(r.semen_id);
      });
      setSemenPurchaseIds(linkedIds);
    } catch (error) {
      console.error("Erro ao carregar dados de compras:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários para a compra.",
        variant: "destructive",
      });
    } finally {
      setLoadingReferenceData(false);
    }
  };

  const loadPurchase = async (targetPurchaseId: string) => {
    const { data: purchaseRes, error: purchaseError } = await supabase
      .from("purchases")
      .select("*")
      .eq("id", targetPurchaseId)
      .single();

    if (purchaseError) throw purchaseError;

    const purchase = purchaseRes as unknown as PurchaseRow;
    const itemId =
      purchase.purchase_type === "animal"
        ? purchase.animal_id
        : purchase.purchase_type === "pregnancy"
          ? purchase.pregnancy_id
          : purchase.purchase_type === "aspiration"
            ? purchase.aspiration_id
            : purchase.purchase_type === "recipient"
              ? purchase.recipient_id
              : purchase.semen_id;

    if (!itemId) {
      throw new Error("Não foi possível identificar o item vinculado à compra.");
    }

    const { data: payablesRes, error: payablesError } = await supabase
      .from("accounts_payable")
      .select("id, due_date, total_amount")
      .eq("purchase_id", targetPurchaseId)
      .or("purchase_link_origin.eq.manual,purchase_link_origin.is.null");

    if (payablesError) throw payablesError;

    const payables = (payablesRes || []) as PayableRow[];

    if (payables.length !== 1) {
      throw new Error("A compra precisa ter exatamente um título manual vinculado para permitir edição.");
    }

    const { data: installmentsRes, error: installmentsError } = await supabase
      .from("accounts_payable_installments")
      .select("installment_number, due_date, amount, payment_date")
      .eq("account_payable_id", payables[0].id)
      .order("installment_number", { ascending: true });

    if (installmentsError) throw installmentsError;

    setSupplierId(purchase.supplier_id);
    setPurchaseType(purchase.purchase_type);
    setItemId(itemId);
    setProductId(purchase.product_id);
    setPurchaseDate(purchase.purchase_date);
    setIssueDate(purchase.issue_date);
    setCompetenceDate(purchase.competence_date);
    setFirstDueDate(purchase.first_due_date);
    setDocumentType(purchase.document_type || "");
    setDocumentNumber(purchase.document_number || "");
    setNegotiationMethod(purchase.negotiation_method || "");
    setDescription(purchase.description || "");
    setNotes(purchase.notes || "");
    setTotalAmount(Number(purchase.total_amount || 0));
    setInstallmentCount(Number(purchase.installment_count || 1));
    setInvoiceFile(null);
    setInvoiceRemoved(false);
    setExistingInvoice(
      purchase.invoice_file_path
        ? {
            filePath: purchase.invoice_file_path,
            fileName: purchase.invoice_file_name || "nota-fiscal",
          }
        : null,
    );
    setInstallments(
      ((installmentsRes || []) as Array<{
        installment_number: number;
        due_date: string;
        amount: number;
        payment_date?: string | null;
      }>).map((installment) => ({
        installment_number: installment.installment_number,
        due_date: installment.due_date,
        amount: Number(installment.amount || 0),
        payment_date: installment.payment_date || null,
      })),
    );

    if (purchase.purchase_type === "semen") {
      const { data: semenItemsRes } = await supabase
        .from("purchase_semen_items" as any)
        .select("semen_id, amount")
        .eq("purchase_id", targetPurchaseId);
      const items = (((semenItemsRes as unknown) || []) as Array<{ semen_id: string; amount: number | string }>).map((row) => ({
        semen_id: row.semen_id,
        amount: Number(row.amount || 0),
      }));
      setSemenItems(items.length > 0 ? items : [{ semen_id: itemId, amount: Number(purchase.total_amount || 0) }]);
    } else {
      setSemenItems([]);
    }
  };


  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    const initialize = async () => {
      resetForm();
      await loadReferenceData();

      if (isEditMode && purchaseId) {
        setLoading(true);
        try {
          await loadPurchase(purchaseId);
        } catch (error) {
          console.error("Erro ao carregar compra:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os dados da compra para edição.",
            variant: "destructive",
          });
          onOpenChange(false);
        } finally {
          setLoading(false);
        }
      }
    };

    void initialize();
  }, [open, isEditMode, purchaseId]);

  useEffect(() => {
    if (!open && !supplierModalOpen) {
      return;
    }

    if (!supplierModalOpen) {
      void loadSuppliers();
    }
  }, [supplierModalOpen, open]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) || null;
  const selectedItem = itemId
    ? purchaseItems[purchaseType].find((item) => item.id === itemId) || null
    : null;

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierSearchTerm.trim().toLowerCase()),
      ),
    [supplierSearchTerm, suppliers],
  );

  const filteredItems = useMemo(
    () =>
      purchaseItems[purchaseType].filter((item) =>
        buildSaleItemLabel(item).toLowerCase().includes(itemSearchTerm.trim().toLowerCase()),
      ),
    [itemSearchTerm, purchaseItems, purchaseType],
  );

  const isSemenMulti = purchaseType === "semen";

  const semenItemsSum = useMemo(
    () => semenItems.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [semenItems],
  );

  // For semen purchases, total is auto-computed from items
  useEffect(() => {
    if (isSemenMulti) {
      const sum = Math.round(semenItemsSum * 100) / 100;
      setTotalAmount((prev) => (Math.abs(prev - sum) > 0.001 ? sum : prev));
    }
  }, [isSemenMulti, semenItemsSum]);

  const installmentDifference = useMemo(
    () => Math.abs(sumInstallments(installments) - Number(totalAmount || 0)),
    [installments, totalAmount],
  );

  const addSemenItem = () => {
    setSemenItems((current) => [...current, { semen_id: "", amount: 0 }]);
    setSemenPickerIndex(semenItems.length);
    setSemenItemSearchTerm("");
  };

  const removeSemenItem = (index: number) => {
    setSemenItems((current) => current.filter((_, i) => i !== index));
  };

  const updateSemenItemId = (index: number, semenId: string) => {
    setSemenItems((current) =>
      current.map((it, i) => (i === index ? { ...it, semen_id: semenId } : it)),
    );
    // sync primary itemId to first item so validation passes
    if (index === 0) setItemId(semenId);
  };

  const updateSemenItemAmount = (index: number, amount: number) => {
    setSemenItems((current) =>
      current.map((it, i) => (i === index ? { ...it, amount } : it)),
    );
  };

  // Keep itemId synced to first semen item id
  useEffect(() => {
    if (isSemenMulti && semenItems.length > 0 && semenItems[0].semen_id) {
      setItemId((prev) => (prev === semenItems[0].semen_id ? prev : semenItems[0].semen_id));
    }
  }, [isSemenMulti, semenItems]);


  const handleGenerateInstallments = () => {
    if (!firstDueDate || totalAmount <= 0) {
      toast({
        title: "Parcelamento incompleto",
        description: "Informe o valor total e a primeira data de vencimento para gerar as parcelas.",
        variant: "destructive",
      });
      return;
    }

    if (installmentCount < 1 || installmentCount > 36) {
      toast({
        title: "Quantidade inválida",
        description: "A compra deve ter entre 1 e 36 parcelas.",
        variant: "destructive",
      });
      return;
    }

    setInstallments(generateSaleInstallments(totalAmount, installmentCount, firstDueDate));
  };

  const updateInstallment = (
    index: number,
    field: keyof SaleInstallmentDraft,
    value: string | number,
  ) => {
    setInstallments((current) =>
      current.map((installment, currentIndex) =>
        currentIndex === index
          ? {
              ...installment,
              [field]: field === "amount" ? Number(value) : value,
            }
          : installment,
      ),
    );
  };

  const handleSave = async () => {
    // Semen-specific validations
    if (isSemenMulti) {
      if (semenItems.length === 0) {
        toast({ title: "Sem sêmens", description: "Adicione pelo menos um sêmen à compra.", variant: "destructive" });
        return;
      }
      if (semenItems.some((it) => !it.semen_id)) {
        toast({ title: "Sêmen não selecionado", description: "Selecione o sêmen em todos os itens da lista.", variant: "destructive" });
        return;
      }
      if (semenItems.some((it) => Number(it.amount || 0) <= 0)) {
        toast({ title: "Valor inválido", description: "Cada item de sêmen precisa ter valor maior que zero.", variant: "destructive" });
        return;
      }
      const ids = semenItems.map((it) => it.semen_id);
      if (new Set(ids).size !== ids.length) {
        toast({ title: "Sêmen duplicado", description: "Não é possível adicionar o mesmo sêmen mais de uma vez.", variant: "destructive" });
        return;
      }
    }

    if (!supplierId || !itemId || !productId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione fornecedor, item comprado e produto financeiro antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    if (!purchaseDate || !issueDate || !competenceDate || !firstDueDate || totalAmount <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Preencha as datas principais da compra e informe um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const competenceValidation = await validateAccountsPayablePeriod.competencia(competenceDate);
    if (competenceValidation.blocked) {
      toast({
        title: "Período bloqueado",
        description: competenceValidation.message,
        variant: "destructive",
      });
      return;
    }

    const effectiveInstallments =
      installments.length > 0
        ? installments
        : generateSaleInstallments(totalAmount, installmentCount, firstDueDate);

    if (effectiveInstallments.length === 0) {
      toast({
        title: "Parcelamento inválido",
        description: "Gere ao menos uma parcela antes de salvar a compra.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(sumInstallments(effectiveInstallments) - totalAmount) > 0.01) {
      toast({
        title: "Parcelas inconsistentes",
        description: "A soma das parcelas deve ser igual ao valor total da compra.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplierId,
        purchaseType,
        itemId,
        productId,
        purchaseDate,
        issueDate,
        competenceDate,
        firstDueDate,
        totalAmount,
        documentType: documentType || undefined,
        documentNumber: documentNumber || undefined,
        description: description || undefined,
        notes: notes || undefined,
        negotiationMethod: negotiationMethod || undefined,
        installments: effectiveInstallments,
        semenItems: isSemenMulti ? semenItems : undefined,
      };


      const result =
        isEditMode && purchaseId
          ? await updatePurchaseWithPayable({
              purchaseId,
              ...payload,
            })
          : await createPurchaseWithPayable(payload);

      const savedPurchaseId: string | undefined = result?.purchase_id || purchaseId || undefined;

      // A nota fiscal é opcional: uma falha aqui não invalida a compra já registrada.
      if (savedPurchaseId && (invoiceFile || (invoiceRemoved && existingInvoice))) {
        try {
          if (invoiceFile) {
            await uploadPurchaseInvoice(savedPurchaseId, invoiceFile);
          } else {
            await removePurchaseInvoice(savedPurchaseId);
          }
        } catch (invoiceError: any) {
          console.error("Erro ao salvar nota fiscal:", invoiceError);
          toast({
            title: "Compra salva, mas a nota fiscal falhou",
            description:
              invoiceError?.message ||
              "Use o botão \"Upload de NF\" na visualização da compra para tentar novamente.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: isEditMode ? "Compra atualizada" : "Compra registrada",
        description: result?.purchase_code
          ? `Compra #${result.purchase_code} salva com títulos vinculados ao Contas a Pagar.`
          : "Compra salva com títulos vinculados ao Contas a Pagar.",
      });

      await onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar compra:", error);
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível registrar a compra.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-indigo-600" />
              {isEditMode ? "Editar Compra" : "Registrar Compra"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "A edição atualiza a compra e recompõe os compromissos vinculados no Contas a Pagar."
                : "O cadastro da compra gera automaticamente os compromissos financeiros no Contas a Pagar."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Aquisição</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Fornecedor</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-indigo-700"
                        disabled={!canEditCadastros}
                        onClick={() => setSupplierModalOpen(true)}
                      >
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Novo fornecedor
                      </Button>
                    </div>

                    <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="truncate">
                            {selectedSupplier ? selectedSupplier.name : "Selecionar fornecedor"}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <div className="border-b p-2">
                          <Input
                            placeholder="Pesquisar fornecedor..."
                            value={supplierSearchTerm}
                            onChange={(event) => setSupplierSearchTerm(event.target.value)}
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredSuppliers.map((supplier) => (
                            <button
                              type="button"
                              key={supplier.id}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                supplierId === supplier.id && "bg-accent font-medium",
                              )}
                              onClick={() => {
                                setSupplierId(supplier.id);
                                setSupplierPopoverOpen(false);
                              }}
                            >
                              <span>{supplier.name}</span>
                              {supplier.cnpj_cpf && (
                                <span className="text-xs text-muted-foreground">{supplier.cnpj_cpf}</span>
                              )}
                            </button>
                          ))}
                          {filteredSuppliers.length === 0 && (
                            <div className="px-3 py-4 text-sm text-muted-foreground">
                              Nenhum fornecedor encontrado.
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo do item</Label>
                      <Select
                        value={purchaseType}
                        onValueChange={(value: PurchaseType) => {
                          setPurchaseType(value);
                          setItemId("");
                          setItemSearchTerm("");
                          setDescription("");
                          setSemenItems(value === "semen" ? [{ semen_id: "", amount: 0 }] : []);
                          setSemenPickerIndex(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURCHASE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!isSemenMulti && (
                      <div className="space-y-2">
                        <Label>Registro comprado</Label>
                        <Popover open={itemPopoverOpen} onOpenChange={setItemPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                              <span className="truncate">
                                {selectedItem ? buildSaleItemLabel(selectedItem) : "Selecionar registro"}
                              </span>
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                            <div className="border-b p-2">
                              <Input
                                placeholder={`Pesquisar ${PURCHASE_TYPE_LABELS[purchaseType].toLowerCase()}...`}
                                value={itemSearchTerm}
                                onChange={(event) => setItemSearchTerm(event.target.value)}
                              />
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filteredItems.map((item) => (
                                <button
                                  type="button"
                                  key={item.id}
                                  className={cn(
                                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                    itemId === item.id && "bg-accent",
                                  )}
                                  onClick={() => {
                                    setItemId(item.id);
                                    setItemPopoverOpen(false);
                                    if (!description) {
                                      setDescription(`${PURCHASE_TYPE_LABELS[purchaseType]} ${buildSaleItemLabel(item)}`);
                                    }
                                  }}
                                >
                                  <span className="font-medium">{buildSaleItemLabel(item)}</span>
                                  {item.store_name && (
                                    <span className="text-xs text-muted-foreground">{item.store_name}</span>
                                  )}
                                </button>
                              ))}
                              {filteredItems.length === 0 && (
                                <div className="px-3 py-4 text-sm text-muted-foreground">
                                  Nenhum registro encontrado para este tipo.
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  {!isSemenMulti && selectedItem && (
                    <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                          {PURCHASE_TYPE_LABELS[purchaseType]}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {buildSaleItemLabel(selectedItem)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Fazenda de origem: {selectedItem.store_name || storesMap[selectedItem.store_id]?.name || "N/D"}
                      </p>
                    </div>
                  )}

                  {isSemenMulti && (
                    <div className="space-y-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Sêmens vinculados à compra</Label>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> já comprado
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-rose-500" /> sem compra
                          </span>
                        </div>
                      </div>

                      {semenItems.length === 0 && (
                        <p className="rounded-lg border border-dashed border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                          Adicione ao menos um sêmen com o botão abaixo.
                        </p>
                      )}

                      {semenItems.map((item, index) => {
                        const selectedSemen = purchaseItems.semen.find((s) => s.id === item.semen_id) || null;
                        const filteredSemen = purchaseItems.semen.filter((s) =>
                          buildSaleItemLabel(s).toLowerCase().includes(semenItemSearchTerm.trim().toLowerCase()),
                        );
                        return (
                          <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/85 p-2">
                            <div className="flex-1 min-w-[180px]">
                              <Popover
                                open={semenPickerIndex === index}
                                onOpenChange={(openState) => {
                                  setSemenPickerIndex(openState ? index : null);
                                  if (openState) setSemenItemSearchTerm("");
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-between",
                                      selectedSemen && semenPurchaseIds.has(selectedSemen.id)
                                        ? "border-emerald-400 text-emerald-800"
                                        : selectedSemen
                                          ? "border-rose-400 text-rose-800"
                                          : "",
                                    )}
                                  >
                                    <span className="truncate">
                                      {selectedSemen ? buildSaleItemLabel(selectedSemen) : "Selecionar sêmen"}
                                    </span>
                                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                  <div className="border-b p-2">
                                    <Input
                                      placeholder="Pesquisar sêmen..."
                                      value={semenItemSearchTerm}
                                      onChange={(event) => setSemenItemSearchTerm(event.target.value)}
                                    />
                                  </div>
                                  <div className="max-h-64 overflow-y-auto">
                                    {filteredSemen.map((option) => {
                                      const alreadyLinked = semenPurchaseIds.has(option.id);
                                      const alreadyInList = semenItems.some((it, i) => i !== index && it.semen_id === option.id);
                                      return (
                                        <button
                                          type="button"
                                          key={option.id}
                                          disabled={alreadyInList}
                                          className={cn(
                                            "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                            alreadyLinked
                                              ? "bg-emerald-50 text-emerald-900"
                                              : "bg-rose-50 text-rose-900",
                                            alreadyInList && "opacity-40",
                                          )}
                                          onClick={() => {
                                            updateSemenItemId(index, option.id);
                                            setSemenPickerIndex(null);
                                          }}
                                        >
                                          <span className="font-medium">{buildSaleItemLabel(option)}</span>
                                          <span className="text-xs">
                                            {alreadyLinked ? "Já possui compra vinculada" : "Sem compra vinculada"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                    {filteredSemen.length === 0 && (
                                      <div className="px-3 py-4 text-sm text-muted-foreground">
                                        Nenhum sêmen encontrado.
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Valor"
                              className="w-32 text-right"
                              value={item.amount || ""}
                              onChange={(event) => updateSemenItemAmount(index, Number(event.target.value))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-rose-600"
                              onClick={() => removeSemenItem(index)}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}

                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={addSemenItem}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Adicionar sêmen
                        </Button>
                        <div className="text-right text-sm">
                          <span className="text-muted-foreground">Soma dos itens: </span>
                          <span className="font-semibold">{formatCurrencyBRL(semenItemsSum)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Dados financeiros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Data da compra</Label>
                      <Input
                        type="date"
                        value={purchaseDate}
                        onChange={(event) => setPurchaseDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Emissão</Label>
                      <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Competência</Label>
                      <Input
                        type="date"
                        value={competenceDate}
                        onChange={(event) => setCompetenceDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Produto financeiro</Label>
                      <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a classificação financeira" />
                        </SelectTrigger>
                        <SelectContent>
                          {debitProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.code ? `${product.code} - ${product.name}` : product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Valor total{isSemenMulti ? " (soma dos sêmens)" : ""}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmount || ""}
                        onChange={(event) => setTotalAmount(Number(event.target.value))}
                        placeholder="0,00"
                        readOnly={isSemenMulti}
                        className={isSemenMulti ? "bg-muted/60" : undefined}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Tipo de documento</Label>
                      <Select value={documentType} onValueChange={setDocumentType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.id} value={type.code}>
                              {type.code} - {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número do documento</Label>
                      <Input
                        value={documentNumber}
                        onChange={(event) => setDocumentNumber(event.target.value)}
                        placeholder="Ex.: NF-2026-041"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de negociação</Label>
                      <Input
                        value={negotiationMethod}
                        onChange={(event) => setNegotiationMethod(event.target.value)}
                        placeholder="Ex.: boleto, contrato, entrada"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição financeira</Label>
                    <Input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Se vazio, o sistema gera automaticamente a descrição da compra"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Observações internas da compra e do financeiro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nota fiscal (opcional)</Label>
                    {existingInvoice && !invoiceRemoved && !invoiceFile ? (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{existingInvoice.fileName}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const url = await getPurchaseInvoiceUrl(existingInvoice.filePath);
                                window.open(url, "_blank");
                              } catch (error) {
                                console.error("Erro ao abrir nota fiscal:", error);
                                toast({
                                  title: "Erro",
                                  description: "Não foi possível abrir a nota fiscal.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setInvoiceRemoved(true)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <Input
                      type="file"
                      accept={PURCHASE_INVOICE_ACCEPT}
                      onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: PDF, XML, JPG ou PNG.
                      {existingInvoice && !invoiceRemoved
                        ? " Ao selecionar um novo arquivo, a nota fiscal atual será substituída."
                        : ""}
                      {existingInvoice && invoiceRemoved && !invoiceFile
                        ? " A nota fiscal atual será removida ao salvar."
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-indigo-200/70 bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(249,250,251,0.98))]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contas a Pagar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quantidade de parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="36"
                        value={installmentCount}
                        onChange={(event) => setInstallmentCount(Number(event.target.value || 1))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primeiro vencimento</Label>
                      <Input
                        type="date"
                        value={firstDueDate}
                        onChange={(event) => setFirstDueDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={handleGenerateInstallments}
                  >
                    Gerar parcelas
                  </Button>

                  <div className="rounded-2xl border border-border/70 bg-background/85 p-4 text-sm text-muted-foreground">
                    Ao salvar, a compra cria automaticamente um lançamento no Contas a Pagar com vínculo direto para consulta posterior.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Prévia das parcelas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                              Gere as parcelas para visualizar os títulos que serão criados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          installments.map((installment, index) => (
                            <TableRow key={`${installment.installment_number}-${index}`}>
                              <TableCell className="font-medium">{installment.installment_number}</TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={installment.due_date}
                                  onChange={(event) =>
                                    updateInstallment(index, "due_date", event.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="text-right"
                                  value={installment.amount}
                                  onChange={(event) =>
                                    updateInstallment(index, "amount", event.target.value)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/85 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Total parcelado</p>
                      <p className="text-xs text-muted-foreground">
                        {installments.length} título(s) previsto(s) para geração automática
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrencyBRL(sumInstallments(installments))}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          installmentDifference > 0.01 ? "text-destructive" : "text-indigo-700",
                        )}
                      >
                        {installmentDifference > 0.01
                          ? `Diferença de ${formatCurrencyBRL(installmentDifference)} em relação ao valor da compra`
                          : "Parcelamento consistente com o valor total"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading || loadingReferenceData}>
              {(loading || loadingReferenceData) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Salvar alterações" : "Salvar compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuppliersModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        canEdit={canEditCadastros}
        canDelete={canDeleteCadastros}
      />
    </>
  );
}
