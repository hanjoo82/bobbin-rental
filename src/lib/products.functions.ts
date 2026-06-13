import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      owner_id: z.string().uuid().optional(),
      status: z
        .enum(["rental", "in_stock", "awaiting_return", "scheduled_return", "expected_complete"])
        .optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("products")
      .select("id, owner_id, product_no, bobbin_size, status_category, renter_name, stock_location, address, updated_at, owners(name)")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);
    if (data.status) q = q.eq("status_category", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const productStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("products").select("status_category, owner_id");
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const byStatus: Record<string, number> = {
      rental: 0, in_stock: 0, awaiting_return: 0, scheduled_return: 0, expected_complete: 0,
    };
    for (const r of rows ?? []) byStatus[r.status_category as string] = (byStatus[r.status_category as string] ?? 0) + 1;
    return { total: rows?.length ?? 0, byStatus };
  });
