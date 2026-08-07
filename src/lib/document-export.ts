import { Document, Packer, Paragraph, TextRun, AlignmentType, Header, ImageRun } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import logoBlack from "@/assets/lima-mazzetti-logo-black.png";

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * Gera um DOCX a partir do texto plano do documento gerado.
 * Preserva quebras de linha e destaca em negrito linhas em MAIÚSCULAS
 * ou terminadas em ":" (títulos e rótulos como OUTORGANTE:, CLÁUSULA...).
 */
export async function downloadDocumentoAsDocx(nome: string, conteudo: string) {
  const logoBytes = new Uint8Array(await (await fetch(logoBlack)).arrayBuffer());
  const linhas = conteudo.split(/\r?\n/);
  const children: Paragraph[] = linhas.map((linha) => {
    const trimmed = linha.trim();
    if (trimmed === "") {
      return new Paragraph({ children: [new TextRun("")] });
    }
    // Título principal (linhas curtas, todas maiúsculas): centralizado + negrito
    const isAllUpper =
      trimmed === trimmed.toUpperCase() &&
      /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/.test(trimmed);
    if (isAllUpper && trimmed.length < 90) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: trimmed, bold: true, size: 26 })],
      });
    }
    // Rótulos "PALAVRA:" no início da linha ganham negrito
    const rotuloMatch = /^([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ /()º°ª-]{2,}:)(\s*)(.*)$/.exec(
      linha,
    );
    if (rotuloMatch) {
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: rotuloMatch[1], bold: true }),
          new TextRun({ text: (rotuloMatch[2] ?? "") + (rotuloMatch[3] ?? "") }),
        ],
      });
    }
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [new TextRun({ text: linha })],
    });
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 160 },
                children: [
                  new ImageRun({
                    data: logoBytes,
                    type: "jpg",
                    transformation: { width: 184, height: 148 },
                  }),
                ],
              }),
            ],
          }),
        },
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(nome)}.docx`);
}

/**
 * Gera um PDF a partir do texto plano, respeitando quebras de página,
 * margens A4/Letter e formatação leve (títulos em maiúsculas em negrito).
 */
export async function downloadDocumentoAsPdf(nome: string, conteudo: string) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 56; // ~0.78in
  const marginTop = 142;
  const marginBottom = 64;
  const maxWidth = pageWidth - marginX * 2;
  const lineHeight = 14;

  const logoBlob = await (await fetch(logoBlack)).blob();
  const logoData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(logoBlob);
  });

  const drawHeader = () => {
    pdf.addImage(logoData, "JPEG", marginX, 20, 110, 88);
    pdf.setDrawColor(200, 169, 106);
    pdf.setLineWidth(1.1);
    pdf.line(marginX, 120, pageWidth - marginX, 120);
  };

  drawHeader();
  let y = marginTop;
  pdf.setFont("times", "normal");
  pdf.setFontSize(11);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      pdf.addPage();
      drawHeader();
      y = marginTop;
    }
  };

  const linhas = conteudo.split(/\r?\n/);
  for (const linha of linhas) {
    const trimmed = linha.trim();
    if (trimmed === "") {
      y += lineHeight / 2;
      continue;
    }
    const isAllUpper =
      trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/.test(trimmed);
    const isTitle = isAllUpper && trimmed.length < 90;

    if (isTitle) {
      pdf.setFont("times", "bold");
      pdf.setFontSize(13);
      const wrapped = pdf.splitTextToSize(trimmed, maxWidth) as string[];
      for (const w of wrapped) {
        ensureSpace(lineHeight + 4);
        pdf.text(w, pageWidth / 2, y, { align: "center" });
        y += lineHeight + 2;
      }
      y += 4;
      pdf.setFont("times", "normal");
      pdf.setFontSize(11);
      continue;
    }

    pdf.setFont("times", "normal");
    pdf.setFontSize(11);
    const wrapped = pdf.splitTextToSize(linha, maxWidth) as string[];
    for (const w of wrapped) {
      ensureSpace(lineHeight);
      pdf.text(w, marginX, y, { maxWidth });
      y += lineHeight;
    }
  }

  pdf.save(`${sanitizeFilename(nome)}.pdf`);
}
