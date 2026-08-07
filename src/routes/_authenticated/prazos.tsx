import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  listPrazos,
  upsertPrazo,
  setPrazoStatus,
  deletePrazo,
  type PrazoFormInput,
  type PrazoRow,
} from "@/lib/prazos.functions";
import { listProcessos } from "@/lib/processos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, RotateCcw, AlarmClock, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { exportToPdf } from "@/lib/export";
import { SearchableProcessPicker } from "@/components/searchable-process-picker";

export const Route = createFileRoute("/_authenticated/prazos")({
  validateSearch: (search) => z.object({ editar: z.string().uuid().optional() }).parse(search),
  component: PrazosPage,
});

const PRIO_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta" } as const;
const STATUS_LABEL = { aberto: "Em aberto", cumprido: "Cumprido", cancelado: "Cancelado" } as const;

function formatDateBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function PrazosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"aberto" | "cumprido" | "cancelado" | "todos">(
    "aberto",
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PrazoRow | null>(null);
  const [pericia, setPericia] = useState<PrazoRow | null>(null);

  const list = useQuery({
    queryKey: ["prazos", statusFilter],
    queryFn: () =>
      listPrazos({ data: { status: statusFilter === "todos" ? undefined : statusFilter } }),
  });

  const processos = useQuery({
    queryKey: ["processos-lite"],
    queryFn: () => listProcessos({ data: {} }),
  });

  useEffect(() => {
    if (!search.editar || !list.data) return;
    const prazo = list.data.find((item) => item.id === search.editar);
    if (prazo && editing?.id !== prazo.id) {
      setEditing(prazo);
      setOpen(true);
    }
  }, [editing?.id, list.data, search.editar]);

  function handleDialogChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setEditing(null);
      if (search.editar) {
        navigate({ search: (previous) => ({ ...previous, editar: undefined }), replace: true });
      }
    }
  }

  const mSave = useMutation({
    mutationFn: (d: PrazoFormInput) => upsertPrazo({ data: d }),
    onSuccess: () => {
      toast.success("Prazo salvo");
      qc.invalidateQueries({ queryKey: ["prazos"] });
      handleDialogChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mStatus = useMutation({
    mutationFn: (v: { id: string; status: "aberto" | "cumprido" | "cancelado" }) =>
      setPrazoStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prazos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => deletePrazo({ data: { id } }),
    onSuccess: () => {
      toast.success("Prazo removido");
      qc.invalidateQueries({ queryKey: ["prazos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const abertos = rows.filter((p) => p.status === "aberto");
  const vencidos = abertos.filter((p) => daysUntil(p.data_prazo) < 0).length;
  const hoje = abertos.filter((p) => daysUntil(p.data_prazo) === 0).length;
  const proximos = abertos.filter((p) => {
    const d = daysUntil(p.data_prazo);
    return d > 0 && d <= 7;
  }).length;

  async function handleExportPdf() {
    if (rows.length === 0) {
      toast.error("Não há prazos para gerar o relatório");
      return;
    }

    const filtro = {
      aberto: "Em aberto",
      cumprido: "Cumpridos",
      cancelado: "Cancelados",
      todos: "Todos",
    }[statusFilter];

    await exportToPdf({
      filename: `relatorio-prazos-${statusFilter}`,
      titulo: "Relatório de Prazos",
      subtitulo: `Filtro: ${filtro} · ${rows.length} registro${rows.length === 1 ? "" : "s"}`,
      orientation: "landscape",
      columns: [
        { header: "Data", dataKey: "data" },
        { header: "Título e descrição", dataKey: "detalhes" },
        { header: "Tipo", dataKey: "tipo" },
        { header: "Cliente", dataKey: "cliente" },
        { header: "Nº do processo", dataKey: "processo" },
        { header: "Prioridade", dataKey: "prioridade" },
        { header: "Status", dataKey: "status" },
      ],
      rows: rows.map((p) => {
        const isPericia = /per[íi]cia/i.test(p.titulo) || /per[íi]cia/i.test(p.descricao ?? "");
        const isAudiencia =
          /audi[êe]ncia/i.test(p.titulo) || /audi[êe]ncia/i.test(p.descricao ?? "");
        return {
          data: formatDateBR(p.data_prazo),
          detalhes: p.descricao ? `${p.titulo}\n${p.descricao}` : p.titulo,
          tipo: isPericia ? "Perícia" : isAudiencia ? "Audiência" : "Prazo",
          cliente: p.processos?.clientes?.nome ?? p.processos?.autor ?? "Não informado",
          processo: p.processos?.numero_cnj ?? "Não informado",
          prioridade: PRIO_LABEL[p.prioridade],
          status: STATUS_LABEL[p.status],
        };
      }),
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
      <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Jurídico</p>
          <h1 className="font-serif text-3xl mt-1">Prazos</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            onClick={handleExportPdf}
            disabled={!rows.length}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Novo prazo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar prazo" : "Novo prazo"}</DialogTitle>
              </DialogHeader>
              <PrazoForm
                initial={editing ?? undefined}
                processos={(processos.data ?? []).map((p) => ({
                  id: p.id,
                  label: `${p.autor} × ${p.reu}${p.numero_cnj ? " — " + p.numero_cnj : ""}${p.clientes?.nome ? ` (${p.clientes.nome})` : ""}`,
                  cliente: p.clientes?.nome ?? null,
                  numero_cnj: p.numero_cnj,
                }))}
                loading={mSave.isPending}
                onSubmit={(d) => mSave.mutate(d)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencidos</p>
            <p className="font-sans font-bold tabular-nums text-2xl text-red-600 dark:text-red-400">
              {vencidos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencem hoje</p>
            <p className="font-sans font-bold tabular-nums text-2xl text-primary">{hoje}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Próximos 7 dias</p>
            <p className="font-sans font-bold tabular-nums text-2xl">{proximos}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs uppercase text-muted-foreground">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="cumprido">Cumpridos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <AlarmClock className="mx-auto h-8 w-8 opacity-40 mb-2" />
              Nenhum prazo encontrado.
            </div>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Audiência</TableHead>
                    <TableHead>Perícia</TableHead>

                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const d = daysUntil(p.data_prazo);
                    const vencido = p.status === "aberto" && d < 0;
                    const hojeRow = p.status === "aberto" && d === 0;
                    const rowClass = vencido
                      ? "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30"
                      : hojeRow
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "";
                    return (
                      <TableRow key={p.id} className={rowClass}>
                        <TableCell className="text-sm">
                          <div className="flex items-start gap-2">
                            {p.status === "aberto" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    aria-label="Semáforo de prazo"
                                    className={
                                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " +
                                      (d <= 7
                                        ? "bg-red-500"
                                        : d <= 14
                                          ? "bg-primary"
                                          : "bg-primary/45")
                                    }
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {d <= 7
                                    ? "Faltam 7 dias ou menos"
                                    : d <= 14
                                      ? "Faltam entre 8 e 14 dias"
                                      : "Acima de 14 dias"}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
                            )}
                            <div>
                              {formatDateBR(p.data_prazo)}
                              {p.status === "aberto" && (
                                <span
                                  className={
                                    "block text-xs " +
                                    (vencido
                                      ? "text-red-700 dark:text-red-400 font-medium"
                                      : hojeRow
                                        ? "text-primary"
                                        : "text-muted-foreground")
                                  }
                                >
                                  {vencido
                                    ? `Vencido há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`
                                    : hojeRow
                                      ? "Vence hoje"
                                      : `em ${d} dia${d === 1 ? "" : "s"}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className="font-medium">{p.titulo}</p>
                          {p.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {p.descricao}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.processos ? (
                            <div className="space-y-0.5">
                              <p className="text-foreground">
                                {p.processos.autor} × {p.processos.reu}
                              </p>
                              {p.processos.numero_cnj && <p>Nº {p.processos.numero_cnj}</p>}
                              {p.processos.clientes?.nome && (
                                <p>Cliente: {p.processos.clientes.nome}</p>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {/per[íi]cia/i.test(p.titulo) || /per[íi]cia/i.test(p.descricao ?? "") ? (
                            <button
                              type="button"
                              onClick={() => setPericia(p)}
                              className="focus:outline-none"
                            >
                              <Badge
                                variant="secondary"
                                className="cursor-pointer hover:bg-secondary/80"
                              >
                                Perícia
                              </Badge>
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{STATUS_LABEL[p.status]}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status === "aberto" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Marcar como cumprido"
                                onClick={() => mStatus.mutate({ id: p.id, status: "cumprido" })}
                              >
                                <Check className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Reabrir"
                                onClick={() => mStatus.mutate({ id: p.id, status: "aberto" })}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => {
                                setEditing(p);
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Remover"
                              onClick={() => {
                                if (confirm("Remover prazo?")) mDel.mutate(p.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile list */}
          {rows.length > 0 && (
            <div className="md:hidden divide-y divide-border">
              {rows.map((p) => {
                const d = daysUntil(p.data_prazo);
                const vencido = p.status === "aberto" && d < 0;
                const hojeRow = p.status === "aberto" && d === 0;
                return (
                  <div
                    key={p.id}
                    className={
                      "p-3 space-y-1 " +
                      (vencido ? "bg-red-50 dark:bg-red-950/30" : hojeRow ? "bg-primary/10" : "")
                    }
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0 flex items-start gap-2">
                        {p.status === "aberto" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                aria-label="Semáforo de prazo"
                                className={
                                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " +
                                  (d <= 7 ? "bg-red-500" : d <= 14 ? "bg-primary" : "bg-primary/45")
                                }
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {d <= 7
                                ? "Faltam 7 dias ou menos"
                                : d <= 14
                                  ? "Faltam entre 8 e 14 dias"
                                  : "Acima de 14 dias"}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateBR(p.data_prazo)} · {STATUS_LABEL[p.status]}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {p.status === "aberto" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mStatus.mutate({ id: p.id, status: "cumprido" })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mStatus.mutate({ id: p.id, status: "aberto" })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Remover prazo?")) mDel.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!pericia} onOpenChange={(v) => !v && setPericia(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl">{pericia?.titulo}</SheetTitle>
            <SheetDescription>Detalhes da perícia</SheetDescription>
          </SheetHeader>
          {pericia && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Data</p>
                <p>{formatDateBR(pericia.data_prazo)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
                <p>{STATUS_LABEL[pericia.status]}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Prioridade
                </p>
                <Badge
                  variant={
                    pericia.prioridade === "alta"
                      ? "destructive"
                      : pericia.prioridade === "media"
                        ? "default"
                        : "secondary"
                  }
                >
                  {PRIO_LABEL[pericia.prioridade]}
                </Badge>
              </div>
              {pericia.processos && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Processo
                  </p>
                  <p>
                    {pericia.processos.autor} × {pericia.processos.reu}
                  </p>
                  {pericia.processos.numero_cnj && (
                    <p className="text-xs text-muted-foreground">{pericia.processos.numero_cnj}</p>
                  )}
                </div>
              )}
              {pericia.descricao && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Descrição
                  </p>
                  <p className="whitespace-pre-wrap">{pericia.descricao}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditing(pericia);
                    setPericia(null);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                {pericia.status === "aberto" && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      mStatus.mutate({ id: pericia.id, status: "cumprido" });
                      setPericia(null);
                    }}
                  >
                    <Check className="h-4 w-4 mr-1" /> Concluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PrazoForm({
  initial,
  processos,
  loading,
  onSubmit,
}: {
  initial?: PrazoRow;
  processos: { id: string; label: string; cliente: string | null; numero_cnj: string | null }[];
  loading: boolean;
  onSubmit: (d: PrazoFormInput) => void;
}) {
  const [form, setForm] = useState<PrazoFormInput>({
    id: initial?.id,
    processo_id: initial?.processo_id ?? null,
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    data_prazo: initial?.data_prazo ?? new Date().toISOString().slice(0, 10),
    status: initial?.status ?? "aberto",
    prioridade: initial?.prioridade ?? "media",
    data_conclusao: initial?.data_conclusao ?? null,
  });
  function set<K extends keyof PrazoFormInput>(k: K, v: PrazoFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.processo_id) {
          toast.error("Selecione o processo vinculado");
          return;
        }
        onSubmit(form);
      }}
    >
      <div>
        <Label>Título</Label>
        <Input
          required
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Ex.: Contestação — prazo fatal"
        />
      </div>
      <div>
        <Label>Processo vinculado</Label>
        <SearchableProcessPicker
          value={form.processo_id}
          onValueChange={(value) => set("processo_id", value)}
          processes={processos}
          placeholder="Selecione o processo"
        />
      </div>
      <div>
        <Label>Data do prazo</Label>
        <Input
          type="date"
          required
          value={form.data_prazo}
          onChange={(e) => set("data_prazo", e.target.value)}
        />
      </div>
      <div>
        <Label>Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => set("status", v as "aberto" | "cumprido" | "cancelado")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">Em aberto</SelectItem>
            <SelectItem value="cumprido">Cumprido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Descrição / observações</Label>
        <Textarea value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Salvar prazo"}
      </Button>
    </form>
  );
}
