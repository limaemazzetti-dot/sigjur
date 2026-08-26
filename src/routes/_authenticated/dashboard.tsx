import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDre, listLancamentos } from "@/lib/lancamentos.functions";
import { aniversariantesHoje } from "@/lib/clientes.functions";
import { getMe } from "@/lib/users.functions";
import { inferGenero } from "@/lib/gender";
import { biProcessos, biFinanceiro } from "@/lib/bi.functions";
import { STATUS_LABEL } from "@/lib/processos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/export";
import { ArrowDown, ArrowUp, TrendingUp, Wallet, Cake, CalendarIcon } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const DONUT_COLORS = ["#C8A96A", "#D8BA82", "#A88848", "#7A6640", "#B7AEB3", "#82757C", "#4A443B"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

// 5 min — dados do painel toleram cache; evita refetch a cada re-mount/focus.
const DASHBOARD_STALE = 5 * 60_000;

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function DashboardPage() {
  const [mode, setMode] = useState<"single" | "range">("single");
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selectedFromISO = toISO(dateFrom);
  const selectedToISO = toISO(dateTo);
  const isSingle = mode === "single" || selectedFromISO === selectedToISO;
  // Na visão de "data única", a data escolhida representa o mês de
  // referência do painel. Antes, a consulta buscava somente aquele dia e
  // zerava os indicadores mesmo havendo lançamentos no restante do mês.
  const periodFrom = isSingle ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1) : dateFrom;
  const periodTo = isSingle ? new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0) : dateTo;
  const inicioISO = toISO(periodFrom);
  const fimISO = toISO(periodTo);
  const refDate = dateFrom;
  const ano = dateFrom.getFullYear();
  const anoInicioISO = `${ano}-01-01`;
  const anoFimISO = `${ano}-12-31`;
  const rangeLabel = isSingle
    ? dateFrom.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : `${fmtBR(dateFrom)} — ${fmtBR(dateTo)}`;

  const dre = useQuery({
    queryKey: ["dre-range", inicioISO, fimISO],
    queryFn: () => getDre({ data: { inicio: inicioISO, fim: fimISO } }),
    staleTime: DASHBOARD_STALE,
  });
  const recent = useQuery({
    queryKey: ["lanc-recent-range", ano],
    queryFn: () => listLancamentos({ data: { ano } }),
    staleTime: DASHBOARD_STALE,
  });
  const bdays = useQuery({
    queryKey: ["aniversariantes"],
    queryFn: () => aniversariantesHoje(),
    staleTime: DASHBOARD_STALE,
  });
  const bp = useQuery({
    queryKey: ["bi-processos"],
    queryFn: () => biProcessos(),
    staleTime: DASHBOARD_STALE,
  });
  const bf = useQuery({
    queryKey: ["bi-financeiro-year", ano],
    queryFn: () => biFinanceiro({ data: { inicio: anoInicioISO, fim: anoFimISO } }),
    staleTime: DASHBOARD_STALE,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), staleTime: 30 * 60_000 });
  const saudacao = useMemo(() => {
    const genero = me.data?.genero ?? inferGenero(me.data?.nome);
    return genero === "M" ? "Bem-vindo" : "Bem-vinda";
  }, [me.data?.genero, me.data?.nome]);

  const kpis = useMemo(
    () => [
      {
        label: "Receita no período",
        value: dre.data?.receitaBruta ?? 0,
        icon: ArrowUp,
        tone: "text-primary",
      },
      {
        label: "Despesas no período",
        value: dre.data?.totalDespesas ?? 0,
        icon: ArrowDown,
        tone: "text-rose-500",
      },
      {
        label: "Resultado líquido",
        value: dre.data?.resultado ?? 0,
        icon: TrendingUp,
        tone: "text-accent",
      },
      {
        label: "Receita líquida",
        value: dre.data?.receitaLiquida ?? 0,
        icon: Wallet,
        tone: "text-foreground",
      },
    ],
    [
      dre.data?.receitaBruta,
      dre.data?.totalDespesas,
      dre.data?.resultado,
      dre.data?.receitaLiquida,
    ],
  );

  const statusData = useMemo(
    () =>
      (bp.data?.status ?? []).map((s) => ({
        name: STATUS_LABEL[s.name as keyof typeof STATUS_LABEL] ?? s.name,
        value: s.value,
      })),
    [bp.data?.status],
  );
  const monthlyData = useMemo(
    () =>
      (bf.data?.mensal ?? []).map((m) => ({
        nome: m.nome,
        Receita: m.receita,
        Despesa: m.despesa,
      })),
    [bf.data?.mensal],
  );
  const recentTop = useMemo(() => {
    const rows = (recent.data ?? []).filter((l) => l.data >= inicioISO && l.data <= fimISO);
    return rows.slice(-8).reverse();
  }, [recent.data, inicioISO, fimISO]);

  return (
    <div className="sigjur-page space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Painel</p>
          <h1 className="font-serif text-3xl sm:text-4xl mt-1 text-gold-gradient inline-block">
            {saudacao}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSingle
              ? `Visão do escritório em ${refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`
              : `Período: ${rangeLabel}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              size="sm"
              variant={mode === "single" ? "default" : "ghost"}
              onClick={() => {
                setMode("single");
                setDateTo(dateFrom);
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
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full sm:w-[260px] justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              {mode === "single" ? (
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => {
                    if (d) {
                      setDateFrom(d);
                      setDateTo(d);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              ) : (
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  defaultMonth={dateFrom}
                  selected={{ from: dateFrom, to: dateTo }}
                  onSelect={(r) => {
                    if (r?.from && r?.to) {
                      setDateFrom(r.from);
                      setDateTo(r.to);
                    } else if (r?.from) {
                      setDateFrom(r.from);
                      setDateTo(r.from);
                    }
                  }}
                  className={cn("p-3 pointer-events-auto")}
                />
              )}
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {bdays.data && bdays.data.length > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Cake className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="font-serif text-lg">Aniversariantes de hoje</p>
              <p className="text-sm text-muted-foreground mt-1">
                {bdays.data.map((c) => c.nome).join(" · ")}
              </p>
              <Link
                to="/clientes"
                className="text-xs uppercase tracking-widest text-accent hover:underline mt-2 inline-block"
              >
                Ver clientes
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-sans">
                  {k.label}
                </CardTitle>
                <k.icon className={`w-4 h-4 ${k.tone}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-sans font-bold tabular-nums text-2xl">{formatBRL(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Fluxo financeiro
            </p>
            <CardTitle className="font-serif text-xl mt-1 whitespace-nowrap">
              Receita × Despesa em {ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C8A96A" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#C8A96A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-despesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#82757C" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#82757C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 4"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 11, fill: "#82757C" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#82757C" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{
                      background: "color-mix(in srgb, var(--accent) 14%, #131314)",
                      border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#F8F5F1" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    stroke="#C8A96A"
                    strokeWidth={2}
                    fill="url(#grad-receita)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesa"
                    stroke="#82757C"
                    strokeWidth={2}
                    fill="url(#grad-despesa)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 pt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> Receita
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Despesa
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Audiências
            </p>
            <CardTitle className="font-serif text-xl mt-1">Distribuição por status</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    stroke="none"
                    paddingAngle={2}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "color-mix(in srgb, var(--accent) 14%, #131314)",
                      border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: "#B7AEB3", paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Nenhum processo cadastrado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs anuais compactos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Receita anual"
          value={formatBRL(bf.data?.receitaTotal ?? 0)}
          tone="text-accent"
        />
        <MiniStat
          label="Despesa anual"
          value={formatBRL(bf.data?.despesaTotal ?? 0)}
          tone="text-muted-foreground"
        />
        <MiniStat
          label="Resultado anual"
          value={formatBRL((bf.data?.receitaTotal ?? 0) - (bf.data?.despesaTotal ?? 0))}
          tone="text-foreground"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-xl">Últimos lançamentos</CardTitle>
            <Link
              to="/financeiro/lancamentos"
              className="text-xs uppercase tracking-widest text-accent hover:underline"
            >
              Ver todos
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : recentTop.length > 0 ? (
            <div className="divide-y">
              {recentTop.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")} ·{" "}
                      {l.plano_contas?.nome ?? "sem categoria"}
                    </p>
                  </div>
                  <span
                    className={
                      l.tipo === "entrada"
                        ? "text-primary font-medium"
                        : "text-rose-700 font-medium"
                    }
                  >
                    {l.tipo === "entrada" ? "+" : "−"} {formatBRL(Number(l.valor))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento neste período. Cadastre o primeiro em{" "}
              <Link to="/financeiro/lancamentos" className="text-accent underline">
                Lançamentos
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <p className={"font-sans font-bold tabular-nums text-2xl mt-2 " + (tone ?? "")}>{value}</p>
      </CardContent>
    </Card>
  );
}
