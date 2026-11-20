/*
# Fix JWT app_metadata claim lookup in helper functions

Supabase JWTs expose `app_metadata` (not `raw_app_meta_data`).
This updates current_studio_id(), is_admin(), and is_staff() to read
`app_metadata` first, with a safe fallback to `public.profiles`.
*/

CREATE OR REPLACE FUNCTION public.current_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'studio_id', '')::uuid,
    NULLIF(auth.jwt() -> 'raw_app_meta_data' ->> 'studio_id', '')::uuid,
    (SELECT studio_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'raw_app_meta_data' ->> 'role', ''),
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    ''
  ) = 'super_admin'
  AND public.current_studio_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'raw_app_meta_data' ->> 'role', ''),
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    ''
  ) IN ('super_admin', 'editor')
  AND public.current_studio_id() IS NOT NULL;
$$;
