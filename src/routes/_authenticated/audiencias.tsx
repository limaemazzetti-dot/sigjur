import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { listPrazos, upsertPrazo, type PrazoRow } from "@/lib/prazos.functions";
import { listProcessos } from "@/lib/processos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Gavel, Plus, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableProcessPicker } from "@/components/searchable-process-picker";

export const Route = createFileRoute("/_authenticated/audiencias")({
  validateSearch: (search) => z.object({ editar: z.string().uuid().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Audiências — Lima & Mazzetti" },
      { name: "description", content: "Agenda de audiências vinculadas aos processos." },
    ],
  }),
  component: AudienciasPage,
});

const STATUS_LABEL = {
  aberto: "Em aberto",
  cumprido: "Realizada",
  cancelado: "Cancelada",
} as const;

function formatDateBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const HORARIO_PREFIX = /^\[Horário:\s*(\d{2}:\d{2})\]\s*/i;

function readHorario(descricao: string | null | undefined) {
  return descricao?.match(HORARIO_PREFIX)?.[1] ?? "";
}

function cleanDescricao(descricao: string | null | undefined) {
  return (descricao ?? "").replace(HORARIO_PREFIX, "").trim();
}

function processClientName(processo: { clientes?: { nome: string } | null; autor: string }) {
  return processo.clientes?.nome || processo.autor || "Cliente não informado";
}

function AudienciasPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [statusFilter, setStatusFilter] = useState<"aberto" | "cumprido" | "cancelado" | "todos">(
    "aberto",
  );
  const list = useQuery({
    queryKey: ["prazos", statusFilter],
    queryFn: () =>
      listPrazos({
        data: {
          status: statusFilter === "todos" ? undefined : statusFilter,
          tipo_evento: "audiencia",
        },
      }),
  });

  const audiencias = useMemo(() => list.data ?? [], [list.data]);

  return (
    <div className="h-full min-h-0 p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0 flex flex-col gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
      <header className="shrink-0 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Jurídico</p>
          <h1 className="font-serif text-2xl sm:text-3xl mt-1 flex items-center gap-2">
            <Gavel className="w-6 h-6" /> Audiências
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compromissos registrados em prazos e identificados como audiência.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="w-full sm:w-52">
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="cumprido">Realizadas</SelectItem>
                <SelectItem value="cancelado">Canceladas</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AudienciaDialog mode="new" />
        </div>
      </header>

      <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
        <CardContent className="h-full p-0 divide-y divide-border/60 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {list.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : audiencias.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhuma audiência encontrada. Clique em <strong>Nova audiência</strong> ou cadastre em{" "}
              <Link to="/prazos" className="underline underline-offset-2">
                Prazos
              </Link>{" "}
              incluindo a palavra "audiência" no título ou descrição.
            </div>
          ) : (
            audiencias.map((p, idx) => {
              const dias = daysUntil(p.data_prazo);
              const vencido = p.status === "aberto" && dias < 0;
              const hoje = p.status === "aberto" && dias === 0;
              const semaforo =
                p.status !== "aberto"
                  ? { dot: "bg-muted-foreground/40", label: "" }
                  : dias <= 7
                    ? { dot: "bg-red-500", label: "Urgente (≤ 7 dias)" }
                    : dias <= 14
                      ? { dot: "bg-primary", label: "Atenção (≤ 14 dias)" }
                      : { dot: "bg-primary/45", label: "Tranquilo (> 14 dias)" };
              return (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                  <span className="mt-0.5 shrink-0 tabular-nums text-xs font-semibold text-muted-foreground w-7 text-right">
                    {idx + 1}.
                  </span>
                  {semaforo.label ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${semaforo.dot}`}
                          aria-label={semaforo.label}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{semaforo.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${semaforo.dot}`} />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.titulo}</p>
                    {p.processos ? (
                      <div className="mt-0.5 space-y-0.5">
                        <Link
                          to="/processos/$id"
                          params={{ id: p.processos.id }}
                          className="text-xs text-accent hover:underline block truncate"
                          title={`${p.processos.autor} × ${p.processos.reu}`}
                        >
                          {p.processos.autor} × {p.processos.reu}
                        </Link>
                        {p.processos.numero_cnj && (
                          <p className="text-xs text-muted-foreground truncate">
                            Nº {p.processos.numero_cnj}
                          </p>
                        )}
                        {p.processos.clientes?.nome && (
                          <p className="text-xs text-muted-foreground truncate">
                            Cliente: {p.processos.clientes.nome}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        Sem processo vinculado
                      </p>
                    )}
                    {cleanDescricao(p.descricao) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {cleanDescricao(p.descricao)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateBR(p.data_prazo)}
                      {readHorario(p.descricao) ? ` às ${readHorario(p.descricao)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <AudienciaDialog
                        mode="edit"
                        audiencia={p}
                        autoOpen={search.editar === p.id}
                        onAutoClose={() =>
                          navigate({
                            search: (previous) => ({ ...previous, editar: undefined }),
                            replace: true,
                          })
                        }
                      />
                      <Badge variant={vencido ? "destructive" : hoje ? "default" : "secondary"}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </div>
                    {p.status === "aberto" && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {vencido ? `${Math.abs(dias)}d atraso` : hoje ? "Hoje" : `em ${dias}d`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AudienciaDialog({
  mode,
  audiencia,
  autoOpen = false,
  onAutoClose,
}: {
  mode: "new" | "edit";
  audiencia?: PrazoRow;
  autoOpen?: boolean;
  onAutoClose?: () => void;
}) {
  const isEdit = mode === "edit";
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(audiencia?.titulo ?? "");
  const [descricao, setDescricao] = useState(cleanDescricao(audiencia?.descricao));
  const [horario, setHorario] = useState(readHorario(audiencia?.descricao));
  const [data, setData] = useState(audiencia?.data_prazo ?? new Date().toISOString().slice(0, 10));
  const [processoId, setProcessoId] = useState<string | null>(audiencia?.processo_id ?? null);
  const [status, setStatus] = useState<"aberto" | "cumprido" | "cancelado">(
    audiencia?.status ?? "aberto",
  );

  function closeDialog() {
    setOpen(false);
    if (autoOpen) onAutoClose?.();
  }

  useEffect(() => {
    if (open) {
      setTitulo(audiencia?.titulo ?? "");
      setDescricao(cleanDescricao(audiencia?.descricao));
      setHorario(readHorario(audiencia?.descricao));
      setData(audiencia?.data_prazo ?? new Date().toISOString().slice(0, 10));
      setProcessoId(audiencia?.processo_id ?? null);
      setStatus(audiencia?.status ?? "aberto");
    }
  }, [open, audiencia]);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const processosQuery = useQuery({
    queryKey: ["processos-lite"],
    queryFn: () => listProcessos({ data: {} }),
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPrazo);
  const mut = useMutation({
    mutationFn: (finalTitle: string) =>
      upsertFn({
        data: {
          id: audiencia?.id,
          processo_id: processoId,
          titulo: finalTitle,
          descricao: `${horario ? `[Horário: ${horario}] ` : ""}${descricao.trim()}`.trim() || null,
          data_prazo: data,
          prioridade: audiencia?.prioridade ?? "media",
          status,
          tipo_evento: "audiencia",
        },
      }),
    onSuccess: () => {
      toast.success(isEdit ? "Audiência atualizada" : "Audiência criada");
      qc.invalidateQueries({ queryKey: ["prazos"] });
      closeDialog();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = titulo.trim();
    if (!t) return toast.error("Informe o título");
    if (!processoId) return toast.error("Selecione o processo vinculado");
    const finalTitle = /audi[êe]ncia/i.test(t) ? t : `Audiência — ${t}`;
    mut.mutate(finalTitle);
  }

  const processos = processosQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else closeDialog();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar audiência">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Nova audiência
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? "Editar audiência" : "Nova audiência"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Audiência de instrução"
            />
          </div>
          <div>
            <Label className="text-xs">Processo vinculado</Label>
            <SearchableProcessPicker
              value={processoId ?? ""}
              onValueChange={(v) => {
                setProcessoId(v || null);
                const proc = processos.find((p) => p.id === v);
                if (proc && !titulo.trim()) setTitulo(`Audiência — ${processClientName(proc)}`);
              }}
              processes={processos}
              placeholder={processosQuery.isLoading ? "Carregando…" : "Selecione o processo"}
            />
            {processoId &&
              (() => {
                const proc = processos.find((p) => p.id === processoId);
                if (!proc) return null;
                return (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente: {processClientName(proc)} · Processo: {proc.numero_cnj ?? "sem número"}
                    <br />
                    Autor: {proc.autor || "não informado"} · Réu: {proc.reu || "não informado"}
                  </p>
                );
              })()}
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            {isEdit && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                    <SelectItem value="cumprido">Realizada</SelectItem>
                    <SelectItem value="cancelado">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
