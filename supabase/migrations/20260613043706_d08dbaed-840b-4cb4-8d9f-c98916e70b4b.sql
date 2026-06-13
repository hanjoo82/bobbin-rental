ALTER TABLE public.upload_batches ADD COLUMN IF NOT EXISTS period_month DATE;
UPDATE public.upload_batches SET period_month = date_trunc('month', created_at)::date WHERE period_month IS NULL;
ALTER TABLE public.upload_batches ALTER COLUMN period_month SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upload_batches_owner_period ON public.upload_batches(owner_id, period_month);