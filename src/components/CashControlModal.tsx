import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store } from "lucide-react";

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
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchStores();
    }
  }, [open]);

  const fetchStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar se é admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        // Admin vê todas as lojas
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, code')
          .order('name');

        if (error) throw error;
        setStores(data || []);
      } else {
        // Usuário normal: buscar lojas autorizadas
        const storeIds: string[] = [];
        
        // Loja do perfil
        if (profile?.store_id) {
          storeIds.push(profile.store_id);
        }
        
        // Lojas adicionais em user_stores
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);
        
        if (userStores) {
          userStores.forEach(us => {
            if (!storeIds.includes(us.store_id)) {
              storeIds.push(us.store_id);
            }
          });
        }

        if (storeIds.length > 0) {
          const { data, error } = await supabase
            .from('stores')
            .select('id, name, code')
            .in('id', storeIds)
            .order('name');

          if (error) throw error;
          setStores(data || []);
        } else {
          setStores([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelect = (store: Store) => {
    onOpenChange(false);
    navigate(`/cash-control/${store.id}`);
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
          {/* Store Selection View */}
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-y-auto">
                {stores.map((store) => (
                  <Card 
                    key={store.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow aspect-square flex flex-col"
                    onClick={() => handleStoreSelect(store)}
                  >
                    <CardHeader className="pb-2 flex-1 flex flex-col items-center justify-center">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500 flex items-center justify-center mb-2">
                        <Store className="h-5 w-5 md:h-6 md:w-6 text-white" />
                      </div>
                      <CardTitle className="text-sm md:text-base text-center leading-tight">{store.name}</CardTitle>
                      <CardDescription className="text-xs text-center">Código: {store.code}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      <Button className="w-full text-xs" variant="outline" size="sm">
                        Selecionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};