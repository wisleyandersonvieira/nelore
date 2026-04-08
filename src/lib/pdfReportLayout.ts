import jsPDF from "jspdf";
import { format } from "date-fns";

const REPORT_LOGO_URL =
  "https://yfhuhbnosohfayyyvbro.supabase.co/storage/v1/object/public/attachments/Logo%20EliteBov.png";

const BRAND_PRIMARY: [number, number, number] = [17, 94, 89];
const BRAND_PRIMARY_LIGHT: [number, number, number] = [234, 244, 243];
const BRAND_BORDER: [number, number, number] = [207, 226, 223];
const TEXT_PRIMARY: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

let reportLogoPromise: Promise<string | null> | null = null;

interface ReportFilterItem {
  label: string;
  value: string;
}

interface PdfReportLayoutOptions {
  title: string;
  emittedAt?: Date;
  totalRecords?: number;
  filters?: ReportFilterItem[];
  systemName?: string;
}

interface PdfReportLayout {
  startY: number;
  tableMargin: { top: number; right: number; bottom: number; left: number };
  willDrawPage: (data: { pageNumber: number }) => void;
  finalize: () => void;
}

export type PdfRgbColor = [number, number, number];

const STATUS_ROW_WHITE: PdfRgbColor = [255, 255, 255];
const STATUS_ROW_GREEN: PdfRgbColor = [236, 253, 245];
const STATUS_ROW_RED: PdfRgbColor = [254, 242, 242];

const normalizeStatusValue = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

const drawLogo = (doc: jsPDF, logoDataUrl: string | null, x: number, y: number, width: number, height: number) => {
  if (!logoDataUrl) return;

  try {
    doc.addImage(logoDataUrl, "PNG", x, y, width, height, undefined, "FAST");
  } catch (error) {
    console.error("Error adding report logo to PDF:", error);
  }
};

const drawHeader = (doc: jsPDF, options: PdfReportLayoutOptions, logoDataUrl: string | null) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  doc.setFillColor(...BRAND_PRIMARY_LIGHT);
  doc.roundedRect(marginX, 8, pageWidth - marginX * 2, 24, 3, 3, "F");

  drawLogo(doc, logoDataUrl, marginX + 3, 10.5, 26, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(options.title, 43, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(options.systemName || "EliteBov", 43, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Emitido em", pageWidth - marginX, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(format(options.emittedAt || new Date(), "dd/MM/yyyy HH:mm"), pageWidth - marginX, 22, { align: "right" });

  doc.setDrawColor(...BRAND_BORDER);
  doc.setLineWidth(0.5);
  doc.line(marginX, 36, pageWidth - marginX, 36);

  return 36;
};

const drawSummary = (doc: jsPDF, options: PdfReportLayoutOptions) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const boxX = marginX;
  const boxY = 40;
  const boxWidth = pageWidth - marginX * 2;
  const totalWidth = 42;
  const filtersText = options.filters?.length
    ? options.filters.map((filter) => `${filter.label}: ${filter.value}`).join("  •  ")
    : "Sem filtros aplicados";
  const filterLines = doc.splitTextToSize(filtersText, boxWidth - totalWidth - 20);
  const boxHeight = Math.max(18, 10 + filterLines.length * 4.3);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Total de registros", boxX + 4, boxY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_PRIMARY);
  doc.text(String(options.totalRecords ?? 0), boxX + 4, boxY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Filtros aplicados", boxX + totalWidth, boxY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(filterLines, boxX + totalWidth, boxY + 10.5);

  return boxY + boxHeight + 5;
};

const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number, systemName: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const footerY = pageHeight - 8;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(systemName, marginX, footerY);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - marginX, footerY, { align: "right" });
};

export const createPdfReportLayout = async (doc: jsPDF, options: PdfReportLayoutOptions): Promise<PdfReportLayout> => {
  const logoDataUrl = await loadPdfReportLogo();
  const headerBottomY = drawHeader(doc, options, logoDataUrl);
  const summaryBottomY = drawSummary(doc, options);
  const tableMargin = { top: headerBottomY + 6, right: 12, bottom: 18, left: 12 };

  return {
    startY: summaryBottomY,
    tableMargin,
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawHeader(doc, options, logoDataUrl);
      }
    },
    finalize: () => {
      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        drawFooter(doc, page, totalPages, options.systemName || "EliteBov");
      }
    },
  };
};
