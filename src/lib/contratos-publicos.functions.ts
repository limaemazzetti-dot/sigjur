import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i, "Link inválido");
const dadosSchema = z.object({
  nome: z.string().trim().min(3).max(200),
  cpf_cnpj: z.string().trim().min(11).max(30),
  rg: z.string().trim().max(50).optional(),
  nacionalidade: z.string().trim().max(80).optional(),
  profissao: z.string().trim().max(120).optional(),
  data_aniversario: z.string().max(10).optional(),
  endereco: z.string().trim().min(5).max(300),
  cidade: z.string().trim().min(2).max(120),
  estado: z.string().trim().min(2).max(2),
  cep: z.string().trim().min(8).max(12),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().email().max(200).optional(),
  representante_nome: z.string().trim().max(200).optional(),
  representante_cpf: z.string().trim().max(30).optional(),
  representante_rg: z.string().trim().max(50).optional(),
  representante_nacionalidade: z.string().trim().max(80).optional(),
  representante_profissao: z.string().trim().max(120).optional(),
  representante_data_nascimento: z.string().max(10).optional(),
  representante_parentesco: z.string().trim().max(100).optional(),
});

export const criarLinkPublicoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z.object({ nome: z.string().trim().max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc(
        "criar_link_publico_contrato" as never,
        { p_nome: data.nome ?? "Kit BPC/LOAS com Representante" } as never,
      )
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; token: string; expira_em: string };
  });

export const consultarLinkPublicoContrato = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("consultar_link_publico_contrato" as never, { p_token: data.token } as never)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as { nome: string; expira_em: string } | null;
  });

export const enviarFormularioPublicoContrato = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema, dados: dadosSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "enviar_formulario_publico_contrato" as never,
      { p_token: data.token, p_dados: data.dados } as never,
    );
    if (error) throw new Error(error.message);
    return { id: String(id) };
  });
