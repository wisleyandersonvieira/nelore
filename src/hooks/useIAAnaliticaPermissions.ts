import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export const useIAAnaliticaPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPermissionLevel('none');
          setIsLoading(false);
          return;
        }

        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, profile_id')
          .eq('id', user.id)
          .single();

        if (!profile) {
          setPermissionLevel('none');
          setIsLoading(false);
          return;
        }

        // Admin users have full access
        if (profile.role === 'admin') {
          setPermissionLevel('admin');
          setIsLoading(false);
          return;
        }

        // Check profile permissions for ia_analitica module
        if (profile.profile_id) {
          const { data: profilePermissions } = await supabase
            .from('profile_permissions')
            .select('permission')
            .eq('profile_id', profile.profile_id)
            .eq('module', 'ia_analitica');

          if (profilePermissions && profilePermissions.length > 0) {
            const permission = profilePermissions[0].permission;
            setPermissionLevel(permission as PermissionLevel);
            setIsLoading(false);
            return;
          }
        }

        // Check user-specific permissions
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('module', 'ia_analitica');

        if (userPermissions && userPermissions.length > 0) {
          const permission = userPermissions[0].permission;
          setPermissionLevel(permission as PermissionLevel);
          setIsLoading(false);
          return;
        }

        setPermissionLevel('none');
      } catch (error) {
        console.error('Error checking IA Analítica permissions:', error);
        setPermissionLevel('none');
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const canAccess = permissionLevel !== 'none';

  return {
    permissionLevel,
    isLoading,
    canAccess
  };
};
