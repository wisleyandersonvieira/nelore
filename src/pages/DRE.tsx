import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileBarChart, Banknote } from "lucide-react";

const DRE = () => {
  const navigate = useNavigate();

  const dreModules = [
    {
      id: "competencia",
      title: "DRE por Competência", 
      description: "Demonstrativo baseado na competência das receitas e despesas",
      icon: FileBarChart,
      color: "bg-blue-500",
      onClick: () => navigate("/dre/competencia"),
    },
    {
      id: "caixa",
      title: "DRE por Regime de Caixa", 
      description: "Demonstrativo baseado no regime de caixa",
      icon: Banknote,
      color: "bg-green-500",
      onClick: () => navigate("/dre/caixa"),
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
            <h1 className="text-2xl font-bold text-primary">DRE - Demonstrativo de Resultados</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento completo do demonstrativo de resultados do exercício</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Tipos de DRE</h2>
          <p className="text-muted-foreground">
            Selecione o tipo de demonstrativo que deseja visualizar
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dreModules.map((module) => {
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

export default DRE;