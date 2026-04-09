import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calculator, 
  DollarSign, 
  Users, 
  Package,
  BarChart3,
  Settings,
  ClipboardList,
  ListTodo,
  Home,
  ChevronRight,
  X,
  LucideIcon,
  Store,
  Loader2,
  UserCircle,
  Sparkles,
  Beef
} from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCadastrosPermissions } from "@/hooks/useCadastrosPermissions";
import { useFinanceiroPermissions } from "@/hooks/useFinanceiroPermissions";
import { useEstoquePermissions } from "@/hooks/useEstoquePermissions";
import { useRelatoriosPermissions } from "@/hooks/useRelatoriosPermissions";
import { useDREPermissions } from "@/hooks/useDREPermissions";
import { useFuncionariosPermissions } from "@/hooks/useFuncionariosPermissions";
import { toast } from "sonner";


interface SubMenuItem {
  id: string;
  label: string;
  route?: string;
  action?: string;
  storeId?: string;
}

interface MenuItem {
  id: string;
  title: string;
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
  route?: string;
  subMenus?: SubMenuItem[];
  dynamicSubMenus?: boolean;
}

interface StoreData {
  id: string;
  name: string;
  code: string;
}

interface AppSidebarProps {
  onOpenFinanceiro: () => void;
  onOpenCaixa: (storeId: string) => void;
  onOpenAccountsPayable: () => void;
  onOpenAccountsReceivable: () => void;
  onOpenTransfers: () => void;
  onOpenPeriodControl: () => void;
  onOpenSuppliers: () => void;
  onOpenCreditors: () => void;
  onOpenStores: () => void;
  onOpenGrupos: () => void;
  onOpenSubgrupos: () => void;
  onOpenCurrentAccounts: () => void;
  onOpenCashAccounts: () => void;
  onOpenParameters: () => void;
  onOpenJobFunctions: () => void;
  onOpenEmployees: () => void;
  onOpenEmployeeMovements: () => void;
  onOpenObligations: () => void;
  onOpenDocumentTypes: () => void;
  onOpenPartners: () => void;
  onOpenPartnerTransactions: () => void;
  onOpenServiceOrders: () => void;
}

const AppSidebar = ({
  onOpenFinanceiro,
  onOpenCaixa,
  onOpenAccountsPayable,
  onOpenAccountsReceivable,
  onOpenTransfers,
  onOpenPeriodControl,
  onOpenSuppliers,
  onOpenCreditors,
  onOpenStores,
  onOpenGrupos,
  onOpenSubgrupos,
  onOpenCurrentAccounts,
  onOpenCashAccounts,
  onOpenParameters,
  onOpenJobFunctions,
  onOpenEmployees,
  onOpenEmployeeMovements,
  onOpenObligations,
  onOpenDocumentTypes,
  onOpenPartners,
  onOpenPartnerTransactions,
  onOpenServiceOrders,
}: AppSidebarProps) => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const { canAccess: canAccessCadastros, loading: loadingCadastros } = useCadastrosPermissions();
  const { canView: canAccessFinanceiro, loading: loadingFinanceiro } = useFinanceiroPermissions();
  const { canAccess: canAccessEstoque, loading: loadingEstoque } = useEstoquePermissions();
  const { canAccess: canAccessRelatorios, loading: loadingRelatorios } = useRelatoriosPermissions();
  const { canAccessView: canAccessDRE, isLoading: loadingDRE } = useDREPermissions();
  const { canAccess: canAccessFuncionarios, loading: loadingFuncionarios } = useFuncionariosPermissions();
  

  useEffect(() => {
    const fetchStores = async () => {
      setLoadingStores(true);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingStores(false);
          return;
        }

        // Get user profile to check role and primary store
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, store_id')
          .eq('id', user.id)
          .single();

        // If admin, show all stores
        if (profile?.role === 'admin') {
          const { data, error } = await supabase
            .from('stores')
            .select('id, name, code')
            .order('name');
          
          if (!error && data) {
            setStores(data);
          }
        } else {
          // For regular users, get linked stores
          const storeIds: string[] = [];
          
          // Add primary store from profile
          if (profile?.store_id) {
            storeIds.push(profile.store_id);
          }
          
          // Get additional stores from user_stores
          const { data: userStores } = await supabase
            .from('user_stores')
            .select('store_id')
            .eq('user_id', user.id);
          
          if (userStores) {
            userStores.forEach(us => {
              if (!storeIds.includes(us.store_id)) {
                storeIds.push(us.store_id);
              }
            });
          }
          
          // Fetch only linked stores
          if (storeIds.length > 0) {
            const { data, error } = await supabase
              .from('stores')
              .select('id, name, code')
              .in('id', storeIds)
              .order('name');
            
            if (!error && data) {
              setStores(data);
            }
          } else {
            setStores([]);
          }
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      }
      
      setLoadingStores(false);
    };
    
    fetchStores();
  }, []);

  const getEstoqueSubMenus = (): SubMenuItem[] => {
    return stores.map(store => ({
      id: `estoque-${store.id}`,
      label: `${store.code} - ${store.name}`,
      action: "openEstoqueStore",
      storeId: store.id,
    }));
  };

  const getCaixaSubMenus = (): SubMenuItem[] => {
    return stores.map(store => ({
      id: `caixa-${store.id}`,
      label: `${store.code} - ${store.name}`,
      action: "openCaixaStore",
      storeId: store.id,
    }));
  };

  const menuItems: MenuItem[] = [
    // {
    //   id: "caixa",
    //   title: "Controle de Caixa",
    //   icon: Calculator,
    //   dynamicSubMenus: true,
    // },
    {
      id: "financeiro",
      title: "Financeiro",
      icon: DollarSign,
      subMenus: [
        { id: "contas-pagar", label: "Contas a Pagar", action: "openAccountsPayable" },
        { id: "contas-receber", label: "Contas a Receber", action: "openAccountsReceivable" },
        { id: "transferencias", label: "Transferências", action: "openTransfers" },
        { id: "aportes-retiradas", label: "Aportes e Retiradas", action: "openPartnerTransactions" },
        { id: "registro-os", label: "Registro de OS", action: "openServiceOrders" },
        { id: "conciliacao-bancaria", label: "Conciliação Bancária", route: "/bank-reconciliation" },
        { id: "controle-periodo", label: "Controle de Período", action: "openPeriodControl" },
      ],
    },
    // Menu Estoque removido do sidebar
    {
      id: "cadastros",
      title: "Cadastros",
      icon: ClipboardList,
      subMenus: [
        { id: "contas-correntes", label: "Contas Correntes", action: "openCurrentAccounts" },
        { id: "contas-caixa", label: "Contas Caixa", action: "openCashAccounts" },
        { id: "fornecedores", label: "Fornecedores", action: "openSuppliers" },
        { id: "grupos", label: "Grupos", action: "openGrupos" },
        { id: "lojas", label: "Fazendas", action: "openStores" },
        // { id: "metas", label: "Metas", route: "/goals" },
        { id: "parametros", label: "Parâmetros", action: "openParameters" },
        { id: "produtos", label: "Produtos/Serviços", route: "/products" },
        { id: "socios", label: "Sócios", action: "openPartners" },
        { id: "subgrupos", label: "Subgrupos", action: "openSubgrupos" },
        { id: "tipos-documento", label: "Tipos de Documento", action: "openDocumentTypes" },
      ],
    },
    {
      id: "dre",
      title: "DRE",
      customIcon: <span className="text-[11px] font-bold leading-none">DRE</span>,
      subMenus: [
        { id: "dre-competencia", label: "DRE Competência", route: "/dre/competencia" },
        { id: "dre-caixa", label: "DRE Regime de Caixa", route: "/dre/caixa" },
      ],
    },
    {
      id: "relatorios",
      title: "Relatórios",
      icon: BarChart3,
      subMenus: [
        { id: "rel-contas-pagar", label: "Contas a Pagar", route: "/reports/accounts-payable/pending" },
        { id: "rel-contas-receber", label: "Contas a Receber", route: "/reports/accounts-receivable/pending" },
        { id: "rel-contas-pagas", label: "Contas Pagas", route: "/reports/accounts-payable/paid" },
        { id: "rel-contas-recebidas", label: "Contas Recebidas", route: "/reports/accounts-receivable/received" },
        { id: "rel-receitas-despesas", label: "Entradas e Saídas", route: "/reports/income-expense" },
        { id: "rel-exportar-contabilidade", label: "Exportar Contabilidade", route: "/reports/accounting-export" },
        { id: "rel-extratos", label: "Extrato de Contas", route: "/reports/extratos" },
        { id: "rel-faturamento-chart", label: "Gráfico de Faturamento", route: "/reports/turnover-chart" },
        { id: "rel-posicao-saldos", label: "Posição de Saldos", route: "/reports/balance-position" },
        { id: "rel-faturamento", label: "Relatório de Faturamento", route: "/reports/turnover" },
      ],
    },
    {
      id: "tarefas",
      title: "Tarefas",
      icon: ListTodo,
      route: "/tasks",
    },
    {
      id: "funcionarios",
      title: "Funcionários",
      icon: Users,
      subMenus: [
        { id: "func-cargos", label: "Cargos", action: "openJobFunctions" },
        { id: "func-funcionarios", label: "Funcionários", action: "openEmployees" },
        { id: "func-movimentacoes", label: "Movimentações", action: "openEmployeeMovements" },
        { id: "func-obrigacoes", label: "Obrigações", action: "openObligations" },
      ],
    },
    {
      id: "animais",
      title: "Animais",
      icon: Beef,
      subMenus: [
        { id: "animais-rebanho", label: "Rebanho", route: "/animais/rebanho" },
        { id: "animais-cadastro", label: "Cadastro de Animais", route: "/animais/cadastro" },
        { id: "animais-receptoras", label: "Receptoras", route: "/animais/receptoras" },
        { id: "animais-lotes", label: "Lotes", route: "/animais/lotes" },
        { id: "animais-pesagem", label: "Pesagem", route: "/animais/pesagem" },
        { id: "animais-vacinacao", label: "Vacinação", route: "/animais/vacinacao" },
        { id: "animais-matrizes", label: "Matrizes", route: "/animais/matrizes" },
        { id: "animais-prenhez", label: "Gestão de Prenhez", route: "/animais/prenhez" },
        { id: "animais-aspiracoes", label: "Gestão de Aspirações", route: "/animais/aspiracoes" },
        { id: "animais-transferencia-embriao", label: "Pós Transferência de Embrião", route: "/animais/transferencia-embriao" },
        { id: "animais-cadastros-gerais", label: "Cadastros Gerais", route: "/animais/cadastros-gerais" },
      ],
    },
    {
      id: "configuracoes",
      title: "Configurações",
      icon: Settings,
      route: "/users",
    },
    {
      id: "ia-assistente",
      title: "IA Assistente",
      icon: Sparkles,
      route: "/ai-assistant",
    },
    {
      id: "minha-conta",
      title: "Minha Conta",
      icon: UserCircle,
      route: "/my-account",
    },
  ];

  // Show all menu items - permission check happens on click/access
  const filteredMenuItems = menuItems;

  const handleMenuClick = (item: MenuItem) => {
    // Block access to Cadastros if user doesn't have permission
    if (item.id === "cadastros" && !loadingCadastros && !canAccessCadastros) {
      toast.error("Acesso negado ao módulo Cadastros");
      return;
    }

    // Block access to Financeiro if user doesn't have permission
    if (item.id === "financeiro" && !loadingFinanceiro && !canAccessFinanceiro) {
      toast.error("Acesso negado ao módulo Financeiro");
      return;
    }

    // Block access to Estoque if user doesn't have permission
    if (item.id === "estoque" && !loadingEstoque && !canAccessEstoque) {
      toast.error("Acesso negado ao módulo Estoque");
      return;
    }

    // Block access to Relatórios if user doesn't have permission
    if (item.id === "relatorios" && !loadingRelatorios && !canAccessRelatorios) {
      toast.error("Acesso negado ao módulo Relatórios");
      return;
    }

    // Block access to DRE if user doesn't have permission
    if (item.id === "dre" && !loadingDRE && !canAccessDRE) {
      toast.error("Acesso negado ao módulo DRE");
      return;
    }

    // Block access to Funcionários if user doesn't have permission
    if (item.id === "funcionarios" && !loadingFuncionarios && !canAccessFuncionarios) {
      toast.error("Acesso negado ao módulo Funcionários");
      return;
    }

    if (item.route) {
      navigate(item.route);
      setActiveModule(null);
      setIsPanelOpen(false);
    } else if (item.subMenus || item.dynamicSubMenus) {
      if (activeModule === item.id) {
        setActiveModule(null);
        setIsPanelOpen(false);
      } else {
        setActiveModule(item.id);
        setIsPanelOpen(true);
      }
    }
  };

  const { canEdit: canEditFinanceiro } = useFinanceiroPermissions();

  const handleSubMenuClick = (subMenu: SubMenuItem) => {
    // Block bank reconciliation for read-only financeiro users
    if (subMenu.id === "conciliacao-bancaria" && !canEditFinanceiro) {
      toast.error("Acesso bloqueado para o perfil");
      return;
    }

    if (subMenu.route) {
      navigate(subMenu.route);
    } else if (subMenu.action) {
      switch (subMenu.action) {
        case "openCaixaStore":
          if (subMenu.storeId) {
            onOpenCaixa(subMenu.storeId);
          }
          break;
        case "openEstoqueStore":
          if (subMenu.storeId) {
            navigate(`/stock/${subMenu.storeId}`);
          }
          break;
        case "openAccountsPayable":
          onOpenAccountsPayable();
          break;
        case "openAccountsReceivable":
          onOpenAccountsReceivable();
          break;
        case "openTransfers":
          onOpenTransfers();
          break;
        case "openPeriodControl":
          onOpenPeriodControl();
          break;
        case "openJobFunctions":
          onOpenJobFunctions();
          break;
        case "openEmployees":
          onOpenEmployees();
          break;
        case "openEmployeeMovements":
          onOpenEmployeeMovements();
          break;
        case "openObligations":
          onOpenObligations();
          break;
        case "openSuppliers":
          onOpenSuppliers();
          break;
        case "openCreditors":
          onOpenCreditors();
          break;
        case "openStores":
          onOpenStores();
          break;
        case "openGrupos":
          onOpenGrupos();
          break;
        case "openSubgrupos":
          onOpenSubgrupos();
          break;
        case "openCurrentAccounts":
          onOpenCurrentAccounts();
          break;
        case "openCashAccounts":
          onOpenCashAccounts();
          break;
        case "openParameters":
          onOpenParameters();
          break;
        case "openDocumentTypes":
          onOpenDocumentTypes();
          break;
        case "openPartners":
          onOpenPartners();
          break;
        case "openPartnerTransactions":
          onOpenPartnerTransactions();
          break;
        case "openServiceOrders":
          onOpenServiceOrders();
          break;
      }
    }
    setActiveModule(null);
    setIsPanelOpen(false);
  };

  const getSubMenusForItem = (item: MenuItem): SubMenuItem[] => {
    if (item.dynamicSubMenus) {
      if (item.id === "caixa") {
        return getCaixaSubMenus();
      }
      if (item.id === "estoque") {
        return getEstoqueSubMenus();
      }
    }
    return item.subMenus || [];
  };

  const activeItem = menuItems.find(item => item.id === activeModule);

  return (
    <>
      {/* Barra lateral fixa com ícones */}
      <aside className="fixed left-0 top-0 z-50 flex h-full w-16 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(20,28,43,0.98),rgba(28,38,57,0.98))] shadow-[14px_0_35px_-28px_rgba(15,23,42,0.8)]">
        {/* Logo - Link para Dashboard */}
        <button
          onClick={() => navigate('/dashboard')}
          className="group flex h-16 cursor-pointer items-center justify-center border-b border-white/10 transition-colors hover:bg-white/[0.04]"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all group-hover:border-white/20 group-hover:bg-white/[0.08]">
            <Home className="h-5 w-5 text-white/90" />
          </div>
        </button>

        {/* Menu Items */}
        <nav className="flex-1 py-3">
          {filteredMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeModule === item.id;
            
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleMenuClick(item)}
                    className={cn(
                      "flex h-14 w-full items-center justify-center transition-all duration-200",
                      "hover:bg-white/[0.04]",
                      isActive && "bg-white/[0.06]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent transition-all duration-200",
                        isActive
                          ? "border-[rgba(255,255,255,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] shadow-[0_16px_30px_-18px_rgba(245,158,11,0.85)]"
                          : "bg-white/[0.04] text-white/72 hover:border-white/10 hover:bg-white/[0.08]"
                      )}
                    >
                      {item.customIcon ? (
                        <span className={cn(isActive ? "text-[hsl(38,92%,85%)]" : "text-white/82")}>
                          {item.customIcon}
                        </span>
                      ) : IconComponent ? (
                        <IconComponent className={cn("h-5 w-5", isActive ? "text-[hsl(38,92%,85%)]" : "text-white/82")} />
                      ) : null}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="border-white/10 bg-[rgba(20,28,43,0.95)] px-3 py-2 text-white shadow-xl"
                  sideOffset={5}
                >
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>

      {/* Painel de submenu */}
      {isPanelOpen && activeItem && (activeItem.subMenus || activeItem.dynamicSubMenus) && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div 
            className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]"
            onClick={() => {
              setActiveModule(null);
              setIsPanelOpen(false);
            }}
          />
          
          {/* Painel de submenus */}
          <div className="fixed left-16 top-0 z-50 h-full w-72 animate-slide-in-right border-r border-border/70 bg-background/92 shadow-[22px_0_48px_-26px_rgba(15,23,42,0.36)] backdrop-blur-xl">
            {/* Header do painel */}
            <div className="flex h-16 items-center justify-between border-b border-border/70 bg-card/80 px-5">
              <div className="space-y-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/48">{activeItem.title}</h2>
                <p className="text-xs text-muted-foreground">Acesso rápido ao módulo selecionado</p>
              </div>
              <button
                onClick={() => {
                  setActiveModule(null);
                  setIsPanelOpen(false);
                }}
                className="rounded-full border border-border/70 bg-background/80 p-2 transition-colors hover:bg-accent/75"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Lista de submenus */}
            <nav className="space-y-1 p-3">
              {activeItem.dynamicSubMenus && loadingStores ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                getSubMenusForItem(activeItem).map((subMenu) => (
                  <button
                    key={subMenu.id}
                    onClick={() => handleSubMenuClick(subMenu)}
                    className="flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-left transition-all hover:border-border/70 hover:bg-card hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      {(activeItem.id === "caixa" || activeItem.id === "estoque") && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/85 text-muted-foreground">
                          <Store className="h-4 w-4" />
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground/82">{subMenu.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/80" />
                  </button>
                ))
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default AppSidebar;
