import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoBlack from "@/assets/lima-mazzetti-logo-black.png";

let _logoDataUrl: string | null = null;
let _logoPromise: Promise<string | null> | null = null;
async function getPlatformLogo(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  if (!_logoPromise) {
    _logoPromise = (async () => {
      try {
        const res = await fetch(logoBlack);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    })().then((v) => (_logoDataUrl = v));
  }
  return _logoPromise;
}

export function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = "Dados",
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : filename + ".xlsx");
}

export type PdfColumn = { header: string; dataKey: string };

export async function exportToPdf(opts: {
  filename: string;
  titulo: string;
  subtitulo?: string;
  orientation?: "portrait" | "landscape";
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  footerNote?: string;
}) {
  const doc = new jsPDF({ orientation: opts.orientation ?? "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho com a versão institucional para fundo claro.
  const logo = await getPlatformLogo();
  if (logo) {
    try {
      doc.addImage(logo, "JPEG", 40, 24, 112, 90);
    } catch (e) {
      console.warn("Falha ao inserir logo:", e);
    }
  }

  doc.setDrawColor(200, 169, 106);
  doc.setLineWidth(1.2);
  doc.line(40, 118, pageWidth - 40, 118);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(opts.titulo, 40, 142);
  if (opts.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(opts.subtitulo, 40, 158);
  }

  autoTable(doc, {
    startY: 176,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => String(r[c.dataKey] ?? ""))),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [11, 11, 12], textColor: [228, 206, 154], lineColor: [200, 169, 106] },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    margin: { left: 40, right: 40 },
  });

  if (opts.footerNote) {
    const y = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(opts.footerNote, 40, y);
  }

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : opts.filename + ".pdf");
}
