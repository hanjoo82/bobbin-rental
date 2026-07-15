import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { assetOps } from "@/lib/dashboard.functions";
import { getMe } from "@/lib/me.functions";
import { useOwnerScope } from "@/lib/owner-scope";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Sparkles, ArrowUpRight, TrendingUp, TrendingDown, Clock, RefreshCw,
  Repeat, UserPlus, ChevronRight, Building2, Truck, Warehouse, PackageX, Ruler,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/my/")({
  component: MyDashboard,
});



/* ───────────────────────── helpers ───────────────────────── */

function useCountUp(target: number, durationMs = 900) {
  const [v, setV] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = v;
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

function Num({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const v = useCountUp(value);
  return <>{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

type DrillKey = "asset" | "month" | "turnover" | "avg" | "newRenters" | null;

/* ───────────────────────── page ───────────────────────── */

export function MyDashboard() {
  const fetchMe = useServerFn(getMe);
  const fetchOps = useServerFn(assetOps);
  const { ownerId, label, isAdmin } = useOwnerScope();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { data, isLoading } = useQuery({
    queryKey: ["asset-ops-v3", ownerId ?? "all"],
    queryFn: () => fetchOps({ data: ownerId ? { owner_id: ownerId } : {} }),
  });
  const [drill, setDrill] = useState<DrillKey>(null);
  const ownerName = isAdmin
    ? (label || "전체 합산")
    : (me?.owners?.map((o: any) => o.name).join(", ") ?? "");

  return (
    <div className="space-y-5">
      <AssetHero
        ownerName={ownerName}
        data={data}
        loading={isLoading}
        onOpen={() => setDrill("asset")}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="이번 달 신규 렌탈"
          value={data?.month?.newRentals ?? 0}
          suffix="건"
          delta={data?.month?.deltaPct ?? 0}
          deltaLabel="전월 대비"
          icon={<Repeat className="w-4 h-4" />}
          accent="oklch(0.62 0.10 250)"
          onClick={() => setDrill("month")}
        />
        <KpiCard
          label="신규 거래처"
          value={data?.newRentersCount ?? 0}
          suffix="개사"
          icon={<UserPlus className="w-4 h-4" />}
          accent="oklch(0.65 0.10 80)"
          hint="전월 대비"
          onClick={() => setDrill("newRenters")}
        />
        <KpiCard
          label="평균 대여기간"
          value={data?.month?.avgRentalDays ?? 0}
          suffix="일"
          icon={<Clock className="w-4 h-4" />}
          accent="oklch(0.65 0.08 160)"
          delta={data?.month?.avgDaysDelta ?? 0}
          deltaLabel="전월 대비"
          deltaUnit="일"
          deltaInverse
          onClick={() => setDrill("avg")}
        />
        <KpiCard
          label="연간 누적 회전율"
          value={data?.annualTurnover ?? 0}
          decimals={2}
          suffix="회"
          icon={<RefreshCw className="w-4 h-4" />}
          accent="oklch(0.65 0.09 200)"
          hint={`최근 12개월 ${data?.yearNewRentals ?? 0}건`}
          onClick={() => setDrill("turnover")}
        />
      </div>

      <TopRentersCard renters={data?.topRenters ?? []} />

      <AssetSheet open={drill === "asset"} onClose={() => setDrill(null)} data={data} />
      <MonthSheet open={drill === "month"} onClose={() => setDrill(null)} data={data} />
      <TurnoverSheet open={drill === "turnover"} onClose={() => setDrill(null)} data={data} />
      <AvgDaysSheet open={drill === "avg"} onClose={() => setDrill(null)} data={data} />
      <NewRentersSheet open={drill === "newRenters"} onClose={() => setDrill(null)} data={data} />
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function AssetHero({ ownerName, data, loading, onOpen }: {
  ownerName: string;
  data: any;
  loading: boolean;
  onOpen: () => void;
}) {
  const rentalRate = (data?.rental?.rate ?? 0) * 100;
  const stockRate = (data?.stockRate ?? 0) * 100;
  const total = data?.total ?? 0;
  const assetsDelta = data?.assets?.delta ?? 0;
  const assetsPrevious = data?.assets?.previous ?? 0;
  const prevMonthLabel = data?.assets?.previousMonth
    ? `${Number(String(data.assets.previousMonth).slice(5))}월`
    : "전월";
  const showAssetGrowth = !!data?.hasPriorMonth && assetsDelta > 0;
  const showAssetDecline = !!data?.hasPriorMonth && assetsDelta < 0;

  return (
    <section
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[oklch(0.18_0.02_265)] text-white shadow-[0_30px_80px_-30px_oklch(0.45_0.18_265/0.45)] cursor-pointer transition-all duration-300 hover:shadow-[0_40px_100px_-30px_oklch(0.45_0.18_265/0.65)] hover:-translate-y-0.5"
    >
      <div aria-hidden className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
      <div aria-hidden className="absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-40 transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.16 270) 0%, transparent 60%)" }} />
      <div aria-hidden className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, oklch(0.65 0.13 210) 0%, transparent 60%)" }} />

      <div className="relative p-6 md:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              자산운용현황
            </div>
            <h1 className="font-display text-base md:text-lg font-medium text-white/80 truncate">
              {ownerName || "내 보빈 현황"}
            </h1>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">총 보유</div>
            <div className="font-display text-3xl md:text-4xl font-semibold tabular-nums">
              {loading ? "—" : <Num value={total} />}
              <span className="text-sm font-normal text-white/50 ml-1">대</span>
            </div>
            {!loading && showAssetGrowth && (
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                <TrendingUp className="w-3 h-3" />
                {prevMonthLabel} 대비 +{assetsDelta.toLocaleString()}대
              </div>
            )}
            {!loading && showAssetDecline && (
              <div className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-medium text-rose-200">
                <TrendingDown className="w-3 h-3" />
                {prevMonthLabel} 대비 {assetsDelta.toLocaleString()}대
              </div>
            )}
            {!loading && data?.hasPriorMonth && assetsDelta === 0 && (
              <div className="text-[11px] text-white/35 tabular-nums">
                {prevMonthLabel} {assetsPrevious.toLocaleString()}대와 동일
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] backdrop-blur border border-white/10">
          <Sparkles className="w-4 h-4 mt-0.5 text-amber-200/90 shrink-0" />
          <p className="text-sm text-white/85 leading-snug">{data?.insight ?? "분석 중…"}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-white/60">렌탈율</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {rentalRate.toFixed(1)}<span className="text-white/40 text-base">%</span>
              </span>
            </div>
            <span className="text-[11px] text-white/40">현재 스냅샷 기준</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-white/10 flex">
            <div className="h-full transition-all duration-700"
              style={{ width: `${rentalRate}%`, background: "linear-gradient(90deg, oklch(0.62 0.13 265), oklch(0.68 0.12 230))" }} />
            <div className="h-full transition-all duration-700"
              style={{ width: `${stockRate}%`, background: "linear-gradient(90deg, oklch(0.62 0.08 180), oklch(0.65 0.08 150))" }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <RateLegend label="렌탈" pct={rentalRate} count={data?.rental?.total ?? 0} dot="oklch(0.62 0.13 265)" />
            <RateLegend label="재고+미착" pct={stockRate} count={(data?.stock?.total ?? 0) + (data?.inTransit?.total ?? 0)} dot="oklch(0.62 0.08 180)" />
          </div>
        </div>

        {/* 명시적 CTA */}
        <div className="pt-1 flex justify-end">
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 transition-all group-hover:gap-2"
          >
            세부 분석 보기 <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </section>
  );
}

function RateLegend({ label, pct, count, dot }: { label: string; pct: number; count: number; dot: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: dot }} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
        <div className="text-sm tabular-nums">
          <span className="font-display text-lg font-semibold"><Num value={pct} decimals={1} />%</span>
          <span className="text-white/40 ml-1.5">· {count.toLocaleString()}대</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── KPI Cards ───────────────────────── */

function KpiCard({ label, value, suffix, decimals = 0, delta, deltaLabel = "전분기 대비", deltaUnit = "%", deltaInverse = false, icon, accent, hint, onClick }: {
  label: string; value: number; suffix?: string; decimals?: number;
  delta?: number; deltaLabel?: string; deltaUnit?: string; deltaInverse?: boolean;
  icon: React.ReactNode; accent: string; hint?: string;
  onClick: () => void;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
  const up = (delta ?? 0) >= 0;
  const positive = deltaInverse ? !up : up;
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border bg-card text-left p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/20"
    >
      <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-50"
        style={{ background: accent }} />
      <div className="relative space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">{icon}{label}</div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tabular-nums">
            <Num value={value} decimals={decimals} />
          </span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <div className="flex items-center justify-between text-xs gap-2">
          {hasDelta ? (
            <span className={`inline-flex items-center gap-0.5 font-medium ${positive ? "text-emerald-600" : "text-rose-600"} min-w-0 truncate`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? "+" : ""}{deltaUnit === "%" ? delta!.toFixed(0) : delta!.toFixed(0)}{deltaUnit}
              <span className="text-muted-foreground font-normal ml-1 truncate">{deltaLabel}</span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate">{hint ?? " "}</span>
          )}
          <span className="inline-flex items-center gap-0.5 text-muted-foreground/70 group-hover:text-foreground transition-colors shrink-0">
            상세 <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

/* ───────────────────────── Top Renters ───────────────────────── */

function TopRentersCard({ renters }: { renters: { name: string; count: number; isNew: boolean }[] }) {
  const nav = useNavigate();
  const max = renters.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4" /> 주요 렌탈 고객사 TOP 5
          </h2>
          <Link to="/my/renters" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
            전체 보기 <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {renters.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">렌탈 중인 거래처 없음</div>
        ) : (
          <div className="space-y-2">
            {renters.map((r, i) => (
              <button
                key={r.name}
                onClick={() => nav({ to: "/my/renters" })}
                className="w-full text-left group/row space-y-1 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2 inline-flex items-center gap-2">
                    <span className="w-5 text-muted-foreground tabular-nums text-xs">{i + 1}.</span>
                    <span className="font-medium truncate">{r.name}</span>
                    {r.isNew && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700">NEW</span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums text-sm shrink-0">{r.count.toLocaleString()}대</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${max ? (r.count / max) * 100 : 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Sheets ───────────────────────── */

function DrillSheet({ open, onClose, title, desc, children }: {
  open: boolean; onClose: () => void; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {desc && <SheetDescription>{desc}</SheetDescription>}
        </SheetHeader>
        <div className="mt-6 space-y-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, color, dim }: { label: React.ReactNode; value: string | number; color?: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="inline-flex items-center gap-2 text-sm">
        {color && <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
        <span className={dim ? "text-muted-foreground" : ""}>{label}</span>
      </span>
      <span className="font-medium tabular-nums text-sm">{value}</span>
    </div>
  );
}

function SectionHead({ icon, title, total }: { icon: React.ReactNode; title: string; total?: number }) {
  return (
    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-1">
      <span className="inline-flex items-center gap-1.5">{icon}{title}</span>
      {typeof total === "number" && <span className="tabular-nums">합계 {total.toLocaleString()}대</span>}
    </div>
  );
}

function AssetSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: any }) {
  const r = data?.rental, s = data?.stock, t = data?.inTransit;
  const sizes: { size: string; count: number }[] = data?.sizes ?? [];
  const maxSize = sizes.reduce((m, x) => Math.max(m, x.count), 0);
  return (
    <DrillSheet open={open} onClose={onClose} title="자산운용 세부" desc={`총 보유 ${(data?.total ?? 0).toLocaleString()}대 기준`}>
      <div>
        <SectionHead icon={<Building2 className="w-3.5 h-3.5" />} title="렌탈" total={r?.total} />
        <div className="rounded-lg border bg-card/50 p-3 divide-y">
          <Row label="전선사" value={`${r?.wire ?? 0}대`} color="oklch(0.62 0.13 265)" />
          <Row label="고객사" value={`${r?.customer ?? 0}대`} color="oklch(0.65 0.12 230)" />
          <Row label="미지정" value={`${r?.unknown ?? 0}대`} color="oklch(0.60 0.04 280)" dim />
        </div>
      </div>
      <div>
        <SectionHead icon={<Warehouse className="w-3.5 h-3.5" />} title="보유 재고" total={s?.total} />
        <div className="rounded-lg border bg-card/50 p-3 divide-y">
          <Row label="본사" value={`${s?.hq ?? 0}대`} color="oklch(0.62 0.10 150)" />
          <Row label="물류센터" value={`${s?.logistics ?? 0}대`} color="oklch(0.65 0.10 60)" />
          <Row label="기타" value={`${s?.other ?? 0}대`} color="oklch(0.60 0.04 280)" dim />
        </div>
      </div>
      <div>
        <SectionHead icon={<Truck className="w-3.5 h-3.5" />} title="미착 재고 (회수대상)" total={t?.total} />
        <div className="rounded-lg border bg-card/50 p-3 divide-y">
          <Row label="사용완료예상" value={`${t?.expected_complete ?? 0}대`} color="oklch(0.70 0.12 80)" />
          <Row label="회수예정" value={`${t?.scheduled_return ?? 0}대`} color="oklch(0.68 0.13 50)" />
          <Row label="회수대기" value={`${t?.awaiting_return ?? 0}대`} color="oklch(0.65 0.15 20)" />
        </div>
      </div>
      <div>
        <SectionHead icon={<Ruler className="w-3.5 h-3.5" />} title="사이즈별 보유" total={data?.total} />
        <div className="rounded-lg border bg-card/50 p-3 space-y-2">
          {sizes.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-3">데이터 없음</div>
          ) : sizes.map((x) => (
            <div key={x.size} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{x.size}</span>
                <span className="tabular-nums text-muted-foreground">
                  {x.count.toLocaleString()}대
                  <span className="ml-2 text-xs">({((x.count / (data?.total || 1)) * 100).toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${maxSize ? (x.count / maxSize) * 100 : 0}%`, background: "oklch(0.62 0.10 250)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DrillSheet>
  );
}

function MonthSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: any }) {
  const m = data?.month;
  const up = (m?.deltaPct ?? 0) >= 0;
  return (
    <DrillSheet open={open} onClose={onClose} title="이번 달 신규 렌탈" desc="월별 업로드 데이터 기준">
      <div className="rounded-lg border bg-card/50 p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold tabular-nums">{m?.newRentals ?? 0}</span>
          <span className="text-muted-foreground">건</span>
        </div>
        <div className={`text-sm inline-flex items-center gap-1 ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          전월 대비 {up ? "+" : ""}{(m?.deltaPct ?? 0).toFixed(1)}%
          <span className="text-muted-foreground ml-1">(전월 {m?.prevNewRentals ?? 0}건)</span>
        </div>
        <div className="text-sm text-muted-foreground pt-2 border-t space-y-1">
          <div>이번 달 회수: <span className="font-medium text-foreground tabular-nums">{m?.returns ?? 0}건</span> <span className="text-xs">(전월 {m?.prevReturns ?? 0}건)</span></div>
          <div>순흐름: <span className="font-medium text-foreground tabular-nums">{((m?.newRentals ?? 0) - (m?.returns ?? 0)).toLocaleString()}건</span></div>
          <div>렌탈비율: <span className="font-medium text-foreground tabular-nums">{((m?.rentalRate ?? 0) * 100).toFixed(1)}%</span>
            <span className="text-xs ml-1">(전월 {((m?.prevRentalRate ?? 0) * 100).toFixed(1)}%, {(m?.rentalRateDeltaPp ?? 0) >= 0 ? "+" : ""}{(m?.rentalRateDeltaPp ?? 0).toFixed(1)}%p)</span>
          </div>
        </div>
      </div>
      <Link to="/my/trends" className="block text-center text-sm text-primary hover:underline">
        월별 추이 자세히 보기 →
      </Link>
    </DrillSheet>
  );
}

function TurnoverSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: any }) {
  const annual = data?.annualTurnover ?? 0;
  const ratio = annual / 4; // 기준선 4.0회
  return (
    <DrillSheet open={open} onClose={onClose} title="연간 누적 회전율" desc="최근 12개월 신규 렌탈 ÷ 현재 총 보유">
      <div className="rounded-lg border bg-card/50 p-4 space-y-2">
        <div className="font-display text-4xl font-semibold tabular-nums">{annual.toFixed(2)}<span className="text-base text-muted-foreground ml-1">회</span></div>
        <div className="text-sm text-muted-foreground">
          최근 12개월 신규 <span className="font-medium text-foreground tabular-nums">{data?.yearNewRentals ?? 0}</span>건 ÷
          총 보유 <span className="font-medium text-foreground tabular-nums">{(data?.total ?? 0).toLocaleString()}</span>대
        </div>
      </div>
      <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3 leading-relaxed">
        평균 대여기간이 3개월이므로 <span className="font-semibold text-foreground">연간 기준선 4.0회</span>가 이상치입니다.
        현재 {annual.toFixed(2)}회는 기준선 대비 <span className={`font-semibold ${ratio >= 1 ? "text-emerald-600" : "text-rose-600"}`}>
        {ratio >= 1 ? "+" : ""}{((ratio - 1) * 100).toFixed(0)}%</span> 수준입니다.
      </div>
      <Link to="/my/trends" className="block text-center text-sm text-primary hover:underline">
        분기별 회전율 추이 보기 →
      </Link>
    </DrillSheet>
  );
}

function AvgDaysSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: any }) {
  const m = data?.month;
  const days = m?.avgRentalDays ?? 0;
  const prev = m?.prevAvgRentalDays ?? 0;
  const delta = m?.avgDaysDelta ?? 0;
  const longer = delta > 0;
  return (
    <DrillSheet open={open} onClose={onClose} title="평균 대여기간" desc="현재 렌탈 중인 자산의 평균 보유일">
      <div className="rounded-lg border bg-card/50 p-4 space-y-2">
        <div className="font-display text-4xl font-semibold tabular-nums">{days.toLocaleString()}<span className="text-base text-muted-foreground ml-1">일</span></div>
        <div className={`text-sm inline-flex items-center gap-1 ${longer ? "text-rose-600" : "text-emerald-600"}`}>
          {longer ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          전월 대비 {longer ? "+" : ""}{delta}일
          <span className="text-muted-foreground ml-1">(전월 {prev}일)</span>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t">현재 렌탈 {data?.rental?.total ?? 0}대 평균</div>
      </div>
      <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3 leading-relaxed">
        평균 90일(3개월)을 기준으로 길어질수록 자산 회수 주기가 늘어집니다.
      </div>
    </DrillSheet>
  );
}

function NewRentersSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: any }) {
  const list: { name: string; firstAt: string }[] = data?.newRenters ?? [];
  return (
    <DrillSheet open={open} onClose={onClose} title="신규 거래처" desc="전월 스냅샷 대비 신규 등장">
      <div className="rounded-lg border bg-card/50 divide-y">
        {list.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center flex flex-col items-center gap-2">
            <PackageX className="w-5 h-5" /> 신규 거래처 없음
          </div>
        ) : list.map((r) => (
          <div key={r.name} className="flex items-center justify-between px-3 py-2.5">
            <span className="font-medium text-sm truncate">{r.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {new Date(r.firstAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        ))}
      </div>
      <Link to="/my/renters" className="block text-center text-sm text-primary hover:underline">
        거래처 전체 보기 →
      </Link>
    </DrillSheet>
  );
}
