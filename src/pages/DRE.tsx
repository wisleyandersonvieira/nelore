import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DREStructure } from "@/components/DREStructure";
import { DREView } from "@/components/DREView";
import { FileBarChart, Eye } from "lucide-react";

const DRE: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <FileBarChart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">DRE - Demonstrativo de Resultados</h1>
            <p className="text-muted-foreground">Gerenciamento completo do demonstrativo de resultados do exercício</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sistema DRE</CardTitle>
            <CardDescription>
              Configure estruturas e visualize relatórios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="structure" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="structure" className="flex items-center space-x-2">
                  <FileBarChart className="h-4 w-4" />
                  <span>Estrutura DRE</span>
                </TabsTrigger>
                <TabsTrigger value="view" className="flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <span>Visualizar DRE</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="structure" className="mt-6">
                <DREStructure />
              </TabsContent>

              <TabsContent value="view" className="mt-6">
                <DREView />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DRE;