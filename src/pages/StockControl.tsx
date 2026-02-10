import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Store, Package } from "lucide-react";
import { StockYearCalendarModal } from "@/components/StockYearCalendarModal";
import { useEstoquePermissions } from "@/hooks/useEstoquePermissions";
interface Store {
  id: string;
  name: string;
  code: string;
}

const StockControl = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearCalendarOpen, setYearCalendarOpen] = useState(false);
  const { canEdit, loading: loadingPermissions } = useEstoquePermissions();

  useEffect(() => {
    if (storeId) {
      fetchStore();
      // Open year calendar immediately when component loads
      setYearCalendarOpen(true);
    }
  }, [storeId]);

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

  const handleYearCalendarClose = (open: boolean) => {
    setYearCalendarOpen(open);
    if (!open) {
      // Navigate back to dashboard when calendar closes
      navigate('/dashboard');
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
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Controle de Estoque</h1>
                  <p className="text-sm text-muted-foreground">
                    {store.name} - Código: {store.code}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Calendário de Estoque</h2>
          <p className="text-muted-foreground mb-6">
            Selecione um mês para gerenciar o estoque
          </p>
          <Button onClick={() => setYearCalendarOpen(true)} size="lg">
            Abrir Calendário Anual
          </Button>
        </div>
      </main>

      {storeId && !loadingPermissions && (
        <StockYearCalendarModal
          open={yearCalendarOpen}
          onOpenChange={handleYearCalendarClose}
          storeId={storeId}
          canEdit={canEdit}
        />
      )}
    </div>
  );
};

export default StockControl;