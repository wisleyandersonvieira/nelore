import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Edit, Plus } from "lucide-react";
import { StockRegisterModal } from "./StockRegisterModal";
import { supabase } from "@/integrations/supabase/client";
import { validateStockControlPeriod } from "@/utils/periodValidation";
import { toast } from "sonner";

interface StockDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  storeId: string;
}

export const StockDateModal = ({ open, onOpenChange, month, year, storeId }: StockDateModalProps) => {
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('create');
  const [hasStock, setHasStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periodBlocked, setPeriodBlocked] = useState(false);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  useEffect(() => {
    if (open) {
      checkExistingStock();
      checkPeriodBlock();
    }
  }, [open, month, year, storeId]);

  const checkPeriodBlock = async () => {
    try {
      const periodDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      console.log('🔍 Verificando bloqueio de período para estoque:', { periodDate, year, month });
      
      const competenceValidation = await validateStockControlPeriod.competencia(periodDate);
      const paymentValidation = await validateStockControlPeriod.pagamento(periodDate);
      
      console.log('📊 Validações de período:', { competenceValidation, paymentValidation });
      
      const isBlocked = competenceValidation.blocked || paymentValidation.blocked;
      setPeriodBlocked(isBlocked);
      
      console.log('🚫 Período bloqueado?', isBlocked);
      
      if (isBlocked) {
        const message = competenceValidation.message || paymentValidation.message;
        if (message) {
          toast.warning(message);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar bloqueio de período:', error);
      setPeriodBlocked(false);
    }
  };

  const checkExistingStock = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_control')
        .select('id')
        .eq('store_id', storeId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      setHasStock(!!data);
    } catch (error) {
      console.error('Erro ao verificar estoque:', error);
      setHasStock(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (actionMode: 'view' | 'edit' | 'create') => {
    // Verificar se o período está bloqueado para operações que não sejam visualização
    if (periodBlocked && actionMode !== 'view') {
      toast.error(`Período bloqueado. Não é possível ${actionMode === 'create' ? 'cadastrar' : 'editar'} estoque para este período.`);
      return;
    }
    
    setMode(actionMode);
    setRegisterModalOpen(true);
    // Não fecha o modal atual, mantém aberto para que o StockRegisterModal seja renderizado
  };

  const handleRegisterModalClose = (open: boolean) => {
    setRegisterModalOpen(open);
    if (!open) {
      // Quando o StockRegisterModal fechar, verifica novamente se tem estoque
      checkExistingStock();
      // Fecha o StockDateModal também
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Controle de Estoque - {monthNames[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
              {/* Cadastrar Estoque */}
              <Card 
                className={`transition-all ${
                  hasStock || periodBlocked
                    ? 'opacity-50 cursor-not-allowed bg-muted' 
                    : 'cursor-pointer hover:shadow-lg bg-green-50 border-green-200'
                }`}
                onClick={hasStock || periodBlocked ? undefined : () => handleAction('create')}
              >
                <CardHeader className="text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                    hasStock || periodBlocked ? 'bg-gray-400' : 'bg-green-500'
                  }`}>
                    <Plus className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className={`text-lg ${hasStock || periodBlocked ? 'text-muted-foreground' : ''}`}>
                    Cadastrar Estoque
                  </CardTitle>
                  <CardDescription>
                    {periodBlocked ? 'Período bloqueado' : hasStock ? 'Estoque já cadastrado' : 'Criar novo registro de estoque'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    disabled={hasStock || periodBlocked}
                  >
                    Cadastrar
                  </Button>
                </CardContent>
              </Card>

              {/* Visualizar Estoque */}
              <Card 
                className={`transition-all ${
                  hasStock 
                    ? 'cursor-pointer hover:shadow-lg bg-green-50 border-green-200' 
                    : 'opacity-50 cursor-not-allowed bg-muted'
                }`}
                onClick={hasStock ? () => handleAction('view') : undefined}
              >
                <CardHeader className="text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                    hasStock ? 'bg-blue-500' : 'bg-gray-400'
                  }`}>
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className={`text-lg ${!hasStock ? 'text-muted-foreground' : ''}`}>
                    Visualizar Estoque
                  </CardTitle>
                  <CardDescription>
                    {hasStock ? 'Ver registros existentes' : 'Nenhum estoque cadastrado'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    disabled={!hasStock}
                  >
                    Visualizar
                  </Button>
                </CardContent>
              </Card>

              {/* Editar Estoque */}
              <Card 
                className={`transition-all ${
                  hasStock && !periodBlocked
                    ? 'cursor-pointer hover:shadow-lg bg-green-50 border-green-200' 
                    : 'opacity-50 cursor-not-allowed bg-muted'
                }`}
                onClick={hasStock && !periodBlocked ? () => handleAction('edit') : undefined}
              >
                <CardHeader className="text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                    hasStock && !periodBlocked ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}>
                    <Edit className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className={`text-lg ${!hasStock || periodBlocked ? 'text-muted-foreground' : ''}`}>
                    Editar Estoque
                  </CardTitle>
                  <CardDescription>
                    {periodBlocked ? 'Período bloqueado' : hasStock ? 'Modificar registros existentes' : 'Nenhum estoque cadastrado'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    disabled={!hasStock || periodBlocked}
                  >
                    Editar
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {periodBlocked 
                ? `O período ${monthNames[month - 1]} ${year} está bloqueado para operações de estoque. Apenas visualização é permitida.`
                : hasStock 
                  ? `Estoque já cadastrado para ${monthNames[month - 1]} ${year}. Você pode visualizar ou editar os dados existentes.`
                  : `Selecione "Cadastrar Estoque" para criar um novo registro para ${monthNames[month - 1]} ${year}.`
              }
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <StockRegisterModal
        open={registerModalOpen}
        onOpenChange={handleRegisterModalClose}
        month={month}
        year={year}
        storeId={storeId}
        mode={mode}
      />
    </>
  );
};