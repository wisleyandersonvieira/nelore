import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, TrendingUp, ArrowLeftRight, Shield, Lock, Wallet, FileSearch } from "lucide-react";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface FinanceiroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountsPayableOpen: () => void;
  onAccountsReceivableOpen: () => void;
  onTransfersOpen: () => void;
  onPeriodControlOpen: () => void;
  onPartnerTransactionsOpen: () => void;
}

export const FinanceiroModal = ({ 
  open, 
  onOpenChange, 
  onAccountsPayableOpen, 
  onAccountsReceivableOpen,
  onTransfersOpen,
  onPeriodControlOpen,
  onPartnerTransactionsOpen
}: FinanceiroModalProps) => {
  const { permissionLevel, loading, canView, canEdit, canAdmin } = useFinanceiroPermissions();
  const navigate = useNavigate();

  const modules = [
    {
      id: "contas-pagar",
      title: "Contas a Pagar",
      description: "Gestão de fornecedores e pagamentos",
      icon: CreditCard,
      color: "bg-red-500",
      requiresAdmin: false,
      onClick: () => {
        onOpenChange(false);
        onAccountsPayableOpen();
      }
    },
    {
      id: "contas-receber", 
      title: "Contas a Receber",
      description: "Controle de recebimentos e clientes",
      icon: TrendingUp,
      color: "bg-green-500",
      requiresAdmin: false,
      onClick: () => {
        onOpenChange(false);
        onAccountsReceivableOpen();
      }
    },
    {
      id: "transferencias",
      title: "Transferências",
      description: "Transferências entre contas",
      icon: ArrowLeftRight,
      color: "bg-blue-500",
      requiresAdmin: false,
      onClick: () => {
        onOpenChange(false);
        onTransfersOpen();
      }
    },
    {
      id: "aportes-retiradas",
      title: "Aportes e Retiradas",
      description: "Gestão de aportes e retiradas dos sócios",
      icon: Wallet,
      color: "bg-orange-500",
      requiresAdmin: false,
      onClick: () => {
        onOpenChange(false);
        onPartnerTransactionsOpen();
      }
    },
    {
      id: "periodo-controle",
      title: "Controle de Períodos",
      description: "Bloquear meses para novos cadastros",
      icon: Shield,
      color: "bg-purple-500",
      requiresAdmin: true,
      onClick: () => {
        onOpenChange(false);
        onPeriodControlOpen();
      }
    },
    {
      id: "conciliacao-bancaria",
      title: "Conciliação Bancária",
      description: "Importar OFX e conciliar com o sistema",
      icon: FileSearch,
      color: "bg-teal-500",
      requiresAdmin: false,
      requiresEdit: true,
      onClick: () => {
        onOpenChange(false);
        navigate('/bank-reconciliation');
      }
    }
  ];

  // Filter modules based on permissions
  const visibleModules = modules.filter(module => {
    if (module.requiresAdmin) {
      return canAdmin;
    }
    if (module.requiresEdit) {
      return canEdit;
    }
    return canView;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Módulo Financeiro</DialogTitle>
          <DialogDescription>
            Selecione o módulo financeiro que deseja acessar
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-full flex flex-col">
                <CardHeader className="pb-3 flex-1">
                  <Skeleton className="w-12 h-12 rounded-lg mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="mt-auto">
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !canView ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar o módulo financeiro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {visibleModules.map((module) => {
              const IconComponent = module.icon;
              return (
                <Card key={module.id} className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="pb-3 flex-1">
                    <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={module.onClick}
                    >
                      Acessar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
