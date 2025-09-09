import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, TrendingUp, ArrowLeftRight } from "lucide-react";

interface FinanceiroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountsPayableOpen: () => void;
  onAccountsReceivableOpen: () => void;
  onTransfersOpen: () => void;
}

export const FinanceiroModal = ({ 
  open, 
  onOpenChange, 
  onAccountsPayableOpen, 
  onAccountsReceivableOpen,
  onTransfersOpen
}: FinanceiroModalProps) => {
  const modules = [
    {
      id: "contas-pagar",
      title: "Contas a Pagar",
      description: "Gestão de fornecedores e pagamentos",
      icon: CreditCard,
      color: "bg-red-500",
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
      onClick: () => {
        onOpenChange(false);
        onTransfersOpen();
      }
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Módulo Financeiro</DialogTitle>
          <DialogDescription>
            Selecione o módulo financeiro que deseja acessar
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {modules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card key={module.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
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
      </DialogContent>
    </Dialog>
  );
};