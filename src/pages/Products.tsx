import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Ruler } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";
import { ProductList } from "@/components/ProductList";
import { UnitsModal } from "@/components/UnitsModal";

export default function Products() {
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o cadastro de produtos</p>
        </div>
      </div>

      <Tabs defaultValue="register" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="register" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Produto
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos Cadastrados
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Unidades de Medida
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="list" className="space-y-4">
          <ProductList onEditProduct={(product) => {
            setEditingProduct(product);
          }} />
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unidades de Medida</CardTitle>
              <CardDescription>
                Gerencie as unidades de medida disponíveis para os produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnitsModal 
                open={unitsModalOpen} 
                onOpenChange={setUnitsModalOpen} 
                inlineMode={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}