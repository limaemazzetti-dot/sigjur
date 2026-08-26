import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listClientes,
  upsertCliente,
  deleteCliente,
  type ClienteFormInput,
  type ClienteRow,
} from "@/lib/clientes.functions";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Cake, Pencil, FileSpreadsheet, FileText, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { useAutoSync } from "@/lib/use-auto-sync";
import { DocumentosClienteDialog } from "@/components/documentos-cliente-dialog";
import { ImportPlanilhaDialog } from "@/components/import-planilha-dialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Lima & Mazzetti" },
      { name: "description", content: "Cadastro e gestão de clientes." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const qc = useQueryClient();
  const autoSync = useAutoSync();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [docsFor, setDocsFor] = useState<ClienteRow | null>(null);

  const list = useQuery({
    queryKey: ["clientes", busca],
    queryFn: () => listClientes({ data: { q: busca || undefined } }),
  });

  const mSave = useMutation({
    mutationFn: (d: ClienteFormInput) => upsertCliente({ data: d }),
    onSuccess: () => {
      toast.success("Cadastro salvo");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["clientes-select"] });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["aniversariantes"] });
      qc.invalidateQueries({ queryKey: ["agenda-proxima"] });
      autoSync(["clientes", "painel"]);
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => deleteCliente({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["agenda-proxima"] });
      autoSync(["clientes", "painel"]);
    },
  });

  function handleExportExcel() {
    if (!list.data) return;
    exportToExcel(
      "clientes",
      list.data.map((c) => ({
        Nome: c.nome,
        Tipo: c.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica",
        Cadastro: c.fornecedor ? "Fornecedor" : "Cliente",
        "CPF/CNPJ": c.cpf_cnpj ?? "",
        Email: c.email ?? "",
        Telefone: c.telefone ?? "",
        Aniversário: c.data_aniversario
          ? new Date(c.data_aniversario + "T00:00:00").toLocaleDateString("pt-BR")
          : "",
      })),
    );
  }

  function handleExportPdf() {
    if (!list.data) return;
    exportToPdf({
      filename: "clientes",
      titulo: "Cadastros",
      subtitulo: `${list.data.length} cadastros`,
      columns: [
        { header: "Nome", dataKey: "nome" },
        { header: "Tipo", dataKey: "tipo" },
        { header: "Cadastro", dataKey: "cadastro" },
        { header: "CPF/CNPJ", dataKey: "doc" },
        { header: "Telefone", dataKey: "tel" },
        { header: "E-mail", dataKey: "email" },
      ],
      rows: list.data.map((c) => ({
        nome: c.nome,
        tipo: c.tipo === "pf" ? "PF" : "PJ",
        cadastro: c.fornecedor ? "Fornecedor" : "Cliente",
        doc: c.cpf_cnpj ?? "",
        tel: c.telefone ?? "",
        email: c.email ?? "",
      })),
      footerNote: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    });
  }

  return (
    <div className="h-full min-h-0 p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0 flex flex-col gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
      <header className="shrink-0 grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl">Clientes</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:w-auto">
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
          <ImportPlanilhaDialog<ClienteFormInput>
            triggerLabel="Importar"
            title="Importar clientes da planilha"
            columnMap={{
              nome: ["Nome", "Nome completo", "Cliente"],
              cpf_cnpj: ["CPF", "CNPJ", "CPF/CNPJ", "Documento"],
              rg: ["RG", "Identidade"],
              sexo: ["Sexo", "Gênero"],
              data_aniversario: [
                "Data de Nascimento",
                "Nascimento",
                "Aniversário",
                "Data de Aniversario",
              ],
              telefone: ["Telefone", "Celular", "Fone", "Contato"],
              email: ["E-mail", "Email"],
              senha_gov_br: ["Senha GOV.BR", "Senha gov.br", "Senha GovBr"],
              endereco: ["Endereço", "Endereco", "Rua"],
              bairro: ["Bairro"],
              cep: ["CEP"],
              cidade: ["Cidade", "Município"],
              estado: ["Estado", "UF"],
              nacionalidade: ["Nacionalidade"],
              profissao: ["Profissão", "Profissao"],
              estado_civil: ["Estado Civil"],
              como_conheceu: ["Como nos Conheceu", "Como conheceu", "Indicação", "Origem"],
              observacoes: ["Observações", "Observacoes", "Obs"],
              fornecedor: ["Fornecedor", "É fornecedor", "Tipo de cadastro"],
            }}
            fieldTypes={{
              data_aniversario: "date",
              fornecedor: "boolean",
            }}
            onImport={async (r) => {
              if (!r.nome) throw new Error("Coluna 'Nome' vazia ou não reconhecida");
              const onlyDigits = (v: unknown) =>
                v == null ? v : String(v).replace(/\D/g, "") || null;
              const payload = {
                ...r,
                tipo: "pf" as const,
                nome: String(r.nome).trim(),
                cpf_cnpj: r.cpf_cnpj ? onlyDigits(r.cpf_cnpj) : r.cpf_cnpj,
                telefone: r.telefone ? onlyDigits(r.telefone) : r.telefone,
                cep: r.cep ? onlyDigits(r.cep) : r.cep,
              } as ClienteFormInput;
              await upsertCliente({ data: payload });
              qc.invalidateQueries({ queryKey: ["clientes"] });
              qc.invalidateQueries({ queryKey: ["clientes-select"] });
              qc.invalidateQueries({ queryKey: ["fornecedores"] });
              qc.invalidateQueries({ queryKey: ["agenda-proxima"] });
            }}
          />
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> Novo cadastro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editing ? "Editar cadastro" : "Novo cadastro"}
                </DialogTitle>
              </DialogHeader>
              <ClienteForm
                key={editing?.id ?? "novo"}
                initial={editing}
                onSubmit={(d) => mSave.mutate(d)}
                loading={mSave.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="shrink-0 max-w-sm">
        <Input
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card className="flex-1 min-h-0 border-border/60 overflow-hidden rounded-md">
        <CardContent className="h-full p-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {/* Desktop/tablet: tabela */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Aniversário</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : list.data && list.data.length > 0 ? (
                  list.data.map((c) => {
                    const isToday = c.data_aniversario && isBirthdayToday(c.data_aniversario);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-sm">
                          {c.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant={c.fornecedor ? "default" : "secondary"}>
                            {c.fornecedor ? "Fornecedor" : "Cliente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.cpf_cnpj ?? "—"}</TableCell>
                        <TableCell className="text-sm">{c.telefone ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {c.data_aniversario ? (
                            <span
                              className={
                                "inline-flex items-center gap-1 " +
                                (isToday ? "text-accent font-semibold" : "")
                              }
                            >
                              {isToday && <Cake className="w-3.5 h-3.5" />}
                              {new Date(c.data_aniversario + "T00:00:00").toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Documentos"
                            onClick={() => setDocsFor(c)}
                          >
                            <FileSignature className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(c);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Remover ${c.nome}?`)) mDel.mutate(c.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum cliente cadastrado ainda.{" "}
                      <Link to="/processos" className="text-accent underline">
                        Ir para Audiências
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cards verticais */}
          <div className="md:hidden divide-y divide-border/60">
            {list.isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
            ) : list.data && list.data.length > 0 ? (
              list.data.map((c) => {
                const isToday = c.data_aniversario && isBirthdayToday(c.data_aniversario);
                return (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                        </p>
                        {c.fornecedor && (
                          <Badge variant="default" className="mt-1">
                            Fornecedor
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Documentos"
                          onClick={() => setDocsFor(c)}
                        >
                          <FileSignature className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover ${c.nome}?`)) mDel.mutate(c.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">CPF/CNPJ</dt>
                      <dd className="text-right break-all">{c.cpf_cnpj ?? "—"}</dd>
                      <dt className="text-muted-foreground">Telefone</dt>
                      <dd className="text-right break-all">{c.telefone ?? "—"}</dd>
                      <dt className="text-muted-foreground">Aniversário</dt>
                      <dd className="text-right">
                        {c.data_aniversario ? (
                          <span
                            className={
                              "inline-flex items-center gap-1 " +
                              (isToday ? "text-accent font-semibold" : "")
                            }
                          >
                            {isToday && <Cake className="w-3.5 h-3.5" />}
                            {new Date(c.data_aniversario + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </dl>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm px-4">
                Nenhum cliente cadastrado ainda.{" "}
                <Link to="/processos" className="text-accent underline">
                  Ir para Audiências
                </Link>
                .
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {docsFor && (
        <DocumentosClienteDialog
          clienteId={docsFor.id}
          clienteNome={docsFor.nome}
          open={!!docsFor}
          onOpenChange={(o) => {
            if (!o) setDocsFor(null);
          }}
        />
      )}
    </div>
  );
}

function isBirthdayToday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const t = new Date();
  return d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function ClienteForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: ClienteRow | null;
  onSubmit: (d: ClienteFormInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ClienteFormInput>({
    id: initial?.id,
    tipo: initial?.tipo ?? "pf",
    fornecedor: initial?.fornecedor ?? false,
    nome: initial?.nome ?? "",
    cpf_cnpj: initial?.cpf_cnpj ?? "",
    rg: initial?.rg ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
    profissao: initial?.profissao ?? "",
    nacionalidade: initial?.nacionalidade ?? "brasileira",
    data_aniversario: initial?.data_aniversario ?? "",
    sexo: initial?.sexo ?? "",
    estado_civil: initial?.estado_civil ?? "",
    como_conheceu: initial?.como_conheceu ?? "",
    endereco: initial?.endereco ?? "",
    bairro: initial?.bairro ?? "",
    cidade: initial?.cidade ?? "",
    estado: initial?.estado ?? "",
    cep: initial?.cep ?? "",
    observacoes: initial?.observacoes ?? "",
    senha_gov_br: initial?.senha_gov_br ?? "",
    representante_nome: initial?.representante_nome ?? "",
    representante_nacionalidade: initial?.representante_nacionalidade ?? "brasileira",
    representante_profissao: initial?.representante_profissao ?? "",
    representante_data_nascimento: initial?.representante_data_nascimento ?? "",
    representante_rg: initial?.representante_rg ?? "",
    representante_cpf: initial?.representante_cpf ?? "",
    representante_parentesco: initial?.representante_parentesco ?? "",
    template_ids: initial?.template_ids ?? [],
  });
  const [mostrarSenha, setMostrarSenha] = useState(false);
  function set<K extends keyof ClienteFormInput>(k: K, v: ClienteFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  return (
    <form
      className="space-y-4"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => set("tipo", v as "pf" | "pj")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{form.tipo === "pf" ? "CPF" : "CNPJ"}</Label>
          <Input value={form.cpf_cnpj ?? ""} onChange={(e) => set("cpf_cnpj", e.target.value)} />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-border/60 p-3 cursor-pointer">
        <Checkbox
          checked={form.fornecedor}
          onCheckedChange={(checked) => set("fornecedor", checked === true)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">Este cadastro é somente fornecedor</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Ao marcar, o nome será usado apenas nos lançamentos de saída e não aparecerá nos
            processos como cliente ou representante.
          </span>
        </span>
      </label>
      <div>
        <Label>{form.tipo === "pf" ? "Nome completo" : "Razão social"}</Label>
        <Input required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>RG</Label>
          <Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
        </div>
        <div>
          <Label>Sexo</Label>
          <Select value={form.sexo ?? ""} onValueChange={(v) => set("sexo", v)}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Feminino">Feminino</SelectItem>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Estado Civil</Label>
          <Input
            value={form.estado_civil ?? ""}
            onChange={(e) => set("estado_civil", e.target.value)}
            placeholder="Solteiro(a), Casado(a)…"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Profissão</Label>
          <Input value={form.profissao ?? ""} onChange={(e) => set("profissao", e.target.value)} />
        </div>
        <div>
          <Label>Nacionalidade</Label>
          <Input
            value={form.nacionalidade ?? ""}
            onChange={(e) => set("nacionalidade", e.target.value)}
            placeholder="brasileira"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Telefone</Label>
          <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input
            type="email"
            name="cliente-email-contato"
            autoComplete="new-password"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Data de nascimento / aniversário</Label>
          <Input
            type="date"
            value={form.data_aniversario ?? ""}
            onChange={(e) => set("data_aniversario", e.target.value)}
          />
        </div>
        <div>
          <Label>CEP</Label>
          <Input value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Endereço</Label>
        <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_6rem] gap-3">
        <div>
          <Label>Bairro</Label>
          <Input value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
        </div>
        <div>
          <Label>Estado (UF)</Label>
          <Input
            maxLength={2}
            value={form.estado ?? ""}
            onChange={(e) => set("estado", e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div>
        <Label>Como nos Conheceu</Label>
        <Input
          value={form.como_conheceu ?? ""}
          onChange={(e) => set("como_conheceu", e.target.value)}
          placeholder="Indicação, Google, Instagram…"
        />
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea
          value={form.observacoes ?? ""}
          onChange={(e) => set("observacoes", e.target.value)}
        />
      </div>
      {initial?.created_at && (
        <p className="text-xs text-muted-foreground">
          Data de cadastro: {new Date(initial.created_at).toLocaleDateString("pt-BR")}
        </p>
      )}
      <div>
        <Label>Senha gov.br</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="min-w-0"
            type={mostrarSenha ? "text" : "password"}
            name="cliente-senha-gov-br"
            autoComplete="new-password"
            value={form.senha_gov_br ?? ""}
            onChange={(e) => set("senha_gov_br", e.target.value)}
            placeholder="Senha do gov.br do periciando"
          />
          <Button type="button" variant="outline" onClick={() => setMostrarSenha((v) => !v)}>
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Uso interno. É criptografada antes de ser salva e nunca é reenviada na listagem.
        </p>
        {initial?.id && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={form.remover_senha_gov_br === true}
              onCheckedChange={(checked) => set("remover_senha_gov_br", checked === true)}
            />
            Remover a senha armazenada
          </label>
        )}
      </div>
      <div className="border-t border-border/60 pt-4 space-y-3">
        <div>
          <Label className="text-base">Representante legal (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Preencha se o periciando for menor de idade, incapaz ou representado por
            curador/genitor.
          </p>
        </div>
        <div>
          <Label>Nome do representante</Label>
          <Input
            value={form.representante_nome ?? ""}
            onChange={(e) => set("representante_nome", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Parentesco</Label>
            <Input
              value={form.representante_parentesco ?? ""}
              onChange={(e) => set("representante_parentesco", e.target.value)}
              placeholder="genitora, curadora, tutor…"
            />
          </div>
          <div>
            <Label>Profissão</Label>
            <Input
              value={form.representante_profissao ?? ""}
              onChange={(e) => set("representante_profissao", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Nacionalidade</Label>
            <Input
              value={form.representante_nacionalidade ?? ""}
              onChange={(e) => set("representante_nacionalidade", e.target.value)}
              placeholder="brasileira"
            />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input
              type="date"
              value={form.representante_data_nascimento ?? ""}
              onChange={(e) => set("representante_data_nascimento", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>RG</Label>
            <Input
              value={form.representante_rg ?? ""}
              onChange={(e) => set("representante_rg", e.target.value)}
            />
          </div>
          <div>
            <Label>CPF</Label>
            <Input
              value={form.representante_cpf ?? ""}
              onChange={(e) => set("representante_cpf", e.target.value)}
            />
          </div>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Salvar cadastro"}
      </Button>
    </form>
  );
}
