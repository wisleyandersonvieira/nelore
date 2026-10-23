import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PauseCircle, PlayCircle } from "lucide-react";

interface SuspenderPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    description: string;
    amount: number;
    status: string;
    suppliers?: { name: string };
    creditors?: { name: string };
    employees?: { name: string };
  } | null;
  mode: "suspend" | "reactivate";
  onSuccess: () => void;
  kind?: "payable" | "receivable";
}

interface Installment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
}

export function SuspenderPagamentoModal({ open, onOpenChange, account, mode, onSuccess, kind = "payable" }: SuspenderPagamentoModalProps) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [newFirstDueDate, setNewFirstDueDate] = useState("");
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isRec = kind === "receivable";
  const instTable = (isRec ? "accounts_receivable_installments" : "accounts_payable_installments") as "accounts_payable_installments";
  const mainTable = (isRec ? "accounts_receivable" : "accounts_payable") as "accounts_payable";
  const fkCol = (isRec ? "account_receivable_id" : "account_payable_id") as "account_payable_id";

  const isSuspend = mode === "suspend";

  useEffect(() => {
    if (open && account) {
      fetchInstallments();
      setNewFirstDueDate("");
      setPreviewDates([]);
    }
  }, [open, account, mode]);

  useEffect(() => {
    if (!isSuspend && newFirstDueDate && installments.length > 0) {
      calculatePreviewDates();
    } else {
      setPreviewDates([]);
    }
  }, [newFirstDueDate, installments, isSuspend]);

  const fetchInstallments = async () => {
    if (!account) return;

    if (isSuspend) {
      // Fetch pending (unpaid, not suspended) installments
      const { data, error } = await supabase
        .from(instTable)
        .select("*")
        .eq(fkCol, account.id)
        .is("payment_date", null)
        .eq("status", "pending")
        .order("installment_number");

      if (error) {
        console.error("Erro ao buscar parcelas:", error);
        return;
      }
      setInstallments(data || []);
    } else {
      // Fetch suspended installments
      const { data, error } = await supabase
        .from(instTable)
        .select("*")
        .eq(fkCol, account.id)
        .eq("status", "pagamento_suspenso")
        .order("installment_number");

      if (error) {
        console.error("Erro ao buscar parcelas suspensas:", error);
        return;
      }
      setInstallments(data || []);
    }
  };

  const calculatePreviewDates = () => {
    if (!newFirstDueDate || installments.length === 0) return;

    const dates: string[] = [];
    const baseDate = new Date(newFirstDueDate + "T12:00:00");

    for (let i = 0; i < installments.length; i++) {
      const newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() + i);
      const yyyy = newDate.getFullYear();
      const mm = String(newDate.getMonth() + 1).padStart(2, "0");
      const dd = String(newDate.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    setPreviewDates(dates);
  };

  const handleSuspend = async () => {
    if (!account || installments.length === 0) return;

    if (!confirm("Tem certeza que deseja suspender o pagamento das parcelas pendentes?")) {
      return;
    }

    setLoading(true);
    try {
      const ids = installments.map((i) => i.id);
      const { error } = await supabase
        .from(instTable)
        .update({ status: "pagamento_suspenso" })
        .in("id", ids);

      if (error) throw error;

      // Check if all installments are now suspended or paid
      const { data: allInstallments } = await supabase
        .from(instTable)
        .select("status, payment_date")
        .eq(fkCol, account.id);

      const hasPending = allInstallments?.some((i) => i.status === "pending" && !i.payment_date);
      const hasPaid = allInstallments?.some((i) => i.payment_date !== null);
      const allSuspendedOrPaid = !hasPending;

      if (allSuspendedOrPaid && !hasPaid) {
        // All installments are suspended - update main account status
        await supabase
          .from(mainTable)
          .update({ status: "pagamento_suspenso" })
          .eq("id", account.id);
      } else if (allSuspendedOrPaid && hasPaid) {
        // Some paid, rest suspended
        await supabase
          .from(mainTable)
          .update({ status: "pagamento_suspenso" })
          .eq("id", account.id);
      }

      toast({
        title: "Sucesso",
        description: isRec ? "Recebimento suspenso com sucesso!" : "Pagamento suspenso com sucesso!",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao suspender:", error);
      toast({
        title: "Erro",
        description: "Erro ao suspender pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!account || installments.length === 0 || !newFirstDueDate || previewDates.length === 0) return;

    if (!confirm("Tem certeza que deseja reativar as parcelas suspensas com os novos vencimentos?")) {
      return;
    }

    setLoading(true);
    try {
      for (let i = 0; i < installments.length; i++) {
        const { error } = await supabase
          .from(instTable)
          .update({
            status: "pending",
            due_date: previewDates[i],
          })
          .eq("id", installments[i].id);

        if (error) throw error;
      }

      // Update main account status back to pending or partial
      const { data: allInstallments } = await supabase
        .from(instTable)
        .select("status, payment_date")
        .eq(fkCol, account.id);

      const hasPaid = allInstallments?.some((i) => i.payment_date !== null);
      const newStatus = hasPaid ? "partial" : "pending";

      await supabase
        .from(mainTable)
        .update({ status: newStatus, due_date: previewDates[0] })
        .eq("id", account.id);

      toast({
        title: "Sucesso",
        description: isRec ? "Recebimento reativado com sucesso!" : "Pagamento reativado com sucesso!",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao reativar:", error);
      toast({
        title: "Erro",
        description: "Erro ao reativar pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const supplierName = account?.suppliers?.name || account?.creditors?.name || account?.employees?.name || "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspend ? (
              <PauseCircle className="h-5 w-5" />
            ) : (
              <PlayCircle className="h-5 w-5" />
            )}
            {isSuspend ? (isRec ? "Suspender Recebimento" : "Suspender Pagamento") : (isRec ? "Reativar Recebimento" : "Reativar Pagamento")}
          </DialogTitle>
          <DialogDescription>
            {isSuspend
              ? "Suspenda as parcelas pendentes deste lançamento"
              : "Reative as parcelas suspensas e defina novos vencimentos"}
          </DialogDescription>
        </DialogHeader>

        {account && (
          <div className="space-y-4">
            {/* Info do lançamento */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm font-medium">{account.description}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{isRec ? "Credor" : "Fornecedor"}</Label>
                <p className="text-sm font-medium">{supplierName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {isSuspend ? "Parcelas Pendentes" : "Parcelas Suspensas"}
                </Label>
                <p className="text-sm font-medium">{installments.length}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Total Parcelas</Label>
                <p className="text-sm font-medium">
                  R$ {installments.reduce((sum, i) => sum + Number(i.amount), 0).toFixed(2)}
                </p>
              </div>
            </div>

            {installments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {isSuspend
                  ? "Não há parcelas pendentes para suspender."
                  : "Não há parcelas suspensas para reativar."}
              </p>
            ) : (
              <>
                {/* Campo de nova data (apenas para reativação) */}
                {!isSuspend && (
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-date">Nova data do primeiro vencimento</Label>
                    <Input
                      id="reactivate-date"
                      type="date"
                      value={newFirstDueDate}
                      onChange={(e) => setNewFirstDueDate(e.target.value)}
                    />
                  </div>
                )}

                {/* Tabela de parcelas */}
                <Table className="table-sticky-first">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>{isSuspend ? "Vencimento" : "Vencimento Atual"}</TableHead>
                      {!isSuspend && <TableHead>Novo Vencimento</TableHead>}
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst, idx) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_number}</TableCell>
                        <TableCell>
                          {new Date(inst.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        {!isSuspend && (
                          <TableCell className={previewDates[idx] ? "font-medium text-primary" : ""}>
                            {previewDates[idx]
                              ? new Date(previewDates[idx] + "T12:00:00").toLocaleDateString("pt-BR")
                              : "-"}
                          </TableCell>
                        )}
                        <TableCell>R$ {Number(inst.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              inst.status === "pagamento_suspenso"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {inst.status === "pagamento_suspenso" ? "Suspenso" : "Pendente"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Botões */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                    Cancelar
                  </Button>
                  {isSuspend ? (
                    <Button
                      onClick={handleSuspend}
                      disabled={loading}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {loading ? "Processando..." : (isRec ? "Suspender Recebimento" : "Suspender Pagamento")}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReactivate}
                      disabled={loading || !newFirstDueDate || previewDates.length === 0}
                    >
                      {loading ? "Processando..." : (isRec ? "Reativar Recebimento" : "Reativar Pagamento")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
