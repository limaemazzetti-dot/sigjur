import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  deleteLancamento,
  listLancamentos,
  listPlanoContas,
  upsertLancamento,
  prepareNotaFiscalUpload,
  setNotaFiscal,
  getNotaFiscalUrl,
} from "@/lib/lancamentos.functions";

import { listProcessos } from "@/lib/processos.functions";
import { listFornecedores } from "@/lib/clientes.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  FileSpreadsheet,
  FileText,
  Pencil,
  ArrowLeft,
  Paperclip,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { exportToExcel, exportToPdf, formatBRL } from "@/lib/export";
import { useAutoSync } from "@/lib/use-auto-sync";
import { SearchableProcessPicker } from "@/components/searchable-process-picker";
import { SearchableClientPicker } from "@/components/searchable-client-picker";

const searchSchema = z.object({
  q: z.string().optional(),
  ano: z.coerce.number().optional(),
  mes: z.coerce.number().optional(),
  categoria: z.string().optional(),
  tipo: z.enum(["entrada", "saida"]).optional(),
  status: z.enum(["pago", "pendente", "atrasado"]).optional(),
});

const COMPROVANTE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

function isComprovanteMimeType(value: string): value is (typeof COMPROVANTE_MIME_TYPES)[number] {
  return COMPROVANTE_MIME_TYPES.some((mime) => mime === value);
}

export const Route = createFileRoute("/_authenticated/financeiro/lancamentos")({
  validateSearch: (s) => searchSchema.parse(s),
  component: LancamentosPage,
});

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function isOverdue(data: string, status: string) {
  return status === "pendente" && data < new Date().toISOString().slice(0, 10);
}

function processoNome(
  processo:
    | {
        clientes?: { nome?: string | null } | null;
        autor?: string | null;
      }
    | null
    | undefined,
) {
  return processo?.clientes?.nome || processo?.autor || "Cliente não informado";
}

function processoPartes(
  processo:
    | {
        autor?: string | null;
        reu?: string | null;
      }
    | null
    | undefined,
) {
  const partes = [
    processo?.autor ? `Autor: ${processo.autor}` : null,
    processo?.reu ? `Réu: ${processo.reu}` : null,
  ].filter(Boolean);
  return partes.join(" · ") || "Partes não informadas";
}

function entidadeFinanceira(lancamento: {
  tipo?: string | null;
  processos?: {
    clientes?: { nome?: string | null } | null;
    autor?: string | null;
    reu?: string | null;
  } | null;
  fornecedores?: {
    nome?: string | null;
    cpf_cnpj?: string | null;
    telefone?: string | null;
  } | null;
}) {
  if (lancamento.tipo === "saida") {
    const fornecedor = lancamento.fornecedores;
    return {
      nome: fornecedor?.nome || "Fornecedor não informado",
      detalhes:
        [
          fornecedor?.cpf_cnpj ? `CPF/CNPJ: ${fornecedor.cpf_cnpj}` : null,
          fornecedor?.telefone ? `Telefone: ${fornecedor.telefone}` : null,
        ]
          .filter(Boolean)
          .join(" · ") ||
        (fornecedor
          ? "CPF/CNPJ e telefone não informados"
          : "Cadastre ou selecione o fornecedor ao editar"),
    };
  }
  return {
    nome: processoNome(lancamento.processos),
    detalhes: processoPartes(lancamento.processos),
  };
}

function LancamentosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const now = new Date();
  const ano = search.ano ?? now.getFullYear();
  const mes = search.mes ?? null;

  const fetchLanc = listLancamentos;
  const fetchCats = listPlanoContas;
  const upsert = upsertLancamento;
  const remove = deleteLancamento;
  const qc = useQueryClient();
  const autoSync = useAutoSync();

  const cats = useQuery({
    queryKey: ["plano-contas"],
    queryFn: () => fetchCats({}),
    staleTime: 5 * 60_000,
  });
  const fetchProcessos = listProcessos;
  const processos = useQuery({
    queryKey: ["processos-lite"],
    queryFn: () => fetchProcessos({ data: {} }),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const fornecedores = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => listFornecedores(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const lanc = useQuery({
    queryKey: ["lancamentos", ano, mes, search.categoria, search.tipo, search.status, search.q],
    queryFn: () =>
      fetchLanc({
        data: {
          q: search.q,
          ano,
          mes: mes ?? undefined,
          categoria_id: search.categoria,
          tipo: search.tipo,
          status: search.status,
        },
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const processosOrdenados = useMemo(
    () =>
      [...(processos.data ?? [])].sort((a, b) => {
        const nomeA = normalizeText(processoNome(a));
        const nomeB = normalizeText(processoNome(b));
        return (
          nomeA.localeCompare(nomeB, "pt-BR") ||
          normalizeText(a.numero_cnj).localeCompare(normalizeText(b.numero_cnj), "pt-BR")
        );
      }),
    [processos.data],
  );

  const saveNota = useServerFn(setNotaFiscal);
  const prepareNotaUpload = useServerFn(prepareNotaFiscalUpload);
  const mSave = useMutation({
    mutationFn: async ({ data, comprovante }: { data: FormData; comprovante: File | null }) => {
      const saved = await upsert({ data });
      if (comprovante && saved.id) {
        if (!isComprovanteMimeType(comprovante.type)) {
          throw new Error("Formato não permitido. Use PDF, JPG, PNG ou WEBP.");
        }
        const contentType = comprovante.type;
        const prepared = await prepareNotaUpload({
          data: {
            id: saved.id,
            file_name: comprovante.name,
            content_type: contentType,
            size: comprovante.size,
          },
        });
        const { error } = await supabase.storage
          .from("notas-fiscais")
          .uploadToSignedUrl(prepared.path, prepared.token, comprovante, {
            contentType,
          });
        if (error) {
          throw new Error(
            `O lançamento foi salvo, mas não foi possível anexar o comprovante: ${error.message}`,
          );
        }
        await saveNota({ data: { id: saved.id, path: prepared.path } });
      }
      return saved;
    },
    onSuccess: () => {
      toast.success("Lançamento salvo");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
      autoSync(["lancamentos", "dre", "painel"]);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (vars: { id: string }) => remove({ data: vars }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
      autoSync(["lancamentos", "dre", "painel"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function askAndDelete(id: string) {
    if (!window.confirm("Confirmar exclusão deste lançamento?")) return;
    mDelete.mutate({ id });
  }

  type LancamentoRow = NonNullable<typeof lanc.data>[number];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LancamentoRow | null>(null);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(l: LancamentoRow) {
    setEditing(l);
    setOpen(true);
  }
  function handleDialogChange(v: boolean) {
    setOpen(v);
    if (!v) setEditing(null);
  }

  function updateSearch(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });
  }

  const total = useMemo(
    () =>
      lanc.data?.reduce(
        (acc, l) => {
          if (l.status !== "pago") {
            if (l.tipo === "entrada") acc.pendentesEntrada += Number(l.valor);
            else acc.pendentesSaida += Number(l.valor);
            return acc;
          }
          if (l.tipo === "entrada") acc.entradas += Number(l.valor);
          else acc.saidas += Number(l.valor);
          return acc;
        },
        { entradas: 0, saidas: 0, pendentesEntrada: 0, pendentesSaida: 0 },
      ),
    [lanc.data],
  );

  const periodoLabel = mes ? `${MESES[mes - 1]}/${ano}` : `Ano de ${ano}`;
  const dreSearch = mes
    ? {
        inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
        fim: `${ano}-${String(mes).padStart(2, "0")}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`,
      }
    : { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };

  function handleExportExcel() {
    if (!lanc.data) return;
    exportToExcel(
      `lancamentos-${ano}${mes ? "-" + String(mes).padStart(2, "0") : ""}`,
      lanc.data.map((l) => ({
        Data: new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR"),
        Descrição: l.descricao,
        Processo: l.processos?.numero_cnj ?? "",
        "Cliente / Fornecedor": entidadeFinanceira(l).nome,
        "Partes / Dados do fornecedor": entidadeFinanceira(l).detalhes,
        Observações: l.observacoes ?? "",
        Categoria: l.plano_contas?.nome ?? "",
        Tipo: l.tipo,
        Valor: Number(l.valor),
        Status: isOverdue(l.data, l.status) ? "atrasado" : l.status,
      })),
    );
  }

  function handleExportPdf() {
    if (!lanc.data) return;
    exportToPdf({
      filename: `lancamentos-${ano}${mes ? "-" + String(mes).padStart(2, "0") : ""}`,
      titulo: `Lançamentos Financeiros — ${periodoLabel}`,
      subtitulo: `Total de ${lanc.data.length} registros`,
      columns: [
        { header: "Data", dataKey: "data" },
        { header: "Descrição", dataKey: "descricao" },
        { header: "Processo", dataKey: "processo" },
        { header: "Cliente / Fornecedor", dataKey: "cliente" },
        { header: "Categoria", dataKey: "categoria" },
        { header: "Tipo", dataKey: "tipo" },
        { header: "Valor", dataKey: "valor" },
        { header: "Status", dataKey: "status" },
      ],
      rows: lanc.data.map((l) => ({
        data: new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR"),
        descricao: l.descricao,
        processo: l.processos?.numero_cnj ?? "Sem processo",
        cliente: `${entidadeFinanceira(l).nome} — ${entidadeFinanceira(l).detalhes}`,
        categoria: l.plano_contas?.nome ?? "",
        tipo: l.tipo === "entrada" ? "Entrada" : "Saída",
        valor: formatBRL(Number(l.valor)),
        status:
          l.status === "pago" ? "Pago" : isOverdue(l.data, l.status) ? "Atrasado" : "Pendente",
      })),
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="h-full min-h-0 p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0 flex flex-col gap-4 max-w-7xl mx-auto w-full overflow-hidden">
      <header className="shrink-0 grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Financeiro</p>
          <h1 className="font-serif text-3xl mt-1">Lançamentos</h1>
          {search.categoria && (
            <Link
              to="/financeiro/dre"
              search={dreSearch}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao DRE
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!lanc.data?.length}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!lanc.data?.length}
          >
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Dialog open={open} onOpenChange={handleDialogChange}>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Novo lançamento
            </Button>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editing ? "Editar lançamento" : "Novo lançamento"}
                </DialogTitle>
              </DialogHeader>
              <LancamentoForm
                key={editing?.id ?? "new"}
                initial={editing}
                categorias={cats.data ?? []}
                processos={processosOrdenados}
                fornecedores={fornecedores.data ?? []}
                onSubmit={(data, comprovante) => mSave.mutate({ data, comprovante })}
                loading={mSave.isPending}
                currentNotaPath={editing?.nota_fiscal_path ?? null}
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Card className="shrink-0 border-border/60">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-sans uppercase tracking-wide text-muted-foreground">
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="sm:col-span-2 xl:col-span-1">
              <Label className="text-xs">Buscar cliente, fornecedor ou processo</Label>
              <Input
                value={search.q ?? ""}
                onChange={(e) => updateSearch({ q: e.target.value || undefined })}
                placeholder="Nome, fornecedor, parte, descrição ou CNJ"
              />
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input
                type="number"
                value={ano}
                onChange={(e) => updateSearch({ ano: Number(e.target.value) || undefined })}
              />
            </div>
            <div>
              <Label className="text-xs">Mês</Label>
              <Select
                value={mes ? String(mes) : "all"}
                onValueChange={(v) => updateSearch({ mes: v === "all" ? undefined : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select
                value={search.categoria ?? "all"}
                onValueChange={(v) => updateSearch({ categoria: v === "all" ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cats.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={search.tipo ?? "all"}
                onValueChange={(v) =>
                  updateSearch({ tipo: v === "all" ? undefined : (v as "entrada" | "saida") })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={search.status ?? "all"}
                onValueChange={(v) =>
                  updateSearch({
                    status: v === "all" ? undefined : (v as "pago" | "pendente" | "atrasado"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {total && (
        <div className="shrink-0 grid gap-3 grid-cols-1 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Entradas (pagas)</p>
              <p className="font-sans font-bold tabular-nums text-xl text-primary">
                {formatBRL(total.entradas)}
              </p>
              {total.pendentesEntrada > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  + {formatBRL(total.pendentesEntrada)} pendente
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Saídas (pagas)</p>
              <p className="font-sans font-bold tabular-nums text-xl text-rose-700">
                {formatBRL(total.saidas)}
              </p>
              {total.pendentesSaida > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  + {formatBRL(total.pendentesSaida)} pendente
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Saldo (realizado)</p>
              <p className="font-sans font-bold tabular-nums text-xl">
                {formatBRL(total.entradas - total.saidas)}
              </p>
              {(total.pendentesEntrada > 0 || total.pendentesSaida > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Previsto:{" "}
                  {formatBRL(
                    total.entradas + total.pendentesEntrada - (total.saidas + total.pendentesSaida),
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
        <CardContent className="h-full min-h-0 p-0 overflow-hidden">
          {/* Desktop */}
          <div className="hidden lg:block h-full min-h-0 overflow-auto overscroll-contain [scrollbar-gutter:stable] [&>div]:overflow-visible">
            <Table className="min-w-[1450px]">
              <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Cliente / Fornecedor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lanc.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : lanc.data && lanc.data.length > 0 ? (
                  lanc.data.map((l) => {
                    const atrasado = isOverdue(l.data, l.status);
                    const pendente = l.status === "pendente";
                    return (
                      <TableRow
                        key={l.id}
                        className={
                          pendente
                            ? "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                            : ""
                        }
                      >
                        <TableCell
                          className={
                            "text-sm whitespace-nowrap " +
                            (pendente ? "text-red-700 dark:text-red-400 font-medium" : "")
                          }
                        >
                          {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell
                          className={
                            "text-sm min-w-48 " + (pendente ? "text-red-700 dark:text-red-400" : "")
                          }
                        >
                          {l.descricao}
                        </TableCell>
                        <TableCell className="text-sm font-mono whitespace-nowrap">
                          {l.processos?.numero_cnj ?? "Sem processo"}
                        </TableCell>
                        <TableCell className="text-sm min-w-64">
                          <span className="font-semibold block">{entidadeFinanceira(l).nome}</span>
                          <span className="text-xs text-muted-foreground block">
                            {entidadeFinanceira(l).detalhes}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm min-w-48 text-muted-foreground">
                          {l.observacoes || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{l.plano_contas?.nome ?? "—"}</TableCell>
                        <TableCell className="text-sm capitalize">{l.tipo}</TableCell>
                        <TableCell
                          className={
                            "text-sm capitalize " +
                            (pendente ? "text-red-700 dark:text-red-400 font-semibold" : "")
                          }
                        >
                          {atrasado ? "Atrasado" : l.status}
                        </TableCell>
                        <TableCell
                          className={
                            "text-right font-medium whitespace-nowrap " +
                            (pendente
                              ? "text-red-700 dark:text-red-400"
                              : l.tipo === "entrada"
                                ? "text-primary"
                                : "text-rose-700")
                          }
                        >
                          {formatBRL(Number(l.valor))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <NotaFiscalIndicator currentPath={l.nota_fiscal_path ?? null} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(l)}
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                askAndDelete(l.id);
                              }}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      Nenhum lançamento encontrado para o período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / Tablet */}
          <div className="lg:hidden h-full min-h-0 overflow-y-auto overscroll-contain divide-y divide-border/60 [scrollbar-gutter:stable]">
            {lanc.isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
            ) : lanc.data && lanc.data.length > 0 ? (
              lanc.data.map((l) => {
                const atrasado = isOverdue(l.data, l.status);
                return (
                  <div
                    key={l.id}
                    className={
                      "p-4 flex items-start justify-between gap-3 " +
                      (l.status === "pendente" ? "bg-red-50 dark:bg-red-950/30" : "")
                    }
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                        <span>•</span>
                        <span className="capitalize">{l.tipo}</span>
                        <span>•</span>
                        <span
                          className={
                            "capitalize " +
                            (l.status === "pendente"
                              ? "text-red-700 dark:text-red-400 font-semibold"
                              : "")
                          }
                        >
                          {atrasado ? "Atrasado" : l.status}
                        </span>
                      </div>
                      <p
                        className={
                          "text-sm font-medium truncate " +
                          (l.status === "pendente" ? "text-red-700 dark:text-red-400" : "")
                        }
                      >
                        {l.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.plano_contas?.nome ?? "—"}
                      </p>
                      <p className="text-xs font-mono truncate">
                        {l.processos?.numero_cnj ?? "Sem processo"}
                      </p>
                      <p className="text-xs font-medium truncate">{entidadeFinanceira(l).nome}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {entidadeFinanceira(l).detalhes}
                      </p>
                      {l.observacoes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          Obs.: {l.observacoes}
                        </p>
                      )}
                      <p
                        className={
                          "text-base font-sans font-bold tabular-nums " +
                          (l.status === "pendente"
                            ? "text-red-700 dark:text-red-400"
                            : l.tipo === "entrada"
                              ? "text-primary"
                              : "text-rose-700")
                        }
                      >
                        {formatBRL(Number(l.valor))}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      <NotaFiscalIndicator currentPath={l.nota_fiscal_path ?? null} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(l)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          askAndDelete(l.id);
                        }}
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum lançamento encontrado para o período.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type Cat = { id: string; nome: string; tipo: string; codigo: string };
type ProcessoLite = {
  id: string;
  autor: string;
  reu: string;
  numero_cnj: string | null;
  clientes?: { nome?: string | null } | null;
};
type FornecedorLite = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  tipo: "pf" | "pj";
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};
type FormData = {
  id?: string;
  data: string;
  descricao: string;
  observacoes: string | null;
  valor: number;
  tipo: "entrada" | "saida";
  categoria_id: string | null;
  status: "pago" | "pendente" | "atrasado";
  processo_id: string | null;
  fornecedor_id: string | null;
  parcelas: number;
  juros_percentual: number | null;
};

type LancamentoInitial = {
  id: string;
  data: string;
  descricao: string;
  observacoes?: string | null;
  valor: number | string;
  tipo: string;
  categoria_id: string | null;
  status: string;
  processo_id: string | null;
  fornecedor_id?: string | null;
} | null;

function LancamentoForm({
  categorias,
  processos,
  fornecedores,
  onSubmit,
  loading,
  initial,
  currentNotaPath,
}: {
  categorias: Cat[];
  processos: ProcessoLite[];
  fornecedores: FornecedorLite[];
  onSubmit: (d: FormData, comprovante: File | null) => void;
  loading: boolean;
  initial?: LancamentoInitial;
  currentNotaPath?: string | null;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          id: initial.id,
          data: initial.data,
          descricao: initial.descricao,
          observacoes: initial.observacoes ?? null,
          valor: Number(initial.valor),
          tipo: initial.tipo === "saida" ? "saida" : "entrada",
          categoria_id: initial.categoria_id,
          status: isOverdue(initial.data, initial.status)
            ? "atrasado"
            : initial.status === "pendente"
              ? "pendente"
              : "pago",
          processo_id: initial.processo_id,
          fornecedor_id: initial.fornecedor_id ?? null,
          parcelas: 1,
          juros_percentual: null,
        }
      : {
          data: new Date().toISOString().slice(0, 10),
          descricao: "",
          observacoes: null,
          valor: 0,
          tipo: "entrada",
          categoria_id: null,
          status: "pago",
          processo_id: null,
          fornecedor_id: null,
          parcelas: 1,
          juros_percentual: null,
        },
  );
  const [comprovante, setComprovante] = useState<File | null>(null);

  const totalComJuros = form.valor * (1 + (form.juros_percentual ?? 0) / 100);
  const valorParcela = form.parcelas > 0 ? totalComJuros / form.parcelas : 0;

  const availableCats = categorias.filter((c) =>
    form.tipo === "entrada" ? c.tipo === "receita" : c.tipo === "despesa" || c.tipo === "deducao",
  );
  const fornecedorSelecionado = fornecedores.find(
    (fornecedor) => fornecedor.id === form.fornecedor_id,
  );
  const enderecoFornecedor = fornecedorSelecionado
    ? [
        fornecedorSelecionado.endereco,
        fornecedorSelecionado.bairro,
        fornecedorSelecionado.cidade,
        fornecedorSelecionado.estado,
        fornecedorSelecionado.cep ? `CEP ${fornecedorSelecionado.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.tipo === "entrada" && !form.processo_id) {
          toast.error("Toda entrada deve estar vinculada a um processo");
          return;
        }
        if (form.tipo === "saida" && !form.fornecedor_id) {
          toast.error("Toda saída deve informar o fornecedor");
          return;
        }
        if (comprovante && comprovante.size > 10 * 1024 * 1024) {
          toast.error("O comprovante deve ter no máximo 10 MB");
          return;
        }
        if (comprovante && !isComprovanteMimeType(comprovante.type)) {
          toast.error("Formato não permitido. Use PDF, JPG, PNG ou WEBP.");
          return;
        }
        onSubmit(form, comprovante);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Data</Label>
          <Input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            required
            placeholder="0,00"
            value={form.valor === 0 ? "" : form.valor}
            onChange={(e) =>
              setForm((f) => ({ ...f, valor: e.target.value === "" ? 0 : Number(e.target.value) }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Parcelas</Label>
          <Input
            type="number"
            min={1}
            max={120}
            placeholder="1"
            value={form.parcelas === 0 ? "" : form.parcelas}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                parcelas: e.target.value === "" ? 0 : Math.max(1, Number(e.target.value)),
              }))
            }
          />
        </div>
        <div>
          <Label>Juros (%)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0,00"
            value={form.juros_percentual ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                juros_percentual: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
      {(form.parcelas > 1 || (form.juros_percentual ?? 0) > 0) && form.valor > 0 && (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <div>
            Total com juros:{" "}
            <span className="font-medium text-foreground">{formatBRL(totalComJuros)}</span>
          </div>
          {form.parcelas > 1 && (
            <div>
              {form.parcelas}x de{" "}
              <span className="font-medium text-foreground">{formatBRL(valorParcela)}</span>{" "}
              (mensais)
            </div>
          )}
        </div>
      )}
      <div>
        <Label>Descrição</Label>
        <Input
          required
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
        />
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea
          rows={3}
          placeholder="Informações adicionais sobre o pagamento ou recebimento"
          value={form.observacoes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select
            value={form.tipo}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                tipo: v as "entrada" | "saida",
                categoria_id: null,
                processo_id: v === "saida" ? null : f.processo_id,
                fornecedor_id: v === "entrada" ? null : f.fornecedor_id,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v as FormData["status"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pago">Pago / Recebido</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Categoria</Label>
        <Select
          value={form.categoria_id ?? ""}
          onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {availableCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {form.tipo === "entrada" && (
        <div>
          <Label>
            Processo vinculado <span className="text-destructive">*</span>
          </Label>
          <SearchableProcessPicker
            value={form.processo_id}
            onValueChange={(value) => setForm((current) => ({ ...current, processo_id: value }))}
            processes={processos}
            placeholder={
              processos.length === 0 ? "Nenhum processo cadastrado" : "Escolha um processo"
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Toda entrada deve estar vinculada a um processo.
          </p>
        </div>
      )}
      {form.tipo === "saida" && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <Label>
              Fornecedor <span className="text-destructive">*</span>
            </Label>
            <Link to="/clientes" className="text-xs text-primary underline underline-offset-2">
              Cadastrar fornecedor
            </Link>
          </div>
          <SearchableClientPicker
            value={form.fornecedor_id}
            onValueChange={(value) => setForm((current) => ({ ...current, fornecedor_id: value }))}
            clients={fornecedores}
            placeholder={
              fornecedores.length === 0
                ? "Cadastre um fornecedor na tela Clientes"
                : "Selecione o fornecedor"
            }
            searchPlaceholder="Digite o nome do fornecedor..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            O fornecedor precisa estar marcado como fornecedor na tela Clientes.
          </p>
          {fornecedorSelecionado && (
            <div className="mt-2 rounded-md bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Dados carregados automaticamente do cadastro
              </p>
              <p className="mt-1">
                {[
                  fornecedorSelecionado.cpf_cnpj
                    ? `CPF/CNPJ: ${fornecedorSelecionado.cpf_cnpj}`
                    : null,
                  fornecedorSelecionado.telefone
                    ? `Telefone: ${fornecedorSelecionado.telefone}`
                    : null,
                  fornecedorSelecionado.email ? `E-mail: ${fornecedorSelecionado.email}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Documento e contato ainda não informados."}
              </p>
              {enderecoFornecedor && <p className="mt-1">{enderecoFornecedor}</p>}
            </div>
          )}
        </div>
      )}
      {initial?.id && (
        <div>
          <Label>Comprovante / nota fiscal</Label>
          <NotaFiscalManager lancamentoId={initial.id} currentPath={currentNotaPath ?? null} />
        </div>
      )}
      {!initial?.id && (
        <div>
          <Label>Comprovante / nota fiscal</Label>
          <input
            id="novo-lancamento-comprovante"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (file && file.size > 10 * 1024 * 1024) {
                toast.error("O comprovante deve ter no máximo 10 MB");
                return;
              }
              if (file && !isComprovanteMimeType(file.type)) {
                toast.error("Formato não permitido. Use PDF, JPG, PNG ou WEBP.");
                return;
              }
              setComprovante(file);
            }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("novo-lancamento-comprovante")?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {comprovante ? "Substituir comprovante" : "Anexar comprovante"}
            </Button>
            {comprovante && (
              <>
                <span className="max-w-56 truncate text-xs text-muted-foreground">
                  {comprovante.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setComprovante(null)}
                >
                  Remover
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, JPG, PNG ou WEBP, com no máximo 10 MB.
          </p>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : form.id ? "Salvar alterações" : "Salvar lançamento"}
      </Button>
    </form>
  );
}

function NotaFiscalIndicator({ currentPath }: { currentPath: string | null }) {
  const getUrl = useServerFn(getNotaFiscalUrl);
  if (!currentPath) return null;
  async function handleOpen() {
    try {
      const { url } = await getUrl({ data: { path: currentPath! } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir");
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleOpen}
      title="Ver comprovante anexado"
      className="text-primary"
    >
      <Paperclip className="w-4 h-4" />
    </Button>
  );
}

function NotaFiscalManager({
  lancamentoId,
  currentPath,
}: {
  lancamentoId: string;
  currentPath: string | null;
}) {
  const qc = useQueryClient();
  const setNota = useServerFn(setNotaFiscal);
  const getUrl = useServerFn(getNotaFiscalUrl);
  const prepareUpload = useServerFn(prepareNotaFiscalUpload);
  const [busy, setBusy] = useState(false);

  async function handlePick(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo excede 10 MB");
      return;
    }
    if (!isComprovanteMimeType(file.type)) {
      toast.error("Formato não permitido. Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    setBusy(true);
    try {
      const contentType = file.type;
      const prepared = await prepareUpload({
        data: {
          id: lancamentoId,
          file_name: file.name,
          content_type: contentType,
          size: file.size,
        },
      });
      const { error } = await supabase.storage
        .from("notas-fiscais")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType });
      if (error) throw error;
      await setNota({ data: { id: lancamentoId, path: prepared.path } });
      toast.success("Comprovante anexado");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen() {
    if (!currentPath) return;
    try {
      const { url } = await getUrl({ data: { path: currentPath } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir");
    }
  }

  async function handleRemove() {
    if (!currentPath) return;
    if (!window.confirm("Remover o comprovante anexado?")) return;
    setBusy(true);
    try {
      await setNota({ data: { id: lancamentoId, path: null } });
      toast.success("Comprovante removido");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    } finally {
      setBusy(false);
    }
  }

  const inputId = `nf-mgr-${lancamentoId}`;
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handlePick(f);
        }}
      />
      {currentPath ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={handleOpen} disabled={busy}>
            <Paperclip className="w-4 h-4 mr-2" /> Ver anexo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={busy}
          >
            <Pencil className="w-4 h-4 mr-2" /> Substituir
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Remover
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={busy}
        >
          <Upload className="w-4 h-4 mr-2" /> Anexar comprovante
        </Button>
      )}
    </div>
  );
}
