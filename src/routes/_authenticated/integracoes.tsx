import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listSyncMappings,
  upsertSyncMapping,
  deleteSyncMapping,
  runSyncMapping,
  listSpreadsheetTabs,
  importLancamentosFromSheet,
} from "@/lib/google-sheets.functions";
import {
  createBackupSnapshot,
  listBackupSnapshots,
  downloadBackupSnapshot,
  deleteBackupSnapshot,
} from "@/lib/backups.functions";
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
import {
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Search,
  Database,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/integracoes")({
  component: IntegracoesPage,
});

type Modulo = "painel" | "processos" | "clientes" | "lancamentos" | "dre";
const MODULO_LABEL: Record<Modulo, string> = {
  painel: "Painel",
  processos: "Audiências",
  clientes: "Clientes",
  lancamentos: "Lançamentos",
  dre: "DRE",
};
const MODULOS: Modulo[] = ["painel", "processos", "clientes", "lancamentos", "dre"];

function extractId(input: string): string {
  const v = input.trim();
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}

function IntegracoesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSyncMappings);
  const upsertFn = useServerFn(upsertSyncMapping);
  const deleteFn = useServerFn(deleteSyncMapping);
  const runFn = useServerFn(runSyncMapping);
  const listTabsFn = useServerFn(listSpreadsheetTabs);
  const importFn = useServerFn(importLancamentosFromSheet);

  const mappings = useQuery({
    queryKey: ["sync-mappings"],
    queryFn: () => listFn(),
  });

  // Form state
  const [modulo, setModulo] = useState<Modulo>("painel");
  const [label, setLabel] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const spreadsheetId = linkInput ? extractId(linkInput) : "";

  async function handleFetchTabs() {
    if (!spreadsheetId) {
      toast.error("Cole primeiro o link da planilha.");
      return;
    }
    setBusy(true);
    try {
      const res = await listTabsFn({ data: { spreadsheetId } });
      setAvailableTabs(res.tabs);
      if (!sheetName && res.tabs.length > 0) setSheetName(res.tabs[0]);
      toast.success(`${res.tabs.length} aba(s) encontrada(s) em "${res.title}"`);
    } catch (e) {
      toast.error("Falha ao ler planilha", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!spreadsheetId || !sheetName.trim() || !label.trim()) {
      toast.error("Preencha rótulo, link da planilha e nome da aba.");
      return;
    }
    setBusy(true);
    try {
      await upsertFn({
        data: {
          modulo,
          label: label.trim(),
          spreadsheetId,
          sheetName: sheetName.trim(),
          ano: modulo === "dre" ? ano : null,
        },
      });
      toast.success("Sincronização adicionada.");
      setLabel("");
      setLinkInput("");
      setSheetName("");
      setAvailableTabs([]);
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta sincronização?")) return;
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    } catch (e) {
      toast.error("Falha ao remover", { description: (e as Error).message });
    }
  }

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      const res = await runFn({ data: { id } });
      toast.success(`Sincronizado (${res.linhas} linhas).`);
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    } catch (e) {
      toast.error("Falha ao sincronizar", { description: (e as Error).message });
    } finally {
      setRunningId(null);
    }
  }

  async function handleSyncAll() {
    const rows = mappings.data ?? [];
    if (rows.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const r of rows) {
      try {
        await runFn({ data: { id: r.id } });
        ok++;
      } catch {
        // continua as demais
      }
    }
    qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    setBusy(false);
    toast.success(`${ok}/${rows.length} sincronização(ões) concluídas.`);
  }

  // Import
  const [importSpreadsheet, setImportSpreadsheet] = useState("");
  const [importSheet, setImportSheet] = useState("Lançamentos");

  async function handleImport() {
    const sid = extractId(importSpreadsheet);
    if (!sid) return toast.error("Informe o link da planilha.");
    setBusy(true);
    try {
      const res = await importFn({ data: { spreadsheetId: sid, sheetName: importSheet } });
      toast.success(`${res.inseridos} lançamento(s) importado(s).`, {
        description: res.erros.length ? `${res.erros.length} linha(s) ignorada(s).` : undefined,
      });
    } catch (e) {
      toast.error("Falha ao importar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Integrações</p>
        <h1 className="font-serif text-3xl mt-1">Sincronização com Google Sheets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quais módulos da barra lateral são gravados em quais abas — cada linha aponta
          para uma planilha e uma aba específica.
        </p>
      </header>

      {/* Lista de sincronizações */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-serif text-xl flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-5 h-5 shrink-0" />
            <span className="truncate">Sincronizações configuradas</span>
          </CardTitle>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mappings.refetch()}
              disabled={mappings.isFetching}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${mappings.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleSyncAll}
              disabled={busy || (mappings.data ?? []).length === 0}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Sincronizar tudo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {mappings.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {(mappings.data ?? []).length === 0 && !mappings.isLoading && (
            <p className="text-sm text-muted-foreground">
              Nenhuma sincronização configurada. Use o formulário abaixo para adicionar a primeira.
            </p>
          )}
          {(mappings.data ?? []).map((m) => (
            <div
              key={m.id}
              className="rounded-md border border-border/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-accent/20 text-accent">
                    {MODULO_LABEL[m.modulo as Modulo] ?? m.modulo}
                  </span>
                  <p className="text-sm font-medium truncate">{m.label}</p>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  Aba: <span className="text-foreground/80">{m.sheet_name}</span>
                  {m.ano ? ` · Ano ${m.ano}` : ""}
                  {m.last_synced_at
                    ? ` · última sync ${new Date(m.last_synced_at).toLocaleString("pt-BR")}`
                    : " · nunca sincronizado"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={`https://docs.google.com/spreadsheets/d/${m.spreadsheet_id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent/20 text-muted-foreground"
                  title="Abrir planilha"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRun(m.id)}
                  disabled={runningId === m.id || busy}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1 ${runningId === m.id ? "animate-spin" : ""}`}
                  />
                  Sincronizar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(m.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Adicionar nova */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Plus className="w-5 h-5" /> Adicionar sincronização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Módulo</Label>
              <Select value={modulo} onValueChange={(v) => setModulo(v as Modulo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODULO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rótulo (para você identificar)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`ex.: ${MODULO_LABEL[modulo]} — planilha do escritório`}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Link da planilha do Google Sheets</Label>
            <div className="flex gap-2">
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                className="flex-1"
              />
              <Button variant="outline" onClick={handleFetchTabs} disabled={busy || !spreadsheetId}>
                <Search className="w-4 h-4 mr-1" /> Ler abas
              </Button>
            </div>
            {spreadsheetId && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                ID: {spreadsheetId}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Aba de destino</Label>
              {availableTabs.length > 0 ? (
                <Select value={sheetName} onValueChange={setSheetName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma aba" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTabs.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Nome da aba (será criada se não existir)"
                />
              )}
            </div>
            {modulo === "dre" && (
              <div>
                <Label className="text-xs">Ano (DRE)</Label>
                <Input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())}
                />
              </div>
            )}
          </div>

          <Button
            onClick={handleAdd}
            disabled={busy || !spreadsheetId || !sheetName.trim() || !label.trim()}
          >
            <Plus className="w-4 h-4 mr-2" /> Adicionar sincronização
          </Button>
          <p className="text-xs text-muted-foreground">
            Ao sincronizar, o conteúdo anterior da aba é substituído pelos dados atuais do módulo.
            Se a aba não existir, ela é criada.
          </p>
        </CardContent>
      </Card>

      {/* Import legacy */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Download className="w-5 h-5" /> Importar lançamentos de uma planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Link da planilha</Label>
            <Input
              value={importSpreadsheet}
              onChange={(e) => setImportSpreadsheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            />
          </div>
          <div>
            <Label className="text-xs">Nome da aba</Label>
            <Input
              value={importSheet}
              onChange={(e) => setImportSheet(e.target.value)}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Colunas obrigatórias: <code>Data, Descrição, Valor, Tipo</code>. Opcionais:{" "}
              <code>Status, Categoria (código), Tipo honorário, Processo, Observações</code>.
            </p>
          </div>
          <Button onClick={handleImport} disabled={busy || !importSpreadsheet} variant="secondary">
            <Download className="w-4 h-4 mr-2" /> Importar agora
          </Button>
        </CardContent>
      </Card>

      <BackupsSection />
    </div>
  );
}

function BackupsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBackupSnapshots);
  const createFn = useServerFn(createBackupSnapshot);
  const downloadFn = useServerFn(downloadBackupSnapshot);
  const deleteFn = useServerFn(deleteBackupSnapshot);
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useQuery({ queryKey: ["backups"], queryFn: () => listFn() });

  async function handleCreate() {
    try {
      setBusy(true);
      await createFn({ data: { tag: tag.trim() || undefined } });
      setTag("");
      toast.success("Backup salvo no sistema");
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar backup");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(id: string, tag: string | null) {
    try {
      const row = await downloadFn({ data: { id } });
      const blob = new Blob([JSON.stringify(row.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${(tag ?? row.id).replace(/[^a-z0-9-_]+/gi, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar backup");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este backup?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Backup excluído");
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  function formatSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <Database className="w-5 h-5" /> Backup no sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Guarda uma cópia completa (JSON) de todos os dados diretamente no banco. Baixe a qualquer
          momento para ter também uma cópia local. É independente do backup no Google Sheets.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Rótulo (opcional) — ex.: antes da migração"
            className="max-w-md"
          />
          <Button onClick={handleCreate} disabled={busy}>
            <Save className="w-4 h-4 mr-2" /> Gerar backup agora
          </Button>
        </div>

        <div className="border rounded-md divide-y">
          {list.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
          ) : (list.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhum backup ainda.</p>
          ) : (
            (list.data ?? []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.tag ?? "Backup"}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {new Date(b.created_at).toLocaleString("pt-BR")} · {formatSize(b.size_bytes)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(b.id, b.tag)}>
                    <Download className="w-4 h-4 mr-1" /> Baixar JSON
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
