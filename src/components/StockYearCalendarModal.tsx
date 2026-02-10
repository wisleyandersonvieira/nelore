import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { StockDateModal } from "./StockDateModal";
import { supabase } from "@/integrations/supabase/client";

interface StockYearCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  canEdit?: boolean;
}

export const StockYearCalendarModal = ({ open, onOpenChange, storeId, canEdit = true }: StockYearCalendarModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number } | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [monthsWithStock, setMonthsWithStock] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const months = [
    { value: 1, label: "Janeiro", short: "Jan" },
    { value: 2, label: "Fevereiro", short: "Fev" },
    { value: 3, label: "Março", short: "Mar" },
    { value: 4, label: "Abril", short: "Abr" },
    { value: 5, label: "Maio", short: "Mai" },
    { value: 6, label: "Junho", short: "Jun" },
    { value: 7, label: "Julho", short: "Jul" },
    { value: 8, label: "Agosto", short: "Ago" },
    { value: 9, label: "Setembro", short: "Set" },
    { value: 10, label: "Outubro", short: "Out" },
    { value: 11, label: "Novembro", short: "Nov" },
    { value: 12, label: "Dezembro", short: "Dez" },
  ];

  useEffect(() => {
    if (open) {
      loadStockData();
    }
  }, [open, currentYear, storeId]);

  const loadStockData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_control')
        .select('month')
        .eq('store_id', storeId)
        .eq('year', currentYear);

      if (error) throw error;

      const monthsSet = new Set<number>();
      data?.forEach(item => {
        monthsSet.add(item.month);
      });
      
      setMonthsWithStock(monthsSet);
    } catch (error) {
      console.error('Erro ao carregar dados de estoque:', error);
      setMonthsWithStock(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth({ month, year: currentYear });
    setDateModalOpen(true);
  };

  const handleDateModalClose = (open: boolean) => {
    setDateModalOpen(open);
    if (!open) {
      setSelectedMonth(null);
      // Recarrega os dados quando fecha o modal para atualizar o estado
      loadStockData();
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
                  month.value === new Date().getMonth() + 1 && 
                  currentYear === new Date().getFullYear();
                
                const hasStock = monthsWithStock.has(month.value);
                
                return (
                  <Card
                    key={month.value}
                    className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
                      isCurrentMonth 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : hasStock
                          ? 'bg-green-50 border-green-200 hover:bg-green-100'
                          : 'hover:scale-105'
                    }`}
                    onClick={() => handleMonthClick(month.value)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-sm">
                        {month.short}
                        {hasStock && (
                          <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"></div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${
                          hasStock ? 'text-green-600' : 'text-primary'
                        }`}>
                          {month.value}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {month.label}
                        </div>
                        {hasStock && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            Cadastrado
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Clique em um mês para acessar as opções de estoque</p>
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
                  <span>Mês com estoque cadastrado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Indicador de estoque</span>
                </div>
              </div>
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
          canEdit={canEdit}
        />
      )}
    </>
  );
};