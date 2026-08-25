import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

function norm(s: string) {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type FieldType = "string" | "date" | "number" | "boolean";
export type ColumnMap<T> = Partial<Record<keyof T & string, string[]>>;
export type FieldTypes<T> = Partial<Record<keyof T & string, FieldType>>;
type DateOrder = "dmy" | "mdy";

function toISODate(v: unknown, order: DateOrder = "dmy"): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const a = Number(br[1]);
    const b = Number(br[2]);
    let y = br[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    const monthFirst = b > 12 || (order === "mdy" && a <= 12);
    const d = String(monthFirst ? b : a).padStart(2, "0");
    const m = String(monthFirst ? a : b).padStart(2, "0");
    const parsed = new Date(`${y}-${m}-${d}T00:00:00`);
    return isNaN(+parsed) ? null : `${y}-${m}-${d}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

function toNumberBR(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v)
    .trim()
    .replace(/[R$\s%]/g, "");
  if (!s) return null;
  // Brazilian: 1.234.567,89 → 1234567.89 ; US: 1,234.56 → 1234.56
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume '.' thousands, ',' decimal (BR)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "sim", "s", "yes", "y", "verdadeiro"].includes(s)) return true;
  if (["0", "false", "nao", "não", "n", "no", "falso"].includes(s)) return false;
  return null;
}

function detectCsvDelimiter(text: string): string {
  const first = text.split(/\r?\n/).slice(0, 5).join("\n");
  const c = (first.match(/,/g) ?? []).length;
  const sc = (first.match(/;/g) ?? []).length;
  const t = (first.match(/\t/g) ?? []).length;
  const max = Math.max(c, sc, t);
  if (max === 0) return ",";
  if (max === sc) return ";";
  if (max === t) return "\t";
  return ",";
}

function detectDateOrder(values: unknown[]): DateOrder {
  let mdy = 0;
  let dmy = 0;
  for (const value of values) {
    const s = String(value ?? "").trim();
    const match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}$/);
    if (!match) continue;
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a <= 12 && b > 12) mdy += 1;
    if (a > 12 && b <= 12) dmy += 1;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

function findHeaderRow<T extends Record<string, unknown>>(
  sheetRows: unknown[][],
  columnMap: ColumnMap<T>,
) {
  let bestIndex = -1;
  let bestScore = 0;
  const aliases = Object.values(columnMap)
    .flatMap((items) => items ?? [])
    .map((alias) => norm(String(alias)));
  for (let i = 0; i < sheetRows.length; i += 1) {
    const score = sheetRows[i].filter((cell) => aliases.includes(norm(String(cell ?? "")))).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestScore > 0 ? bestIndex : -1;
}

export function ImportPlanilhaDialog<T extends Record<string, unknown>>({
  triggerLabel = "Importar planilha",
  title,
  columnMap,
  fieldTypes,
  onImport,
  transform,
}: {
  triggerLabel?: string;
  title: string;
  columnMap: ColumnMap<T>;
  fieldTypes?: FieldTypes<T>;
  onImport: (row: Partial<T>) => Promise<void>;
  transform?: (raw: Record<string, unknown>) => Partial<T>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<Partial<T>>>([]);
  const [rowLineNumbers, setRowLineNumbers] = useState<number[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; errors: number }>({
    done: 0,
    total: 0,
    errors: 0,
  });
  const [errorList, setErrorList] = useState<Array<{ linha: number; motivo: string }>>([]);

  async function handleFile(f: File) {
    try {
      const isCsv = /\.csv$/i.test(f.name) || f.type === "text/csv";
      let wb: XLSX.WorkBook;
      if (isCsv) {
        const text = await f.text();
        const delim = detectCsvDelimiter(text);
        wb = XLSX.read(text, { type: "string", FS: delim, cellDates: true });
      } else {
        const buf = await f.arrayBuffer();
        wb = XLSX.read(buf, { type: "array", cellDates: true });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: null,
        raw: false,
        blankrows: false,
      });
      const headerIndex = findHeaderRow(sheetRows, columnMap);
      if (headerIndex < 0) {
        toast.error("Não encontrei a linha de cabeçalho da planilha");
        setRows([]);
        setRowLineNumbers([]);
        setRawHeaders([]);
        return;
      }
      const headers = sheetRows[headerIndex].map((h) => String(h ?? "").trim());
      const dataRows = sheetRows.slice(headerIndex + 1);
      if (dataRows.length === 0) {
        toast.error("Planilha vazia");
        return;
      }
      setRawHeaders(headers);

      const headerByField: Partial<Record<keyof T & string, number>> = {};
      for (const [field, aliases] of Object.entries(columnMap) as Array<
        [keyof T & string, string[]]
      >) {
        const normAliases = aliases.map(norm);
        const match = headers.findIndex((h) => normAliases.includes(norm(h)));
        if (match >= 0) headerByField[field] = match;
      }

      const dateValues: unknown[] = [];
      for (const [field, index] of Object.entries(headerByField)) {
        if (index == null || fieldTypes?.[field as keyof T & string] !== "date") continue;
        dateValues.push(...dataRows.slice(0, 200).map((r) => r[index]));
      }
      const dateOrder = detectDateOrder(dateValues);

      const mapped: Array<Partial<T>> = [];
      const lineNumbers: number[] = [];
      dataRows.forEach((r, idx) => {
        const out: Record<string, unknown> = {};
        for (const [field, index] of Object.entries(headerByField)) {
          if (index == null) continue;
          let v = r[index];
          if (typeof v === "string") v = v.trim();
          if (v === "" || v === null || v === undefined) continue;
          const t = fieldTypes?.[field as keyof T & string];
          if (t === "date") {
            const iso = toISODate(v, dateOrder);
            if (iso) out[field] = iso;
          } else if (t === "number") {
            const n = toNumberBR(v);
            if (n != null) out[field] = n;
          } else if (t === "boolean") {
            const b = toBool(v);
            if (b != null) out[field] = b;
          } else {
            if (v instanceof Date) v = v.toISOString().slice(0, 10);
            out[field] = v;
          }
        }
        const row = transform ? transform(out) : (out as Partial<T>);
        if (
          Object.values(row).some((value) => value !== "" && value !== null && value !== undefined)
        ) {
          mapped.push(row);
          lineNumbers.push(headerIndex + idx + 2);
        }
      });
      setRows(mapped);
      setRowLineNumbers(lineNumbers);
      setErrorList([]);
      toast.success(`${mapped.length} linhas prontas para importar`);
    } catch (e) {
      toast.error("Erro ao ler planilha: " + (e as Error).message);
    }
  }

  async function runImport() {
    if (rows.length === 0) return;
    setBusy(true);
    setErrorList([]);
    const errs: Array<{ linha: number; motivo: string }> = [];
    setProgress({ done: 0, total: rows.length, errors: 0 });
    const BATCH = 20;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map((r) => onImport(r)));
      results.forEach((r, k) => {
        if (r.status === "rejected") {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errs.push({ linha: rowLineNumbers[i + k] ?? i + k + 2, motivo: reason });
        }
      });
      setProgress({
        done: Math.min(i + BATCH, rows.length),
        total: rows.length,
        errors: errs.length,
      });
    }
    setBusy(false);
    setErrorList(errs);
    const ok = rows.length - errs.length;
    if (errs.length === 0) {
      toast.success(`Importação concluída: ${ok}/${rows.length}`);
      setRows([]);
      setOpen(false);
    } else {
      toast.warning(`Importados ${ok} de ${rows.length}. ${errs.length} com erro — veja detalhes.`);
    }
  }

  function downloadErrors() {
    if (errorList.length === 0) return;
    const csv =
      "linha;motivo\n" +
      errorList.map((e) => `${e.linha};"${e.motivo.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erros-importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const mapped = Object.keys(columnMap).filter((f) => rows[0] && f in rows[0]);
  const unmapped = Object.keys(columnMap).filter((f) => !rows[0] || !(f in rows[0]));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setRows([]);
          setRowLineNumbers([]);
          setRawHeaders([]);
          setErrorList([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Aceita .xlsx, .xls e .csv (vírgula, ponto-e-vírgula ou tab). Datas em dd/mm/aaaa e
            valores em R$ são reconhecidos automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-border/60 p-6 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <Label htmlFor="import-file" className="cursor-pointer text-sm">
              Selecione um arquivo <span className="text-accent underline">.xlsx</span>, .xls ou
              .csv
            </Label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block mx-auto mt-3"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              A primeira linha deve conter os nomes das colunas.
            </p>
          </div>

          {rows.length > 0 && (
            <>
              <div className="rounded-md border border-border/60 p-3 space-y-2 text-xs">
                <p>
                  <strong>{rows.length}</strong> linhas encontradas • {rawHeaders.length} colunas
                </p>
                <p className="text-primary">✓ Reconhecidas: {mapped.join(", ") || "—"}</p>
                {unmapped.length > 0 && (
                  <p className="text-muted-foreground">
                    Não reconhecidas / vazias: {unmapped.join(", ")}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto max-h-64 rounded-md border border-border/60">
                <table className="text-xs w-full">
                  <thead className="bg-secondary/40 sticky top-0">
                    <tr>
                      {mapped.map((f) => (
                        <th key={f} className="text-left px-2 py-1">
                          {f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        {mapped.map((f) => (
                          <td key={f} className="px-2 py-1 truncate max-w-[10rem]">
                            {String(r[f as keyof T] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {busy && (
                <div className="space-y-1">
                  <div className="h-2 rounded bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-center">
                    Importando {progress.done}/{progress.total}…
                    {progress.errors > 0 && (
                      <span className="text-rose-500"> ({progress.errors} erros)</span>
                    )}
                  </p>
                </div>
              )}

              <Button className="w-full" disabled={busy} onClick={runImport}>
                {busy ? "Importando..." : `Importar ${rows.length} registros`}
              </Button>
            </>
          )}

          {errorList.length > 0 && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  {errorList.length} linhas com erro
                </p>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Download className="w-4 h-4 mr-2" /> Baixar erros
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                {errorList.slice(0, 20).map((e, i) => (
                  <div key={i} className="border-t border-border/40 pt-1">
                    <span className="font-mono text-muted-foreground">Linha {e.linha}:</span>{" "}
                    {e.motivo}
                  </div>
                ))}
                {errorList.length > 20 && (
                  <p className="text-muted-foreground pt-2">
                    …e mais {errorList.length - 20} erros. Baixe o CSV para ver todos.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
