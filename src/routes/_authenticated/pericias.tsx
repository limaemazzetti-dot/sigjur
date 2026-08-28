import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { listPrazos, upsertPrazo, deletePrazo, type PrazoRow } from "@/lib/prazos.functions";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarClock, CalendarIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableProcessPicker } from "@/components/searchable-process-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pericias")({
  validateSearch: (search) => z.object({ editar: z.string().uuid().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Perícias — Lima & Mazzetti" },
      { name: "description", content: "Agenda de perícias vinculadas aos processos." },
    ],
  }),
  component: PericiasPage,
});

const STATUS_LABEL = {
  aberto: "Em aberto",
  cumprido: "Realizada",
  cancelado: "Cancelada",
} as const;

const TIPOS_PERICIA = [
  "Perícia médica judicial",
  "Perícia médica administrativa",
  "Perícia social judicial",
  "Perícia social administrativa",
] as const;

function formatDateBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

const HORARIO_PREFIX = /^\[Horário:\s*(\d{2}:\d{2})\]\s*/i;

function readHorario(descricao: string | null | undefined) {
  return descricao?.match(HORARIO_PREFIX)?.[1] ?? "";
}

function cleanDescricao(descricao: string | null | undefined) {
  return (descricao ?? "").replace(HORARIO_PREFIX, "").trim();
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFilterDate(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function PericiasPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [statusFilter, setStatusFilter] = useState<"aberto" | "cumprido" | "cancelado" | "todos">(
    "aberto",
  );
  const [personFilter, setPersonFilter] = useState("");
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editing, setEditing] = useState<PrazoRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useQuery({
    queryKey: ["prazos", statusFilter],
    queryFn: () =>
      listPrazos({
        data: {
          status: statusFilter === "todos" ? undefined : statusFilter,
          tipo_evento: "pericia",
        },
      }),
  });

  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePrazo);
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Perícia excluída");
      qc.invalidateQueries({ queryKey: ["prazos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const pericias = useMemo(() => {
    const name = personFilter.trim().toLocaleLowerCase("pt-BR");
    const start = dateMode === "single" ? singleDate : dateRange.from;
    const end = dateMode === "single" ? singleDate : dateRange.to;

    return (list.data ?? []).filter((p) => {
      const people = [p.processos?.clientes?.nome, p.processos?.autor, p.processos?.reu]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      const date = p.data_prazo;
      return (
        (!name || people.includes(name)) &&
        (!start || date >= toISO(start)) &&
        (!end || date <= toISO(end))
      );
    });
  }, [dateMode, dateRange.from, dateRange.to, list.data, personFilter, singleDate]);

  const dateFilterLabel =
    dateMode === "single"
      ? singleDate
        ? formatFilterDate(singleDate)
        : "Todas as datas"
      : dateRange.from
        ? dateRange.to
          ? `${formatFilterDate(dateRange.from)} — ${formatFilterDate(dateRange.to)}`
          : `${formatFilterDate(dateRange.from)} — escolher fim`
        : "Todas as datas";

  function clearDateFilter() {
    setSingleDate(undefined);
    setDateRange({});
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: PrazoRow) {
    setEditing(p);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!search.editar || !list.data) return;
    const pericia = list.data.find((item) => item.id === search.editar);
    if (pericia && editing?.id !== pericia.id) {
      setEditing(pericia);
      setDialogOpen(true);
    }
  }, [editing?.id, list.data, search.editar]);

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open && search.editar) {
      navigate({ search: (previous) => ({ ...previous, editar: undefined }), replace: true });
    }
  }

  return (
    <div className="sigjur-page sigjur-page--flush-bottom h-full min-h-0 flex flex-col gap-6 overflow-hidden">
      <header className="shrink-0 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Jurídico</p>
          <h1 className="font-serif text-2xl sm:text-3xl mt-1 flex items-center gap-2">
            <CalendarClock className="w-6 h-6" /> Perícias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compromissos registrados em prazos e identificados como perícia.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
          <div className="w-full sm:w-64">
            <Label className="text-xs">Pessoa do processo</Label>
            <div className="relative">
              <Input
                value={personFilter}
                onChange={(event) => setPersonFilter(event.target.value)}
                placeholder="Buscar por cliente, autor ou réu"
                className="pr-8"
              />
              {personFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9"
                  onClick={() => setPersonFilter("")}
                  aria-label="Limpar busca por pessoa"
                  title="Limpar busca por pessoa"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Label className="text-xs">Data da perícia</Label>
            <div className="flex gap-1 rounded-md border p-1 mb-1">
              <Button
                type="button"
                size="sm"
                variant={dateMode === "single" ? "default" : "ghost"}
                onClick={() => setDateMode("single")}
              >
                Data única
              </Button>
              <Button
                type="button"
                size="sm"
                variant={dateMode === "range" ? "default" : "ghost"}
                onClick={() => setDateMode("range")}
              >
                Intervalo
              </Button>
            </div>
            <div className="flex gap-1">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-[270px] justify-start text-left font-normal"
                    title="Filtrar perícias por uma data ou por um intervalo"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{dateFilterLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  {dateMode === "single" ? (
                    <Calendar
                      mode="single"
                      selected={singleDate}
                      onSelect={(date) => {
                        setSingleDate(date);
                        if (date) setCalendarOpen(false);
                      }}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  ) : (
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range ?? {})}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  )}
                </PopoverContent>
              </Popover>
              {(singleDate || dateRange.from) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearDateFilter}
                  aria-label="Limpar filtro de data"
                  title="Limpar filtro de data"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
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
          <Button className="gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" /> Nova perícia
          </Button>
        </div>
      </header>

      <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
        <CardContent className="h-full p-0 divide-y divide-border/60 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {list.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : pericias.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhuma perícia encontrada com os filtros informados. Ajuste ou limpe os filtros,
              clique em <strong>Nova perícia</strong> ou cadastre em{" "}
              <Link to="/prazos" className="underline underline-offset-2">
                Agenda
              </Link>{" "}
              incluindo a palavra "perícia" no título ou descrição.
            </div>
          ) : (
            pericias.map((p, idx) => {
              const dias = daysUntil(p.data_prazo);
              const vencido = p.status === "aberto" && dias < 0;
              const hoje = p.status === "aberto" && dias === 0;
              return (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 tabular-nums text-xs font-semibold text-muted-foreground w-7 text-right">
                      {idx + 1}.
                    </span>

                    {p.status === "aberto" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label="Semáforo de perícia"
                            className={
                              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " +
                              (dias <= 7
                                ? "bg-red-500"
                                : dias <= 14
                                  ? "bg-primary"
                                  : "bg-primary/45")
                            }
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {dias <= 7
                            ? "Faltam 7 dias ou menos"
                            : dias <= 14
                              ? "Faltam entre 8 e 14 dias"
                              : "Acima de 14 dias"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.titulo}</p>
                      {p.processos && (
                        <Link
                          to="/processos/$id"
                          params={{ id: p.processos.id }}
                          className="mt-1 block space-y-0.5 border-l-2 border-primary/60 pl-2 hover:bg-secondary/35 rounded-r-sm"
                          title="Abrir este processo"
                        >
                          <p className="text-xs font-medium text-accent truncate">
                            {p.processos.clientes?.nome ?? p.processos.autor}
                          </p>
                          {p.processos.numero_cnj && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              Processo nº {p.processos.numero_cnj}
                            </p>
                          )}
                        </Link>
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
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge variant={vencido ? "destructive" : hoje ? "default" : "secondary"}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                    {p.status === "aberto" && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {vencido ? `${Math.abs(dias)}d atraso` : hoje ? "Hoje" : `em ${dias}d`}
                      </span>
                    )}
                    <div className="flex gap-1 mt-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir "${p.titulo}"?`)) delMut.mutate(p.id);
                        }}
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <PericiaDialog open={dialogOpen} onOpenChange={handleDialogChange} editing={editing} />
    </div>
  );
}

function PericiaDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PrazoRow | null;
}) {
  const isEdit = !!editing;
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horario, setHorario] = useState("");
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [status, setStatus] = useState<"aberto" | "cumprido" | "cancelado">("aberto");

  useEffect(() => {
    if (open) {
      const tituloExistente = editing?.titulo ?? "";
      setTitulo(
        TIPOS_PERICIA.find((tipo) =>
          tituloExistente.toLocaleLowerCase("pt-BR").includes(tipo.toLocaleLowerCase("pt-BR")),
        ) ?? TIPOS_PERICIA[0],
      );
      setDescricao(cleanDescricao(editing?.descricao));
      setData(editing?.data_prazo ?? new Date().toISOString().slice(0, 10));
      setHorario(readHorario(editing?.descricao));
      setProcessoId(editing?.processo_id ?? null);
      setStatus(editing?.status ?? "aberto");
    }
  }, [open, editing]);

  const processosQuery = useQuery({
    queryKey: ["processos-lite"],
    queryFn: () => listProcessos({ data: {} }),
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const processos = processosQuery.data ?? [];

  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPrazo);
  const mut = useMutation({
    mutationFn: (payload: import("@/lib/prazos.functions").PrazoFormInput) =>
      upsertFn({ data: payload }),
    onSuccess: () => {
      toast.success(isEdit ? "Perícia atualizada" : "Perícia criada");
      qc.invalidateQueries({ queryKey: ["prazos"] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = titulo.trim();
    if (!processoId) return toast.error("Selecione o processo vinculado");
    mut.mutate({
      id: editing?.id,
      processo_id: processoId,
      titulo: t,
      descricao:
        [horario ? `[Horário: ${horario}]` : "", descricao.trim()].filter(Boolean).join(" ") ||
        null,
      data_prazo: data,
      prioridade: editing?.prioridade ?? "media",
      status,
      tipo_evento: "pericia",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-3rem)] lg:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? "Editar perícia" : "Nova perícia"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs">Tipo de perícia</Label>
            <Select value={titulo} onValueChange={setTitulo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PERICIA.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Processo vinculado</Label>
            <SearchableProcessPicker
              value={processoId}
              onValueChange={setProcessoId}
              processes={processos}
              placeholder={processosQuery.isLoading ? "Carregando…" : "Selecione o processo"}
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao ?? ""}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>
          <div className={`grid gap-3 ${isEdit ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
