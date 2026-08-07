import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccessLevel } from "@/integrations/supabase/auth-middleware";
import { ALL_PAGES } from "@/lib/permissions";

const AccessLevelSchema = z.enum(["admin", "editor", "viewer"]);

function databaseRole(accessLevel: AccessLevel): "admin" | "advogado" | "secretaria" {
  if (accessLevel === "admin") return "admin";
  if (accessLevel === "viewer") return "secretaria";
  return "advogado";
}

function accessLevelFromRoles(roles: string[]): AccessLevel {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("secretaria")) return "viewer";
  return "editor";
}

async function ensureDefaultPages(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_page_permissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;
  const { error: insertError } = await supabaseAdmin
    .from("user_page_permissions")
    .insert(ALL_PAGES.map((page) => ({ user_id: userId, page: page.path })));
  if (insertError) throw new Error(insertError.message);
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, nome, email, genero")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roleList = (roles ?? []).map((r) => r.role as string);
    const { data: perms } = await context.supabase
      .from("user_page_permissions")
      .select("page")
      .eq("user_id", context.userId);
    return {
      id: context.userId,
      nome: profile?.nome ?? (context.claims.email as string | undefined) ?? "Usuário",
      email: profile?.email ?? (context.claims.email as string | undefined) ?? "",
      genero: (profile?.genero as "M" | "F" | null) ?? null,
      roles: roleList,
      isAdmin: roleList.includes("admin"),
      accessLevel: context.accessLevel,
      canEdit: context.accessLevel === "admin" || context.accessLevel === "editor",
      allowedPages: (perms ?? []).map((p) => p.page as string),
    };
  });

export const getUserPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_page_permissions")
      .select("page")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.page as string);
  });

export const setUserPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), pages: z.array(z.string()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_page_permissions").delete().eq("user_id", data.user_id);
    if (data.pages.length > 0) {
      const rows = data.pages.map((page) => ({ user_id: data.user_id, page }));
      const { error } = await supabaseAdmin.from("user_page_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, genero, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      byUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => {
      const userRoles = byUser.get(p.id) ?? [];
      return {
        ...p,
        roles: userRoles,
        access_level: accessLevelFromRoles(userRoles),
      };
    });
  });

const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  access_level: AccessLevelSchema.default("editor"),
  genero: z.enum(["M", "F"]).optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLocaleLowerCase("pt-BR"),
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.email.trim().toLocaleLowerCase("pt-BR") },
      app_metadata: { access_level: data.access_level },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // O trigger cria um papel padrão; substituímos pelo nível concedido pelo administrador.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: databaseRole(data.access_level) });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(roleError.message);
    }
    if (data.genero) {
      await supabaseAdmin.from("profiles").update({ genero: data.genero }).eq("id", uid);
    }
    if (data.access_level !== "admin") await ensureDefaultPages(uid);
    return { id: uid };
  });

export const updateUserGenero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), genero: z.enum(["M", "F"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertAdmin(context.userId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ genero: data.genero })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateRoleInput = z.object({
  user_id: z.string().uuid(),
  access_level: AccessLevelSchema,
});

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && data.access_level !== "admin") {
      throw new Error("Você não pode retirar o próprio acesso de Administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: authReadError } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id,
    );
    if (authReadError) throw new Error(authReadError.message);
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      app_metadata: {
        ...(authUser.user?.app_metadata ?? {}),
        access_level: data.access_level,
      },
    });
    if (metadataError) throw new Error(metadataError.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: databaseRole(data.access_level) });
    if (error) throw new Error(error.message);
    if (data.access_level !== "admin") await ensureDefaultPages(data.user_id);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
