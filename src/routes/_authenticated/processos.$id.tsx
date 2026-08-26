import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getProcesso,
  upsertProcesso,
  deleteProcesso,
  listAndamentos,
  addAndamento,
  deleteAndamento,
  STATUS_LABEL,
  type ProcessoFormInput,
} from "@/lib/processos.functions";
import { listLancamentos } from "@/lib/lancamentos.functions";
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
import { ArrowLeft, Save, Trash2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/export";
import { ProcessTimeline } from "@/components/process-timeline";
import { useAutoSync } from "@/lib/use-auto-sync";
import { listStatusProcesso } from "@/lib/status-processo.functions";
import { CurrencyInput } from "@/components/currency-input";
import { listIndicacoes, type IndicacaoRow } from "@/lib/indicacoes.functions";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  component: ProcessoDetalhe,
});

function ProcessoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const autoSync = useAutoSync();

  const proc = useQuery({
    queryKey: ["processo", id],
    queryFn: () => getProcesso({ data: { id } }),
  });
  const andam = useQuery({
    queryKey: ["andamentos", id],
    queryFn: () => listAndamentos({ data: { processo_id: id } }),
  });
  const lanc = useQuery({
    queryKey: ["lancamentos", "processo", id],
    queryFn: () => listLancamentos({ data: { processo_id: id } }),
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
    onSuccess: () => {
      toast.success("Processo atualizado");
      qc.invalidateQueries({ queryKey: ["processo", id] });
      qc.invalidateQueries({ queryKey: ["processos"] });
      autoSync(["processos", "painel"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: () => deleteProcesso({ data: { id } }),
    onSuccess: () => {
      toast.success("Processo removido");
      autoSync(["processos", "painel"]);
      navigate({ to: "/processos" });
    },
  });
  const mAddAnd = useMutation({
    mutationFn: (d: { titulo: string; descricao: string; data: string }) =>
      addAndamento({ data: { ...d, processo_id: id } }),
    onSuccess: () => {
      toast.success("Andamento registrado");
      qc.invalidateQueries({ queryKey: ["andamentos", id] });
      autoSync(["processos"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelAnd = useMutation({
    mutationFn: (aId: string) => deleteAndamento({ data: { id: aId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["andamentos", id] });
      autoSync(["processos"]);
    },
  });

  const [andForm, setAndForm] = useState({
    titulo: "",
    descricao: "",
    data: new Date().toISOString().slice(0, 10),
  });

  if (proc.isLoading) {
    return <div className="p-10 text-muted-foreground">Carregando…</div>;
  }
  if (!proc.data) {
    return (
      <div className="p-10 space-y-4">
        <p>Processo não encontrado.</p>
        <Link to="/processos" className="text-accent underline">
          Voltar
        </Link>
      </div>
    );
  }

  const p = proc.data;

  return (
    <div className="sigjur-page space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/processos"
          className="text-sm inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos processos
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Remover este processo?")) mDelete.mutate();
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Remover
        </Button>
      </div>

      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {p.numero_cnj ?? "Sem CNJ"}
        </p>
        <h1 className="font-serif text-3xl mt-1">
          {p.autor} <span className="text-muted-foreground">×</span> {p.reu}
        </h1>
        <p className="text-sm mt-1">
          <span className="inline-block px-2 py-0.5 rounded bg-secondary">
            {statusLabels[p.status] ?? p.status}
          </span>
          {p.materia && <span className="ml-2 text-muted-foreground">· {p.materia}</span>}
          {p.valor_causa != null && (
            <span className="ml-2 text-muted-foreground">· {formatBRL(Number(p.valor_causa))}</span>
          )}
        </p>
      </header>

      <ProcessTimeline
        status={p.status}
        statusLabel={statusLabels[p.status] ?? p.status}
        totalAndamentos={andam.data?.length ?? 0}
        ultimoAndamento={
          andam.data && andam.data.length > 0
            ? { data: andam.data[0].data, titulo: andam.data[0].titulo }
            : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Dados do processo</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessoEdit
              initial={p}
              indicacoes={indicacoes.data ?? []}
              onSave={(d) => mSave.mutate({ ...d, id: p.id })}
              loading={mSave.isPending}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Representante</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {p.clientes ? (
              <>
                <p className="font-medium">{p.clientes.nome}</p>
                {p.clientes.telefone && (
                  <p className="text-muted-foreground">Tel.: {p.clientes.telefone}</p>
                )}
                {p.clientes.email && <p className="text-muted-foreground">{p.clientes.email}</p>}
                <Link to="/clientes" className="text-accent text-xs underline">
                  Abrir cadastro
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum representante vinculado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Financeiro do processo
          </CardTitle>
          <Link to="/financeiro/lancamentos" className="text-xs text-accent underline">
            Abrir financeiro
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {lanc.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            (() => {
              const rows = lanc.data ?? [];
              const entradas = rows
                .filter((r) => r.tipo === "entrada")
                .reduce((s, r) => s + Number(r.valor), 0);
              const saidas = rows
                .filter((r) => r.tipo === "saida")
                .reduce((s, r) => s + Number(r.valor), 0);
              const resultado = entradas - saidas;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-secondary/60 border border-border/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        Entradas
                      </p>
                      <p className="font-sans font-bold tabular-nums text-lg text-primary mt-1">
                        {formatBRL(entradas)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 border border-border/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        Saídas
                      </p>
                      <p className="font-sans font-bold tabular-nums text-lg text-rose-400 mt-1">
                        {formatBRL(saidas)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 border border-border/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        Resultado
                      </p>
                      <p
                        className={`font-sans font-bold tabular-nums text-lg mt-1 ${resultado >= 0 ? "text-accent" : "text-rose-400"}`}
                      >
                        {formatBRL(resultado)}
                      </p>
                    </div>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum lançamento vinculado a este processo.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {rows.map((r) => (
                        <div
                          key={r.id}
                          className="py-2 flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{r.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                              {r.plano_contas ? ` · ${r.plano_contas.nome}` : ""}
                              {" · "}
                              {r.status === "pago" ? "Pago" : "Pendente"}
                            </p>
                          </div>
                          <p
                            className={`tabular-nums font-medium ${r.tipo === "entrada" ? "text-primary" : "text-rose-400"}`}
                          >
                            {r.tipo === "entrada" ? "+" : "−"} {formatBRL(Number(r.valor))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Andamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-3 md:grid-cols-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!andForm.titulo.trim()) return;
              mAddAnd.mutate(andForm);
              setAndForm({
                titulo: "",
                descricao: "",
                data: new Date().toISOString().slice(0, 10),
              });
            }}
          >
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={andForm.data}
                onChange={(e) => setAndForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Título</Label>
              <Input
                required
                value={andForm.titulo}
                onChange={(e) => setAndForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={andForm.descricao}
                onChange={(e) => setAndForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={mAddAnd.isPending}>
              <Plus className="w-4 h-4 mr-2" /> Registrar
            </Button>
          </form>

          <div className="divide-y">
            {andam.data && andam.data.length > 0 ? (
              andam.data.map((a) => (
                <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                    <p className="font-medium mt-0.5">{a.titulo}</p>
                    {a.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {a.descricao}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Remover andamento?")) mDelAnd.mutate(a.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                Nenhum andamento registrado ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessoEdit({
  initial,
  indicacoes,
  onSave,
  loading,
}: {
  initial: {
    numero_cnj: string | null;
    autor: string;
    reu: string;
    status: string;
    materia: string | null;
    vara: string | null;
    tribunal: string | null;
    comarca: string | null;
    data_protocolo: string | null;
    valor_causa: number | null;
    origem: string | null;
    indicacao_id: string | null;
    observacoes: string | null;
  };
  indicacoes: IndicacaoRow[];
  onSave: (d: ProcessoFormInput) => void;
  loading: boolean;
}) {
  const [f, setF] = useState<ProcessoFormInput>({
    numero_cnj: initial.numero_cnj ?? "",
    autor: initial.autor,
    reu: initial.reu,
    status: initial.status,
    materia: initial.materia ?? "",
    vara: initial.vara ?? "",
    tribunal: initial.tribunal ?? "",
    comarca: initial.comarca ?? "",
    data_protocolo: initial.data_protocolo ?? "",
    valor_causa: initial.valor_causa,
    origem: initial.origem ?? "",
    indicacao_id: initial.indicacao_id ?? null,
    observacoes: initial.observacoes ?? "",
  });
  const statusOpcoes = useQuery({
    queryKey: ["status-processo"],
    queryFn: () => listStatusProcesso({ data: {} }),
    staleTime: 60_000,
  });
  function set<K extends keyof ProcessoFormInput>(k: K, v: ProcessoFormInput[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nº CNJ</Label>
          <Input value={f.numero_cnj ?? ""} onChange={(e) => set("numero_cnj", e.target.value)} />
        </div>
        <div>
          <Label>Autor</Label>
          <Input required value={f.autor} onChange={(e) => set("autor", e.target.value)} />
        </div>
        <div>
          <Label>Réu</Label>
          <Input required value={f.reu} onChange={(e) => set("reu", e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={f.status}
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
        <div>
          <Label>Matéria</Label>
          <Input value={f.materia ?? ""} onChange={(e) => set("materia", e.target.value)} />
        </div>
        <div>
          <Label>Vara</Label>
          <Input value={f.vara ?? ""} onChange={(e) => set("vara", e.target.value)} />
        </div>
        <div>
          <Label>Tribunal</Label>
          <Input value={f.tribunal ?? ""} onChange={(e) => set("tribunal", e.target.value)} />
        </div>
        <div>
          <Label>Data protocolo</Label>
          <Input
            type="date"
            value={f.data_protocolo ?? ""}
            onChange={(e) => set("data_protocolo", e.target.value)}
          />
        </div>
        <div>
          <Label>Valor causa</Label>
          <CurrencyInput
            value={f.valor_causa}
            onValueChange={(value) => set("valor_causa", value)}
          />
        </div>
        <div>
          <Label>Indicador</Label>
          <Select
            value={f.indicacao_id ?? "__none__"}
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
          <Label>Origem / Observação</Label>
          <Input value={f.origem ?? ""} onChange={(e) => set("origem", e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea
            value={f.observacoes ?? ""}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        <Save className="w-4 h-4 mr-2" /> Salvar alterações
      </Button>
    </form>
  );
}
