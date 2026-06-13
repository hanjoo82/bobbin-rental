import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * PostgREST 단일 요청당 기본 1000행 상한 회피용 페이지네이션 헬퍼.
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

const SIDO_MAP: Record<string, string> = {
  "서울": "서울", "서울특별시": "서울",
  "부산": "부산", "부산광역시": "부산",
  "대구": "대구", "대구광역시": "대구",
  "인천": "인천", "인천광역시": "인천",
  "광주": "광주", "광주광역시": "광주",
  "대전": "대전", "대전광역시": "대전",
  "울산": "울산", "울산광역시": "울산",
  "세종": "세종", "세종특별자치시": "세종",
  "경기": "경기", "경기도": "경기",
  "강원": "강원", "강원도": "강원", "강원특별자치도": "강원",
  "충북": "충북", "충청북도": "충북",
  "충남": "충남", "충청남도": "충남",
  "전북": "전북", "전라북도": "전북", "전북특별자치도": "전북",
  "전남": "전남", "전라남도": "전남",
  "경북": "경북", "경상북도": "경북",
  "경남": "경남", "경상남도": "경남",
  "제주": "제주", "제주도": "제주", "제주특별자치도": "제주",
};

function extractSido(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const first = addr.trim().split(/\s+/)[0];
  return SIDO_MAP[first] ?? null;
}

/**
 * 지역별 보유/렌탈 분포
 */
export const regionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const rows = await fetchAllRows<{ address: string | null; lat: number | null; status_category: string }>(
      () => {
        let q = context.supabase.from("products").select("address, lat, status_category");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const byRegion = new Map<string, { sido: string; total: number; rental: number; noGeo: number }>();
    let unknown = 0;
    let noGeoTotal = 0;
    for (const r of rows ?? []) {
      const sido = extractSido(r.address as string | null);
      if (!sido) { unknown++; continue; }
      const e = byRegion.get(sido) ?? { sido, total: 0, rental: 0, noGeo: 0 };
      e.total++;
      if (r.status_category === "rental") e.rental++;
      if (r.lat == null) { e.noGeo++; noGeoTotal++; }
      byRegion.set(sido, e);
    }
    const regions = Array.from(byRegion.values())
      .map((e) => ({ ...e, rate: e.total > 0 ? e.rental / e.total : 0 }))
      .sort((a, b) => b.total - a.total);

    return { regions, unknown, noGeoTotal, totalProducts: rows?.length ?? 0 };
  });

/**
 * 지역별 분포: 렌탈 / 본사 재고 / 물류센터 재고 / 회수대상
 */
export const regionBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const rows = await fetchAllRows<{ address: string | null; status_category: string }>(
      () => {
        let q = context.supabase.from("products").select("address, status_category");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    type Row = { sido: string; rental: number; hq: number; logistics: number; awaiting: number; total: number };
    const map = new Map<string, Row>();
    let unknownSido = 0;
    const totals = { rental: 0, hq: 0, logistics: 0, awaiting: 0 };

    for (const r of rows ?? []) {
      const addr = (r.address as string | null) ?? "";
      const sido = extractSido(addr);
      if (!sido) { unknownSido++; continue; }
      const e = map.get(sido) ?? { sido, rental: 0, hq: 0, logistics: 0, awaiting: 0, total: 0 };

      if (r.status_category === "rental") {
        e.rental++; totals.rental++;
      } else if (r.status_category === "awaiting_return") {
        e.awaiting++; totals.awaiting++;
      } else if (r.status_category === "in_stock") {
        if (/본사/.test(addr)) { e.hq++; totals.hq++; }
        else if (/물류|센터|창고/.test(addr)) { e.logistics++; totals.logistics++; }
      }
      e.total = e.rental + e.hq + e.logistics + e.awaiting;
      map.set(sido, e);
    }

    const regions = Array.from(map.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);

    return { regions, unknownSido, totals };
  });

/**
 * 거래처 프로파일: 현재 렌탈 기준
 */
export const renterProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const products = await fetchAllRows<{ id: string; status_category: string; renter_name: string | null; bobbin_size: string | null; updated_at: string }>(
      () => {
        let q = context.supabase
          .from("products")
          .select("id, status_category, renter_name, bobbin_size, updated_at");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    // history for last rental start per product + first-ever rental per renter
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 2);
    const history = await fetchAllRows<{ product_id: string; status_category: string; renter_name: string | null; changed_at: string }>(
      () => {
        let q = context.supabase
          .from("product_status_history")
          .select("product_id, status_category, renter_name, changed_at")
          .gte("changed_at", yearAgo.toISOString())
          .order("changed_at", { ascending: true });
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const firstSeen = new Map<string, Date>();
    const lastSeen = new Map<string, Date>();
    const lastRentalStart = new Map<string, Date>(); // product_id -> most recent rental start
    for (const h of history ?? []) {
      if (h.status_category !== "rental") continue;
      const name = ((h.renter_name as string) ?? "").trim();
      const at = new Date(h.changed_at as string);
      if (name) {
        if (!firstSeen.has(name) || at < firstSeen.get(name)!) firstSeen.set(name, at);
        if (!lastSeen.has(name) || at > lastSeen.get(name)!) lastSeen.set(name, at);
      }
      const pid = h.product_id as string;
      const prev = lastRentalStart.get(pid);
      if (!prev || at > prev) lastRentalStart.set(pid, at);
    }

    const now = Date.now();
    const dayMs = 86_400_000;
    const map = new Map<string, {
      name: string;
      count: number;
      days: number[];
      sizes: Map<string, number>;
    }>();

    let unnamedRentals = 0;
    for (const p of products ?? []) {
      if (p.status_category !== "rental") continue;
      const name = ((p.renter_name as string) ?? "").trim();
      if (!name) { unnamedRentals++; continue; }
      const e = map.get(name) ?? { name, count: 0, days: [] as number[], sizes: new Map<string, number>() };
      e.count++;
      const start = lastRentalStart.get(p.id as string) ?? new Date(p.updated_at as string);
      e.days.push(Math.max(0, Math.floor((now - start.getTime()) / dayMs)));
      const sz = ((p.bobbin_size as string) ?? "미지정").trim() || "미지정";
      e.sizes.set(sz, (e.sizes.get(sz) ?? 0) + 1);
      map.set(name, e);
    }

    const profiles = Array.from(map.values()).map((e) => {
      const avgDays = e.days.length ? Math.round(e.days.reduce((a, b) => a + b, 0) / e.days.length) : 0;
      const topSize = Array.from(e.sizes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const first = firstSeen.get(e.name) ?? null;
      const last = lastSeen.get(e.name) ?? null;
      const tenureDays = first ? Math.floor((now - first.getTime()) / dayMs) : 0;
      return {
        name: e.name,
        count: e.count,
        avgDays,
        topSize,
        firstSeen: first?.toISOString() ?? null,
        lastSeen: last?.toISOString() ?? null,
        tenureDays,
      };
    }).sort((a, b) => b.count - a.count);

    const totalRentals = profiles.reduce((s, p) => s + p.count, 0);
    // HHI (집중도 지수, 0~1)
    const hhi = totalRentals > 0
      ? profiles.reduce((s, p) => s + Math.pow(p.count / totalRentals, 2), 0)
      : 0;
    const top3Share = totalRentals > 0
      ? profiles.slice(0, 3).reduce((s, p) => s + p.count, 0) / totalRentals
      : 0;

    // 신규 vs 장기 (tenureDays 기준 90일)
    const newCustomers = profiles.filter((p) => p.tenureDays < 90).length;
    const longCustomers = profiles.length - newCustomers;

    return {
      profiles,
      totalRentals,
      totalRenters: profiles.length,
      unnamedRentals,
      hhi,
      top3Share,
      newCustomers,
      longCustomers,
    };
  });

/**
 * 추이 확장: 월별 신규 렌탈 / 회수 / 렌탈비율 / 재고비율 / 신규거래처 / 평균회수기간 / 사이즈별
 */
export const trendsExtended = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    owner_id: z.string().uuid().optional(),
    months: z.number().min(1).max(24).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const months = data.months ?? 12;

    // 전체 history (월말 상태 재구성을 위해 since 이전도 필요 → 모두 조회)
    const history = await fetchAllRows<{ product_id: string; status_category: string; renter_name: string | null; changed_at: string }>(
      () => {
        let q = context.supabase
          .from("product_status_history")
          .select("product_id, status_category, renter_name, changed_at")
          .order("changed_at", { ascending: true });
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );

    const products = await fetchAllRows<{ id: string; bobbin_size: string | null; status_category: string; updated_at: string }>(
      () => {
        let q = context.supabase.from("products").select("id, bobbin_size, status_category, updated_at");
        if (data.owner_id) q = q.eq("owner_id", data.owner_id);
        return q;
      },
    );
    const sizeMap = new Map<string, string>();
    const productIds = new Set<string>();
    for (const p of products ?? []) {
      sizeMap.set(p.id as string, ((p.bobbin_size as string) ?? "미지정").trim() || "미지정");
      productIds.add(p.id as string);
    }
    const totalProducts = productIds.size;

    // 기준 시점 = 데이터의 최신 시점 (history 또는 products updated_at 중 가장 최근)
    // 시작 시점 = 데이터의 최초 시점 (history.changed_at 중 가장 이른 것)
    let refTs = 0;
    let firstTs = Number.POSITIVE_INFINITY;
    for (const h of history ?? []) {
      const t = new Date(h.changed_at as string).getTime();
      if (t > refTs) refTs = t;
      if (t < firstTs) firstTs = t;
    }
    for (const p of products ?? []) {
      const t = new Date((p as any).updated_at as string).getTime();
      if (t > refTs) refTs = t;
    }
    if (!refTs) refTs = Date.now();
    if (!isFinite(firstTs)) firstTs = refTs;
    const refDate = new Date(refTs);
    const firstDate = new Date(firstTs);

    // 데이터가 시작된 달부터 기준 월까지 표시 (최대 months 개월)
    const startMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1, 0, 0, 0, 0);
    const endMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
    const totalSpan =
      (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
      (endMonth.getMonth() - startMonth.getMonth()) + 1;
    // 데이터 시작 월부터 항상 `months` 개월 분량을 표시 (미래 월은 비워둠) → 단일 데이터도 좌측 정렬됨
    const span = Math.max(months, totalSpan);
    const since = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1, 0, 0, 0, 0);

    // 월 키 목록
    const monthKeys: { key: string; endTs: number }[] = [];
    for (let i = 0; i < span; i++) {
      const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      end.setMilliseconds(-1);
      monthKeys.push({ key, endTs: end.getTime() });
    }

    type Bucket = {
      month: string;
      newRentals: number;
      returns: number;
      bySize: Record<string, number>;
      newRenters: number;
      returnDays: number[];
      rentalRate: number;
      stockRate: number;
      cumulativeRenters: number;
      rentalCount: number;
      stockCount: number;
    };
    const buckets = new Map<string, Bucket>();
    for (const m of monthKeys) {
      buckets.set(m.key, {
        month: m.key, newRentals: 0, returns: 0, bySize: {},
        newRenters: 0, returnDays: [], rentalRate: 0, stockRate: 0,
        cumulativeRenters: 0, rentalCount: 0, stockCount: 0,
      });
    }

    // 제품별 이벤트 시간순 정리 (회수기간 계산용)
    const perProduct = new Map<string, { ts: number; status: string }[]>();
    // 거래처 최초 등장 시점
    const firstRenter = new Map<string, number>();
    const sizeTotals = new Map<string, number>();

    for (const h of history ?? []) {
      const ts = new Date(h.changed_at as string).getTime();
      const pid = h.product_id as string;
      const status = h.status_category as string;
      const arr = perProduct.get(pid) ?? [];
      arr.push({ ts, status });
      perProduct.set(pid, arr);

      if (status === "rental") {
        const name = ((h.renter_name as string) ?? "").trim();
        if (name && !firstRenter.has(name)) firstRenter.set(name, ts);
      }
    }

    // window 내 이벤트로 신규 렌탈/회수/사이즈/회수일수/신규거래처 집계
    const sinceTs = since.getTime();
    for (const h of history ?? []) {
      const ts = new Date(h.changed_at as string).getTime();
      if (ts < sinceTs) continue;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets.get(key);
      if (!b) continue;

      if (h.status_category === "rental") {
        b.newRentals++;
        const sz = sizeMap.get(h.product_id as string) ?? "미지정";
        b.bySize[sz] = (b.bySize[sz] ?? 0) + 1;
        sizeTotals.set(sz, (sizeTotals.get(sz) ?? 0) + 1);
        const name = ((h.renter_name as string) ?? "").trim();
        if (name && firstRenter.get(name) === ts) b.newRenters++;
      } else if (h.status_category === "in_stock") {
        b.returns++;
        // 이 회수의 직전 rental 시점 찾기
        const events = perProduct.get(h.product_id as string) ?? [];
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].ts >= ts) continue;
          if (events[i].status === "rental") {
            b.returnDays.push((ts - events[i].ts) / 86_400_000);
            break;
          }
        }
      }
    }

    // 월말 스냅샷 상태 (렌탈/재고 비율 + 누적 거래처)
    const cumRenterSet = new Set<string>();
    for (const m of monthKeys) {
      const b = buckets.get(m.key)!;
      // 월말 시점까지 등장한 거래처 누적
      for (const [name, ts] of firstRenter.entries()) {
        if (ts <= m.endTs) cumRenterSet.add(name);
      }
      b.cumulativeRenters = cumRenterSet.size;

      // 각 제품의 월말 상태
      let rentalN = 0, stockN = 0, knownN = 0;
      for (const pid of productIds) {
        const events = perProduct.get(pid);
        let status: string | null = null;
        if (events && events.length) {
          for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].ts <= m.endTs) { status = events[i].status; break; }
          }
        }
        if (!status) continue;
        knownN++;
        if (status === "rental") rentalN++;
        else if (status === "in_stock" || status === "awaiting_return") stockN++;
      }
      const denom = knownN || totalProducts || 1;
      b.rentalCount = rentalN;
      b.stockCount = stockN;
      b.rentalRate = rentalN / denom;
      b.stockRate = stockN / denom;
    }

    const topSizes = Array.from(sizeTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([size]) => size);

    const monthsArr = Array.from(buckets.values()).map((b) => {
      const avgReturnDays = b.returnDays.length
        ? Math.round((b.returnDays.reduce((a, c) => a + c, 0) / b.returnDays.length) * 10) / 10
        : null;
      const out: any = {
        month: b.month,
        newRentals: b.newRentals,
        returns: b.returns,
        net: b.newRentals - b.returns,
        rentalRate: Math.round(b.rentalRate * 1000) / 10, // %
        stockRate: Math.round(b.stockRate * 1000) / 10,
        newRenters: b.newRenters,
        cumulativeRenters: b.cumulativeRenters,
        avgReturnDays,
      };
      for (const sz of topSizes) out[sz] = b.bySize[sz] ?? 0;
      return out;
    });

    const last = monthsArr[monthsArr.length - 1];
    const prev = monthsArr[monthsArr.length - 2];
    const delta = prev && prev.newRentals > 0
      ? ((last.newRentals - prev.newRentals) / prev.newRentals) * 100
      : 0;
    const totalNew = monthsArr.reduce((s, m) => s + m.newRentals, 0);
    const totalRet = monthsArr.reduce((s, m) => s + m.returns, 0);
    const avgRentalRate = monthsArr.reduce((s, m) => s + m.rentalRate, 0) / (monthsArr.length || 1);

    // 인사이트 (가장 두드러진 변화 1개)
    const rentalRateMoM = last && prev ? +(last.rentalRate - prev.rentalRate).toFixed(1) : 0;
    const stockRateMoM = last && prev ? +(last.stockRate - prev.stockRate).toFixed(1) : 0;
    const newRentersMoM = last && prev ? last.newRenters - prev.newRenters : 0;
    let insight = "전월 대비 변동이 크지 않습니다.";
    const candidates = [
      { v: Math.abs(rentalRateMoM), text: rentalRateMoM >= 0
          ? `렌탈비율이 전월 대비 +${rentalRateMoM}%p 상승했습니다.`
          : `렌탈비율이 전월 대비 ${rentalRateMoM}%p 하락했습니다.` },
      { v: Math.abs(newRentersMoM) * 2, text: newRentersMoM >= 0
          ? `신규 거래처가 전월 대비 ${newRentersMoM}개사 증가했습니다.`
          : `신규 거래처가 전월 대비 ${Math.abs(newRentersMoM)}개사 감소했습니다.` },
      { v: Math.abs(stockRateMoM), text: stockRateMoM >= 0
          ? `재고비율이 전월 대비 +${stockRateMoM}%p 늘었습니다.`
          : `재고비율이 전월 대비 ${stockRateMoM}%p 줄었습니다.` },
    ].sort((a, b) => b.v - a.v);
    if (candidates[0]?.v > 0) insight = candidates[0].text;

    // 최근 3개월 신규 거래처 리스트
    const recentCutoff = new Date(refDate);
    recentCutoff.setMonth(recentCutoff.getMonth() - 3);
    const recentCutoffTs = recentCutoff.getTime();
    const recentNewRenters = Array.from(firstRenter.entries())
      .filter(([, ts]) => ts >= recentCutoffTs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, ts]) => ({ name, firstSeen: new Date(ts).toISOString() }));

    return {
      months: monthsArr,
      topSizes,
      summary: {
        thisMonth: last?.newRentals ?? 0,
        lastMonth: prev?.newRentals ?? 0,
        deltaPct: delta,
        totalNew,
        totalReturns: totalRet,
        netFlow: totalNew - totalRet,
        currentRentalRate: last?.rentalRate ?? 0,
        currentStockRate: last?.stockRate ?? 0,
        rentalRateMoM,
        stockRateMoM,
        currentNewRenters: last?.newRenters ?? 0,
        newRentersMoM,
        cumulativeRenters: last?.cumulativeRenters ?? 0,
        avgRentalRate: Math.round(avgRentalRate * 10) / 10,
        insight,
      },
      recentNewRenters,
    };
  });
