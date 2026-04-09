import { ReactNode, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bell } from "lucide-react";
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

interface PendingTask {
  id: string;
  title: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  pendingTasks: PendingTask[];
}

const DashboardLayout = ({ children, user, pendingTasks }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { canEdit: cadastrosCanEdit, canDelete: cadastrosCanDelete, loading: cadastrosLoading } = useCadastrosPermissions();
  
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
    const openAccountsPayable = () => setAccountsPayableOpen(true);
    const openAccountsReceivable = () => setAccountsReceivableOpen(true);

    window.addEventListener("dashboard-open-accounts-payable", openAccountsPayable);
    window.addEventListener("dashboard-open-accounts-receivable", openAccountsReceivable);

    return () => {
      window.removeEventListener("dashboard-open-accounts-payable", openAccountsPayable);
      window.removeEventListener("dashboard-open-accounts-receivable", openAccountsReceivable);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
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
      />

      {/* Main Content Area */}
      <div className="pl-16">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-border/70 bg-card/90 p-2 shadow-sm">
                <img src={elitebovLogo} alt="ELITEBOV" className="h-7" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/55">ELITEBOV</span>
                <span className="block text-sm font-medium text-foreground/78">Dashboard executivo</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="hidden rounded-full border border-border/70 bg-card/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm md:inline">
                {user?.user_metadata?.name || user?.email}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative rounded-full border border-border/70 bg-card/80 px-3 shadow-sm hover:bg-accent/80">
                    <Bell className={`h-5 w-5 ${pendingTasks.length > 0 ? 'text-[hsl(18,72%,52%)]' : 'text-muted-foreground'}`} />
                    {pendingTasks.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(255,182,120,1),rgba(221,109,61,1))] text-[10px] font-semibold text-white shadow-[0_10px_20px_-10px_rgba(221,109,61,0.9)]">
                        {pendingTasks.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {pendingTasks.length === 0 ? (
                    <DropdownMenuItem disabled>
                      Nenhuma tarefa pendente
                    </DropdownMenuItem>
                  ) : (
                    pendingTasks.map((task) => (
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
                size="sm"
                className="rounded-full border border-border/70 bg-card/80 text-muted-foreground shadow-sm hover:border-border hover:bg-accent/80 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8 md:p-10">
          {children}
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
