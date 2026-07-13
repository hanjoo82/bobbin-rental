import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Supabase/PostgREST는 단일 요청당 기본 1000행 상한이 있어
 * 전체 집계가 필요한 쿼리는 페이지네이션으로 모두 가져와야 한다.
 */
async function fetchAllRows<T>(
  buildQuery: () => any,
  pageSize = 1000,
  hardCap = 100000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (from < hardCap) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * Owner-focused extended KPIs:
 *  - annual turnover (rental transitions in last 365d ÷ total assets)
 *  - avg rental days for currently-rental products
 *  - rental aging buckets (0-30 / 30-90 / 90-180 / 180+)
 *  - top renters by current rental count
 *  - idle stock count (in_stock for 30+ days)
 */
export const dashboardExtended = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const products = await fetchAllRows<{ id: string; status_category: string; renter_name: string | null; updated_at: string }>(
      () => {
        let q = context.supabase.from("products").select("id, status_category, renter_name, updated_at");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const history = await fetchAllRows<{ product_id: string; status_category: string; changed_at: string }>(
      () => {
        let q = context.supabase
          .from("product_status_history")
          .select("product_id, status_category, changed_at")
          .gte("changed_at", yearAgo.toISOString())
          .order("changed_at", { ascending: false });
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const total = products?.length ?? 0;
    const rentalTransitions = (history ?? []).filter((h) => h.status_category === "rental").length;
    const turnover = total > 0 ? rentalTransitions / total : 0;

    const lastRentalAt = new Map<string, Date>();
    const lastStockAt = new Map<string, Date>();
    for (const h of history ?? []) {
      const pid = h.product_id as string;
      if (h.status_category === "rental" && !lastRentalAt.has(pid)) {
        lastRentalAt.set(pid, new Date(h.changed_at as string));
      }
      if (h.status_category === "in_stock" && !lastStockAt.has(pid)) {
        lastStockAt.set(pid, new Date(h.changed_at as string));
      }
    }

    const now = Date.now();
    const dayMs = 86_400_000;
    const rentalDays: number[] = [];
    const aging = { d0_30: 0, d30_90: 0, d90_180: 0, d180p: 0 };
    const renterCounts = new Map<string, number>();
    let idleStock = 0;

    for (const p of products ?? []) {
      if (p.status_category === "rental") {
        const start = lastRentalAt.get(p.id as string) ?? new Date(p.updated_at as string);
        const days = Math.max(0, Math.floor((now - start.getTime()) / dayMs));
        rentalDays.push(days);
        if (days < 30) aging.d0_30++;
        else if (days < 90) aging.d30_90++;
        else if (days < 180) aging.d90_180++;
        else aging.d180p++;
        const name = (p.renter_name ?? "").trim();
        if (name) renterCounts.set(name, (renterCounts.get(name) ?? 0) + 1);
      } else if (p.status_category === "in_stock") {
        const start = lastStockAt.get(p.id as string) ?? new Date(p.updated_at as string);
        const days = Math.floor((now - start.getTime()) / dayMs);
        if (days >= 30) idleStock++;
      }
    }

    const avgRentalDays = rentalDays.length > 0
      ? Math.round(rentalDays.reduce((a, b) => a + b, 0) / rentalDays.length)
      : 0;

    const topRenters = Array.from(renterCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { turnover, avgRentalDays, aging, topRenters, idleStock };
  });

/**
 * 자산운용현황 + 분기 KPI + 신규거래처
 * - 렌탈: 전선사(이름에 전선/케이블/cable/wire 포함) / 고객사 / 미지정(이름 없음)
 * - 재고: 본사 / 물류센터 / 기타 (주소 키워드)
 * - 미착재고 = scheduled_return + expected_complete + awaiting_return
 * - 분기(최근 90일): 신규 렌탈, 회수, 회전율, 평균 대여기간, 전분기 비교
 * - 신규거래처: history에서 첫 등장이 최근 90일 이내인 renter
 */
export const assetOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const products = await fetchAllRows<{ id: string; status_category: string; renter_name: string | null; address: string | null; stock_location: string | null; bobbin_size: string | null; updated_at: string }>(
      () => {
        let q = context.supabase
          .from("products")
          .select("id, status_category, renter_name, address, stock_location, bobbin_size, updated_at");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const histSince = new Date();
    histSince.setFullYear(histSince.getFullYear() - 2);
    const history = await fetchAllRows<{ product_id: string; status_category: string; renter_name: string | null; changed_at: string }>(
      () => {
        let q = context.supabase
          .from("product_status_history")
          .select("product_id, status_category, renter_name, changed_at")
          .gte("changed_at", histSince.toISOString())
          .order("changed_at", { ascending: true });
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const total = products?.length ?? 0;
    const now = new Date();
    const nowMs = now.getTime();
    const dayMs = 86_400_000;

    const last30Start = nowMs - 30 * dayMs;
    const yearStart = nowMs - 365 * dayMs;

    const isWire = (n: string) => /전선|케이블|cable|wire|전력/i.test(n);
    const rental = { wire: 0, customer: 0, unknown: 0 };
    const stock = { hq: 0, logistics: 0, other: 0 };
    const inTransit = { scheduled_return: 0, expected_complete: 0, awaiting_return: 0 };
    const sizeMap = new Map<string, number>();

    for (const p of products ?? []) {
      const sc = p.status_category as string;
      const name = ((p.renter_name as string) ?? "").trim();
      const loc = (((p as any).stock_location as string) ?? "").trim();
      const size = ((p.bobbin_size as string) ?? "").trim() || "미지정";
      sizeMap.set(size, (sizeMap.get(size) ?? 0) + 1);
      if (sc === "rental") {
        if (!name) rental.unknown++;
        else if (isWire(name)) rental.wire++;
        else rental.customer++;
      } else if (sc === "in_stock") {
        if (/본사/.test(loc)) stock.hq++;
        else if (/물류|센터|창고/.test(loc)) stock.logistics++;
        else stock.other++;
      } else if (sc === "scheduled_return") inTransit.scheduled_return++;
      else if (sc === "expected_complete") inTransit.expected_complete++;
      else if (sc === "awaiting_return") inTransit.awaiting_return++;
    }

    const sizes = Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);

    const rentalTotal = rental.wire + rental.customer + rental.unknown;
    const stockTotal = stock.hq + stock.logistics + stock.other;
    const inTransitTotal = inTransit.scheduled_return + inTransit.expected_complete + inTransit.awaiting_return;
    const rentalRate = total > 0 ? rentalTotal / total : 0;
    const stockRate = total > 0 ? (stockTotal + inTransitTotal) / total : 0;

    // 월말 스냅샷 이력(UTC YYYY-MM). changed_at은 업로드 시 해당 월 말일 23:59:59Z.
    // 로컬 TZ(UTC+9)로 달 경계를 치면 6월 말 스냅샷이 7월로 잘못 잡혀 전월 비교가 깨진다.
    const utcYm = (iso: string) => {
      const d = new Date(iso);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    type Snap = { status: string; renter: string | null; at: number };
    const monthSnaps = new Map<string, Map<string, Snap>>();
    const firstSeenRenter = new Map<string, number>();
    const lastRentalStart = new Map<string, Date>();

    for (const h of history ?? []) {
      const t = new Date(h.changed_at as string).getTime();
      const ym = utcYm(h.changed_at as string);
      const pid = h.product_id as string;
      if (!monthSnaps.has(ym)) monthSnaps.set(ym, new Map());
      const snap = monthSnaps.get(ym)!;
      const prev = snap.get(pid);
      if (!prev || t >= prev.at) {
        snap.set(pid, {
          status: h.status_category as string,
          renter: (h.renter_name as string) ?? null,
          at: t,
        });
      }
      if (h.status_category === "rental") {
        const dt = new Date(h.changed_at as string);
        const prevStart = lastRentalStart.get(pid);
        if (!prevStart || dt > prevStart) lastRentalStart.set(pid, dt);
        const n = ((h.renter_name as string) ?? "").trim();
        if (n && !firstSeenRenter.has(n)) firstSeenRenter.set(n, t);
      }
    }

    const monthKeys = Array.from(monthSnaps.keys()).sort();
    const hasPriorMonth = monthKeys.length >= 2;
    const curYm = monthKeys.at(-1);
    const prevYm = hasPriorMonth ? monthKeys.at(-2)! : null;
    const curSnap = curYm ? monthSnaps.get(curYm)! : new Map<string, Snap>();
    const prevSnap = prevYm ? monthSnaps.get(prevYm)! : new Map<string, Snap>();

    const countTransitions = (from: Map<string, Snap>, to: Map<string, Snap>) => {
      let newRentals = 0;
      let returns = 0;
      for (const [pid, cur] of to) {
        const earlier = from.get(pid);
        if (cur.status === "rental" && (!earlier || earlier.status !== "rental")) newRentals++;
        if (earlier?.status === "rental" && cur.status !== "rental") returns++;
      }
      return { newRentals, returns };
    };

    const { newRentals: mNewRentals, returns: mReturns } = hasPriorMonth
      ? countTransitions(prevSnap, curSnap)
      : { newRentals: 0, returns: 0 };

    let prevMNewRentals = 0;
    let prevMReturns = 0;
    if (monthKeys.length >= 3) {
      const older = monthSnaps.get(monthKeys[monthKeys.length - 3])!;
      const tr = countTransitions(older, prevSnap);
      prevMNewRentals = tr.newRentals;
      prevMReturns = tr.returns;
    }

    let yearNewRentals = 0;
    for (let i = 1; i < monthKeys.length; i++) {
      const [y, m] = monthKeys[i].split("-").map(Number);
      if (Date.UTC(y, m - 1, 1) < yearStart) continue;
      const tr = countTransitions(monthSnaps.get(monthKeys[i - 1])!, monthSnaps.get(monthKeys[i])!);
      yearNewRentals += tr.newRentals;
    }

    // 신규 거래처 (최근 30일)
    const newRenters: { name: string; firstAt: string }[] = [];
    for (const [n, t] of firstSeenRenter.entries()) {
      if (t >= last30Start) newRenters.push({ name: n, firstAt: new Date(t).toISOString() });
    }
    newRenters.sort((a, b) => +new Date(b.firstAt) - +new Date(a.firstAt));

    // 연간 누적 회전율
    const annualTurnover = total > 0 ? yearNewRentals / total : 0;

    // 신규렌탈 MoM
    const newRentalDeltaPct = prevMNewRentals > 0
      ? ((mNewRentals - prevMNewRentals) / prevMNewRentals) * 100
      : 0;

    // 평균 대여기간: 현재 vs 한 달 전 스냅샷
    const monthAgoMs = nowMs - 30 * dayMs;
    const curDays: number[] = [];
    const prevDays: number[] = [];
    const renterCounts = new Map<string, number>();
    for (const p of products ?? []) {
      if (p.status_category !== "rental") continue;
      const start = lastRentalStart.get(p.id as string) ?? new Date(p.updated_at as string);
      const startMs = start.getTime();
      curDays.push(Math.max(0, Math.floor((nowMs - startMs) / dayMs)));
      if (startMs <= monthAgoMs) {
        prevDays.push(Math.max(0, Math.floor((monthAgoMs - startMs) / dayMs)));
      }
      const n = ((p.renter_name as string) ?? "").trim();
      if (n) renterCounts.set(n, (renterCounts.get(n) ?? 0) + 1);
    }
    const avgRentalDays = curDays.length
      ? Math.round(curDays.reduce((a, b) => a + b, 0) / curDays.length) : 0;
    const prevAvgRentalDays = prevDays.length
      ? Math.round(prevDays.reduce((a, b) => a + b, 0) / prevDays.length) : 0;
    const avgDaysDelta = avgRentalDays - prevAvgRentalDays;

    // 전월 스냅샷 렌탈비율 vs 현재 보유 렌탈비율
    let prevRentalCount = 0;
    for (const s of prevSnap.values()) if (s.status === "rental") prevRentalCount++;
    const prevSnapTotal = prevSnap.size;
    const prevRentalRate = hasPriorMonth && prevSnapTotal > 0
      ? prevRentalCount / prevSnapTotal
      : rentalRate;
    const rentalRateDeltaPp = hasPriorMonth ? (rentalRate - prevRentalRate) * 100 : 0;

    const topRenters = Array.from(renterCounts.entries())
      .map(([name, count]) => ({
        name, count,
        isNew: (firstSeenRenter.get(name) ?? 0) >= last30Start,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 인사이트 우선순위: 렌탈비율 MoM → 신규렌탈 MoM → 신규거래처 → fallback
    let insight = "전월 대비 큰 변화 없이 안정적으로 운영되고 있습니다.";
    if (!hasPriorMonth) {
      insight = "전월 데이터가 아직 없어 비교 지표는 다음 달부터 표시됩니다.";
    } else if (Math.abs(rentalRateDeltaPp) >= 2) {
      const dir = rentalRateDeltaPp >= 0 ? "상승" : "하락";
      insight = `렌탈비율이 전월 대비 ${rentalRateDeltaPp >= 0 ? "+" : ""}${rentalRateDeltaPp.toFixed(1)}%p ${dir} (${(prevRentalRate * 100).toFixed(1)}% → ${(rentalRate * 100).toFixed(1)}%)`;
    } else if (Math.abs(newRentalDeltaPct) >= 15 && prevMNewRentals > 0) {
      const diff = mNewRentals - prevMNewRentals;
      insight = `이번 달 신규 렌탈 ${diff >= 0 ? "+" : ""}${diff}건 (전월 ${prevMNewRentals}건 → 이번달 ${mNewRentals}건)`;
    } else if (newRenters.length > 0) {
      insight = `최근 30일간 신규 거래처 ${newRenters.length}개사가 첫 거래를 시작했습니다.`;
    }

    const monthOut = hasPriorMonth ? {
      newRentals: mNewRentals,
      prevNewRentals: prevMNewRentals,
      deltaPct: newRentalDeltaPct,
      returns: mReturns,
      prevReturns: prevMReturns,
      avgRentalDays,
      prevAvgRentalDays,
      avgDaysDelta,
      rentalRate,
      prevRentalRate,
      rentalRateDeltaPp,
    } : {
      newRentals: 0, prevNewRentals: 0, deltaPct: 0,
      returns: 0, prevReturns: 0,
      avgRentalDays, prevAvgRentalDays: avgRentalDays, avgDaysDelta: 0,
      rentalRate, prevRentalRate: rentalRate, rentalRateDeltaPp: 0,
    };

    return {
      total,
      rental: { ...rental, total: rentalTotal, rate: rentalRate },
      stock: { ...stock, total: stockTotal },
      inTransit: { ...inTransit, total: inTransitTotal },
      stockRate,
      sizes,
      month: monthOut,
      hasPriorMonth,
      annualTurnover,
      yearNewRentals,
      topRenters,
      newRenters: newRenters.slice(0, 10),
      newRentersCount: newRenters.length,
      insight,
    };
  });

/**
 * Aggregated dashboard KPIs. RLS scopes automatically:
 *  - admin: all products
 *  - owner: only owners linked via owner_accounts
 */
export const dashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const rows = await fetchAllRows<{ status_category: string; bobbin_size: string | null; renter_name: string | null }>(
      () => {
        let q = context.supabase.from("products").select("status_category, bobbin_size, renter_name");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const byStatus: Record<string, number> = {
      rental: 0, in_stock: 0, awaiting_return: 0, scheduled_return: 0, expected_complete: 0,
    };
    const bySize = new Map<string, number>();
    const renters = new Set<string>();

    for (const r of rows ?? []) {
      const sc = r.status_category as string;
      byStatus[sc] = (byStatus[sc] ?? 0) + 1;

      const size = (r.bobbin_size ?? "미지정").toString().trim() || "미지정";
      bySize.set(size, (bySize.get(size) ?? 0) + 1);

      if (sc === "rental") {
        const name = (r.renter_name ?? "").trim();
        if (name) renters.add(name);
      }
    }

    const total = rows?.length ?? 0;
    const sizes = Array.from(bySize.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);

    const rentalCount = byStatus.rental;
    const stockCount = byStatus.in_stock;
    const rentalRate = total > 0 ? rentalCount / total : 0;
    const stockRate = total > 0 ? stockCount / total : 0;

    return {
      total,
      sizes,
      rental: { count: rentalCount, rate: rentalRate, renterCount: renters.size },
      stock: { count: stockCount, rate: stockRate },
      recovery: {
        expected_complete: byStatus.expected_complete,
        scheduled_return: byStatus.scheduled_return,
        awaiting_return: byStatus.awaiting_return,
      },
    };
  });

/**
 * Monthly rental trend from product_status_history.
 * Returns counts per (month, status_category) for the last N months.
 */
export const monthlyTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      owner_id: z.string().uuid().optional(),
      months: z.number().min(1).max(24).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const months = data.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await fetchAllRows<{ status_category: string; changed_at: string; renter_name: string | null }>(
      () => {
        let q = context.supabase
          .from("product_status_history")
          .select("status_category, changed_at, renter_name")
          .gte("changed_at", since.toISOString())
          .order("changed_at", { ascending: true });
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );


    // Build month buckets
    const buckets = new Map<string, { month: string; rental: number; in_stock: number; awaiting_return: number; scheduled_return: number; expected_complete: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { month: key, rental: 0, in_stock: 0, awaiting_return: 0, scheduled_return: 0, expected_complete: 0 });
    }

    // Top renters (cumulative rental events in window)
    const renterMap = new Map<string, number>();

    for (const r of rows ?? []) {
      const d = new Date(r.changed_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (bucket) {
        const sc = r.status_category as keyof typeof bucket;
        if (sc in bucket && typeof bucket[sc] === "number") {
          (bucket[sc] as number) += 1;
        }
      }
      if (r.status_category === "rental") {
        const name = ((r.renter_name as string) ?? "").trim();
        if (name) renterMap.set(name, (renterMap.get(name) ?? 0) + 1);
      }
    }

    const topRenters = Array.from(renterMap.entries())
      .map(([renter_name, count]) => ({ renter_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      months: Array.from(buckets.values()),
      topRenters,
      total: rows?.length ?? 0,
    };
  });

/**
 * 자산현황 매트릭스: 소유주별 × 사이즈별 보유수량 + 렌탈비율
 * - 셀: 해당 소유주·사이즈 총 보유수량
 * - 우측: 소유주 합계 / 렌탈수 / 렌탈비율
 * - 마지막 행: 전체 합계
 */
export const assetMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const products = await fetchAllRows<{ owner_id: string; bobbin_size: string | null; status_category: string }>(
      () => {
        let q = context.supabase.from("products").select("owner_id, bobbin_size, status_category");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const { data: owners, error: oe } = await context.supabase
      .from("owners").select("id, name");
    if (oe) throw new Error(oe.message);
    const ownerName = new Map<string, string>();
    for (const o of owners ?? []) ownerName.set(o.id as string, (o.name as string) ?? "");

    const sizeTotals = new Map<string, number>();
    type RowAgg = {
      owner_id: string; owner_name: string;
      bySize: Record<string, number>;
      total: number; rentalCount: number;
    };
    const rowMap = new Map<string, RowAgg>();

    for (const p of products ?? []) {
      const oid = (p.owner_id as string) ?? "";
      const sz = ((p.bobbin_size as string) ?? "").trim() || "미지정";
      const status = p.status_category as string;
      let row = rowMap.get(oid);
      if (!row) {
        row = { owner_id: oid, owner_name: ownerName.get(oid) ?? "(알수없음)", bySize: {}, total: 0, rentalCount: 0 };
        rowMap.set(oid, row);
      }
      row.bySize[sz] = (row.bySize[sz] ?? 0) + 1;
      row.total++;
      if (status === "rental") row.rentalCount++;
      sizeTotals.set(sz, (sizeTotals.get(sz) ?? 0) + 1);
    }

    const sizes = Array.from(sizeTotals.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const rows = Array.from(rowMap.values())
      .map((r) => ({ ...r, rentalRate: r.total > 0 ? +((r.rentalCount / r.total) * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.total - a.total);

    const totalBySize: Record<string, number> = {};
    for (const s of sizes) totalBySize[s] = sizeTotals.get(s) ?? 0;
    const totalAll = rows.reduce((s, r) => s + r.total, 0);
    const totalRental = rows.reduce((s, r) => s + r.rentalCount, 0);

    return {
      sizes,
      rows,
      totals: {
        bySize: totalBySize,
        total: totalAll,
        rentalCount: totalRental,
        rentalRate: totalAll > 0 ? +((totalRental / totalAll) * 100).toFixed(1) : 0,
      },
    };
  });
