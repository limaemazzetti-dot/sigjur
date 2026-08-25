import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

const TABLES = [
  "clientes",
  "processos",
  "andamentos",
  "prazos",
  "lancamentos",
  "plano_contas",
  "documento_templates",
  "documentos_gerados",
  "profiles",
  "user_roles",
  "sync_mappings",
] as const;

async function dumpAll(supabase: SupabaseClient<Database>): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    out[t] = (data ?? []) as unknown[];
  }
  return out;
}

export const createBackupSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z.object({ tag: z.string().trim().max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const dump = await dumpAll(context.supabase);
    const json = JSON.stringify(dump);
    const { data: row, error } = await context.supabase
      .from("backups_snapshots")
      .insert({
        tag: data.tag ?? `Backup ${new Date().toLocaleString("pt-BR")}`,
        size_bytes: json.length,
        data: dump as unknown as Json,
        created_by: context.userId,
      })
      .select("id, created_at, tag, size_bytes")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listBackupSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backups_snapshots")
      .select("id, created_at, tag, size_bytes")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const downloadBackupSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("backups_snapshots")
      .select("id, created_at, tag, data")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBackupSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("backups_snapshots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportBackupNow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dump = await dumpAll(context.supabase);
    return { data: dump as unknown as Json };
  });
