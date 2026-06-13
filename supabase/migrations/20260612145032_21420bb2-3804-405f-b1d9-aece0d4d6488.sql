
CREATE TABLE public.product_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  status_category text NOT NULL,
  renter_name text,
  stock_location text,
  batch_id uuid REFERENCES public.upload_batches(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psh_owner_changed ON public.product_status_history(owner_id, changed_at DESC);
CREATE INDEX idx_psh_product_changed ON public.product_status_history(product_id, changed_at DESC);
CREATE INDEX idx_psh_status_changed ON public.product_status_history(status_category, changed_at DESC);

GRANT SELECT ON public.product_status_history TO authenticated;
GRANT ALL ON public.product_status_history TO service_role;

ALTER TABLE public.product_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all history"
  ON public.product_status_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can read own history"
  ON public.product_status_history FOR SELECT
  TO authenticated
  USING (public.user_can_access_owner(auth.uid(), owner_id));
