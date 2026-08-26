import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { agendaProxima } from "@/lib/bi.functions";
import { AlarmClock, CalendarClock, Gavel } from "lucide-react";

const TIPOS = [
  { key: "prazo", label: "Agenda", icon: AlarmClock, to: "/prazos" },
  { key: "audiencia", label: "Audiências", icon: Gavel, to: "/audiencias" },
  { key: "pericia", label: "Perícias", icon: CalendarClock, to: "/pericias" },
] as const;

export function AgendaGlassBar() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["agenda-proxima"],
    queryFn: () => agendaProxima(),
    refetchInterval: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];

  return (
    <div className="sticky top-0 z-30 px-3 sm:px-4 pt-3">
      <div
        className="mx-auto max-w-7xl rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 shadow-lg backdrop-blur-2xl backdrop-saturate-150"
        style={{ WebkitBackdropFilter: "saturate(1.5) blur(24px)" }}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2">
          {TIPOS.map(({ key, label, icon: Icon, to }) => {
            const list = items.filter((i) => i.tipo === key);
            const vencidos = list.filter((i) => i.diasRestantes < 0).length;
            const hoje = list.filter((i) => i.diasRestantes === 0).length;
            const proximo = list.find((i) => i.diasRestantes >= 0);
            const alerta = vencidos > 0 || hoje > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigate({ to })}
                className={
                  "group flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs sm:text-sm transition-all border " +
                  (alerta
                    ? "border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                    : "border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{label}</span>
                {vencidos > 0 && (
                  <span className="rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {vencidos} vencidos
                  </span>
                )}
                {hoje > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {hoje} hoje
                  </span>
                )}
                {!alerta && proximo && (
                  <span className="hidden sm:inline text-muted-foreground truncate max-w-[180px]">
                    próx. em {proximo.diasRestantes}d
                  </span>
                )}
                {!alerta && !proximo && (
                  <span className="hidden sm:inline text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
