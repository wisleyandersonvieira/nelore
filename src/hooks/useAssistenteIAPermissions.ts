import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AssistenteIAPermissionLevel = 'none' | 'admin';

export const useAssistenteIAPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<AssistenteIAPermissionLevel>('none');
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

        // Verificar role do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, profile_id, is_active')
          .eq('id', user.id)
          .single();

        if (!profile || !profile.is_active) {
          setPermissionLevel('none');
          setLoading(false);
          return;
        }

        // Admin tem acesso total
        if (profile.role === 'admin') {
          setPermissionLevel('admin');
          setLoading(false);
          return;
        }

        // Verificar permissões do perfil
        if (profile.profile_id) {
          const { data: profilePermissions } = await supabase
            .from('profile_permissions')
            .select('permission')
            .eq('profile_id', profile.profile_id)
            .eq('module', 'assistente_ia')
            .single();

          if (profilePermissions?.permission === 'admin') {
            setPermissionLevel('admin');
            setLoading(false);
            return;
          }
        }

        // Verificar permissões específicas do usuário
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('module', 'assistente_ia')
          .single();

        if (userPermissions?.permission === 'admin') {
          setPermissionLevel('admin');
          setLoading(false);
          return;
        }

        setPermissionLevel('none');
      } catch (error) {
        console.error('Error checking assistente_ia permissions:', error);
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
    canAccess: permissionLevel === 'admin'
  };
};
