import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Aggregate rental counts grouped by renter_name (대여처).
 * Admin: all data, optionally filtered by owner_id.
 * Owner: limited automatically by RLS to their linked owners.
 */
export const renterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("products")
      .select("renter_name, owner_id, owners(name)")
      .eq("status_category", "rental");
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { renter_name: string; count: number; owners: Set<string> }
    >();
    for (const r of rows ?? []) {
      const name = (r.renter_name ?? "미지정").trim() || "미지정";
      const ownerName = (r as any).owners?.name ?? "—";
      const entry = map.get(name) ?? { renter_name: name, count: 0, owners: new Set() };
      entry.count += 1;
      entry.owners.add(ownerName);
      map.set(name, entry);
    }
    const items = Array.from(map.values())
      .map((e) => ({ renter_name: e.renter_name, count: e.count, owners: Array.from(e.owners) }))
      .sort((a, b) => b.count - a.count);
    const total = items.reduce((s, i) => s + i.count, 0);
    return { total, items };
  });
