import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { agendaProxima } from "@/lib/bi.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlarmClock, CalendarClock, Gavel, Cake } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { loadAlertaConfig, type AlertaConfig } from "@/components/alertas-config-dialog";

const ICONS = {
  prazo: AlarmClock,
  audiencia: Gavel,
  pericia: CalendarClock,
  aniversario: Cake,
} as const;

const LABEL: Record<keyof typeof ICONS, string> = {
  prazo: "Prazo",
  audiencia: "Audiência",
  pericia: "Perícia",
  aniversario: "Aniversário",
};

export function AgendaAlert() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<AlertaConfig>(() => loadAlertaConfig());
  const navigate = useNavigate();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onChange = () => setCfg(loadAlertaConfig());
    window.addEventListener("alertas-config-changed", onChange);
    return () => window.removeEventListener("alertas-config-changed", onChange);
  }, []);

  const { data } = useQuery({
    queryKey: ["agenda-proxima"],
    queryFn: () => agendaProxima(),
    refetchInterval: 5 * 60 * 1000,
  });

  const urgentes = (data?.items ?? []).filter((i) => {
    const limite = cfg[i.tipo] ?? 1;
    return i.diasRestantes <= limite;
  });

  useEffect(() => {
    if (!urgentes.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `agenda-alert-shown-${today}`;
    if (sessionStorage.getItem(key)) return;
    setOpen(true);
    sessionStorage.setItem(key, "1");
  }, [urgentes.length]);

  // Notificações do navegador estilo Google Agenda
  useEffect(() => {
    if (!cfg.browserNotifications) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const i of urgentes) {
      const key = `${i.tipo}-${i.id}-${i.data}`;
      const storageKey = `notif-shown-${new Date().toISOString().slice(0, 10)}-${key}`;
      if (notifiedRef.current.has(key)) continue;
      if (sessionStorage.getItem(storageKey)) { notifiedRef.current.add(key); continue; }
      const when = i.diasRestantes < 0
        ? `${Math.abs(i.diasRestantes)}d em atraso`
        : i.diasRestantes === 0 ? "hoje"
        : i.diasRestantes === 1 ? "amanhã"
        : `em ${i.diasRestantes} dias`;
      try {
        new Notification(`${LABEL[i.tipo]} ${when}`, {
          body: [i.titulo, i.subtitulo].filter(Boolean).join(" — "),
          tag: key,
        });
        sessionStorage.setItem(storageKey, "1");
        notifiedRef.current.add(key);
      } catch { /* ignore */ }
    }
  }, [urgentes, cfg.browserNotifications]);

  if (!urgentes.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <AlarmClock className="h-5 w-5 text-accent" />
            Lembrete de agenda
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Você tem <strong>{urgentes.length}</strong> compromisso(s) dentro do seu limite de alerta:
        </p>
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {urgentes.map((i) => {
            const Icon = ICONS[i.tipo];
            const vencido = i.diasRestantes < 0;
            const hoje = i.diasRestantes === 0;
            return (
              <li
                key={`${i.tipo}-${i.id}`}
                className={
                  "flex items-start gap-3 p-3 rounded-md border " +
                  (vencido ? "border-destructive/50 bg-destructive/10" :
                    hoje ? "border-accent/40 bg-accent/10" :
                    "border-border")
                }
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.titulo}</p>
                  {i.subtitulo && <p className="text-xs text-muted-foreground truncate">{i.subtitulo}</p>}
                </div>
                <Badge variant={vencido ? "destructive" : "secondary"}>
                  {vencido ? `${Math.abs(i.diasRestantes)}d atraso` : hoje ? "Hoje" : i.diasRestantes === 1 ? "Amanhã" : `${i.diasRestantes}d`}
                </Badge>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Depois</Button>
          <Button onClick={() => { setOpen(false); navigate({ to: "/bi" }); }}>Abrir agenda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
