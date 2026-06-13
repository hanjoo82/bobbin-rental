import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/me.functions";
import { OwnerScopeProvider } from "@/lib/owner-scope";
import { LayoutDashboard, Building2, LogOut, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my")({
  component: MyLayout,
});

const NAV = [
  { to: "/my", icon: LayoutDashboard, label: "대시보드", exact: true },
  { to: "/my/renters", icon: Building2, label: "대여현황" },
  { to: "/my/trends", icon: TrendingUp, label: "추이분석" },
] as const;

function MyLayout() {
  const nav = useNavigate();
  const fetchMe = useServerFn(getMe);
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  useEffect(() => {
    if (isLoading || !me) return;
    if (me.isAdmin) nav({ to: "/admin" });
    else if (!me.isOwner) nav({ to: "/" });
  }, [me, isLoading, nav]);

  if (isLoading || !me || me.isAdmin || !me.isOwner) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">권한 확인 중...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-2 sm:px-4 h-14 grid grid-cols-[auto_1fr_auto] items-center gap-1.5 sm:gap-4">
          <Link to="/my" className="flex items-center gap-2 font-display font-semibold shrink-0">
            <span className="w-7 h-7 rounded-md bg-brand-gradient grid place-items-center text-primary-foreground text-xs">B</span>
            <span className="hidden sm:inline">내 보빈 현황</span>
          </Link>
          <nav className="flex justify-center min-w-0">
            <SegmentedTabs items={NAV} />
          </nav>
          <Button variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">로그아웃</span>
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <OwnerScopeProvider value={{ ownerId: undefined, label: "", isAdmin: false }}>
          <Outlet />
        </OwnerScopeProvider>
      </main>
    </div>
  );
}

export function SegmentedTabs({ items }: { items: ReadonlyArray<{ to: string; icon: any; label: string; exact?: boolean }> }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 sm:p-1 max-w-full overflow-x-auto scrollbar-none">
      {items.map(({ to, icon: Icon, label, exact }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: !!exact }}
          className="group flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-muted-foreground transition-all whitespace-nowrap hover:text-foreground [&.active]:bg-background [&.active]:text-foreground [&.active]:shadow-sm"
        >
          <Icon className="w-3.5 h-3.5 opacity-70 group-[.active]:opacity-100 group-[.active]:text-primary" />
          {label}
        </Link>
      ))}
    </div>
  );
}
