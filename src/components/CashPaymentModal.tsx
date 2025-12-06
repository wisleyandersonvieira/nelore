import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";

interface CashAccount {
  id: string;
  name: string;
  bank: string | null;
  account_number: string | null;
}

interface AccountPayable {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  store_id: string;
  supplier_id?: string;
  suppliers?: { name: string };
}

interface CashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountPayable: AccountPayable | null;
  onPaymentSuccess?: () => void;
}

export function CashPaymentModal({ 
  open, 
  onOpenChange, 
  accountPayable,
  onPaymentSuccess 
}: CashPaymentModalProps) {
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCashAccounts();
      setSelectedAccountId("");
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setSurcharge(0);
      setDiscount(0);
    }
  }, [open]);

  const fetchCashAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("cash_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCashAccounts(data || []);
    } catch (error) {
      console.error("Error fetching cash accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas caixa",
        variant: "destructive",
      });
    }
  };

  const handlePayment = async () => {
    if (!accountPayable || !selectedAccountId || !paymentDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validate payment period
    const paymentValidation = await validateAccountsPayablePeriod.pagamento(paymentDate);
    if (paymentValidation.blocked) {
      toast({
        title: "Período Bloqueado",
        description: paymentValidation.message,
        variant: "destructive",
      });
      return;
    }

    // Validate cash account is linked to the store
    try {
      const { data: accountStores, error: storesError } = await supabase
        .from("cash_account_stores")
        .select("store_id")
        .eq("account_id", selectedAccountId);

      if (storesError) throw storesError;

      const allowedStoreIds = accountStores?.map(store => store.store_id) || [];
      
      if (!allowedStoreIds.includes(accountPayable.store_id)) {
        toast({
          title: "Conta não autorizada",
          description: "A conta caixa selecionada não está vinculada à loja desta conta a pagar.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error("Error validating account:", error);
      toast({
        title: "Erro",
        description: "Erro ao validar a conta selecionada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("User not authenticated");
      }

      const baseAmount = Number(accountPayable.amount);
      const finalAmount = baseAmount + surcharge - discount;

      // Get user's store_id for the transaction
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single();

      // Buscar produtos configurados para acréscimo e desconto
      if (surcharge > 0) {
        const { data: surchargeParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "acrescimo")
          .single();
        
        if (surchargeParam?.products) {
          await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: accountPayable.id,
              product_id: (surchargeParam.products as any).id,
              quantity: 1,
              unit_price: surcharge,
              total_price: surcharge,
              store_id: accountPayable.store_id,
            });
        }
      }

      if (discount > 0) {
        const { data: discountParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "desconto")
          .single();
        
        if (discountParam?.products) {
          await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: accountPayable.id,
              product_id: (discountParam.products as any).id,
              quantity: 1,
              unit_price: -discount,
              total_price: -discount,
              store_id: accountPayable.store_id,
            });
        }
      }

      // Update account payable status
      const { error: updateError } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          payment_date: paymentDate,
          amount: finalAmount,
        })
        .eq("id", accountPayable.id);

      if (updateError) throw updateError;

      // Create financial transaction
      const { error: transactionError } = await supabase
        .from("financial_transactions")
        .insert({
          store_id: accountPayable.store_id,
          account_id: selectedAccountId,
          transaction_type: "saida",
          amount: finalAmount,
          transaction_date: paymentDate,
          description: `Pagamento: ${accountPayable.description}`,
          reference_id: accountPayable.id,
          reference_type: "accounts_payable",
          created_by: user.id,
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Sucesso",
        description: "Pagamento realizado com sucesso",
      });

      onOpenChange(false);
      onPaymentSuccess?.();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const baseAmount = accountPayable ? Number(accountPayable.amount) : 0;
  const finalAmount = baseAmount + surcharge - discount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar Conta</DialogTitle>
        </DialogHeader>
        
        {accountPayable && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{accountPayable.description}</p>
              <p className="text-sm text-muted-foreground">
                Fornecedor: {accountPayable.suppliers?.name || '-'}
              </p>
              <p className="text-sm text-muted-foreground">
                Vencimento: {new Date(accountPayable.due_date).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-lg font-semibold text-primary">
                Valor Original: R$ {baseAmount.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Conta Caixa para Pagamento *</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta caixa" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - Conta Caixa
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Pagamento *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Acréscimo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={surcharge}
                  onChange={(e) => setSurcharge(Number(e.target.value) || 0)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-lg font-bold text-center">
                Valor Final: R$ {finalAmount.toFixed(2)}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePayment} 
                disabled={loading || !selectedAccountId || !paymentDate}
              >
                {loading ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
