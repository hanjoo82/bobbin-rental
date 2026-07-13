import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data?.users?.find((u: { email?: string | null }) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owners")
      .select("id, name, email, contact, password_set, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** 소유주별 현재 보유 자산(제품) 수 */
export const countOwnerProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { count, error } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", data.owner_id);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const createOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(200),
      contact: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("owners")
      .insert({
        name: data.name,
        email: data.email.toLowerCase(),
        contact: data.contact ?? null,
        password_set: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200),
      email: z.string().email().max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: gErr } = await supabaseAdmin
      .from("owners").select("email, password_set").eq("id", data.id).maybeSingle();
    if (gErr) throw new Error(gErr.message);
    const newEmail = data.email.toLowerCase();
    const emailChanged = existing && existing.email?.toLowerCase() !== newEmail;
    const patch: any = { name: data.name, email: newEmail };
    if (emailChanged) patch.password_set = false;
    const { error } = await supabaseAdmin.from("owners").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    // Unlink old auth account so the new email can re-bootstrap on first login.
    if (emailChanged) {
      await supabaseAdmin.from("owner_accounts").delete().eq("owner_id", data.id);
    }
    return { ok: true };
  });

export const deleteOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find linked auth users to clean up.
    const { data: links } = await supabaseAdmin
      .from("owner_accounts").select("user_id").eq("owner_id", data.id);
    await supabaseAdmin.from("owner_accounts").delete().eq("owner_id", data.id);
    for (const l of links ?? []) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", l.user_id).eq("role", "owner");
      await supabaseAdmin.auth.admin.deleteUser(l.user_id).catch(() => {});
    }
    const { error } = await supabaseAdmin.from("owners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOwnerAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("owner_accounts")
      .select("id, owner_id, user_id, owners(name, email), created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });


/**
 * Public: owner first-login bootstrap. If `owners.password_set` is false for the email,
 * create or update the auth user with the supplied password and mark password_set=true.
 * Subsequent calls are no-ops (returns already_set=true) so the client should just signInWithPassword.
 */
export const ownerInitPasswordIfNeeded = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(4).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: owner, error: oErr } = await supabaseAdmin
      .from("owners")
      .select("id, name, password_set")
      .eq("email", email)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("등록되지 않은 이메일입니다. 관리자에게 문의하세요.");
    if (owner.password_set) return { already_set: true };

    // Find or create auth user.
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
    if (found) {
      userId = found.id;
      const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (uErr) throw new Error(`비밀번호 설정 실패: ${uErr.message}`);
    } else {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { display_name: owner.name },
      });
      if (cErr || !created.user) throw new Error(`계정 생성 실패: ${cErr?.message ?? "unknown"}`);
      userId = created.user.id;
    }

    // Owner role + link (idempotent).
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("owner_accounts")
      .upsert({ owner_id: owner.id, user_id: userId }, { onConflict: "owner_id,user_id" });

    await supabaseAdmin.from("owners").update({ password_set: true }).eq("id", owner.id);

    return { already_set: false };
  });

/** Assign admin role in user_roles (idempotent). */
async function grantAdminRole(supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"], userId: string) {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw new Error(error.message);
}

/** Public admin registration — creates a confirmed auth user (no email confirmation step). */
export const registerAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(6).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const found = await findAuthUserByEmail(supabaseAdmin, email);
    if (found) {
      if (!found.email_confirmed_at) {
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
          email_confirm: true,
          password: data.password,
        });
        if (uErr) throw new Error(uErr.message);
        await grantAdminRole(supabaseAdmin, found.id);
        return { ok: true };
      }
      throw new Error("이미 가입된 이메일입니다. Sign In 탭에서 로그인하세요.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "계정 생성 실패");
    await grantAdminRole(supabaseAdmin, created.user.id);
    return { ok: true };
  });

/** Confirm email + sync password before admin Sign In (bypasses Supabase Confirm email). */
export const prepareAdminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(6).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const found = await findAuthUserByEmail(supabaseAdmin, email);
    if (!found) throw new Error("가입되지 않은 이메일입니다. Sign Up 탭에서 먼저 가입하세요.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
      email_confirm: true,
      password: data.password,
    });
    if (error) throw new Error(`계정 준비 실패: ${error.message}`);
    return { ok: true };
  });

export const promoteSelfToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Ask an existing admin to promote you.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
