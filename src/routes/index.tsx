import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getMe } from "@/lib/me.functions";
import { promoteSelfToAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "보빈 렌탈 관리 시스템" },
      { name: "description", content: "보빈 제품의 렌탈 현황을 지도와 대시보드로 한눈에 관리하세요." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const fetchMe = useServerFn(getMe);
  const promote = useServerFn(promoteSelfToAdmin);

  const { data: me, refetch, isLoading: meLoading, isError: meIsError, error: meError } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    enabled: !!user,
    retry: 1,
  });

  // Not signed in → go straight to login
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth", replace: true });
  }, [loading, user, nav]);

  // Signed in with role → route to their area
  useEffect(() => {
    if (!me) return;
    if (me.isAdmin) nav({ to: "/admin" as any, replace: true });
    else if (me.isOwner) nav({ to: "/my" as any, replace: true });
  }, [me, nav]);

  if (loading || !user) return <Center>이동 중...</Center>;
  if (meIsError) {
    const msg = meError instanceof Error ? meError.message : "권한 확인에 실패했습니다.";
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader><CardTitle>로그인 후 처리 실패</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{msg}</p>
            <p className="text-sm text-muted-foreground">
              Vercel에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 모두 설정돼 있는지 확인하세요.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => refetch()}>다시 시도</Button>
              <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" as any }); }}>
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (meLoading || !me) return <Center>권한 확인 중...</Center>;
  if (me.isAdmin || me.isOwner) return <Center>이동 중...</Center>;

  // Signed in but no role yet
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="max-w-lg w-full">
        <CardHeader><CardTitle>환영합니다, {me.email}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            아직 권한이 부여되지 않았습니다. 첫 사용자라면 아래 버튼으로 관리자가 될 수 있습니다.
            그렇지 않으면 관리자에게 계정 연결을 요청하세요.
          </p>
          <div className="flex gap-2">
            <Button onClick={async () => {
              try { await promote(); toast.success("관리자로 등록되었습니다"); refetch(); }
              catch (e: any) { toast.error(e.message); }
            }}>관리자로 시작</Button>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" as any }); }}>
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-muted-foreground">{children}</div>;
}
