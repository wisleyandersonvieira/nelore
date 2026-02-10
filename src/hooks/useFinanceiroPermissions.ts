import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FinanceiroPermissionLevel = 'none' | 'read' | 'write' | 'admin';

export function useFinanceiroPermissions() {
  const [permissionLevel, setPermissionLevel] = useState<FinanceiroPermissionLevel>('none');
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

        // Get user profile with role and profile_id
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

        // Check user-specific permissions for 'financeiro' module
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('module', 'financeiro');

        if (userPermissions && userPermissions.length > 0) {
          const permissions = userPermissions.map(p => p.permission);
          
          // Check for disabled permission first
          if (permissions.includes('disabled')) {
            console.log('Financeiro: User permission is disabled');
            setPermissionLevel('none');
            setLoading(false);
            return;
          }
          
          if (permissions.includes('admin')) {
            setPermissionLevel('admin');
            setLoading(false);
            return;
          }
          if (permissions.includes('write')) {
            setPermissionLevel('write');
            setLoading(false);
            return;
          }
          if (permissions.includes('read')) {
            setPermissionLevel('read');
            setLoading(false);
            return;
          }
        }

        // Check profile-based permissions
        if (profile?.profile_id) {
          const { data: profilePermissions } = await supabase
            .from('profile_permissions')
            .select('permission')
            .eq('profile_id', profile.profile_id)
            .eq('module', 'financeiro');

          if (profilePermissions && profilePermissions.length > 0) {
            const permissions = profilePermissions.map(p => p.permission);
            
            // Check for disabled permission first
            if (permissions.includes('disabled')) {
              console.log('Financeiro: Setting permission to NONE (disabled)');
              setPermissionLevel('none');
              setLoading(false);
              return;
            }
            
            if (permissions.includes('admin')) {
              setPermissionLevel('admin');
              setLoading(false);
              return;
            }
            if (permissions.includes('write')) {
              setPermissionLevel('write');
              setLoading(false);
              return;
            }
            if (permissions.includes('read')) {
              setPermissionLevel('read');
              setLoading(false);
              return;
            }
          }
        }

        // Default: no permission
        setPermissionLevel('none');
      } catch (error) {
        console.error('Error checking financeiro permissions:', error);
        setPermissionLevel('none');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  return {
    permissionLevel,
    loading,
    canView: permissionLevel !== 'none',
    canEdit: permissionLevel === 'write' || permissionLevel === 'admin',
    canAdmin: permissionLevel === 'admin',
  };
}
