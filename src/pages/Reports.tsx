import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, DollarSign, TrendingUpDown, LineChart, Wallet, FileArchive, FileWarning, ArrowLeftRight } from "lucide-react";
const Reports = () => {
  const navigate = useNavigate();
  const reportModules = [{
    id: "accounts-payable",
    title: "Relatório Contas a Pagar",
    description: "Relatórios de contas a pagar e pagas",
    icon: DollarSign,
    color: "bg-red-500",
    onClick: () => navigate("/reports/accounts-payable")
  }, {
    id: "accounts-receivable",
    title: "Relatório Contas a Receber",
    description: "Relatórios de contas a receber e recebidas",
    icon: FileText,
    color: "bg-green-500",
    onClick: () => navigate("/reports/accounts-receivable")
  }, {
    id: "income-expense",
    title: "Relatório de Entradas e Saídas",
    description: "Análise de receitas e despesas por grupo e subgrupo",
    icon: TrendingUpDown,
    color: "bg-orange-500",
    onClick: () => navigate("/reports/income-expense")
  }, {
    id: "turnover-report",
    title: "Relatório de Faturamento",
    description: "Relatório de faturamento por período",
    icon: FileText,
    color: "bg-blue-500",
    onClick: () => navigate("/reports/turnover")
  }, {
    id: "turnover-chart",
    title: "Gráfico de Faturamento",
    description: "Visualização gráfica do faturamento por loja e período",
    icon: LineChart,
    color: "bg-cyan-500",
    onClick: () => navigate("/reports/turnover-chart")
  }, {
    id: "extratos",
    title: "Extratos de Contas",
    description: "Extratos detalhados das movimentações das contas",
    icon: FileText,
    color: "bg-purple-500",
    onClick: () => navigate("/reports/extratos")
  }, {
    id: "balance-position",
    title: "Posição de Saldos",
    description: "Visualize o saldo das contas em uma data específica",
    icon: Wallet,
    color: "bg-teal-500",
    onClick: () => navigate("/reports/balance-position")
  }, {
    id: "accounting-export",
    title: "Exportar Contabilidade",
    description: "Exporte pagamentos e anexos para contabilidade",
    icon: FileArchive,
    color: "bg-indigo-500",
    onClick: () => navigate("/reports/accounting-export")
  }, {
    id: "purchases-without-invoice",
    title: "Compras sem NF",
    description: "Compras que ainda não possuem nota fiscal anexada",
    icon: FileWarning,
    color: "bg-amber-500",
    onClick: () => navigate("/reports/purchases-without-invoice")
  }, {
    id: "supplier-trade-balance",
    title: "Compras e Vendas por Fornecedor",
    description: "Animais, prenhezes e aspirações comprados e vendidos por fornecedor/credor, com saldo",
    icon: ArrowLeftRight,
    color: "bg-sky-500",
    onClick: () => navigate("/reports/supplier-trade-balance")
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
            <h1 className="text-2xl font-bold text-primary">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Visualize e exporte relatórios detalhados do sistema</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          
          
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportModules.map(module => {
          const IconComponent = module.icon;
          return <Card key={module.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" onClick={module.onClick}>
                    Acessar
                  </Button>
                </CardContent>
              </Card>;
        })}
        </div>
      </main>
    </div>;
};
export default Reports;