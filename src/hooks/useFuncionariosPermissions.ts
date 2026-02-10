import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FuncionariosPermissionLevel = 'none' | 'read' | 'write';

export const useFuncionariosPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<FuncionariosPermissionLevel>('none');
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

        // Check user role and profile_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, profile_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          setPermissionLevel('none');
          setLoading(false);
          return;
        }

        // Admins have full access
        if (profile.role === 'admin') {
          setPermissionLevel('write');
          setLoading(false);
          return;
        }

        // Check profile-based permissions first
        if (profile.profile_id) {
          const { data: profilePermissions } = await supabase
            .from("profile_permissions")
            .select("permission")
            .eq("profile_id", profile.profile_id)
            .eq("module", "funcionarios");

          if (profilePermissions && profilePermissions.length > 0) {
            const perms = profilePermissions.map(p => p.permission);
            
            // Check if disabled - user should not see the module
            if (perms.includes('disabled')) {
              setPermissionLevel('none');
              setLoading(false);
              return;
            }
            if (perms.includes('write')) {
              setPermissionLevel('write');
            } else if (perms.includes('read')) {
              setPermissionLevel('read');
            } else {
              setPermissionLevel('none');
            }
            setLoading(false);
            return;
          }
        }

        // Check user-specific permissions
        const { data: userPermissions } = await supabase
          .from("user_permissions")
          .select("permission")
          .eq("user_id", user.id)
          .eq("module", "funcionarios");

        if (userPermissions && userPermissions.length > 0) {
          const perms = userPermissions.map(p => p.permission);
          if (perms.includes('disabled')) {
            setPermissionLevel('none');
          } else if (perms.includes('write')) {
            setPermissionLevel('write');
          } else if (perms.includes('read')) {
            setPermissionLevel('read');
          } else {
            setPermissionLevel('none');
          }
        } else {
          setPermissionLevel('none');
        }
      } catch (error) {
        console.error("Error checking funcionarios permissions:", error);
        setPermissionLevel('none');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const canAccess = permissionLevel !== 'none';
  const canEdit = permissionLevel === 'write';

  return {
    permissionLevel,
    loading,
    canAccess,
    canEdit,
  };
};
