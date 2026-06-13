export type StatusCategory =
  | "rental"
  | "in_stock"
  | "awaiting_return"
  | "scheduled_return"
  | "expected_complete";

export const STATUS_LABEL: Record<StatusCategory, string> = {
  rental: "렌탈중",
  in_stock: "재고보유중",
  awaiting_return: "회수대기",
  scheduled_return: "회수예정",
  expected_complete: "사용완료예상",
};

export const STATUS_COLOR: Record<StatusCategory, string> = {
  rental: "oklch(0.82 0.05 240)",          // pastel blue
  in_stock: "oklch(0.85 0.05 150)",        // pastel green
  awaiting_return: "oklch(0.85 0.05 60)",  // pastel orange
  scheduled_return: "oklch(0.82 0.05 290)",// pastel lavender
  expected_complete: "oklch(0.82 0.05 20)",// pastel pink
};

export interface ParsedStatus {
  category: StatusCategory;
  renter_name: string | null;
  stock_location: string | null;
  status_raw: string;
}

/**
 * 엑셀의 "상태" 컬럼 raw 문자열을 정규화.
 * 예시 입력:
 *   "렌탈중(전선사) - 엘에스전선(주)"
 *   "렌탈중(고객사) - 가온전선(주)"
 *   "재고(본사)"
 *   "재고(물류센터)"
 *   "회수대기"
 *   "회수예정"
 *   "사용완료예상 - 미지정"
 */
export function parseStatus(raw: string): ParsedStatus {
  const text = (raw ?? "").trim();
  const after = (s: string) => {
    const idx = s.indexOf("-");
    if (idx < 0) return null;
    const name = s.slice(idx + 1).trim();
    if (!name || name === "미지정") return null;
    return name;
  };

  if (text.startsWith("렌탈중")) {
    return { category: "rental", renter_name: after(text), stock_location: null, status_raw: text };
  }
  if (text.startsWith("재고")) {
    let loc: string | null = null;
    const m = text.match(/재고\(([^)]+)\)/);
    if (m) loc = m[1].trim();
    return { category: "in_stock", renter_name: null, stock_location: loc, status_raw: text };
  }
  if (text.startsWith("회수대기")) {
    return { category: "awaiting_return", renter_name: null, stock_location: null, status_raw: text };
  }
  if (text.startsWith("회수예정")) {
    return { category: "scheduled_return", renter_name: after(text), stock_location: null, status_raw: text };
  }
  if (text.startsWith("사용완료예상")) {
    return { category: "expected_complete", renter_name: after(text), stock_location: null, status_raw: text };
  }
  // fallback: treat unknown as in_stock with raw label preserved
  return { category: "in_stock", renter_name: null, stock_location: null, status_raw: text };
}

export function displayStatus(p: {
  status_category: StatusCategory;
  renter_name: string | null;
  stock_location: string | null;
}): string {
  const base = STATUS_LABEL[p.status_category];
  if (p.status_category === "rental") {
    return p.renter_name ? `${base}, ${p.renter_name}` : base;
  }
  if (p.status_category === "in_stock") {
    return p.stock_location ? `${base}, ${p.stock_location}` : base;
  }
  if (p.status_category === "expected_complete" && p.renter_name) {
    return `${base}, ${p.renter_name}`;
  }
  return base;
}
