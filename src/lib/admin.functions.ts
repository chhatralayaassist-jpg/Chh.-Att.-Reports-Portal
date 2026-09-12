import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DANGER_PASSWORD = "24042010";
export type AppRoleName = "admin" | "attendance_taker" | "rector" | "group_leader";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const isAdmin = (data ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

function toEmail(username: string) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u.replace(/[^a-z0-9._-]/g, "")}@chhatralaya.local`;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      username: (u.email ?? "").split("@")[0],
      full_name:
        (profiles ?? []).find((p) => p.id === u.id)?.full_name ??
        ((u.user_metadata as any)?.['full_name'] as string | undefined) ??
        "",
      created_at: u.created_at,
      roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as AppRoleName),
    }));
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { full_name: string; email: string; password: string; roles: AppRoleName[] }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.full_name.trim()) throw new Error("Name is required");
    if (!validEmail(data.email)) throw new Error("Enter a valid email address");
    if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name.trim() },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert(
      {
        id: uid,
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
      },
      { onConflict: "id" },
    );
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    if (data.roles.length) {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: uid, role })));
      if (rErr) throw new Error(rErr.message);
    }
    return { ok: true as const };
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      full_name?: string;
      email?: string;
      password?: string;
      roles?: AppRoleName[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attrs: Record<string, unknown> = {};
    if (data.email?.trim()) {
      if (!validEmail(data.email)) throw new Error("Enter a valid email address");
      attrs['email'] = data.email.trim().toLowerCase();
    }
    if (data.password) {
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
      attrs['password'] = data.password;
    }
    if (data.full_name?.trim()) attrs['user_metadata'] = { full_name: data.full_name.trim() };
    if (Object.keys(attrs).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, attrs as any);
      if (error) throw new Error(error.message);
      const patch: Record<string, string> = {};
      if (attrs['email']) patch['email'] = attrs['email'] as string;
      if (data.full_name?.trim()) patch['full_name'] = data.full_name.trim();
      if (Object.keys(patch).length) {
        await supabaseAdmin.from("profiles").update(patch as any).eq("id", data.id);
      }
    }
    if (data.roles) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      if (data.roles.length) {
        const { error: rErr } = await supabaseAdmin
          .from("user_roles")
          .insert(data.roles.map((role) => ({ user_id: data.id, role })));
        if (rErr) throw new Error(rErr.message);
      }
    }
    return { ok: true as const };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Every table included in a full app backup, in dependency-safe import order. */
const BACKUP_TABLES = [
  { name: "profiles", conflict: "id" },
  { name: "user_roles", conflict: "id" },
  { name: "students", conflict: "id" },
  { name: "permitters", conflict: "id" },
  { name: "app_settings", conflict: "key" },
  { name: "attendance", conflict: "id" },
  { name: "suggestions", conflict: "id" },
  { name: "attendance_slips", conflict: "id" },
  { name: "leave_slips", conflict: "id" },
] as const;

/** Delete order = reverse of import order so foreign keys stay valid. */
const DELETE_TABLES = [
  { name: "sheets_sync_log", key: "id" },
  { name: "leave_slips", key: "id" },
  { name: "attendance_slips", key: "id" },
  { name: "suggestions", key: "id" },
  { name: "attendance", key: "id" },
  { name: "students", key: "id" },
  { name: "permitters", key: "id" },
  { name: "app_settings", key: "key" },
] as const;

export const exportAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password !== DANGER_PASSWORD) throw new Error("Incorrect password");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = await Promise.all(
      BACKUP_TABLES.map(async (t) => {
        const { data: rows, error } = await supabaseAdmin.from(t.name as any).select("*");
        if (error) throw new Error(`${t.name}: ${error.message}`);
        return [t.name, rows ?? []] as const;
      }),
    );
    const tables = Object.fromEntries(results) as Record<string, any[]>;
    return {
      exported_at: new Date().toISOString(),
      version: 2,
      counts: Object.fromEntries(results.map(([n, r]) => [n, r.length])),
      ...tables,
    };
  });

export const importAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string; payload: any }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password !== DANGER_PASSWORD) throw new Error("Incorrect password");
    const payload = data.payload ?? {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const imported: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      const rows = payload[t.name];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const { error } = await supabaseAdmin
        .from(t.name as any)
        .upsert(rows as any, { onConflict: t.conflict });
      if (error) throw new Error(`${t.name}: ${error.message}`);
      imported[t.name] = rows.length;
    }
    return { imported, total: Object.values(imported).reduce((a, b) => a + b, 0) };
  });

export const deleteAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password !== DANGER_PASSWORD) throw new Error("Incorrect password");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const never = "00000000-0000-0000-0000-000000000000";
    const deleted: string[] = [];
    for (const t of DELETE_TABLES) {
      const q = supabaseAdmin.from(t.name as any).delete();
      const { error } = await (t.key === "key" ? q.neq("key", "__never__") : q.neq("id", never));
      if (error) throw new Error(`${t.name}: ${error.message}`);
      deleted.push(t.name);
    }
    return { ok: true as const, deleted };
  });

