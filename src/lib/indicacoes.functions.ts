import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

const IndicacaoInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(200),
  cpf_cnpj: z.string().trim().max(30).nullable().optional(),
  telefone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
  endereco: z.string().trim().max(300).nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
  ativo: z.boolean().default(true),
});

export type IndicacaoInput = z.infer<typeof IndicacaoInput>;

export type IndicacaoRow = IndicacaoInput & {
  id: string;
  created_at: string;
  updated_at: string;
};

export const listIndicacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ incluir_inativos: z.boolean().default(false) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("indicacoes" as never)
      .select("*")
      .order("nome");
    if (!data.incluir_inativos) query = query.eq("ativo", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as IndicacaoRow[];
  });

export const upsertIndicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => IndicacaoInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      email: data.email || null,
      cpf_cnpj: data.cpf_cnpj || null,
      telefone: data.telefone || null,
      endereco: data.endereco || null,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("indicacoes" as never)
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("indicacoes" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteIndicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { count, error: countError } = await context.supabase
      .from("processos" as never)
      .select("id", { count: "exact", head: true })
      .eq("indicacao_id", data.id);
    if (countError) throw new Error(countError.message);
    if (count) {
      throw new Error(
        "Esta indicação está vinculada a processos. Desative-a ou altere os processos antes de excluir.",
      );
    }
    const { error } = await context.supabase
      .from("indicacoes" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
