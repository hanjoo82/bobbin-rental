import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { assetMatrix } from "@/lib/dashboard.functions";
import { useOwnerScope } from "@/lib/owner-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/assets")({
  component: AssetsPage,
});

function AssetsPage() {
  const { ownerId, label } = useOwnerScope();
  const fetchMatrix = useServerFn(assetMatrix);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-asset-matrix", ownerId ?? "all"],
    queryFn: () => fetchMatrix({ data: { owner_id: ownerId } }),
  });

  const sizes = data?.sizes ?? [];
  const rows = data?.rows ?? [];
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
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center px-4">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center px-4">데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-max min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-20 bg-muted/50 text-left px-3 py-2.5 sm:p-3 font-medium min-w-[7.5rem] sm:min-w-[9rem] whitespace-nowrap border-r border-border">
                      소유주
                    </th>
                    {sizes.map((s) => (
                      <th key={s} className="text-right px-2 py-2.5 sm:px-3 sm:p-3 font-medium whitespace-nowrap min-w-[3.5rem] sm:min-w-[4.5rem]">
                        {s}
                      </th>
                    ))}
                    <th className="text-right px-2 py-2.5 sm:px-3 sm:p-3 font-medium whitespace-nowrap min-w-[3rem] border-l">합계</th>
                    <th className="text-right px-2 py-2.5 sm:px-3 sm:p-3 font-medium whitespace-nowrap min-w-[3.25rem]">렌탈수</th>
                    <th className="text-right px-3 py-2.5 sm:p-3 font-medium whitespace-nowrap min-w-[3.75rem]">렌탈비율</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.owner_id} className="group border-b hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-3 py-2.5 sm:p-3 font-medium min-w-[7.5rem] sm:min-w-[9rem] max-w-[11rem] whitespace-nowrap border-r border-border">
                        {r.owner_name}
                      </td>
                      {sizes.map((s) => (
                        <td key={s} className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums text-muted-foreground whitespace-nowrap">
                          {r.bySize[s] ? r.bySize[s].toLocaleString() : "—"}
                        </td>
                      ))}
                      <td className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums font-medium border-l whitespace-nowrap">
                        {r.total.toLocaleString()}
                      </td>
                      <td className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums text-muted-foreground whitespace-nowrap">
                        {r.rentalCount.toLocaleString()}
                      </td>
                      <td className="text-right px-3 py-2.5 sm:p-3 tabular-nums font-semibold whitespace-nowrap">
                        <span className={r.rentalRate >= 50 ? "text-emerald-600" : r.rentalRate >= 30 ? "text-amber-600" : "text-muted-foreground"}>
                          {r.rentalRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/60 font-semibold">
                      <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2.5 sm:p-3 whitespace-nowrap min-w-[7.5rem] sm:min-w-[9rem] border-r border-border">
                        총합계
                      </td>
                      {sizes.map((s) => (
                        <td key={s} className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums whitespace-nowrap">
                          {(totals.bySize[s] ?? 0).toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums border-l whitespace-nowrap">
                        {totals.total.toLocaleString()}
                      </td>
                      <td className="text-right px-2 py-2.5 sm:px-3 sm:p-3 tabular-nums whitespace-nowrap">
                        {totals.rentalCount.toLocaleString()}
                      </td>
                      <td className="text-right px-3 py-2.5 sm:p-3 tabular-nums whitespace-nowrap">
                        {totals.rentalRate.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          {rows.length > 0 && sizes.length > 2 && (
            <p className="sm:hidden px-4 pb-3 pt-2 text-[11px] text-muted-foreground">
              ← 좌우로 스크롤하면 사이즈·합계 열을 볼 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * 렌탈비율 = 현재 상태가 "렌탈"인 자산수 ÷ 보유 총수량. 월말 스냅샷 기준이므로 이번달 운영 상태를 나타냅니다.
      </p>
    </div>
  );
}
