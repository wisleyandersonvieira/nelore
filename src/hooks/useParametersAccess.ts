import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ParametersAccessData {
  hasAccess: boolean;
  isLoading: boolean;
  isMasterUser: boolean;
  isMatrizProfile: boolean;
}

export function useParametersAccess(): ParametersAccessData {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMasterUser, setIsMasterUser] = useState(false);
  const [isMatrizProfile, setIsMatrizProfile] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Check if master user
        const masterUser = user.email === 'wisley_anderson@hotmail.com';
        setIsMasterUser(masterUser);

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

          const isMatriz = userProfile?.name === 'Matriz';
          setIsMatrizProfile(isMatriz);
          setHasAccess(masterUser || isMatriz);
        } else {
          setHasAccess(masterUser);
        }
      } catch (error) {
        console.error('Error checking parameters access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, []);

  return { hasAccess, isLoading, isMasterUser, isMatrizProfile };
}
