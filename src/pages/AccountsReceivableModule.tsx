import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";

const AccountsReceivableModule = () => {
  const navigate = useNavigate();

  const reports = [
    {
      id: "pending-accounts",
      title: "Contas a Receber", 
      description: "Relatório de contas ainda não recebidas",
      icon: FileText,
      color: "bg-orange-500",
      onClick: () => navigate("/reports/accounts-receivable/pending"),
    },
    {
      id: "received-accounts",
      title: "Contas Recebidas", 
      description: "Relatório de contas já recebidas",
      icon: CheckCircle,
      color: "bg-green-500",
      onClick: () => navigate("/reports/accounts-receivable/received"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/reports")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Relatório Contas a Receber</h1>
            <p className="text-sm text-muted-foreground">Escolha o tipo de relatório que deseja visualizar</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Relatórios Disponíveis</h2>
          <p className="text-muted-foreground">
            Selecione o relatório que deseja gerar
          </p>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => {
            const IconComponent = report.icon;
            return (
              <Card key={report.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${report.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={report.onClick}
                  >
                    Gerar Relatório
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

export default AccountsReceivableModule;