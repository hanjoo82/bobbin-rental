-- Re-apply Data API grants (live DB is missing them)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_accounts TO authenticated;
GRANT ALL ON public.owner_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_batches TO authenticated;
GRANT ALL ON public.upload_batches TO service_role;

-- RLS policies call has_role(); allow signed-in users to execute it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_owner(uuid, uuid) TO authenticated, service_role;
