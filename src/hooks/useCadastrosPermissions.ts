import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CadastrosPermissionLevel = 'none' | 'read' | 'write' | 'admin';

export const useCadastrosPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<CadastrosPermissionLevel>('none');
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

        // Check user role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, profile_id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setPermissionLevel('none');
          setLoading(false);
          return;
        }

        // Admins have full access
        if (profile.role === 'admin') {
          setPermissionLevel('admin');
          setLoading(false);
          return;
        }

        // Check profile-based permissions first
        if (profile.profile_id) {
          const { data: profilePermissions } = await supabase
            .from("profile_permissions")
            .select("permission")
            .eq("profile_id", profile.profile_id)
            .eq("module", "cadastros");

          if (profilePermissions && profilePermissions.length > 0) {
            const perms = profilePermissions.map(p => p.permission);
            if (perms.includes('admin')) {
              setPermissionLevel('admin');
            } else if (perms.includes('write')) {
              setPermissionLevel('write');
            } else if (perms.includes('read')) {
              setPermissionLevel('read');
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
          .eq("module", "cadastros");

        if (userPermissions && userPermissions.length > 0) {
          const perms = userPermissions.map(p => p.permission);
          if (perms.includes('admin')) {
            setPermissionLevel('admin');
          } else if (perms.includes('write')) {
            setPermissionLevel('write');
          } else if (perms.includes('read')) {
            setPermissionLevel('read');
          }
        } else {
          setPermissionLevel('none');
        }
      } catch (error) {
        console.error("Error checking cadastros permissions:", error);
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
    canAccess: permissionLevel !== 'none', // Can see menus
    canEdit: permissionLevel === 'write' || permissionLevel === 'admin', // Can create/edit
    canDelete: permissionLevel === 'admin', // Only admin can delete
    canAccessParameters: permissionLevel === 'admin', // Only admin can access Parameters
    canAccessStores: permissionLevel === 'admin', // Only admin can access Stores
  };
};
