import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonthViewTable } from "./MonthViewTable";

interface MonthViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export const MonthViewModal = ({ open, onOpenChange, storeId }: MonthViewModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showTable, setShowTable] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: "0", label: "Janeiro" },
    { value: "1", label: "Fevereiro" },
    { value: "2", label: "Março" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Maio" },
    { value: "5", label: "Junho" },
    { value: "6", label: "Julho" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Setembro" },
    { value: "9", label: "Outubro" },
    { value: "10", label: "Novembro" },
    { value: "11", label: "Dezembro" },
  ];

  const handleViewMonth = () => {
    if (selectedMonth && selectedYear) {
      setShowTable(true);
    }
  };

  const handleClose = () => {
    setShowTable(false);
    setSelectedMonth("");
    setSelectedYear("");
    onOpenChange(false);
  };

  if (showTable && selectedMonth && selectedYear) {
    const monthDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] max-h-[95dvh] h-full flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Controle de Caixa - {format(monthDate, 'MMMM yyyy', { locale: ptBR })}</span>
              <Button variant="outline" onClick={() => setShowTable(false)}>
                Voltar
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <MonthViewTable 
              storeId={storeId} 
              year={parseInt(selectedYear)} 
              month={parseInt(selectedMonth)} 
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Mês</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Ano</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Mês</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleViewMonth} 
            disabled={!selectedMonth || !selectedYear || loading}
            className="w-full"
          >
            Visualizar Mês
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};