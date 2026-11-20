/*
# Fix protect_profile_security_fields() for all service_role / Edge Function contexts

Ensures Edge Functions using SUPABASE_SERVICE_ROLE_KEY (both legacy JWT and
sb_secret keys) are recognized as service_role by the BEFORE UPDATE trigger.
*/

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

  RETURN NEW;
END;
$$;
