import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Matrix {
  id: string;
  name: string;
  code: number;
}

interface UserMatrixData {
  matrixId: string | null;
  matrixName: string;
  matrixCode: number | null;
  isLoading: boolean;
}

export function useUserMatrix(): UserMatrixData {
  const [matrixId, setMatrixId] = useState<string | null>(null);
  const [matrixName, setMatrixName] = useState<string>("");
  const [matrixCode, setMatrixCode] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserMatrix = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('matrix_id')
          .eq('id', user.id)
          .single();

        if (profile?.matrix_id) {
          setMatrixId(profile.matrix_id);
          
          const { data: matrix } = await supabase
            .from('matrices')
            .select('id, name, code')
            .eq('id', profile.matrix_id)
            .single();

          if (matrix) {
            setMatrixName(matrix.name);
            setMatrixCode(matrix.code);
          }
        }
      } catch (error) {
        console.error('Error fetching user matrix:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserMatrix();
  }, []);

  return { matrixId, matrixName, matrixCode, isLoading };
}
