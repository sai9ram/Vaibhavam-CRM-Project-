/*
# Fix handle_new_user() for Multi-Tenant studio_id

Updates the auth.users -> public.profiles trigger so new users automatically
receive their studio_id from raw_app_meta_data (or the default studio for
direct client signups), preventing "Database error creating new user".
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
BEGIN
  v_studio_id := NULLIF(NEW.raw_app_meta_data ->> 'studio_id', '')::uuid;

  IF v_studio_id IS NULL THEN
    SELECT id INTO v_studio_id
    FROM public.studios
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, studio_id, role, full_name, phone)
  VALUES (
    NEW.id,
    v_studio_id,
    COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'role', ''), 'client'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    studio_id = COALESCE(EXCLUDED.studio_id, public.profiles.studio_id),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END;

  RETURN NEW;
END;
$$;
