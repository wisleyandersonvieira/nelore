import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock } from "lucide-react";

interface ReparcelamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    description: string;
    amount: number;
    suppliers?: { name: string };
    creditors?: { name: string };
    employees?: { name: string };
  } | null;
  onSuccess: () => void;
  kind?: "payable" | "receivable";
}

interface PendingInstallment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
}

export function ReparcelamentoModal({ open, onOpenChange, account, onSuccess, kind = "payable" }: ReparcelamentoModalProps) {
  const [pendingInstallments, setPendingInstallments] = useState<PendingInstallment[]>([]);
  const [newFirstDueDate, setNewFirstDueDate] = useState("");
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isRec = kind === "receivable";
  const instTable = (isRec ? "accounts_receivable_installments" : "accounts_payable_installments") as "accounts_payable_installments";
  const mainTable = (isRec ? "accounts_receivable" : "accounts_payable") as "accounts_payable";
  const fkCol = (isRec ? "account_receivable_id" : "account_payable_id") as "account_payable_id";

  useEffect(() => {
    if (open && account) {
      fetchPendingInstallments();
      setNewFirstDueDate("");
      setPreviewDates([]);
    }
  }, [open, account]);

  useEffect(() => {
    if (newFirstDueDate && pendingInstallments.length > 0) {
      calculatePreviewDates();
    } else {
      setPreviewDates([]);
    }
  }, [newFirstDueDate, pendingInstallments]);

  const fetchPendingInstallments = async () => {
    if (!account) return;
    const { data, error } = await supabase
      .from(instTable)
      .select("*")
      .eq(fkCol, account.id)
      .is("payment_date", null)
      .neq("status", "pagamento_suspenso")
      .order("installment_number");

    if (error) {
      console.error("Erro ao buscar parcelas:", error);
      return;
    }
    setPendingInstallments(data || []);
  };

  const calculatePreviewDates = () => {
    if (!newFirstDueDate || pendingInstallments.length === 0) return;

    const dates: string[] = [];
    const baseDate = new Date(newFirstDueDate + "T12:00:00");

    for (let i = 0; i < pendingInstallments.length; i++) {
      const newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() + i);
      const yyyy = newDate.getFullYear();
      const mm = String(newDate.getMonth() + 1).padStart(2, "0");
      const dd = String(newDate.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    setPreviewDates(dates);
  };

  const handleConfirm = async () => {
    if (!account || !newFirstDueDate || previewDates.length === 0) return;

    if (!confirm("Tem certeza que deseja reparcelar as parcelas pendentes? Os vencimentos serão recalculados.")) {
      return;
    }

    setLoading(true);
    try {
      for (let i = 0; i < pendingInstallments.length; i++) {
        const { error } = await supabase
          .from(instTable)
          .update({ due_date: previewDates[i] })
          .eq("id", pendingInstallments[i].id);

        if (error) throw error;
      }

      // Update the main account's due_date to the first pending installment's new date
      await supabase
        .from(mainTable)
        .update({ due_date: previewDates[0] })
        .eq("id", account.id);

      toast({
        title: "Sucesso",
        description: "Parcelas reparceladas com sucesso!",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao reparcelar:", error);
      toast({
        title: "Erro",
        description: "Erro ao reparcelar parcelas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const supplierName = account?.suppliers?.name || account?.creditors?.name || account?.employees?.name || "-";
  const totalParcelas = pendingInstallments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Reparcelamento
          </DialogTitle>
          <DialogDescription>
            Recalcule os vencimentos das parcelas pendentes
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
                <Label className="text-xs text-muted-foreground">Valor Total</Label>
                <p className="text-sm font-medium">R$ {Number(account.amount).toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Parcelas Pendentes</Label>
                <p className="text-sm font-medium">{totalParcelas}</p>
              </div>
            </div>

            {totalParcelas === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Não há parcelas pendentes para reparcelar.
              </p>
            ) : (
              <>
                {/* Nova data do primeiro vencimento */}
                <div className="space-y-2">
                  <Label htmlFor="new-first-date">Nova data do primeiro vencimento</Label>
                  <Input
                    id="new-first-date"
                    type="date"
                    value={newFirstDueDate}
                    onChange={(e) => setNewFirstDueDate(e.target.value)}
                  />
                </div>

                {/* Tabela de pré-visualização */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento Atual</TableHead>
                      <TableHead>Novo Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInstallments.map((inst, idx) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_number}</TableCell>
                        <TableCell>
                          {new Date(inst.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className={previewDates[idx] ? "font-medium text-primary" : ""}>
                          {previewDates[idx]
                            ? new Date(previewDates[idx] + "T12:00:00").toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                        <TableCell>R$ {Number(inst.amount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Botões */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={loading || !newFirstDueDate || previewDates.length === 0}
                  >
                    {loading ? "Processando..." : "Confirmar Reparcelamento"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
