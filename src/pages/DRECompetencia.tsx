import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DREStructure } from "@/components/DREStructure";
import { DREView } from "@/components/DREView";
import { FileBarChart, Eye, ArrowLeft } from "lucide-react";

const DRECompetencia: React.FC = () => {
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
            <h1 className="text-2xl font-bold text-primary">DRE por Competência</h1>
            <p className="text-sm text-muted-foreground">Demonstrativo baseado na competência das receitas e despesas</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DRECompetencia;