export function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다. Admin Access에서 가입한 계정인지 확인하세요.";
  }
  if (m.includes("email not confirmed")) {
    return "이메일 인증이 필요합니다. Supabase 대시보드에서 사용자를 Confirm 하거나, Confirm email 설정을 끄세요.";
  }
  if (m.includes("user already registered")) {
    return "이미 가입된 이메일입니다. Sign In 탭에서 로그인하세요.";
  }
  return message;
}
