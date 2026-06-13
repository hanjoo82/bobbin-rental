-- Remove geocode cache and product coordinates (maps/geocoding no longer used)
DROP TABLE IF EXISTS public.geocode_cache;

ALTER TABLE public.products DROP COLUMN IF EXISTS lat;
ALTER TABLE public.products DROP COLUMN IF EXISTS lng;
