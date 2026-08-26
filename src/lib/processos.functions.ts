import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

export const STATUS_PROCESSO = [
  "inicial",
  "em_andamento",
  "execucao",
  "recurso",
  "concluso_sentenca",
  "suspenso",
  "arquivado",
  "julgado_procedente",
  "julgado_improcedente",
  "acordo",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  inicial: "Inicial",
  em_andamento: "Em andamento",
  execucao: "Execução",
  recurso: "Recurso",
  concluso_sentenca: "Concluso p/ sentença",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  julgado_procedente: "Julgado procedente",
  julgado_improcedente: "Julgado improcedente",
  acordo: "Acordo",
};

const ProcessoInput = z.object({
  id: z.string().uuid().optional(),
  numero_cnj: z.string().nullable().optional(),
  pasta: z.string().nullable().optional(),
  autor: z.string().min(1),
  reu: z.string().min(1),
  autores: z.array(z.string().trim().min(1).max(240)).min(1).optional(),
  reus: z.array(z.string().trim().min(1).max(240)).min(1).optional(),
  status: z.string().trim().min(1).max(80).default("inicial"),
  materia: z.string().nullable().optional(),
  tipo_acao: z.string().nullable().optional(),
  instancia: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  fase: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  advogado: z.string().nullable().optional(),
  vara: z.string().nullable().optional(),
  tribunal: z.string().nullable().optional(),
  comarca: z.string().nullable().optional(),
  data_protocolo: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_encerramento: z.string().nullable().optional(),
  prazo_em_aberto: z.boolean().nullable().optional(),
  data_prazo: z.string().nullable().optional(),
  detalhes_prazo: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
  indicacao_id: z.string().uuid().nullable().optional(),
  valor_causa: z.number().nullable().optional(),
  valor_acordo: z.number().nullable().optional(),
  honorarios_valor: z.number().nullable().optional(),
  honorarios_percentual: z.number().nullable().optional(),
  sucumbencias_percentual: z.number().nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  representante_id: z.string().uuid().nullable().optional(),
  cliente_qualificacao: z.string().nullable().optional(),
  outro_envolvido: z.string().nullable().optional(),
  outro_envolvido_cliente_id: z.string().uuid().nullable().optional(),
  outro_envolvido_qualificacao: z.string().nullable().optional(),
  link_processo: z.string().nullable().optional(),
  link_pasta: z.string().nullable().optional(),
  resultado: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export type ProcessoFormInput = z.infer<typeof ProcessoInput>;

export type ProcessoRow = {
  id: string;
  numero_cnj: string | null;
  pasta: string | null;
  autor: string;
  reu: string;
  autores?: string[];
  reus?: string[];
  status: string;
  materia: string | null;
  tipo_acao: string | null;
  instancia: string | null;
  area: string | null;
  fase: string | null;
  tipo: string | null;
  advogado: string | null;
  vara: string | null;
  tribunal: string | null;
  comarca: string | null;
  data_protocolo: string | null;
  data_inicio: string | null;
  data_encerramento: string | null;
  prazo_em_aberto: boolean | null;
  data_prazo: string | null;
  detalhes_prazo: string | null;
  origem: string | null;
  indicacao_id: string | null;
  valor_causa: number | null;
  valor_acordo: number | null;
  honorarios_valor: number | null;
  honorarios_percentual: number | null;
  sucumbencias_percentual: number | null;
  cliente_id: string | null;
  representante_id: string | null;
  cliente_qualificacao: string | null;
  outro_envolvido: string | null;
  outro_envolvido_cliente_id: string | null;
  outro_envolvido_qualificacao: string | null;
  link_processo: string | null;
  link_pasta: string | null;
  resultado: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { id: string; nome: string; tipo: "pf" | "pj" } | null;
  indicacoes?: { id: string; nome: string } | null;
};

const ProcessoOrder = z.enum(["entrada_desc", "entrada_asc", "cadastro_desc", "cadastro_asc"]);

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function normalizeCatalogValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function matchesProcessoSearch(processo: ProcessoRow, rawSearch: string) {
  const search = normalizeSearch(rawSearch);
  if (!search) return true;
  const numberSearch = search.replace(/\D/g, "");
  const numero = (processo.numero_cnj ?? "").replace(/\D/g, "");
  if (numberSearch && numero.includes(numberSearch)) return true;

  const wantedWords = search.split(/\s+/).filter(Boolean);
  const textString = normalizeSearch(
    [
      processo.clientes?.nome,
      processo.autor,
      processo.reu,
      processo.outro_envolvido,
      processo.numero_cnj,
      processo.tipo_acao,
      processo.materia,
      processo.area,
      processo.advogado,
      processo.indicacoes?.nome,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return wantedWords.every((wanted) => textString.includes(wanted));
}

// Processos antigos foram gravados somente com matéria. A área continua
// sendo exibida nesses registros para não deixar a coluna vazia.
function normalizeProcessoArea<T extends ProcessoRow>(processo: T): T {
  return processo.area?.trim() ? processo : ({ ...processo, area: processo.materia } as T);
}

function applyProcessoOrder<T>(query: T, order: z.infer<typeof ProcessoOrder>) {
  const q = query as T & {
    order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => T;
  };
  if (order === "entrada_asc")
    return q.order("data_inicio", { ascending: true, nullsFirst: false });
  if (order === "entrada_desc")
    return q.order("data_inicio", { ascending: false, nullsFirst: false });
  if (order === "cadastro_asc") return q.order("created_at", { ascending: true });
  return q.order("created_at", { ascending: false });
}

export const listProcessos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.string().trim().min(1).max(80).optional(),
        materia: z.string().optional(),
        cliente_id: z.string().uuid().optional(),
        q: z.string().optional(),
        tipo_acao: z.string().optional(),
        autor: z.string().optional(),
        reu: z.string().optional(),
        numero_cnj: z.string().optional(),
        area: z.string().optional(),
        advogado: z.string().optional(),
        indicacao_id: z.string().uuid().optional(),
        data_inicio_de: z.string().date().optional(),
        data_inicio_ate: z.string().date().optional(),
        prazo_em_aberto: z.boolean().optional(),
        order: ProcessoOrder.default("cadastro_desc"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = applyProcessoOrder(
      context.supabase
        .from("processos" as never)
        .select(
          "*, clientes:clientes!processos_cliente_id_fkey(id, nome, tipo), indicacoes:indicacoes!processos_indicacao_id_fkey(id, nome)",
        ),
      data.order,
    );
    if (data.status) q = q.eq("status", data.status);
    if (data.materia) q = q.eq("materia", data.materia);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    if (data.tipo_acao) q = q.eq("tipo_acao", data.tipo_acao);
    if (data.advogado) q = q.ilike("advogado", `%${data.advogado}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const baseProcessos = ((rows ?? []) as ProcessoRow[]).map(normalizeProcessoArea);
    const ids = baseProcessos.map((processo) => processo.id);
    const { data: eventosAbertos, error: eventosError } = ids.length
      ? await context.supabase
          .from("prazos" as never)
          .select("processo_id")
          .in("processo_id", ids)
          .eq("status", "aberto")
      : { data: [], error: null };
    if (eventosError) throw new Error(eventosError.message);
    const processosComEventoAberto = new Set(
      ((eventosAbertos ?? []) as Array<{ processo_id: string | null }>)
        .map((evento) => evento.processo_id)
        .filter((id): id is string => !!id),
    );
    const processos = baseProcessos
      .map((processo) => ({
        ...processo,
        // Agenda, Audiências e Perícias usam a mesma tabela de eventos. A
        // coluna é sempre calculada, sem depender de uma marcação antiga.
        prazo_em_aberto: !!processo.data_prazo || processosComEventoAberto.has(processo.id),
      }))
      .filter((processo) => {
        if (data.prazo_em_aberto !== undefined && processo.prazo_em_aberto !== data.prazo_em_aberto)
          return false;
        return !data.q || matchesProcessoSearch(processo, data.q);
      });
    return processos;
  });

export type ProcessoReferenceOptions = {
  tipo_acao: string[];
  materia: string[];
  fase: string[];
  advogado: string[];
  tipo: string[];
};

export const listProcessoReferenceOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("processos" as never)
      .select("tipo_acao, materia, fase, advogado, tipo");
    if (error) throw new Error(error.message);

    const values = {
      tipo_acao: new Set<string>(),
      materia: new Set<string>(),
      fase: new Set<string>(),
      advogado: new Set<string>(),
      tipo: new Set<string>(),
    };
    for (const row of (rows ?? []) as Array<
      Record<keyof ProcessoReferenceOptions, string | null>
    >) {
      for (const key of Object.keys(values) as Array<keyof ProcessoReferenceOptions>) {
        const value = row[key]?.trim();
        if (value) values[key].add(value);
      }
    }
    const sorted = (set: Set<string>) =>
      [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    return {
      tipo_acao: sorted(values.tipo_acao),
      materia: sorted(values.materia),
      fase: sorted(values.fase),
      advogado: sorted(values.advogado),
      tipo: sorted(values.tipo),
    } satisfies ProcessoReferenceOptions;
  });

export type ProcessoResumoRow = ProcessoRow & {
  andamentos_count: number;
  receita: number;
  despesa: number;
};

export const listProcessosResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.string().trim().min(1).max(80).optional(),
        q: z.string().optional(),
        tipo_acao: z.string().optional(),
        autor: z.string().optional(),
        reu: z.string().optional(),
        numero_cnj: z.string().optional(),
        area: z.string().optional(),
        advogado: z.string().optional(),
        indicacao_id: z.string().uuid().optional(),
        data_inicio_de: z.string().date().optional(),
        data_inicio_ate: z.string().date().optional(),
        prazo_em_aberto: z.boolean().optional(),
        order: ProcessoOrder.default("cadastro_desc"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = applyProcessoOrder(
      context.supabase
        .from("processos" as never)
        .select(
          "*, clientes:clientes!processos_cliente_id_fkey(id, nome, tipo), indicacoes:indicacoes!processos_indicacao_id_fkey(id, nome)",
        ),
      data.order,
    );
    if (data.status) q = q.eq("status", data.status);
    if (data.tipo_acao) q = q.eq("tipo_acao", data.tipo_acao);
    if (data.indicacao_id) q = q.eq("indicacao_id", data.indicacao_id);
    if (data.advogado) q = q.ilike("advogado", `%${data.advogado}%`);
    if (data.data_inicio_de) q = q.gte("data_inicio", data.data_inicio_de);
    if (data.data_inicio_ate) q = q.lte("data_inicio", data.data_inicio_ate);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const baseProcessos = ((rows ?? []) as ProcessoRow[]).map(normalizeProcessoArea);
    const idsComPrazo = baseProcessos.map((processo) => processo.id);
    const { data: prazosAbertos, error: prazoError } = idsComPrazo.length
      ? await context.supabase
          .from("prazos" as never)
          .select("processo_id")
          .in("processo_id", idsComPrazo)
          .eq("status", "aberto")
      : { data: [], error: null };
    if (prazoError) throw new Error(prazoError.message);
    const processosComEventoAberto = new Set(
      ((prazosAbertos ?? []) as Array<{ processo_id: string | null }>)
        .map((prazo) => prazo.processo_id)
        .filter((id): id is string => !!id),
    );
    const allProcessos = baseProcessos.map((processo) => ({
      ...processo,
      // A coluna deixa de depender da marcação manual: uma data de prazo no
      // próprio processo ou qualquer evento aberto vinculado já exige atenção.
      prazo_em_aberto: !!processo.data_prazo || processosComEventoAberto.has(processo.id),
    }));
    const includesText = (value: string | null | undefined, filter: string | undefined) =>
      !filter || normalizeSearch(value ?? "").includes(normalizeSearch(filter));
    const processos = allProcessos.filter((p) => {
      if (data.q && !matchesProcessoSearch(p, data.q)) return false;
      if (!includesText([p.autor, p.clientes?.nome].filter(Boolean).join(" "), data.autor))
        return false;
      if (!includesText(p.reu, data.reu)) return false;
      if (data.numero_cnj) {
        const wanted = data.numero_cnj.replace(/\D/g, "");
        if (!(p.numero_cnj ?? "").replace(/\D/g, "").includes(wanted)) return false;
      }
      if (!includesText(p.area ?? p.materia, data.area)) return false;
      if (data.prazo_em_aberto !== undefined && p.prazo_em_aberto !== data.prazo_em_aberto)
        return false;
      return true;
    });
    if (processos.length === 0) return [] as ProcessoResumoRow[];

    const ids = processos.map((p) => p.id);
    const [andRes, lancRes] = await Promise.all([
      context.supabase
        .from("andamentos" as never)
        .select("processo_id")
        .in("processo_id", ids),
      context.supabase
        .from("lancamentos" as never)
        .select("processo_id, tipo, valor")
        .in("processo_id", ids),
    ]);
    if (andRes.error) throw new Error(andRes.error.message);
    if (lancRes.error) throw new Error(lancRes.error.message);

    const andMap = new Map<string, number>();
    for (const a of (andRes.data ?? []) as Array<{ processo_id: string }>) {
      andMap.set(a.processo_id, (andMap.get(a.processo_id) ?? 0) + 1);
    }
    const recMap = new Map<string, number>();
    const despMap = new Map<string, number>();
    for (const l of (lancRes.data ?? []) as Array<{
      processo_id: string;
      tipo: string;
      valor: number | string;
    }>) {
      const v = Number(l.valor) || 0;
      if (l.tipo === "entrada") recMap.set(l.processo_id, (recMap.get(l.processo_id) ?? 0) + v);
      else despMap.set(l.processo_id, (despMap.get(l.processo_id) ?? 0) + v);
    }

    return processos.map((p) => ({
      ...p,
      andamentos_count: andMap.get(p.id) ?? 0,
      receita: recMap.get(p.id) ?? 0,
      despesa: despMap.get(p.id) ?? 0,
    })) as ProcessoResumoRow[];
  });

export const listProcessoFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("processos" as never).select("tipo_acao");
    if (error) throw new Error(error.message);
    return Array.from(
      new Set(
        ((data ?? []) as Array<{ tipo_acao: string | null }>)
          .map((row) => row.tipo_acao?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  });

export const getProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("processos" as never)
      .select(
        "*, clientes:clientes!processos_cliente_id_fkey(id, nome, telefone, email), indicacoes:indicacoes!processos_indicacao_id_fkey(id, nome)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row
      ? (normalizeProcessoArea(row as ProcessoRow) as
          | (ProcessoRow & {
              clientes: {
                id: string;
                nome: string;
                telefone: string | null;
                email: string | null;
              } | null;
            })
          | null)
      : null;
  });

export const setProcessoIndicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        processo_id: z.string().uuid(),
        indicacao_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.indicacao_id) {
      const { data: indicador, error: indicadorError } = await context.supabase
        .from("indicacoes" as never)
        .select("id")
        .eq("id", data.indicacao_id)
        .eq("ativo", true)
        .maybeSingle();
      if (indicadorError) throw new Error(indicadorError.message);
      if (!indicador) throw new Error("Selecione um indicador ativo cadastrado em Cadastros.");
    }
    const { error } = await context.supabase
      .from("processos" as never)
      .update({ indicacao_id: data.indicacao_id } as never)
      .eq("id", data.processo_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => ProcessoInput.parse(d))
  .handler(async ({ data, context }) => {
    // O cadastro é a fonte única das opções. Ao salvar, valores legados
    // (por exemplo, "CÍVEL" e "Cível") são gravados com a grafia definida em Cadastros.
    const { data: catalogRows, error: catalogError } = await context.supabase
      .from("catalogo_opcoes" as never)
      .select("categoria, valor")
      .eq("ativo", true);
    if (catalogError) throw new Error(catalogError.message);
    const catalogo = new Map<string, string>();
    for (const option of (catalogRows ?? []) as Array<{ categoria: string; valor: string }>) {
      catalogo.set(`${option.categoria}:${normalizeCatalogValue(option.valor)}`, option.valor);
    }
    const catalogoLabel: Record<string, string> = {
      tipo_acao: "tipo de ação",
      materia: "matéria",
      fase: "fase",
      advogado: "advogado",
      origem: "origem",
    };
    const canonical = (categoria: keyof typeof catalogoLabel, value: string | null | undefined) => {
      const valor = value?.trim();
      if (!valor) return value;
      const opcao = catalogo.get(`${categoria}:${normalizeCatalogValue(valor)}`);
      if (!opcao) {
        throw new Error(
          `Selecione um(a) ${catalogoLabel[categoria]} ativo(a) em Cadastros antes de salvar o processo.`,
        );
      }
      return opcao;
    };
    const canonicalAdvogados = (value: string | null | undefined) => {
      const valores = (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (valores.length === 0) return null;
      const normalizados = valores.map((valor) => canonical("advogado", valor));
      return [...new Set(normalizados)].join(", ");
    };
    data = {
      ...data,
      tipo_acao: canonical("tipo_acao", data.tipo_acao),
      materia: canonical("materia", data.materia),
      fase: canonical("fase", data.fase),
      advogado: canonicalAdvogados(data.advogado),
      origem: canonical("origem", data.origem),
    };
    if (data.numero_cnj?.trim()) {
      const normalized = data.numero_cnj.replace(/\D/g, "");
      // Textos legados como "Análise de contrato" também foram gravados
      // neste campo. Eles não podem ser comparados como se fossem um CNJ,
      // pois ambos virariam uma string vazia e causariam falsa duplicidade.
      if (normalized) {
        const { data: existentes, error: duplicateError } = await context.supabase
          .from("processos" as never)
          .select("id, numero_cnj")
          .not("numero_cnj", "is", null);
        if (duplicateError) throw new Error(duplicateError.message);
        const duplicate = (
          (existentes ?? []) as Array<{ id: string; numero_cnj: string | null }>
        ).find(
          (row) => row.id !== data.id && (row.numero_cnj ?? "").replace(/\D/g, "") === normalized,
        );
        if (duplicate) {
          throw new Error(`Já existe um processo cadastrado com o número ${data.numero_cnj}.`);
        }
      }
    }
    let clienteId = data.cliente_id ?? null;
    if (!clienteId) {
      for (const nome of [data.autor, data.reu]) {
        const candidato = nome?.trim();
        if (!candidato || candidato === "—") continue;
        const { data: cliente, error: clienteError } = await context.supabase
          .from("clientes" as never)
          .select("id")
          .ilike("nome", candidato)
          .limit(1)
          .maybeSingle();
        if (clienteError) throw new Error(clienteError.message);
        if (cliente) {
          clienteId = (cliente as { id: string }).id;
          break;
        }
      }
    }
    const payload: Record<string, unknown> = {
      ...data,
      autor: data.autores?.[0] ?? data.autor,
      reu: data.reus?.[0] ?? data.reu,
      autores: data.autores ?? [data.autor],
      reus: data.reus ?? [data.reu],
      cliente_id: clienteId,
      representante_id: data.representante_id || null,
      data_protocolo: data.data_protocolo || null,
      data_encerramento: data.data_encerramento || null,
      data_inicio: data.data_inicio || (data.id ? null : new Date().toISOString().slice(0, 10)),
      data_prazo: data.data_prazo || null,
      prazo_em_aberto: !!data.data_prazo,
      criado_por: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("processos" as never)
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("processos" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("processos" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Andamentos
const AndamentoInput = z.object({
  id: z.string().uuid().optional(),
  processo_id: z.string().uuid(),
  data: z.string(),
  titulo: z.string().min(1),
  descricao: z.string().nullable().optional(),
});

export type AndamentoRow = {
  id: string;
  processo_id: string;
  data: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
};

export const listAndamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ processo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("andamentos" as never)
      .select("*")
      .eq("processo_id", data.processo_id)
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AndamentoRow[];
  });

export const addAndamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => AndamentoInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, criado_por: context.userId } as unknown as never;
    const { error } = await context.supabase.from("andamentos" as never).insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAndamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("andamentos" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
