/**
 * Bank Reconciliation Matching Algorithm
 * Provides automatic matching suggestions between OFX transactions and internal records
 */

import { differenceInDays, parseISO, startOfDay } from 'date-fns';

/**
 * Parse a date string from the database preserving the local date
 * Handles both ISO format (YYYY-MM-DDTHH:MM:SS) and date-only (YYYY-MM-DD)
 * Prevents timezone conversion issues
 */
export function parseDatePreservingLocal(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
  const datePart = dateStr.substring(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  
  // Create date using local timezone
  return new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid DST issues
}

export interface InternalTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: 'accounts_payable' | 'accounts_receivable' | 'transfer' | 'cash_control' | 'partner_transaction';
  table: string;
  entityName?: string;
  documentNumber?: string;
  installmentInfo?: string;
}

export interface OFXTransactionForMatch {
  id: string;
  posted_at: Date;
  amount: number;
  name: string | null;
  memo: string | null;
  trntype: string;
}

export interface MatchSuggestion {
  internalTransaction: InternalTransaction;
  score: number;
  matchRule: 'auto_exact' | 'auto_fuzzy' | 'manual';
  reasons: string[];
}

/**
 * Normalize text for comparison
 * Removes accents, special characters, and common banking terms
 */
function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Z0-9\s]/g, ' ') // Keep only alphanumeric
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Remove common banking tokens that don't help with matching
 */
function removeCommonTokens(text: string): string {
  const tokensToRemove = [
    'PIX',
    'TED',
    'DOC',
    'TRANSFERENCIA',
    'TRANSFER',
    'PAGAMENTO',
    'PAGTO',
    'PAG',
    'RECEBIMENTO',
    'RECEB',
    'DEBITO',
    'CREDITO',
    'DEBIT',
    'CREDIT',
    'OUTRA IF',
    'MESMA IF',
    'EMITIDO',
    'RECEBIDO',
    'COMPRA',
    'SAQUE',
    'DEPOSITO',
    'TARIFA',
    'IOF',
    'JUROS',
    'MULTA',
  ];

  let result = normalizeText(text);
  for (const token of tokensToRemove) {
    result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Extract significant words from text
 */
function extractSignificantWords(text: string): string[] {
  const cleaned = removeCommonTokens(text);
  return cleaned
    .split(' ')
    .filter((word) => word.length >= 3) // Only words with 3+ chars
    .filter((word) => !/^\d+$/.test(word)); // Exclude pure numbers
}

/**
 * Calculate text similarity score (0-100)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = extractSignificantWords(text1);
  const words2 = extractSignificantWords(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matchCount = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
        break;
      }
    }
  }

  const totalWords = Math.max(words1.length, words2.length);
  return Math.round((matchCount / totalWords) * 100);
}

/**
 * Check if amounts match (with tolerance for small rounding differences)
 */
function amountsMatch(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
  return Math.abs(Math.abs(amount1) - Math.abs(amount2)) <= tolerance;
}

/**
 * Check if transaction directions match
 * OFX: negative = debit (outflow), positive = credit (inflow)
 * Internal: accounts_payable = outflow, accounts_receivable = inflow
 */
function directionsMatch(ofxAmount: number, internalType: string): boolean {
  const isOfxDebit = ofxAmount < 0;
  
  const outflowTypes = ['accounts_payable', 'transfer']; // Transfers can be either way
  const inflowTypes = ['accounts_receivable', 'cash_control', 'partner_transaction'];
  
  if (isOfxDebit) {
    return outflowTypes.includes(internalType) || internalType === 'partner_transaction';
  } else {
    return inflowTypes.includes(internalType) || internalType === 'transfer';
  }
}

/**
 * Find best matches for an OFX transaction
 */
export function findMatches(
  ofxTransaction: OFXTransactionForMatch,
  internalTransactions: InternalTransaction[],
  maxDaysDifference: number = 3,
  maxSuggestions: number = 5
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];

  for (const internal of internalTransactions) {
    const reasons: string[] = [];
    let score = 0;

    // 1. Amount matching (most important)
    const amountMatches = amountsMatch(ofxTransaction.amount, internal.amount);
    const amountClose = amountsMatch(ofxTransaction.amount, internal.amount, 1.0);

    if (amountMatches) {
      score += 40;
      reasons.push('Valor exato');
    } else if (amountClose) {
      score += 20;
      reasons.push('Valor aproximado');
    } else {
      continue; // Skip if amounts don't even come close
    }

    // 2. Date proximity
    const daysDiff = Math.abs(differenceInDays(ofxTransaction.posted_at, internal.date));
    
    if (daysDiff === 0) {
      score += 30;
      reasons.push('Mesma data');
    } else if (daysDiff === 1) {
      score += 25;
      reasons.push('Diferença de 1 dia');
    } else if (daysDiff <= 3) {
      score += 15;
      reasons.push(`Diferença de ${daysDiff} dias`);
    } else if (daysDiff <= maxDaysDifference) {
      score += 5;
      reasons.push(`Diferença de ${daysDiff} dias`);
    } else {
      continue; // Skip if too far apart
    }

    // 3. Direction matching
    if (directionsMatch(ofxTransaction.amount, internal.type)) {
      score += 10;
      reasons.push('Direção compatível');
    }

    // 4. Text similarity
    const ofxText = `${ofxTransaction.name || ''} ${ofxTransaction.memo || ''}`;
    const internalText = `${internal.description} ${internal.entityName || ''}`;
    const textSimilarity = calculateTextSimilarity(ofxText, internalText);

    if (textSimilarity >= 50) {
      score += 20;
      reasons.push('Descrição semelhante');
    } else if (textSimilarity >= 30) {
      score += 10;
      reasons.push('Descrição parcialmente semelhante');
    }

    // Determine match rule based on score
    let matchRule: 'auto_exact' | 'auto_fuzzy' | 'manual';
    if (score >= 90 && amountMatches && daysDiff <= 1) {
      matchRule = 'auto_exact';
    } else if (score >= 70) {
      matchRule = 'auto_fuzzy';
    } else {
      matchRule = 'manual';
    }

    suggestions.push({
      internalTransaction: internal,
      score: Math.min(score, 100),
      matchRule,
      reasons,
    });
  }

  // Sort by score descending and limit results
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

/**
 * Format match rule for display
 */
export function formatMatchRule(rule: string): string {
  const labels: Record<string, string> = {
    auto_exact: 'Match Exato',
    auto_fuzzy: 'Match Aproximado',
    manual: 'Manual',
    not_identified: 'Não Identificado',
  };
  return labels[rule] || rule;
}

/**
 * Get score color class
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600 bg-green-50';
  if (score >= 70) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-600 bg-gray-50';
}
