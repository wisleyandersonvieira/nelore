import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp } from "lucide-react";
import AccountsPayableReports from "@/components/AccountsPayableReports";

const Reports = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Visualize e exporte relatórios detalhados do sistema financeiro
        </p>
      </div>

      <Tabs defaultValue="accounts-payable" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="accounts-payable" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contas a Pagar
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="accounts-payable" className="space-y-4">
          <AccountsPayableReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;