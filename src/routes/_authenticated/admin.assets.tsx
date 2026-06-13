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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-semibold">자산현황</h1>
          <p className="text-sm text-muted-foreground mt-1 break-keep">
            {label} · 소유주별 × 사이즈별 보유수량 및 이번달 렌탈비율
          </p>
        </div>
        {totals && (
          <div className="flex sm:block items-baseline gap-2 sm:text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">전체 렌탈비율</div>
            <div className="font-display text-2xl font-semibold tabular-nums">
              {totals.rentalRate.toFixed(1)}<span className="text-base text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>

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
