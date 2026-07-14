import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RowSchema = z.object({
  product_no: z.string().min(1).max(100),
  bobbin_size: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  status_category: z.enum(["rental", "in_stock", "awaiting_return", "scheduled_return", "expected_complete"]),
  status_raw: z.string().max(500).nullable().optional(),
  renter_name: z.string().max(200).nullable().optional(),
  stock_location: z.string().max(200).nullable().optional(),
});

const InputSchema = z.object({
  owner_id: z.string().uuid(),
  file_name: z.string().max(300),
  // YYYY-MM-01 (first day of the period month)
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/, "period_month must be YYYY-MM-01"),
  rows: z.array(RowSchema).min(1).max(5000),
  // 같은 (소유주, 기준월) 첫 배치인지 여부. true면 기존 이력을 정리 후 신규 누적.
  reset_period: z.boolean().optional(),
});

export const uploadBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: rErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 이력 시각 = 기준월의 말일 23:59:59 (월별 집계가 명확하도록)
    const [yStr, mStr] = data.period_month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const changedAtIso = monthEnd.toISOString();

    // 같은 (소유주, 기준월) 재업로드 처리: 첫 배치(reset_period=true)에서 이전 배치/이력을 정리.
    if (data.reset_period) {
      const { data: prior } = await supabaseAdmin
        .from("upload_batches")
        .select("id")
        .eq("owner_id", data.owner_id)
        .eq("period_month", data.period_month);
      const ids = (prior ?? []).map((b) => b.id);
      if (ids.length) {
        await supabaseAdmin.from("product_status_history").delete().in("batch_id", ids);
        await supabaseAdmin.from("upload_batches").delete().in("id", ids);
      }
    }

    // 같은 배치 내 product_no 중복 시 Postgres upsert가
    // "ON CONFLICT DO UPDATE cannot affect row a second time" 로 실패하므로 마지막 행만 유지.
    const byProductNo = new Map<string, (typeof data.rows)[number]>();
    for (const r of data.rows) {
      byProductNo.set(r.product_no, r);
    }
    const uniqueRows = Array.from(byProductNo.values());

    const productsPayload = uniqueRows.map((r) => ({
      owner_id: data.owner_id,
      product_no: r.product_no,
      bobbin_size: r.bobbin_size ?? null,
      status_category: r.status_category,
      status_raw: r.status_raw ?? null,
      renter_name: r.renter_name ?? null,
      stock_location: r.stock_location ?? null,
      address: (r.address ?? "").trim() || null,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("products")
      .upsert(productsPayload, { onConflict: "owner_id,product_no" });
    if (upErr) throw new Error(upErr.message);

    const { data: batchRow, error: bErr } = await supabaseAdmin
      .from("upload_batches")
      .insert({
        owner_id: data.owner_id,
        uploaded_by: context.userId,
        file_name: data.file_name,
        period_month: data.period_month,
        row_count: uniqueRows.length,
        inserted_count: uniqueRows.length,
        updated_count: 0,
        error_count: 0,
      })
      .select("id")
      .single();
    if (bErr) console.error(bErr);

    const productNos = uniqueRows.map((r) => r.product_no);
    const { data: newProducts } = await supabaseAdmin
      .from("products")
      .select("id, product_no, status_category, renter_name, stock_location")
      .eq("owner_id", data.owner_id)
      .in("product_no", productNos);

    // 월별 스냅샷 이력: reset 시 모두 기록, 그 외에는 변경된 것만 기록.
    // 같은 (소유주, 기준월)에 이미 어떤 product의 이력이 있는지 조회해 중복 방지.
    const { data: existingPeriodHistory } = await supabaseAdmin
      .from("product_status_history")
      .select("product_id")
      .eq("owner_id", data.owner_id)
      .gte("changed_at", `${data.period_month} 00:00:00+00`)
      .lte("changed_at", changedAtIso);
    const alreadyInPeriod = new Set((existingPeriodHistory ?? []).map((r) => r.product_id));

    const historyPayload: Array<{
      product_id: string; owner_id: string; status_category: string;
      renter_name: string | null; stock_location: string | null;
      batch_id: string | null; changed_at: string;
    }> = [];
    for (const np of newProducts ?? []) {
      if (alreadyInPeriod.has(np.id)) continue;
      historyPayload.push({
        product_id: np.id,
        owner_id: data.owner_id,
        status_category: np.status_category,
        renter_name: np.renter_name,
        stock_location: np.stock_location,
        batch_id: batchRow?.id ?? null,
        changed_at: changedAtIso,
      });
    }
    if (historyPayload.length > 0) {
      const { error: hErr } = await supabaseAdmin
        .from("product_status_history")
        .insert(historyPayload);
      if (hErr) console.error("history insert err", hErr);
    }

    const { count: productCount } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", data.owner_id);

    return {
      row_count: uniqueRows.length,
      history_recorded: historyPayload.length,
      deduped: data.rows.length - uniqueRows.length,
      product_count: productCount ?? 0,
    };
  });
