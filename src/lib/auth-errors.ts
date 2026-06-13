export function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다. Admin Access에서 가입한 계정인지 확인하세요.";
  }
  if (m.includes("missing supabase environment variable")) {
    return "서버 설정 오류: Vercel에 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY)를 등록한 뒤 재배포하세요.";
  }
  if (m.includes("email not confirmed")) {
    return "이메일 인증 처리에 실패했습니다. Sign Up에서 다시 가입하거나 Supabase에서 Confirm email을 끄세요.";
  }
  if (m.includes("user already registered")) {
    return "이미 가입된 이메일입니다. Sign In 탭에서 로그인하세요.";
  }
  return message;
}
