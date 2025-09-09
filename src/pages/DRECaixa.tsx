import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Banknote, Construction } from "lucide-react";

const DRECaixa: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dre")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">DRE por Regime de Caixa</h1>
            <p className="text-sm text-muted-foreground">Demonstrativo baseado no regime de caixa</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Banknote className="h-5 w-5" />
              <span>DRE por Regime de Caixa</span>
            </CardTitle>
            <CardDescription>
              Demonstrativo baseado nas entradas e saídas efetivas de caixa
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Em Desenvolvimento</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Esta funcionalidade está sendo desenvolvida. Em breve você poderá visualizar o DRE baseado no regime de caixa.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DRECaixa;