import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Wallet, DollarSign, Truck } from "lucide-react";

interface ContasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCurrentAccountsOpen: () => void;
  onCashAccountsOpen: () => void;
  onCardAccountsOpen: () => void;
  onDeliveryOpen: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ContasModal = ({ 
  open, 
  onOpenChange, 
  onCurrentAccountsOpen,
  onCashAccountsOpen,
  onCardAccountsOpen,
  onDeliveryOpen,
  canEdit = true,
  canDelete = true
}: ContasModalProps) => {
  const handleOpenModal = (openFn: () => void) => {
    onOpenChange(false);
    openFn();
  };

  const modules = [
    {
      id: "contas-correntes",
      title: "Contas Correntes",
      description: "Cadastro e gestão de contas bancárias",
      icon: CreditCard,
      color: "bg-purple-500",
      onClick: () => handleOpenModal(onCurrentAccountsOpen)
    },
    {
      id: "contas-caixa",
      title: "Contas Caixa",
      description: "Cadastro e gestão de contas caixa",
      icon: Wallet,
      color: "bg-yellow-500",
      onClick: () => handleOpenModal(onCashAccountsOpen)
    },
    {
      id: "contas-cartao",
      title: "Contas Cartão",
      description: "Cadastro e gestão de contas cartão",
      icon: DollarSign,
      color: "bg-red-500",
      onClick: () => handleOpenModal(onCardAccountsOpen)
    },
    {
      id: "delivery",
      title: "Delivery",
      description: "Cadastro e gestão de contas delivery",
      icon: Truck,
      color: "bg-cyan-500",
      onClick: () => handleOpenModal(onDeliveryOpen)
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Módulo Contas</DialogTitle>
          <DialogDescription>
            Selecione o tipo de conta que deseja gerenciar
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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