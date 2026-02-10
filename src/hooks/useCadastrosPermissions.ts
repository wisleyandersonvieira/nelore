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
          setPermissionLevel('admin');
          setLoading(false);
          return;
        }

        // Check profile-based permissions first
        if (profile.profile_id) {
          const { data: profilePermissions, error: permError } = await supabase
            .from("profile_permissions")
            .select("permission")
            .eq("profile_id", profile.profile_id)
            .eq("module", "cadastros");

          console.log('Cadastros Permission Check:', { 
            userId: user.id,
            userEmail: user.email,
            profileRole: profile.role,
            profileId: profile.profile_id, 
            profilePermissions, 
            permError 
          });

          if (profilePermissions && profilePermissions.length > 0) {
            const perms = profilePermissions.map(p => p.permission);
            console.log('Cadastros Permissions Found:', perms);
            
            // Check if disabled - user should not see the module
            if (perms.includes('disabled')) {
              console.log('Setting permission to NONE (disabled)');
              setPermissionLevel('none');
              setLoading(false);
              return;
            }
            if (perms.includes('admin')) {
              console.log('Setting permission to ADMIN');
              setPermissionLevel('admin');
            } else if (perms.includes('write')) {
              console.log('Setting permission to WRITE');
              setPermissionLevel('write');
            } else if (perms.includes('read')) {
              console.log('Setting permission to READ');
              setPermissionLevel('read');
            } else {
              console.log('Setting permission to NONE (no match)');
              // No recognized permission, set to none
              setPermissionLevel('none');
            }
            setLoading(false);
            return;
          } else {
            console.log('No profile permissions found for cadastros');
          }
        } else {
          console.log('No profile_id found for user');
        }

        // Check user-specific permissions
        const { data: userPermissions } = await supabase
          .from("user_permissions")
          .select("permission")
          .eq("user_id", user.id)
          .eq("module", "cadastros");

        if (userPermissions && userPermissions.length > 0) {
          const perms = userPermissions.map(p => p.permission);
          // Check if disabled - user should not see the module
          if (perms.includes('disabled')) {
            setPermissionLevel('none');
          } else if (perms.includes('admin')) {
            setPermissionLevel('admin');
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
        console.error("Error checking cadastros permissions:", error);
        setPermissionLevel('none');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const canEdit = permissionLevel === 'write' || permissionLevel === 'admin';
  const canDelete = permissionLevel === 'admin';
  
  // Debug: log the actual values being returned
  console.log('useCadastrosPermissions RETURN:', { 
    permissionLevel, 
    loading, 
    canEdit, 
    canDelete 
  });

  return {
    permissionLevel,
    loading,
    canAccess: permissionLevel !== 'none', // Can see menus
    canEdit, // Can create/edit
    canDelete, // Only admin can delete
    canAccessParameters: permissionLevel === 'admin', // Only admin can access Parameters
    canAccessStores: permissionLevel === 'admin', // Only admin can access Stores
  };
};
