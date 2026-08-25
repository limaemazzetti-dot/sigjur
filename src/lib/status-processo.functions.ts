import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

export type StatusProcessoOpcao = { id: string; codigo: string; nome: string; ativo: boolean };

function codigoStatus(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export const listStatusProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ incluir_inativos: z.boolean().default(false) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("status_processo_opcoes" as never)
      .select("*")
      .order("nome");
    if (!data.incluir_inativos) query = query.eq("ativo", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as StatusProcessoOpcao[];
  });

export const addStatusProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ nome: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const codigo = codigoStatus(data.nome);
    if (!codigo) throw new Error("Informe um nome de status válido.");
    const { data: row, error } = await context.supabase
      .from("status_processo_opcoes" as never)
      .insert({ codigo, nome: data.nome, ativo: true } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

export const updateStatusProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(1).max(120),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("status_processo_opcoes" as never)
      .update({ nome: data.nome, ativo: data.ativo } as never)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row)
      throw new Error("O status não foi alterado. Atualize a página e confirme seu acesso.");
    return row as { id: string };
  });

export const deleteStatusProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: status, error: statusError } = await context.supabase
      .from("status_processo_opcoes" as never)
      .select("codigo")
      .eq("id", data.id)
      .maybeSingle();
    if (statusError) throw new Error(statusError.message);
    if (!status) throw new Error("Status não encontrado.");
    const { count, error: countError } = await context.supabase
      .from("processos" as never)
      .select("id", { count: "exact", head: true })
      .eq("status", (status as { codigo: string }).codigo);
    if (countError) throw new Error(countError.message);
    if (count)
      throw new Error(
        "Este status já está em uso. Desative-o ou altere os processos antes de excluir.",
      );
    const { error } = await context.supabase
      .from("status_processo_opcoes" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
