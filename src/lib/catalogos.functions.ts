import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEditorAccess } from "@/integrations/supabase/access-middleware";

export const CATEGORIAS = ["tipo_acao", "materia", "fase", "advogado"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  tipo_acao: "Tipo de Ação",
  materia: "Matéria",
  fase: "Fase",
  advogado: "Advogado",
};

export type CatalogoOpcao = {
  id: string;
  categoria: Categoria;
  valor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const listCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        categoria: z.enum(CATEGORIAS).optional(),
        incluir_inativos: z.boolean().default(false),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("catalogo_opcoes" as never)
      .select("*")
      .order("categoria")
      .order("valor");
    if (data.categoria) q = q.eq("categoria", data.categoria);
    if (!data.incluir_inativos) q = q.eq("ativo", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CatalogoOpcao[];
  });

export const upsertCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        categoria: z.enum(CATEGORIAS),
        valor: z.string().trim().min(1).max(200),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("catalogo_opcoes" as never)
        .update({ categoria: data.categoria, valor: data.valor, ativo: data.ativo } as never)
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) {
        throw new Error(
          "A opção não foi alterada. Atualize a página e confirme se seu acesso é de Editor ou Administrador.",
        );
      }
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("catalogo_opcoes" as never)
      .insert({ categoria: data.categoria, valor: data.valor, ativo: data.ativo } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("catalogo_opcoes" as never)
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) {
      throw new Error(
        "A opção não foi excluída. Atualize a página e confirme se seu acesso é de Editor ou Administrador.",
      );
    }
    return { ok: true };
  });

export const importCatalogoFromProcessos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .handler(async ({ context }) => {
    const { data: processos, error } = await context.supabase
      .from("processos" as never)
      .select("tipo_acao, materia, fase, advogado");
    if (error) throw new Error(error.message);

    const rows: Array<{ categoria: Categoria; valor: string; ativo: boolean }> = [];
    const seen = new Set<string>();
    for (const processo of (processos ?? []) as Array<Record<Categoria, string | null>>) {
      for (const categoria of CATEGORIAS) {
        const valor = processo[categoria]?.trim();
        if (!valor) continue;
        const key = `${categoria}:${valor.toLocaleLowerCase("pt-BR")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ categoria, valor, ativo: true });
      }
    }

    if (!rows.length) return { imported: 0 };
    const { error: upsertError } = await context.supabase
      .from("catalogo_opcoes" as never)
      .upsert(rows as never, {
        onConflict: "categoria,valor",
        ignoreDuplicates: true,
      });
    if (upsertError) throw new Error(upsertError.message);
    return { imported: rows.length };
  });

// ---------- Vínculos entre clientes ----------

export type ClienteVinculo = {
  id: string;
  cliente_principal_id: string;
  cliente_vinculado_id: string;
  parentesco: string | null;
  cliente_vinculado?: { id: string; nome: string } | null;
  cliente_principal?: { id: string; nome: string } | null;
};

export const listVinculos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_principal_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("cliente_vinculos" as never)
      .select(
        "*, cliente_vinculado:clientes!cliente_vinculos_cliente_vinculado_id_fkey(id, nome), cliente_principal:clientes!cliente_vinculos_cliente_principal_id_fkey(id, nome)",
      );
    if (data.cliente_principal_id) {
      q = q.or(
        `cliente_principal_id.eq.${data.cliente_principal_id},cliente_vinculado_id.eq.${data.cliente_principal_id}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const vinculos = (rows ?? []) as ClienteVinculo[];
    if (!data.cliente_principal_id) return vinculos;
    return vinculos.map((v) => {
      if (v.cliente_principal_id === data.cliente_principal_id) return v;
      return {
        ...v,
        cliente_principal_id: v.cliente_vinculado_id,
        cliente_vinculado_id: v.cliente_principal_id,
        cliente_principal: v.cliente_vinculado,
        cliente_vinculado: v.cliente_principal,
      };
    });
  });

export const addVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_principal_id: z.string().uuid(),
        cliente_vinculado_id: z.string().uuid(),
        parentesco: z.string().trim().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.cliente_principal_id === data.cliente_vinculado_id) {
      throw new Error("Não é possível vincular um cliente a ele mesmo.");
    }
    const { data: existente, error: existingError } = await context.supabase
      .from("cliente_vinculos" as never)
      .select("id")
      .or(
        `and(cliente_principal_id.eq.${data.cliente_principal_id},cliente_vinculado_id.eq.${data.cliente_vinculado_id}),and(cliente_principal_id.eq.${data.cliente_vinculado_id},cliente_vinculado_id.eq.${data.cliente_principal_id})`,
      )
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    if ((existente ?? []).length > 0) {
      throw new Error("Estes clientes já estão vinculados.");
    }
    const { error } = await context.supabase
      .from("cliente_vinculos" as never)
      .insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireEditorAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cliente_vinculos" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
