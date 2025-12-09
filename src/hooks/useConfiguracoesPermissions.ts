import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ConfiguracoesPermissionLevel = 'none' | 'admin';

export const useConfiguracoesPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<ConfiguracoesPermissionLevel>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPermissionLevel('none');
          setLoading(false);
          return;
        }

        // Check user role first
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, profile_id')
          .eq('id', user.id)
          .single();

        // Admin role has full access
        if (profile?.role === 'admin') {
          setPermissionLevel('admin');
          setLoading(false);
          return;
        }

        // Check profile-based permissions for 'configuracoes' module
        if (profile?.profile_id) {
          const { data: profilePermissions } = await supabase
            .from('profile_permissions')
            .select('permission')
            .eq('profile_id', profile.profile_id)
            .eq('module', 'configuracoes');

          if (profilePermissions && profilePermissions.length > 0) {
            const permission = profilePermissions[0].permission;
            // Only admin permission grants access to Configurações
            if (permission === 'admin') {
              setPermissionLevel('admin');
              setLoading(false);
              return;
            }
          }
        }

        // Check user-specific permissions
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('module', 'configuracoes');

        if (userPermissions && userPermissions.length > 0) {
          const permission = userPermissions[0].permission;
          // Only admin permission grants access to Configurações
          if (permission === 'admin') {
            setPermissionLevel('admin');
            setLoading(false);
            return;
          }
        }

        // No access for read or write permissions
        setPermissionLevel('none');
      } catch (error) {
        console.error('Error checking configuracoes permissions:', error);
        setPermissionLevel('none');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  return { permissionLevel, loading, hasAccess: permissionLevel === 'admin' };
};
