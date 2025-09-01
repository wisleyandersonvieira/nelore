import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { ProductParameterModal } from "./ProductParameterModal";

interface ParametersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Parameter {
  id: string;
  name: string;
  description: string;
  type: 'acrescimo' | 'desconto';
  productId?: string;
  productName?: string;
}

export const ParametersModal = ({ open, onOpenChange }: ParametersModalProps) => {
  const [selectedParameter, setSelectedParameter] = useState<Parameter | null>(null);
  const [productParameterOpen, setProductParameterOpen] = useState(false);

  // Parâmetros padrão do sistema
  const systemParameters: Parameter[] = [
    {
      id: 'acrescimo',
      name: 'Acréscimos',
      description: 'Configurar produto para acréscimos nas contas',
      type: 'acrescimo',
    },
    {
      id: 'desconto',
      name: 'Desconto',
      description: 'Configurar produto para descontos nas contas',
      type: 'desconto',
    },
  ];

  const handleParameterClick = (parameter: Parameter) => {
    setSelectedParameter(parameter);
    setProductParameterOpen(true);
  };

  const getParameterIcon = (type: string) => {
    switch (type) {
      case 'acrescimo':
        return <ArrowUp className="h-5 w-5 text-green-600" />;
      case 'desconto':
        return <ArrowDown className="h-5 w-5 text-red-600" />;
      default:
        return <Settings className="h-5 w-5 text-blue-600" />;
    }
  };

  const getParameterColor = (type: string) => {
    switch (type) {
      case 'acrescimo':
        return 'bg-green-100 hover:bg-green-200';
      case 'desconto':
        return 'bg-red-100 hover:bg-red-200';
      default:
        return 'bg-blue-100 hover:bg-blue-200';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Parâmetros do Sistema
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Parâmetros Disponíveis</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure os parâmetros do sistema para personalizar o comportamento das funcionalidades.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemParameters.map((parameter) => (
                <Card 
                  key={parameter.id} 
                  className={`cursor-pointer transition-colors ${getParameterColor(parameter.type)} border-2 hover:border-primary/50`}
                  onClick={() => handleParameterClick(parameter)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getParameterIcon(parameter.type)}
                        {parameter.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {parameter.type === 'acrescimo' ? 'ACRÉSCIMO' : 'DESCONTO'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-3">
                      {parameter.description}
                    </CardDescription>
                    <div className="flex justify-between items-center">
                      <Button size="sm" variant="outline" className="text-xs">
                        <Settings className="h-3 w-3 mr-1" />
                        Configurar
                      </Button>
                      {parameter.productId && (
                        <Badge variant="default" className="text-xs">
                          Produto: {parameter.productName}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Os parâmetros configurados aqui afetarão o comportamento de outras funcionalidades do sistema, 
                como contas a pagar e receber.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProductParameterModal
        open={productParameterOpen}
        onOpenChange={setProductParameterOpen}
        parameter={selectedParameter}
      />
    </>
  );
};