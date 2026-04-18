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
import { Search, Loader2, PlusCircle, WalletCards } from "lucide-react";
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
  PURCHASE_TYPE_LABELS,
  PURCHASE_TYPE_OPTIONS,
  PurchaseType,
  updatePurchaseWithPayable,
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
    setSupplierSearchTerm("");
    setItemSearchTerm("");
    setSupplierPopoverOpen(false);
    setItemPopoverOpen(false);
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

      if (storeIds && storeIds.length > 0) {
        animalsQuery = animalsQuery.in("store_id", storeIds);
        pregnanciesQuery = pregnanciesQuery.in("store_id", storeIds);
        aspirationsQuery = aspirationsQuery.in("store_id", storeIds);
      }

      const [animalsRes, pregnanciesRes, aspirationsRes] = await Promise.all([
        animalsQuery.order("name"),
        pregnanciesQuery.order("name"),
        aspirationsQuery.order("name"),
      ]);

      if (animalsRes.error) throw animalsRes.error;
      if (pregnanciesRes.error) throw pregnanciesRes.error;
      if (aspirationsRes.error) throw aspirationsRes.error;

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

      setPurchaseItems({
        animal: animalOptions,
        pregnancy: pregnancyOptions,
        aspiration: aspirationOptions,
        recipient: recipientOptions,
      });
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
            : purchase.recipient_id;

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

  const installmentDifference = useMemo(
    () => Math.abs(sumInstallments(installments) - Number(totalAmount || 0)),
    [installments, totalAmount],
  );

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
      };

      const result =
        isEditMode && purchaseId
          ? await updatePurchaseWithPayable({
              purchaseId,
              ...payload,
            })
          : await createPurchaseWithPayable(payload);

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
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
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
                  </div>

                  {selectedItem && (
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
                      <Label>Valor total</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmount || ""}
                        onChange={(event) => setTotalAmount(Number(event.target.value))}
                        placeholder="0,00"
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
