import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';

export type ReportTheme = 'blue' | 'emerald' | 'slate' | 'indigo';

const THEMES: Record<
  ReportTheme,
  { primary: [number, number, number]; accent: [number, number, number]; soft: [number, number, number] }
> = {
  blue: { primary: [37, 99, 235], accent: [15, 23, 42], soft: [239, 246, 255] },
  emerald: { primary: [5, 150, 105], accent: [6, 78, 59], soft: [236, 253, 245] },
  slate: { primary: [71, 85, 105], accent: [15, 23, 42], soft: [248, 250, 252] },
  indigo: { primary: [79, 70, 229], accent: [30, 27, 75], soft: [238, 242, 255] },
};

export function moneyPKR(n: number) {
  return `Rs ${Number(n || 0).toLocaleString('en-PK')}`;
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function parseMonthValue(value: string) {
  const [y, m] = value.split('-').map(Number);
  const now = new Date();
  if (!y || !m) return { year: now.getFullYear(), month: now.getMonth() + 1 };
  return { year: y, month: m };
}

export function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function createReportDoc(orientation: 'portrait' | 'landscape' = 'landscape') {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  return { doc, autoTable };
}

export function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

export function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

/** Branded header band used on every report page. */
export function paintReportHeader(
  doc: jsPDF,
  opts: {
    title: string;
    subtitle: string;
    metaLeft?: string;
    metaRight?: string;
    theme?: ReportTheme;
  },
) {
  const theme = THEMES[opts.theme ?? 'blue'];
  const w = pageWidth(doc);

  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, w, 26, 'F');
  doc.setFillColor(...theme.primary);
  doc.rect(0, 26, w, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('BanoQabil Educational Institute', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(opts.title, 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(opts.subtitle, 14, 23.5);

  if (opts.metaLeft || opts.metaRight) {
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(8);
    if (opts.metaRight) doc.text(opts.metaRight, w - 14, 11, { align: 'right' });
    if (opts.metaLeft) doc.text(opts.metaLeft, w - 14, 18, { align: 'right' });
  }
}

/** Soft summary chip row under the header. */
export function paintSummaryBar(
  doc: jsPDF,
  y: number,
  items: string[],
  themeName: ReportTheme = 'blue',
) {
  const theme = THEMES[themeName];
  const w = pageWidth(doc);
  doc.setFillColor(...theme.soft);
  doc.roundedRect(14, y, w - 28, 12, 2, 2, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(items.filter(Boolean).join('   ·   '), 18, y + 7.5);
  return y + 16;
}

export function paintSectionTitle(doc: jsPDF, y: number, title: string) {
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 14, y);
  return y + 4;
}

export function paintFooters(doc: jsPDF, note = 'BanoQabil LMS · Confidential') {
  const pages = doc.getNumberOfPages();
  const h = pageHeight(doc);
  const w = pageWidth(doc);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(note, 14, h - 7);
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 7, { align: 'right' });
  }
}

export function defaultTableStyles(
  themeName: ReportTheme = 'blue',
): Pick<UserOptions, 'theme' | 'headStyles' | 'styles' | 'alternateRowStyles'> {
  const theme = THEMES[themeName];
  return {
    theme: 'striped',
    headStyles: {
      fillColor: theme.primary,
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.4,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: theme.soft },
  };
}

export function lastTableY(doc: jsPDF, fallback = 40) {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}
