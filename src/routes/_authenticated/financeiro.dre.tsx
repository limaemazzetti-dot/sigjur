import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { getDre } from "@/lib/lancamentos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToExcel, exportToPdf, formatBRL } from "@/lib/export";
import { FileSpreadsheet, FileText } from "lucide-react";

const searchSchema = z.object({
  inicio: z.string().optional(),
  fim: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/financeiro/dre")({
  validateSearch: (s) => searchSchema.parse(s),
  component: DrePage,
});

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function DrePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const now = new Date();

  const inicio = search.inicio ? fromISO(search.inicio) : new Date(now.getFullYear(), 0, 1);
  const fim = search.fim ? fromISO(search.fim) : new Date(now.getFullYear(), 11, 31);
  const inicioISO = toISO(inicio);
  const fimISO = toISO(fim);

  // "todos" (ano inteiro) quando mês inicial=jan e final=dez do mesmo ano
  const mesmoAno = inicio.getFullYear() === fim.getFullYear();
  const anoInteiro = mesmoAno && inicio.getMonth() === 0 && fim.getMonth() === 11;
  const mesAtual =
    mesmoAno && !anoInteiro && inicio.getMonth() === fim.getMonth() ? inicio.getMonth() : -1;
  const anoAtual = inicio.getFullYear();

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const anos = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  const periodoLabel = anoInteiro
    ? `Ano ${anoAtual}`
    : mesAtual >= 0
      ? `${meses[mesAtual]} / ${anoAtual}`
      : `${fmtBR(inicio)} — ${fmtBR(fim)}`;

  const dre = useQuery({
    queryKey: ["dre", inicioISO, fimISO],
    queryFn: () => getDre({ data: { inicio: inicioISO, fim: fimISO } }),
  });

  function aplicar(mes: number, ano: number) {
    if (mes === -1) {
      navigate({
        search: { inicio: toISO(new Date(ano, 0, 1)), fim: toISO(new Date(ano, 11, 31)) },
      });
    } else {
      const from = new Date(ano, mes, 1);
      const to = new Date(ano, mes + 1, 0);
      navigate({ search: { inicio: toISO(from), fim: toISO(to) } });
    }
  }

  function drillLink(categoria_id: string) {
    if (categoria_id.startsWith("sem-categoria-")) return undefined;
    return {
      to: "/financeiro/lancamentos" as const,
      search: {
        categoria: categoria_id,
        ano: anoAtual,
        mes: mesAtual >= 0 ? mesAtual + 1 : undefined,
      },
    };
  }

  function handleExportExcel() {
    if (!dre.data) return;
    const rows: Record<string, unknown>[] = [];
    rows.push({ Linha: "RECEITA BRUTA", Valor: dre.data.receitaBruta });
    dre.data.receita.forEach((c) => rows.push({ Linha: "  " + c.nome, Valor: c.total }));
    rows.push({ Linha: "(-) DEDUÇÕES", Valor: -dre.data.totalDeducoes });
    dre.data.deducoes.forEach((c) => rows.push({ Linha: "  " + c.nome, Valor: -c.total }));
    rows.push({ Linha: "(=) RECEITA LÍQUIDA", Valor: dre.data.receitaLiquida });
    rows.push({ Linha: "(-) DESPESAS OPERACIONAIS", Valor: -dre.data.totalDespesas });
    dre.data.despesas.forEach((c) => rows.push({ Linha: "  " + c.nome, Valor: -c.total }));
    rows.push({ Linha: "(=) RESULTADO LÍQUIDO", Valor: dre.data.resultado });
    exportToExcel(`dre-${inicioISO}_${fimISO}`, rows, "DRE");
  }

  function handleExportPdf() {
    if (!dre.data) return;
    const rows: { linha: string; valor: string }[] = [];
    rows.push({ linha: "RECEITA BRUTA", valor: formatBRL(dre.data.receitaBruta) });
    dre.data.receita.forEach((c) => rows.push({ linha: "  " + c.nome, valor: formatBRL(c.total) }));
    rows.push({ linha: "(-) DEDUÇÕES", valor: formatBRL(dre.data.totalDeducoes) });
    dre.data.deducoes.forEach((c) =>
      rows.push({ linha: "  " + c.nome, valor: formatBRL(c.total) }),
    );
    rows.push({ linha: "(=) RECEITA LÍQUIDA", valor: formatBRL(dre.data.receitaLiquida) });
    rows.push({ linha: "(-) DESPESAS OPERACIONAIS", valor: formatBRL(dre.data.totalDespesas) });
    dre.data.despesas.forEach((c) =>
      rows.push({ linha: "  " + c.nome, valor: formatBRL(c.total) }),
    );
    rows.push({ linha: "(=) RESULTADO LÍQUIDO", valor: formatBRL(dre.data.resultado) });
    exportToPdf({
      filename: `dre-${inicioISO}_${fimISO}`,
      titulo: `Demonstrativo de Resultado do Exercício — ${periodoLabel}`,
      columns: [
        { header: "Descrição", dataKey: "linha" },
        { header: "Valor", dataKey: "valor" },
      ],
      rows,
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
      <header className="grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Financeiro</p>
          <h1 className="font-sans font-bold uppercase tracking-wide text-xl sm:text-2xl lg:text-3xl mt-1 truncate">
            Demonstrativo de Resultado
          </h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-widest truncate">
            {periodoLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!dre.data}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!dre.data}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </header>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select
                value={anoInteiro ? "todos" : String(mesAtual >= 0 ? mesAtual : inicio.getMonth())}
                onValueChange={(v) => aplicar(v === "todos" ? -1 : Number(v), anoAtual)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ano inteiro</SelectItem>
                  {meses.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Select
                value={String(anoAtual)}
                onValueChange={(v) =>
                  aplicar(anoInteiro ? -1 : mesAtual >= 0 ? mesAtual : inicio.getMonth(), Number(v))
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {dre.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Entradas
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBRL(dre.data.totalEntradas)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saídas
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
                {formatBRL(dre.data.totalSaidas)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saldo do período
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatBRL(dre.data.totalEntradas - dre.data.totalSaidas)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-sans font-bold uppercase tracking-wide text-xl">
            DRE — {periodoLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dre.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : dre.data ? (
            <div className="divide-y">
              <DreLine label="RECEITA BRUTA" value={dre.data.receitaBruta} bold />
              {dre.data.receita.map((c) => (
                <DreLine key={c.id} label={c.nome} value={c.total} indent link={drillLink(c.id)} />
              ))}

              <DreLine label="(−) Deduções" value={dre.data.totalDeducoes} negative bold />
              {dre.data.deducoes.map((c) => (
                <DreLine
                  key={c.id}
                  label={c.nome}
                  value={c.total}
                  negative
                  indent
                  link={drillLink(c.id)}
                />
              ))}

              <DreLine label="(=) RECEITA LÍQUIDA" value={dre.data.receitaLiquida} bold highlight />

              <DreLine
                label="(−) Despesas Operacionais"
                value={dre.data.totalDespesas}
                negative
                bold
              />
              {dre.data.despesas.map((c) => (
                <DreLine
                  key={c.id}
                  label={c.nome}
                  value={c.total}
                  negative
                  indent
                  link={drillLink(c.id)}
                />
              ))}

              <DreLine
                label="(=) RESULTADO LÍQUIDO"
                value={dre.data.resultado}
                bold
                highlight
                positiveNegative
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dica: clique em qualquer linha de categoria para ver os lançamentos que a compõem.
      </p>
    </div>
  );
}

function DreLine({
  label,
  value,
  indent,
  bold,
  negative,
  highlight,
  positiveNegative,
  link,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
  positiveNegative?: boolean;
  link?: { to: "/financeiro/lancamentos"; search: Record<string, unknown> };
}) {
  const valueColor = positiveNegative
    ? value >= 0
      ? "text-primary"
      : "text-rose-700"
    : negative
      ? "text-rose-700"
      : "text-foreground";

  const content = (
    <div
      className={
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 font-sans " +
        (indent ? "pl-4 sm:pl-6 text-sm" : "text-sm sm:text-base ") +
        (bold ? " font-bold uppercase tracking-wide" : "") +
        (highlight ? " bg-secondary/50 px-3 -mx-3 rounded" : "") +
        (link ? " hover:bg-accent/10 cursor-pointer transition-colors" : "")
      }
    >
      <span
        className={
          "min-w-0 truncate " +
          (indent ? "text-muted-foreground uppercase tracking-wide text-xs" : "")
        }
      >
        {label}
      </span>
      <span
        className={
          valueColor +
          " font-sans tabular-nums shrink-0 " +
          (bold ? " font-bold text-base sm:text-lg" : "")
        }
      >
        {formatBRL(value)}
      </span>
    </div>
  );

  if (link) {
    return (
      <Link to={link.to} search={link.search as never}>
        {content}
      </Link>
    );
  }
  return content;
}
