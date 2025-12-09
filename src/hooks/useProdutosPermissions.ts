import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export const useProdutosPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissionLevel('none');
        setLoading(false);
        return;
      }

      // Check user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, profile_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        setPermissionLevel('admin');
        setLoading(false);
        return;
      }

      // Check user-specific permissions for 'produtos' module
      const { data: userPermission } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id)
        .eq('module', 'produtos')
        .single();

      if (userPermission) {
        setPermissionLevel(userPermission.permission as PermissionLevel);
        setLoading(false);
        return;
      }

      // Check profile-based permissions
      if (profile?.profile_id) {
        const { data: profilePermission } = await supabase
          .from('profile_permissions')
          .select('permission')
          .eq('profile_id', profile.profile_id)
          .eq('module', 'produtos')
          .single();

        if (profilePermission) {
          setPermissionLevel(profilePermission.permission as PermissionLevel);
          setLoading(false);
          return;
        }
      }

      // Default: no permission
      setPermissionLevel('none');
    } catch (error) {
      console.error('Error checking produtos permissions:', error);
      setPermissionLevel('none');
    } finally {
      setLoading(false);
    }
  };

  return {
    permissionLevel,
    loading,
    canView: permissionLevel !== 'none',
    canEdit: permissionLevel === 'write' || permissionLevel === 'admin',
    canDelete: permissionLevel === 'admin',
  };
};
