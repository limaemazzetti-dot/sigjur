import { Check, CircleDot, Gavel, Archive, PauseCircle, Handshake, ScrollText, FileText, Scale, Repeat2 } from "lucide-react";
import { STATUS_PROCESSO, STATUS_LABEL } from "@/lib/processos.functions";
import { Card, CardContent } from "@/components/ui/card";

type Status = (typeof STATUS_PROCESSO)[number];

// Linear "happy path" fase-a-fase
const PIPELINE: Status[] = [
  "inicial",
  "em_andamento",
  "recurso",
  "execucao",
  "concluso_sentenca",
];

const TERMINAL: Record<string, { label: string; icon: typeof Gavel; tone: "gold" | "muted" | "danger" }> = {
  julgado_procedente: { label: "Julgado procedente", icon: Gavel, tone: "gold" },
  julgado_improcedente: { label: "Julgado improcedente", icon: Gavel, tone: "danger" },
  acordo: { label: "Acordo firmado", icon: Handshake, tone: "gold" },
  arquivado: { label: "Arquivado", icon: Archive, tone: "muted" },
  suspenso: { label: "Suspenso", icon: PauseCircle, tone: "muted" },
};

const STAGE_ICON: Record<Status, typeof FileText> = {
  inicial: FileText,
  em_andamento: ScrollText,
  recurso: Repeat2,
  execucao: Scale,
  concluso_sentenca: Gavel,
  suspenso: PauseCircle,
  arquivado: Archive,
  julgado_procedente: Gavel,
  julgado_improcedente: Gavel,
  acordo: Handshake,
};

export function ProcessTimeline({
  status,
  totalAndamentos,
  ultimoAndamento,
}: {
  status: Status;
  totalAndamentos: number;
  ultimoAndamento?: { data: string; titulo: string } | null;
}) {
  const terminal = TERMINAL[status];
  const idx = PIPELINE.indexOf(status);
  const progress = terminal
    ? 100
    : idx >= 0
      ? Math.round(((idx + 1) / PIPELINE.length) * 100)
      : 10;

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-6 lg:p-8 space-y-8">
        {/* Cabeçalho de progresso */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Linha do tempo do processo
            </p>
            <h3 className="font-serif text-2xl mt-1">
              {terminal ? terminal.label : STATUS_LABEL[status]}
            </h3>
            {ultimoAndamento ? (
              <p className="text-xs text-muted-foreground mt-1">
                Último andamento em{" "}
                {new Date(ultimoAndamento.data + "T00:00:00").toLocaleDateString("pt-BR")}
                {" · "}
                <span className="text-foreground/80">{ultimoAndamento.titulo}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {totalAndamentos} andamento{totalAndamentos === 1 ? "" : "s"} registrado
                {totalAndamentos === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Progresso
            </p>
            <p
              className="font-sans font-bold tabular-nums text-3xl leading-none mt-1"
              style={{
                backgroundImage: "var(--gradient-gold)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {progress}%
            </p>
          </div>
        </div>

        {/* Barra fina de progresso */}
        <div className="relative h-[3px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
            style={{
              width: `${progress}%`,
              backgroundImage: "var(--gradient-gold)",
              boxShadow: "0 0 18px -2px hsl(var(--primary) / 0.55)",
            }}
          />
        </div>

        {/* Passos */}
        <div className="relative">
          {/* linha base */}
          <div className="absolute top-5 left-5 right-5 h-px bg-white/10" />
          {/* linha ativa */}
          <div
            className="absolute top-5 left-5 h-px transition-[width] duration-700"
            style={{
              width: `calc((100% - 2.5rem) * ${progress / 100})`,
              backgroundImage: "var(--gradient-gold)",
            }}
          />

          <ol className="relative grid grid-cols-5 gap-2">
            {PIPELINE.map((s, i) => {
              const Icon = STAGE_ICON[s];
              const done = !terminal && i < idx;
              const current = !terminal && i === idx;
              const pending = terminal ? false : i > idx;
              return (
                <li key={s} className="flex flex-col items-center text-center gap-3">
                  <span
                    className={[
                      "relative z-10 w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                      done
                        ? "border-transparent text-background"
                        : current
                          ? "border-transparent text-background scale-110"
                          : "border-white/10 text-muted-foreground bg-background",
                    ].join(" ")}
                    style={
                      done || current
                        ? {
                            backgroundImage: "var(--gradient-gold)",
                            boxShadow: current
                              ? "0 0 0 6px hsl(var(--primary) / 0.10), 0 8px 24px -6px hsl(var(--primary) / 0.45)"
                              : "0 4px 14px -6px hsl(var(--primary) / 0.35)",
                          }
                        : undefined
                    }
                  >
                    {done ? (
                      <Check className="w-4 h-4" strokeWidth={2.25} />
                    ) : current ? (
                      <CircleDot className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="space-y-1">
                    <p
                      className={[
                        "text-[10px] uppercase tracking-[0.22em]",
                        current ? "text-primary" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      Fase {String(i + 1).padStart(2, "0")}
                    </p>
                    <p
                      className={[
                        "text-xs font-medium leading-tight",
                        pending ? "text-muted-foreground/70" : "text-foreground",
                      ].join(" ")}
                    >
                      {STATUS_LABEL[s]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Estado terminal / fora do pipeline linear */}
        {terminal && (
          <div
            className="flex items-center gap-4 rounded-2xl border border-white/5 p-4"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--card)) 0%, color-mix(in oklab, hsl(var(--primary)) 8%, hsl(var(--card))) 100%)",
            }}
          >
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center text-background"
              style={{ backgroundImage: "var(--gradient-gold)" }}
            >
              <terminal.icon className="w-5 h-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Desfecho
              </p>
              <p className="font-serif text-lg">{terminal.label}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
