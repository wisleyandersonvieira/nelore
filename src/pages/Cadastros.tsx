import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Store, FileText, FolderTree, CreditCard, Settings, Wallet, DollarSign, Truck } from "lucide-react";
import { SuppliersModal } from "@/components/SuppliersModal";
import { CreditorsModal } from "@/components/CreditorsModal";
import { StoresModal } from "@/components/StoresModal";
import { GrupoModal } from "@/components/GrupoModal";
import { SubgrupoModal } from "@/components/SubgrupoModal";
import { CurrentAccountsModal } from "@/components/CurrentAccountsModal";
import { CashAccountsModal } from "@/components/CashAccountsModal";
import { CardAccountsModal } from "@/components/CardAccountsModal";
import { DeliveryModal } from "@/components/DeliveryModal";
import { ParametersModal } from "@/components/ParametersModal";

const Cadastros = () => {
  const [suppliersModalOpen, setSuppliersModalOpen] = useState(false);
  const [creditorsModalOpen, setCreditorsModalOpen] = useState(false);
  const [storesModalOpen, setStoresModalOpen] = useState(false);
  const [grupoModalOpen, setGrupoModalOpen] = useState(false);
  const [subgrupoModalOpen, setSubgrupoModalOpen] = useState(false);
  const [currentAccountsModalOpen, setCurrentAccountsModalOpen] = useState(false);
  const [cashAccountsModalOpen, setCashAccountsModalOpen] = useState(false);
  const [cardAccountsModalOpen, setCardAccountsModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [parametersModalOpen, setParametersModalOpen] = useState(false);
  const navigate = useNavigate();

  const cadastroModules = [
    {
      id: "fornecedores",
      title: "Fornecedores", 
      description: "Cadastro e gestão de fornecedores",
      icon: Users,
      color: "bg-orange-500",
      onClick: () => setSuppliersModalOpen(true),
    },
    {
      id: "credores",
      title: "Credores", 
      description: "Cadastro e gestão de credores",
      icon: Users,
      color: "bg-green-600",
      onClick: () => setCreditorsModalOpen(true),
    },
    {
      id: "lojas",
      title: "Lojas",
      description: "Cadastro e gestão de lojas", 
      icon: Store,
      color: "bg-pink-500",
      onClick: () => setStoresModalOpen(true),
    },
    {
      id: "grupos",
      title: "Grupos",
      description: "Cadastro de grupos financeiros",
      icon: FileText,
      color: "bg-blue-500", 
      onClick: () => setGrupoModalOpen(true),
    },
    {
      id: "subgrupos",
      title: "Subgrupos",
      description: "Cadastro de subgrupos financeiros",
      icon: FolderTree,
      color: "bg-green-500", 
      onClick: () => setSubgrupoModalOpen(true),
    },
    {
      id: "contas-correntes",
      title: "Contas Correntes",
      description: "Cadastro e gestão de contas bancárias",
      icon: CreditCard,
      color: "bg-purple-500", 
      onClick: () => setCurrentAccountsModalOpen(true),
    },
    {
      id: "contas-caixa",
      title: "Contas Caixa",
      description: "Cadastro e gestão de contas caixa",
      icon: Wallet,
      color: "bg-yellow-500", 
      onClick: () => setCashAccountsModalOpen(true),
    },
    {
      id: "contas-cartao",
      title: "Contas Cartão",
      description: "Cadastro e gestão de contas cartão",
      icon: DollarSign,
      color: "bg-red-500", 
      onClick: () => setCardAccountsModalOpen(true),
    },
    {
      id: "delivery",
      title: "Delivery",
      description: "Cadastro e gestão de contas delivery",
      icon: Truck,
      color: "bg-cyan-500", 
      onClick: () => setDeliveryModalOpen(true),
    },
    {
      id: "parametros",
      title: "Parâmetros",
      description: "Configuração de parâmetros do sistema",
      icon: Settings,
      color: "bg-indigo-500", 
      onClick: () => setParametersModalOpen(true),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Cadastros</h1>
            <p className="text-sm text-muted-foreground">Gerencie todos os cadastros do sistema</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Módulos de Cadastro</h2>
          <p className="text-muted-foreground">
            Selecione um módulo para gerenciar os cadastros
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cadastroModules.map((module) => {
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
      </main>

      {/* Modals */}
      <SuppliersModal 
        open={suppliersModalOpen} 
        onOpenChange={setSuppliersModalOpen} 
      />
      <CreditorsModal 
        open={creditorsModalOpen} 
        onOpenChange={setCreditorsModalOpen} 
      />
      <StoresModal 
        open={storesModalOpen} 
        onOpenChange={setStoresModalOpen} 
      />
      <GrupoModal 
        open={grupoModalOpen} 
        onOpenChange={setGrupoModalOpen} 
      />
      <SubgrupoModal 
        open={subgrupoModalOpen} 
        onOpenChange={setSubgrupoModalOpen} 
      />
      <CurrentAccountsModal 
        open={currentAccountsModalOpen} 
        onOpenChange={setCurrentAccountsModalOpen} 
      />
      <CashAccountsModal 
        open={cashAccountsModalOpen} 
        onOpenChange={setCashAccountsModalOpen} 
      />
      <CardAccountsModal 
        open={cardAccountsModalOpen} 
        onOpenChange={setCardAccountsModalOpen} 
      />
      <DeliveryModal 
        open={deliveryModalOpen} 
        onOpenChange={setDeliveryModalOpen} 
      />
      <ParametersModal 
        open={parametersModalOpen} 
        onOpenChange={setParametersModalOpen} 
      />
    </div>
  );
};

export default Cadastros;