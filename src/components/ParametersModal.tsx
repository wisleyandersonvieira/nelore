import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, ArrowUp, ArrowDown, Wallet, ShieldAlert } from "lucide-react";
import { ProductParameterModal } from "./ProductParameterModal";
import { SubgroupParameterModal } from "./SubgroupParameterModal";
import { GrupoParameterModal } from "./GrupoParameterModal";
import { FaturamentoParameterModal } from "./FaturamentoParameterModal";
import { AcrescimoParameterModal } from "./AcrescimoParameterModal";
import { DescontoParameterModal } from "./DescontoParameterModal";
import { AportesRetiradaParameterModal } from "./AportesRetiradaParameterModal";
import { supabase } from "@/integrations/supabase/client";
import { useParametersAccess } from "@/hooks/useParametersAccess";
import { useUserMatrix } from "@/hooks/useUserMatrix";

interface ParametersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Parameter {
  id: string;
  name: string;
  description: string;
  type: 'acrescimo' | 'desconto' | 'sorvete' | 'mercadorias_diversas' | 'embalagens' | 'funcionarios' | 'faturamento' | 'aportes_retiradas';
  category: 'product' | 'subgroup' | 'group' | 'faturamento';
  productId?: string;
  productName?: string;
  subgroupId?: string;
  subgroupName?: string;
  groupId?: string;
  groupName?: string;
}

export const ParametersModal = ({ open, onOpenChange }: ParametersModalProps) => {
  const [selectedParameter, setSelectedParameter] = useState<Parameter | null>(null);
  const [productParameterOpen, setProductParameterOpen] = useState(false);
  const [subgroupParameterOpen, setSubgroupParameterOpen] = useState(false);
  const [groupParameterOpen, setGroupParameterOpen] = useState(false);
  const [faturamentoParameterOpen, setFaturamentoParameterOpen] = useState(false);
  const [acrescimoParameterOpen, setAcrescimoParameterOpen] = useState(false);
  const [descontoParameterOpen, setDescontoParameterOpen] = useState(false);
  const [aportesRetiradaParameterOpen, setAportesRetiradaParameterOpen] = useState(false);
  const [configuredParameters, setConfiguredParameters] = useState<Record<string, { productId?: string; productName?: string; subgroupId?: string; subgroupName?: string; groupId?: string; groupName?: string }>>({});

  const { hasAccess, isLoading: accessLoading } = useParametersAccess();
  const { matrixId } = useUserMatrix();

  // Parâmetros padrão do sistema
  const systemParameters: Parameter[] = [
    {
      id: 'acrescimo',
      name: 'Acréscimos',
      description: 'Configurar produtos para acréscimos (Contas a Pagar e Contas a Receber)',
      type: 'acrescimo',
      category: 'product',
      productId: configuredParameters['acrescimo_pagar']?.productId,
      productName: configuredParameters['acrescimo_pagar']?.productName,
    },
    {
      id: 'desconto',
      name: 'Desconto',
      description: 'Configurar produtos para descontos (Contas a Pagar e Contas a Receber)',
      type: 'desconto',
      category: 'product',
      productId: configuredParameters['desconto_pagar']?.productId,
      productName: configuredParameters['desconto_pagar']?.productName,
    },
    {
      id: 'aportes_retiradas',
      name: 'Aportes e Retiradas',
      description: 'Configurar produtos para aportes (entrada de capital) e retiradas (saída de capital) de sócios',
      type: 'aportes_retiradas',
      category: 'product',
      productId: configuredParameters['aporte_socios']?.productId,
      productName: configuredParameters['aporte_socios']?.productName,
    },
    {
      id: 'sorvete',
      name: 'Sorvete',
      description: 'Configurar subgrupos para controle de estoque de sorvete',
      type: 'sorvete',
      category: 'subgroup',
      subgroupId: configuredParameters['sorvete']?.subgroupId,
      subgroupName: configuredParameters['sorvete']?.subgroupName,
    },
    {
      id: 'mercadorias_diversas',
      name: 'Mercadorias Diversas',
      description: 'Configurar subgrupos para controle de estoque de mercadorias diversas',
      type: 'mercadorias_diversas',
      category: 'subgroup',
      subgroupId: configuredParameters['mercadorias_diversas']?.subgroupId,
      subgroupName: configuredParameters['mercadorias_diversas']?.subgroupName,
    },
    {
      id: 'embalagens',
      name: 'Embalagens',
      description: 'Configurar subgrupos para controle de estoque de embalagens',
      type: 'embalagens',
      category: 'subgroup',
      subgroupId: configuredParameters['embalagens']?.subgroupId,
      subgroupName: configuredParameters['embalagens']?.subgroupName,
    },
    {
      id: 'funcionarios',
      name: 'Funcionários',
      description: 'Configurar grupos para controle financeiro de funcionários',
      type: 'funcionarios',
      category: 'group',
      groupId: configuredParameters['funcionarios']?.groupId,
      groupName: configuredParameters['funcionarios']?.groupName,
    },
    {
      id: 'faturamento',
      name: 'Faturamento',
      description: 'Configurar subgrupos para tipos de venda (Dinheiro, Cartão, Contas, Delivery)',
      type: 'faturamento',
      category: 'faturamento',
    },
  ];

  useEffect(() => {
    if (open && hasAccess) {
      loadConfiguredParameters();
    }
  }, [open, hasAccess, productParameterOpen, subgroupParameterOpen, groupParameterOpen, faturamentoParameterOpen, acrescimoParameterOpen, descontoParameterOpen, aportesRetiradaParameterOpen]);

  const loadConfiguredParameters = async () => {
    try {
      // Buscar parâmetros com produtos (incluindo os novos parâmetros separados)
      const { data: productParams, error: productError } = await supabase
        .from('system_parameters')
        .select('parameter_key, product_id, products!inner(name)')
        .in('parameter_key', ['acrescimo', 'desconto', 'acrescimo_pagar', 'acrescimo_receber', 'desconto_pagar', 'desconto_receber', 'aporte_socios', 'retirada_socios'])
        .not('product_id', 'is', null);

      if (productError) throw productError;

      // Buscar parâmetros com subgrupos
      const { data: subgroupParams, error: subgroupError } = await supabase
        .from('system_parameters')
        .select('parameter_key, subgroup_id, account_groups!system_parameters_subgroup_id_fkey(name)')
        .in('parameter_key', ['sorvete', 'mercadorias_diversas', 'embalagens'])
        .not('subgroup_id', 'is', null);

      if (subgroupError) throw subgroupError;

      // Buscar parâmetros com grupos
      const { data: groupParams, error: groupError } = await supabase
        .from('system_parameters')
        .select('parameter_key, group_id, account_groups!system_parameters_group_id_fkey(name)')
        .in('parameter_key', ['funcionarios'])
        .not('group_id', 'is', null);

      if (groupError) throw groupError;

      const configured: Record<string, { productId?: string; productName?: string; subgroupId?: string; subgroupName?: string; groupId?: string; groupName?: string }> = {};
      
      // Processar parâmetros de produtos
      productParams?.forEach((param: any) => {
        configured[param.parameter_key] = {
          productId: param.product_id,
          productName: param.products.name
        };
      });

      // Processar parâmetros de subgrupos
      subgroupParams?.forEach((param: any) => {
        configured[param.parameter_key] = {
          subgroupId: param.subgroup_id,
          subgroupName: param.account_groups.name
        };
      });

      // Processar parâmetros de grupos
      groupParams?.forEach((param: any) => {
        configured[param.parameter_key] = {
          groupId: param.group_id,
          groupName: param.account_groups.name
        };
      });
      
      setConfiguredParameters(configured);
    } catch (error) {
      console.error('Erro ao carregar parâmetros configurados:', error);
    }
  };

  const handleParameterClick = (parameter: Parameter) => {
    setSelectedParameter(parameter);
    // Para acréscimos, descontos e aportes/retiradas, abrir o modal específico com dois produtos
    if (parameter.id === 'acrescimo') {
      setAcrescimoParameterOpen(true);
    } else if (parameter.id === 'desconto') {
      setDescontoParameterOpen(true);
    } else if (parameter.id === 'aportes_retiradas') {
      setAportesRetiradaParameterOpen(true);
    } else if (parameter.category === 'product') {
      setProductParameterOpen(true);
    } else if (parameter.category === 'subgroup') {
      setSubgroupParameterOpen(true);
    } else if (parameter.category === 'group') {
      setGroupParameterOpen(true);
    } else if (parameter.category === 'faturamento') {
      setFaturamentoParameterOpen(true);
    }
  };

  const getParameterIcon = (type: string) => {
    switch (type) {
      case 'acrescimo':
        return <ArrowUp className="h-5 w-5 text-green-600" />;
      case 'desconto':
        return <ArrowDown className="h-5 w-5 text-red-600" />;
      case 'aportes_retiradas':
        return <Wallet className="h-5 w-5 text-orange-600" />;
      case 'sorvete':
        return <Settings className="h-5 w-5 text-purple-600" />;
      case 'mercadorias_diversas':
        return <Settings className="h-5 w-5 text-amber-600" />;
      case 'embalagens':
        return <Settings className="h-5 w-5 text-teal-600" />;
      case 'funcionarios':
        return <Settings className="h-5 w-5 text-indigo-600" />;
      case 'faturamento':
        return <Settings className="h-5 w-5 text-emerald-600" />;
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
      case 'aportes_retiradas':
        return 'bg-orange-100 hover:bg-orange-200';
      case 'sorvete':
        return 'bg-purple-100 hover:bg-purple-200';
      case 'mercadorias_diversas':
        return 'bg-amber-100 hover:bg-amber-200';
      case 'embalagens':
        return 'bg-teal-100 hover:bg-teal-200';
      case 'funcionarios':
        return 'bg-indigo-100 hover:bg-indigo-200';
      case 'faturamento':
        return 'bg-emerald-100 hover:bg-emerald-200';
      default:
        return 'bg-blue-100 hover:bg-blue-200';
    }
  };

  // Show access denied if user doesn't have permission
  if (!accessLoading && !hasAccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Acesso Negado
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar os parâmetros do sistema.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Apenas usuários com perfil <strong>Matriz</strong> podem configurar parâmetros.
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              {systemParameters.map((parameter) => {
                const configuredParam = configuredParameters[parameter.id];
                return (
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
                           {parameter.category === 'product' ? 'PRODUTO' : 
                            parameter.category === 'subgroup' ? 'SUBGRUPO' : 
                            parameter.category === 'group' ? 'GRUPO' :
                            parameter.category === 'faturamento' ? 'FATURAMENTO' : 'OUTRO'}
                         </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm mb-3">
                        {parameter.description}
                      </CardDescription>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <Button size="sm" variant="outline" className="text-xs">
                            <Settings className="h-3 w-3 mr-1" />
                            Configurar
                          </Button>
                          {configuredParam && parameter.id !== 'acrescimo' && parameter.id !== 'desconto' && parameter.id !== 'aportes_retiradas' && (
                            <Badge variant="default" className="text-xs">
                              {parameter.category === 'product' 
                                ? `Produto: ${configuredParam.productName}`
                                : parameter.category === 'subgroup'
                                ? `Subgrupo: ${configuredParam.subgroupName}`
                                : `Grupo: ${configuredParam.groupName}`
                              }
                            </Badge>
                          )}
                        </div>
                        {parameter.id === 'acrescimo' && (
                          <div className="flex flex-col gap-1">
                            {configuredParameters['acrescimo_pagar']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start">
                                Pagar: {configuredParameters['acrescimo_pagar'].productName}
                              </Badge>
                            )}
                            {configuredParameters['acrescimo_receber']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start">
                                Receber: {configuredParameters['acrescimo_receber'].productName}
                              </Badge>
                            )}
                          </div>
                        )}
                        {parameter.id === 'desconto' && (
                          <div className="flex flex-col gap-1">
                            {configuredParameters['desconto_pagar']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start">
                                Pagar: {configuredParameters['desconto_pagar'].productName}
                              </Badge>
                            )}
                            {configuredParameters['desconto_receber']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start">
                                Receber: {configuredParameters['desconto_receber'].productName}
                              </Badge>
                            )}
                          </div>
                        )}
                        {parameter.id === 'aportes_retiradas' && (
                          <div className="flex flex-col gap-1">
                            {configuredParameters['aporte_socios']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start bg-green-50">
                                Aporte: {configuredParameters['aporte_socios'].productName}
                              </Badge>
                            )}
                            {configuredParameters['retirada_socios']?.productName && (
                              <Badge variant="outline" className="text-xs justify-start bg-red-50">
                                Retirada: {configuredParameters['retirada_socios'].productName}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
        parameter={selectedParameter?.category === 'product' ? {
          id: selectedParameter.id,
          name: selectedParameter.name,
          description: selectedParameter.description,
          type: selectedParameter.type as 'acrescimo' | 'desconto',
          category: selectedParameter.category
        } : null}
      />

      <SubgroupParameterModal
        open={subgroupParameterOpen}
        onOpenChange={setSubgroupParameterOpen}
        parameter={selectedParameter?.category === 'subgroup' ? {
          id: selectedParameter.id,
          name: selectedParameter.name,
          description: selectedParameter.description,
          type: selectedParameter.type as 'sorvete' | 'mercadorias_diversas' | 'embalagens',
          category: selectedParameter.category
        } : null}
      />

      <GrupoParameterModal
        open={groupParameterOpen}
        onOpenChange={setGroupParameterOpen}
        parameter={selectedParameter?.category === 'group' ? {
          id: selectedParameter.id,
          name: selectedParameter.name,
          description: selectedParameter.description,
          type: selectedParameter.type as 'funcionarios',
          category: selectedParameter.category
        } : null}
      />

      <FaturamentoParameterModal
        open={faturamentoParameterOpen}
        onOpenChange={setFaturamentoParameterOpen}
        parameter={selectedParameter?.category === 'faturamento' ? {
          id: selectedParameter.id,
          name: selectedParameter.name,
          description: selectedParameter.description,
          type: selectedParameter.type as 'faturamento',
          category: selectedParameter.category
        } : null}
      />

      <AcrescimoParameterModal
        open={acrescimoParameterOpen}
        onOpenChange={setAcrescimoParameterOpen}
      />

      <DescontoParameterModal
        open={descontoParameterOpen}
        onOpenChange={setDescontoParameterOpen}
      />

      <AportesRetiradaParameterModal
        open={aportesRetiradaParameterOpen}
        onOpenChange={setAportesRetiradaParameterOpen}
      />
    </>
  );
};
