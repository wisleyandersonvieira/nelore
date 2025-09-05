import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, DollarSign } from "lucide-react";

const Reports = () => {
  const navigate = useNavigate();

  const reportModules = [
    {
      id: "accounts-payable",
      title: "Relatório Contas a Pagar", 
      description: "Relatórios de contas a pagar e pagas",
      icon: DollarSign,
      color: "bg-red-500",
      onClick: () => navigate("/reports/accounts-payable"),
    },
    {
      id: "accounts-receivable",
      title: "Relatório Contas a Receber", 
      description: "Relatórios de contas a receber e recebidas",
      icon: FileText,
      color: "bg-green-500",
      onClick: () => navigate("/reports/accounts-receivable"),
    },
    {
      id: "turnover-report",
      title: "Relatório de Faturamento", 
      description: "Relatório de faturamento por período",
      icon: FileText,
      color: "bg-blue-500",
      onClick: () => navigate("/reports/turnover"),
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
            <h1 className="text-2xl font-bold text-primary">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Visualize e exporte relatórios detalhados do sistema</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Módulos de Relatórios</h2>
          <p className="text-muted-foreground">
            Selecione um módulo para visualizar os relatórios disponíveis
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportModules.map((module) => {
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
    </div>
  );
};

export default Reports;