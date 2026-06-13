import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: roles }, { data: links }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("owner_accounts").select("owner_id, owners(id, name)").eq("user_id", userId),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const isOwner = (roles ?? []).some((r) => r.role === "owner");

    return {
      userId,
      email: context.claims?.email ?? null,
      displayName: profile?.display_name ?? null,
      isAdmin,
      isOwner,
      owners: (links ?? []).map((l: any) => ({
        id: l.owners?.id,
        name: l.owners?.name,
      })).filter((o: any) => o.id),
    };
  });
