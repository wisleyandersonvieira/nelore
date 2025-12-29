import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Store, Package } from "lucide-react";

interface Store {
  id: string;
  name: string;
  code: string;
}

const StockModule = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Controle de Estoque</h1>
                  <p className="text-sm text-muted-foreground">
                    Selecione uma loja para acessar o estoque
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Lojas Disponíveis</h2>
          <p className="text-muted-foreground">
            Escolha uma loja para gerenciar o estoque
          </p>
        </div>

        {stores.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma loja encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre lojas primeiro para acessar o controle de estoque.
            </p>
            <Button onClick={() => navigate('/stores')}>
              Cadastrar Lojas
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card 
                key={store.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/stock/${store.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center mb-3">
                    <Store className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <CardDescription>Código: {store.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Acessar Estoque
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StockModule;