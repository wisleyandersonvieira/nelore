import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommissionFormModal } from "@/components/CommissionFormModal";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/utils/supabasePagination";
import { fetchAccessibleStoreScope, formatCurrencyBRL, SaleInstallmentDraft } from "@/lib/sales";
import { COMMISSION_KIND_LABELS, CommissionKind, deleteCommissionWithPayable } from "@/lib/commissions";
import {
  Activity,
  CircleDollarSign,
  Eye,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LinkedPayableRow {
  id: string;
  dueDate: string;
  issueDate: string | null;
  documentType: string | null;
  documentNumber: string | null;
  paymentDate: string | null;
  status: string;
  totalAmount: number;
}

interface CommissionRow {
  id: string;
  code: number;
  auctionId: string;
  auctionName: string;
  supplierId: string;
  supplierName: string;
  commissionKind: CommissionKind;
  commissionDate: string;
  totalAmount: number;
  itemCount: number;
  installmentCount: number;
  linkedPayables: LinkedPayableRow[];
  installments: SaleInstallmentDraft[];
  paidAmount: number;
  pendingAmount: number;
  status: "pending" | "partial" | "paid";
}

interface CommissionTableRow {
  id: string;
  code: number;
  auction_id: string;
  supplier_id: string;
  commission_kind: CommissionKind;
  commission_date: string;
  total_amount: number;
  installment_count: number;
}

interface PayableTableRow {
  id: string;
  commission_id: string | null;
  due_date: string;
  issue_date: string | null;
  document_type: string | null;
  document_number: string | null;
  payment_date: string | null;
  status: string;
  total_amount: number | null;
  amount: number;
}

const statusMeta: Record<CommissionRow["status"], { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  partial: {
    label: "Parcial",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  paid: {
    label: "Paga",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const computeStatus = (totalAmount: number, installments: SaleInstallmentDraft[]) => {
  const paidAmount = installments.reduce(
    (sum, installment) => sum + (installment.payment_date ? Number(installment.amount || 0) : 0),
    0,
  );
  const normalizedPaid = Number(paidAmount.toFixed(2));
  const pendingAmount = Number(Math.max(totalAmount - normalizedPaid, 0).toFixed(2));

  if (pendingAmount <= 0.01) {
    return {
      status: "paid" as const,
      paidAmount: totalAmount,
      pendingAmount: 0,
    };
  }

  if (normalizedPaid > 0) {
    return {
      status: "partial" as const,
      paidAmount: normalizedPaid,
      pendingAmount,
    };
  }

  return {
    status: "pending" as const,
    paidAmount: 0,
    pendingAmount: totalAmount,
  };
};

const CommissionsModule = () => {
  const { canView, canEdit, loading: permissionsLoading } = useFinanceiroPermissions();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commissionToDelete, setCommissionToDelete] = useState<CommissionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();
      if (Array.isArray(storeIds) && storeIds.length === 0) {
        setCommissions([]);
        return;
      }

      const commissionsData = await fetchAllPaginated<CommissionTableRow>(() => {
        let query = supabase.from("commissions").select("id, code, auction_id, supplier_id, commission_kind, commission_date, total_amount, installment_count").order("commission_date", { ascending: false });
        if (storeIds && storeIds.length > 0) {
          query = query.in("store_id", storeIds);
        }
        return query;
      });

      if (commissionsData.length === 0) {
        setCommissions([]);
        return;
      }

      const auctionIds = Array.from(new Set(commissionsData.map((commission) => commission.auction_id).filter(Boolean)));
      const supplierIds = Array.from(new Set(commissionsData.map((commission) => commission.supplier_id).filter(Boolean)));
      const commissionIds = commissionsData.map((commission) => commission.id);

      const [auctionsRes, suppliersRes, itemsData, payablesData] = await Promise.all([
        auctionIds.length > 0 ? supabase.from("leiloes").select("id, code, name").in("id", auctionIds) : Promise.resolve({ data: [], error: null }),
        supplierIds.length > 0 ? supabase.from("suppliers").select("id, name").in("id", supplierIds) : Promise.resolve({ data: [], error: null }),
        fetchAllPaginated<{ commission_id: string }>(() => supabase.from("commission_items").select("commission_id").in("commission_id", commissionIds)),
        fetchAllPaginated<PayableTableRow>(() =>
          supabase
            .from("accounts_payable")
            .select("id, commission_id, due_date, issue_date, document_type, document_number, payment_date, status, total_amount, amount")
            .in("commission_id", commissionIds),
        ),
      ]);

      if (auctionsRes.error) throw auctionsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      const auctionMap = new Map((auctionsRes.data || []).map((auction: any) => [auction.id, `${auction.code} - ${auction.name}`]));
      const supplierMap = new Map((suppliersRes.data || []).map((supplier: any) => [supplier.id, supplier.name]));
      const itemCountMap = new Map<string, number>();
      itemsData.forEach((item) => {
        itemCountMap.set(item.commission_id, (itemCountMap.get(item.commission_id) || 0) + 1);
      });

      const payablesByCommission = new Map<string, PayableTableRow[]>();
      payablesData.forEach((payable) => {
        if (!payable.commission_id) return;
        const current = payablesByCommission.get(payable.commission_id) || [];
        current.push(payable);
        payablesByCommission.set(payable.commission_id, current);
      });

      const payableIds = payablesData.map((payable) => payable.id);
      const installmentsData =
        payableIds.length > 0
          ? await fetchAllPaginated<{
              account_payable_id: string;
              installment_number: number;
              due_date: string;
              amount: number;
              payment_date: string | null;
            }>(() =>
              supabase
                .from("accounts_payable_installments")
                .select("account_payable_id, installment_number, due_date, amount, payment_date")
                .in("account_payable_id", payableIds)
                .order("installment_number", { ascending: true }),
            )
          : [];

      const installmentsMap = new Map<string, SaleInstallmentDraft[]>();
      installmentsData.forEach((installment) => {
        const current = installmentsMap.get(installment.account_payable_id) || [];
        current.push({
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: Number(installment.amount || 0),
          payment_date: installment.payment_date,
        });
        installmentsMap.set(installment.account_payable_id, current);
      });

      const rows = commissionsData.map((commission) => {
        const linkedPayables = (payablesByCommission.get(commission.id) || []).map((payable) => ({
          id: payable.id,
          dueDate: payable.due_date,
          issueDate: payable.issue_date,
          documentType: payable.document_type,
          documentNumber: payable.document_number,
          paymentDate: payable.payment_date,
          status: payable.status,
          totalAmount: Number(payable.total_amount ?? payable.amount ?? 0),
        }));

        const installments = linkedPayables.flatMap((payable) => {
          const entries = installmentsMap.get(payable.id) || [];
          if (entries.length > 0) return entries;
          return [
            {
              installment_number: 1,
              due_date: payable.dueDate,
              amount: payable.totalAmount,
              payment_date: payable.paymentDate,
            },
          ];
        });

        const { status, paidAmount, pendingAmount } = computeStatus(Number(commission.total_amount || 0), installments);

        return {
          id: commission.id,
          code: Number(commission.code),
          auctionId: commission.auction_id,
          auctionName: auctionMap.get(commission.auction_id) || "Leilão não encontrado",
          supplierId: commission.supplier_id,
          supplierName: supplierMap.get(commission.supplier_id) || "Fornecedor não encontrado",
          commissionKind: commission.commission_kind,
          commissionDate: commission.commission_date,
          totalAmount: Number(commission.total_amount || 0),
          itemCount: itemCountMap.get(commission.id) || 0,
          installmentCount: Number(commission.installment_count || 1),
          linkedPayables,
          installments,
          paidAmount,
          pendingAmount,
          status,
        } satisfies CommissionRow;
      });

      setCommissions(rows);
    } catch (error) {
      console.error("Erro ao carregar comissões:", error);
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canView) {
      setLoading(false);
      return;
    }

    void loadCommissions();
  }, [permissionsLoading, canView]);

  const filteredCommissions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return commissions;

    return commissions.filter((commission) =>
      `${commission.code} ${commission.auctionName} ${commission.supplierName} ${COMMISSION_KIND_LABELS[commission.commissionKind]}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [commissions, searchTerm]);

  const summary = useMemo(() => {
    const total = commissions.reduce((sum, commission) => sum + commission.totalAmount, 0);
    const paid = commissions.reduce((sum, commission) => sum + commission.paidAmount, 0);
    const pending = commissions.reduce((sum, commission) => sum + commission.pendingAmount, 0);

    return [
      {
        title: "Comissões registradas",
        value: `${commissions.length}`,
        description: "Cadastros financeiros no módulo",
        icon: Activity,
      },
      {
        title: "Valor total",
        value: formatCurrencyBRL(total),
        description: "Montante consolidado das comissões",
        icon: WalletCards,
      },
      {
        title: "Pago",
        value: formatCurrencyBRL(paid),
        description: "Baixas financeiras identificadas",
        icon: HandCoins,
      },
      {
        title: "Pendente",
        value: formatCurrencyBRL(pending),
        description: "Saldo aberto no Contas a Pagar",
        icon: CircleDollarSign,
      },
    ];
  }, [commissions]);

  const handleOpenForm = (mode: "create" | "edit" | "view", commissionId?: string | null) => {
    setFormMode(mode);
    setSelectedCommissionId(commissionId || null);
    setFormOpen(true);
  };

  const handleRequestDelete = (commission: CommissionRow) => {
    setCommissionToDelete(commission);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!commissionToDelete) return;

    setDeleting(true);
    try {
      const result = await deleteCommissionWithPayable(commissionToDelete.id);
      toast.success(
        result?.commission_code
          ? `Comissão #${result.commission_code} removida com seus títulos pendentes.`
          : "Comissão removida com sucesso.",
      );
      setDeleteDialogOpen(false);
      setCommissionToDelete(null);
      await loadCommissions();
    } catch (error: any) {
      console.error("Erro ao excluir comissão:", error);
      toast.error(error?.message || "Não foi possível excluir a comissão.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteBlockedReason = useMemo(() => {
    if (!commissionToDelete || !canEdit) return null;
    if (commissionToDelete.status !== "pending") {
      return "Somente comissões com status pendente podem ser excluídas.";
    }
    if (commissionToDelete.linkedPayables.some((payable) => payable.status !== "pending" || Boolean(payable.paymentDate))) {
      return "A comissão possui título com pagamento realizado ou com status diferente de pendente.";
    }
    if (commissionToDelete.installments.some((installment) => installment.payment_date)) {
      return "A comissão possui parcela paga e não pode ser excluída.";
    }
    return null;
  }, [canEdit, commissionToDelete]);

  if (permissionsLoading || loading) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-2xl border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            O módulo de comissões segue as permissões do Financeiro. Solicite acesso para visualizar ou editar os registros.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Comissões</h1>
            <p className="text-muted-foreground">
              Controle as comissões de compra e venda com geração automática no Contas a Pagar.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por código, leilão ou fornecedor"
                className="pl-9"
              />
            </div>

            {canEdit && (
              <Button onClick={() => handleOpenForm("create")}>
                <Plus className="mr-2 h-4 w-4" />
                Nova comissão
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.title} className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-muted/60 p-3">
                  <item.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{item.title}</p>
                  <p className="text-2xl font-semibold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Painel de comissões</CardTitle>
            <CardDescription>
              Acompanhe os itens vinculados, o status financeiro e as ações disponíveis para cada comissão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Leilão</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                        Nenhuma comissão encontrada com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">#{commission.code}</TableCell>
                        <TableCell>{formatDateBR(commission.commissionDate)}</TableCell>
                        <TableCell>{commission.auctionName}</TableCell>
                        <TableCell>{commission.supplierName}</TableCell>
                        <TableCell>{COMMISSION_KIND_LABELS[commission.commissionKind]}</TableCell>
                        <TableCell className="text-center">{commission.itemCount}</TableCell>
                        <TableCell className="text-right">{formatCurrencyBRL(commission.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(statusMeta[commission.status].className)}>
                            {statusMeta[commission.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenForm("view", commission.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => handleOpenForm("edit", commission.id)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => handleRequestDelete(commission)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CommissionFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={loadCommissions}
        mode={formMode}
        commissionId={selectedCommissionId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comissão</AlertDialogTitle>
            <AlertDialogDescription>
              {commissionToDelete
                ? `Você está prestes a excluir a comissão #${commissionToDelete.code}.`
                : "Esta ação removerá a comissão selecionada."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {commissionToDelete && (
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
              <p><span className="font-medium">Leilão:</span> {commissionToDelete.auctionName}</p>
              <p><span className="font-medium">Fornecedor:</span> {commissionToDelete.supplierName}</p>
              <p><span className="font-medium">Valor total:</span> {formatCurrencyBRL(commissionToDelete.totalAmount)}</p>
            </div>
          )}

          {deleteBlockedReason && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {deleteBlockedReason}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={Boolean(deleteBlockedReason) || deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommissionsModule;
