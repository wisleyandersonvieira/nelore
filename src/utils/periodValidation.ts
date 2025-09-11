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
 * @param dateInput Data a ser verificada (Date ou string no formato YYYY-MM-DD)
 * @param blockType Tipo de bloqueio ('competencia' ou 'pagamento')
 * @param moduleId ID do módulo (ex: 'contas_pagar')
 * @returns Promise<boolean> true se estiver bloqueado, false caso contrário
 */
export const isPeriodBlocked = async (
  dateInput: Date | string,
  blockType: 'competencia' | 'pagamento',
  moduleId: string
): Promise<boolean> => {
  try {
    // Tratar corretamente datas para evitar problemas de fuso horário
    let year: number;
    let month: number;
    
    if (typeof dateInput === 'string') {
      // Se é string no formato YYYY-MM-DD, extrair ano e mês diretamente
      const parts = dateInput.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      // Se é Date, usar getFullYear e getMonth + 1
      year = dateInput.getFullYear();
      month = dateInput.getMonth() + 1;
    }

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
  competencia: async (competenceDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(competenceDate, 'competencia', 'contas_pagar');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof competenceDate === 'string') {
      const parts = competenceDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = competenceDate.getFullYear();
      month = competenceDate.getMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para cadastro de competência em Contas a Pagar.`
        : undefined
    };
  },

  /**
   * Valida se o pagamento não está bloqueado
   */
  pagamento: async (paymentDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(paymentDate, 'pagamento', 'contas_pagar');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof paymentDate === 'string') {
      const parts = paymentDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = paymentDate.getFullYear();
      month = paymentDate.getMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para pagamentos em Contas a Pagar.`
        : undefined
    };
  }
};

/**
 * Verifica bloqueios para o módulo de contas a receber
 */
export const validateAccountsReceivablePeriod = {
  /**
   * Valida se a competência não está bloqueada para cadastro
   */
  competencia: async (competenceDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(competenceDate, 'competencia', 'contas_receber');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof competenceDate === 'string') {
      const parts = competenceDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = competenceDate.getFullYear();
      month = competenceDate.getMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para cadastro de competência em Contas a Receber.`
        : undefined
    };
  },

  /**
   * Valida se o recebimento não está bloqueado
   */
  pagamento: async (paymentDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(paymentDate, 'pagamento', 'contas_receber');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof paymentDate === 'string') {
      const parts = paymentDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = paymentDate.getFullYear();
      month = paymentDate.getMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para recebimentos em Contas a Receber.`
        : undefined
    };
  }
};