import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProfileViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    profile_permissions: Array<{
      module: string;
      permission: string;
    }>;
  } | null;
}

const MODULES: Record<string, string> = {
  'cadastros': 'Cadastros',
  'usuarios': 'Usuários',
  'financeiro': 'Financeiro',
  'caixa': 'Caixa',
  'estoque': 'Estoque',
  'relatorios': 'Relatórios',
  'dre': 'DRE',
  'configuracoes': 'Configurações',
  'assistente_ia': 'Assistente de IA'
};

const PERMISSIONS: Record<string, { name: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  'disabled': { name: 'Inabilitado', variant: 'outline' },
  'read': { name: 'Visualizar', variant: 'secondary' },
  'write': { name: 'Editar', variant: 'default' },
  'admin': { name: 'Administrar', variant: 'destructive' }
};

export function ProfileViewModal({ isOpen, onClose, profile }: ProfileViewModalProps) {
  if (!profile) return null;

  const groupedPermissions = profile.profile_permissions.reduce((acc, perm) => {
    acc[perm.module] = perm.permission;
    return acc;
  }, {} as Record<string, string>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Visualizar Perfil: {profile.name}
            <Badge variant={profile.is_active ? "default" : "secondary"}>
              {profile.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {profile.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h4>
              <p className="text-sm">{profile.description}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Permissões por Módulo</h4>
            <div className="grid gap-2">
              {Object.entries(MODULES).map(([moduleId, moduleName]) => {
                const permission = groupedPermissions[moduleId] || 'disabled';
                const permConfig = PERMISSIONS[permission] || PERMISSIONS['disabled'];
                
                return (
                  <div 
                    key={moduleId} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-medium">{moduleName}</span>
                    <Badge variant={permConfig.variant}>
                      {permConfig.name}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
