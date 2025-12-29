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
    console.log('🔍 isPeriodBlocked chamada:', { dateInput, blockType, moduleId });
    
    // Tratar corretamente datas para evitar problemas de fuso horário
    let year: number;
    let month: number;
    
    if (typeof dateInput === 'string') {
      // Se é string no formato YYYY-MM-DD, extrair ano e mês diretamente
      const parts = dateInput.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      // Se é Date, usar getUTCFullYear e getUTCMonth + 1 para evitar problemas de fuso horário
      year = dateInput.getUTCFullYear();
      month = dateInput.getUTCMonth() + 1;
    }

    console.log('📅 Data processada:', { year, month });

    // Buscar store_id do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    console.log('👤 Profile do usuário:', profile);

    if (!profile?.store_id) {
      console.log('❌ Usuário sem store_id, não bloqueia');
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

    console.log('🔒 Bloqueios encontrados:', { blocks, error });

    if (error) {
      console.error("Erro ao verificar bloqueio de período:", error);
      return false; // Em caso de erro, não bloqueia
    }

    // Verificar se algum bloqueio inclui o módulo especificado
    const isBlocked = blocks?.some((block: PeriodBlock) => {
      console.log('🔍 Verificando block:', { 
        blockId: block.id, 
        blockedModules: block.blocked_modules, 
        includesModule: block.blocked_modules.includes(moduleId) 
      });
      return block.blocked_modules.includes(moduleId);
    }) || false;

    console.log('🚫 Resultado final isPeriodBlocked:', isBlocked);
    return isBlocked;

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
      year = competenceDate.getUTCFullYear();
      month = competenceDate.getUTCMonth() + 1;
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
      year = paymentDate.getUTCFullYear();
      month = paymentDate.getUTCMonth() + 1;
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
 * Verifica bloqueios para o módulo de controle de caixa
 */
export const validateCashControlPeriod = {
  /**
   * Valida se a competência não está bloqueada para cadastro
   */
  competencia: async (competenceDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(competenceDate, 'competencia', 'caixa');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof competenceDate === 'string') {
      const parts = competenceDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = competenceDate.getUTCFullYear();
      month = competenceDate.getUTCMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para cadastro de competência em Controle de Caixa.`
        : undefined
    };
  },

  /**
   * Valida se o período não está bloqueado para operações
   */
  pagamento: async (paymentDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlocked(paymentDate, 'pagamento', 'caixa');
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof paymentDate === 'string') {
      const parts = paymentDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = paymentDate.getUTCFullYear();
      month = paymentDate.getUTCMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para operações em Controle de Caixa.`
        : undefined
    };
  }
};

/**
 * Verifica bloqueios para o módulo de controle de estoque
 */
export const validateStockControlPeriod = {
  /**
   * Valida se a competência não está bloqueada para cadastro
   */
  competencia: async (competenceDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    console.log('🔍 validateStockControlPeriod.competencia chamada:', { competenceDate });
    const blocked = await isPeriodBlocked(competenceDate, 'competencia', 'estoque');
    console.log('📊 Resultado isPeriodBlocked (competencia, estoque):', { blocked });
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof competenceDate === 'string') {
      const parts = competenceDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = competenceDate.getUTCFullYear();
      month = competenceDate.getUTCMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para cadastro de competência em Controle de Estoque.`
        : undefined
    };
  },

  /**
   * Valida se o período não está bloqueado para operações
   */
  pagamento: async (paymentDate: Date | string): Promise<{ blocked: boolean; message?: string }> => {
    console.log('🔍 validateStockControlPeriod.pagamento chamada:', { paymentDate });
    const blocked = await isPeriodBlocked(paymentDate, 'pagamento', 'estoque');
    console.log('📊 Resultado isPeriodBlocked (pagamento, estoque):', { blocked });
    
    // Extrair ano e mês para mensagem
    let year: number;
    let month: number;
    
    if (typeof paymentDate === 'string') {
      const parts = paymentDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = paymentDate.getUTCFullYear();
      month = paymentDate.getUTCMonth() + 1;
    }
    
    return {
      blocked,
      message: blocked 
        ? `O período ${month}/${year} está bloqueado para operações em Controle de Estoque.`
        : undefined
    };
  }
};