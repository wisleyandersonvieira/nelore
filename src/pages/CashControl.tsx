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
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('cash_control')
        .select('date, approved_status')
        .eq('store_id', storeId)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0]);

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
                Voltar ao Dashboard
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
              VISUALIZAR MÊS COMPLETO
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Full Screen Calendar */}
      <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <Calendar
          mode="single"
          month={currentDate}
          onMonthChange={setCurrentDate}
          onSelect={handleDateSelect}
          modifiers={{
            hasData: (date) => datesWithData.has(date.toISOString().split('T')[0]),
            approved: (date) => approvedDates.has(date.toISOString().split('T')[0])
          }}
          modifiersClassNames={{
            hasData: "bg-yellow-100 border-2 border-yellow-300",
            approved: "bg-green-100 border-2 border-green-400"
          }}
          className={cn(
            "rounded-lg border shadow-lg p-4 md:p-8 pointer-events-auto bg-card",
            "scale-75 md:scale-90 transform"
          )}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-2xl font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-10 w-10 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-2",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-10 md:w-14 font-normal text-sm md:text-lg",
            row: "flex w-full mt-2 md:mt-4",
            cell: "h-10 w-10 md:h-14 md:w-14 text-center text-sm md:text-lg p-0 relative cursor-pointer hover:bg-accent rounded-md transition-colors",
            day: cn(
              "h-10 w-10 md:h-14 md:w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-accent rounded-md text-sm md:text-lg transition-colors",
              "data-[has-data=true]:bg-yellow-100 data-[has-data=true]:border-2 data-[has-data=true]:border-yellow-300"
            ),
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground font-semibold ring-2 ring-primary",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
          }}
        />

        <div className="mt-8 p-6 bg-muted rounded-lg max-w-md">
          <p className="text-center text-muted-foreground">
            Clique em um dia do calendário para acessar as funções do caixa dessa data
          </p>
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