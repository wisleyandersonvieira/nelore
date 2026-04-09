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
import { Search, Loader2, PlusCircle, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SuppliersModal } from "@/components/SuppliersModal";
import { validateAccountsReceivablePeriod } from "@/utils/periodValidation";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import {
  buildSaleItemLabel,
  createSaleWithReceivable,
  fetchAccessibleStoreScope,
  formatCurrencyBRL,
  generateSaleInstallments,
  SALE_TYPE_LABELS,
  SALE_TYPE_OPTIONS,
  SaleInstallmentDraft,
  SaleItemOption,
  SaleType,
  sumInstallments,
} from "@/lib/sales";

interface SalesCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}

interface ClientOption {
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

const EMPTY_ITEMS: Record<SaleType, SaleItemOption[]> = {
  animal: [],
  pregnancy: [],
  aspiration: [],
  recipient: [],
};

const todayISO = () => new Date().toISOString().split("T")[0];

export function SalesCreateModal({ open, onOpenChange, onSaved }: SalesCreateModalProps) {
  const { toast } = useToast();
  const { canEdit: canEditCadastros, canDelete: canDeleteCadastros } = useCadastrosPermissions();
  const [loading, setLoading] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [creditProducts, setCreditProducts] = useState<ProductOption[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [saleItems, setSaleItems] = useState<Record<SaleType, SaleItemOption[]>>(EMPTY_ITEMS);
  const [storesMap, setStoresMap] = useState<Record<string, StoreOption>>({});

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  const [clientId, setClientId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("animal");
  const [itemId, setItemId] = useState("");
  const [productId, setProductId] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
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
    setClientId("");
    setSaleType("animal");
    setItemId("");
    setProductId("");
    setSaleDate(today);
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
    setClientSearchTerm("");
    setItemSearchTerm("");
    setClientPopoverOpen(false);
    setItemPopoverOpen(false);
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, cnpj_cpf")
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    setClients((data || []) as ClientOption[]);
  };

  const loadReferenceData = async () => {
    setLoadingReferenceData(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setStoresMap({});
        setCreditProducts([]);
        setDocumentTypes([]);
        setSaleItems(EMPTY_ITEMS);
        return;
      }

      const storesQuery = supabase.from("stores").select("id, name, code").order("name");
      const clientsPromise = loadClients();
      const productsPromise = supabase
        .from("products")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("function_type", "credit")
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
        clientsPromise,
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
      setCreditProducts((productsRes.data || []) as ProductOption[]);
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

      setSaleItems({
        animal: animalOptions,
        pregnancy: pregnancyOptions,
        aspiration: aspirationOptions,
        recipient: recipientOptions,
      });
    } catch (error) {
      console.error("Erro ao carregar dados de vendas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários para a venda.",
        variant: "destructive",
      });
    } finally {
      setLoadingReferenceData(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    resetForm();
    void loadReferenceData();
  }, [open]);

  useEffect(() => {
    if (!open && !clientModalOpen) {
      return;
    }

    if (!clientModalOpen) {
      void loadClients();
    }
  }, [clientModalOpen, open]);

  const selectedClient = clients.find((client) => client.id === clientId) || null;
  const selectedItem = itemId ? saleItems[saleType].find((item) => item.id === itemId) || null : null;

  const filteredClients = useMemo(
    () =>
      clients.filter((client) =>
        client.name.toLowerCase().includes(clientSearchTerm.trim().toLowerCase()),
      ),
    [clientSearchTerm, clients],
  );

  const filteredItems = useMemo(
    () =>
      saleItems[saleType].filter((item) =>
        buildSaleItemLabel(item).toLowerCase().includes(itemSearchTerm.trim().toLowerCase()),
      ),
    [itemSearchTerm, saleItems, saleType],
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
        description: "A venda deve ter entre 1 e 36 parcelas.",
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
    if (!clientId || !itemId || !productId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione cliente, item vendido e produto financeiro antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    if (!saleDate || !issueDate || !competenceDate || !firstDueDate || totalAmount <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Preencha as datas principais da venda e informe um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const competenceValidation = await validateAccountsReceivablePeriod.competencia(competenceDate);
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
        description: "Gere ao menos uma parcela antes de salvar a venda.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(sumInstallments(effectiveInstallments) - totalAmount) > 0.01) {
      toast({
        title: "Parcelas inconsistentes",
        description: "A soma das parcelas deve ser igual ao valor total da venda.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await createSaleWithReceivable({
        clientId,
        saleType,
        itemId,
        productId,
        saleDate,
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
      });

      toast({
        title: "Venda registrada",
        description: result?.sale_code
          ? `Venda #${result.sale_code} criada com títulos vinculados ao Contas a Receber.`
          : "Venda criada com títulos vinculados ao Contas a Receber.",
      });

      await onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar venda:", error);
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível registrar a venda.",
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
              <ReceiptText className="h-5 w-5 text-emerald-600" />
              Registrar Venda
            </DialogTitle>
            <DialogDescription>
              O cadastro comercial da venda gera automaticamente os títulos financeiros no Contas a Receber.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Negociação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Cliente</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-emerald-700"
                        disabled={!canEditCadastros}
                        onClick={() => setClientModalOpen(true)}
                      >
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Novo cliente
                      </Button>
                    </div>

                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="truncate">
                            {selectedClient ? selectedClient.name : "Selecionar cliente"}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <div className="border-b p-2">
                          <Input
                            placeholder="Pesquisar cliente..."
                            value={clientSearchTerm}
                            onChange={(event) => setClientSearchTerm(event.target.value)}
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredClients.map((client) => (
                            <button
                              type="button"
                              key={client.id}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                clientId === client.id && "bg-accent font-medium",
                              )}
                              onClick={() => {
                                setClientId(client.id);
                                setClientPopoverOpen(false);
                              }}
                            >
                              <span>{client.name}</span>
                              {client.cnpj_cpf && (
                                <span className="text-xs text-muted-foreground">{client.cnpj_cpf}</span>
                              )}
                            </button>
                          ))}
                          {filteredClients.length === 0 && (
                            <div className="px-3 py-4 text-sm text-muted-foreground">
                              Nenhum cliente encontrado.
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
                        value={saleType}
                        onValueChange={(value: SaleType) => {
                          setSaleType(value);
                          setItemId("");
                          setItemSearchTerm("");
                          setDescription("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Registro vendido</Label>
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
                              placeholder={`Pesquisar ${SALE_TYPE_LABELS[saleType].toLowerCase()}...`}
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
                                    setDescription(`${SALE_TYPE_LABELS[saleType]} ${buildSaleItemLabel(item)}`);
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
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          {SALE_TYPE_LABELS[saleType]}
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
                      <Label>Data da venda</Label>
                      <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
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
                          {creditProducts.map((product) => (
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
                        placeholder="Ex.: CONTR-2026-015"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de negociação</Label>
                      <Input
                        value={negotiationMethod}
                        onChange={(event) => setNegotiationMethod(event.target.value)}
                        placeholder="Ex.: boleto, contrato, sinal"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição financeira</Label>
                    <Input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Se vazio, o sistema gera automaticamente a descrição da venda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Observações internas da venda e do financeiro"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-emerald-200/70 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(249,250,251,0.98))]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contas a Receber</CardTitle>
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
                    Ao salvar, a venda cria automaticamente um lançamento no Contas a Receber com vínculo direto para consulta posterior.
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
                          installmentDifference > 0.01 ? "text-destructive" : "text-emerald-700",
                        )}
                      >
                        {installmentDifference > 0.01
                          ? `Diferença de ${formatCurrencyBRL(installmentDifference)} em relação ao valor da venda`
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
              Salvar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuppliersModal
        open={clientModalOpen}
        onOpenChange={setClientModalOpen}
        canEdit={canEditCadastros}
        canDelete={canDeleteCadastros}
      />
    </>
  );
}
