import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

const FORNECEDOR_REF_PREFIX = "[[SIGJUR:FORNECEDOR:";
const NOTA_FISCAL_BUCKET = "notas-fiscais";
const NOTA_FISCAL_MAX_BYTES = 10 * 1024 * 1024;
const NOTA_FISCAL_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

async function ensureNotaFiscalBucket() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new Error(`Falha ao consultar o armazenamento: ${listError.message}`);

  if (!buckets?.some((bucket) => bucket.name === NOTA_FISCAL_BUCKET)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(NOTA_FISCAL_BUCKET, {
      public: false,
      fileSizeLimit: NOTA_FISCAL_MAX_BYTES,
      allowedMimeTypes: [...NOTA_FISCAL_MIME_TYPES],
    });
    if (createError && !/already exists|duplicate/i.test(createError.message)) {
      throw new Error(`Falha ao preparar o armazenamento: ${createError.message}`);
    }
  }
  return supabaseAdmin;
}

function fornecedorIdFromRef(value: string | null | undefined) {
  if (!value?.startsWith(FORNECEDOR_REF_PREFIX) || !value.endsWith("]]")) return null;
  const id = value.slice(FORNECEDOR_REF_PREFIX.length, -2);
  return z.string().uuid().safeParse(id).success ? id : null;
}

function missingFornecedorColumn(message: string) {
  return /fornecedor_id.*(does not exist|schema cache)|column.*fornecedor_id/i.test(message);
}

function masterPasswordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

const LancamentoInput = z
  .object({
    id: z.string().uuid().optional(),
    data: z.string(),
    descricao: z.string().min(1).max(500),
    valor: z.number().nonnegative(),
    tipo: z.enum(["entrada", "saida"]),
    categoria_id: z.string().uuid().nullable().optional(),
    status: z.enum(["pago", "pendente", "atrasado"]).default("pago"),
    tipo_honorario: z.string().nullable().optional(),
    processo_id: z.string().uuid().nullable().optional(),
    fornecedor_id: z.string().uuid().nullable().optional(),
    processo_ref: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
    parcelas: z.number().int().min(1).max(120).default(1),
    juros_percentual: z.number().min(0).max(1000).nullable().optional(),
  })
  .refine((v) => v.tipo !== "entrada" || !!v.processo_id, {
    message: "Toda entrada deve estar vinculada a um processo",
    path: ["processo_id"],
  })
  .refine((v) => v.tipo !== "saida" || !!v.fornecedor_id, {
    message: "Toda saída deve informar o fornecedor",
    path: ["fornecedor_id"],
  });

const FilterInput = z.object({
  mes: z.number().int().min(1).max(12).nullable().optional(),
  ano: z.number().int().min(2000).max(2100).nullable().optional(),
  categoria_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(["entrada", "saida"]).nullable().optional(),
  status: z.enum(["pago", "pendente", "atrasado"]).nullable().optional(),
  processo_id: z.string().uuid().nullable().optional(),
  q: z.string().trim().nullable().optional(),
});

function monthRange(ano?: number | null, mes?: number | null) {
  if (!ano) return null;
  if (mes) {
    const start = new Date(ano, mes - 1, 1);
    const end = new Date(ano, mes, 1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const start = new Date(ano, 0, 1);
  const end = new Date(ano + 1, 0, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export const listLancamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FilterInput.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("lancamentos")
      .select(
        "*, plano_contas(id, codigo, nome, tipo), processos(id, numero_cnj, autor, reu, clientes:clientes!processos_cliente_id_fkey(id, nome))",
      )
      .order("data", { ascending: true });
    const range = monthRange(data.ano, data.mes);
    if (range) {
      q = q.gte("data", range.start).lt("data", range.end);
    }
    if (data.categoria_id) q = q.eq("categoria_id", data.categoria_id);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    const today = new Date().toISOString().slice(0, 10);
    if (data.status === "pago") q = q.eq("status", "pago");
    if (data.status === "pendente") q = q.eq("status", "pendente").gte("data", today);
    if (data.status === "atrasado") q = q.eq("status", "pendente").lt("data", today);
    if (data.processo_id) q = q.eq("processo_id", data.processo_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const supplierIds = Array.from(
      new Set(
        (rows ?? [])
          .map((row) => row.fornecedor_id || fornecedorIdFromRef(row.processo_ref))
          .filter((id): id is string => !!id),
      ),
    );
    const suppliersById = new Map<
      string,
      {
        id: string;
        nome: string;
        cpf_cnpj: string | null;
        telefone: string | null;
        email: string | null;
        endereco: string | null;
        bairro: string | null;
        cidade: string | null;
        estado: string | null;
        cep: string | null;
      }
    >();
    if (supplierIds.length) {
      const { data: supplierRows, error: supplierError } = await context.supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj, telefone, email, endereco, bairro, cidade, estado, cep")
        .in("id", supplierIds);
      if (supplierError) throw new Error(supplierError.message);
      for (const supplier of supplierRows ?? []) suppliersById.set(supplier.id, supplier);
    }
    const enrichedRows = (rows ?? []).map((row) => {
      const fornecedorId = row.fornecedor_id || fornecedorIdFromRef(row.processo_ref);
      return {
        ...row,
        fornecedor_id: fornecedorId,
        fornecedores: fornecedorId ? (suppliersById.get(fornecedorId) ?? null) : null,
      };
    });
    if (!data.q) return enrichedRows;
    const needle = data.q
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return enrichedRows.filter((row) => {
      const processo = row.processos as {
        numero_cnj?: string | null;
        autor?: string | null;
        reu?: string | null;
        clientes?: { nome?: string | null } | null;
      } | null;
      const fornecedor = row.fornecedores as {
        nome?: string | null;
        cpf_cnpj?: string | null;
        telefone?: string | null;
      } | null;
      const haystack = [
        row.descricao,
        row.observacoes,
        row.processo_ref,
        processo?.numero_cnj,
        processo?.autor,
        processo?.reu,
        processo?.clientes?.nome,
        fornecedor?.nome,
        fornecedor?.cpf_cnpj,
        fornecedor?.telefone,
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(needle);
    });
  });

export const upsertLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => LancamentoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { parcelas, juros_percentual, fornecedor_id, ...rest } = data;
    if (rest.tipo === "saida" && fornecedor_id) {
      const { data: supplier, error: supplierError } = await context.supabase
        .from("clientes")
        .select("id, fornecedor, observacoes")
        .eq("id", fornecedor_id)
        .maybeSingle();
      if (supplierError) throw new Error(supplierError.message);
      if (
        !supplier ||
        (supplier.fornecedor !== true && !supplier.observacoes?.includes("[[SIGJUR:FORNECEDOR]]"))
      ) {
        throw new Error("O cadastro selecionado não está marcado como fornecedor.");
      }
    }
    const persisted = {
      ...rest,
      fornecedor_id: rest.tipo === "saida" ? fornecedor_id : null,
      processo_ref: rest.tipo === "saida" ? null : rest.processo_ref,
    };
    const legacyPersisted = {
      ...rest,
      processo_ref:
        rest.tipo === "saida" && fornecedor_id
          ? `${FORNECEDOR_REF_PREFIX}${fornecedor_id}]]`
          : rest.processo_ref,
    };
    const persistedStatus = persisted.status === "atrasado" ? "pendente" : persisted.status;
    if (
      persisted.status === "atrasado" &&
      persisted.data >= new Date().toISOString().slice(0, 10)
    ) {
      throw new Error("Um lançamento atrasado precisa ter uma data anterior à data de hoje.");
    }

    if (persisted.id) {
      const preferred = await context.supabase
        .from("lancamentos")
        .update({
          ...persisted,
          status: persistedStatus,
          juros_percentual: juros_percentual ?? null,
          criado_por: context.userId,
        })
        .eq("id", persisted.id);
      if (preferred.error) {
        if (!missingFornecedorColumn(preferred.error.message)) {
          throw new Error(preferred.error.message);
        }
        const legacy = await context.supabase
          .from("lancamentos")
          .update({
            ...legacyPersisted,
            status: persistedStatus,
            juros_percentual: juros_percentual ?? null,
            criado_por: context.userId,
          })
          .eq("id", persisted.id);
        if (legacy.error) throw new Error(legacy.error.message);
      }
      return { id: persisted.id };
    }

    const n = Math.max(1, parcelas ?? 1);
    const juros = Number(juros_percentual ?? 0);
    const totalComJuros = Number(persisted.valor) * (1 + juros / 100);
    const valorParcela = Math.round((totalComJuros / n) * 100) / 100;
    const grupoId = n > 1 ? crypto.randomUUID() : null;
    const baseDate = new Date(persisted.data + "T00:00:00");

    const rows = Array.from({ length: n }, (_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      const iso = d.toISOString().slice(0, 10);
      return {
        ...persisted,
        status: persistedStatus,
        data: iso,
        valor: valorParcela,
        descricao: n > 1 ? `${persisted.descricao} (${i + 1}/${n})` : persisted.descricao,
        parcela_num: n > 1 ? i + 1 : null,
        parcela_total: n > 1 ? n : null,
        parcela_grupo_id: grupoId,
        juros_percentual: juros > 0 ? juros : null,
        criado_por: context.userId,
      };
    });

    let insertedResult = await context.supabase.from("lancamentos").insert(rows).select("id");
    if (insertedResult.error && missingFornecedorColumn(insertedResult.error.message)) {
      const legacyRows = rows.map(({ fornecedor_id: _fornecedorId, ...row }) => ({
        ...row,
        processo_ref: legacyPersisted.processo_ref,
      }));
      insertedResult = await context.supabase.from("lancamentos").insert(legacyRows).select("id");
    }
    if (insertedResult.error) throw new Error(insertedResult.error.message);
    return {
      id: insertedResult.data?.[0]?.id ?? null,
      count: insertedResult.data?.length ?? 0,
    };
  });

export const deleteLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lancamentos")
      .select("nota_fiscal_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("lancamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.nota_fiscal_path) {
      const admin = await ensureNotaFiscalBucket();
      await admin.storage.from(NOTA_FISCAL_BUCKET).remove([row.nota_fiscal_path]);
    }
    return { ok: true };
  });

export const prepareNotaFiscalUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        file_name: z.string().trim().min(1).max(255),
        content_type: z.enum(NOTA_FISCAL_MIME_TYPES),
        size: z.number().int().positive().max(NOTA_FISCAL_MAX_BYTES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: lancamento, error: lancamentoError } = await context.supabase
      .from("lancamentos")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (lancamentoError) throw new Error(lancamentoError.message);
    if (!lancamento) throw new Error("Lançamento não encontrado.");

    const extensionByMime: Record<(typeof NOTA_FISCAL_MIME_TYPES)[number], string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionByMime[data.content_type];
    const path = `${data.id}/${crypto.randomUUID()}.${extension}`;
    const admin = await ensureNotaFiscalBucket();
    const { data: signed, error } = await admin.storage
      .from(NOTA_FISCAL_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(`Falha ao preparar o comprovante: ${error.message}`);
    return { path, token: signed.token };
  });

export const setNotaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), path: z.string().min(1).max(500).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await ensureNotaFiscalBucket();
    const { data: row, error: readError } = await admin
      .from("lancamentos")
      .select("nota_fiscal_path")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Lançamento não encontrado.");

    const { error } = await admin
      .from("lancamentos")
      .update({ nota_fiscal_path: data.path })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row.nota_fiscal_path && row.nota_fiscal_path !== data.path) {
      await admin.storage.from(NOTA_FISCAL_BUCKET).remove([row.nota_fiscal_path]);
    }
    return { ok: true };
  });

export const getNotaFiscalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await ensureNotaFiscalBucket();
    const { data: signed, error } = await admin.storage
      .from(NOTA_FISCAL_BUCKET)
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const listPlanoContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plano_contas")
      .select("*")
      .eq("ativa", true)
      .order("ordem");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PlanoContasInput = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().trim().min(1).max(20),
  nome: z.string().trim().min(1).max(120),
  tipo: z.enum(["receita", "deducao", "despesa"]),
  ordem: z.number().int().min(0).max(9999).default(0),
  ativa: z.boolean().default(true),
});

export const upsertPlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => PlanoContasInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("plano_contas")
        .update({
          codigo: data.codigo,
          nome: data.nome,
          tipo: data.tipo,
          ordem: data.ordem,
          ativa: data.ativa,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("plano_contas")
      .insert({
        codigo: data.codigo,
        nome: data.nome,
        tipo: data.tipo,
        ordem: data.ordem,
        ativa: data.ativa,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row?.id };
  });

export const deletePlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), master_password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const expected = process.env.MASTER_DELETE_PASSWORD;
    if (!expected) throw new Error("Senha master não configurada no servidor");
    if (!masterPasswordMatches(data.master_password, expected))
      throw new Error("Senha master incorreta");
    const { count, error: countErr } = await context.supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", data.id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Esta categoria possui ${count} lançamento(s) vinculado(s). Reatribua ou desative em vez de excluir.`,
      );
    }
    const { error } = await context.supabase.from("plano_contas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DreInput = z.object({
  ano: z.number().int().min(2000).max(2100).optional(),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export const getDre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DreInput.parse(d))
  .handler(async ({ data, context }) => {
    let range: { start: string; end: string };
    if (data.inicio && data.fim) {
      range = { start: data.inicio, end: addDaysISO(data.fim, 1) };
    } else if (data.inicio) {
      range = { start: data.inicio, end: addDaysISO(data.inicio, 1) };
    } else {
      range = monthRange(data.ano ?? new Date().getFullYear(), data.mes)!;
    }
    const [{ data: rows, error }, { data: planos, error: planoErr }] = await Promise.all([
      context.supabase
        .from("lancamentos")
        .select("valor, tipo, status, categoria_id")
        .gte("data", range.start)
        .lt("data", range.end)
        .eq("status", "pago"),
      context.supabase
        .from("plano_contas")
        .select("id, codigo, nome, tipo, ordem")
        .eq("ativa", true)
        .order("ordem"),
    ]);
    if (error) throw new Error(error.message);
    if (planoErr) throw new Error(planoErr.message);

    const totals = new Map<string, number>();
    let receitasSemCategoria = 0;
    let despesasSemCategoria = 0;
    for (const r of (rows ?? []) as Array<{
      valor: number;
      categoria_id: string | null;
      tipo: string;
    }>) {
      if (!r.categoria_id) {
        if (r.tipo === "entrada") receitasSemCategoria += Number(r.valor);
        else despesasSemCategoria += Number(r.valor);
        continue;
      }
      totals.set(r.categoria_id, (totals.get(r.categoria_id) ?? 0) + Number(r.valor));
    }
    const cats = (planos ?? []).map((p) => ({ ...p, total: totals.get(p.id) ?? 0 }));
    const receita = [
      ...cats.filter((c) => c.tipo === "receita"),
      ...(receitasSemCategoria > 0
        ? [
            {
              id: "sem-categoria-receita",
              codigo: "",
              nome: "Receitas sem categoria",
              tipo: "receita",
              ordem: 9998,
              total: receitasSemCategoria,
            },
          ]
        : []),
    ];
    const deducoes = cats.filter((c) => c.tipo === "deducao");
    const despesas = [
      ...cats.filter((c) => c.tipo === "despesa"),
      ...(despesasSemCategoria > 0
        ? [
            {
              id: "sem-categoria-despesa",
              codigo: "",
              nome: "Despesas sem categoria",
              tipo: "despesa",
              ordem: 9999,
              total: despesasSemCategoria,
            },
          ]
        : []),
    ];
    const receitaBruta = receita.reduce((s, c) => s + c.total, 0);
    const totalDeducoes = deducoes.reduce((s, c) => s + c.total, 0);
    const receitaLiquida = receitaBruta - totalDeducoes;
    const totalDespesas = despesas.reduce((s, c) => s + c.total, 0);
    const resultado = receitaLiquida - totalDespesas;
    return {
      receita,
      deducoes,
      despesas,
      receitaBruta,
      totalDeducoes,
      receitaLiquida,
      totalDespesas,
      resultado,
    };
  });
