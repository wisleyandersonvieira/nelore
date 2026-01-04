import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CashControl from "./pages/CashControl";
import Cadastros from "./pages/Cadastros";
import Suppliers from "./pages/Suppliers";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import Profiles from "./pages/Profiles";
import Products from "./pages/Products";
import DRE from "./pages/DRE";
import DRECompetencia from "./pages/DRECompetencia";
import DRECaixa from "./pages/DRECaixa";
import Reports from "./pages/Reports";
import StockModule from "./pages/StockModule";
import StockControl from "./pages/StockControl";
import NotFound from "./pages/NotFound";
import AccountsPayableModule from "./pages/AccountsPayableModule";
import AccountsPayableReport from "./pages/AccountsPayableReport";
import PaidAccountsReport from "./pages/PaidAccountsReport";
import AccountsReceivableModule from "./pages/AccountsReceivableModule";
import AccountsReceivableReport from "./pages/AccountsReceivableReport";
import ReceivedAccountsReport from "./pages/ReceivedAccountsReport";
import TurnoverReport from "./pages/TurnoverReport";
import Extratos from "./pages/Extratos";
import Animais from "./pages/Animais";
import AnimaisCadastro from "./pages/AnimaisCadastro";
import AnimaisLotes from "./pages/AnimaisLotes";
import AnimaisPesagem from "./pages/AnimaisPesagem";
import AnimaisVacinacao from "./pages/AnimaisVacinacao";
import AnimaisMatrizes from "./pages/AnimaisMatrizes";
import AnimaisCadastrosGerais from "./pages/AnimaisCadastrosGerais";
import AnimaisRacas from "./pages/AnimaisRacas";
import AnimaisCategorias from "./pages/AnimaisCategorias";
import AnimaisLeiloes from "./pages/AnimaisLeiloes";
import AnimaisFazendasTerceiras from "./pages/AnimaisFazendasTerceiras";
import AnimaisGestaoPrenhez from "./pages/AnimaisGestaoPrenhez";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cash-control/:storeId" element={<CashControl />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/stores" element={<Stores />} />
              <Route path="/users" element={<Users />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/dre" element={<DRE />} />
              <Route path="/dre/competencia" element={<DRECompetencia />} />
              <Route path="/dre/caixa" element={<DRECaixa />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/stock" element={<StockModule />} />
              <Route path="/stock/:storeId" element={<StockControl />} />
              <Route path="/reports/accounts-payable" element={<AccountsPayableModule />} />
              <Route path="/reports/accounts-payable/pending" element={<AccountsPayableReport />} />
              <Route path="/reports/accounts-payable/paid" element={<PaidAccountsReport />} />
              <Route path="/reports/accounts-receivable" element={<AccountsReceivableModule />} />
              <Route path="/reports/accounts-receivable/pending" element={<AccountsReceivableReport />} />
              <Route path="/reports/accounts-receivable/received" element={<ReceivedAccountsReport />} />
              <Route path="/reports/turnover" element={<TurnoverReport />} />
              <Route path="/reports/extratos" element={<Extratos />} />
              <Route path="/animais" element={<Animais />} />
              <Route path="/animais/cadastro" element={<AnimaisCadastro />} />
              <Route path="/animais/lotes" element={<AnimaisLotes />} />
              <Route path="/animais/pesagem" element={<AnimaisPesagem />} />
              <Route path="/animais/vacinacao" element={<AnimaisVacinacao />} />
              <Route path="/animais/matrizes" element={<AnimaisMatrizes />} />
              <Route path="/animais/prenhez" element={<AnimaisGestaoPrenhez />} />
              <Route path="/animais/cadastros-gerais" element={<AnimaisCadastrosGerais />} />
              <Route path="/animais/cadastros-gerais/racas" element={<AnimaisRacas />} />
              <Route path="/animais/cadastros-gerais/categorias" element={<AnimaisCategorias />} />
              <Route path="/animais/cadastros-gerais/leiloes" element={<AnimaisLeiloes />} />
              <Route path="/animais/cadastros-gerais/fazendas-terceiras" element={<AnimaisFazendasTerceiras />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
