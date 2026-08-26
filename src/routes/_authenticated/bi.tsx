import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { biProcessos, biFinanceiro, agendaProxima } from "@/lib/bi.functions";
import { Badge } from "@/components/ui/badge";
import { AlarmClock, CalendarClock, Gavel, Cake, CalendarIcon } from "lucide-react";
import { STATUS_LABEL } from "@/lib/processos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/export";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/bi")({
  component: BiPage,
});

const COLORS = [
  "#0B0B0C",
  "#C8A96A",
  "#D8BA82",
  "#A88848",
  "#7A6640",
  "#82757C",
  "#B7AEB3",
  "#4A443B",
];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function BiPage() {
  const now = new Date();
  const [inicio, setInicio] = useState<Date>(new Date(now.getFullYear(), 0, 1));
  const [fim, setFim] = useState<Date>(new Date(now.getFullYear(), 11, 31));
  const inicioISO = toISO(inicio);
  const fimISO = toISO(fim);
  const isSingle = inicioISO === fimISO;
  const [mode, setMode] = useState<"single" | "range">("range");
  const rangeLabel = isSingle ? fmtBR(inicio) : `${fmtBR(inicio)} — ${fmtBR(fim)}`;

  const bp = useQuery({ queryKey: ["bi-processos"], queryFn: () => biProcessos() });
  const bf = useQuery({
    queryKey: ["bi-financeiro", inicioISO, fimISO],
    queryFn: () => biFinanceiro({ data: { inicio: inicioISO, fim: fimISO } }),
  });
  const ag = useQuery({ queryKey: ["agenda-proxima"], queryFn: () => agendaProxima() });

  function setRange(from: Date, to: Date) {
    setInicio(from);
    setFim(to);
  }
  function preset(months: number) {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months + 1);
    start.setDate(1);
    setMode("range");
    setRange(start, end);
  }
  function presetAno(offset = 0) {
    const y = new Date().getFullYear() + offset;
    setMode("range");
    setRange(new Date(y, 0, 1), new Date(y, 11, 31));
  }
  function presetHoje() {
    const t = new Date();
    setMode("single");
    setRange(t, t);
  }

  return (
    <div className="sigjur-page space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Business Intelligence
          </p>
          <h1 className="font-serif text-3xl mt-1">Indicadores</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              size="sm"
              variant={mode === "single" ? "default" : "ghost"}
              onClick={() => {
                setMode("single");
                setRange(inicio, inicio);
              }}
            >
              Data única
            </Button>
            <Button
              size="sm"
              variant={mode === "range" ? "default" : "ghost"}
              onClick={() => setMode("range")}
            >
              Intervalo
            </Button>
          </div>
          <div>
            <Label className="text-xs">Período</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[260px] justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {rangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-wrap gap-1 p-2 border-b">
                  <Button size="sm" variant="ghost" onClick={presetHoje}>
                    Hoje
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => preset(1)}>
                    Este mês
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => preset(3)}>
                    3 meses
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => preset(6)}>
                    6 meses
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => preset(12)}>
                    12 meses
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => presetAno(0)}>
                    Ano atual
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => presetAno(-1)}>
                    Ano anterior
                  </Button>
                </div>
                {mode === "single" ? (
                  <Calendar
                    mode="single"
                    selected={inicio}
                    defaultMonth={inicio}
                    onSelect={(d) => d && setRange(d, d)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                ) : (
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    defaultMonth={inicio}
                    selected={{ from: inicio, to: fim }}
                    onSelect={(r) => {
                      if (r?.from && r?.to) setRange(r.from, r.to);
                      else if (r?.from) setRange(r.from, r.from);
                    }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      {/* AGENDA UNIFICADA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">Agenda — Audiências, Prazos & Perícias</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KPI
            label="Vencidos"
            value={String(ag.data?.resumo.vencidos ?? 0)}
            tone="text-rose-700"
          />
          <KPI label="Hoje" value={String(ag.data?.resumo.hoje ?? 0)} tone="text-primary" />
          <KPI label="Amanhã" value={String(ag.data?.resumo.amanha ?? 0)} tone="text-primary/80" />
          <KPI label="Próximos 7 dias" value={String(ag.data?.resumo.proximos7 ?? 0)} />
        </div>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Próximos compromissos</CardTitle>
          </CardHeader>
          <CardContent>
            {(ag.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum compromisso nos próximos 30 dias.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(ag.data?.items ?? []).slice(0, 20).map((i) => {
                  const Icon =
                    i.tipo === "audiencia"
                      ? Gavel
                      : i.tipo === "aniversario"
                        ? Cake
                        : i.tipo === "pericia"
                          ? CalendarClock
                          : AlarmClock;
                  const vencido = i.diasRestantes < 0;
                  const hoje = i.diasRestantes === 0;
                  const amanha = i.diasRestantes === 1;
                  return (
                    <li key={`${i.tipo}-${i.id}`}>
                      <Link
                        to={
                          i.tipo === "audiencia"
                            ? "/audiencias"
                            : i.tipo === "pericia"
                              ? "/pericias"
                              : i.tipo === "aniversario"
                                ? "/clientes"
                                : "/prazos"
                        }
                        search={i.tipo === "aniversario" ? {} : { editar: i.id }}
                        className="flex items-start gap-3 rounded-md py-3 px-2 -mx-2 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Abrir este lançamento para atualizar"
                      >
                        <Icon
                          className={
                            "h-4 w-4 mt-0.5 shrink-0 " +
                            (vencido
                              ? "text-rose-600"
                              : hoje
                                ? "text-primary"
                                : "text-muted-foreground")
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{i.titulo}</p>
                          {i.subtitulo && (
                            <p className="text-xs text-muted-foreground truncate">{i.subtitulo}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(i.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <Badge
                            variant={
                              vencido ? "destructive" : hoje || amanha ? "default" : "secondary"
                            }
                          >
                            {vencido
                              ? `${Math.abs(i.diasRestantes)}d atraso`
                              : hoje
                                ? "Hoje"
                                : amanha
                                  ? "Amanhã"
                                  : `${i.diasRestantes}d`}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* BI PROCESSOS */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Audiências</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <KPI label="Total de processos" value={String(bp.data?.total ?? 0)} />
          <KPI label="Encerrados" value={String(bp.data?.encerrados ?? 0)} />
          <KPI label="Procedentes" value={String(bp.data?.procedentes ?? 0)} tone="text-primary" />
          <KPI
            label="Taxa de sucesso"
            value={`${(bp.data?.taxaSucesso ?? 0).toFixed(1)}%`}
            tone="text-gold-gradient"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Distribuição por status</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(bp.data?.status ?? []).map((s) => ({
                      ...s,
                      label: STATUS_LABEL[s.name as keyof typeof STATUS_LABEL] ?? s.name,
                    }))}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={90}
                  >
                    {(bp.data?.status ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Volume por matéria</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bp.data?.materia ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#C8A96A" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BI FINANCEIRO */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Financeiro — {rangeLabel}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <KPI
            label="Receita no período"
            value={formatBRL(bf.data?.receitaTotal ?? 0)}
            tone="text-primary"
          />
          <KPI
            label="Despesa no período"
            value={formatBRL(bf.data?.despesaTotal ?? 0)}
            tone="text-rose-700"
          />
          <KPI
            label="Resultado"
            value={formatBRL((bf.data?.receitaTotal ?? 0) - (bf.data?.despesaTotal ?? 0))}
          />
        </div>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Receita × Despesa mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bf.data?.mensal ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="#C8A96A"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="despesa"
                  name="Despesa"
                  stroke="#82757C"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Faturamento por tipo de honorário</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(bf.data?.honorarios ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bf.data?.honorarios ?? []}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {(bf.data?.honorarios ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-16">
                Informe o campo "tipo de honorário" nos lançamentos de receita para ver este
                gráfico.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={"font-sans font-bold tabular-nums text-2xl mt-1 " + (tone ?? "")}>{value}</p>
      </CardContent>
    </Card>
  );
}
