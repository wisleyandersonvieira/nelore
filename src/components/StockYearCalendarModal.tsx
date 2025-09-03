import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { StockDateModal } from "./StockDateModal";

interface StockYearCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export const StockYearCalendarModal = ({ open, onOpenChange, storeId }: StockYearCalendarModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number } | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const months = [
    { value: 0, label: "Janeiro", short: "Jan" },
    { value: 1, label: "Fevereiro", short: "Fev" },
    { value: 2, label: "Março", short: "Mar" },
    { value: 3, label: "Abril", short: "Abr" },
    { value: 4, label: "Maio", short: "Mai" },
    { value: 5, label: "Junho", short: "Jun" },
    { value: 6, label: "Julho", short: "Jul" },
    { value: 7, label: "Agosto", short: "Ago" },
    { value: 8, label: "Setembro", short: "Set" },
    { value: 9, label: "Outubro", short: "Out" },
    { value: 10, label: "Novembro", short: "Nov" },
    { value: 11, label: "Dezembro", short: "Dez" },
  ];

  const handleMonthClick = (month: number) => {
    setSelectedMonth({ month, year: currentYear });
    setDateModalOpen(true);
  };

  const handleDateModalClose = (open: boolean) => {
    setDateModalOpen(open);
    if (!open) {
      setSelectedMonth(null);
    }
  };

  const handlePreviousYear = () => {
    setCurrentYear(currentYear - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(currentYear + 1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendário Anual de Estoque - {currentYear}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Year Navigation */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" onClick={handlePreviousYear}>
                ← {currentYear - 1}
              </Button>
              <h2 className="text-2xl font-bold">{currentYear}</h2>
              <Button variant="outline" size="sm" onClick={handleNextYear}>
                {currentYear + 1} →
              </Button>
            </div>

            {/* Months Grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {months.map((month) => {
                const isCurrentMonth = 
                  month.value === new Date().getMonth() && 
                  currentYear === new Date().getFullYear();
                
                return (
                  <Card
                    key={month.value}
                    className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
                      isCurrentMonth 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:scale-105'
                    }`}
                    onClick={() => handleMonthClick(month.value)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-sm">
                        {month.short}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-primary">
                          {month.value + 1}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {month.label}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Clique em um mês para acessar as opções de estoque
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMonth && (
        <StockDateModal
          open={dateModalOpen}
          onOpenChange={handleDateModalClose}
          month={selectedMonth.month}
          year={selectedMonth.year}
          storeId={storeId}
        />
      )}
    </>
  );
};