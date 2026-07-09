import jsPDF from "jspdf";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const REPORT_LOGO_URL =
  "https://yfhuhbnosohfayyyvbro.supabase.co/storage/v1/object/public/attachments/Logo%20EliteBov.png";

export type PdfRgbColor = [number, number, number];

/**
 * Paleta institucional do EliteBov (navy + dourado), derivada da identidade
 * visual do sistema (barra lateral navy #222935 + dourado #D2AC6A, fundo
 * off-white). Centraliza as cores para todos os relatórios em PDF.
 */
export const REPORT_COLORS = {
  navy: [34, 41, 53] as PdfRgbColor,
  navyDark: [26, 32, 42] as PdfRgbColor,
  gold: [210, 172, 106] as PdfRgbColor,
  goldSoft: [245, 237, 222] as PdfRgbColor,
  steel: [56, 85, 117] as PdfRgbColor,
  cream: [248, 245, 242] as PdfRgbColor,
  cardBg: [252, 250, 247] as PdfRgbColor,
  textPrimary: [26, 32, 45] as PdfRgbColor,
  textMuted: [95, 103, 119] as PdfRgbColor,
  border: [224, 217, 210] as PdfRgbColor,
  zebra: [246, 243, 240] as PdfRgbColor,
  headText: [248, 250, 252] as PdfRgbColor,
  success: [75, 139, 124] as PdfRgbColor,
  danger: [206, 68, 51] as PdfRgbColor,
  white: [255, 255, 255] as PdfRgbColor,
};

const MARGIN_X = 12;
const HEADER_TOP = 8;
const HEADER_HEIGHT = 26;
const HEADER_BOTTOM = HEADER_TOP + HEADER_HEIGHT; // 34

let reportLogoPromise: Promise<string | null> | null = null;
let companyNamePromise: Promise<string | null> | null = null;

interface ReportFilterItem {
  label: string;
  value: string;
}

export type SummaryCardTone = "default" | "primary" | "gold" | "success" | "danger";

export interface PdfSummaryCard {
  label: string;
  value: string;
  tone?: SummaryCardTone;
}

type ReportSummaryCard = PdfSummaryCard;

interface PdfReportLayoutOptions {
  title: string;
  subtitle?: string;
  emittedAt?: Date;
  /** Retrocompat: exibido como um card "Total de registros" caso summaryCards não seja informado. */
  totalRecords?: number;
  filters?: ReportFilterItem[];
  summaryCards?: ReportSummaryCard[];
  systemName?: string;
  /** Nome da empresa/fazenda (matriz). Se omitido, é carregado automaticamente. */
  companyName?: string;
}

export interface TotalizerItem {
  label: string;
  value: string;
  /** Item de destaque principal (valor grande em dourado). */
  emphasis?: boolean;
}

interface PdfReportLayout {
  startY: number;
  tableMargin: { top: number; right: number; bottom: number; left: number };
  willDrawPage: (data: { pageNumber: number }) => void;
  /** Estilos padrão para autoTable (theme, styles, headStyles, bodyStyles, alternateRowStyles). */
  tableStyles: (overrides?: Record<string, any>) => Record<string, any>;
  /** Desenha o bloco de total geral em destaque ao final da tabela. Retorna o Y final. */
  drawTotalizer: (finalY: number, items: TotalizerItem[]) => number;
  finalize: () => void;
}

/* ----------------------------- Status helpers ----------------------------- */

const STATUS_ROW_WHITE: PdfRgbColor = [255, 255, 255];
const STATUS_ROW_GREEN: PdfRgbColor = [236, 253, 245];
const STATUS_ROW_RED: PdfRgbColor = [254, 242, 242];

const normalizeStatusValue = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export const getSoftStatusRowFillColor = (status: string | null | undefined): PdfRgbColor => {
  const normalized = normalizeStatusValue(status);

  if (
    normalized.includes("natimorto") ||
    normalized.includes("stillborn") ||
    normalized === "finalized_stillborn"
  ) {
    return STATUS_ROW_RED;
  }

  if (
    normalized === "in_progress" ||
    normalized.includes("em andamento") ||
    normalized.includes("andamento")
  ) {
    return STATUS_ROW_WHITE;
  }

  if (
    normalized.includes("finalizado") ||
    normalized === "finalized" ||
    normalized === "sold" ||
    normalized.includes("vendido")
  ) {
    return STATUS_ROW_GREEN;
  }

  return STATUS_ROW_WHITE;
};

/* ------------------------------ Vínculo badges ---------------------------- */

export interface VinculoBadge {
  label: string;
  /** Cor forte (texto). */
  color: PdfRgbColor;
  /** Cor suave (fundo do tag). */
  soft: PdfRgbColor;
}

/**
 * Mapeia um tipo de vínculo (Animal, Prenhez, Aspiração, Sêmen, Receptora,
 * Pós TE, Outro) para um badge/tag colorido, usado nos relatórios com vínculo.
 */
export const getVinculoBadge = (type: string | null | undefined): VinculoBadge => {
  const normalized = normalizeStatusValue(type).replace(/:$/, "").trim();

  if (normalized.includes("animal")) {
    return { label: "ANIMAL", color: [42, 92, 130], soft: [225, 236, 244] };
  }
  if (normalized.includes("prenhez") || normalized.includes("gestac")) {
    return { label: "PRENHEZ", color: [46, 104, 90], soft: [223, 240, 234] };
  }
  if (normalized.includes("aspirac")) {
    return { label: "ASPIRAÇÃO", color: [150, 110, 40], soft: REPORT_COLORS.goldSoft };
  }
  if (normalized.includes("semen") || normalized.includes("sêmen")) {
    return { label: "SÊMEN", color: [168, 78, 62], soft: [246, 228, 224] };
  }
  if (normalized.includes("receptora")) {
    return { label: "RECEPTORA", color: [78, 88, 110], soft: [232, 235, 242] };
  }
  if (normalized.includes("pos te") || normalized.includes("pós te")) {
    return { label: "PÓS TE", color: [110, 84, 140], soft: [235, 228, 244] };
  }

  const upper = (type || "OUTRO").replace(/:$/, "").trim().toUpperCase();
  return { label: upper || "OUTRO", color: [90, 98, 114], soft: [235, 236, 240] };
};

/* -------------------------------- Assets ---------------------------------- */

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível converter a logo para data URL"));
    reader.readAsDataURL(blob);
  });

export const loadPdfReportLogo = async () => {
  if (!reportLogoPromise) {
    reportLogoPromise = fetch(REPORT_LOGO_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar a logo do relatório");
        const blob = await response.blob();
        return blobToDataUrl(blob);
      })
      .catch((error) => {
        console.error("Error loading report logo:", error);
        return null;
      });
  }

  return reportLogoPromise;
};

/** Carrega o nome da empresa/matriz do usuário logado (cacheado por sessão). */
export const loadReportCompanyName = async (): Promise<string | null> => {
  if (!companyNamePromise) {
    companyNamePromise = (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("matrix_id")
          .eq("id", user.id)
          .single();
        if (!profile?.matrix_id) return null;
        const { data: matrix } = await supabase
          .from("matrices")
          .select("name")
          .eq("id", profile.matrix_id)
          .single();
        return matrix?.name || null;
      } catch (error) {
        console.error("Error loading report company name:", error);
        return null;
      }
    })();
  }
  return companyNamePromise;
};

/* -------------------------------- Drawing --------------------------------- */

const drawLogo = (doc: jsPDF, logoDataUrl: string | null, x: number, y: number, width: number, height: number) => {
  if (!logoDataUrl) return;
  try {
    doc.addImage(logoDataUrl, "PNG", x, y, width, height, undefined, "FAST");
  } catch (error) {
    console.error("Error adding report logo to PDF:", error);
  }
};

const drawHeader = (
  doc: jsPDF,
  options: PdfReportLayoutOptions,
  logoDataUrl: string | null,
  companyName: string | null,
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bandWidth = pageWidth - MARGIN_X * 2;
  const system = options.systemName || "EliteBov";

  // Faixa navy principal
  doc.setFillColor(...REPORT_COLORS.navy);
  doc.roundedRect(MARGIN_X, HEADER_TOP, bandWidth, HEADER_HEIGHT, 3, 3, "F");

  // Faixa dourada de acento na base da banda
  doc.setFillColor(...REPORT_COLORS.gold);
  doc.rect(MARGIN_X + 3, HEADER_TOP + HEADER_HEIGHT - 2.2, bandWidth - 6, 1.4, "F");

  // Logo em selo claro para contraste sobre o navy
  const logoBoxX = MARGIN_X + 4;
  const logoBoxY = HEADER_TOP + 3.5;
  if (logoDataUrl) {
    doc.setFillColor(...REPORT_COLORS.white);
    doc.roundedRect(logoBoxX, logoBoxY, 22, 17, 2, 2, "F");
    drawLogo(doc, logoDataUrl, logoBoxX + 1.5, logoBoxY + 1.5, 19, 14);
  }

  const textX = logoDataUrl ? logoBoxX + 28 : MARGIN_X + 6;

  // Título do relatório
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...REPORT_COLORS.white);
  doc.text(options.title, textX, HEADER_TOP + 9);

  // Subtítulo
  let subY = HEADER_TOP + 14.5;
  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_COLORS.goldSoft);
    doc.text(options.subtitle, textX, subY);
    subY += 5;
  }

  // Sistema · Empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...REPORT_COLORS.gold);
  const brandLine = companyName ? `${system}  ·  ${companyName}` : system;
  doc.text(brandLine, textX, options.subtitle ? subY : HEADER_TOP + 15.5);

  // Bloco "Emitido em" à direita
  const rightX = pageWidth - MARGIN_X - 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...REPORT_COLORS.goldSoft);
  doc.text("EMITIDO EM", rightX, HEADER_TOP + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...REPORT_COLORS.white);
  doc.text(format(options.emittedAt || new Date(), "dd/MM/yyyy HH:mm"), rightX, HEADER_TOP + 13.5, {
    align: "right",
  });

  return HEADER_BOTTOM;
};

const toneColors = (tone: SummaryCardTone | undefined): PdfRgbColor => {
  switch (tone) {
    case "primary":
      return REPORT_COLORS.steel;
    case "gold":
      return [150, 110, 40];
    case "success":
      return REPORT_COLORS.success;
    case "danger":
      return REPORT_COLORS.danger;
    default:
      return REPORT_COLORS.navy;
  }
};

/**
 * Escreve o texto reduzindo a fonte até caber em maxWidth (nunca trunca o valor).
 * Essencial para valores monetários longos como "R$ 1.234.567,89".
 */
const drawFittedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  minSize = 6.5,
  align: "left" | "right" = "left",
) => {
  let size = startSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.text(text, x, y, align === "right" ? { align: "right" } : undefined);
};

const drawSummaryCards = (doc: jsPDF, cards: ReportSummaryCard[], startY: number): number => {
  if (cards.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;
  const gap = 4;
  // Em paisagem cabem mais cards por linha; em retrato mantém linhas equilibradas.
  const isWide = contentWidth >= 200;
  const perRow = isWide ? Math.min(cards.length, 6) : cards.length <= 4 ? cards.length : 3;
  const rows = Math.ceil(cards.length / perRow);
  const cardWidth = (contentWidth - gap * (perRow - 1)) / perRow;
  const cardHeight = 17;

  cards.forEach((card, index) => {
    const rowIndex = Math.floor(index / perRow);
    const colIndex = index % perRow;
    // Última linha pode ter menos cards: mantém a mesma largura, alinhado à esquerda
    const x = MARGIN_X + colIndex * (cardWidth + gap);
    const y = startY + rowIndex * (cardHeight + gap);

    doc.setFillColor(...REPORT_COLORS.cardBg);
    doc.setDrawColor(...REPORT_COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, "FD");

    // Acento dourado à esquerda do card
    doc.setFillColor(...REPORT_COLORS.gold);
    doc.rect(x, y + 2.5, 1.4, cardHeight - 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...REPORT_COLORS.textMuted);
    drawFittedText(doc, card.label.toUpperCase(), x + 5, y + 6, cardWidth - 8, 6.8, 5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...toneColors(card.tone));
    drawFittedText(doc, card.value, x + 5, y + 12.8, cardWidth - 8, 13, 7);
  });

  return startY + rows * cardHeight + (rows - 1) * gap;
};

const drawFilterChips = (doc: jsPDF, filters: ReportFilterItem[], startY: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;

  // Rótulo da seção
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...REPORT_COLORS.textMuted);
  doc.text("FILTROS APLICADOS", MARGIN_X, startY + 3);

  const chipsTop = startY + 5.5;

  if (!filters.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...REPORT_COLORS.textMuted);
    doc.text("Sem filtros aplicados", MARGIN_X, chipsTop + 4);
    return chipsTop + 8;
  }

  const chipH = 6;
  const chipGap = 3;
  const padX = 3;
  const lineGap = 2.5;
  let x = MARGIN_X;
  let y = chipsTop;

  doc.setFontSize(8);
  filters.forEach((filter) => {
    const labelText = `${filter.label}: `;
    const valueText = filter.value;
    doc.setFont("helvetica", "bold");
    const labelW = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    const valueW = doc.getTextWidth(valueText);
    const chipW = labelW + valueW + padX * 2;

    if (x + chipW > MARGIN_X + contentWidth && x > MARGIN_X) {
      x = MARGIN_X;
      y += chipH + chipGap;
    }

    doc.setFillColor(...REPORT_COLORS.goldSoft);
    doc.setDrawColor(...REPORT_COLORS.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, chipW, chipH, 1.6, 1.6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...REPORT_COLORS.navy);
    doc.text(labelText, x + padX, y + 4.1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...REPORT_COLORS.textPrimary);
    doc.text(valueText, x + padX + labelW, y + 4.1);

    x += chipW + chipGap;
  });

  return y + chipH + lineGap;
};

const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number, systemName: string, companyName: string | null) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;

  doc.setDrawColor(...REPORT_COLORS.gold);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, pageHeight - 12, pageWidth - MARGIN_X, pageHeight - 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...REPORT_COLORS.navy);
  doc.text(systemName, MARGIN_X, footerY);

  if (companyName) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...REPORT_COLORS.textMuted);
    const systemW = doc.getTextWidth(systemName);
    doc.text(`  ·  ${companyName}`, MARGIN_X + systemW, footerY);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...REPORT_COLORS.textMuted);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - MARGIN_X, footerY, { align: "right" });
};

const drawTotalizerBlock = (
  doc: jsPDF,
  layout: { willDrawPage: (d: { pageNumber: number }) => void; tableMargin: { top: number } },
  finalY: number,
  items: TotalizerItem[],
): number => {
  if (!items.length) return finalY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;
  const blockHeight = 18;

  let y = finalY + 5;
  // Garante que o totalizador não seja cortado no rodapé
  if (y + blockHeight > pageHeight - 16) {
    doc.addPage();
    layout.willDrawPage({ pageNumber: doc.getNumberOfPages() });
    y = layout.tableMargin.top;
  }

  doc.setFillColor(...REPORT_COLORS.navy);
  doc.roundedRect(MARGIN_X, y, contentWidth, blockHeight, 3, 3, "F");
  doc.setFillColor(...REPORT_COLORS.gold);
  doc.rect(MARGIN_X, y + 3, 1.8, blockHeight - 6, "F");

  const emphasis = items.find((item) => item.emphasis) || items[0];
  const others = items.filter((item) => item !== emphasis).slice(0, 3);

  const colWidth = 42;
  const rightEdge = pageWidth - MARGIN_X - 6;
  // Largura disponível para o valor principal, sem invadir os itens secundários
  const emphasisMaxWidth = contentWidth - 12 - others.length * colWidth;

  // Item principal (esquerda)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...REPORT_COLORS.goldSoft);
  drawFittedText(doc, emphasis.label.toUpperCase(), MARGIN_X + 6, y + 6.5, emphasisMaxWidth, 7.5, 5.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...REPORT_COLORS.gold);
  drawFittedText(doc, emphasis.value, MARGIN_X + 6, y + 13.5, emphasisMaxWidth, 15, 8);

  // Itens secundários (direita, em colunas)
  others.forEach((item, index) => {
    const colX = rightEdge - (others.length - 1 - index) * colWidth;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...REPORT_COLORS.goldSoft);
    drawFittedText(doc, item.label.toUpperCase(), colX, y + 7, colWidth - 4, 7, 5.5, "right");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...REPORT_COLORS.white);
    drawFittedText(doc, item.value, colX, y + 13, colWidth - 4, 11, 7, "right");
  });

  return y + blockHeight;
};

/* ------------------------------- Table theme ------------------------------ */

const buildTableStyles = (overrides: Record<string, any> = {}): Record<string, any> => {
  const { styles, headStyles, bodyStyles, alternateRowStyles, ...rest } = overrides;
  return {
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: REPORT_COLORS.textPrimary,
      lineColor: [230, 226, 220],
      lineWidth: 0.15,
      cellPadding: { top: 2.6, right: 3, bottom: 2.6, left: 3 },
      overflow: "linebreak",
      valign: "middle",
      ...(styles || {}),
    },
    headStyles: {
      fillColor: REPORT_COLORS.navy,
      textColor: REPORT_COLORS.headText,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineWidth: 0.1,
      lineColor: REPORT_COLORS.navy,
      ...(headStyles || {}),
    },
    bodyStyles: {
      minCellHeight: 7.5,
      ...(bodyStyles || {}),
    },
    alternateRowStyles: {
      fillColor: REPORT_COLORS.zebra,
      ...(alternateRowStyles || {}),
    },
    ...rest,
  };
};

/* ------------------------------ Public factory ---------------------------- */

export const createPdfReportLayout = async (
  doc: jsPDF,
  options: PdfReportLayoutOptions,
): Promise<PdfReportLayout> => {
  const [logoDataUrl, autoCompanyName] = await Promise.all([
    loadPdfReportLogo(),
    options.companyName !== undefined ? Promise.resolve(options.companyName) : loadReportCompanyName(),
  ]);
  const companyName = options.companyName ?? autoCompanyName ?? null;
  const systemName = options.systemName || "EliteBov";

  // Retrocompat: converte totalRecords em um card padrão quando summaryCards não é informado.
  const summaryCards: ReportSummaryCard[] =
    options.summaryCards && options.summaryCards.length > 0
      ? options.summaryCards
      : options.totalRecords !== undefined
        ? [{ label: "Total de registros", value: String(options.totalRecords) }]
        : [];

  const headerBottomY = drawHeader(doc, options, logoDataUrl, companyName);
  const cardsBottomY = drawSummaryCards(doc, summaryCards, headerBottomY + 4);
  const filtersBottomY = drawFilterChips(doc, options.filters || [], cardsBottomY + 3);

  const tableMargin = { top: headerBottomY + 3, right: MARGIN_X, bottom: 18, left: MARGIN_X };

  const layout: PdfReportLayout = {
    startY: filtersBottomY + 1,
    tableMargin,
    tableStyles: buildTableStyles,
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawHeader(doc, options, logoDataUrl, companyName);
      }
    },
    drawTotalizer: (finalY, items) => drawTotalizerBlock(doc, { willDrawPage: layout.willDrawPage, tableMargin }, finalY, items),
    finalize: () => {
      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        drawFooter(doc, page, totalPages, systemName, companyName);
      }
    },
  };

  return layout;
};
