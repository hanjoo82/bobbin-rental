import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/me.functions";
import { listOwners } from "@/lib/admin.functions";
import { OwnerScopeProvider } from "@/lib/owner-scope";
import { LayoutDashboard, Settings, Building2, LogOut, TrendingUp, Package } from "lucide-react";
import { SegmentedTabs } from "./my";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "대시보드", exact: true },
  { to: "/admin/assets", icon: Package, label: "자산현황" },
  { to: "/admin/renters", icon: Building2, label: "대여현황" },
  { to: "/admin/trends", icon: TrendingUp, label: "추이분석" },
  { to: "/admin/settings", icon: Settings, label: "설정" },
] as const;


const ALL = "__all__";

function AdminLayout() {
  const nav = useNavigate();
  const fetchMe = useServerFn(getMe);
  const fetchOwners = useServerFn(listOwners);
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { data: owners } = useQuery({
    queryKey: ["admin-owners-list"],
    queryFn: () => fetchOwners(),
    enabled: !!me?.isAdmin,
  });
  const [selected, setSelected] = useState<string>(ALL);

  useEffect(() => {
    if (isLoading || !me) return;
    if (!me.isAdmin) nav({ to: me.isOwner ? "/my" : "/" });
  }, [me, isLoading, nav]);

  if (isLoading || !me || !me.isAdmin) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">권한 확인 중...</div>;
  }

  const ownerId = selected === ALL ? undefined : selected;
  const ownerLabel = ownerId
    ? ((owners ?? []).find((o: any) => o.id === ownerId)?.name ?? "")
    : "전체 합산";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 h-14 grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 font-display font-semibold shrink-0 min-w-0">
            <BrandLogo variant="header" />
            <span className="hidden sm:inline truncate">관리자</span>
          </Link>
          <nav className="flex justify-center min-w-0">
            <SegmentedTabs items={NAV} />
          </nav>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">로그아웃</span>
          </Button>
        </div>
        <div className="container mx-auto px-4 pb-2 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">소유주 필터</span>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue placeholder="소유주 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 합산</SelectItem>
              {(owners ?? []).map((o: any) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <OwnerScopeProvider value={{ ownerId, label: ownerLabel, isAdmin: true }}>
          <Outlet />
        </OwnerScopeProvider>
      </main>
    </div>
  );
}
