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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">자산현황</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {label} · 소유주별 × 사이즈별 보유수량 및 이번달 렌탈비율
          </p>
        </div>
        {totals && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">전체 렌탈비율</div>
            <div className="font-display text-2xl font-semibold tabular-nums">
              {totals.rentalRate.toFixed(1)}<span className="text-base text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">매트릭스</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">소유주</th>
                    {sizes.map((s) => (
                      <th key={s} className="text-right p-3 font-medium whitespace-nowrap">{s}</th>
                    ))}
                    <th className="text-right p-3 font-medium border-l">합계</th>
                    <th className="text-right p-3 font-medium">렌탈수</th>
                    <th className="text-right p-3 font-medium">렌탈비율</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.owner_id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{r.owner_name}</td>
                      {sizes.map((s) => (
                        <td key={s} className="text-right p-3 tabular-nums text-muted-foreground">
                          {r.bySize[s] ? r.bySize[s].toLocaleString() : "—"}
                        </td>
                      ))}
                      <td className="text-right p-3 tabular-nums font-medium border-l">
                        {r.total.toLocaleString()}
                      </td>
                      <td className="text-right p-3 tabular-nums text-muted-foreground">
                        {r.rentalCount.toLocaleString()}
                      </td>
                      <td className="text-right p-3 tabular-nums font-semibold">
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
                      <td className="p-3">총합계</td>
                      {sizes.map((s) => (
                        <td key={s} className="text-right p-3 tabular-nums">
                          {(totals.bySize[s] ?? 0).toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right p-3 tabular-nums border-l">
                        {totals.total.toLocaleString()}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {totals.rentalCount.toLocaleString()}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {totals.rentalRate.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * 렌탈비율 = 현재 상태가 "렌탈"인 자산수 ÷ 보유 총수량. 월말 스냅샷 기준이므로 이번달 운영 상태를 나타냅니다.
      </p>
    </div>
  );
}
