import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DREStructure } from "@/components/DREStructure";
import { DRERegister } from "@/components/DRERegister";
import { DREView } from "@/components/DREView";
import { DREManager } from "@/components/DREManager";
import { FileBarChart, Plus, Eye, Settings } from "lucide-react";

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
              Configure estruturas, cadastre demonstrativos e visualize relatórios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="structure" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="structure" className="flex items-center space-x-2">
                  <FileBarChart className="h-4 w-4" />
                  <span>Estrutura DRE</span>
                </TabsTrigger>
                <TabsTrigger value="register" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar DRE</span>
                </TabsTrigger>
                <TabsTrigger value="manage" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Gerenciar DREs</span>
                </TabsTrigger>
                <TabsTrigger value="view" className="flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <span>Visualizar DRE</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="structure" className="mt-6">
                <DREStructure />
              </TabsContent>

              <TabsContent value="register" className="mt-6">
                <DRERegister />
              </TabsContent>

              <TabsContent value="manage" className="mt-6">
                <DREManager />
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