import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deletePlanoContas, listPlanoContas, upsertPlanoContas } from "@/lib/lancamentos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro/plano-contas")({
  component: PlanoContasPage,
});

type Cat = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "deducao" | "despesa";
  ordem: number;
  ativa: boolean;
};

type FormState = {
  id?: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "deducao" | "despesa";
  ordem: number;
  ativa: boolean;
};

const TIPO_LABEL: Record<FormState["tipo"], string> = {
  receita: "Receita",
  deducao: "Dedução",
  despesa: "Despesa",
};

function PlanoContasPage() {
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["plano-contas"],
    queryFn: () => listPlanoContas(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cat | null>(null);

  const mSave = useMutation({
    mutationFn: (d: FormState) => upsertPlanoContas({ data: d }),
    onSuccess: () => {
      toast.success("Categoria salva");
      qc.invalidateQueries({ queryKey: ["plano-contas"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (v: { id: string; master_password: string }) => deletePlanoContas({ data: v }),
    onSuccess: () => {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["plano-contas"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mToggle = useMutation({
    mutationFn: (c: Cat) =>
      upsertPlanoContas({
        data: {
          id: c.id,
          codigo: c.codigo,
          nome: c.nome,
          tipo: c.tipo,
          ordem: c.ordem,
          ativa: !c.ativa,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plano-contas"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Cat) {
    setEditing(c);
    setOpen(true);
  }
  function askDelete(c: Cat) {
    const pwd = window.prompt(`Excluir a categoria "${c.nome}"? Digite a senha master:`);
    if (pwd === null) return;
    if (!pwd.trim()) {
      toast.error("Senha obrigatória");
      return;
    }
    mDelete.mutate({ id: c.id, master_password: pwd });
  }

  const grupos: { tipo: FormState["tipo"]; itens: Cat[] }[] = [
    { tipo: "receita", itens: [] },
    { tipo: "deducao", itens: [] },
    { tipo: "despesa", itens: [] },
  ];
  (cats.data as Cat[] | undefined)?.forEach((c) => {
    const g = grupos.find((x) => x.tipo === c.tipo);
    if (g) g.itens.push(c);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6 max-w-5xl mx-auto w-full">
      <header className="grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Financeiro</p>
          <h1 className="font-serif text-3xl mt-1">Cadastro de contas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Categorias usadas nos lançamentos e no DRE.
          </p>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova categoria
        </Button>
      </header>

      {grupos.map((g) => (
        <Card key={g.tipo} className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-sans uppercase tracking-wide text-muted-foreground">
              {TIPO_LABEL[g.tipo]}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {g.itens.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </div>
              ) : (
                g.itens
                  .sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo))
                  .map((c) => (
                    <div
                      key={c.id}
                      className={
                        "px-4 py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] " +
                        (c.ativa ? "" : "opacity-50")
                      }
                    >
                      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">
                        {c.codigo}
                      </span>
                      <span className="text-sm flex-1 truncate">{c.nome}</span>
                      <span className="text-xs text-muted-foreground text-right shrink-0 hidden sm:block">
                        ordem {c.ordem}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => mToggle.mutate(c)}
                          title={c.ativa ? "Desativar" : "Ativar"}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => askDelete(c)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <CategoriaForm
            key={editing?.id ?? "new"}
            initial={editing}
            loading={mSave.isPending}
            onSubmit={(d) => mSave.mutate(d)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriaForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: Cat | null;
  onSubmit: (d: FormState) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          id: initial.id,
          codigo: initial.codigo,
          nome: initial.nome,
          tipo: initial.tipo,
          ordem: initial.ordem,
          ativa: initial.ativa,
        }
      : {
          codigo: "",
          nome: "",
          tipo: "despesa",
          ordem: 0,
          ativa: true,
        },
  );

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
          <Label>Código</Label>
          <Input
            required
            placeholder="ex.: 4.2.10"
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
          />
        </div>
        <div>
          <Label>Ordem</Label>
          <Input
            type="number"
            min={0}
            value={form.ordem === 0 ? "" : form.ordem}
            placeholder="0"
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                ordem: e.target.value === "" ? 0 : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
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
        <Select
          value={form.tipo}
          onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as FormState["tipo"] }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="receita">Receita (entrada)</SelectItem>
            <SelectItem value="deducao">Dedução (impostos, estornos)</SelectItem>
            <SelectItem value="despesa">Despesa (saída)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : form.id ? "Salvar alterações" : "Criar categoria"}
      </Button>
    </form>
  );
}
