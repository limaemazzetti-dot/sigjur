import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import {
  listProcessosResumo,
  listProcessoFilterOptions,
  listProcessoReferenceOptions,
  upsertProcesso,
  deleteProcesso,
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
import { useAutoSync } from "@/lib/use-auto-sync";
import { ImportPlanilhaDialog } from "@/components/import-planilha-dialog";
import { CatalogoCombobox } from "@/components/catalogo-combobox";
import { SearchableClientPicker } from "@/components/searchable-client-picker";
import { CurrencyInput } from "@/components/currency-input";
import { PercentageInput } from "@/components/percentage-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listStatusProcesso } from "@/lib/status-processo.functions";
import { listIndicacoes, type IndicacaoRow } from "@/lib/indicacoes.functions";

export const Route = createFileRoute("/_authenticated/processos")({
  component: ProcessosRoute,
});

function ProcessosRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isProcessoDetalhe = /^\/processos\/[^/]+\/?$/.test(pathname);
  return isProcessoDetalhe ? <Outlet /> : <ProcessosPage />;
}

function splitAdvogados(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function AdvogadosMultiSelect({
  value,
  options,
  onValueChange,
}: {
  value: string | null | undefined;
  options: string[];
  onValueChange: (value: string) => void;
}) {
  const selecionados = splitAdvogados(value);
  const alterarSelecao = (advogado: string, marcado: boolean) => {
    const proximos = marcado
      ? [...new Set([...selecionados, advogado])]
      : selecionados.filter((item) => item !== advogado);
    onValueChange(proximos.join(", "));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="h-10 w-full justify-start text-left font-normal"
        >
          <span className="truncate">
            {selecionados.length ? selecionados.join(", ") : "Selecione um ou mais advogados"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {options.map((advogado) => {
            const marcado = selecionados.includes(advogado);
            return (
              <label
                key={advogado}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={marcado}
                  onCheckedChange={(checked) => alterarSelecao(advogado, checked === true)}
                />
                <span>{advogado}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Cadastre advogados ativos em Cadastros primeiro.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProcessosPage() {
  const qc = useQueryClient();
  const autoSync = useAutoSync();
  const [busca, setBusca] = useState("");
  const buscaDeferred = useDeferredValue(busca);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState("all");
  const [autorFilter, setAutorFilter] = useState("");
  const [reuFilter, setReuFilter] = useState("");
  const [numeroFilter, setNumeroFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [indicacaoFilter, setIndicacaoFilter] = useState("all");
  const [entradaDeFilter, setEntradaDeFilter] = useState("");
  const [entradaAteFilter, setEntradaAteFilter] = useState("");
  const [prazoFilter, setPrazoFilter] = useState("all");
  const [order, setOrder] = useState<
    "entrada_desc" | "entrada_asc" | "cadastro_desc" | "cadastro_asc"
  >("entrada_desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoResumoRow | null>(null);

  const list = useQuery({
    queryKey: [
      "processos-resumo",
      buscaDeferred,
      statusFilter,
      tipoAcaoFilter,
      autorFilter,
      reuFilter,
      numeroFilter,
      areaFilter,
      indicacaoFilter,
      entradaDeFilter,
      entradaAteFilter,
      prazoFilter,
      order,
    ],
    queryFn: () =>
      listProcessosResumo({
        data: {
          q: buscaDeferred || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          tipo_acao: tipoAcaoFilter !== "all" ? tipoAcaoFilter : undefined,
          autor: autorFilter || undefined,
          reu: reuFilter || undefined,
          numero_cnj: numeroFilter || undefined,
          area: areaFilter || undefined,
          indicacao_id: indicacaoFilter !== "all" ? indicacaoFilter : undefined,
          data_inicio_de: entradaDeFilter || undefined,
          data_inicio_ate: entradaAteFilter || undefined,
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
  const statusOpcoes = useQuery({
    queryKey: ["status-processo"],
    queryFn: () => listStatusProcesso({ data: {} }),
    staleTime: 60_000,
  });
  const indicacoes = useQuery({
    queryKey: ["indicacoes"],
    queryFn: () => listIndicacoes({ data: {} }),
    staleTime: 60_000,
  });
  const statusLabels = {
    ...STATUS_LABEL,
    ...Object.fromEntries((statusOpcoes.data ?? []).map((item) => [item.codigo, item.nome])),
  };

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
        Status: statusLabels[p.status] ?? p.status,
        Matéria: p.materia ?? "",
        Área: p.area ?? p.materia ?? "",
        Responsável: p.clientes?.nome ?? "",
        Indicador: p.indicacoes?.nome ?? "",
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
        (statusFilter !== "all" ? ` — ${statusLabels[statusFilter] ?? statusFilter}` : ""),
      columns: [
        { header: "Nº CNJ", dataKey: "cnj" },
        { header: "Autor / Responsável", dataKey: "autor" },
        { header: "Réu", dataKey: "reu" },
        { header: "Status", dataKey: "status" },
        { header: "Matéria", dataKey: "materia" },
        { header: "Área", dataKey: "area" },
        { header: "Data de entrada", dataKey: "entrada" },
        { header: "Indicador", dataKey: "indicacao" },
      ],
      rows: list.data.map((p) => ({
        cnj: p.numero_cnj ?? "—",
        autor:
          p.clientes?.nome && p.clientes.nome !== p.autor
            ? `${p.autor} / Responsável: ${p.clientes.nome}`
            : p.autor,
        reu: p.reu,
        status: statusLabels[p.status] ?? p.status,
        materia: p.materia ?? "—",
        area: p.area ?? p.materia ?? "—",
        entrada: p.data_inicio
          ? new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
          : "—",
        indicacao: p.indicacoes?.nome ?? "—",
      })),
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="h-full min-h-0 p-4 pb-0 sm:p-6 sm:pb-0 xl:px-6 xl:pb-0 2xl:px-8 2xl:pb-0 flex flex-col gap-6 max-w-none mx-auto w-full min-w-0 overflow-x-hidden">
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
            <DialogContent className="max-w-3xl max-h-none overflow-visible overflow-y-visible">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Novo processo</DialogTitle>
              </DialogHeader>
              <ProcessoForm
                clientes={(clientes.data ?? []).filter((cliente) => !cliente.fornecedor)}
                indicacoes={indicacoes.data ?? []}
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
              {(statusOpcoes.data ?? []).map((s) => (
                <SelectItem key={s.codigo} value={s.codigo}>
                  {s.nome}
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

      <div className="shrink-0 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="min-w-0">
          <Label className="text-xs">Autor / responsável</Label>
          <Input
            value={autorFilter}
            onChange={(e) => setAutorFilter(e.target.value)}
            placeholder="Filtrar"
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Réu</Label>
          <Input
            value={reuFilter}
            onChange={(e) => setReuFilter(e.target.value)}
            placeholder="Filtrar"
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Nº do processo</Label>
          <Input
            value={numeroFilter}
            onChange={(e) => setNumeroFilter(e.target.value)}
            placeholder="Filtrar"
            inputMode="numeric"
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Área</Label>
          <Input
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            placeholder="Filtrar"
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Indicador</Label>
          <Select value={indicacaoFilter} onValueChange={setIndicacaoFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(indicacoes.data ?? []).map((indicacao) => (
                <SelectItem key={indicacao.id} value={indicacao.id}>
                  {indicacao.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Entrada a partir de</Label>
          <Input
            type="date"
            value={entradaDeFilter}
            onChange={(e) => setEntradaDeFilter(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Entrada até</Label>
          <Input
            type="date"
            value={entradaAteFilter}
            onChange={(e) => setEntradaAteFilter(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setBusca("");
              setStatusFilter("all");
              setTipoAcaoFilter("all");
              setAutorFilter("");
              setReuFilter("");
              setNumeroFilter("");
              setAreaFilter("");
              setIndicacaoFilter("all");
              setEntradaDeFilter("");
              setEntradaAteFilter("");
              setPrazoFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <p className="flex-1 min-h-0 text-sm text-muted-foreground py-10 text-center">
          Carregando…
        </p>
      ) : list.data && list.data.length > 0 ? (
        <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
          <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
            <table className="w-full table-fixed text-sm border-collapse">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="text-black text-xs uppercase tracking-wide">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-1 py-3 font-semibold border border-black/20">
                    #
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Autor / Responsável
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Réu
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Status
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Nº do Processo
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Tipo de Ação
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Área
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Data de entrada
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Prazo em Aberto?
                  </th>
                  <th className="sticky top-0 z-20 bg-[#d2b16f] text-center px-2 py-3 font-semibold leading-tight break-words border border-black/20">
                    Indicador
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
                      <td className="px-1 py-2 text-center border border-border/60 tabular-nums text-xs text-muted-foreground font-semibold">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        <span className="block font-medium uppercase">{p.autor || "—"}</span>
                        {responsavel && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Responsável: {responsavel}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        {p.reu || "—"}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-semibold border ${isAtivo ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}
                        >
                          {statusLabels[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center align-top font-mono text-xs break-all border border-border/60">
                        {p.numero_cnj ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        {p.tipo_acao ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        {p.area?.trim() || p.materia?.trim() || "—"}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 whitespace-normal break-words">
                        {p.data_inicio
                          ? new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
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
                      <td className="px-2 py-2 text-center align-top border border-border/60 break-words">
                        {p.indicacoes?.nome ?? "—"}
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
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-xl"
        >
          {editing && (
            <div className="flex min-h-0 flex-1 flex-col">
              <SheetHeader className="shrink-0 border-b border-border/60 p-6 pb-4">
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

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                <ProcessoForm
                  key={editing.id}
                  clientes={(clientes.data ?? []).filter((cliente) => !cliente.fornecedor)}
                  indicacoes={indicacoes.data ?? []}
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

function ProcessoForm({
  clientes,
  indicacoes,
  onSubmit,
  loading,
  initial,
  submitLabel = "Salvar processo",
  submitIcon,
}: {
  clientes: ClienteRow[];
  indicacoes: IndicacaoRow[];
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
    indicacao_id: initial?.indicacao_id ?? null,
    valor_causa: initial?.valor_causa ?? null,
    valor_acordo: initial?.valor_acordo ?? null,
    honorarios_valor: initial?.honorarios_valor ?? null,
    honorarios_percentual: initial?.honorarios_percentual ?? null,
    sucumbencias_percentual: initial?.sucumbencias_percentual ?? null,
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
  const statusOpcoes = useQuery({
    queryKey: ["status-processo"],
    queryFn: () => listStatusProcesso({ data: {} }),
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
  const honorariosContratuais = Number(form.honorarios_valor ?? 0) || 0;
  const totalHonorarios =
    honorariosContratuais + honorariosPercentualValor + sucumbenciasPercentualValor;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="gerais">Geral</TabsTrigger>
          <TabsTrigger value="partes-prazos">Partes e prazo</TabsTrigger>
          <TabsTrigger value="complementares">Detalhes</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
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
                  {(statusOpcoes.data ?? []).map((s) => (
                    <SelectItem key={s.codigo} value={s.codigo}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                allowCustom={false}
              />
            </div>
            <div>
              <Label>Matéria</Label>
              <CatalogoCombobox
                value={form.materia ?? ""}
                onValueChange={(v) => set("materia", v)}
                options={catMaterias.data?.map((o) => o.valor) ?? []}
                placeholder="Selecione a matéria"
                allowCustom={false}
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
        </TabsContent>

        <TabsContent value="partes-prazos" className="space-y-4 pt-4">
          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <p className="text-sm font-medium">Prazo do processo</p>
            <p className="text-xs text-muted-foreground">
              Ao informar uma data, o processo será marcado automaticamente como tendo prazo em
              aberto. Audiências e perícias pendentes também atualizam essa informação.
            </p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <Label>Advogado(s)</Label>
              <AdvogadosMultiSelect
                value={form.advogado ?? ""}
                onValueChange={(v) => set("advogado", v)}
                options={catAdvogados.data?.map((o) => o.valor) ?? []}
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
                allowCustom={false}
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
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4 pt-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Indicador</Label>
              <Select
                value={form.indicacao_id ?? "__none__"}
                onValueChange={(value) => set("indicacao_id", value === "__none__" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione quem indicou" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem indicador</SelectItem>
                  {indicacoes.map((indicacao) => (
                    <SelectItem key={indicacao.id} value={indicacao.id}>
                      {indicacao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem / Observação da indicação</Label>
              <Input
                value={form.origem ?? ""}
                onChange={(e) => set("origem", e.target.value)}
                placeholder="Ex.: indicação recebida pelo WhatsApp"
              />
            </div>
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
              <Label>Total em Honorários (R$)</Label>
              <Input
                readOnly
                value={formatBRL(totalHonorarios)}
                className="bg-primary/10 border-primary/40 text-lg font-bold tabular-nums text-primary"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Label>Honorários contratuais (R$)</Label>
              <CurrencyInput
                value={form.honorarios_valor}
                onValueChange={(value) => set("honorarios_valor", value)}
              />
            </div>
            <div className="lg:col-span-2">
              <Label>Honorários em %</Label>
              <PercentageInput
                value={form.honorarios_percentual}
                onValueChange={(value) => set("honorarios_percentual", value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBRL(honorariosPercentualValor)} em honorários.
              </p>
            </div>
            <div className="lg:col-span-2">
              <Label>Sucumbências (%)</Label>
              <PercentageInput
                value={form.sucumbencias_percentual}
                onValueChange={(value) => set("sucumbencias_percentual", value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBRL(sucumbenciasPercentualValor)} em sucumbências.
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-6">
              <Label>Valor da Causa (R$)</Label>
              <CurrencyInput
                value={form.valor_causa}
                onValueChange={(value) => set("valor_causa", value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Contratuais {formatBRL(honorariosContratuais)} + percentuais{" "}
                {formatBRL(honorariosPercentualValor)} + sucumbências percentuais{" "}
                {formatBRL(sucumbenciasPercentualValor)}. Os percentuais usam o valor de
                acordo/sentença como base de cálculo.
              </p>
            </div>
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

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
