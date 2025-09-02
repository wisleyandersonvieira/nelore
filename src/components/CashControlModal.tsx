import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface CashControlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CashControlModal = ({ open, onOpenChange }: CashControlModalProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchStores();
    }
  }, [open]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
  };

  const handleBackToStores = () => {
    setSelectedStore(null);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Aqui será implementada a navegação para as funções do caixa
      console.log('Data selecionada:', format(date, 'dd/MM/yyyy'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Store className="h-6 w-6" />
            Controle de Caixa
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col">
          {!selectedStore ? (
            // Store Selection View
            <div className="flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Selecione uma Loja</h3>
                <p className="text-muted-foreground">
                  Escolha a loja para acessar o controle de caixa
                </p>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto">
                  {stores.map((store) => (
                    <Card 
                      key={store.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleStoreSelect(store)}
                    >
                      <CardHeader className="pb-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mb-3">
                          <Store className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle className="text-lg">{store.name}</CardTitle>
                        <CardDescription>Código: {store.code}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="outline">
                          Selecionar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Calendar View
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBackToStores}
                  >
                    ← Voltar às Lojas
                  </Button>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedStore.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Código: {selectedStore.code}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <h2 className="text-xl font-semibold min-w-[200px] text-center">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                  </h2>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Full Screen Calendar */}
              <div className="flex-1 flex items-center justify-center">
                <Calendar
                  mode="single"
                  month={currentDate}
                  onMonthChange={setCurrentDate}
                  onSelect={handleDateSelect}
                  className={cn(
                    "rounded-lg border shadow-lg p-6 pointer-events-auto",
                    "scale-150 transform"
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
                    head_cell: "text-muted-foreground rounded-md w-12 font-normal text-base",
                    row: "flex w-full mt-3",
                    cell: "h-12 w-12 text-center text-base p-0 relative cursor-pointer hover:bg-accent rounded-md",
                    day: cn(
                      "h-12 w-12 p-0 font-normal aria-selected:opacity-100 hover:bg-accent rounded-md text-base"
                    ),
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground font-semibold",
                    day_outside: "text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-50",
                  }}
                />
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Clique em um dia do calendário para acessar as funções do caixa dessa data
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};