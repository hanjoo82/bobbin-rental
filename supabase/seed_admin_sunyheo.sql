-- =============================================================================
-- 관리자 계정: sunyheo@naver.com (bobbin-rental / vkubxrydtwggvmkbsano)
-- Supabase Dashboard → SQL Editor 에서 1회 실행 (auth 사용자가 이미 있을 때)
-- =============================================================================
-- Auth 사용자가 없으면 Dashboard → Authentication → Users → Add user 로 먼저 생성하거나
--   node scripts/create-admin.mjs 를 service role key 와 함께 실행하세요.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('sunyheo@naver.com')
ON CONFLICT (user_id, role) DO NOTHING;

SELECT u.email, ur.role, u.email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
WHERE lower(u.email) = lower('sunyheo@naver.com');
