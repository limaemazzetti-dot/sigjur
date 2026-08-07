import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlarmClock, Gavel, CalendarClock, Cake, Bell } from "lucide-react";
import { toast } from "sonner";

export type AlertaConfig = {
  prazo: number;
  audiencia: number;
  pericia: number;
  aniversario: number;
  browserNotifications: boolean;
};

export const DEFAULT_ALERTA_CONFIG: AlertaConfig = {
  prazo: 3,
  audiencia: 5,
  pericia: 5,
  aniversario: 1,
  browserNotifications: false,
};

const STORAGE_KEY = "alertas-config-v1";

export function loadAlertaConfig(): AlertaConfig {
  if (typeof window === "undefined") return DEFAULT_ALERTA_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERTA_CONFIG;
    return { ...DEFAULT_ALERTA_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ALERTA_CONFIG;
  }
}

export function saveAlertaConfig(cfg: AlertaConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent("alertas-config-changed"));
}

const CAMPOS = [
  { key: "prazo" as const, label: "Prazos", icon: AlarmClock },
  { key: "audiencia" as const, label: "Audiências", icon: Gavel },
  { key: "pericia" as const, label: "Perícias", icon: CalendarClock },
  { key: "aniversario" as const, label: "Aniversários", icon: Cake },
];

export function AlertasConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cfg, setCfg] = useState<AlertaConfig>(DEFAULT_ALERTA_CONFIG);

  useEffect(() => {
    if (open) setCfg(loadAlertaConfig());
  }, [open]);

  async function handleToggleBrowser(v: boolean) {
    if (v && "Notification" in window) {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast.error("Permissão de notificações negada");
          return;
        }
      } else if (Notification.permission === "denied") {
        toast.error("Notificações bloqueadas no navegador");
        return;
      }
    }
    setCfg((c) => ({ ...c, browserNotifications: v }));
  }

  function handleSave() {
    saveAlertaConfig(cfg);
    toast.success("Alertas atualizados");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Bell className="h-5 w-5 text-accent" /> Alertas personalizados
          </DialogTitle>
          <DialogDescription>
            Defina com quantos dias de antecedência você quer ser lembrado de cada compromisso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {CAMPOS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`alerta-${key}`} className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`alerta-${key}`}
                  type="number"
                  min={0}
                  max={60}
                  value={cfg[key]}
                  onChange={(e) => setCfg((c) => ({ ...c, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-20 h-8"
                />
                <span className="text-xs text-muted-foreground w-10">dias</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-3 border-t">
            <Label htmlFor="browser-notif" className="text-sm">
              Notificações do navegador
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                Como no Google Agenda
              </p>
            </Label>
            <Switch
              id="browser-notif"
              checked={cfg.browserNotifications}
              onCheckedChange={handleToggleBrowser}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
