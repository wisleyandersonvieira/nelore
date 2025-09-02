import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Edit, Plus } from "lucide-react";
import { CashRegisterModal } from "./CashRegisterModal";

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

  const dateString = date.toISOString().split('T')[0];

  useEffect(() => {
    if (open) {
      fetchCashControl();
    }
  }, [open, dateString, storeId]);

  const fetchCashControl = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_control')
        .select('*')
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

  const handleAction = (actionMode: 'view' | 'edit' | 'create') => {
    setMode(actionMode);
    setRegisterModalOpen(true);
    onOpenChange(false);
  };

  const handleRegisterModalClose = (open: boolean) => {
    setRegisterModalOpen(open);
    if (!open) {
      // Refresh data when modal closes
      fetchCashControl();
    }
  };

  if (loading) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Controle de Caixa - {date.toLocaleDateString('pt-BR')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            {/* Cadastrar Caixa */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleAction('create')}
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
                <Button className="w-full" variant="outline">
                  Cadastrar
                </Button>
              </CardContent>
            </Card>

            {/* Visualizar Caixa */}
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                !cashControl ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => cashControl && handleAction('view')}
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
                  disabled={!cashControl}
                >
                  Visualizar
                </Button>
              </CardContent>
            </Card>

            {/* Editar Caixa */}
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                !cashControl ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => cashControl && handleAction('edit')}
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
                  disabled={!cashControl}
                >
                  Editar
                </Button>
              </CardContent>
            </Card>
          </div>

          {cashControl && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Informações do Caixa</h4>
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
      />
    </>
  );
};