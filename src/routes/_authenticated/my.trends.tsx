import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { trendsExtended } from "@/lib/insights.functions";
import { useOwnerScope } from "@/lib/owner-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ReferenceLine, LineChart, Line, ComposedChart, Bar,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, Package, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my/trends")({
  component: MyTrendsPage,
});



const COLOR_RENTAL = "oklch(0.62 0.20 265)";
const COLOR_STOCK = "oklch(0.68 0.14 200)";
const COLOR_NEW = "oklch(0.70 0.16 145)";

const CHART_MARGIN = { top: 8, right: 16, left: 4, bottom: 0 };
const DUAL_AXIS_MARGIN = { top: 8, right: 16, left: 8, bottom: 0 };
const Y_AXIS_WIDTH = 44;

// "2026-06" → "6월" (첫 표시 또는 1월에는 "26/6"로 연도 표기)
const makeTickFmt = (firstKey?: string) => (v: string) => {
  const [y, m] = v.split("-");
  const mn = Number(m);
  if (v === firstKey || mn === 1) return `${y.slice(2)}/${mn}`;
  return `${mn}월`;
};

export function MyTrendsPage() {
  const fetch = useServerFn(trendsExtended);
  const { ownerId } = useOwnerScope();
  const { data, isLoading } = useQuery({
    queryKey: ["my-trends-ext-v4", ownerId ?? "all"],
    queryFn: () => fetch({ data: { months: 12, ...(ownerId ? { owner_id: ownerId } : {}) } }),
  });

  const months = data?.months ?? [];
  const s = data?.summary;
  
  const tickFmt = makeTickFmt(months[0]?.month);

  const rentalPrev = (s?.currentRentalRate ?? 0) - (s?.rentalRateMoM ?? 0);
  const stockPrev = (s?.currentStockRate ?? 0) - (s?.stockRateMoM ?? 0);
  const newPrev = (s?.currentNewRenters ?? 0) - (s?.newRentersMoM ?? 0);

  return (
    <div className="space-y-6">
      {/* 히어로 — 대시보드와 통일 (도트 + 듀얼 글로우) */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[oklch(0.18_0.02_265)] text-white shadow-[0_30px_80px_-30px_oklch(0.45_0.18_265/0.45)] p-5 md:p-6">
        <div aria-hidden className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div aria-hidden className="absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.60 0.16 270) 0%, transparent 60%)" }} />
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.13 210) 0%, transparent 60%)" }} />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <Sparkles className="w-3 h-3" />
            <span className="truncate">{s?.insight ?? "최근 12개월 추이"}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="렌탈비율" value={`${(s?.currentRentalRate ?? 0).toFixed(1)}%`} prev={`${rentalPrev.toFixed(1)}%`} delta={s?.rentalRateMoM ?? 0} unit="%p" />
            <MiniStat label="재고비율" value={`${(s?.currentStockRate ?? 0).toFixed(1)}%`} prev={`${stockPrev.toFixed(1)}%`} delta={s?.stockRateMoM ?? 0} unit="%p" invertColor />
            <MiniStat label="신규거래처" value={`${s?.currentNewRenters ?? 0}`} prev={`${newPrev}`} delta={s?.newRentersMoM ?? 0} unit="" />
          </div>
        </div>
      </section>

      {/* 1. 월별 렌탈비율 변동 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" style={{ color: COLOR_RENTAL }} /> 월별 렌탈비율 변동 추이
          </CardTitle>
          <p className="text-xs text-muted-foreground">최근 12개월 · 평균 {s?.avgRentalRate ?? 0}%</p>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? <Loading /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={tickFmt} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={["auto", "auto"]} width={Y_AXIS_WIDTH} tickMargin={4} />
                <Tooltip formatter={(v: any) => [`${v}%`, "렌탈비율"]} />
                <ReferenceLine y={s?.avgRentalRate ?? 0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="rentalRate" stroke={COLOR_RENTAL} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2. 월별 재고비율 변동 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4" style={{ color: COLOR_STOCK }} /> 월별 재고비율 변동 추이
          </CardTitle>
          <p className="text-xs text-muted-foreground">재고 + 회수대상 합산 비율</p>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? <Loading /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="gStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_STOCK} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={COLOR_STOCK} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={tickFmt} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} unit="%" width={Y_AXIS_WIDTH} tickMargin={4} />
                <Tooltip formatter={(v: any) => [`${v}%`, "재고비율"]} />
                <Area type="monotone" dataKey="stockRate" stroke={COLOR_STOCK} strokeWidth={2.5} fill="url(#gStock)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 3. 신규 거래처 증감 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" /> 신규 거래처 증감 추이
          </CardTitle>
          <p className="text-xs text-muted-foreground">월별 신규 · 누적 거래처 수</p>
        </CardHeader>
        <CardContent className="h-72">
          {isLoading ? <Loading /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months} margin={DUAL_AXIS_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={tickFmt} interval="preserveStartEnd" minTickGap={16} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} width={Y_AXIS_WIDTH} tickMargin={4} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} width={Y_AXIS_WIDTH} tickMargin={4} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="newRenters" name="신규 거래처" radius={[4, 4, 0, 0]} fill={COLOR_NEW} />
                <Line yAxisId="right" type="monotone" dataKey="cumulativeRenters" name="누적 거래처" stroke="oklch(0.55 0.18 280)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Loading() {
  return <div className="h-full grid place-items-center text-muted-foreground text-sm">불러오는 중…</div>;
}

function MiniStat({ label, value, prev, delta, unit, invertColor }: {
  label: string; value: string; prev: string; delta: number; unit: string; invertColor?: boolean;
}) {
  const positive = delta > 0;
  const neutral = delta === 0;
  const good = invertColor ? delta < 0 : positive;
  const color = neutral ? "text-white/40" : good ? "text-emerald-300" : "text-rose-300";
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/50 mb-1 truncate">{label}</div>
      <div className="font-display text-xl md:text-2xl font-semibold tabular-nums leading-tight">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-[11px] ${color}`}>
        <Icon className="w-3 h-3 shrink-0" />
        <span className="tabular-nums">{positive ? "+" : ""}{delta}{unit}</span>
        <span className="text-white/35 truncate">· 전월 {prev}</span>
      </div>
    </div>
  );
}
