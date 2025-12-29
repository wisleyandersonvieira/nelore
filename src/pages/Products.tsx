import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Plus, Ruler, ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";
import { ProductList } from "@/components/ProductList";
import { UnitsModal } from "@/components/UnitsModal";
import { useNavigate } from "react-router-dom";
import { useProdutosPermissions } from "@/hooks/useProdutosPermissions";

export default function Products() {
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("list");
  const navigate = useNavigate();
  const { permissionLevel, loading, canEdit, canDelete } = useProdutosPermissions();

  // Se for read-only, sempre mostrar lista
  const effectiveTab = !canEdit ? "list" : activeTab;

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerencie o cadastro de produtos</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={effectiveTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="inline-flex h-12 w-full items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            {canEdit && (
              <TabsTrigger value="register" className="flex items-center gap-2 flex-1">
                <Plus className="h-4 w-4" />
                Cadastrar Produto
              </TabsTrigger>
            )}
            <TabsTrigger value="list" className="flex items-center gap-2 flex-1">
              <Package className="h-4 w-4" />
              Produtos Cadastrados
            </TabsTrigger>
            <TabsTrigger value="units" className="flex items-center gap-2 flex-1">
              <Ruler className="h-4 w-4" />
              Unidades de Medida
            </TabsTrigger>
          </TabsList>

          {canEdit && (
            <TabsContent value="register" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{editingProduct ? 'Editar' : 'Cadastrar Novo'} Produto</CardTitle>
                  <CardDescription>
                    {editingProduct ? 'Edite os dados do produto.' : 'Preencha os dados do produto. O código será gerado automaticamente.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProductForm 
                    onUnitsModalOpen={() => setUnitsModalOpen(true)}
                    editingProduct={editingProduct}
                    onSaveSuccess={() => {
                      setEditingProduct(null);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="list" className="space-y-4">
            <ProductList 
              onEditProduct={canEdit ? (product) => {
                setEditingProduct(product);
                setActiveTab("register");
              } : undefined}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Unidades de Medida</CardTitle>
                <CardDescription>
                  {canEdit 
                    ? 'Gerencie as unidades de medida disponíveis para os produtos'
                    : 'Visualize as unidades de medida disponíveis para os produtos'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnitsModal 
                  open={unitsModalOpen} 
                  onOpenChange={setUnitsModalOpen} 
                  inlineMode={true}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}