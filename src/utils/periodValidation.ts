import { supabase } from "@/integrations/supabase/client";

interface PeriodBlock {
  id: string;
  store_id: string;
  year: number;
  month: number;
  block_type: 'competencia' | 'pagamento';
  blocked_modules: string[];
}

/**
 * Verifica se um período está bloqueado para um módulo específico
 * @param date Data a ser verificada
 * @param blockType Tipo de bloqueio ('competencia' ou 'pagamento')
 * @param moduleId ID do módulo (ex: 'contas_pagar')
 * @returns Promise<boolean> true se estiver bloqueado, false caso contrário
 */
export const isPeriodBlocked = async (
  date: Date,
  blockType: 'competencia' | 'pagamento',
  moduleId: string
): Promise<boolean> => {
  try {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() retorna 0-11, precisamos 1-12

    // Buscar store_id do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.store_id) {
      return false; // Se não tem store_id, não bloqueia
    }

    // Verificar se existe bloqueio para o período
    const { data: blocks, error } = await supabase
      .from("period_blocks")
      .select("*")
      .eq("store_id", profile.store_id)
      .eq("year", year)
      .eq("month", month)
      .eq("block_type", blockType);

    if (error) {
      console.error("Erro ao verificar bloqueio de período:", error);
      return false; // Em caso de erro, não bloqueia
    }

    // Verificar se algum bloqueio inclui o módulo especificado
    return blocks?.some((block: PeriodBlock) => 
      block.blocked_modules.includes(moduleId)
    ) || false;

  } catch (error) {
    console.error("Erro ao verificar bloqueio de período:", error);
    return false; // Em caso de erro, não bloqueia
  }
};

/**
 * Verifica bloqueios para o módulo de contas a pagar
 */
export const validateAccountsPayablePeriod = {
  /**
   * Valida se a competência não está bloqueada para cadastro
   */
  competencia: async (competenceDate: Date): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(competenceDate, 'competencia', 'contas_pagar');
    return {
      blocked,
      message: blocked 
        ? `O período ${competenceDate.getMonth() + 1}/${competenceDate.getFullYear()} está bloqueado para cadastro de competência em Contas a Pagar.`
        : undefined
    };
  },

  /**
   * Valida se o pagamento não está bloqueado
   */
  pagamento: async (paymentDate: Date): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(paymentDate, 'pagamento', 'contas_pagar');
    return {
      blocked,
      message: blocked 
        ? `O período ${paymentDate.getMonth() + 1}/${paymentDate.getFullYear()} está bloqueado para pagamentos em Contas a Pagar.`
        : undefined
    };
  }
};