/**
 * OFX Parser for SGML format (OFXHEADER:100, VERSION:102)
 * Handles Windows-1252 charset and Brazilian bank formats
 */

export interface OFXTransaction {
  trntype: string;
  dtposted: string;
  amount: number;
  fitid: string;
  refnum: string | null;
  memo: string | null;
  name: string | null;
  raw: Record<string, string>;
}

export interface OFXParseResult {
  success: boolean;
  error?: string;
  transactions: OFXTransaction[];
  startDate: Date | null;
  endDate: Date | null;
  accountId?: string;
  bankId?: string;
}

/**
 * Normalize text from Windows-1252 encoding
 */
function normalizeText(text: string): string {
  // Common Windows-1252 to UTF-8 character replacements
  const replacements: Record<string, string> = {
    '\x91': "'",
    '\x92': "'",
    '\x93': '"',
    '\x94': '"',
    '\x96': '-',
    '\x97': '-',
    '\x85': '...',
    '\xA0': ' ',
    '\xE1': 'á',
    '\xE9': 'é',
    '\xED': 'í',
    '\xF3': 'ó',
    '\xFA': 'ú',
    '\xE3': 'ã',
    '\xF5': 'õ',
    '\xE7': 'ç',
    '\xC1': 'Á',
    '\xC9': 'É',
    '\xCD': 'Í',
    '\xD3': 'Ó',
    '\xDA': 'Ú',
    '\xC3': 'Ã',
    '\xD5': 'Õ',
    '\xC7': 'Ç',
  };

  let result = text;
  for (const [from, to] of Object.entries(replacements)) {
    result = result.replace(new RegExp(from, 'g'), to);
  }
  return result;
}

/**
 * Parse OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
 * Handles timezone suffix like [-3:BRT]
 */
function parseOFXDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Remove timezone suffix like [-3:BRT] or [0:GMT]
  const cleanDate = dateStr.replace(/\[.*\]$/, '').trim();

  if (cleanDate.length >= 14) {
    // YYYYMMDDHHMMSS format
    const year = parseInt(cleanDate.substring(0, 4), 10);
    const month = parseInt(cleanDate.substring(4, 6), 10) - 1;
    const day = parseInt(cleanDate.substring(6, 8), 10);
    const hour = parseInt(cleanDate.substring(8, 10), 10);
    const minute = parseInt(cleanDate.substring(10, 12), 10);
    const second = parseInt(cleanDate.substring(12, 14), 10);
    return new Date(year, month, day, hour, minute, second);
  } else if (cleanDate.length >= 8) {
    // YYYYMMDD format
    const year = parseInt(cleanDate.substring(0, 4), 10);
    const month = parseInt(cleanDate.substring(4, 6), 10) - 1;
    const day = parseInt(cleanDate.substring(6, 8), 10);
    return new Date(year, month, day, 0, 0, 0);
  }

  return null;
}

/**
 * Extract value from OFX SGML tag
 * Handles both <TAG>value</TAG> and <TAG>value formats
 */
function extractTagValue(content: string, tagName: string): string | null {
  // Try closing tag first: <TAG>value</TAG>
  const closingRegex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  let match = content.match(closingRegex);
  if (match) {
    return match[1].trim();
  }

  // Try open tag format: <TAG>value (followed by another tag or end)
  const openRegex = new RegExp(`<${tagName}>([^<]+)`, 'i');
  match = content.match(openRegex);
  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Parse SGML OFX content into transactions
 */
export function parseOFX(content: string): OFXParseResult {
  try {
    // Normalize encoding
    const normalizedContent = normalizeText(content);

    // Find all STMTTRN blocks
    const transactions: OFXTransaction[] = [];
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRNRS>|<\/BANKTRANLIST>|$)/gi;
    
    let match;
    while ((match = stmttrnRegex.exec(normalizedContent)) !== null) {
      const block = match[1];
      
      const trntype = extractTagValue(block, 'TRNTYPE');
      const dtposted = extractTagValue(block, 'DTPOSTED');
      const trnamt = extractTagValue(block, 'TRNAMT');
      const fitid = extractTagValue(block, 'FITID');
      const refnum = extractTagValue(block, 'REFNUM');
      const memo = extractTagValue(block, 'MEMO');
      const name = extractTagValue(block, 'NAME');

      if (trntype && dtposted && trnamt && fitid) {
        // Parse amount - handle both comma and period as decimal separator
        const cleanAmount = trnamt.replace(',', '.');
        const amount = parseFloat(cleanAmount);

        if (!isNaN(amount)) {
          transactions.push({
            trntype: trntype.toUpperCase(),
            dtposted: dtposted,
            amount: amount,
            fitid: fitid,
            refnum: refnum,
            memo: memo,
            name: name,
            raw: {
              TRNTYPE: trntype,
              DTPOSTED: dtposted,
              TRNAMT: trnamt,
              FITID: fitid,
              ...(refnum && { REFNUM: refnum }),
              ...(memo && { MEMO: memo }),
              ...(name && { NAME: name }),
            },
          });
        }
      }
    }

    if (transactions.length === 0) {
      return {
        success: false,
        error: 'Nenhuma transação encontrada no arquivo OFX',
        transactions: [],
        startDate: null,
        endDate: null,
      };
    }

    // Extract statement dates if available
    const dtstart = extractTagValue(normalizedContent, 'DTSTART');
    const dtend = extractTagValue(normalizedContent, 'DTEND');

    // Calculate date range from transactions if not available in header
    let startDate = dtstart ? parseOFXDate(dtstart) : null;
    let endDate = dtend ? parseOFXDate(dtend) : null;

    if (!startDate || !endDate) {
      const dates = transactions
        .map((t) => parseOFXDate(t.dtposted))
        .filter((d): d is Date => d !== null);

      if (dates.length > 0) {
        if (!startDate) {
          startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        }
        if (!endDate) {
          endDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        }
      }
    }

    // Extract account info if available
    const accountId = extractTagValue(normalizedContent, 'ACCTID');
    const bankId = extractTagValue(normalizedContent, 'BANKID');

    return {
      success: true,
      transactions,
      startDate,
      endDate,
      accountId: accountId || undefined,
      bankId: bankId || undefined,
    };
  } catch (error) {
    console.error('Error parsing OFX:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao processar arquivo OFX',
      transactions: [],
      startDate: null,
      endDate: null,
    };
  }
}

/**
 * Calculate file hash for duplicate detection
 */
export async function calculateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format OFX date for display
 */
export function formatOFXDate(dtposted: string): string {
  const date = parseOFXDate(dtposted);
  if (!date) return dtposted;
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Get parsed Date from OFX date string
 */
export function getDateFromOFX(dtposted: string): Date | null {
  return parseOFXDate(dtposted);
}
