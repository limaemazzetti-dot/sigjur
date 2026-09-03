import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";
import { renderBpcLoasKitText } from "@/lib/bpc-loas-kit";
import { encryptSensitiveValue } from "@/lib/field-encryption.server";

const FORNECEDOR_MARKER = "[[SIGJUR:FORNECEDOR]]";

// Nunca envie a credencial gov.br para listas, exportações ou consultas usadas
// na geração de documentos. O campo só é aceito para gravação no servidor.
const CLIENTE_SAFE_COLUMNS =
  "id, tipo, fornecedor, nome, cpf_cnpj, rg, email, telefone, profissao, nacionalidade, data_aniversario, sexo, estado_civil, como_conheceu, endereco, bairro, cidade, estado, cep, observacoes, representante_nome, representante_nacionalidade, representante_profissao, representante_data_nascimento, representante_rg, representante_cpf, representante_parentesco, template_ids, created_at, updated_at";

const CLIENTE_LEGACY_SAFE_COLUMNS = CLIENTE_SAFE_COLUMNS.replace("fornecedor, ", "");

function decodeClienteRow(row: Record<string, unknown>): ClienteRow {
  const rawObservacoes = typeof row.observacoes === "string" ? row.observacoes : "";
  return {
    ...row,
    fornecedor: row.fornecedor === true || rawObservacoes.includes(FORNECEDOR_MARKER),
    observacoes: rawObservacoes.replace(FORNECEDOR_MARKER, "").trim() || null,
  } as ClienteRow;
}

function cleanObservacoes(observacoes: string | null | undefined) {
  return (observacoes ?? "").replace(FORNECEDOR_MARKER, "").trim() || null;
}

function legacyObservacoes(observacoes: string | null | undefined, fornecedor: boolean) {
  return [cleanObservacoes(observacoes), fornecedor ? FORNECEDOR_MARKER : null]
    .filter(Boolean)
    .join("\n");
}

function missingFornecedorColumn(message: string) {
  return /fornecedor.*(does not exist|schema cache)|column.*fornecedor/i.test(message);
}

const ClienteInput = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(["pf", "pj"]).default("pf"),
  fornecedor: z.boolean().default(false),
  nome: z.string().min(1).max(200),
  cpf_cnpj: z.string().nullable().optional(),
  rg: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  telefone: z.string().nullable().optional(),
  profissao: z.string().nullable().optional(),
  nacionalidade: z.string().nullable().optional(),
  data_aniversario: z.string().nullable().optional(),
  sexo: z.string().nullable().optional(),
  estado_civil: z.string().nullable().optional(),
  como_conheceu: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  senha_gov_br: z.string().max(200).nullable().optional(),
  remover_senha_gov_br: z.boolean().optional(),
  representante_nome: z.string().nullable().optional(),
  representante_nacionalidade: z.string().nullable().optional(),
  representante_profissao: z.string().nullable().optional(),
  representante_data_nascimento: z.string().nullable().optional(),
  representante_rg: z.string().nullable().optional(),
  representante_cpf: z.string().nullable().optional(),
  representante_parentesco: z.string().nullable().optional(),
  template_ids: z.array(z.string().uuid()).optional(),
});

export type ClienteFormInput = z.infer<typeof ClienteInput>;

export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("clientes" as never)
      .select(CLIENTE_SAFE_COLUMNS)
      .order("nome");
    if (data.q) q = q.ilike("nome", `%${data.q}%`);
    let { data: rows, error } = await q;
    // Bancos antigos ainda podem não ter a flag de fornecedor. Nesse caso,
    // preservamos o carregamento dos clientes e reconhecemos o fornecedor
    // pelo marcador legado em observações.
    if (error && missingFornecedorColumn(error.message)) {
      let legacyQuery = context.supabase
        .from("clientes" as never)
        .select(CLIENTE_LEGACY_SAFE_COLUMNS)
        .order("nome");
      if (data.q) legacyQuery = legacyQuery.ilike("nome", `%${data.q}%`);
      const legacy = await legacyQuery;
      rows = legacy.data;
      error = legacy.error;
    }
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<Record<string, unknown>>).map(decodeClienteRow);
  });

export const listFornecedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const preferred = await context.supabase
      .from("clientes" as never)
      .select(
        "id, nome, cpf_cnpj, telefone, email, tipo, endereco, bairro, cidade, estado, cep, observacoes, fornecedor",
      )
      .eq("fornecedor", true)
      .order("nome");
    let data = preferred.data;
    if (preferred.error) {
      if (!missingFornecedorColumn(preferred.error.message)) {
        throw new Error(preferred.error.message);
      }
      const legacy = await context.supabase
        .from("clientes" as never)
        .select(
          "id, nome, cpf_cnpj, telefone, email, tipo, endereco, bairro, cidade, estado, cep, observacoes",
        )
        .order("nome");
      if (legacy.error) throw new Error(legacy.error.message);
      data = legacy.data;
    }
    return ((data ?? []) as Array<Record<string, unknown>>)
      .map(decodeClienteRow)
      .filter((cliente) => cliente.fornecedor)
      .map(
        ({ id, nome, cpf_cnpj, telefone, email, tipo, endereco, bairro, cidade, estado, cep }) => ({
          id,
          nome,
          cpf_cnpj,
          telefone,
          email,
          tipo,
          endereco,
          bairro,
          cidade,
          estado,
          cep,
        }),
      );
  });

export const upsertCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => ClienteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { senha_gov_br, remover_senha_gov_br, ...persisted } = data;
    const senhaGovBr = senha_gov_br?.trim();
    const senhaPersistida = senhaGovBr ? await encryptSensitiveValue(senhaGovBr) : undefined;
    const preferredPayload: Record<string, unknown> = {
      ...persisted,
      email: data.email === "" ? null : data.email,
      data_aniversario: data.data_aniversario || null,
      representante_data_nascimento: data.representante_data_nascimento || null,
      observacoes: cleanObservacoes(data.observacoes),
    };
    // `criado_por` é permitido apenas no INSERT pela política de colunas do
    // Supabase. Enviá-lo em uma edição faz o PostgREST rejeitar o UPDATE com
    // "permission denied for table clientes".
    if (!data.id) preferredPayload.criado_por = context.userId;
    // Em edição, campo vazio significa "não alterar". Isso impede que uma
    // credencial seja apagada por acidente e evita devolvê-la ao navegador.
    // A coluna sensível é atualizada abaixo somente com o cliente de serviço,
    // após as permissões do usuário terem sido verificadas pelo middleware.
    const shouldUpdateSenha = !data.id || !!senhaPersistida || remover_senha_gov_br === true;
    const legacyPayload: Record<string, unknown> = {
      ...preferredPayload,
      observacoes: legacyObservacoes(data.observacoes, data.fornecedor) || null,
    };
    delete legacyPayload.fornecedor;
    let clienteId: string;
    if (data.id) {
      const preferred = await context.supabase
        .from("clientes" as never)
        .update(preferredPayload as never)
        .eq("id", data.id);
      if (preferred.error) {
        if (!missingFornecedorColumn(preferred.error.message)) {
          throw new Error(preferred.error.message);
        }
        const legacy = await context.supabase
          .from("clientes" as never)
          .update(legacyPayload as never)
          .eq("id", data.id);
        if (legacy.error) throw new Error(legacy.error.message);
      }
      clienteId = data.id;
    } else {
      let insertedResult = await context.supabase
        .from("clientes" as never)
        .insert(preferredPayload as never)
        .select("id")
        .single();
      if (insertedResult.error && missingFornecedorColumn(insertedResult.error.message)) {
        insertedResult = await context.supabase
          .from("clientes" as never)
          .insert(legacyPayload as never)
          .select("id")
          .single();
      }
      if (insertedResult.error) throw new Error(insertedResult.error.message);
      clienteId = (insertedResult.data as { id: string }).id;
    }

    if (shouldUpdateSenha) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: senhaError } = await supabaseAdmin
        .from("clientes" as never)
        .update({ senha_gov_br: remover_senha_gov_br ? null : (senhaPersistida ?? null) } as never)
        .eq("id", clienteId);
      if (senhaError) throw new Error(senhaError.message);
    }

    // Auto-gerar um único documento com base no DOCX original do Kit BPC/LOAS.
    try {
      const { data: cliente } = await context.supabase
        .from("clientes" as never)
        .select(CLIENTE_SAFE_COLUMNS)
        .eq("id", clienteId)
        .maybeSingle();
      if (cliente) {
        await context.supabase
          .from("documentos_gerados" as never)
          .delete()
          .eq("cliente_id", clienteId);
        await context.supabase.from("documentos_gerados" as never).insert({
          cliente_id: clienteId,
          template_id: null,
          nome: "Kit BPC/LOAS com Representante",
          tipo: "kit_bpc_loas",
          conteudo: renderBpcLoasKitText(decodeClienteRow(cliente as Record<string, unknown>)),
        } as never);
      }
    } catch {
      // Falha na geração não bloqueia o salvamento do cliente
    }

    return { id: clienteId };
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { count: processosComoCliente, error: processoError } = await context.supabase
      .from("processos" as never)
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.id);
    if (processoError) throw new Error(processoError.message);

    const { count: processosComoEnvolvido, error: envolvidoError } = await context.supabase
      .from("processos" as never)
      .select("id", { count: "exact", head: true })
      .eq("outro_envolvido_cliente_id", data.id);
    if (envolvidoError) throw new Error(envolvidoError.message);

    const { count: lancamentos, error: lancamentoError } = await context.supabase
      .from("lancamentos" as never)
      .select("id", { count: "exact", head: true })
      .eq("fornecedor_id", data.id);
    if (lancamentoError) throw new Error(lancamentoError.message);

    const processosVinculados = (processosComoCliente ?? 0) + (processosComoEnvolvido ?? 0);
    const lancamentosVinculados = lancamentos ?? 0;
    if (processosVinculados || lancamentosVinculados) {
      const partes = [
        processosVinculados && `${processosVinculados} processo(s)`,
        lancamentosVinculados && `${lancamentosVinculados} lançamento(s) financeiro(s)`,
      ].filter(Boolean);
      throw new Error(
        `Este cadastro possui ${partes.join(" e ")} vinculado(s). Reatribua os registros antes de excluí-lo para preservar o histórico.`,
      );
    }
    const { error } = await context.supabase
      .from("clientes" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clientes" as never)
      .select(CLIENTE_SAFE_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? decodeClienteRow(row as Record<string, unknown>) : null;
  });

// Aniversariantes do dia (baseado em mês+dia atuais, ignora ano)
export const aniversariantesHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clientes" as never)
      .select("id, nome, data_aniversario, telefone, email")
      .not("data_aniversario", "is", null);
    if (error) throw new Error(error.message);
    const today = new Date();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    return (
      (data ?? []) as Array<{
        id: string;
        nome: string;
        data_aniversario: string;
        telefone: string | null;
        email: string | null;
      }>
    ).filter((c) => {
      const dt = new Date(c.data_aniversario + "T00:00:00");
      return dt.getMonth() + 1 === m && dt.getDate() === d;
    });
  });

export type ClienteRow = {
  id: string;
  tipo: "pf" | "pj";
  fornecedor: boolean;
  nome: string;
  cpf_cnpj: string | null;
  rg: string | null;
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  data_aniversario: string | null;
  sexo: string | null;
  estado_civil: string | null;
  como_conheceu: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  senha_gov_br: string | null;
  representante_nome: string | null;
  representante_nacionalidade: string | null;
  representante_profissao: string | null;
  representante_data_nascimento: string | null;
  representante_rg: string | null;
  representante_cpf: string | null;
  representante_parentesco: string | null;
  template_ids: string[] | null;
  created_at: string;
  updated_at: string;
};
