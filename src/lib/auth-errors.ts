export function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다. Admin Access에서 가입한 계정인지 확인하세요.";
  }
  if (m.includes("email not confirmed")) {
    return "이메일 인증 처리 중입니다. 잠시 후 다시 Sign In을 눌러주세요.";
  }
  if (m.includes("user already registered")) {
    return "이미 가입된 이메일입니다. Sign In 탭에서 로그인하세요.";
  }
  return message;
}
