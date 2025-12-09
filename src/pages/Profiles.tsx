import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProfileModal } from "@/components/ProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useConfiguracoesPermissions } from "@/hooks/useConfiguracoesPermissions";

interface UserProfile {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  profile_permissions: Array<{
    module: string;
    permission: string;
  }>;
}

export default function Profiles() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const { hasAccess, loading: permissionsLoading } = useConfiguracoesPermissions();

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          profile_permissions (
            module,
            permission
          )
        `)
        .order('name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      toast.error("Erro ao carregar perfis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleEdit = (profile: UserProfile) => {
    setEditingProfile(profile);
    setShowModal(true);
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("Tem certeza que deseja excluir este perfil?")) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      
      toast.success("Perfil excluído com sucesso!");
      fetchProfiles();
    } catch (error: any) {
      console.error('Error deleting profile:', error);
      toast.error("Erro ao excluir perfil");
    }
  };

  const getPermissionsBadges = (permissions: Array<{module: string; permission: string}>) => {
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.permission]) {
        acc[perm.permission] = [];
      }
      acc[perm.permission].push(perm.module);
      return acc;
    }, {} as Record<string, string[]>);

    const badges = [];
    if (groupedPermissions['admin']?.length > 0) {
      badges.push(
        <Badge key="admin" variant="destructive" className="text-xs">
          Admin ({groupedPermissions['admin'].length} módulos)
        </Badge>
      );
    }
    if (groupedPermissions['write']?.length > 0) {
      badges.push(
        <Badge key="write" variant="default" className="text-xs">
          Editar ({groupedPermissions['write'].length} módulos)
        </Badge>
      );
    }
    if (groupedPermissions['read']?.length > 0) {
      badges.push(
        <Badge key="read" variant="secondary" className="text-xs">
          Visualizar ({groupedPermissions['read'].length} módulos)
        </Badge>
      );
    }

    return badges;
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <ShieldAlert className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-semibold">Acesso Negado</h2>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar o módulo de Configurações.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/users')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Gestão de Perfis</h1>
              <p className="text-muted-foreground">Configure perfis de usuário e suas permissões</p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => {
            setEditingProfile(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfis Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os perfis de usuário e suas permissões de acesso aos módulos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell>{profile.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {getPermissionsBadges(profile.profile_permissions)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? "default" : "secondary"}>
                      {profile.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(profile)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(profile.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {profiles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum perfil cadastrado. Clique em "Novo Perfil" para criar o primeiro.
            </div>
          )}
        </CardContent>
      </Card>

      <ProfileModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchProfiles}
        editingProfile={editingProfile}
      />
    </div>
  );
}