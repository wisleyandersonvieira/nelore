import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingProfile?: any;
}

const MODULES = [
  { id: 'cadastros', name: 'Cadastros', description: 'Acesso ao módulo de cadastros gerais' },
  { id: 'produtos', name: 'Produtos', description: 'Cadastro e gestão de produtos' },
  { id: 'fornecedores', name: 'Fornecedores', description: 'Cadastro e gestão de fornecedores' },
  { id: 'usuarios', name: 'Usuários', description: 'Gestão de usuários e permissões' },
  { id: 'lojas', name: 'Lojas', description: 'Cadastro e gestão de lojas' },
  { id: 'financeiro', name: 'Financeiro', description: 'Gestão financeira geral' },
  { id: 'caixa', name: 'Caixa', description: 'Controle de caixa' },
  { id: 'contas_pagar', name: 'Contas a Pagar', description: 'Gestão de contas a pagar' },
  { id: 'contas_receber', name: 'Contas a Receber', description: 'Gestão de contas a receber' },
  { id: 'relatorios', name: 'Relatórios', description: 'Visualização de relatórios' }
];

const PERMISSIONS = [
  { id: 'read', name: 'Visualizar', description: 'Apenas visualização' },
  { id: 'write', name: 'Editar', description: 'Criar, editar e visualizar' },
  { id: 'admin', name: 'Administrar', description: 'Controle total do módulo' }
];

export function ProfileModal({ isOpen, onClose, onSuccess, editingProfile }: ProfileModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name || "");
      setDescription(editingProfile.description || "");
      
      // Load existing permissions
      const existingPermissions: Record<string, string> = {};
      editingProfile.profile_permissions?.forEach((perm: any) => {
        existingPermissions[perm.module] = perm.permission;
      });
      setPermissions(existingPermissions);
    } else {
      setName("");
      setDescription("");
      setPermissions({});
    }
  }, [editingProfile, isOpen]);

  const handlePermissionChange = (moduleId: string, permission: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: prev[moduleId] === permission ? '' : permission
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome do perfil é obrigatório");
      return;
    }

    setLoading(true);
    try {
      let profileId;

      if (editingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            name: name.trim(),
            description: description.trim()
          })
          .eq('id', editingProfile.id);

        if (updateError) throw updateError;
        profileId = editingProfile.id;

        // Delete existing permissions
        await supabase
          .from('profile_permissions')
          .delete()
          .eq('profile_id', profileId);
      } else {
        // Create new profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            name: name.trim(),
            description: description.trim()
          })
          .select()
          .single();

        if (profileError) throw profileError;
        profileId = profileData.id;
      }

      // Insert new permissions
      const permissionRecords = Object.entries(permissions)
        .filter(([_, permission]) => permission)
        .map(([moduleId, permission]) => ({
          profile_id: profileId,
          module: moduleId,
          permission: permission as 'read' | 'write' | 'admin'
        }));

      if (permissionRecords.length > 0) {
        const { error: permissionsError } = await supabase
          .from('profile_permissions')
          .insert(permissionRecords);

        if (permissionsError) throw permissionsError;
      }

      toast.success(editingProfile ? "Perfil atualizado com sucesso!" : "Perfil criado com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || "Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProfile ? "Editar Perfil" : "Novo Perfil"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="name">Nome do Perfil *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gerente de Loja"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as responsabilidades deste perfil"
                rows={3}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Permissões por Módulo</h3>
            <div className="space-y-4">
              {MODULES.map((module) => (
                <div key={module.id} className="border rounded-lg p-4">
                  <div className="mb-3">
                    <h4 className="font-medium">{module.name}</h4>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  
                  <div className="flex gap-4">
                    {PERMISSIONS.map((permission) => (
                      <div key={permission.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${module.id}-${permission.id}`}
                          checked={permissions[module.id] === permission.id}
                          onCheckedChange={() => handlePermissionChange(module.id, permission.id)}
                        />
                        <Label 
                          htmlFor={`${module.id}-${permission.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {permission.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : editingProfile ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}