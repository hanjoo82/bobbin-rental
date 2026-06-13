ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS owners_email_key ON public.owners (lower(email)) WHERE email IS NOT NULL;

DELETE FROM public.owner_accounts;