/*
# Platform Master Admin (SaaS Founder Panel)

1. Adds `is_platform_admin` to `public.profiles` (locked from client-side edits).
2. Grants `is_platform_admin = true` to the founder account (`sairamdesetti2@gmail.com`).
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- Update security trigger so nobody can grant themselves is_platform_admin
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(auth.role(), ''),
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );

  IF v_jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'You cannot change your own account role.';
  END IF;

  IF NEW.studio_id IS DISTINCT FROM OLD.studio_id THEN
    RAISE EXCEPTION 'You cannot move your account to another studio.';
  END IF;

  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'You cannot change platform admin permissions.';
  END IF;

  RETURN NEW;
END;
$$;

-- Grant Platform Master Admin to the founder email if the account exists
UPDATE public.profiles p
SET is_platform_admin = true
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'sairamdesetti2@gmail.com';
