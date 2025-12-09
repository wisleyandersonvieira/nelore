import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Edit, Plus, Check, X } from "lucide-react";
import { CashRegisterModal } from "./CashRegisterModal";
import { toast } from "@/hooks/use-toast";
import { validateCashControlPeriod } from "@/utils/periodValidation";
import { useCaixaPermissions } from "@/hooks/useCaixaPermissions";

interface CashDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  storeId: string;
}

export const CashDateModal = ({ open, onOpenChange, date, storeId }: CashDateModalProps) => {
  const [cashControl, setCashControl] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('create');
  const [periodBlocked, setPeriodBlocked] = useState(false);
  const { canView, canEdit, canApprove, loading: permissionsLoading } = useCaixaPermissions();

  // Format date properly to avoid timezone issues
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (open) {
      fetchCashControl();
      checkPeriodBlocking();
    }
  }, [open, dateString, storeId]);

  const checkPeriodBlocking = async () => {
    try {
      const validation = await validateCashControlPeriod.pagamento(dateString);
      setPeriodBlocked(validation.blocked);
    } catch (error) {
      console.error('Erro ao verificar bloqueio de período:', error);
    }
  };

  const fetchCashControl = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_control')
        .select('*, approved_status, approved_at, approved_by')
        .eq('store_id', storeId)
        .eq('date', dateString)
        .maybeSingle();

      if (error) throw error;
      setCashControl(data);
    } catch (error) {
      console.error('Erro ao verificar caixa:', error);
      setCashControl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approve: boolean) => {
    if (!cashControl) return;

    // Verificar se o período está bloqueado
    if (periodBlocked) {
      const validation = await validateCashControlPeriod.pagamento(dateString);
      if (validation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('cash_control')
        .update({
          approved_status: approve,
          approved_at: approve ? new Date().toISOString() : null,
          approved_by: approve ? (await supabase.auth.getUser()).data.user?.id : null,
        })
        .eq('id', cashControl.id);

      if (error) throw error;

      toast({
        title: approve ? "Caixa Aprovado" : "Aprovação Removida",
        description: approve ? 
          "O caixa foi aprovado com sucesso!" : 
          "A aprovação foi removida. O caixa pode ser editado novamente.",
      });

      // Refresh cash control data
      await fetchCashControl();
      
      // Close modal to refresh calendar
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao alterar aprovação:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status de aprovação do caixa.",
        variant: "destructive",
      });
    }
  };

  const handleAction = async (actionMode: 'view' | 'edit' | 'create') => {
    // Se não for visualização, verificar se o período está bloqueado
    if (actionMode !== 'view' && periodBlocked) {
      const validation = await validateCashControlPeriod.pagamento(dateString);
      if (validation.blocked) {
        toast({
          title: "Período Bloqueado",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
    }

    setMode(actionMode);
    setRegisterModalOpen(true);
    onOpenChange(false);
  };

  const handleRegisterModalClose = (open: boolean) => {
    setRegisterModalOpen(open);
    if (!open) {
      // Refresh data when modal closes
      fetchCashControl();
      // Se estamos voltando do modo view, reabrir este modal
      if (mode === 'view') {
        setTimeout(() => onOpenChange(true), 100);
      }
    }
  };

  if (loading || permissionsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Determine which cards should be disabled based on permissions
  const canCreateCash = canEdit && !cashControl && !periodBlocked;
  const canViewCash = canView && cashControl;
  const canEditCash = canEdit && cashControl && !cashControl?.approved_status && !periodBlocked;
  const canApproveCash = canApprove && cashControl && !periodBlocked;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Controle de Caixa - {date.toLocaleDateString('pt-BR')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 py-4">
            {/* Cadastrar Caixa */}
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                !canCreateCash ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => canCreateCash && handleAction('create')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center mx-auto mb-2">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Cadastrar Caixa</CardTitle>
                <CardDescription>
                  Criar novo fechamento de caixa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={!canCreateCash}
                >
                  Cadastrar
                </Button>
              </CardContent>
            </Card>

            {/* Visualizar Caixa */}
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                !canViewCash ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => canViewCash && handleAction('view')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mx-auto mb-2">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Visualizar Caixa</CardTitle>
                <CardDescription>
                  Ver fechamento existente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={!canViewCash}
                >
                  Visualizar
                </Button>
              </CardContent>
            </Card>

            {/* Editar Caixa */}
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                !canEditCash ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => canEditCash && handleAction('edit')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-yellow-500 flex items-center justify-center mx-auto mb-2">
                  <Edit className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Editar Caixa</CardTitle>
                <CardDescription>
                  Modificar fechamento existente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={!canEditCash}
                >
                  Editar
                </Button>
              </CardContent>
            </Card>

            {/* Aprovar/Reprovar Caixa */}
            <AlertDialog>
              <AlertDialogTrigger asChild disabled={!canApproveCash}>
                <Card 
                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                    !canApproveCash ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
              <CardHeader className="text-center">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                  cashControl?.approved_status ? 'bg-red-500' : 'bg-purple-500'
                }`}>
                  {cashControl?.approved_status ? (
                    <X className="h-6 w-6 text-white" />
                  ) : (
                    <Check className="h-6 w-6 text-white" />
                  )}
                </div>
                <CardTitle className="text-lg">
                  {cashControl?.approved_status ? 'Reprovar Caixa' : 'Aprovar Caixa'}
                </CardTitle>
                <CardDescription>
                  {cashControl?.approved_status ? 
                    'Remover aprovação do caixa' : 
                    'Aprovar fechamento de caixa'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  disabled={!canApproveCash}
                >
                  {cashControl?.approved_status ? 'Reprovar' : 'Aprovar'}
                </Button>
              </CardContent>
            </Card>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
              <AlertDialogDescription>
                {cashControl?.approved_status 
                  ? 'Deseja reprovar o caixa do dia? Isso permitirá que ele seja editado novamente.'
                  : 'Deseja aprovar o caixa do dia? Após a aprovação, o caixa não poderá mais ser editado.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => cashControl && handleApproval(!cashControl.approved_status)}>
                {cashControl?.approved_status ? 'Reprovar' : 'Aprovar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </div>

          {cashControl && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Informações do Caixa</h4>
                {cashControl.approved_status && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">Aprovado</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Faturamento Total:</span> R$ {Number(cashControl.faturamento_total || 0).toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">Fechamento PDV:</span> R$ {Number(cashControl.valor_fechamento_pdv || 0).toFixed(2)}
                </div>
                <div className={`font-medium ${
                  Number(cashControl.diferenca || 0) === 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>Diferença:</span> R$ {Number(cashControl.diferenca || 0).toFixed(2)}
                </div>
                {cashControl.approved_status && cashControl.approved_at && (
                  <div className="col-span-2 text-xs text-muted-foreground mt-2">
                    Aprovado em: {new Date(cashControl.approved_at).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CashRegisterModal
        open={registerModalOpen}
        onOpenChange={handleRegisterModalClose}
        date={date}
        storeId={storeId}
        mode={mode}
        onBack={() => {
          setRegisterModalOpen(false);
          setTimeout(() => onOpenChange(true), 100);
        }}
      />
    </>
  );
};