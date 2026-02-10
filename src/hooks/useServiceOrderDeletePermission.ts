import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DeletePermissionData {
  canDelete: boolean;
  isLoading: boolean;
}

export function useServiceOrderDeletePermission(): DeletePermissionData {
  const [canDelete, setCanDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Check if master user
        const isMasterUser = user.email === 'wisley_anderson@hotmail.com';
        if (isMasterUser) {
          setCanDelete(true);
          setIsLoading(false);
          return;
        }

        // Check if user has Matriz profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_id')
          .eq('id', user.id)
          .single();

        if (profile?.profile_id) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('name')
            .eq('id', profile.profile_id)
            .single();

          const isMatrizProfile = userProfile?.name === 'Matriz';
          setCanDelete(isMatrizProfile);
        } else {
          setCanDelete(false);
        }
      } catch (error) {
        console.error('Error checking delete permission:', error);
        setCanDelete(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, []);

  return { canDelete, isLoading };
}
