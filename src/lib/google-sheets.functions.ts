import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SHEETS_GW = "https://connector-gateway.lovable.dev/google_sheets";
const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive";

function sheetsHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovable || !key) throw new Error("Integração Google Sheets não configurada.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

function driveHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovable || !key) throw new Error("Integração Google Drive não configurada.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function gwFetch(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

// ---------- Drive: listar planilhas ----------
export const listDriveSpreadsheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const q = encodeURIComponent(
      "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    );
    const url = `${DRIVE_GW}/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=50`;
    const data = (await gwFetch(url, { method: "GET", headers: driveHeaders() })) as {
      files?: Array<{ id: string; name: string; modifiedTime: string; webViewLink: string }>;
    };
    return data.files ?? [];
  });

// ---------- Sheets: criar planilha ----------
export const createSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = (await gwFetch(`${SHEETS_GW}/v4/spreadsheets`, {
      method: "POST",
      headers: sheetsHeaders(),
      body: JSON.stringify({ properties: { title: data.title } }),
    })) as { spreadsheetId: string; spreadsheetUrl: string };
    return { id: res.spreadsheetId, url: res.spreadsheetUrl };
  });

// ---------- Sheets: listar abas de uma planilha ----------
export const listSpreadsheetTabs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ spreadsheetId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const res = (await gwFetch(
      `${SHEETS_GW}/v4/spreadsheets/${data.spreadsheetId}?fields=properties(title),sheets(properties(title))`,
      { method: "GET", headers: sheetsHeaders() },
    )) as { properties: { title: string }; sheets: Array<{ properties: { title: string } }> };
    return {
      title: res.properties.title,
      tabs: res.sheets.map((s) => s.properties.title),
    };
  });

// ---------- helpers ----------
async function ensureSheet(spreadsheetId: string, sheetName: string) {
  const meta = (await gwFetch(
    `${SHEETS_GW}/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`,
    { method: "GET", headers: sheetsHeaders() },
  )) as { sheets: Array<{ properties: { title: string } }> };
  const exists = meta.sheets.some((s) => s.properties.title === sheetName);
  if (!exists) {
    await gwFetch(`${SHEETS_GW}/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: sheetsHeaders(),
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  }
}

async function replaceSheetValues(
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | null)[][],
) {
  await ensureSheet(spreadsheetId, sheetName);
  await gwFetch(
    `${SHEETS_GW}/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`,
    { method: "POST", headers: sheetsHeaders(), body: "{}" },
  );
  if (values.length === 0) return;
  const range = `${sheetName}!A1`;
  await gwFetch(
    `${SHEETS_GW}/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: sheetsHeaders(),
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
}

async function readSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const data = (await gwFetch(
    `${SHEETS_GW}/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { method: "GET", headers: sheetsHeaders() },
  )) as { values?: string[][] };
  return data.values ?? [];
}

// ---------- Value builders (por módulo) ----------
type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function buildValuesFor(
  modulo: "painel" | "lancamentos" | "processos" | "clientes" | "dre",
  ctx: Ctx,
  ano?: number,
): Promise<(string | number | null)[][]> {
  if (modulo === "painel") {
    const [lancRes, procRes, cliRes] = await Promise.all([
      ctx.supabase.from("lancamentos").select("valor, tipo, status, data"),
      ctx.supabase.from("processos").select("status, valor_causa, created_at"),
      ctx.supabase.from("clientes").select("id, created_at, tipo"),
    ]);
    if (lancRes.error) throw new Error(lancRes.error.message);
    if (procRes.error) throw new Error(procRes.error.message);
    if (cliRes.error) throw new Error(cliRes.error.message);

    const lancs = (lancRes.data ?? []) as Array<{
      valor: number | string;
      tipo: string;
      status: string;
      data: string;
    }>;
    const procs = (procRes.data ?? []) as Array<{
      status: string;
      valor_causa: number | string | null;
    }>;
    const clis = (cliRes.data ?? []) as Array<{ tipo: string | null }>;

    const anoAtual = ano ?? new Date().getFullYear();
    const anoPrefix = `${anoAtual}-`;
    let entradasAno = 0,
      saidasAno = 0,
      aReceber = 0,
      aPagar = 0;
    for (const l of lancs) {
      const v = Number(l.valor || 0);
      const noAno = l.data?.startsWith(anoPrefix);
      if (l.status === "pago" && noAno) {
        if (l.tipo === "entrada") entradasAno += v;
        else saidasAno += v;
      } else if (l.status === "pendente") {
        if (l.tipo === "entrada") aReceber += v;
        else aPagar += v;
      }
    }

    const statusCount = new Map<string, number>();
    let valorTotalCausas = 0;
    for (const p of procs) {
      statusCount.set(p.status ?? "—", (statusCount.get(p.status ?? "—") ?? 0) + 1);
      valorTotalCausas += Number(p.valor_causa || 0);
    }
    let pfCount = 0,
      pjCount = 0;
    for (const c of clis) {
      if (c.tipo === "pf") pfCount++;
      else if (c.tipo === "pj") pjCount++;
    }

    return [
      ["Painel do escritório", "", `Atualizado em ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["Indicador", "Valor"],
      ["Ano de referência", anoAtual],
      ["Clientes cadastrados", clis.length],
      ["  — Pessoa Física", pfCount],
      ["  — Pessoa Jurídica", pjCount],
      ["Processos cadastrados", procs.length],
      ["Valor total das causas (R$)", valorTotalCausas],
      [],
      ["Financeiro — Ano corrente", ""],
      ["Entradas pagas (R$)", entradasAno],
      ["Saídas pagas (R$)", saidasAno],
      ["Resultado (R$)", entradasAno - saidasAno],
      ["A receber (R$)", aReceber],
      ["A pagar (R$)", aPagar],
      [],
      ["Processos por status", "Quantidade"],
      ...Array.from(statusCount.entries()).map(([s, n]) => [s, n] as (string | number)[]),
    ];
  }

  if (modulo === "lancamentos") {
    const { data, error } = await ctx.supabase
      .from("lancamentos")
      .select(
        "data, descricao, valor, tipo, status, tipo_honorario, processo_ref, observacoes, plano_contas(codigo, nome)",
      )
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      data: string;
      descricao: string;
      valor: number | string;
      tipo: string;
      status: string;
      tipo_honorario: string | null;
      processo_ref: string | null;
      observacoes: string | null;
      plano_contas: { codigo: string; nome: string } | null;
    }>;
    return [
      [
        "Data",
        "Descrição",
        "Valor",
        "Tipo",
        "Status",
        "Categoria (código)",
        "Categoria (nome)",
        "Tipo honorário",
        "Processo",
        "Observações",
      ],
      ...rows.map((r) => [
        r.data,
        r.descricao,
        Number(r.valor),
        r.tipo,
        r.status,
        r.plano_contas?.codigo ?? "",
        r.plano_contas?.nome ?? "",
        r.tipo_honorario ?? "",
        r.processo_ref ?? "",
        r.observacoes ?? "",
      ]),
    ];
  }

  if (modulo === "processos") {
    const { data, error } = await ctx.supabase
      .from("processos")
      .select(
        "numero_cnj, autor, reu, status, materia, vara, tribunal, comarca, data_protocolo, data_encerramento, origem, valor_causa, observacoes, clientes(nome)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (data ?? []) as Array<
      Record<string, unknown> & { clientes: { nome: string } | null }
    >;
    return [
      [
        "CNJ",
        "Autor",
        "Réu",
        "Status",
        "Matéria",
        "Vara",
        "Tribunal",
        "Comarca",
        "Data protocolo",
        "Data encerramento",
        "Origem",
        "Valor causa",
        "Cadastro vinculado",
        "Observações",
      ],
      ...list.map((p) => [
        (p.numero_cnj as string) ?? "",
        (p.autor as string) ?? "",
        (p.reu as string) ?? "",
        (p.status as string) ?? "",
        (p.materia as string) ?? "",
        (p.vara as string) ?? "",
        (p.tribunal as string) ?? "",
        (p.comarca as string) ?? "",
        (p.data_protocolo as string) ?? "",
        (p.data_encerramento as string) ?? "",
        (p.origem as string) ?? "",
        p.valor_causa != null ? Number(p.valor_causa) : "",
        p.clientes?.nome ?? "",
        (p.observacoes as string) ?? "",
      ]),
    ];
  }

  if (modulo === "clientes") {
    const { data, error } = await ctx.supabase
      .from("clientes")
      .select(
        "tipo, nome, cpf_cnpj, email, telefone, profissao, data_aniversario, cidade, estado, cep, endereco, observacoes",
      )
      .order("nome");
    if (error) throw new Error(error.message);
    const list = (data ?? []) as Array<Record<string, unknown>>;
    return [
      [
        "Tipo",
        "Nome",
        "CPF/CNPJ",
        "Email",
        "Telefone",
        "Profissão",
        "Aniversário",
        "Cidade",
        "Estado",
        "CEP",
        "Endereço",
        "Observações",
      ],
      ...list.map((c) => [
        (c.tipo as string) ?? "",
        (c.nome as string) ?? "",
        (c.cpf_cnpj as string) ?? "",
        (c.email as string) ?? "",
        (c.telefone as string) ?? "",
        (c.profissao as string) ?? "",
        (c.data_aniversario as string) ?? "",
        (c.cidade as string) ?? "",
        (c.estado as string) ?? "",
        (c.cep as string) ?? "",
        (c.endereco as string) ?? "",
        (c.observacoes as string) ?? "",
      ]),
    ];
  }

  // dre
  const anoDre = ano ?? new Date().getFullYear();
  const { data, error } = await ctx.supabase
    .from("lancamentos")
    .select("valor, data, status, plano_contas(codigo, nome, tipo, ordem)")
    .gte("data", `${anoDre}-01-01`)
    .lt("data", `${anoDre + 1}-01-01`)
    .eq("status", "pago");
  if (error) throw new Error(error.message);
  type R = {
    valor: number | string;
    data: string;
    plano_contas: { codigo: string; nome: string; tipo: string; ordem: number } | null;
  };
  const list = (data ?? []) as R[];
  const cats = new Map<
    string,
    { codigo: string; nome: string; tipo: string; ordem: number; meses: number[] }
  >();
  for (const r of list) {
    if (!r.plano_contas) continue;
    const key = r.plano_contas.codigo;
    const cur = cats.get(key) ?? { ...r.plano_contas, meses: Array(12).fill(0) };
    const m = Number(r.data.slice(5, 7)) - 1;
    cur.meses[m] += Number(r.valor);
    cats.set(key, cur);
  }
  const ordered = Array.from(cats.values()).sort((a, b) => a.ordem - b.ordem);
  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const values: (string | number | null)[][] = [
    [`DRE ${anoDre}`, "", "", ...Array(12).fill(""), ""],
    ["Código", "Categoria", "Tipo", ...monthNames, "Total"],
  ];
  const totalRow: number[] = Array(12).fill(0);
  const sectionTotals: Record<string, number[]> = {
    receita: Array(12).fill(0),
    deducao: Array(12).fill(0),
    despesa: Array(12).fill(0),
  };
  for (const c of ordered) {
    const total = c.meses.reduce((s, v) => s + v, 0);
    values.push([c.codigo, c.nome, c.tipo, ...c.meses, total]);
    c.meses.forEach((v, i) => {
      totalRow[i] += c.tipo === "despesa" || c.tipo === "deducao" ? -v : v;
      sectionTotals[c.tipo]![i] += v;
    });
  }
  values.push([]);
  values.push([
    "",
    "Receita bruta",
    "",
    ...sectionTotals.receita,
    sectionTotals.receita.reduce((s, v) => s + v, 0),
  ]);
  values.push([
    "",
    "(-) Deduções",
    "",
    ...sectionTotals.deducao,
    sectionTotals.deducao.reduce((s, v) => s + v, 0),
  ]);
  values.push([
    "",
    "(-) Despesas",
    "",
    ...sectionTotals.despesa,
    sectionTotals.despesa.reduce((s, v) => s + v, 0),
  ]);
  values.push(["", "Resultado líquido", "", ...totalRow, totalRow.reduce((s, v) => s + v, 0)]);
  return values;
}

// ---------- Sync mappings (CRUD) ----------
const MappingInput = z.object({
  id: z.string().uuid().optional(),
  modulo: z.enum(["painel", "processos", "clientes", "lancamentos", "dre"]),
  label: z.string().min(1).max(120),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1).max(100),
  ano: z.number().int().optional().nullable(),
});

export const listSyncMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sync_mappings")
      .select("id, modulo, label, spreadsheet_id, sheet_name, ano, last_synced_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      modulo: string;
      label: string;
      spreadsheet_id: string;
      sheet_name: string;
      ano: number | null;
      last_synced_at: string | null;
      created_at: string;
    }>;
  });

export const upsertSyncMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => MappingInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      modulo: data.modulo,
      label: data.label,
      spreadsheet_id: data.spreadsheetId,
      sheet_name: data.sheetName,
      ano: data.ano ?? null,
      user_id: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("sync_mappings")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("sync_mappings")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteSyncMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sync_mappings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runSyncMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sync_mappings")
      .select("modulo, spreadsheet_id, sheet_name, ano")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Sincronização não encontrada");
    const m = row as {
      modulo: "painel" | "processos" | "clientes" | "lancamentos" | "dre";
      spreadsheet_id: string;
      sheet_name: string;
      ano: number | null;
    };

    const values = await buildValuesFor(m.modulo, context as unknown as Ctx, m.ano ?? undefined);
    await replaceSheetValues(m.spreadsheet_id, m.sheet_name, values);

    await context.supabase
      .from("sync_mappings")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", data.id);

    return { ok: true, linhas: values.length };
  });

// Sincroniza todos os mapeamentos de um (ou vários) módulo(s).
// Usado para auto-sync após criação/edição/remoção em processos, clientes, lançamentos, etc.
export const syncModulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        modulos: z.array(z.enum(["painel", "processos", "clientes", "lancamentos", "dre"])).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sync_mappings")
      .select("id, modulo, spreadsheet_id, sheet_name, ano")
      .in("modulo", data.modulos);
    if (error) throw new Error(error.message);
    const results: { id: string; modulo: string; linhas: number; ok: boolean; error?: string }[] =
      [];
    for (const r of (rows ?? []) as Array<{
      id: string;
      modulo: "painel" | "processos" | "clientes" | "lancamentos" | "dre";
      spreadsheet_id: string;
      sheet_name: string;
      ano: number | null;
    }>) {
      try {
        const values = await buildValuesFor(
          r.modulo,
          context as unknown as Ctx,
          r.ano ?? undefined,
        );
        await replaceSheetValues(r.spreadsheet_id, r.sheet_name, values);
        await context.supabase
          .from("sync_mappings")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", r.id);
        results.push({ id: r.id, modulo: r.modulo, linhas: values.length, ok: true });
      } catch (e) {
        results.push({
          id: r.id,
          modulo: r.modulo,
          linhas: 0,
          ok: false,
          error: (e as Error).message,
        });
      }
    }
    return { ok: true, results };
  });

// ---------- (legacy) Unified export por planilha única ----------
const ExportInput = z.object({
  spreadsheetId: z.string().min(1),
  modules: z.array(z.enum(["painel", "lancamentos", "processos", "clientes", "dre"])).min(1),
  ano: z.number().int().optional(),
});

export const exportToSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => ExportInput.parse(d))
  .handler(async ({ data, context }) => {
    const results: { modulo: string; linhas: number }[] = [];
    const sheetNameMap: Record<string, string> = {
      painel: "Painel",
      lancamentos: "Lançamentos",
      processos: "Processos",
      clientes: "Clientes",
      dre: "DRE",
    };
    for (const m of data.modules) {
      const values = await buildValuesFor(m, context as unknown as Ctx, data.ano);
      await replaceSheetValues(data.spreadsheetId, sheetNameMap[m], values);
      results.push({ modulo: m, linhas: values.length });
    }
    return { ok: true, results };
  });

// ---------- Import: Lançamentos ----------
const ImportLancInput = z.object({
  spreadsheetId: z.string().min(1),
  sheetName: z.string().default("Lançamentos"),
});

export const importLancamentosFromSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => ImportLancInput.parse(d))
  .handler(async ({ data, context }) => {
    const values = await readSheetValues(data.spreadsheetId, `${data.sheetName}!A1:Z10000`);
    if (values.length < 2) return { inseridos: 0, erros: [] as string[] };
    const [header, ...rows] = values;
    const idx = (name: string) =>
      header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    const iData = idx("Data"),
      iDesc = idx("Descrição"),
      iValor = idx("Valor"),
      iTipo = idx("Tipo");
    const iStatus = idx("Status"),
      iCatCod = idx("Categoria (código)");
    const iHon = idx("Tipo honorário"),
      iProc = idx("Processo"),
      iObs = idx("Observações");
    if (iData < 0 || iDesc < 0 || iValor < 0 || iTipo < 0) {
      throw new Error("Cabeçalhos obrigatórios ausentes: Data, Descrição, Valor, Tipo.");
    }
    const { data: contas } = await context.supabase.from("plano_contas").select("id, codigo");
    const contaMap = new Map<string, string>();
    for (const c of (contas ?? []) as Array<{ id: string; codigo: string }>)
      contaMap.set(c.codigo, c.id);

    const inserts: Record<string, unknown>[] = [];
    const erros: string[] = [];
    rows.forEach((r, i) => {
      const line = i + 2;
      const dataStr = (r[iData] ?? "").trim();
      const desc = (r[iDesc] ?? "").trim();
      const valorNum = Number(String(r[iValor] ?? "").replace(",", "."));
      const tipo = (r[iTipo] ?? "").trim().toLowerCase();
      if (
        !dataStr ||
        !desc ||
        !Number.isFinite(valorNum) ||
        (tipo !== "entrada" && tipo !== "saida")
      ) {
        erros.push(`Linha ${line}: dados inválidos`);
        return;
      }
      const status = iStatus >= 0 ? (r[iStatus] ?? "pago").trim().toLowerCase() || "pago" : "pago";
      const catCod = iCatCod >= 0 ? (r[iCatCod] ?? "").trim() : "";
      inserts.push({
        data: dataStr,
        descricao: desc,
        valor: valorNum,
        tipo,
        status: status === "pendente" ? "pendente" : "pago",
        categoria_id: catCod ? (contaMap.get(catCod) ?? null) : null,
        tipo_honorario: iHon >= 0 ? r[iHon] || null : null,
        processo_ref: iProc >= 0 ? r[iProc] || null : null,
        observacoes: iObs >= 0 ? r[iObs] || null : null,
        criado_por: context.userId,
      });
    });

    if (inserts.length > 0) {
      const { error } = await context.supabase.from("lancamentos").insert(inserts as never);
      if (error) throw new Error(error.message);
    }
    return { inseridos: inserts.length, erros };
  });
