import { ReactNode, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, Menu } from "lucide-react";
import elitebovLogo from "@/assets/elitebov-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AppSidebar from "./AppSidebar";
import { AccountsPayableModal } from "@/components/AccountsPayableModal";
import { AccountsReceivableModal } from "@/components/AccountsReceivableModal";

import { TransfersModal } from "@/components/TransfersModal";
import { PeriodControlModal } from "@/components/PeriodControlModal";
import JobFunctionModal from "@/components/JobFunctionModal";
import EmployeeModal from "@/components/EmployeeModal";
import EmployeeMovementModal from "@/components/EmployeeMovementModal";
import ObligationsModal from "@/components/ObligationsModal";
import { SuppliersModal } from "@/components/SuppliersModal";
import { CreditorsModal } from "@/components/CreditorsModal";
import { StoresModal } from "@/components/StoresModal";
import { GrupoModal } from "@/components/GrupoModal";
import { SubgrupoModal } from "@/components/SubgrupoModal";
import { ContasModal } from "@/components/ContasModal";
import { ParametersModal } from "@/components/ParametersModal";
import { CurrentAccountsModal } from "@/components/CurrentAccountsModal";
import { CashAccountsModal } from "@/components/CashAccountsModal";
import { CardAccountsModal } from "@/components/CardAccountsModal";
import { DeliveryModal } from "@/components/DeliveryModal";
import { DocumentTypesModal } from "@/components/DocumentTypesModal";
import { PartnersModal } from "@/components/PartnersModal";
import { PartnerTransactionsModal } from "@/components/PartnerTransactionsModal";
import { ServiceOrdersModal } from "@/components/ServiceOrdersModal";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PendingTask {
  id: string;
  title: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  user?: User | null;
  pendingTasks?: PendingTask[];
}

const resolvePageMeta = (pathname: string) => {
  const routeMeta = [
    { match: (path: string) => path === "/dashboard", title: "Dashboard executivo" },
    { match: (path: string) => path.startsWith("/animais/matrizes"), title: "Matrizes & Genitores" },
    { match: (path: string) => path.startsWith("/animais/rebanho"), title: "Rebanho" },
    { match: (path: string) => path.startsWith("/animais/cadastro"), title: "Cadastro de Animais" },
    { match: (path: string) => path.startsWith("/animais"), title: "Gestão de Animais" },
    { match: (path: string) => path.startsWith("/tasks"), title: "Tarefas" },
    { match: (path: string) => path.startsWith("/purchases"), title: "Compras" },
    { match: (path: string) => path.startsWith("/sales"), title: "Vendas" },
    { match: (path: string) => path.startsWith("/bank-reconciliation"), title: "Conciliação Bancária" },
    { match: (path: string) => path.startsWith("/reports"), title: "Relatórios" },
    { match: (path: string) => path.startsWith("/financeiro"), title: "Financeiro" },
    { match: (path: string) => path.startsWith("/my-account"), title: "Minha Conta" },
    { match: (path: string) => path.startsWith("/ai-assistant"), title: "IA Assistente" },
    { match: (path: string) => path.startsWith("/users"), title: "Configurações" },
  ];

  const matchedRoute = routeMeta.find((item) => item.match(pathname));
  if (matchedRoute) {
    return matchedRoute;
  }

  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment) {
    return { title: "ELITEBOV" };
  }

  return {
    title: lastSegment
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
};

const fetchLayoutPendingTasks = async (userId: string): Promise<PendingTask[]> => {
  try {
    const { data: memberTasks } = await supabase
      .from("task_members")
      .select("task_id")
      .eq("user_id", userId);

    if (!memberTasks || memberTasks.length === 0) {
      return [];
    }

    const taskIds = memberTasks.map((memberTask) => memberTask.task_id);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", taskIds)
      .in("status", ["open", "active"]);

    return tasks || [];
  } catch (error) {
    console.error("Error fetching layout pending tasks:", error);
    return [];
  }
};

const DashboardLayout = ({ children, user, pendingTasks }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { canEdit: cadastrosCanEdit, canDelete: cadastrosCanDelete, loading: cadastrosLoading } = useCadastrosPermissions();
  const [resolvedUser, setResolvedUser] = useState<User | null>(user ?? null);
  const [resolvedPendingTasks, setResolvedPendingTasks] = useState<PendingTask[]>(pendingTasks ?? []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Financeiro modals
  const [accountsPayableOpen, setAccountsPayableOpen] = useState(false);
  const [accountsReceivableOpen, setAccountsReceivableOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [periodControlOpen, setPeriodControlOpen] = useState(false);
  const [partnerTransactionsOpen, setPartnerTransactionsOpen] = useState(false);
  const [serviceOrdersOpen, setServiceOrdersOpen] = useState(false);
  
  // Funcionarios modals
  const [jobFunctionsOpen, setJobFunctionsOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [employeeMovementsOpen, setEmployeeMovementsOpen] = useState(false);
  const [obligationsOpen, setObligationsOpen] = useState(false);
  
  // Cadastros modals
  const [suppliersModalOpen, setSuppliersModalOpen] = useState(false);
  const [creditorsModalOpen, setCreditorsModalOpen] = useState(false);
  const [storesModalOpen, setStoresModalOpen] = useState(false);
  const [grupoModalOpen, setGrupoModalOpen] = useState(false);
  const [subgrupoModalOpen, setSubgrupoModalOpen] = useState(false);
  const [contasModalOpen, setContasModalOpen] = useState(false);
  const [parametersModalOpen, setParametersModalOpen] = useState(false);
  const [currentAccountsModalOpen, setCurrentAccountsModalOpen] = useState(false);
  const [cashAccountsModalOpen, setCashAccountsModalOpen] = useState(false);
  const [cardAccountsModalOpen, setCardAccountsModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [documentTypesModalOpen, setDocumentTypesModalOpen] = useState(false);
  const [partnersModalOpen, setPartnersModalOpen] = useState(false);

  const handleOpenCaixa = (storeId: string) => {
    navigate(`/cash-control/${storeId}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (user !== undefined) {
      setResolvedUser(user ?? null);
    }
  }, [user]);

  useEffect(() => {
    if (pendingTasks !== undefined) {
      setResolvedPendingTasks(pendingTasks);
    }
  }, [pendingTasks]);

  useEffect(() => {
    let isMounted = true;

    const syncLayoutData = async (sessionUser?: User | null) => {
      const nextUser =
        sessionUser !== undefined
          ? sessionUser
          : (await supabase.auth.getUser()).data.user ?? null;

      if (!isMounted) return;

      if (user === undefined) {
        setResolvedUser(nextUser);
      }

      if (pendingTasks === undefined) {
        if (!nextUser) {
          setResolvedPendingTasks([]);
          return;
        }

        const tasks = await fetchLayoutPendingTasks(nextUser.id);
        if (isMounted) {
          setResolvedPendingTasks(tasks);
        }
      }
    };

    if (user === undefined || pendingTasks === undefined) {
      void syncLayoutData(user);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncLayoutData(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pendingTasks, user]);

  useEffect(() => {
    const openAccountsPayable = () => setAccountsPayableOpen(true);
    const openAccountsReceivable = () => setAccountsReceivableOpen(true);

    window.addEventListener("dashboard-open-accounts-payable", openAccountsPayable);
    window.addEventListener("dashboard-open-accounts-receivable", openAccountsReceivable);

    return () => {
      window.removeEventListener("dashboard-open-accounts-payable", openAccountsPayable);
      window.removeEventListener("dashboard-open-accounts-receivable", openAccountsReceivable);
    };
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const pageMeta = resolvePageMeta(location.pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        onOpenFinanceiro={() => {}}
        onOpenCaixa={handleOpenCaixa}
        onOpenAccountsPayable={() => setAccountsPayableOpen(true)}
        onOpenAccountsReceivable={() => setAccountsReceivableOpen(true)}
        onOpenTransfers={() => setTransfersOpen(true)}
        onOpenPeriodControl={() => setPeriodControlOpen(true)}
        onOpenSuppliers={() => setSuppliersModalOpen(true)}
        onOpenCreditors={() => setCreditorsModalOpen(true)}
        onOpenStores={() => setStoresModalOpen(true)}
        onOpenGrupos={() => setGrupoModalOpen(true)}
        onOpenSubgrupos={() => setSubgrupoModalOpen(true)}
        onOpenCurrentAccounts={() => setCurrentAccountsModalOpen(true)}
        onOpenCashAccounts={() => setCashAccountsModalOpen(true)}
        onOpenParameters={() => setParametersModalOpen(true)}
        onOpenJobFunctions={() => setJobFunctionsOpen(true)}
        onOpenEmployees={() => setEmployeesOpen(true)}
        onOpenEmployeeMovements={() => setEmployeeMovementsOpen(true)}
        onOpenObligations={() => setObligationsOpen(true)}
        onOpenDocumentTypes={() => setDocumentTypesModalOpen(true)}
        onOpenPartners={() => setPartnersModalOpen(true)}
        onOpenPartnerTransactions={() => setPartnerTransactionsOpen(true)}
        onOpenServiceOrders={() => setServiceOrdersOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div className="min-w-0 overflow-x-clip md:pl-16">
        <header
          className={cn(
            "sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl",
            isMobile ? "h-14" : "h-16",
          )}
        >
          <div className={cn("flex h-full min-w-0 items-center justify-between gap-3", isMobile ? "px-4" : "px-6")}>
            <div className="flex min-w-0 items-center gap-3">
              {isMobile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-card/80 shadow-sm hover:bg-accent/80"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4 text-foreground" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              )}
              <div className={cn("shrink-0 rounded-2xl border border-border/70 bg-card/90 shadow-sm", isMobile ? "p-1.5" : "p-2")}>
                <img src={elitebovLogo} alt="ELITEBOV" className={cn(isMobile ? "h-6" : "h-7")} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span
                  className={cn(
                    "block font-semibold uppercase text-foreground/55",
                    isMobile ? "text-[10px] tracking-[0.2em]" : "text-[11px] tracking-[0.28em]",
                  )}
                >
                  ELITEBOV
                </span>
                <span className={cn("block truncate font-medium text-foreground/78", isMobile ? "text-xs" : "text-sm")}>
                  {pageMeta.title}
                </span>
              </div>
            </div>
            <div className={cn("flex shrink-0 items-center", isMobile ? "gap-2" : "space-x-3")}>
              <span className="hidden rounded-full border border-border/70 bg-card/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm lg:inline">
                {resolvedUser?.user_metadata?.name || resolvedUser?.email}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size={isMobile ? "icon" : "sm"}
                    className={cn(
                      "relative rounded-full border border-border/70 bg-card/80 shadow-sm hover:bg-accent/80",
                      isMobile ? "h-10 w-10 px-0" : "px-3",
                    )}
                  >
                    <Bell className={`h-5 w-5 ${resolvedPendingTasks.length > 0 ? 'text-[hsl(18,72%,52%)]' : 'text-muted-foreground'}`} />
                    {resolvedPendingTasks.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(255,182,120,1),rgba(221,109,61,1))] text-[10px] font-semibold text-white shadow-[0_10px_20px_-10px_rgba(221,109,61,0.9)]">
                        {resolvedPendingTasks.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {resolvedPendingTasks.length === 0 ? (
                    <DropdownMenuItem disabled>
                      Nenhuma tarefa pendente
                    </DropdownMenuItem>
                  ) : (
                    resolvedPendingTasks.map((task) => (
                      <DropdownMenuItem
                        key={task.id}
                        onClick={() => navigate('/tasks')}
                        className="cursor-pointer"
                      >
                        <span className="truncate">{task.title}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleSignOut}
                variant="ghost"
                size={isMobile ? "icon" : "sm"}
                className={cn(
                  "rounded-full border border-border/70 bg-card/80 text-muted-foreground shadow-sm hover:border-border hover:bg-accent/80 hover:text-foreground",
                  isMobile ? "h-10 w-10" : "",
                )}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sair</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>

      {/* Financeiro Modals */}
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

      <JobFunctionModal
        isOpen={jobFunctionsOpen}
        onClose={() => setJobFunctionsOpen(false)}
      />

      <EmployeeModal
        isOpen={employeesOpen}
        onClose={() => setEmployeesOpen(false)}
      />

      <EmployeeMovementModal
        isOpen={employeeMovementsOpen}
        onClose={() => setEmployeeMovementsOpen(false)}
      />

      <ObligationsModal
        isOpen={obligationsOpen}
        onClose={() => setObligationsOpen(false)}
      />


      {periodControlOpen && (
        <PeriodControlModal
          open={periodControlOpen}
          onOpenChange={setPeriodControlOpen}
        />
      )}

      {/* Cadastros Modals */}
      <ContasModal 
        open={contasModalOpen} 
        onOpenChange={setContasModalOpen} 
        onCurrentAccountsOpen={() => setCurrentAccountsModalOpen(true)} 
        onCashAccountsOpen={() => setCashAccountsModalOpen(true)} 
        onCardAccountsOpen={() => setCardAccountsModalOpen(true)} 
        onDeliveryOpen={() => setDeliveryModalOpen(true)}
        canEdit={cadastrosCanEdit}
        canDelete={cadastrosCanDelete}
      />
      
      {!cadastrosLoading && (
        <SuppliersModal 
          open={suppliersModalOpen} 
          onOpenChange={setSuppliersModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <CreditorsModal 
          open={creditorsModalOpen} 
          onOpenChange={setCreditorsModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <StoresModal 
          open={storesModalOpen} 
          onOpenChange={setStoresModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
          viewOnlyUserStores={!cadastrosCanEdit}
        />
      )}
      
      <GrupoModal 
        open={grupoModalOpen} 
        onOpenChange={setGrupoModalOpen}
      />
      
      <SubgrupoModal 
        open={subgrupoModalOpen} 
        onOpenChange={setSubgrupoModalOpen}
      />
      
      {!cadastrosLoading && (
        <CurrentAccountsModal 
          open={currentAccountsModalOpen} 
          onOpenChange={setCurrentAccountsModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <CashAccountsModal 
          open={cashAccountsModalOpen} 
          onOpenChange={setCashAccountsModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <CardAccountsModal 
          open={cardAccountsModalOpen} 
          onOpenChange={setCardAccountsModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <DeliveryModal 
          open={deliveryModalOpen} 
          onOpenChange={setDeliveryModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      <ParametersModal 
        open={parametersModalOpen} 
        onOpenChange={setParametersModalOpen} 
      />
      
      {!cadastrosLoading && (
        <DocumentTypesModal 
          open={documentTypesModalOpen} 
          onOpenChange={setDocumentTypesModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      {!cadastrosLoading && (
        <PartnersModal 
          open={partnersModalOpen} 
          onOpenChange={setPartnersModalOpen}
          canEdit={cadastrosCanEdit}
          canDelete={cadastrosCanDelete}
        />
      )}
      
      <PartnerTransactionsModal 
        open={partnerTransactionsOpen} 
        onOpenChange={setPartnerTransactionsOpen}
      />
      
      <ServiceOrdersModal 
        open={serviceOrdersOpen} 
        onOpenChange={setServiceOrdersOpen}
      />
    </div>
  );
};

export default DashboardLayout;
