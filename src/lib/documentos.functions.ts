import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";
import { renderBpcLoasKitText } from "@/lib/bpc-loas-kit";

export type TemplateRow = {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentoRow = {
  id: string;
  cliente_id: string;
  template_id: string | null;
  nome: string;
  tipo: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
};

type ClienteRow = {
  id: string;
  tipo: "pf" | "pj";
  nome: string;
  cpf_cnpj: string | null;
  rg: string | null;
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  data_aniversario: string | null;
  representante_nome: string | null;
  representante_nacionalidade: string | null;
  representante_profissao: string | null;
  representante_data_nascimento: string | null;
  representante_rg: string | null;
  representante_cpf: string | null;
  representante_parentesco: string | null;
};

function renderTemplate(conteudo: string, c: ClienteRow): string {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const fmtData = (v: string | null) =>
    v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR") : "___________";
  const vars: Record<string, string> = {
    nome: c.nome ?? "",
    tipo_pessoa: c.tipo === "pf" ? "pessoa física" : "pessoa jurídica",
    cpf_cnpj: c.cpf_cnpj ?? "___________",
    rg: c.rg ?? "___________",
    email: c.email ?? "___________",
    telefone: c.telefone ?? "___________",
    profissao: c.profissao ?? "___________",
    nacionalidade: c.nacionalidade ?? "brasileira",
    endereco: c.endereco ?? "___________",
    cidade: c.cidade ?? "___________",
    estado: c.estado ?? "__",
    cep: c.cep ?? "___________",
    data_aniversario: fmtData(c.data_aniversario),
    data_hoje: hoje,
    representante_nome: c.representante_nome ?? "___________",
    representante_nacionalidade: c.representante_nacionalidade ?? "brasileira",
    representante_profissao: c.representante_profissao ?? "___________",
    representante_data_nascimento: fmtData(c.representante_data_nascimento),
    representante_rg: c.representante_rg ?? "___________",
    representante_cpf: c.representante_cpf ?? "___________",
    representante_parentesco: c.representante_parentesco ?? "representante legal",
  };
  return conteudo.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
}

// ---------- Templates ----------

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documento_templates" as never)
      .select("*")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as TemplateRow[];
  });

const TemplateInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(200),
  tipo: z.string().min(1).max(50).default("contrato"),
  conteudo: z.string().default(""),
  ativo: z.boolean().default(true),
});

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => TemplateInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, criado_por: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("documento_templates" as never)
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("documento_templates" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("documento_templates" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Documentos gerados ----------

export const listDocumentosCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("documentos_gerados" as never)
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as DocumentoRow[];
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("documentos_gerados" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Gera (ou regenera) todos os documentos ativos para o cliente informado.
 * Se `replace` = true, apaga os documentos anteriores do cliente antes.
 */
export const gerarDocumentosCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid(), replace: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: cliente, error: cErr } = await context.supabase
      .from("clientes" as never)
      .select(
        "id, tipo, nome, cpf_cnpj, rg, email, telefone, profissao, nacionalidade, endereco, cidade, estado, cep, data_aniversario, representante_nome, representante_nacionalidade, representante_profissao, representante_data_nascimento, representante_rg, representante_cpf, representante_parentesco",
      )
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cliente) throw new Error("Cliente não encontrado");

    if (data.replace) {
      await context.supabase
        .from("documentos_gerados" as never)
        .delete()
        .eq("cliente_id", data.cliente_id);
    }

    const c = cliente as ClienteRow;
    const row = {
      cliente_id: data.cliente_id,
      template_id: null,
      nome: "Kit BPC/LOAS com Representante",
      tipo: "kit_bpc_loas",
      conteudo: renderBpcLoasKitText(c),
    };
    const { error: iErr } = await context.supabase
      .from("documentos_gerados" as never)
      .insert(row as never);
    if (iErr) throw new Error(iErr.message);
    return { gerados: 1 };
  });
