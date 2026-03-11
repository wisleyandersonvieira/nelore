import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateAccountsPayablePeriod } from "@/utils/periodValidation";
import { Paperclip, X, Upload, Loader2 } from "lucide-react";

interface Account {
  id: string;
  name: string;
  bank: string | null;
  account_number: string | null;
  type: "cash" | "current" | "card" | "delivery";
}

interface AccountPayable {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  store_id: string;
  supplier_id?: string;
  suppliers?: { name: string };
  attachments?: any[];
}

interface AttachmentFile {
  file: File;
  name: string;
  title: string;
}

interface CashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountPayable: AccountPayable | null;
  onPaymentSuccess?: () => void;
  showAllAccounts?: boolean;
}

export function CashPaymentModal({ 
  open, 
  onOpenChange, 
  accountPayable,
  onPaymentSuccess,
  showAllAccounts = false
}: CashPaymentModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAccountType, setSelectedAccountType] = useState<"cash" | "current" | "card" | "delivery">("cash");
  const [paymentDate, setPaymentDate] = useState("");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && accountPayable) {
      fetchAccounts();
      setSelectedAccountId("");
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setSurcharge(0);
      setDiscount(0);
      setAttachments([]);
    }
  }, [open, accountPayable, showAllAccounts]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAttachments.push({
        file,
        name: file.name,
        title: `Comprovante de Pagamento - ${file.name}`,
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const updateAttachmentTitle = (index: number, title: string) => {
    setAttachments(prev => prev.map((att, i) => 
      i === index ? { ...att, title } : att
    ));
  };

  const uploadAttachments = async (): Promise<any[]> => {
    if (attachments.length === 0 || !accountPayable) return [];

    const uploadedAttachments: any[] = [];

    for (const attachment of attachments) {
      const fileExt = attachment.file.name.split('.').pop();
      const fileName = `${accountPayable.id}/payment_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('account-documents')
        .upload(fileName, attachment.file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      uploadedAttachments.push({
        name: attachment.title,
        path: fileName,
        type: 'comprovante_pagamento',
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploadedAttachments;
  };

  const fetchAccounts = async () => {
    if (!accountPayable) return;
    
    try {
      // Buscar as lojas dos itens da conta a pagar
      const { data: itemStores } = await supabase
        .from("accounts_payable_items")
        .select("store_id")
        .eq("account_payable_id", accountPayable.id);
      
      // Se não houver itens, usar a loja principal da conta a pagar
      const storeIds = itemStores && itemStores.length > 0 
        ? [...new Set(itemStores.map(item => item.store_id))]
        : [accountPayable.store_id];

      const allAccounts: Account[] = [];
      
      // Fetch cash accounts linked to ALL stores from items
      const { data: cashData, error: cashError } = await supabase
        .from("cash_accounts")
        .select("id, name, bank, account_number")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .order("name");

      if (cashError) throw cashError;
      
      // Get cash accounts that are linked to all required stores
      const { data: cashStoreLinks } = await supabase
        .from("cash_account_stores")
        .select("account_id, store_id")
        .in("store_id", storeIds);
      
      // Filter accounts that are linked to ALL stores
      const cashAccountsWithAllStores = (cashData || []).filter(acc => {
        const linkedStores = cashStoreLinks?.filter(l => l.account_id === acc.id).map(l => l.store_id) || [];
        return storeIds.every(storeId => linkedStores.includes(storeId));
      });
      allAccounts.push(...cashAccountsWithAllStores.map(acc => ({ ...acc, type: "cash" as const })));

      // If showAllAccounts, also fetch current and card accounts
      if (showAllAccounts) {
        // Fetch current accounts
        const { data: currentData, error: currentError } = await supabase
          .from("current_accounts")
          .select("id, name, bank, account_number")
          .eq("is_active", true)
          .eq("is_blocked", false)
          .order("name");

        if (currentError) throw currentError;
        
        const { data: currentStoreLinks } = await supabase
          .from("current_account_stores")
          .select("account_id, store_id")
          .in("store_id", storeIds);
        
        const currentAccountsWithAllStores = (currentData || []).filter(acc => {
          const linkedStores = currentStoreLinks?.filter(l => l.account_id === acc.id).map(l => l.store_id) || [];
          return storeIds.every(storeId => linkedStores.includes(storeId));
        });
        allAccounts.push(...currentAccountsWithAllStores.map(acc => ({ ...acc, type: "current" as const })));

        // Fetch card accounts
        const { data: cardData, error: cardError } = await supabase
          .from("card_accounts")
          .select("id, name, bank, account_number")
          .eq("is_active", true)
          .eq("is_blocked", false)
          .order("name");

        if (cardError) throw cardError;
        
        const { data: cardStoreLinks } = await supabase
          .from("card_account_stores")
          .select("account_id, store_id")
          .in("store_id", storeIds);
        
        const cardAccountsWithAllStores = (cardData || []).filter(acc => {
          const linkedStores = cardStoreLinks?.filter(l => l.account_id === acc.id).map(l => l.store_id) || [];
          return storeIds.every(storeId => linkedStores.includes(storeId));
        });
        allAccounts.push(...cardAccountsWithAllStores.map(acc => ({ ...acc, type: "card" as const })));
      }

      setAccounts(allAccounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar contas",
        variant: "destructive",
      });
    }
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setSelectedAccountType(account.type);
    }
  };

  const getAccountTypeLabel = (type: "cash" | "current" | "card" | "delivery") => {
    switch (type) {
      case "cash": return "Caixa";
      case "current": return "Conta Corrente";
      case "card": return "Cartão";
      case "delivery": return "Delivery";
    }
  };

  const handlePayment = async () => {
    // CRITICAL: Set loading immediately to prevent double-clicks
    if (loading) return;
    
    if (!accountPayable || !selectedAccountId || !paymentDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Validate payment period
      const paymentValidation = await validateAccountsPayablePeriod.pagamento(paymentDate);
      if (paymentValidation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: paymentValidation.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if already paid to prevent duplicates
      const { data: existingPayments } = await supabase
        .from("accounts_payable_payments")
        .select("id")
        .eq("account_payable_id", accountPayable.id)
        .limit(1);
      
      if (existingPayments && existingPayments.length > 0) {
        toast({
          title: "Erro",
          description: "Esta conta já foi paga",
          variant: "destructive",
        });
        setLoading(false);
        onOpenChange(false);
        onPaymentSuccess?.();
        return;
      }
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

      // Upload attachments if any
      let uploadedAttachments: any[] = [];
      if (attachments.length > 0) {
        setUploadingAttachment(true);
        try {
          uploadedAttachments = await uploadAttachments();
        } finally {
          setUploadingAttachment(false);
        }
      }

      // Buscar produtos configurados para acréscimo e desconto
      let surchargeProductId: string | null = null;
      let discountProductId: string | null = null;

      if (surcharge > 0) {
        // Primeiro tenta buscar o parâmetro específico para contas a pagar
        let { data: surchargeParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "acrescimo_pagar")
          .single();
        
        // Se não encontrar, usa o parâmetro legado
        if (!surchargeParam) {
          const { data: legacyParam } = await supabase
            .from("system_parameters")
            .select("product_id, products!inner(id, name, code)")
            .eq("parameter_key", "acrescimo")
            .single();
          surchargeParam = legacyParam;
        }
        
        if (surchargeParam?.products) {
          surchargeProductId = (surchargeParam.products as any).id;
          await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: accountPayable.id,
              product_id: surchargeProductId,
              quantity: 1,
              unit_price: surcharge,
              total_price: surcharge,
              store_id: accountPayable.store_id,
            });
        }
      }

      if (discount > 0) {
        // Primeiro tenta buscar o parâmetro específico para contas a pagar
        let { data: discountParam } = await supabase
          .from("system_parameters")
          .select("product_id, products!inner(id, name, code)")
          .eq("parameter_key", "desconto_pagar")
          .single();
        
        // Se não encontrar, usa o parâmetro legado
        if (!discountParam) {
          const { data: legacyParam } = await supabase
            .from("system_parameters")
            .select("product_id, products!inner(id, name, code)")
            .eq("parameter_key", "desconto")
            .single();
          discountParam = legacyParam;
        }
        
        if (discountParam?.products) {
          discountProductId = (discountParam.products as any).id;
          await supabase
            .from("accounts_payable_items")
            .insert({
              account_payable_id: accountPayable.id,
              product_id: discountProductId,
              quantity: 1,
              unit_price: -discount,
              total_price: -discount,
              store_id: accountPayable.store_id,
            });
        }
      }

      // Criar parcela única para pagamento à vista
      const { data: installment, error: installmentError } = await supabase
        .from("accounts_payable_installments")
        .insert({
          account_payable_id: accountPayable.id,
          installment_number: 1,
          due_date: paymentDate,
          amount: baseAmount,
          payment_date: paymentDate,
        })
        .select()
        .single();

      if (installmentError) throw installmentError;

      // Registrar o pagamento na tabela accounts_payable_payments para o DRE funcionar corretamente
      const { error: paymentRecordError } = await supabase
        .from("accounts_payable_payments")
        .insert({
          installment_id: installment.id,
          account_payable_id: accountPayable.id,
          payment_date: paymentDate,
          amount_paid: finalAmount,
          interest_amount: surcharge,
          discount_amount: discount,
          interest_product_id: surchargeProductId,
          discount_product_id: discountProductId,
          payment_account_id: selectedAccountId,
          payment_account_type: 'current',
          created_by: user.id,
        });

      if (paymentRecordError) throw paymentRecordError;

      // Merge new attachments with existing ones
      const existingAttachments = Array.isArray(accountPayable.attachments) ? accountPayable.attachments : [];
      const allAttachments = [...existingAttachments, ...uploadedAttachments];

      // Update account payable status
      const { error: updateError } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          payment_date: paymentDate,
          amount: finalAmount,
          attachments: allAttachments,
        })
        .eq("id", accountPayable.id);

      if (updateError) throw updateError;

      // O store_id da transação deve SEMPRE ser o store_id do contas a pagar
      // Isso garante que a transação apareça nos relatórios da loja correta
      const transactionStoreId = accountPayable.store_id;

      // Create financial transaction
      const { error: transactionError } = await supabase
        .from("financial_transactions")
        .insert({
          store_id: transactionStoreId,
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
                Vencimento: {new Date(accountPayable.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
              <p className="text-lg font-semibold text-primary">
                Valor Original: R$ {baseAmount.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Conta para Pagamento *</Label>
              <Select value={selectedAccountId} onValueChange={handleAccountSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={showAllAccounts ? "Selecione a conta" : "Selecione a conta caixa"} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {getAccountTypeLabel(account.type)}
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

            {/* Anexos de Comprovante */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Comprovante de Pagamento
              </Label>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Arquivos
              </Button>

              {attachments.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {attachments.map((att, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={att.title}
                        onChange={(e) => updateAttachmentTitle(index, e.target.value)}
                        placeholder="Título do anexo"
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePayment} 
                disabled={loading || uploadingAttachment || !selectedAccountId || !paymentDate}
              >
                {loading || uploadingAttachment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadingAttachment ? "Enviando anexos..." : "Processando..."}
                  </>
                ) : (
                  "Confirmar Pagamento"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
