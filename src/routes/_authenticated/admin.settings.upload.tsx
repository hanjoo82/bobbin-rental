import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { listOwners, countOwnerProducts } from "@/lib/admin.functions";
import { uploadBatch } from "@/lib/upload.functions";
import { parseStatus } from "@/lib/status";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings/upload")({
  component: UploadPage,
});

interface PreviewRow {
  serial_no: number;
  product_no: string;
  bobbin_size: string | null;
  address: string | null;
  status_category: string;
  status_raw: string;
  renter_name: string | null;
  stock_location: string | null;
}

function UploadPage() {
  const fetchOwners = useServerFn(listOwners);
  const fetchAssetCount = useServerFn(countOwnerProducts);
  const upload = useServerFn(uploadBatch);
  const { data: owners } = useQuery({ queryKey: ["owners"], queryFn: () => fetchOwners() });

  const [ownerId, setOwnerId] = useState("");
  const [fileName, setFileName] = useState("");
  const [periodMonth, setPeriodMonth] = useState(() => {
    // 기본값: 이번달 (월말 운영 기준)
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: assetCountData, isFetching: assetCountLoading, refetch: refetchAssetCount } = useQuery({
    queryKey: ["owner-product-count", ownerId, periodMonth],
    queryFn: () => fetchAssetCount({ data: { owner_id: ownerId, period_month: periodMonth } }),
    enabled: !!ownerId,
  });
  const heldAssets = assetCountData?.count ?? 0;
  const prevMonthCount = assetCountData?.previous_count ?? 0;
  const prevMonthKey = assetCountData?.previous_month;
  const prevMonthLabel = prevMonthKey ? `${Number(prevMonthKey.slice(5))}월` : "전월";
  const excelRows = rows.length;
  const uniqueExcel = new Set(rows.map((r) => r.product_no)).size;
  const compareReady = !!ownerId && excelRows > 0 && !assetCountLoading && prevMonthKey != null;
  const vsPrevDelta = uniqueExcel - prevMonthCount;

  function detectPeriodFromName(name: string): string | null {
    let m = name.match(/(20\d{2})[-_.\s]?(0[1-9]|1[0-2])/);
    if (m) return `${m[1]}-${m[2]}`;
    m = name.match(/(20\d{2})(0[1-9]|1[0-2])/);
    if (m) return `${m[1]}-${m[2]}`;
    m = name.match(/(\d{1,2})\s*월/);
    if (m) {
      const mm = String(Math.max(1, Math.min(12, Number(m[1])))).padStart(2, "0");
      return `${new Date().getFullYear()}-${mm}`;
    }
    return null;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const detected = detectPeriodFromName(file.name);
    if (detected) setPeriodMonth(detected);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const sheetRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const parsed: PreviewRow[] = (sheetRows
      .slice(1)
      .map((row) => {
        const pn = String(row[0] ?? "").trim();
        if (!pn) return null;
        const status = parseStatus(String(row[2] ?? ""));
        return {
          product_no: pn,
          bobbin_size: String(row[1] ?? "").trim() || null,
          address: String(row[3] ?? "").trim() || null,
          status_category: status.category,
          status_raw: status.status_raw,
          renter_name: status.renter_name,
          stock_location: status.stock_location,
        } as Omit<PreviewRow, "serial_no">;
      })
      .filter(Boolean) as Omit<PreviewRow, "serial_no">[])
      .map((r, idx) => ({ ...r, serial_no: idx + 1 }));

    setRows(parsed);

    if (owners) {
      const base = file.name.replace(/\.(xlsx|xls|csv)$/i, "").trim();
      const match = owners.find((o: any) => base.includes(o.name) || o.name.includes(base));
      if (match) setOwnerId(match.id);
    }

    toast.message(`엑셀 ${parsed.length}행 로드됨`);
  }

  async function submit() {
    if (!ownerId || rows.length === 0) return;
    setBusy(true);
    const BATCH = 500;
    const total = rows.length;
    const totalBatches = Math.ceil(total / BATCH);
    let processed = 0;
    const errors: string[] = [];
    let assetsAfter = heldAssets;
    try {
      for (let i = 0; i < totalBatches; i++) {
        const chunk = rows.slice(i * BATCH, (i + 1) * BATCH);
        try {
          const res = await upload({
            data: {
              owner_id: ownerId,
              file_name: `${fileName} [${i + 1}/${totalBatches}]`,
              period_month: `${periodMonth}-01`,
              reset_period: i === 0,
              rows: chunk as any,
            },
          });
          processed += res?.row_count ?? chunk.length;
          if (typeof res?.product_count === "number") assetsAfter = res.product_count;
          toast.message(`배치 ${i + 1}/${totalBatches} 완료 (${processed}/${total}행)`);
        } catch (e: any) {
          errors.push(`배치 ${i + 1}: ${e.message}`);
        }
      }
      await refetchAssetCount();
      const vsPrev = assetsAfter - prevMonthCount;
      if (errors.length) {
        toast.error(`완료 (${processed}/${total}행) — 오류 ${errors.length}건: ${errors[0]}`);
      } else if (prevMonthKey && vsPrev > 0) {
        toast.success(
          `업로드 완료 · ${prevMonthLabel} 대비 +${vsPrev.toLocaleString()}대 (${prevMonthCount.toLocaleString()}→${assetsAfter.toLocaleString()})`,
        );
        setRows([]);
      } else if (prevMonthKey && vsPrev < 0) {
        toast.success(
          `업로드 완료 · ${prevMonthLabel} 대비 ${vsPrev.toLocaleString()}대 (${prevMonthCount.toLocaleString()}→${assetsAfter.toLocaleString()})`,
        );
        setRows([]);
      } else {
        toast.success(`업로드 완료 (${processed}건) · 자산 ${assetsAfter.toLocaleString()}대`);
        setRows([]);
      }
    } finally {
      setBusy(false);
    }
  }

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status_category] = (acc[r.status_category] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. 소유주 · 기준월 선택</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>소유주 <span className="text-destructive">*</span></Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="소유주를 선택하세요" /></SelectTrigger>
              <SelectContent>{(owners ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">반드시 직접 선택해 주세요. 파일명에 소유주명이 포함되어 있으면 제안만 적용됩니다.</p>
            {ownerId && (
              <p className="text-sm text-muted-foreground">
                현재 보유자산:{" "}
                <strong className="text-foreground tabular-nums">
                  {assetCountLoading ? "…" : `${heldAssets.toLocaleString()}건`}
                </strong>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>기준월 <span className="text-destructive">*</span></Label>
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="max-w-xs" />
            <p className="text-xs text-muted-foreground">
              기본값은 이번달입니다. 같은 (소유주 · 기준월) 재업로드 시 해당 월 이력은 새 데이터로 교체됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. 파일 선택</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".xlsx,.xls,.csv" disabled={!ownerId} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <p className="text-xs text-muted-foreground">
            {ownerId ? "엑셀/CSV 파일을 선택하면 미리보기가 표시됩니다." : "소유주를 먼저 선택해 주세요."}
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          {compareReady && (
            <div
              className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${
                vsPrevDelta > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : vsPrevDelta < 0
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
              role="status"
            >
              {vsPrevDelta > 0 ? (
                <TrendingUp className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : vsPrevDelta < 0 ? (
                <TrendingDown className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <Minus className="w-5 h-5 shrink-0 text-slate-500 mt-0.5" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-sm">
                  {vsPrevDelta > 0
                    ? `전월(${prevMonthLabel}) 대비 ${vsPrevDelta.toLocaleString()}대 추가`
                    : vsPrevDelta < 0
                      ? `전월(${prevMonthLabel}) 대비 ${Math.abs(vsPrevDelta).toLocaleString()}대 감소`
                      : `전월(${prevMonthLabel})과 자산 수가 동일합니다`}
                </p>
                <p className="text-sm tabular-nums">
                  {prevMonthLabel} <strong>{prevMonthCount.toLocaleString()}</strong>대
                  <span className="mx-1.5 opacity-50">→</span>
                  엑셀 <strong>{uniqueExcel.toLocaleString()}</strong>행
                  {excelRows !== uniqueExcel && (
                    <span className="text-muted-foreground ml-1.5">
                      (원본 {excelRows.toLocaleString()}행 · 중복 제거 후)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
          {!!ownerId && excelRows > 0 && !assetCountLoading && !prevMonthKey && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
              전월 스냅샷이 없습니다. 엑셀 <strong className="tabular-nums">{uniqueExcel.toLocaleString()}</strong>행이
              최초 기준으로 업로드됩니다.
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>3. 미리보기 ({rows.length}건)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm mb-3 flex flex-wrap gap-3">
                {Object.entries(statusCounts).map(([k, v]) => <span key={k} className="px-2 py-1 rounded bg-muted">{k}: {v}</span>)}
              </div>
              <div className="max-h-80 overflow-auto text-xs border rounded">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0"><tr><th className="text-left p-2 w-12">No.</th><th className="text-left p-2">제품번호</th><th className="text-left p-2">사이즈</th><th className="text-left p-2">상태</th><th className="text-left p-2">대여자/위치</th><th className="text-left p-2">주소</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.serial_no}</td>
                        <td className="p-2">{r.product_no}</td>
                        <td className="p-2">{r.bobbin_size}</td>
                        <td className="p-2">{r.status_category}</td>
                        <td className="p-2">{r.renter_name || r.stock_location || "-"}</td>
                        <td className="p-2 truncate max-w-xs">{r.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="mt-4" onClick={submit} disabled={!ownerId || busy}>
                {busy ? "업로드 중..." : "업로드 실행"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
