import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { renterProfiles, regionBreakdown } from "@/lib/insights.functions";
import { useOwnerScope } from "@/lib/owner-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Sparkles, AlertCircle, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my/renters")({
  component: MyRenters,
});



export function MyRenters() {
  const [tab, setTab] = useState("renters");
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="renters"><Building2 className="w-4 h-4 mr-1.5" />거래처현황</TabsTrigger>
          <TabsTrigger value="region"><MapPin className="w-4 h-4 mr-1.5" />지역현황</TabsTrigger>
        </TabsList>
        <TabsContent value="renters" className="mt-4"><RentersPanel /></TabsContent>
        <TabsContent value="region" className="mt-4"><RegionPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function RentersPanel() {
  const fetch = useServerFn(renterProfiles);
  const { ownerId } = useOwnerScope();
  const { data, isLoading } = useQuery({
    queryKey: ["my-renter-profiles-v2", ownerId ?? "all"],
    queryFn: () => fetch({ data: ownerId ? { owner_id: ownerId } : {} }),
  });

  const profiles = data?.profiles ?? [];
  const totalRentals = data?.totalRentals ?? 0;
  const totalRenters = data?.totalRenters ?? 0;
  const top3 = (data?.top3Share ?? 0) * 100;
  const hhi = (data?.hhi ?? 0) * 10000;
  const concentration = hhi > 2500 ? "높음" : hhi > 1500 ? "중간" : "낮음";
  const prevLabel = data?.compareMonths?.previous
    ? `${Number(data.compareMonths.previous.slice(5))}월`
    : "전월";
  const curLabel = data?.compareMonths?.current
    ? `${Number(data.compareMonths.current.slice(5))}월`
    : "이번달";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[oklch(0.18_0.02_265)] text-white shadow-[0_30px_80px_-30px_oklch(0.45_0.18_265/0.45)]">
        <div aria-hidden className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div aria-hidden className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.22 280) 0%, transparent 60%)" }} />
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[360px] h-[360px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, oklch(0.70 0.18 220) 0%, transparent 60%)" }} />

        <div className="relative p-6 md:p-10 space-y-6 md:space-y-8">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60 mb-2">거래처 포트폴리오</div>
            <h1 className="font-display text-2xl md:text-4xl font-semibold leading-tight">
              <span className="tabular-nums">{totalRenters}</span>
              <span className="text-white/70 font-normal text-lg md:text-2xl"> 개 거래처</span>
              <span className="text-white/30 mx-2">·</span>
              <span className="tabular-nums">{totalRentals.toLocaleString()}</span>
              <span className="text-white/70 font-normal text-lg md:text-2xl"> 대 렌탈</span>
            </h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8 md:max-w-2xl">
            <DarkMetric label="TOP 3 점유" value={`${top3.toFixed(0)}%`} hint="상위 비중" />
            <DarkMetric
              label="집중도"
              valueNode={
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm md:text-base font-semibold ${
                  hhi > 2500 ? "bg-rose-400/20 text-rose-200" :
                  hhi > 1500 ? "bg-amber-400/20 text-amber-200" :
                  "bg-emerald-400/20 text-emerald-200"
                }`}>{concentration}</span>
              }
              hint="상위 쏠림"
            />
            <DarkMetric label="신규 거래처" value={`${data?.newCustomers ?? 0}`} hint={`${prevLabel}→${curLabel}`} />
            <DarkMetric
              label="미지정 렌탈"
              value={`${(data?.unnamedRentals ?? 0).toLocaleString()}`}
              hint="거래처 미입력"
            />
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="w-4 h-4" /> 거래처 구성</CardTitle>
        </CardHeader>
        <CardContent>
          <SegmentBar
            segments={[
              { label: "기존 거래처", value: data?.longCustomers ?? 0, color: "oklch(0.55 0.18 265)" },
              { label: `신규 (${prevLabel}→${curLabel})`, value: data?.newCustomers ?? 0, color: "oklch(0.72 0.18 200)" },
            ]}
          />
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4" /> 거래처별 프로파일
          </h2>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-10 text-center">로딩 중…</div>
        ) : profiles.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="w-5 h-5" /> 렌탈 중인 거래처가 없습니다.
          </CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profiles.map((p, i) => {
              const share = totalRentals > 0 ? (p.count / totalRentals) * 100 : 0;
              const isTop = i < 3;
              return (
                <Card key={p.name} className={isTop ? "ring-1 ring-primary/30" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isTop && <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">#{i + 1}</span>}
                          {p.isNew && <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">신규</span>}
                          <h3 className="font-semibold truncate">{p.name}</h3>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          첫 거래 {p.firstSeen ? new Date(p.firstSeen).toLocaleDateString("ko-KR") : "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-display font-semibold tabular-nums leading-none">{p.count}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{share.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Tile label="평균 보유" value={`${p.avgDays}일`} />
                      <Tile label="주력 사이즈" value={p.topSize} />
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RegionPanel() {
  const fetch = useServerFn(regionBreakdown);
  const { ownerId } = useOwnerScope();
  const { data, isLoading } = useQuery({
    queryKey: ["my-region-breakdown", ownerId ?? "all"],
    queryFn: () => fetch({ data: ownerId ? { owner_id: ownerId } : {} }),
  });

  const regions = data?.regions ?? [];
  const maxRental = Math.max(1, ...regions.map((r) => r.rental));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="w-4 h-4" /> 시·도별 렌탈현황</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">로딩 중…</div>
          ) : regions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">데이터 없음</div>
          ) : (
            <div className="space-y-2.5">
              {regions.map((r) => (
                <div key={r.sido} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{r.sido}</span>
                    <span className="font-medium tabular-nums">{r.rental.toLocaleString()}대</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.rental / maxRental) * 100}%`, background: "oklch(0.65 0.15 240)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DarkMetric({ label, value, valueNode, hint }: { label: string; value?: string; valueNode?: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-display font-semibold tabular-nums leading-tight text-white">
        {valueNode ?? value}
      </div>
      {hint && <div className="text-[11px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums truncate">{value}</div>
    </div>
  );
}

function SegmentBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="text-sm text-muted-foreground">데이터 없음</div>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}개</span>
            <span className="text-xs text-muted-foreground">({((s.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
