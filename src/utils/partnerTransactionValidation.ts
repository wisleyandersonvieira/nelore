import { supabase } from "@/integrations/supabase/client";

interface PeriodBlock {
  id: string;
  matrix_id: string;
  year: number;
  month: number;
  block_type: 'competencia' | 'pagamento';
  blocked_modules: string[];
}

/**
 * Verifica se um período está bloqueado para a matriz de uma loja específica
 */
const isPeriodBlockedByStore = async (
  dateInput: Date | string,
  blockType: 'competencia' | 'pagamento',
  moduleId: string,
  storeId: string
): Promise<boolean> => {
  try {
    console.log('🔍 isPeriodBlockedByStore chamada:', { dateInput, blockType, moduleId, storeId });
    
    // Extrair ano e mês da data
    let year: number;
    let month: number;
    
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = dateInput.getUTCFullYear();
      month = dateInput.getUTCMonth() + 1;
    }

    console.log('📅 Data processada:', { year, month });

    // Buscar matrix_id da loja selecionada
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("matrix_id")
      .eq("id", storeId)
      .single();

    if (storeError || !store?.matrix_id) {
      console.log('❌ Loja não encontrada ou sem matrix_id:', storeError);
      return false;
    }

    console.log('🏪 Matrix da loja:', store.matrix_id);

    // Verificar se existe bloqueio para o período na matriz da loja
    const { data: blocks, error } = await supabase
      .from("period_blocks")
      .select("*")
      .eq("matrix_id", store.matrix_id)
      .eq("year", year)
      .eq("month", month)
      .eq("block_type", blockType);

    console.log('🔒 Bloqueios encontrados:', { blocks, error });

    if (error) {
      console.error("Erro ao verificar bloqueio de período:", error);
      return false;
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

    console.log('🚫 Resultado final isPeriodBlockedByStore:', isBlocked);
    return isBlocked;

  } catch (error) {
    console.error("Erro ao verificar bloqueio de período:", error);
    return false;
  }
};

/**
 * Verifica bloqueios para o módulo de Aportes e Retiradas
 * @param storeId ID da loja para verificar a matriz
 */
export const validatePartnerTransactionPeriod = {
  /**
   * Valida se a competência não está bloqueada para cadastro
   */
  competencia: async (competenceDate: Date | string, storeId: string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlockedByStore(competenceDate, 'competencia', 'aportes_retiradas', storeId);
    
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
        ? `O período ${month}/${year} está bloqueado para cadastro de competência em Aportes e Retiradas.`
        : undefined
    };
  },

  /**
   * Valida se o pagamento não está bloqueado
   */
  pagamento: async (paymentDate: Date | string, storeId: string): Promise<{ blocked: boolean; message?: string }> => {
    const blocked = await isPeriodBlockedByStore(paymentDate, 'pagamento', 'aportes_retiradas', storeId);
    
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
        ? `O período ${month}/${year} está bloqueado para pagamentos em Aportes e Retiradas.`
        : undefined
    };
  }
};
