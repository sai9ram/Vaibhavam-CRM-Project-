/*
# Pure Platform Admin Mode

1. Allows `profiles.studio_id` to be NULL strictly for `is_platform_admin = true`.
2. Ensures platform admins can always read/update their own profile even when `studio_id IS NULL`.
3. Detaches the founder account (`sairamdesetti2@gmail.com`) from any specific studio so deleting studios never affects it.
*/

ALTER TABLE public.profiles
  ALTER COLUMN studio_id DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_studio_or_platform_admin_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_studio_or_platform_admin_check
  CHECK (studio_id IS NOT NULL OR is_platform_admin = true);

-- Allow a pure platform admin (studio_id IS NULL) to read/update their own profile
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR (
      studio_id = public.current_studio_id()
      AND (public.is_admin() OR public.is_staff())
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Detach the founder account from any studio so it acts as pure Platform Master Admin
UPDATE public.profiles p
SET is_platform_admin = true,
    studio_id = NULL
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'sairamdesetti2@gmail.com';
