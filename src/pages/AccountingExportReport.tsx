import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Helper to avoid TS2589 deep type instantiation errors
const query = (table: string) => (supabase as any).from(table);
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import JSZip from "jszip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Store {
  id: string;
  name: string;
}

interface CashAccount {
  id: string;
  name: string;
  type: "cash" | "current" | "delivery" | "card";
}

interface PaymentRecord {
  id: string;
  payment_date: string;
  amount_paid: number;
  interest_amount: number;
  discount_amount: number;
  payment_account_id: string | null;
  payment_account_type: string | null;
  description: string;
  document_number: string | null;
  supplier_name: string | null;
  employee_name: string | null;
  installment_number: number | null;
  total_installments: number | null;
  attachments: any;
  account_payable_id: string | null;
}

const AccountingExportReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchAccounts(selectedStore);
    } else {
      setAccounts([]);
      setSelectedAccounts([]);
    }
  }, [selectedStore]);

  const fetchStores = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role, store_id").eq("id", user.id).single();

      let storesData: Store[] = [];

      if (profile?.role === "admin") {
        const { data } = await query("stores").select("id, name").order("name");
        storesData = (data || []).map((s: any) => ({ id: s.id, name: s.name }));
      } else {
        // Collect store IDs from user_stores and primary store
        const storeIds: string[] = [];

        // Add primary store from profile
        if (profile?.store_id) {
          storeIds.push(profile.store_id);
        }

        // Get additional stores from user_stores
        const { data: userStores } = await query("user_stores").select("store_id").eq("user_id", user.id);

        if (userStores) {
          userStores.forEach((us: any) => {
            if (us.store_id && !storeIds.includes(us.store_id)) {
              storeIds.push(us.store_id);
            }
          });
        }

        // Fetch stores by IDs
        if (storeIds.length > 0) {
          const { data } = await query("stores").select("id, name").in("id", storeIds).order("name");
          storesData = (data || []).map((s: any) => ({ id: s.id, name: s.name }));
        }
      }

      setStores(storesData);
    } catch (error) {
      console.error("Erro ao buscar fazendas:", error);
    }
  };

  const fetchAccounts = async (storeId: string) => {
    try {
      const allAccounts: CashAccount[] = [];

      // Buscar contas caixa vinculadas à fazenda
      const { data: cashAccounts } = await query("cash_accounts")
        .select(
          `
          id, name,
          cash_account_stores!inner (store_id)
        `,
        )
        .eq("is_active", true)
        .eq("cash_account_stores.store_id", storeId);

      (cashAccounts || []).forEach((acc: any) => {
        allAccounts.push({ id: acc.id, name: `Caixa - ${acc.name}`, type: "cash" });
      });

      // Buscar contas correntes vinculadas à fazenda
      const { data: currentAccounts } = await query("current_accounts")
        .select(
          `
          id, name,
          current_account_stores!inner (store_id)
        `,
        )
        .eq("is_active", true)
        .eq("current_account_stores.store_id", storeId);

      (currentAccounts || []).forEach((acc: any) => {
        allAccounts.push({ id: acc.id, name: `Corrente - ${acc.name}`, type: "current" });
      });

      // Buscar contas delivery vinculadas à fazenda
      const { data: deliveryAccounts } = await query("delivery_accounts")
        .select(
          `
          id, name,
          delivery_account_stores!inner (store_id)
        `,
        )
        .eq("is_active", true)
        .eq("delivery_account_stores.store_id", storeId);

      (deliveryAccounts || []).forEach((acc: any) => {
        allAccounts.push({ id: acc.id, name: `Delivery - ${acc.name}`, type: "delivery" });
      });

      // Buscar contas cartão vinculadas à fazenda
      const { data: cardAccounts } = await query("card_accounts")
        .select(
          `
          id, name,
          card_account_stores!inner (store_id)
        `,
        )
        .eq("is_active", true)
        .eq("card_account_stores.store_id", storeId);

      (cardAccounts || []).forEach((acc: any) => {
        allAccounts.push({ id: acc.id, name: `Cartão - ${acc.name}`, type: "card" });
      });

      setAccounts(allAccounts);
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    }
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId],
    );
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((acc) => acc.id));
    }
  };

  const handleSearch = async () => {
    if (!selectedStore) {
      toast({ title: "Selecione uma fazenda", variant: "destructive" });
      return;
    }
    if (selectedAccounts.length === 0) {
      toast({ title: "Selecione pelo menos uma conta", variant: "destructive" });
      return;
    }
    if (!paymentStartDate || !paymentEndDate) {
      toast({ title: "Selecione o período de pagamento", variant: "destructive" });
      return;
    }

    // Validar período máximo de 35 dias
    const startDate = parseISO(paymentStartDate);
    const endDate = parseISO(paymentEndDate);
    const daysDiff = differenceInDays(endDate, startDate);

    if (daysDiff > 35) {
      toast({
        title: "Período máximo permitido: 35 dias",
        description: `O período selecionado tem ${daysDiff} dias.`,
        variant: "destructive",
      });
      return;
    }

    if (daysDiff < 0) {
      toast({
        title: "Data inicial deve ser anterior à data final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar transações financeiras de saída (pagamentos) das contas selecionadas
      const { data: transactions, error: transError } = await supabase
        .from("financial_transactions")
        .select(
          `
          id,
          amount,
          transaction_date,
          description,
          reference_id,
          reference_type,
          account_id
        `,
        )
        .eq("store_id", selectedStore)
        .in("account_id", selectedAccounts)
        .in("reference_type", ["accounts_payable", "accounts_payable_installments"])
        .eq("transaction_type", "saida")
        .gte("transaction_date", paymentStartDate)
        .lte("transaction_date", paymentEndDate)
        .order("transaction_date", { ascending: true });

      if (transError) throw transError;

      if (!transactions || transactions.length === 0) {
        setPaymentRecords([]);
        setShowResults(true);
        toast({ title: "Nenhum pagamento encontrado no período selecionado" });
        setLoading(false);
        return;
      }

      // Separar transações por tipo
      const installmentRefIds: string[] = [];
      const accountPayableRefIds: string[] = [];

      transactions.forEach((t) => {
        if (t.reference_type === "accounts_payable_installments") {
          installmentRefIds.push(t.reference_id);
        } else if (t.reference_type === "accounts_payable") {
          accountPayableRefIds.push(t.reference_id);
        }
      });

      // Buscar todos os dados em paralelo
      const [installmentsResult, directAccountsResult, installmentPaymentsResult, directPaymentsResult] =
        await Promise.all([
          // Buscar parcelas e contas a pagar relacionadas
          installmentRefIds.length > 0
            ? supabase
                .from("accounts_payable_installments")
                .select(
                  `
                id,
                installment_number,
                account_payable_id,
                accounts_payable!inner (
                  id,
                  document_number,
                  description,
                  attachments,
                  employee_id,
                  supplier_id
                )
              `,
                )
                .in("id", installmentRefIds)
            : Promise.resolve({ data: [] }),

          // Buscar contas a pagar diretas
          accountPayableRefIds.length > 0
            ? supabase
                .from("accounts_payable")
                .select(
                  `
                id,
                document_number,
                description,
                attachments,
                employee_id,
                supplier_id
              `,
                )
                .in("id", accountPayableRefIds)
            : Promise.resolve({ data: [] }),

          // Buscar pagamentos das parcelas
          installmentRefIds.length > 0
            ? supabase
                .from("accounts_payable_payments")
                .select("installment_id, interest_amount, discount_amount")
                .in("installment_id", installmentRefIds)
            : Promise.resolve({ data: [] }),

          // Buscar pagamentos diretos
          accountPayableRefIds.length > 0
            ? supabase
                .from("accounts_payable_payments")
                .select("account_payable_id, interest_amount, discount_amount")
                .in("account_payable_id", accountPayableRefIds)
            : Promise.resolve({ data: [] }),
        ]);

      // Criar mapas para lookup rápido
      const installmentsMap = new Map<string, any>();
      (installmentsResult.data || []).forEach((inst: any) => {
        installmentsMap.set(inst.id, inst);
      });

      const directAccountsMap = new Map<string, any>();
      (directAccountsResult.data || []).forEach((ap: any) => {
        directAccountsMap.set(ap.id, ap);
      });

      const installmentPaymentsMap = new Map<string, any>();
      (installmentPaymentsResult.data || []).forEach((p: any) => {
        installmentPaymentsMap.set(p.installment_id, p);
      });

      const directPaymentsMap = new Map<string, any>();
      (directPaymentsResult.data || []).forEach((p: any) => {
        directPaymentsMap.set(p.account_payable_id, p);
      });

      // Coletar IDs únicos de fornecedores, funcionários e contas a pagar para buscar nomes e totais de parcelas
      const supplierIds = new Set<string>();
      const employeeIds = new Set<string>();
      const accountPayableIdsForInstallmentCount = new Set<string>();

      installmentsMap.forEach((inst) => {
        const ap = inst.accounts_payable;
        if (ap?.supplier_id) supplierIds.add(ap.supplier_id);
        if (ap?.employee_id) employeeIds.add(ap.employee_id);
        if (inst.account_payable_id) accountPayableIdsForInstallmentCount.add(inst.account_payable_id);
      });

      directAccountsMap.forEach((ap) => {
        if (ap.supplier_id) supplierIds.add(ap.supplier_id);
        if (ap.employee_id) employeeIds.add(ap.employee_id);
      });

      // Buscar fornecedores, funcionários e contagem de parcelas em paralelo
      const [suppliersResult, employeesResult, installmentCountsResult] = await Promise.all([
        supplierIds.size > 0
          ? supabase.from("suppliers").select("id, name").in("id", Array.from(supplierIds))
          : Promise.resolve({ data: [] }),

        employeeIds.size > 0
          ? supabase.from("employees").select("id, name").in("id", Array.from(employeeIds))
          : Promise.resolve({ data: [] }),

        accountPayableIdsForInstallmentCount.size > 0
          ? supabase
              .from("accounts_payable_installments")
              .select("account_payable_id, installment_number")
              .in("account_payable_id", Array.from(accountPayableIdsForInstallmentCount))
          : Promise.resolve({ data: [] }),
      ]);

      // Criar mapas para lookup
      const suppliersMap = new Map<string, string>();
      (suppliersResult.data || []).forEach((s: any) => {
        suppliersMap.set(s.id, s.name);
      });

      const employeesMap = new Map<string, string>();
      (employeesResult.data || []).forEach((e: any) => {
        employeesMap.set(e.id, e.name);
      });

      // Calcular total de parcelas por conta
      const totalInstallmentsMap = new Map<string, number>();
      (installmentCountsResult.data || []).forEach((inst: any) => {
        const current = totalInstallmentsMap.get(inst.account_payable_id) || 0;
        totalInstallmentsMap.set(inst.account_payable_id, Math.max(current, inst.installment_number));
      });

      // Processar transações com os dados em cache
      const paymentRecordsData: PaymentRecord[] = transactions.map((transaction) => {
        let accountPayableId: string | null = null;
        let installmentNumber: number | null = null;
        let totalInstallments: number | null = null;
        let documentNumber: string | null = null;
        let description = transaction.description || "";
        let supplierName: string | null = null;
        let employeeName: string | null = null;
        let attachments: any = null;
        let interestAmount = 0;
        let discountAmount = 0;

        if (transaction.reference_type === "accounts_payable_installments") {
          const installmentData = installmentsMap.get(transaction.reference_id);
          if (installmentData) {
            const ap = installmentData.accounts_payable;
            accountPayableId = installmentData.account_payable_id;
            installmentNumber = installmentData.installment_number;
            documentNumber = ap?.document_number || null;
            description = ap?.description || description;
            attachments = ap?.attachments || null;

            if (ap?.supplier_id) {
              supplierName = suppliersMap.get(ap.supplier_id) || null;
            }
            if (ap?.employee_id) {
              employeeName = employeesMap.get(ap.employee_id) || null;
            }

            totalInstallments = totalInstallmentsMap.get(accountPayableId!) || 1;

            const paymentData = installmentPaymentsMap.get(transaction.reference_id);
            if (paymentData) {
              interestAmount = paymentData.interest_amount || 0;
              discountAmount = paymentData.discount_amount || 0;
            }
          }
        } else if (transaction.reference_type === "accounts_payable") {
          const apData = directAccountsMap.get(transaction.reference_id);
          if (apData) {
            accountPayableId = apData.id;
            documentNumber = apData.document_number;
            description = apData.description || description;
            attachments = apData.attachments;

            if (apData.supplier_id) {
              supplierName = suppliersMap.get(apData.supplier_id) || null;
            }
            if (apData.employee_id) {
              employeeName = employeesMap.get(apData.employee_id) || null;
            }

            const paymentData = directPaymentsMap.get(transaction.reference_id);
            if (paymentData) {
              interestAmount = paymentData.interest_amount || 0;
              discountAmount = paymentData.discount_amount || 0;
            }
          }
        }

        return {
          id: transaction.id,
          payment_date: transaction.transaction_date,
          amount_paid: transaction.amount,
          interest_amount: interestAmount,
          discount_amount: discountAmount,
          payment_account_id: transaction.account_id,
          payment_account_type: null,
          description,
          document_number: documentNumber,
          supplier_name: supplierName,
          employee_name: employeeName,
          installment_number: installmentNumber,
          total_installments: totalInstallments,
          attachments,
          account_payable_id: accountPayableId,
        };
      });

      setPaymentRecords(paymentRecordsData);
      setShowResults(true);

      if (paymentRecordsData.length === 0) {
        toast({ title: "Nenhum pagamento encontrado no período selecionado" });
      }
    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
      toast({ title: "Erro ao buscar pagamentos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return "-";
    const account = accounts.find((acc) => acc.id === accountId);
    return account?.name || "-";
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const storeName = stores.find((s) => s.id === selectedStore)?.name || "";

    doc.setFontSize(16);
    doc.text("Relatório de Exportação Contabilidade", 14, 15);

    doc.setFontSize(10);
    doc.text(`Fazenda: ${storeName}`, 14, 25);
    doc.text(`Período: ${formatDate(paymentStartDate)} a ${formatDate(paymentEndDate)}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 35);

    const tableData = paymentRecords.map((record) => [
      formatDate(record.payment_date),
      record.description || "-",
      record.supplier_name || record.employee_name || "-",
      record.document_number || "-",
      record.installment_number ? `${record.installment_number}/${record.total_installments || 1}` : "1",
      getAccountName(record.payment_account_id),
      formatCurrency(record.amount_paid),
      formatCurrency(record.interest_amount),
      formatCurrency(record.discount_amount),
      formatCurrency(record.amount_paid + record.interest_amount - record.discount_amount),
    ]);

    const total = paymentRecords.reduce((acc, r) => acc + r.amount_paid + r.interest_amount - r.discount_amount, 0);

    tableData.push(["", "", "", "", "", "TOTAL", "", "", "", formatCurrency(total)]);

    autoTable(doc, {
      head: [
        [
          "Data Pgto",
          "Descrição",
          "Fornecedor",
          "Documento",
          "Parcela",
          "Conta",
          "Valor",
          "Juros",
          "Desconto",
          "Total",
        ],
      ],
      body: tableData,
      startY: 42,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`contabilidade_${storeName}_${paymentStartDate}_${paymentEndDate}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  const exportAttachmentsZip = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      let hasAttachments = false;

      for (const record of paymentRecords) {
        const attachments = record.attachments;
        if (!attachments || !Array.isArray(attachments) || attachments.length === 0) continue;

        const folderName = `${formatDate(record.payment_date)}_${record.description?.substring(0, 30) || "conta"}_${record.id.substring(0, 8)}`;
        const folder = zip.folder(folderName.replace(/[/\\?%*:|"<>]/g, "_"));

        for (const attachment of attachments) {
          const filePath = attachment.url || attachment.path;
          if (!filePath) continue;

          try {
            const { data, error } = await supabase.storage.from("account-documents").createSignedUrl(filePath, 3600);

            if (error || !data?.signedUrl) {
              console.error("Erro ao criar URL assinada:", error);
              continue;
            }

            const response = await fetch(data.signedUrl);
            if (!response.ok) continue;

            const blob = await response.blob();
            folder?.file(attachment.name || filePath.split("/").pop() || "arquivo", blob);
            hasAttachments = true;
          } catch (err) {
            console.error("Erro ao baixar anexo:", err);
          }
        }
      }

      if (!hasAttachments) {
        toast({ title: "Nenhum anexo encontrado nos pagamentos selecionados", variant: "destructive" });
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `anexos_contabilidade_${paymentStartDate}_${paymentEndDate}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: "Anexos exportados com sucesso!" });
    } catch (error) {
      console.error("Erro ao exportar anexos:", error);
      toast({ title: "Erro ao exportar anexos", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Exportar Contabilidade</h1>
            <p className="text-sm text-muted-foreground">Exporte pagamentos e anexos para contabilidade</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período, Fazenda e contas para exportação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial Pagamento</Label>
                <Input type="date" value={paymentStartDate} onChange={(e) => setPaymentStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Final Pagamento</Label>
                <Input type="date" value={paymentEndDate} onChange={(e) => setPaymentEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fazenda</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma Fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {accounts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Contas de Pagamento</Label>
                  <Button variant="ghost" size="sm" onClick={handleSelectAllAccounts}>
                    {selectedAccounts.length === accounts.length ? "Desmarcar Todas" : "Selecionar Todas"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={account.id}
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => handleAccountToggle(account.id)}
                      />
                      <label htmlFor={account.id} className="text-sm cursor-pointer">
                        {account.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Buscar Pagamentos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {showResults && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Pagamentos Encontrados</CardTitle>
                  <CardDescription>{paymentRecords.length} pagamento(s) no período selecionado</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportToPDF} disabled={paymentRecords.length === 0}>
                    <FileText className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button onClick={exportAttachmentsZip} disabled={paymentRecords.length === 0 || exporting}>
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exportar Anexos (ZIP)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paymentRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Juros</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-center">Anexos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentRecords.map((record) => {
                        const attachments = record.attachments;
                        const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;
                        return (
                          <TableRow key={record.id}>
                            <TableCell>{formatDate(record.payment_date)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{record.description || "-"}</TableCell>
                            <TableCell>{record.supplier_name || record.employee_name || "-"}</TableCell>
                            <TableCell>{record.document_number || "-"}</TableCell>
                            <TableCell>
                              {record.installment_number
                                ? `${record.installment_number}/${record.total_installments || 1}`
                                : "1"}
                            </TableCell>
                            <TableCell>{getAccountName(record.payment_account_id)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.amount_paid)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.interest_amount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.discount_amount)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(record.amount_paid + record.interest_amount - record.discount_amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              {attachmentCount > 0 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                                  {attachmentCount}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={6}>TOTAL</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(paymentRecords.reduce((acc, r) => acc + r.amount_paid, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(paymentRecords.reduce((acc, r) => acc + r.interest_amount, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(paymentRecords.reduce((acc, r) => acc + r.discount_amount, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            paymentRecords.reduce(
                              (acc, r) => acc + r.amount_paid + r.interest_amount - r.discount_amount,
                              0,
                            ),
                          )}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento encontrado no período selecionado.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AccountingExportReport;
