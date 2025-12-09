import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DREStructure } from "@/components/DREStructure";
import { DREView } from "@/components/DREView";
import { FileBarChart, Eye, ArrowLeft, Loader2 } from "lucide-react";
import { useDREPermissions } from "@/hooks/useDREPermissions";

const DRECompetencia: React.FC = () => {
  const navigate = useNavigate();
  const { permissionLevel, isLoading, canAccessStructure, canAccessView } = useDREPermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessView) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-primary">DRE por Competência</h1>
            <p className="text-sm text-muted-foreground">Demonstrativo baseado na competência das receitas e despesas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            {canAccessStructure ? (
              <Tabs defaultValue="view" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="view" className="flex items-center space-x-2">
                    <Eye className="h-4 w-4" />
                    <span>Visualizar DRE</span>
                  </TabsTrigger>
                  <TabsTrigger value="structure" className="flex items-center space-x-2">
                    <FileBarChart className="h-4 w-4" />
                    <span>Estrutura DRE</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="view" className="mt-6">
                  <DREView regime="competence" />
                </TabsContent>

                <TabsContent value="structure" className="mt-6">
                  <DREStructure />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="w-full">
                <div className="flex items-center space-x-2 mb-6 pb-4 border-b">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">Visualizar DRE</span>
                </div>
                <DREView regime="competence" />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DRECompetencia;
