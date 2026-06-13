import { createContext, useContext, type ReactNode } from "react";

type OwnerScope = {
  /** Selected owner ID. undefined = 전체(관리자) 또는 소유주 자기 자신(RLS 스코프) */
  ownerId: string | undefined;
  /** UI 표시용 라벨 */
  label: string;
  /** 관리자 모드 여부 */
  isAdmin: boolean;
};

const Ctx = createContext<OwnerScope>({ ownerId: undefined, label: "", isAdmin: false });

export function OwnerScopeProvider({ value, children }: { value: OwnerScope; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOwnerScope() {
  return useContext(Ctx);
}
