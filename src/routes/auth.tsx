import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ownerInitPasswordIfNeeded, registerAdminAccount, confirmAdminEmail } from "@/lib/admin.functions";
import { formatAuthError } from "@/lib/auth-errors";
import { Sparkles, Activity, TrendingUp, Package } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "로그인 — 보빈 렌탈 관리" }] }),
  component: AuthPage,
});

const OWNER_KEY = "saved_owner_login";
const ADMIN_KEY = "saved_admin_login";

function loadSaved(key: string): { email: string; password: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") return parsed;
  } catch {}
  return null;
}

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"owner" | "admin">("admin");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const initPw = useServerFn(ownerInitPasswordIfNeeded);
  const registerAdmin = useServerFn(registerAdminAccount);
  const confirmEmail = useServerFn(confirmAdminEmail);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [rememberOwner, setRememberOwner] = useState(false);

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [rememberAdmin, setRememberAdmin] = useState(false);

  useEffect(() => {
    const o = loadSaved(OWNER_KEY);
    if (o) { setOwnerEmail(o.email); setOwnerPw(o.password); setRememberOwner(true); }
    const a = loadSaved(ADMIN_KEY);
    if (a) { setEmail(a.email); setPw(a.password); setRememberAdmin(true); }
  }, []);

  function persist(key: string, remember: boolean, email: string, password: string) {
    if (typeof window === "undefined") return;
    if (remember) localStorage.setItem(key, JSON.stringify({ email, password }));
    else localStorage.removeItem(key);
  }

  async function ownerSignIn(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const em = ownerEmail.trim().toLowerCase();
      let res = await supabase.auth.signInWithPassword({ email: em, password: ownerPw });
      if (res.error) {
        const init = await initPw({ data: { email: em, password: ownerPw } });
        if (init.already_set) throw new Error("비밀번호가 올바르지 않습니다");
        res = await supabase.auth.signInWithPassword({ email: em, password: ownerPw });
        if (res.error) throw res.error;
      }
      if (!res.data.session) throw new Error("로그인 세션을 만들 수 없습니다.");
      persist(OWNER_KEY, rememberOwner, em, ownerPw);
      toast.success("로그인 성공");
      nav({ to: "/" });
    } catch (err: any) {
      const msg = formatAuthError(err.message ?? String(err));
      setFormError(msg);
      toast.error(`로그인 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function needsEmailConfirm(message?: string) {
    const m = (message ?? "").toLowerCase();
    return m.includes("email not confirmed") || m.includes("email_not_confirmed");
  }

  async function adminSignIn(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const em = email.trim().toLowerCase();
    if (!em || !pw) {
      const msg = "이메일과 비밀번호를 입력하세요.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      let { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });

      if ((error && needsEmailConfirm(error.message)) || (!error && !data.session)) {
        await confirmEmail({ data: { email: em } });
        ({ data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw }));
      }

      if (error) {
        const msg = formatAuthError(error.message);
        setFormError(msg);
        toast.error(msg);
        return;
      }
      if (!data.session) {
        const msg = "로그인 세션을 만들 수 없습니다. 비밀번호를 확인하거나 Sign Up에서 다시 가입하세요.";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      persist(ADMIN_KEY, rememberAdmin, em, pw);
      toast.success("로그인 성공");
      nav({ to: "/" });
    } catch (err: any) {
      const msg = formatAuthError(err?.message ?? "로그인 중 오류가 발생했습니다.");
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function adminSignUp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const em = email.trim().toLowerCase();
    if (!em || !pw) {
      const msg = "이메일과 비밀번호를 입력하세요.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (pw.length < 6) {
      const msg = "비밀번호는 6자 이상이어야 합니다.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await registerAdmin({ data: { email: em, password: pw } });
      toast.success("가입 완료. Sign In 탭에서 로그인하세요.");
      setPw("");
    } catch (err: any) {
      const msg = formatAuthError(err?.message ?? "가입 중 오류가 발생했습니다.");
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-2 bg-[oklch(0.985_0.005_270)] overflow-hidden">
      {/* Mobile-only ambient — very soft indigo wash */}
      <div aria-hidden className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-24 w-[380px] h-[380px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, oklch(0.88 0.08 277) 0%, transparent 65%)" }} />
        <div className="absolute -bottom-40 -left-32 w-[340px] h-[340px] rounded-full blur-3xl opacity-30"
             style={{ background: "radial-gradient(circle, oklch(0.90 0.06 265) 0%, transparent 65%)" }} />
      </div>

      {/* Hero panel — light & airy */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
           style={{ background: "linear-gradient(135deg, oklch(0.985 0.005 270) 0%, oklch(0.95 0.018 275) 100%)" }}>
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-50"
               style={{ background: "radial-gradient(circle, oklch(0.85 0.10 277) 0%, transparent 65%)" }} />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full blur-3xl opacity-40"
               style={{ background: "radial-gradient(circle, oklch(0.88 0.08 265) 0%, transparent 65%)" }} />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(oklch(0.30 0.08 270) 1px, transparent 1px), linear-gradient(90deg, oklch(0.30 0.08 270) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
        </div>

        <div className="relative z-10 flex items-center gap-2 font-display font-semibold text-foreground">
          <span className="w-9 h-9 rounded-xl grid place-items-center text-sm shadow-md text-white"
                style={{ background: "linear-gradient(135deg, oklch(0.60 0.20 277), oklch(0.50 0.22 290))" }}>
            B
          </span>
          <span>Bobbin</span>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/70 backdrop-blur px-3 py-1 text-xs text-indigo-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 인사이트 기반 자산 운영</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-display font-semibold leading-[1.1] tracking-tight text-foreground">
            보빈 자산을<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.55 0.22 277), oklch(0.50 0.22 290))" }}>
              지능적으로 추적
            </span>
            하세요.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            전국 대여 현황과 회수 일정, 추이 분석을 한 화면에서.
          </p>

          {/* Floating insight cards — light glass */}
          <div className="space-y-3 pt-2">
            <FloatCard icon={<Activity className="w-4 h-4" />} label="이번 달 렌탈비율" value="68.4%" delta="+3.2%p" tint="oklch(0.55 0.22 277)" delay="0s" />
            <FloatCard icon={<Package className="w-4 h-4" />} label="누적 회전율" value="2.4×" delta="+0.3" tint="oklch(0.55 0.18 250)" delay="0.4s" offset />
            <FloatCard icon={<TrendingUp className="w-4 h-4" />} label="신규 거래처" value="12개사" delta="+5" tint="oklch(0.55 0.20 295)" delay="0.8s" />
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-muted-foreground/70">
          © Bobbin Operations · 실시간 자산 인텔리전스
        </div>
      </div>

      {/* Form panel */}
      <div className="relative z-10 flex items-center justify-center px-6 py-12 lg:px-16 lg:bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile: logo + AI badge */}
          <div className="mb-8 lg:hidden space-y-4 text-center">
            <div className="inline-flex items-center gap-2 font-display font-semibold text-foreground">
              <span className="w-9 h-9 rounded-xl grid place-items-center text-sm shadow-md text-white"
                    style={{ background: "linear-gradient(135deg, oklch(0.60 0.20 277), oklch(0.50 0.22 290))" }}>
                B
              </span>
              <span>Bobbin</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/70 backdrop-blur px-3 py-1 text-[11px] text-indigo-700">
              <Sparkles className="w-3 h-3" />
              <span>AI 자산 인텔리전스</span>
            </div>
          </div>

          {/* Form card — light glass on mobile, plain on desktop */}
          <div className="rounded-3xl lg:rounded-none border lg:border-0 border-slate-200/70 bg-white/80 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none p-6 lg:p-0 shadow-xl lg:shadow-none">
            <div className="space-y-1.5 mb-8">
              <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground">
                {mode === "owner" ? "Log in" : "Admin Sign in"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "owner"
                  ? "최초 로그인 시 입력한 비밀번호로 서비스 이용 등록이 진행됩니다."
                  : "시스템 관리를 위한 관리자 자격증명으로 접속하세요."}
              </p>
            </div>

            {mode === "owner" ? (
              <form onSubmit={ownerSignIn} className="space-y-4">
                <Field id="oe" label="이메일" type="email" value={ownerEmail} onChange={setOwnerEmail} autoComplete="username" />
                <Field id="op" label="비밀번호" type="password" value={ownerPw} onChange={setOwnerPw} autoComplete="current-password" />
                <RememberMe id="ro" checked={rememberOwner} onChange={setRememberOwner} />
                <Button type="submit" disabled={loading || !ownerEmail || !ownerPw} className="w-full h-11 shadow-sm">
                  {loading ? "처리 중..." : "Log in"}
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={adminSignIn} className="space-y-4 pt-5">
                    <Field id="e1" label="이메일" type="email" value={email} onChange={setEmail} autoComplete="username" />
                    <Field id="p1" label="비밀번호" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
                    <RememberMe id="ra" checked={rememberAdmin} onChange={setRememberAdmin} />
                    <Button type="submit" disabled={loading || !email || !pw} className="w-full h-11">
                      {loading ? "처리 중..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={adminSignUp} className="space-y-4 pt-5">
                    <Field id="e2" label="이메일" type="email" value={email} onChange={setEmail} autoComplete="username" />
                    <Field id="p2" label="비밀번호" type="password" value={pw} onChange={setPw} autoComplete="new-password" />
                    <Button type="submit" disabled={loading || !email || !pw} className="w-full h-11">
                      {loading ? "처리 중..." : "Sign Up"}
                    </Button>
                    <p className="text-xs text-muted-foreground">최초 가입자는 관리자 권한을 얻을 수 있습니다.</p>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {formError ? (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="mt-8 pt-6 border-t border-border flex items-center justify-end text-sm">
              <button
                type="button"
                onClick={() => { setFormError(null); setMode(mode === "owner" ? "admin" : "owner"); }}
                className="text-primary hover:underline font-medium text-xs tracking-wide uppercase"
              >
                {mode === "owner" ? "Admin Access" : "Partner Log in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatCard({ icon, label, value, delta, tint, delay, offset }: {
  icon: React.ReactNode; label: string; value: string; delta: string; tint: string; delay: string; offset?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-white/85 backdrop-blur-xl p-4 flex items-center gap-3 shadow-[0_8px_24px_-12px_oklch(0.50_0.15_270/0.25)] ${offset ? "ml-8" : ""}`}
      style={{ animation: `floatY 6s ease-in-out ${delay} infinite` }}
    >
      <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
           style={{ background: `color-mix(in oklab, ${tint} 12%, transparent)`, color: tint }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="font-display text-lg font-semibold tabular-nums leading-tight text-foreground">{value}</div>
      </div>
      <div className="text-xs font-medium tabular-nums" style={{ color: "oklch(0.55 0.16 160)" }}>{delta}</div>
      <style>{`@keyframes floatY { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`}</style>
    </div>
  );
}

function Field({ id, label, type, value, onChange, placeholder, autoComplete }: { id: string; label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required
        className="h-11" />
    </div>
  );
}

function RememberMe({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer text-muted-foreground">로그인 정보 기억하기</Label>
    </div>
  );
}
