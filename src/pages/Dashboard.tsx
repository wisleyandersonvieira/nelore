import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calculator, 
  CreditCard, 
   
  Users, 
  Store, 
  Package,
  LogOut,
  BarChart3,
  Settings,
  Database,
  FileBarChart
} from "lucide-react";
import { AccountsPayableModal } from "@/components/AccountsPayableModal";
import { AccountsReceivableModal } from "@/components/AccountsReceivableModal";
import { CashControlModal } from "@/components/CashControlModal";
import { FinanceiroModal } from "@/components/FinanceiroModal";
import { TransfersModal } from "@/components/TransfersModal";
import FuncionariosModal from "@/components/FuncionariosModal";
import { PeriodControlModal } from "@/components/PeriodControlModal";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountsPayableOpen, setAccountsPayableOpen] = useState(false);
  const [accountsReceivableOpen, setAccountsReceivableOpen] = useState(false);
  const [cashControlOpen, setCashControlOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [funcionariosOpen, setFuncionariosOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [periodControlOpen, setPeriodControlOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check current session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const modules = [
    {
      id: "caixa",
      title: "Controle de Caixa",
      description: "Abertura, fechamento e movimentação do caixa",
      icon: Calculator,
      color: "bg-blue-500",
    },
    {
      id: "financeiro",
      title: "Financeiro",
      description: "Contas a pagar e receber",
      icon: CreditCard,
      color: "bg-emerald-500",
    },
    {
      id: "estoque",
      title: "Estoque",
      description: "Controle de estoque por categorias",
      icon: Package,
      color: "bg-amber-500",
    },
    {
      id: "produtos",
      title: "Produtos",
      description: "Cadastro e gestão de produtos",
      icon: Package,
      color: "bg-purple-500",
    },
    {
      id: "cadastros",
      title: "Cadastros",
      description: "Fornecedores, lojas e plano de contas",
      icon: Database,
      color: "bg-orange-500",
    },
    {
      id: "dre",
      title: "DRE",
      description: "Demonstrativo de Resultados do Exercício",
      icon: FileBarChart,
      color: "bg-teal-500",
    },
    {
      id: "relatorios",
      title: "Relatórios",
      description: "Dashboards e relatórios financeiros",
      icon: BarChart3,
      color: "bg-indigo-500",
    },
    {
      id: "funcionarios",
      title: "Funcionários",
      description: "Gestão de funcionários e funções",
      icon: Users,
      color: "bg-red-500",
    },
    {
      id: "configuracoes",
      title: "Configurações",
      description: "Usuários, permissões e configurações",
      icon: Settings,
      color: "bg-gray-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">Gela Boca</h1>
            <p className="text-sm text-muted-foreground">Sistema Financeiro</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">Olá, {user?.user_metadata?.name || user?.email}</span>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Selecione um módulo para começar a trabalhar
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                     onClick={() => {
                       if (module.id === "cadastros") {
                         navigate("/cadastros");
                       } else if (module.id === "configuracoes") {
                         navigate("/users");
                       } else if (module.id === "produtos") {
                         navigate("/products");
                       } else if (module.id === "dre") {
                         navigate("/dre");
                       } else if (module.id === "relatorios") {
                         navigate("/reports");
                       } else if (module.id === "estoque") {
                         navigate("/stock");
                       } else if (module.id === "financeiro") {
                         setFinanceiroOpen(true);
                        } else if (module.id === "funcionarios") {
                          setFuncionariosOpen(true);
                        } else if (module.id === "caixa") {
                         setCashControlOpen(true);
                       }
                     }}
                  >
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </main>

      {/* Account Modals */}
      {financeiroOpen && (
        <FinanceiroModal
          open={financeiroOpen}
          onOpenChange={setFinanceiroOpen}
          onAccountsPayableOpen={() => setAccountsPayableOpen(true)}
          onAccountsReceivableOpen={() => setAccountsReceivableOpen(true)}
          onTransfersOpen={() => setTransfersOpen(true)}
          onPeriodControlOpen={() => setPeriodControlOpen(true)}
        />
      )}

      {accountsPayableOpen && (
        <AccountsPayableModal 
          open={accountsPayableOpen} 
          onOpenChange={setAccountsPayableOpen} 
        />
      )}
      
      {accountsReceivableOpen && (
        <AccountsReceivableModal 
          open={accountsReceivableOpen} 
          onOpenChange={setAccountsReceivableOpen} 
        />
      )}

      {transfersOpen && (
        <TransfersModal
          open={transfersOpen}
          onOpenChange={setTransfersOpen}
        />
      )}

      {funcionariosOpen && (
        <FuncionariosModal 
          isOpen={funcionariosOpen} 
          onClose={() => setFuncionariosOpen(false)} 
        />
      )}

      {cashControlOpen && (
        <CashControlModal 
          open={cashControlOpen} 
          onOpenChange={setCashControlOpen} 
        />
      )}

      {periodControlOpen && (
        <PeriodControlModal
          open={periodControlOpen}
          onOpenChange={setPeriodControlOpen}
        />
      )}
    </div>
  );
};

export default Dashboard;