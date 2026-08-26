import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

const PrazoInput = z.object({
  id: z.string().uuid().optional(),
  processo_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1).max(300),
  descricao: z.string().nullable().optional(),
  data_prazo: z.string().min(1),
  status: z.enum(["aberto", "cumprido", "cancelado"]).default("aberto"),
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
  data_conclusao: z.string().nullable().optional(),
  tipo_evento: z.enum(["prazo", "audiencia", "pericia"]).default("prazo"),
});

export type PrazoFormInput = z.infer<typeof PrazoInput>;

export type PrazoRow = {
  id: string;
  processo_id: string | null;
  titulo: string;
  descricao: string | null;
  data_prazo: string;
  status: "aberto" | "cumprido" | "cancelado";
  prioridade: "baixa" | "media" | "alta";
  data_conclusao: string | null;
  tipo_evento: "prazo" | "audiencia" | "pericia";
  created_at: string;
  updated_at: string;
  processos?: {
    id: string;
    autor: string;
    reu: string;
    numero_cnj: string | null;
    clientes?: { nome: string } | null;
  } | null;
};

export const listPrazos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["aberto", "cumprido", "cancelado"]).nullable().optional(),
        q: z.string().nullable().optional(),
        tipo_evento: z.enum(["prazo", "audiencia", "pericia"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("prazos" as never)
      .select(
        "*, processos(id, autor, reu, numero_cnj, clientes:clientes!processos_cliente_id_fkey(nome))",
      )
      .order("data_prazo", { ascending: true });
    if (data.status) q = q.eq("status", data.status);
    if (data.tipo_evento) q = q.eq("tipo_evento", data.tipo_evento);
    if (data.q) q = q.ilike("titulo", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PrazoRow[];
  });

export const upsertPrazo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => PrazoInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = {
      ...data,
      processo_id: data.processo_id || null,
      data_conclusao: data.data_conclusao || null,
      criado_por: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("prazos" as never)
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("prazos" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const setPrazoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aberto", "cumprido", "cancelado"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "cumprido") patch.data_conclusao = new Date().toISOString().slice(0, 10);
    if (data.status === "aberto") patch.data_conclusao = null;
    const { error } = await context.supabase
      .from("prazos" as never)
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePrazo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prazos" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
