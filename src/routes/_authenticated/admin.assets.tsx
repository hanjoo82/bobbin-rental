import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { assetMatrix } from "@/lib/dashboard.functions";
import { useOwnerScope } from "@/lib/owner-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/assets")({
  component: AssetsPage,
});

type MatrixRow = {
  owner_id: string;
  owner_name: string;
  bySize: Record<string, number>;
  total: number;
  rentalCount: number;
  rentalRate: number;
};

function rentalRateClass(rate: number) {
  if (rate >= 50) return "text-emerald-600";
  if (rate >= 30) return "text-amber-600";
  return "text-muted-foreground";
}

function RentalRateBadge({ rate }: { rate: number }) {
  return (
    <span className={`shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums ${rentalRateClass(rate)}`}>
      {rate.toFixed(1)}%
    </span>
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

function darkRentalRateBadge(rate: number) {
  const cls =
    rate >= 50 ? "bg-emerald-400/20 text-emerald-200" :
    rate >= 30 ? "bg-amber-400/20 text-amber-200" :
    "bg-white/10 text-white/70";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm md:text-base font-semibold tabular-nums ${cls}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

function AssetsPage() {
  const { ownerId, label } = useOwnerScope();
  const fetchMatrix = useServerFn(assetMatrix);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-asset-matrix", ownerId ?? "all"],
    queryFn: () => fetchMatrix({ data: { owner_id: ownerId } }),
  });

  const sizes = data?.sizes ?? [];
  const rows = (data?.rows ?? []) as MatrixRow[];
  const totals = data?.totals;

  const totalAll = totals?.total ?? 0;
  const totalRental = totals?.rentalCount ?? 0;
  const rentalRate = totals?.rentalRate ?? 0;
  const idleCount = totalAll - totalRental;
  const topSize =
    totals && sizes.length > 0
      ? sizes.reduce((best, s) => ((totals.bySize[s] ?? 0) > (totals.bySize[best] ?? 0) ? s : best), sizes[0])
      : "—";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[oklch(0.18_0.02_265)] text-white shadow-[0_30px_80px_-30px_oklch(0.45_0.18_265/0.45)]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.22 280) 0%, transparent 60%)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 w-[360px] h-[360px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, oklch(0.70 0.18 220) 0%, transparent 60%)" }}
        />

        <div className="relative p-6 md:p-10 space-y-6 md:space-y-8">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60 mb-2">자산 포트폴리오</div>
            {isLoading ? (
              <div className="text-white/50 text-sm">불러오는 중...</div>
            ) : (
              <>
                <h1 className="font-display text-2xl md:text-4xl font-semibold leading-tight">
                  <span className="tabular-nums">{totalAll.toLocaleString()}</span>
                  <span className="text-white/70 font-normal text-lg md:text-2xl"> 대 보유</span>
                  <span className="text-white/30 mx-2">·</span>
                  <span className="tabular-nums">{totalRental.toLocaleString()}</span>
                  <span className="text-white/70 font-normal text-lg md:text-2xl"> 대 렌탈</span>
                </h1>
                <p className="text-sm text-white/45 mt-2 break-keep">{label} · 소유주별 × 사이즈별 보유수량</p>
              </>
            )}
          </div>
          {!isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8 md:max-w-2xl">
              <DarkMetric label="렌탈비율" valueNode={darkRentalRateBadge(rentalRate)} hint="전체 기준" />
              <DarkMetric label="소유주" value={`${rows.length}`} hint={ownerId ? "선택 범위" : "전체"} />
              <DarkMetric label="사이즈 종류" value={`${sizes.length}`} hint="보유 SKU" />
              <DarkMetric label="미렌탈" value={idleCount.toLocaleString()} hint={`주력 ${topSize}`} />
            </div>
          )}
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">매트릭스</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center px-4">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center px-4">데이터가 없습니다.</div>
          ) : (
            <>
              {/* Mobile: compact cards — no horizontal table scroll */}
              <div className="md:hidden space-y-3 px-4 pb-4">
                {rows.map((r) => (
                  <div key={r.owner_id} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-sm leading-snug min-w-0">{r.owner_name}</h3>
                      <RentalRateBadge rate={r.rentalRate} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sizes.map((s) => (
                        <div
                          key={s}
                          className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2 min-w-0"
                        >
                          <span className="text-[11px] text-muted-foreground truncate">{s}</span>
                          <span className="text-sm font-medium tabular-nums shrink-0">
                            {r.bySize[s] ? r.bySize[s].toLocaleString() : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                      <span>
                        합계 <strong className="text-foreground tabular-nums ml-1">{r.total.toLocaleString()}</strong>
                      </span>
                      <span>
                        렌탈 <strong className="text-foreground tabular-nums ml-1">{r.rentalCount.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                ))}

                {totals && (
                  <div className="rounded-2xl border-2 border-primary/15 bg-muted/40 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-sm">총합계</span>
                      <RentalRateBadge rate={totals.rentalRate} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sizes.map((s) => (
                        <div
                          key={s}
                          className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-3 py-2"
                        >
                          <span className="text-[11px] text-muted-foreground truncate">{s}</span>
                          <span className="text-sm font-semibold tabular-nums shrink-0">
                            {(totals.bySize[s] ?? 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs">
                      <span>
                        합계 <strong className="tabular-nums ml-1">{totals.total.toLocaleString()}</strong>
                      </span>
                      <span>
                        렌탈 <strong className="tabular-nums ml-1">{totals.rentalCount.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: full matrix table */}
              <div className="hidden md:block overflow-x-auto overscroll-x-contain">
                <table className="w-max min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 z-20 bg-muted/50 text-left p-3 font-medium min-w-[9rem] whitespace-nowrap border-r border-border">
                        소유주
                      </th>
                      {sizes.map((s) => (
                        <th key={s} className="text-right p-3 font-medium whitespace-nowrap min-w-[4.5rem]">
                          {s}
                        </th>
                      ))}
                      <th className="text-right p-3 font-medium whitespace-nowrap min-w-[3rem] border-l">합계</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap min-w-[3.25rem]">렌탈수</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap min-w-[3.75rem]">렌탈비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.owner_id} className="group border-b hover:bg-muted/30">
                        <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 p-3 font-medium min-w-[9rem] whitespace-nowrap border-r border-border">
                          {r.owner_name}
                        </td>
                        {sizes.map((s) => (
                          <td key={s} className="text-right p-3 tabular-nums text-muted-foreground whitespace-nowrap">
                            {r.bySize[s] ? r.bySize[s].toLocaleString() : "—"}
                          </td>
                        ))}
                        <td className="text-right p-3 tabular-nums font-medium border-l whitespace-nowrap">
                          {r.total.toLocaleString()}
                        </td>
                        <td className="text-right p-3 tabular-nums text-muted-foreground whitespace-nowrap">
                          {r.rentalCount.toLocaleString()}
                        </td>
                        <td className={`text-right p-3 tabular-nums font-semibold whitespace-nowrap ${rentalRateClass(r.rentalRate)}`}>
                          {r.rentalRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/60 font-semibold">
                        <td className="sticky left-0 z-10 bg-muted/60 p-3 whitespace-nowrap min-w-[9rem] border-r border-border">
                          총합계
                        </td>
                        {sizes.map((s) => (
                          <td key={s} className="text-right p-3 tabular-nums whitespace-nowrap">
                            {(totals.bySize[s] ?? 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="text-right p-3 tabular-nums border-l whitespace-nowrap">
                          {totals.total.toLocaleString()}
                        </td>
                        <td className="text-right p-3 tabular-nums whitespace-nowrap">
                          {totals.rentalCount.toLocaleString()}
                        </td>
                        <td className="text-right p-3 tabular-nums whitespace-nowrap">
                          {totals.rentalRate.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground px-1">
        * 렌탈비율 = 현재 상태가 "렌탈"인 자산수 ÷ 보유 총수량. 월말 스냅샷 기준이므로 이번달 운영 상태를 나타냅니다.
      </p>
    </div>
  );
}
