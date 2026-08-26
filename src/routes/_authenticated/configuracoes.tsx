import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listCatalogo,
  upsertCatalogo,
  deleteCatalogo,
  listVinculos,
  addVinculo,
  deleteVinculo,
  importCatalogoFromProcessos,
  CATEGORIAS,
  CATEGORIA_LABEL,
  type Categoria,
} from "@/lib/catalogos.functions";
import { listClientes } from "@/lib/clientes.functions";
import { getMe } from "@/lib/users.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableClientPicker } from "@/components/searchable-client-picker";
import { Database, Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addStatusProcesso,
  deleteStatusProcesso,
  listStatusProcesso,
  updateStatusProcesso,
} from "@/lib/status-processo.functions";
import {
  deleteIndicacao,
  listIndicacoes,
  upsertIndicacao,
  type IndicacaoInput,
  type IndicacaoRow,
} from "@/lib/indicacoes.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: () => {
    throw redirect({ to: "/cadastros" });
  },
  component: CadastrosPage,
});

export function CadastrosPage() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
  });
  const canEdit = me.data?.canEdit ?? false;
  const mImport = useMutation({
    mutationFn: () => importCatalogoFromProcessos(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      toast.success("Opções já usadas nos processos foram sincronizadas");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Jurídico</p>
          <h1 className="font-serif text-2xl sm:text-3xl mt-1">Cadastros</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as opções dos formulários, as indicações e os vínculos entre clientes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit || mImport.isPending}
          onClick={() => mImport.mutate()}
        >
          <Database className="mr-2 size-4" />
          {mImport.isPending ? "Sincronizando..." : "Importar opções dos processos"}
        </Button>
      </header>

      {!me.isPending && !canEdit && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Seu acesso é de visualização. Um administrador precisa conceder acesso de Editor ou
          Administrador para alterar estes cadastros.
        </div>
      )}
      {!me.isPending && canEdit && (
        <div className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm">
          <strong>Modo de edição ativo.</strong> Você pode adicionar, editar, ativar, desativar e
          excluir opções.
        </div>
      )}

      <p className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        É aqui que você inclui, renomeia, desativa ou exclui as opções de Tipo de Ação, Matéria,
        Fase, Advogado, Status e Indicadores. Alterar uma opção não apaga os processos já
        cadastrados.
      </p>

      <Tabs defaultValue="indicacoes" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 w-full h-auto">
          <TabsTrigger value="indicacoes">Indicadores</TabsTrigger>
          {CATEGORIAS.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CATEGORIA_LABEL[c]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="indicacoes" className="pt-4">
          <IndicacoesManager canEdit={canEdit} />
        </TabsContent>

        {CATEGORIAS.map((c) => (
          <TabsContent key={c} value={c} className="pt-4">
            <CatalogoManager categoria={c} canEdit={canEdit} />
          </TabsContent>
        ))}

        <TabsContent value="vinculos" className="pt-4">
          <VinculosManager canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="status" className="pt-4">
          <StatusManager canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const emptyIndicacao = (): IndicacaoInput => ({
  nome: "",
  cpf_cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  observacoes: "",
  ativo: true,
});

function IndicacoesManager({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<IndicacaoInput>(emptyIndicacao);
  const [editingId, setEditingId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["indicacoes", "all"],
    queryFn: () => listIndicacoes({ data: { incluir_inativos: true } }),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["indicacoes"] });
    qc.invalidateQueries({ queryKey: ["processos-resumo"] });
  };
  const save = useMutation({
    mutationFn: () => upsertIndicacao({ data: editingId ? { ...form, id: editingId } : form }),
    onSuccess: () => {
      setForm(emptyIndicacao());
      setEditingId(null);
      refresh();
      toast.success(editingId ? "Indicador atualizado" : "Indicador cadastrado");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: (item: IndicacaoRow) => upsertIndicacao({ data: { ...item, ativo: !item.ativo } }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteIndicacao({ data: { id } }),
    onSuccess: () => {
      refresh();
      toast.success("Indicador removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const set = <K extends keyof IndicacaoInput>(key: K, value: IndicacaoInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const startEdit = (item: IndicacaoRow) => {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      cpf_cnpj: item.cpf_cnpj ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      endereco: item.endereco ?? "",
      observacoes: item.observacoes ?? "",
      ativo: item.ativo,
    });
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <p className="text-sm text-muted-foreground">
          Cadastre a pessoa ou empresa que indicou o cliente. Ela ficará disponível no processo e
          aparecerá na coluna Indicador, ao lado de Prazo em aberto, na lista de Processos.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.nome.trim()) {
              toast.error("Informe o nome do indicador.");
              return;
            }
            save.mutate();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input
                value={form.cpf_cnpj ?? ""}
                onChange={(e) => set("cpf_cnpj", e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone ?? ""}
                onChange={(e) => set("telefone", e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input
              value={form.endereco ?? ""}
              onChange={(e) => set("endereco", e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!canEdit || save.isPending}>
              <Save className="size-4 mr-2" />
              {editingId ? "Salvar alteração" : "Adicionar indicador"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyIndicacao());
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>

        <div className="divide-y divide-border/60">
          {list.data?.length ? (
            list.data.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p
                    className={
                      item.ativo ? "font-medium" : "font-medium text-muted-foreground line-through"
                    }
                  >
                    {item.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[item.cpf_cnpj, item.telefone, item.email].filter(Boolean).join(" · ") ||
                      "Sem dados de contato"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="size-4 mr-2" /> Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => toggle.mutate(item)}
                  >
                    {item.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => {
                      if (confirm(`Excluir ${item.nome}?`)) remove.mutate(item.id);
                    }}
                  >
                    <Trash2 className="size-4 mr-2 text-destructive" /> Excluir
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum indicador cadastrado.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusManager({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [editing, setEditing] = useState<{ id: string; nome: string } | null>(null);
  const list = useQuery({
    queryKey: ["status-processo", "all"],
    queryFn: () => listStatusProcesso({ data: { incluir_inativos: true } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["status-processo"] });
  const add = useMutation({
    mutationFn: () => addStatusProcesso({ data: { nome } }),
    onSuccess: () => {
      setNome("");
      refresh();
      toast.success("Status adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: (item: { id: string; nome: string; ativo: boolean }) =>
      updateStatusProcesso({ data: item }),
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteStatusProcesso({ data: { id } }),
    onSuccess: () => {
      refresh();
      toast.success("Status excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Os status cadastrados aqui aparecem nos filtros e nos formulários de processos. Um status
          usado em processo não pode ser excluído: desative-o ou troque os processos antes.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) add.mutate();
            else toast.error("Digite o nome do status.");
          }}
        >
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Novo status"
            disabled={!canEdit}
          />
          <Button type="submit" disabled={!canEdit || add.isPending}>
            <Plus className="size-4 mr-2" />
            Adicionar
          </Button>
        </form>
        <div className="divide-y divide-border/60">
          {list.data?.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.id === item.id ? (
                <Input
                  autoFocus
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              ) : (
                <span className={item.ativo ? "" : "text-muted-foreground line-through"}>
                  {item.nome}
                </span>
              )}
              <div className="flex gap-2 shrink-0">
                {editing?.id === item.id ? (
                  <>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={!editing.nome.trim() || save.isPending}
                      onClick={() =>
                        save.mutate({ id: item.id, nome: editing.nome.trim(), ativo: item.ativo })
                      }
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => setEditing({ id: item.id, nome: item.nome })}
                  >
                    <Pencil className="size-4 mr-2" />
                    Editar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => save.mutate({ id: item.id, nome: item.nome, ativo: !item.ativo })}
                >
                  {item.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => {
                    if (confirm("Excluir este status?")) remove.mutate(item.id);
                  }}
                >
                  <Trash2 className="size-4 mr-2 text-destructive" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CatalogoManager({ categoria, canEdit }: { categoria: Categoria; canEdit: boolean }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const list = useQuery({
    queryKey: ["catalogo", categoria, "all"],
    queryFn: () => listCatalogo({ data: { categoria, incluir_inativos: true } }),
  });

  const mAdd = useMutation({
    mutationFn: (v: string) => upsertCatalogo({ data: { categoria, valor: v, ativo: true } }),
    onSuccess: () => {
      setValor("");
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      toast.success("Opção adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mToggle = useMutation({
    mutationFn: (o: { id: string; ativo: boolean; valor: string }) =>
      upsertCatalogo({ data: { id: o.id, categoria, valor: o.valor, ativo: o.ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const mSave = useMutation({
    mutationFn: (o: { id: string; ativo: boolean; valor: string }) =>
      upsertCatalogo({
        data: { id: o.id, categoria, valor: o.valor, ativo: o.ativo, valor_anterior: editingValue },
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingValue("");
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      toast.success("Opção atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => deleteCatalogo({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valor.trim()) {
              toast.error(`Digite o nome do(a) ${CATEGORIA_LABEL[categoria].toLowerCase()}.`);
              return;
            }
            mAdd.mutate(valor.trim());
          }}
        >
          <Input
            placeholder={`Novo(a) ${CATEGORIA_LABEL[categoria].toLowerCase()}`}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={!canEdit}
          />
          <Button type="submit" disabled={!canEdit || mAdd.isPending}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar
          </Button>
        </form>
        {canEdit && (
          <p className="text-xs text-muted-foreground">
            Digite o nome e clique em Adicionar. Use os botões ao lado de cada opção para editar,
            desativar ou excluir.
          </p>
        )}

        <div className="divide-y divide-border/60">
          {list.data?.length ? (
            list.data.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-2 gap-2">
                {editingId === o.id ? (
                  <Input
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && editingValue.trim()) {
                        mSave.mutate({
                          id: o.id,
                          valor: editingValue.trim(),
                          ativo: o.ativo,
                        });
                      }
                      if (event.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className={o.ativo ? "" : "text-muted-foreground line-through"}>
                    {o.valor}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {editingId === o.id ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!editingValue.trim() || mSave.isPending}
                        onClick={() =>
                          mSave.mutate({
                            id: o.id,
                            valor: editingValue.trim(),
                            ativo: o.ativo,
                          })
                        }
                        aria-label="Salvar alteração"
                      >
                        <Save className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancelar alteração"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => {
                        setEditingId(o.id);
                        setEditingValue(o.valor);
                      }}
                      aria-label="Renomear opção"
                    >
                      <Pencil className="size-4 mr-2" />
                      Editar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => mToggle.mutate({ id: o.id, valor: o.valor, ativo: !o.ativo })}
                  >
                    {o.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    aria-label={`Excluir ${o.valor}`}
                    onClick={() => {
                      if (confirm("Remover esta opção?")) mDel.mutate(o.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma opção cadastrada.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VinculosManager({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [principalId, setPrincipalId] = useState<string>("");
  const [vinculadoId, setVinculadoId] = useState<string>("");
  const [parentesco, setParentesco] = useState<string>("");

  const clientes = useQuery({
    queryKey: ["clientes-select"],
    queryFn: () => listClientes({ data: {} }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const vinculos = useQuery({
    queryKey: ["vinculos", principalId || "all"],
    queryFn: () => listVinculos({ data: principalId ? { cliente_principal_id: principalId } : {} }),
  });

  const mAdd = useMutation({
    mutationFn: () =>
      addVinculo({
        data: {
          cliente_principal_id: principalId,
          cliente_vinculado_id: vinculadoId,
          parentesco: parentesco || null,
        },
      }),
    onSuccess: () => {
      setVinculadoId("");
      setParentesco("");
      qc.invalidateQueries({ queryKey: ["vinculos"] });
      toast.success("Vínculo criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => deleteVinculo({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vinculos"] });
      toast.success("Vínculo removido");
    },
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Vincule clientes uns aos outros (ex.: mãe vinculada ao menor). O "outro envolvido" no
          processo será filtrado por esses vínculos com base no cliente principal do processo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Cliente principal</Label>
            <SearchableClientPicker
              value={principalId}
              onValueChange={(value) => {
                setPrincipalId(value);
                setVinculadoId("");
                setParentesco("");
              }}
              clients={clientes.data ?? []}
              placeholder="Escolha o cliente"
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label className="text-xs">Cliente vinculado</Label>
            <SearchableClientPicker
              value={vinculadoId}
              onValueChange={(value) => {
                setVinculadoId(value);
                const principal = clientes.data?.find((cliente) => cliente.id === principalId);
                const vinculado = clientes.data?.find((cliente) => cliente.id === value);
                const nomeDoRepresentante = principal?.representante_nome?.trim();
                const correspondeAoRepresentante =
                  !!nomeDoRepresentante &&
                  !!vinculado &&
                  nomeDoRepresentante.toLocaleLowerCase("pt-BR") ===
                    vinculado.nome.trim().toLocaleLowerCase("pt-BR");
                setParentesco(
                  correspondeAoRepresentante
                    ? principal?.representante_parentesco?.trim() || "Representante legal"
                    : "",
                );
              }}
              clients={clientes.data ?? []}
              placeholder="Escolha o cliente vinculado"
              disabled={!canEdit || !principalId}
              excludeIds={principalId ? [principalId] : []}
            />
          </div>
          <div>
            <Label className="text-xs">Parentesco</Label>
            <Input
              placeholder="Ex.: mãe, pai, filho"
              value={parentesco}
              onChange={(e) => setParentesco(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Button
            disabled={!canEdit || !principalId || !vinculadoId || mAdd.isPending}
            onClick={() => mAdd.mutate()}
          >
            <Link2 className="w-4 h-4 mr-2" /> Vincular
          </Button>
        </div>

        <div className="divide-y divide-border/60">
          {vinculos.data?.length ? (
            vinculos.data.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">{v.cliente_vinculado?.nome ?? "?"}</span>
                  {v.parentesco && <span className="text-muted-foreground"> — {v.parentesco}</span>}
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    vinculado a {v.cliente_principal?.nome ?? "?"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canEdit}
                  onClick={() => mDel.mutate(v.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {principalId
                ? "Nenhum vínculo para este cliente."
                : "Selecione um cliente principal ou crie um vínculo."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
