import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Store, FileText, FolderTree, CreditCard, Settings, Lock, FileType, UserCheck } from "lucide-react";
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
import { ContasModal } from "@/components/ContasModal";
import { DocumentTypesModal } from "@/components/DocumentTypesModal";
import { PartnersModal } from "@/components/PartnersModal";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import { useToast } from "@/hooks/use-toast";

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
  const [contasModalOpen, setContasModalOpen] = useState(false);
  const [documentTypesModalOpen, setDocumentTypesModalOpen] = useState(false);
  const [partnersModalOpen, setPartnersModalOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canAccess, canEdit, canDelete, canAccessParameters, canAccessStores, permissionLevel, loading } = useCadastrosPermissions();

  // Debug log for permissions
  console.log('Cadastros Permissions:', { canEdit, canDelete, permissionLevel, loading });

  // Redirect if user has no access at all (after loading)
  useEffect(() => {
    if (!loading && !canAccess) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você não tem permissão para acessar o módulo Cadastros.",
      });
      navigate("/dashboard");
    }
  }, [loading, canAccess, navigate, toast]);

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleMenuClick = (menuId: string, openModal: () => void) => {
    // Parameters: only admin can access
    if (menuId === 'parametros' && permissionLevel !== 'admin') {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você não tem permissão para acessar Parâmetros.",
      });
      return;
    }
    
    // Stores: admin has full access, write is blocked, read can see user's stores only
    if (menuId === 'lojas' && permissionLevel === 'write') {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você não tem permissão para acessar Lojas.",
      });
      return;
    }

    openModal();
  };

  // Determine if user can see data (read permission or higher)
  const canViewData = permissionLevel === 'read' || permissionLevel === 'write' || permissionLevel === 'admin';

  const cadastroModules = [{
    id: "fornecedores",
    title: "Fornecedores / Credores",
    description: "Cadastro unificado de fornecedores, credores e proprietários",
    icon: Users,
    color: "bg-orange-500",
    onClick: () => handleMenuClick("fornecedores", () => setSuppliersModalOpen(true)),
    restricted: false
  }, {
    id: "lojas",
    title: "Fazendas",
    description: "Cadastro e gestão de fazendas",
    icon: Store,
    color: "bg-pink-500",
    onClick: () => handleMenuClick("lojas", () => setStoresModalOpen(true)),
    restricted: permissionLevel === 'write' // Write cannot access, read and admin can
  }, {
    id: "grupos",
    title: "Grupos",
    description: "Cadastro de grupos financeiros",
    icon: FileText,
    color: "bg-blue-500",
    onClick: () => handleMenuClick("grupos", () => setGrupoModalOpen(true)),
    restricted: false
  }, {
    id: "subgrupos",
    title: "Subgrupos",
    description: "Cadastro de subgrupos financeiros",
    icon: FolderTree,
    color: "bg-green-500",
    onClick: () => handleMenuClick("subgrupos", () => setSubgrupoModalOpen(true)),
    restricted: false
  }, {
    id: "contas",
    title: "Contas",
    description: "Contas correntes, caixa, cartão e delivery",
    icon: CreditCard,
    color: "bg-emerald-500",
    onClick: () => handleMenuClick("contas", () => setContasModalOpen(true)),
    restricted: false
  }, {
    id: "tiposdocumento",
    title: "Tipos de Documento",
    description: "Cadastro de tipos de documento",
    icon: FileType,
    color: "bg-cyan-500",
    onClick: () => handleMenuClick("tiposdocumento", () => setDocumentTypesModalOpen(true)),
    restricted: false
  }, {
    id: "socios",
    title: "Sócios",
    description: "Cadastro e gestão de sócios",
    icon: UserCheck,
    color: "bg-violet-500",
    onClick: () => handleMenuClick("socios", () => setPartnersModalOpen(true)),
    restricted: false
  }, {
    id: "parametros",
    title: "Parâmetros",
    description: "Configuração de parâmetros do sistema",
    icon: Settings,
    color: "bg-indigo-500",
    onClick: () => handleMenuClick("parametros", () => setParametersModalOpen(true)),
    restricted: !canAccessParameters
  }];

  return <div className="min-h-screen bg-background">
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
          
          
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cadastroModules.map(module => {
          const IconComponent = module.icon;
          return <Card 
              key={module.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow relative"
            >
                {module.restricted && (
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
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
              </Card>;
        })}
        </div>
      </main>

      {/* Modals - pass permission props */}
      <ContasModal 
        open={contasModalOpen} 
        onOpenChange={setContasModalOpen} 
        onCurrentAccountsOpen={() => setCurrentAccountsModalOpen(true)} 
        onCashAccountsOpen={() => setCashAccountsModalOpen(true)} 
        onCardAccountsOpen={() => setCardAccountsModalOpen(true)} 
        onDeliveryOpen={() => setDeliveryModalOpen(true)}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      <SuppliersModal 
        open={suppliersModalOpen} 
        onOpenChange={setSuppliersModalOpen}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      <CreditorsModal 
        open={creditorsModalOpen} 
        onOpenChange={setCreditorsModalOpen}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      <StoresModal 
        open={storesModalOpen} 
        onOpenChange={setStoresModalOpen}
        canEdit={canEdit}
        canDelete={canDelete}
        viewOnlyUserStores={permissionLevel === 'read'}
      />
      <GrupoModal 
        open={grupoModalOpen} 
        onOpenChange={setGrupoModalOpen}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      <SubgrupoModal 
        open={subgrupoModalOpen} 
        onOpenChange={setSubgrupoModalOpen}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      {!loading && (
        <CurrentAccountsModal 
          open={currentAccountsModalOpen} 
          onOpenChange={setCurrentAccountsModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {!loading && (
        <CashAccountsModal 
          open={cashAccountsModalOpen} 
          onOpenChange={setCashAccountsModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {!loading && (
        <CardAccountsModal 
          open={cardAccountsModalOpen} 
          onOpenChange={setCardAccountsModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {!loading && (
        <DeliveryModal 
          open={deliveryModalOpen} 
          onOpenChange={setDeliveryModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      <ParametersModal open={parametersModalOpen} onOpenChange={setParametersModalOpen} />
      {!loading && (
        <DocumentTypesModal 
          open={documentTypesModalOpen} 
          onOpenChange={setDocumentTypesModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {!loading && (
        <PartnersModal 
          open={partnersModalOpen} 
          onOpenChange={setPartnersModalOpen}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>;
};
export default Cadastros;
