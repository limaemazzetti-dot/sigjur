import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import {
  listProcessosResumo,
  listProcessoFilterOptions,
  listProcessoReferenceOptions,
  listAndamentos,
  upsertProcesso,
  deleteProcesso,
  STATUS_PROCESSO,
  STATUS_LABEL,
  type ProcessoFormInput,
  type ProcessoResumoRow,
} from "@/lib/processos.functions";
import { listClientes, type ClienteRow } from "@/lib/clientes.functions";
import { listCatalogo, listVinculos } from "@/lib/catalogos.functions";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  Plus,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  MapPin,
  ListChecks,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToPdf, formatBRL } from "@/lib/export";
import { ProcessTimeline } from "@/components/process-timeline";
import { useAutoSync } from "@/lib/use-auto-sync";
import { ImportPlanilhaDialog } from "@/components/import-planilha-dialog";
import { CatalogoCombobox } from "@/components/catalogo-combobox";
import { SearchableClientPicker } from "@/components/searchable-client-picker";

export const Route = createFileRoute("/_authenticated/processos")({
  component: ProcessosRoute,
});

function ProcessosRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isProcessoDetalhe = /^\/processos\/[^/]+\/?$/.test(pathname);
  return isProcessoDetalhe ? <Outlet /> : <ProcessosPage />;
}

function ProcessosPage() {
  const qc = useQueryClient();
  const autoSync = useAutoSync();
  const [busca, setBusca] = useState("");
  const buscaDeferred = useDeferredValue(busca);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState("all");
  const [prazoFilter, setPrazoFilter] = useState("all");
  const [order, setOrder] = useState<
    "entrada_desc" | "entrada_asc" | "cadastro_desc" | "cadastro_asc"
  >("entrada_desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoResumoRow | null>(null);

  const list = useQuery({
    queryKey: ["processos-resumo", buscaDeferred, statusFilter, tipoAcaoFilter, prazoFilter, order],
    queryFn: () =>
      listProcessosResumo({
        data: {
          q: buscaDeferred || undefined,
          status:
            statusFilter !== "all" ? (statusFilter as (typeof STATUS_PROCESSO)[number]) : undefined,
          tipo_acao: tipoAcaoFilter !== "all" ? tipoAcaoFilter : undefined,
          prazo_em_aberto:
            prazoFilter === "aberto" ? true : prazoFilter === "sem_prazo" ? false : undefined,
          order,
        },
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const clientes = useQuery({
    queryKey: ["clientes-select"],
    queryFn: () => listClientes({ data: {} }),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const tiposAcao = useQuery({
    queryKey: ["processos-filter-options"],
    queryFn: () => listProcessoFilterOptions(),
    staleTime: 60_000,
  });

  const mSave = useMutation({
    mutationFn: (d: ProcessoFormInput) => upsertProcesso({ data: d }),
    onSuccess: (_r, vars) => {
      toast.success(vars.id ? "Processo atualizado" : "Processo salvo");
      qc.invalidateQueries({ queryKey: ["processos-resumo"] });
      qc.invalidateQueries({ queryKey: ["processos"] });
      autoSync(["processos", "painel"]);
      if (vars.id) setEditing(null);
      else setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => deleteProcesso({ data: { id } }),
    onSuccess: () => {
      toast.success("Processo excluído");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["processos-resumo"] });
      qc.invalidateQueries({ queryKey: ["processos"] });
      autoSync(["processos", "painel"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleExportExcel() {
    if (!list.data) return;
    exportToExcel(
      "processos",
      list.data.map((p) => ({
        "Nº CNJ": p.numero_cnj ?? "",
        Autor: p.autor,
        Réu: p.reu,
        Status: STATUS_LABEL[p.status],
        Matéria: p.materia ?? "",
        Área: p.area ?? p.materia ?? "",
        Responsável: p.clientes?.nome ?? "",
        "Data de entrada": p.data_inicio
          ? new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
          : "",
      })),
    );
  }
  function handleExportPdf() {
    if (!list.data) return;
    exportToPdf({
      filename: "processos",
      titulo: "Relatório de Processos",
      subtitulo:
        `${list.data.length} processos` +
        (statusFilter !== "all"
          ? ` — ${STATUS_LABEL[statusFilter as keyof typeof STATUS_LABEL]}`
          : ""),
      columns: [
        { header: "Nº CNJ", dataKey: "cnj" },
        { header: "Autor / Responsável", dataKey: "autor" },
        { header: "Réu", dataKey: "reu" },
        { header: "Status", dataKey: "status" },
        { header: "Matéria", dataKey: "materia" },
        { header: "Área", dataKey: "area" },
        { header: "Data de entrada", dataKey: "entrada" },
      ],
      rows: list.data.map((p) => ({
        cnj: p.numero_cnj ?? "—",
        autor:
          p.clientes?.nome && p.clientes.nome !== p.autor
            ? `${p.autor} / Responsável: ${p.clientes.nome}`
            : p.autor,
        reu: p.reu,
        status: STATUS_LABEL[p.status],
        materia: p.materia ?? "—",
        area: p.area ?? p.materia ?? "—",
        entrada: p.data_inicio
          ? new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
          : "—",
      })),
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="h-full min-h-0 p-4 pb-0 sm:p-6 sm:pb-0 lg:p-10 lg:pb-0 flex flex-col gap-6 max-w-7xl mx-auto w-full overflow-hidden">
      <header className="shrink-0 grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Jurídico</p>
          <h1 className="font-serif text-2xl sm:text-3xl mt-1 truncate">Processos</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!list.data?.length}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!list.data?.length}
          >
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <ImportPlanilhaDialog<ProcessoFormInput>
            triggerLabel="Importar"
            title="Importar processos da planilha"
            columnMap={{
              pasta: ["Pasta"],
              numero_cnj: ["Nº do Processo", "Numero do Processo", "CNJ", "Nº CNJ"],
              tipo_acao: ["Tipo de Ação", "Tipo de Acao"],
              area: ["Área", "Area"],
              autor: ["Autor", "Cliente", "Requerente"],
              reu: ["Réu", "Reu", "Requerido", "Outro Envolvido"],
              cliente_qualificacao: ["Qualificação", "Qualificacao"],
              advogado: ["Advogado"],
              tipo: ["Tipo"],
              fase: ["Fase"],
              instancia: ["Instância", "Instancia"],
              comarca: ["Comarca"],
              vara: ["Vara"],
              data_prazo: ["Data do Prazo", "Prazo"],
              detalhes_prazo: ["Detalhes do Prazo"],
              data_inicio: ["Data de Início do Processo", "Data de Inicio", "Data Início"],
              data_encerramento: ["Data Fim do Processo", "Data Fim"],
              valor_causa: ["Valor da Causa"],
              valor_acordo: ["Valor de Acordo / Sentença", "Valor de Acordo", "Valor Acordo"],
              honorarios_valor: ["Valor Honorários em R$", "Honorários em R$", "Honorarios em R$"],
              honorarios_percentual: [
                "Valor Honorários em %",
                "Honorários em %",
                "Honorarios em %",
              ],
              sucumbencias_valor: ["Sucumbências", "Sucumbencias"],
              resultado: ["Resultado"],
              link_processo: ["Link do Processo"],
              link_pasta: [
                "Link para Pasta de Documentos Digital",
                "Link Pasta",
                "Link para Pasta",
              ],
              observacoes: ["Observações", "Observacoes", "Obs"],
            }}
            fieldTypes={{
              data_prazo: "date",
              data_inicio: "date",
              data_encerramento: "date",
              valor_causa: "number",
              valor_acordo: "number",
              honorarios_valor: "number",
              honorarios_percentual: "number",
              sucumbencias_valor: "number",
            }}
            onImport={async (r) => {
              if (!r.autor && !r.reu) throw new Error("Linha sem Autor nem Réu");
              const cleaned: Record<string, unknown> = { ...r };
              if (cleaned.numero_cnj != null) cleaned.numero_cnj = String(cleaned.numero_cnj);
              await upsertProcesso({
                data: {
                  autor: String(r.autor ?? r.reu ?? "—"),
                  reu: String(r.reu ?? r.autor ?? "—"),
                  status: "inicial",
                  ...cleaned,
                } as ProcessoFormInput,
              });
              qc.invalidateQueries({ queryKey: ["processos-resumo"] });
            }}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> Novo processo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Novo processo</DialogTitle>
              </DialogHeader>
              <ProcessoForm
                clientes={(clientes.data ?? []).filter((cliente) => !cliente.fornecedor)}
                onSubmit={(d) => mSave.mutate(d)}
                loading={mSave.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="shrink-0 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_13rem_11rem_13rem]">
        <div className="min-w-0">
          <Label className="text-xs">Buscar</Label>
          <Input
            placeholder="Autor, réu ou nº CNJ"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_PROCESSO.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Tipo de ação</Label>
          <Select value={tipoAcaoFilter} onValueChange={setTipoAcaoFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(tiposAcao.data ?? []).map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Prazo em aberto</Label>
          <Select value={prazoFilter} onValueChange={setPrazoFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aberto">Sim</SelectItem>
              <SelectItem value="sem_prazo">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Ordenar</Label>
          <Select value={order} onValueChange={(value) => setOrder(value as typeof order)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada_desc">Entrada: recentes primeiro</SelectItem>
              <SelectItem value="entrada_asc">Entrada: antigos primeiro</SelectItem>
              <SelectItem value="cadastro_desc">Cadastro: recentes primeiro</SelectItem>
              <SelectItem value="cadastro_asc">Cadastro: antigos primeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isLoading ? (
        <p className="flex-1 min-h-0 text-sm text-muted-foreground py-10 text-center">
          Carregando…
        </p>
      ) : list.data && list.data.length > 0 ? (
        <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
          <div className="h-full overflow-auto overscroll-contain [scrollbar-gutter:stable]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gold-gradient text-black text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">#</th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Autor / Responsável
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Réu
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Status
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Nº do Processo
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Tipo de Ação
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Área
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Data de entrada
                  </th>
                  <th className="text-center px-3 py-3 font-semibold border border-black/20">
                    Prazo em Aberto?
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {list.data.map((p, idx) => {
                  const isAtivo = p.status !== "arquivado" && p.status !== "suspenso";
                  const autorNormalizado = normalizeName(p.autor);
                  const responsavel = [p.clientes?.nome, p.outro_envolvido].find(
                    (nome) => nome && normalizeName(nome) !== autorNormalizado,
                  );
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setEditing(p)}
                      className="hover:bg-secondary/40 cursor-pointer"
                    >
                      <td className="px-3 py-2 text-center border border-border/60 tabular-nums text-xs text-muted-foreground font-semibold">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60 min-w-40">
                        <span className="block font-medium uppercase">{p.autor || "—"}</span>
                        {responsavel && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Responsável: {responsavel}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60 min-w-40">
                        {p.reu || "—"}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60">
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-semibold border ${isAtivo ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs whitespace-nowrap border border-border/60">
                        {p.numero_cnj ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60">
                        {p.tipo_acao ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60">
                        {p.area?.trim() || p.materia?.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60 whitespace-nowrap">
                        {p.data_inicio
                          ? new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center border border-border/60">
                        <span
                          className={
                            p.prazo_em_aberto
                              ? "text-primary font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {p.prazo_em_aberto ? "Sim" : "Não"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="flex-1 min-h-0 border-border/60 rounded-md">
          <CardContent className="py-14 text-center text-muted-foreground text-sm">
            Nenhum processo encontrado.
          </CardContent>
        </Card>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {editing && (
            <div className="flex flex-col">
              <SheetHeader className="p-6 pb-4 border-b border-border/60">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {editing.numero_cnj ?? "Sem CNJ"}
                </p>
                <SheetTitle className="font-serif text-2xl">
                  {editing.autor} <span className="text-muted-foreground">×</span> {editing.reu}
                </SheetTitle>
                <SheetDescription>
                  Edite os dados do processo e acompanhe o progresso.
                </SheetDescription>
              </SheetHeader>

              <div className="p-6 space-y-6">
                <EditingTimeline processoId={editing.id} status={editing.status} />
                <ProcessoForm
                  key={editing.id}
                  clientes={(clientes.data ?? []).filter((cliente) => !cliente.fornecedor)}
                  initial={editing}
                  submitLabel="Salvar alterações"
                  submitIcon="save"
                  onSubmit={(d) => mSave.mutate({ ...d, id: editing.id })}
                  loading={mSave.isPending}
                />
                <Link
                  to="/processos/$id"
                  params={{ id: editing.id }}
                  className="text-xs text-accent underline block text-center"
                >
                  Abrir página completa (andamentos e financeiro)
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={mDelete.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Excluir definitivamente o processo ${editing.numero_cnj ?? editing.autor}?`,
                      )
                    ) {
                      mDelete.mutate(editing.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir processo
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EditingTimeline({
  processoId,
  status,
}: {
  processoId: string;
  status: (typeof STATUS_PROCESSO)[number];
}) {
  const andam = useQuery({
    queryKey: ["andamentos", processoId],
    queryFn: () => listAndamentos({ data: { processo_id: processoId } }),
  });
  return (
    <ProcessTimeline
      status={status}
      totalAndamentos={andam.data?.length ?? 0}
      ultimoAndamento={
        andam.data && andam.data.length > 0
          ? { data: andam.data[0].data, titulo: andam.data[0].titulo }
          : null
      }
    />
  );
}

function ProcessoForm({
  clientes,
  onSubmit,
  loading,
  initial,
  submitLabel = "Salvar processo",
  submitIcon,
}: {
  clientes: ClienteRow[];
  onSubmit: (d: ProcessoFormInput) => void;
  loading: boolean;
  initial?: Partial<ProcessoFormInput> | null;
  submitLabel?: string;
  submitIcon?: "save";
}) {
  const [form, setForm] = useState<ProcessoFormInput>({
    numero_cnj: initial?.numero_cnj ?? "",
    pasta: initial?.pasta ?? "",
    autor: initial?.autor ?? "",
    reu: initial?.reu ?? "",
    status: initial?.status ?? "inicial",
    materia: initial?.materia ?? "",
    tipo_acao: initial?.tipo_acao ?? "",
    instancia: initial?.instancia ?? "",
    area: initial?.area ?? "",
    fase: initial?.fase ?? "",
    tipo: initial?.tipo ?? "",
    advogado: initial?.advogado ?? "",
    vara: initial?.vara ?? "",
    tribunal: initial?.tribunal ?? "",
    comarca: initial?.comarca ?? "",
    data_protocolo: initial?.data_protocolo ?? "",
    data_inicio: initial?.data_inicio ?? (initial ? "" : new Date().toISOString().slice(0, 10)),
    data_encerramento: initial?.data_encerramento ?? "",
    prazo_em_aberto: initial?.prazo_em_aberto ?? false,
    data_prazo: initial?.data_prazo ?? "",
    detalhes_prazo: initial?.detalhes_prazo ?? "",
    origem: initial?.origem ?? "",
    valor_causa: initial?.valor_causa ?? null,
    valor_acordo: initial?.valor_acordo ?? null,
    honorarios_valor: initial?.honorarios_valor ?? null,
    honorarios_percentual: initial?.honorarios_percentual ?? null,
    sucumbencias_percentual: initial?.sucumbencias_percentual ?? null,
    sucumbencias_valor: initial?.sucumbencias_valor ?? null,
    cliente_id: initial?.cliente_id ?? null,
    cliente_qualificacao: initial?.cliente_qualificacao ?? "",
    outro_envolvido: initial?.outro_envolvido ?? "",
    outro_envolvido_cliente_id: initial?.outro_envolvido_cliente_id ?? null,
    outro_envolvido_qualificacao: initial?.outro_envolvido_qualificacao ?? "",
    link_processo: initial?.link_processo ?? "",
    link_pasta: initial?.link_pasta ?? "",
    resultado: initial?.resultado ?? "",
    observacoes: initial?.observacoes ?? "",
  });

  const catTipos = useQuery({
    queryKey: ["catalogo", "tipo_acao"],
    queryFn: () => listCatalogo({ data: { categoria: "tipo_acao" } }),
    staleTime: 60_000,
  });
  const catMaterias = useQuery({
    queryKey: ["catalogo", "materia"],
    queryFn: () => listCatalogo({ data: { categoria: "materia" } }),
    staleTime: 60_000,
  });
  const catFases = useQuery({
    queryKey: ["catalogo", "fase"],
    queryFn: () => listCatalogo({ data: { categoria: "fase" } }),
    staleTime: 60_000,
  });
  const catAdvogados = useQuery({
    queryKey: ["catalogo", "advogado"],
    queryFn: () => listCatalogo({ data: { categoria: "advogado" } }),
    staleTime: 60_000,
  });
  const referenceOptions = useQuery({
    queryKey: ["processos-reference-options"],
    queryFn: () => listProcessoReferenceOptions(),
    staleTime: 60_000,
  });
  const clienteAutor = clientes.find(
    (cliente) => normalizeName(cliente.nome) === normalizeName(form.autor),
  );
  const vinculos = useQuery({
    queryKey: ["vinculos", clienteAutor?.id ?? "none"],
    queryFn: () => listVinculos({ data: { cliente_principal_id: clienteAutor!.id } }),
    enabled: !!clienteAutor,
  });
  useEffect(() => {
    if (!clienteAutor || vinculos.data?.length !== 1) return;
    const vinculo = vinculos.data[0];
    setForm((atual) => {
      if (atual.cliente_id && atual.cliente_id !== clienteAutor.id) return atual;
      return {
        ...atual,
        cliente_id: vinculo.cliente_vinculado_id,
        cliente_qualificacao:
          atual.cliente_qualificacao?.trim() || vinculo.parentesco || "Representante legal",
      };
    });
  }, [clienteAutor, vinculos.data]);
  function set<K extends keyof ProcessoFormInput>(k: K, v: ProcessoFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const clienteSelecionado = clientes.find((cliente) => cliente.id === form.cliente_id);
  const enderecoCliente = clienteSelecionado
    ? [
        clienteSelecionado.endereco,
        clienteSelecionado.bairro,
        clienteSelecionado.cidade,
        clienteSelecionado.estado,
        clienteSelecionado.cep ? `CEP ${clienteSelecionado.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const baseCalculo = Number(form.valor_acordo ?? 0) || 0;
  const percentual = (value: number | null | undefined) => {
    const numeric = Number(value ?? 0) || 0;
    return numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  };
  const honorariosPercentualValor = (baseCalculo * percentual(form.honorarios_percentual)) / 100;
  const sucumbenciasPercentualValor =
    (baseCalculo * percentual(form.sucumbencias_percentual)) / 100;
  const totalHonorarios =
    (Number(form.honorarios_valor ?? 0) || 0) +
    honorariosPercentualValor +
    (Number(form.sucumbencias_valor ?? 0) || 0) +
    sucumbenciasPercentualValor;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="gerais">Dados Gerais</TabsTrigger>
          <TabsTrigger value="complementares">Complementares</TabsTrigger>
          <TabsTrigger value="valores">Valores</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
            <div>
              <Label>Nº Processo (CNJ)</Label>
              <Input
                value={form.numero_cnj ?? ""}
                onChange={(e) => set("numero_cnj", e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as ProcessoFormInput["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_PROCESSO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="prazo-aberto"
                checked={!!form.prazo_em_aberto}
                onCheckedChange={(c: CheckedState) => set("prazo_em_aberto", c === true)}
              />
              <Label htmlFor="prazo-aberto" className="cursor-pointer">
                Prazo em aberto?
              </Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
              <div>
                <Label>Data do prazo</Label>
                <Input
                  type="date"
                  value={form.data_prazo ?? ""}
                  onChange={(e) => set("data_prazo", e.target.value)}
                />
              </div>
              <div>
                <Label>Detalhes do prazo</Label>
                <Input
                  value={form.detalhes_prazo ?? ""}
                  onChange={(e) => set("detalhes_prazo", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Ação</Label>
              <CatalogoCombobox
                value={form.tipo_acao ?? ""}
                onValueChange={(v) => set("tipo_acao", v)}
                options={catTipos.data?.map((o) => o.valor) ?? []}
                placeholder="Selecione o tipo de ação"
              />
            </div>
            <div>
              <Label>Matéria</Label>
              <CatalogoCombobox
                value={form.materia ?? ""}
                onValueChange={(v) => set("materia", v)}
                options={catMaterias.data?.map((o) => o.valor) ?? []}
                placeholder="Selecione a matéria"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Autor</Label>
              <Input required value={form.autor} onChange={(e) => set("autor", e.target.value)} />
            </div>
            <div>
              <Label>Réu</Label>
              <Input required value={form.reu} onChange={(e) => set("reu", e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Representante</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <SearchableClientPicker
                  value={form.cliente_id ?? "__none__"}
                  clients={clientes}
                  excludeIds={clienteAutor ? [clienteAutor.id] : []}
                  placeholder="Busque pelo nome do representante"
                  searchPlaceholder="Digite as letras do representante..."
                  emptyOptionLabel="Sem representante"
                  onValueChange={(v) => {
                    const clienteId = v === "__none__" ? null : v;
                    const vinculo = vinculos.data?.find(
                      (item) => item.cliente_vinculado_id === clienteId,
                    );
                    setForm((atual) => ({
                      ...atual,
                      cliente_id: clienteId,
                      cliente_qualificacao:
                        clienteId === null
                          ? ""
                          : vinculo?.parentesco ||
                            atual.cliente_qualificacao ||
                            "Representante legal",
                    }));
                  }}
                />
              </div>
              <div>
                <Label>Qualificação</Label>
                <Input
                  value={form.cliente_qualificacao ?? ""}
                  onChange={(e) => set("cliente_qualificacao", e.target.value)}
                  placeholder="Ex.: mãe, pai, representante legal"
                />
              </div>
            </div>
            {clienteAutor && vinculos.data && vinculos.data.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Representante(s) vinculado(s) a {clienteAutor.nome}:{" "}
                {vinculos.data
                  .map((vinculo) => vinculo.cliente_vinculado?.nome)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {clienteSelecionado && (
              <div className="rounded-md bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Dados do representante carregados do cadastro
                </p>
                <p className="mt-1">
                  {[
                    clienteSelecionado.cpf_cnpj ? `CPF/CNPJ: ${clienteSelecionado.cpf_cnpj}` : null,
                    clienteSelecionado.telefone ? `Telefone: ${clienteSelecionado.telefone}` : null,
                    clienteSelecionado.email ? `E-mail: ${clienteSelecionado.email}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Documento e contato ainda não informados."}
                </p>
                {enderecoCliente && <p className="mt-1">{enderecoCliente}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Advogado</Label>
              <CatalogoCombobox
                value={form.advogado ?? ""}
                onValueChange={(v) => set("advogado", v)}
                options={catAdvogados.data?.map((o) => o.valor) ?? []}
                placeholder="Selecione o advogado"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <CatalogoCombobox
                value={form.tipo ?? ""}
                onValueChange={(v) => set("tipo", v)}
                options={mergeOptions(referenceOptions.data?.tipo)}
                placeholder="Selecione o tipo"
              />
            </div>
            <div>
              <Label>Fase</Label>
              <CatalogoCombobox
                value={form.fase ?? ""}
                onValueChange={(v) => set("fase", v)}
                options={catFases.data?.map((o) => o.valor) ?? []}
                placeholder="Selecione a fase"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="complementares" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Instância</Label>
              <Input
                value={form.instancia ?? ""}
                onChange={(e) => set("instancia", e.target.value)}
              />
            </div>
            <div>
              <Label>Área</Label>
              <Input value={form.area ?? ""} onChange={(e) => set("area", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Comarca</Label>
              <Input value={form.comarca ?? ""} onChange={(e) => set("comarca", e.target.value)} />
            </div>
            <div>
              <Label>Vara</Label>
              <Input value={form.vara ?? ""} onChange={(e) => set("vara", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tribunal</Label>
              <Input
                value={form.tribunal ?? ""}
                onChange={(e) => set("tribunal", e.target.value)}
              />
            </div>
            <div>
              <Label>Resultado</Label>
              <Input
                value={form.resultado ?? ""}
                onChange={(e) => set("resultado", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Data de protocolo</Label>
              <Input
                type="date"
                value={form.data_protocolo ?? ""}
                onChange={(e) => set("data_protocolo", e.target.value)}
              />
            </div>
            <div>
              <Label>Dt. Início do processo</Label>
              <Input
                type="date"
                value={form.data_inicio ?? ""}
                onChange={(e) => set("data_inicio", e.target.value)}
              />
            </div>
            <div>
              <Label>Dt. Fim do processo</Label>
              <Input
                type="date"
                value={form.data_encerramento ?? ""}
                onChange={(e) => set("data_encerramento", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Link do processo</Label>
            <Input
              value={form.link_processo ?? ""}
              onChange={(e) => set("link_processo", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Link para pasta</Label>
            <Input
              value={form.link_pasta ?? ""}
              onChange={(e) => set("link_pasta", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Origem / Indicação</Label>
            <Input
              value={form.origem ?? ""}
              onChange={(e) => set("origem", e.target.value)}
              placeholder="Quem indicou"
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="valores" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Valor da Causa (R$)</Label>
              <CurrencyInput
                value={form.valor_causa}
                onValueChange={(value) => set("valor_causa", value)}
              />
            </div>
            <div>
              <Label>Valor de Acordo / Sentença (R$)</Label>
              <CurrencyInput
                value={form.valor_acordo}
                onValueChange={(value) => set("valor_acordo", value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Honorários em R$</Label>
              <CurrencyInput
                value={form.honorarios_valor}
                onValueChange={(value) => set("honorarios_valor", value)}
              />
            </div>
            <div>
              <Label>Honorários em %</Label>
              <Input
                type="number"
                step="0.01"
                value={form.honorarios_percentual ?? ""}
                onChange={(e) => set("honorarios_percentual", num(e.target.value))}
              />
            </div>
            <div>
              <Label>Sucumbências (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.sucumbencias_percentual ?? ""}
                onChange={(e) => set("sucumbencias_percentual", num(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Sucumbências em R$</Label>
              <CurrencyInput
                value={form.sucumbencias_valor}
                onValueChange={(value) => set("sucumbencias_valor", value)}
              />
            </div>
            <div>
              <Label>Total em Honorários (R$)</Label>
              <Input readOnly value={formatBRL(totalHonorarios)} className="bg-muted" />
            </div>
          </div>
          <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Total em honorários
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
              {formatBRL(totalHonorarios)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Honorários de entrada, percentual sobre o acordo/sentença e sucumbências.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Valores monetários são exibidos com centavos: 10.000,00.
          </p>
        </TabsContent>
      </Tabs>

      <Button type="submit" className="w-full" disabled={loading}>
        {submitIcon === "save" && <Save className="w-4 h-4 mr-2" />}
        {loading ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

function mergeOptions(...groups: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function CurrencyInput({
  value,
  onValueChange,
}: {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
}) {
  const format = (amount: number | null | undefined) =>
    amount == null
      ? ""
      : amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [text, setText] = useState(format(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(format(value));
  }, [value, editing]);

  const parse = (raw: string): number | null => {
    const clean = raw.replace(/[^0-9,.-]/g, "").trim();
    if (!clean) return null;
    const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };

  return (
    <Input
      inputMode="decimal"
      value={text}
      placeholder="0,00"
      onFocus={() => {
        setEditing(true);
        setText(value == null ? "" : value.toFixed(2));
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        onValueChange(parse(next));
      }}
      onBlur={() => {
        setEditing(false);
        setText(format(parse(text)));
      }}
    />
  );
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
