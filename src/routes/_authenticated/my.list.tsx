import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listProducts } from "@/lib/products.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL, STATUS_COLOR, type StatusCategory, displayStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/my/list")({
  component: MyList,
});

function MyList() {
  const fetchProducts = useServerFn(listProducts);
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const { data: products } = useQuery({
    queryKey: ["my-products", status],
    queryFn: () => fetchProducts({ data: { status: status === "all" ? undefined : (status as any) } }),
  });

  const filtered = (products ?? []).filter((p: any) =>
    !q || p.product_no.toLowerCase().includes(q.toLowerCase()) || (p.address ?? "").includes(q),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">제품 목록</h1>
      <Card>
        <CardContent className="pt-6 grid md:grid-cols-2 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {(Object.keys(STATUS_LABEL) as StatusCategory[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="제품번호/주소 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{filtered.length}건</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr><th className="text-left p-2">제품번호</th><th className="text-left p-2">사이즈</th><th className="text-left p-2">상태</th><th className="text-left p-2">주소</th></tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{p.product_no}</td>
                    <td className="p-2">{p.bobbin_size}</td>
                    <td className="p-2"><span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: STATUS_COLOR[p.status_category as StatusCategory] }}>{displayStatus(p)}</span></td>
                    <td className="p-2">{p.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
