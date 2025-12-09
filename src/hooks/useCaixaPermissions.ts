import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CaixaPermissionLevel = 'none' | 'read' | 'write' | 'admin';

interface CaixaPermissions {
  level: CaixaPermissionLevel;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  loading: boolean;
}

export const useCaixaPermissions = (): CaixaPermissions => {
  const [level, setLevel] = useState<CaixaPermissionLevel>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLevel('none');
        setLoading(false);
        return;
      }

      // Get user profile with role and profile_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, profile_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setLevel('none');
        setLoading(false);
        return;
      }

      // Admin role has full access
      if (profile.role === 'admin') {
        setLevel('admin');
        setLoading(false);
        return;
      }

      // Check user-specific permissions first
      const { data: userPermission } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id)
        .eq('module', 'caixa')
        .maybeSingle();

      if (userPermission) {
        setLevel(userPermission.permission as CaixaPermissionLevel);
        setLoading(false);
        return;
      }

      // Check profile-based permissions
      if (profile.profile_id) {
        const { data: profilePermission } = await supabase
          .from('profile_permissions')
          .select('permission')
          .eq('profile_id', profile.profile_id)
          .eq('module', 'caixa')
          .maybeSingle();

        if (profilePermission) {
          setLevel(profilePermission.permission as CaixaPermissionLevel);
          setLoading(false);
          return;
        }
      }

      // No permission found
      setLevel('none');
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setLevel('none');
    } finally {
      setLoading(false);
    }
  };

  return {
    level,
    canView: level === 'read' || level === 'write' || level === 'admin',
    canEdit: level === 'write' || level === 'admin',
    canApprove: level === 'admin',
    loading,
  };
};
