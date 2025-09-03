import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Edit, Plus } from "lucide-react";
import { StockRegisterModal } from "./StockRegisterModal";

interface StockDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  storeId: string;
}

export const StockDateModal = ({ open, onOpenChange, month, year, storeId }: StockDateModalProps) => {
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('create');

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handleAction = (actionMode: 'view' | 'edit' | 'create') => {
    setMode(actionMode);
    setRegisterModalOpen(true);
    onOpenChange(false);
  };

  const handleRegisterModalClose = (open: boolean) => {
    setRegisterModalOpen(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Controle de Estoque - {monthNames[month]} {year}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            {/* Cadastrar Estoque */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleAction('create')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center mx-auto mb-2">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Cadastrar Estoque</CardTitle>
                <CardDescription>
                  Criar novo registro de estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Cadastrar
                </Button>
              </CardContent>
            </Card>

            {/* Visualizar Estoque */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleAction('view')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mx-auto mb-2">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Visualizar Estoque</CardTitle>
                <CardDescription>
                  Ver registros existentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Visualizar
                </Button>
              </CardContent>
            </Card>

            {/* Editar Estoque */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleAction('edit')}
            >
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-yellow-500 flex items-center justify-center mx-auto mb-2">
                  <Edit className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Editar Estoque</CardTitle>
                <CardDescription>
                  Modificar registros existentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Editar
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Selecione uma opção acima para gerenciar o estoque de {monthNames[month]} {year}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <StockRegisterModal
        open={registerModalOpen}
        onOpenChange={handleRegisterModalClose}
        month={month}
        year={year}
        storeId={storeId}
        mode={mode}
      />
    </>
  );
};