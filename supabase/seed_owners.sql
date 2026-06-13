-- =============================================================================
-- 소유주 8명 시드 (Lovable → bobbin-rental 이전용)
-- Supabase Dashboard → bobbin-rental 프로젝트 → SQL Editor 에서 1회 실행
-- =============================================================================
-- 비밀번호: 모두 "대기" 상태로 시작합니다.
-- 각 소유주는 /auth → Partner Log in 에서 이메일 + 원하는 비밀번호로 첫 로그인하면 됩니다.
-- 소유주명은 엑셀 업로드 시 파일명(거래처명)과 일치해야 합니다.

INSERT INTO public.owners (name, email, password_set, contact)
VALUES
  ('(주)에이치에이더블앤', 'hanhs17@naver.com', false, NULL),
  ('골드펜', 'goldpen@naver.com', false, NULL),
  ('삼익플랜', 'samikplan@naver.com', false, NULL),
  ('애드포스원', 'adpos1@naver.com', false, NULL),
  ('엄소리', 'umsori@naver.com', false, NULL),
  ('와트레인', 'wlane@naver.com', false, NULL),
  ('제이에스포럼', 'jsforum@naver.com', false, NULL),
  ('지세븐테크', 'g7tech@naver.com', false, NULL)
ON CONFLICT (name) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();

-- 확인
SELECT name, email, password_set FROM public.owners ORDER BY name;
