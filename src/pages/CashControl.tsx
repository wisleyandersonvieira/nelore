import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, ArrowLeft, Store } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CashDateModal } from "@/components/CashDateModal";
import { MonthViewModal } from "@/components/MonthViewModal";
import { CashControlExpenseBox } from "@/components/CashControlExpenseBox";

interface Store {
  id: string;
  name: string;
  code: string;
}

const CashControl = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [monthViewModalOpen, setMonthViewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());
  const [approvedDates, setApprovedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (storeId) {
      fetchStore();
      fetchDatesWithData();
    }
  }, [storeId, currentDate]);

  const fetchStore = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('id', storeId)
        .single();

      if (error) throw error;
      setStore(data);
    } catch (error) {
      console.error('Erro ao carregar loja:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatesWithData = async () => {
    if (!storeId) return;

    try {
      // Format dates properly to avoid timezone issues
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('cash_control')
        .select('date, approved_status')
        .eq('store_id', storeId)
        .gte('date', startOfMonthStr)
        .lte('date', endOfMonthStr);

      if (error) throw error;

      const dates = new Set(data?.map(item => item.date) || []);
      const approved = new Set(data?.filter(item => item.approved_status).map(item => item.date) || []);
      setDatesWithData(dates);
      setApprovedDates(approved);
    } catch (error) {
      console.error('Erro ao carregar datas com dados:', error);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && storeId) {
      setSelectedDate(date);
      setDateModalOpen(true);
    }
  };

  const handleDateModalClose = (open: boolean) => {
    setDateModalOpen(open);
    if (!open) {
      // Refresh dates with data when modal closes
      fetchDatesWithData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loja não encontrada</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Controle de Caixa</h1>
                  <p className="text-sm text-muted-foreground">
                    {store.name} - Código: {store.code}
                  </p>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={() => setMonthViewModalOpen(true)}
            >
              Relatório
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Calendar with Expense Boxes */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          {/* Calendar Section */}
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Caixa Diário</h2>
            <Calendar
              mode="single"
              month={currentDate}
              onMonthChange={setCurrentDate}
              onSelect={handleDateSelect}
              locale={ptBR}
              modifiers={{
                hasData: (date) => {
                  const dateString = date.toISOString().split('T')[0];
                  return datesWithData.has(dateString) && !approvedDates.has(dateString);
                },
                approved: (date) => approvedDates.has(date.toISOString().split('T')[0])
              }}
              modifiersClassNames={{
                hasData: "bg-yellow-100 border-2 border-yellow-300",
                approved: "bg-green-100 border-2 border-green-300"
              }}
              className={cn(
                "rounded-lg border shadow-lg p-4 pointer-events-auto bg-card"
              )}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-xl font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-10 font-normal text-sm",
                row: "flex w-full mt-2",
                cell: "h-10 w-10 text-center text-sm p-0 relative cursor-pointer hover:bg-accent rounded-md transition-colors",
                day: cn(
                  "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-accent rounded-md text-sm transition-colors",
                  "data-[has-data=true]:bg-yellow-100 data-[has-data=true]:border-2 data-[has-data=true]:border-yellow-300"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-semibold ring-2 ring-primary",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
              }}
            />

            <div className="mt-4 p-4 bg-muted rounded-lg w-full max-w-[280px]">
              <p className="text-center text-muted-foreground text-sm">
                Clique em um dia do calendário para acessar as funções do caixa dessa data
              </p>
            </div>
          </div>

          {/* Expense Boxes Section - Stacked Vertically beside Calendar */}
          <div className="flex flex-col gap-4">
            <CashControlExpenseBox
              storeId={storeId!}
              expenseType="caixa_geral"
              title="Contas Pagas no Caixa Geral"
              referenceMonth={currentDate.getMonth() + 1}
              referenceYear={currentDate.getFullYear()}
            />
            <CashControlExpenseBox
              storeId={storeId!}
              expenseType="banco"
              title="Contas a Pagar/Pagas via Banco"
              referenceMonth={currentDate.getMonth() + 1}
              referenceYear={currentDate.getFullYear()}
            />
          </div>
        </div>
      </main>

      {selectedDate && storeId && (
        <CashDateModal
          open={dateModalOpen}
          onOpenChange={handleDateModalClose}
          date={selectedDate}
          storeId={storeId}
        />
      )}

      {storeId && (
        <MonthViewModal
          open={monthViewModalOpen}
          onOpenChange={setMonthViewModalOpen}
          storeId={storeId}
        />
      )}
    </div>
  );
};

export default CashControl;