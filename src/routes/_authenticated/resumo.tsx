import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { agendaProxima, type AgendaItem } from "@/lib/bi.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CalendarClock, Gavel, AlarmClock, ClipboardList } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/resumo")({
  component: ResumoPage,
});

function fmtDia(d: Date) {
  return d.toLocaleDateString("pt-BR");
}
function nomeDia(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}
function labelRelativo(offset: number) {
  if (offset === 0) return "(hoje)";
  if (offset === 1) return "(amanhã)";
  return "";
}

function ResumoPage() {
  const { data } = useQuery({ queryKey: ["agenda-proxima"], queryFn: () => agendaProxima() });
  const items = (data?.items ?? []) as AgendaItem[];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataHoje = hoje.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const pericias = items.filter((i) => i.tipo === "pericia" || /per[ií]cia/i.test(i.titulo));
  const audiencias = items.filter((i) => i.tipo === "audiencia");
  const prazosAbertos = items.filter((i) => i.tipo === "prazo");

  const muitoUrgente = items.filter((i) => i.diasRestantes < 0).length;
  const atencaoImediata = items.filter((i) => i.diasRestantes === 0).length;
  const poucoUrgente = items.filter((i) => i.diasRestantes >= 1 && i.diasRestantes <= 2).length;
  const requerAtencao = items.filter(
    (i) => i.prioridade === "alta" && i.diasRestantes >= 3 && i.diasRestantes <= 7,
  ).length;
  const podeEsperar = items.filter((i) => i.diasRestantes > 7).length;

  const dias = Array.from({ length: 7 }, (_, offset) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const dayItems = items.filter((i) => i.data === iso);
    const prazos = dayItems.filter((i) => i.tipo === "prazo");
    const audiencias = dayItems.filter((i) => i.tipo === "audiencia");
    const pericias = dayItems.filter((i) => i.tipo === "pericia" || /per[ií]cia/i.test(i.titulo));
    const aniversarios = dayItems.filter((i) => i.tipo === "aniversario");
    return {
      date: d,
      offset,
      prazos,
      audiencias,
      pericias,
      aniversarios,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header em preto neutro + linha dourada */}
      <div className="rounded-2xl bg-sidebar text-sidebar-foreground px-4 py-4 sm:px-5 grid grid-cols-[minmax(0,1fr)] gap-4 border border-sidebar-border md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Bell className="h-5 w-5 shrink-0 text-accent" />
          <h1 className="font-serif text-2xl tracking-wide text-gold-gradient truncate">RESUMO</h1>
        </div>
        <p className="text-sm capitalize text-sidebar-foreground/80 md:text-right">{dataHoje}</p>
        <Link
          to="/prazos"
          className="text-xs border border-sidebar-border rounded-md px-3 py-2 hover:border-accent/60 hover:text-accent transition-colors w-fit md:col-start-2 md:justify-self-end"
        >
          próximos prazos de processos
        </Link>
      </div>

      {/* KPIs + Tarefas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
        <KpiCard
          label="PERÍCIAS AGENDADAS"
          value={pericias.length}
          icon={CalendarClock}
          to="/pericias"
          resumo={pericias
            .slice(0, 3)
            .map((i) => ({ titulo: i.titulo, data: i.data, subtitulo: i.subtitulo }))}
        />
        <KpiCard
          label="AUDIÊNCIAS AGENDADAS"
          value={audiencias.length}
          icon={Gavel}
          to="/audiencias"
          resumo={audiencias
            .slice(0, 3)
            .map((i) => ({ titulo: i.titulo, data: i.data, subtitulo: i.subtitulo }))}
        />
        <KpiCard
          label="PRAZOS EM ABERTO"
          value={prazosAbertos.length}
          icon={AlarmClock}
          to="/prazos"
          resumo={prazosAbertos
            .slice(0, 3)
            .map((i) => ({ titulo: i.titulo, data: i.data, subtitulo: i.subtitulo }))}
        />

        <Card className="border-border/60 h-full">
          <CardContent className="p-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-accent" />
              <p className="eyebrow">Tarefas</p>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 text-xs flex-1 content-start">
              <TarefaCell
                label="Requer atenção"
                value={requerAtencao}
                intensity="soft"
                to="/prazos"
              />
              <TarefaCell
                label="Atenção imediata"
                value={atencaoImediata}
                intensity="danger"
                to="/prazos"
              />
              <TarefaCell label="Pouco urgente" value={poucoUrgente} intensity="mid" to="/prazos" />
              <TarefaCell
                label="Muito urgente"
                value={muitoUrgente}
                intensity="danger"
                to="/prazos"
              />
              <TarefaCell label="Pode esperar" value={podeEsperar} intensity="muted" to="/prazos" />
            </div>
            {muitoUrgente + atencaoImediata === 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
                <Bell className="h-3 w-3" /> Você não tem tarefas atrasadas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agenda 7 dias */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="eyebrow">Agenda para os próximos 7 dias</h2>
          <div className="hairline flex-1" />
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {dias.map((d) => (
            <Card key={d.date.toISOString()} className="border-border/60 hover-lift">
              <CardContent className="p-3">
                <div className="text-center border-b border-border pb-2 mb-2">
                  <p className="font-serif text-base text-foreground">{fmtDia(d.date)}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{nomeDia(d.date)}</p>
                  {labelRelativo(d.offset) && (
                    <p className="text-[10px] text-accent italic">{labelRelativo(d.offset)}</p>
                  )}
                </div>
                <DayRow icon={AlarmClock} label="PRAZOS" items={d.prazos} />
                <DayRow icon={Gavel} label="AUDIÊNCIAS" items={d.audiencias} />
                <DayRow icon={CalendarClock} label="PERÍCIAS" items={d.pericias} />
                <DayRow icon={Bell} label="ANIVERSÁRIOS" items={d.aniversarios} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  to,
  resumo,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  resumo: { titulo: string; data: string; subtitulo: string | null }[];
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className="block h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-[var(--radius-card)]"
    >
      <Card className="border-border/60 h-full cursor-pointer transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[0_18px_45px_-15px_color-mix(in_oklab,var(--accent)_35%,transparent)] group-active:scale-[0.985]">
        <CardContent className="p-4 h-full flex flex-col">
          {/* Header: ícone à esquerda, nome + número ao lado */}
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 rounded-xl p-2.5 border border-border transition-colors duration-300 group-hover:border-accent/50"
              style={{ background: "color-mix(in oklab, var(--accent) 8%, transparent)" }}
            >
              <Icon className="h-5 w-5 text-accent transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{label}</p>
              <p className="font-sans font-bold tabular-nums text-3xl leading-none mt-1 text-gold-gradient">
                {value}
              </p>
            </div>
          </div>

          {/* Resumo dos próximos */}
          <div className="mt-4 pt-3 border-t border-border/60 flex-1">
            {resumo.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nada agendado.</p>
            ) : (
              <ul className="space-y-1.5">
                {resumo.map((r, idx) => (
                  <li
                    key={idx}
                    title={r.subtitulo ? `${r.titulo}\nProcesso: ${r.subtitulo}` : r.titulo}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate text-foreground/80">{r.titulo}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TarefaCell({
  label,
  value,
  intensity,
  to,
}: {
  label: string;
  value: number;
  intensity: "soft" | "mid" | "danger" | "muted";
  to: string;
}) {
  const tone = {
    soft: "border-accent/25 text-foreground",
    mid: "border-accent/40 text-foreground",
    danger: "border-destructive/40 text-destructive",
    muted: "border-border text-muted-foreground",
  }[intensity];
  return (
    <Link
      to={to}
      preload="intent"
      className={
        "rounded-md border px-2 py-1.5 flex min-w-0 items-center justify-between bg-muted/40 transition-colors hover:border-accent/60 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 " +
        tone
      }
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="font-semibold ml-2 shrink-0">{value}</span>
    </Link>
  );
}

function DayRow({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: AgendaItem[];
}) {
  const [open, setOpen] = useState(false);
  const value = items.length;

  return (
    <Popover open={open}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-1 py-1 text-[11px] transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
          aria-label={`${label}: ${value}. Ver descrição`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
          </span>
          <span
            className={
              "font-sans font-bold tabular-nums shrink-0 " +
              (value > 0 ? "text-accent" : "text-muted-foreground/50")
            }
          >
            {value}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="pointer-events-none w-72 p-3" align="start">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Icon className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold tracking-wide">{label}</p>
          <span className="ml-auto text-xs font-bold text-accent">{value}</span>
        </div>
        {items.length === 0 ? (
          <p className="pt-3 text-xs text-muted-foreground">Nenhum registro para este dia.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pt-3">
            {items.map((item) => (
              <li
                key={`${item.tipo}-${item.id}`}
                className="rounded-md border border-border/60 bg-muted/30 p-2"
              >
                <p className="text-xs font-medium text-foreground">{item.titulo}</p>
                {item.subtitulo && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.subtitulo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
