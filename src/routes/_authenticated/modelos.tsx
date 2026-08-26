import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listTemplates,
  upsertTemplate,
  deleteTemplate,
  type TemplateRow,
} from "@/lib/documentos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { criarLinkPublicoContrato } from "@/lib/contratos-publicos.functions";

export const Route = createFileRoute("/_authenticated/modelos")({
  component: ModelosPage,
});

const VARIAVEIS = [
  "{{nome}}",
  "{{tipo_pessoa}}",
  "{{nacionalidade}}",
  "{{cpf_cnpj}}",
  "{{rg}}",
  "{{email}}",
  "{{telefone}}",
  "{{profissao}}",
  "{{endereco}}",
  "{{cidade}}",
  "{{estado}}",
  "{{cep}}",
  "{{data_aniversario}}",
  "{{data_hoje}}",
  "{{representante_nome}}",
  "{{representante_nacionalidade}}",
  "{{representante_profissao}}",
  "{{representante_data_nascimento}}",
  "{{representante_rg}}",
  "{{representante_cpf}}",
  "{{representante_parentesco}}",
];

function ModelosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  const list = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTemplates(),
  });

  const mSave = useMutation({
    mutationFn: (d: {
      id?: string;
      nome: string;
      tipo: string;
      conteudo: string;
      ativo: boolean;
    }) => upsertTemplate({ data: d }),
    onSuccess: () => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["templates"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => deleteTemplate({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  const mCriarLink = useMutation({
    mutationFn: () => criarLinkPublicoContrato({ data: {} }),
    onSuccess: async ({ token, expira_em }) => {
      const url = `${window.location.origin}/contrato/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success(`Link copiado. Válido até ${new Date(expira_em).toLocaleDateString("pt-BR")}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="sigjur-page space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Documentos</p>
          <h1 className="font-serif text-3xl mt-1">Modelos</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Crie modelos de contrato, procuração e outros documentos usando variáveis como{" "}
            <code className="text-xs bg-muted px-1 rounded">{"{{nome}}"}</code>. Todo cliente salvo
            gera automaticamente os documentos a partir dos modelos ativos.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Novo modelo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">
                {editing ? "Editar modelo" : "Novo modelo"}
              </DialogTitle>
            </DialogHeader>
            <TemplateForm
              initial={editing}
              onSubmit={(d) => mSave.mutate(d)}
              loading={mSave.isPending}
            />
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : list.data && list.data.length > 0 ? (
                  list.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="text-sm capitalize">{t.tipo}</TableCell>
                      <TableCell className="text-sm">{t.ativo ? "Sim" : "Não"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(t);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={mCriarLink.isPending}
                          onClick={() => mCriarLink.mutate()}
                        >
                          <Copy className="mr-2 size-4" />{" "}
                          {mCriarLink.isPending ? "Gerando…" : "Copiar link do contrato"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover ${t.nome}?`)) mDel.mutate(t.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Nenhum modelo cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="sm:hidden divide-y divide-border/60">
            {list.isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
            ) : list.data && list.data.length > 0 ? (
              list.data.map((t) => (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.nome}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {t.tipo} · {t.ativo ? "Ativo" : "Inativo"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(t);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover ${t.nome}?`)) mDel.mutate(t.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm px-4">
                Nenhum modelo cadastrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: TemplateRow | null;
  onSubmit: (d: {
    id?: string;
    nome: string;
    tipo: string;
    conteudo: string;
    ativo: boolean;
  }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    id: initial?.id,
    nome: initial?.nome ?? "",
    tipo: initial?.tipo ?? "contrato",
    conteudo: initial?.conteudo ?? "",
    ativo: initial?.ativo ?? true,
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Nome</Label>
          <Input
            required
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="procuracao">Procuração</SelectItem>
              <SelectItem value="declaracao">Declaração</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Variáveis disponíveis (clique para copiar)</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {VARIAVEIS.map((v) => (
            <button
              key={v}
              type="button"
              className="text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded font-mono"
              onClick={() => {
                navigator.clipboard.writeText(v);
                toast.success(`${v} copiado`);
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Conteúdo</Label>
        <Textarea
          required
          rows={18}
          className="font-mono text-sm"
          value={form.conteudo}
          onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.ativo}
          onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
        />
        Ativo (gera automaticamente para cada cliente)
      </label>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Salvar modelo"}
      </Button>
    </form>
  );
}
