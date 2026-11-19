/*
# Multi-Tenant SaaS Foundation — Step 1
# Security, Tenant Isolation, Storage Quotas, and Long-Term Stability

What this migration does:
1. Creates `public.studios` (one row per photography business) and `public.audit_logs` (security trail).
2. Adds `studio_id` to all existing CRM tables and safely backfills existing data into a default studio.
3. Enforces strict tenant isolation in all helper functions and Row Level Security (RLS) policies.
4. Prevents privilege escalation (users cannot change their own `role` or `studio_id`).
5. Prevents cross-tenant foreign-key linking via database triggers.
6. Tracks and enforces storage limits atomically on `media` uploads/deletes.
*/

-- ============================================================================
-- 1. STUDIOS (TENANTS) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_url text DEFAULT '',
  brand_color text DEFAULT '#b8860b',
  currency text NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD')),
  plan text NOT NULL DEFAULT 'free_trial' CHECK (plan IN ('free_trial', 'starter', 'pro', 'studio')),
  subscription_status text NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  storage_limit_bytes bigint NOT NULL DEFAULT 10737418240, -- 10 GB default for free trial
  storage_used_bytes bigint NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
  max_projects int NOT NULL DEFAULT 15,
  max_team_members int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studios_slug ON public.studios(slug);
CREATE INDEX IF NOT EXISTS idx_studios_owner_id ON public.studios(owner_id);

-- ============================================================================
-- 2. AUDIT LOGS (APPEND-ONLY SECURITY TRAIL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text DEFAULT '',
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_studio_created ON public.audit_logs(studio_id, created_at DESC);

-- ============================================================================
-- 3. SEED DEFAULT STUDIO & ADD studio_id TO ALL TENANT TABLES
-- ============================================================================
DO $$
DECLARE
  v_default_studio_id uuid;
BEGIN
  SELECT id INTO v_default_studio_id FROM public.studios WHERE slug = 'vaibhavam' LIMIT 1;
  IF v_default_studio_id IS NULL THEN
    INSERT INTO public.studios (name, slug, plan, subscription_status, storage_limit_bytes, max_projects, max_team_members)
    VALUES ('Vaibhavam Studio', 'vaibhavam', 'studio', 'active', 1099511627776, 10000, 100)
    RETURNING id INTO v_default_studio_id;
  END IF;

  -- Add studio_id columns (nullable first for safe backfill)
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.project_assignments ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.media ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;

  -- Backfill any existing rows to the default studio
  UPDATE public.profiles SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.clients SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.projects SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.project_stages SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.project_assignments SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.media SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.conversations SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.messages SET studio_id = v_default_studio_id WHERE studio_id IS NULL;
  UPDATE public.payments SET studio_id = v_default_studio_id WHERE studio_id IS NULL;

  -- Sync initial storage_used_bytes from existing media
  UPDATE public.studios s
  SET storage_used_bytes = COALESCE((
    SELECT SUM(m.file_size) FROM public.media m WHERE m.studio_id = s.id
  ), 0);

  -- Backfill studio_id in auth.users raw_app_meta_data for existing users so JWT claims work immediately
  UPDATE auth.users u
  SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'studio_id', p.studio_id::text,
    'role', COALESCE(u.raw_app_meta_data ->> 'role', p.role)
  )
  FROM public.profiles p
  WHERE p.id = u.id
    AND (u.raw_app_meta_data ->> 'studio_id') IS NULL;
END $$;

-- Enforce NOT NULL on studio_id
ALTER TABLE public.profiles ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.project_stages ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.project_assignments ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.media ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN studio_id SET NOT NULL;

-- Performance indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_profiles_studio_id ON public.profiles(studio_id);
CREATE INDEX IF NOT EXISTS idx_clients_studio_id ON public.clients(studio_id);
CREATE INDEX IF NOT EXISTS idx_projects_studio_id ON public.projects(studio_id);
CREATE INDEX IF NOT EXISTS idx_stages_studio_id ON public.project_stages(studio_id);
CREATE INDEX IF NOT EXISTS idx_assignments_studio_id ON public.project_assignments(studio_id);
CREATE INDEX IF NOT EXISTS idx_media_studio_id ON public.media(studio_id);
CREATE INDEX IF NOT EXISTS idx_conversations_studio_id ON public.conversations(studio_id);
CREATE INDEX IF NOT EXISTS idx_messages_studio_id ON public.messages(studio_id);
CREATE INDEX IF NOT EXISTS idx_payments_studio_id ON public.payments(studio_id);

-- ============================================================================
-- 4. SECURITY & TENANT HELPER FUNCTIONS
-- ============================================================================

-- Returns the current authenticated user's studio_id.
-- Reads from tamper-proof JWT app_metadata first, falling back to profiles.
CREATE OR REPLACE FUNCTION public.current_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'raw_app_meta_data' ->> 'studio_id', '')::uuid,
    (SELECT studio_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

-- True only if the studio exists, is active, and has an active or valid trial subscription
CREATE OR REPLACE FUNCTION public.is_studio_active(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studios s
    WHERE s.id = p_studio_id
      AND s.is_active = true
      AND (
        s.subscription_status = 'active'
        OR (s.subscription_status = 'trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at > now()))
      )
  );
$$;

-- True if current user is super_admin of their studio
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'raw_app_meta_data' ->> 'role', '') = 'super_admin'
    AND public.current_studio_id() IS NOT NULL;
$$;

-- True if current user is super_admin or editor
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'raw_app_meta_data' ->> 'role', '') IN ('super_admin', 'editor')
    AND public.current_studio_id() IS NOT NULL;
$$;

-- True if editor is assigned to given project within the same studio (or studio admin)
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND p.studio_id = public.current_studio_id()
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.project_assignments pa
          WHERE pa.project_id = p.id
            AND pa.studio_id = p.studio_id
            AND pa.user_id = auth.uid()
        )
      )
  );
$$;

-- True if current user owns the client record for given project within the same studio
CREATE OR REPLACE FUNCTION public.is_client_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = p_project_id
      AND p.studio_id = public.current_studio_id()
      AND c.studio_id = p.studio_id
      AND c.user_id = auth.uid()
  );
$$;

-- True if user belongs to the same studio and is admin, assigned editor, or project client
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_assigned_to_project(p_project_id)
    OR public.is_client_of_project(p_project_id);
$$;

-- ============================================================================
-- 5. SECURITY & INTEGRITY TRIGGERS
-- ============================================================================

-- A. Prevent users from changing their own role or studio_id via client-side UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (Edge Functions / SQL admin) to update anything
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
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

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

-- B. Auto-set and validate studio_id from parent rows to prevent cross-tenant linking
CREATE OR REPLACE FUNCTION public.sync_project_studio_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_studio_id uuid;
  v_max_projects int;
  v_current_projects int;
BEGIN
  SELECT studio_id INTO v_client_studio_id FROM public.clients WHERE id = NEW.client_id;
  IF v_client_studio_id IS NULL THEN
    RAISE EXCEPTION 'Selected client was not found.';
  END IF;

  IF NEW.studio_id IS NULL THEN
    NEW.studio_id := v_client_studio_id;
  ELSIF NEW.studio_id <> v_client_studio_id THEN
    RAISE EXCEPTION 'Security error: Client belongs to a different studio.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_studio_active(NEW.studio_id) THEN
      RAISE EXCEPTION 'Your studio subscription is inactive. Please renew your plan to create new projects.';
    END IF;

    SELECT max_projects INTO v_max_projects FROM public.studios WHERE id = NEW.studio_id;
    SELECT COUNT(*) INTO v_current_projects FROM public.projects WHERE studio_id = NEW.studio_id;
    IF v_max_projects IS NOT NULL AND v_current_projects >= v_max_projects THEN
      RAISE EXCEPTION 'Your studio has reached its plan limit of % projects. Please upgrade your plan to add more.', v_max_projects;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_studio_id ON public.projects;
CREATE TRIGGER trg_sync_project_studio_id
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_studio_id();

-- Helper trigger for child tables referencing project_id
CREATE OR REPLACE FUNCTION public.sync_project_child_studio_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_studio_id uuid;
BEGIN
  SELECT studio_id INTO v_project_studio_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_studio_id IS NULL THEN
    RAISE EXCEPTION 'Selected project was not found.';
  END IF;

  IF NEW.studio_id IS NULL THEN
    NEW.studio_id := v_project_studio_id;
  ELSIF NEW.studio_id <> v_project_studio_id THEN
    RAISE EXCEPTION 'Security error: Record does not match the project studio.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stages_studio ON public.project_stages;
CREATE TRIGGER trg_sync_stages_studio
  BEFORE INSERT OR UPDATE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

DROP TRIGGER IF EXISTS trg_sync_assignments_studio ON public.project_assignments;
CREATE TRIGGER trg_sync_assignments_studio
  BEFORE INSERT OR UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

DROP TRIGGER IF EXISTS trg_sync_conversations_studio ON public.conversations;
CREATE TRIGGER trg_sync_conversations_studio
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

DROP TRIGGER IF EXISTS trg_sync_payments_studio ON public.payments;
CREATE TRIGGER trg_sync_payments_studio
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

-- Helper trigger for messages referencing conversation_id
CREATE OR REPLACE FUNCTION public.sync_message_studio_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_studio_id uuid;
BEGIN
  SELECT studio_id INTO v_conv_studio_id FROM public.conversations WHERE id = NEW.conversation_id;
  IF v_conv_studio_id IS NULL THEN
    RAISE EXCEPTION 'Conversation was not found.';
  END IF;

  IF NEW.studio_id IS NULL THEN
    NEW.studio_id := v_conv_studio_id;
  ELSIF NEW.studio_id <> v_conv_studio_id THEN
    RAISE EXCEPTION 'Security error: Message does not match the conversation studio.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_messages_studio ON public.messages;
CREATE TRIGGER trg_sync_messages_studio
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_studio_id();

-- C. Atomic storage quota enforcement & tracking on media
CREATE OR REPLACE FUNCTION public.enforce_and_track_media_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_studio_id uuid;
  v_limit bigint;
  v_used bigint;
  v_delta bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.studios
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.file_size, 0)),
        updated_at = now()
    WHERE id = OLD.studio_id;
    RETURN OLD;
  END IF;

  SELECT studio_id INTO v_project_studio_id FROM public.projects WHERE id = NEW.project_id;
  IF v_project_studio_id IS NULL THEN
    RAISE EXCEPTION 'Selected project was not found.';
  END IF;

  IF NEW.studio_id IS NULL THEN
    NEW.studio_id := v_project_studio_id;
  ELSIF NEW.studio_id <> v_project_studio_id THEN
    RAISE EXCEPTION 'Security error: Media does not match the project studio.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_studio_active(NEW.studio_id) THEN
      RAISE EXCEPTION 'Your studio subscription is inactive. Please renew your plan to upload files.';
    END IF;
    v_delta := COALESCE(NEW.file_size, 0);
  ELSE
    v_delta := COALESCE(NEW.file_size, 0) - COALESCE(OLD.file_size, 0);
  END IF;

  IF v_delta > 0 THEN
    -- Lock studio row to prevent race-condition quota bypass on concurrent uploads
    SELECT storage_limit_bytes, storage_used_bytes
    INTO v_limit, v_used
    FROM public.studios
    WHERE id = NEW.studio_id
    FOR UPDATE;

    IF (v_used + v_delta) > v_limit THEN
      RAISE EXCEPTION 'Your studio has reached its storage limit. Please upgrade your plan or delete old files.';
    END IF;
  END IF;

  UPDATE public.studios
  SET storage_used_bytes = GREATEST(0, storage_used_bytes + v_delta),
      updated_at = now()
  WHERE id = NEW.studio_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_storage_before ON public.media;
CREATE TRIGGER trg_media_storage_before
  BEFORE INSERT OR UPDATE OR DELETE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_and_track_media_storage();

-- ============================================================================
-- 6. STRICT MULTI-TENANT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- STUDIOS
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "studios_select_own" ON public.studios;
CREATE POLICY "studios_select_own" ON public.studios FOR SELECT
  TO authenticated USING (id = public.current_studio_id());
DROP POLICY IF EXISTS "studios_update_admin" ON public.studios;
CREATE POLICY "studios_update_admin" ON public.studios FOR UPDATE
  TO authenticated
  USING (id = public.current_studio_id() AND public.is_admin())
  WITH CHECK (id = public.current_studio_id() AND public.is_admin());

-- AUDIT LOGS (read-only for studio admin; inserts via service_role / triggers)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (auth.uid() = id OR public.is_admin() OR public.is_staff())
  );
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND studio_id = public.current_studio_id())
  WITH CHECK (auth.uid() = id AND studio_id = public.current_studio_id());
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id AND studio_id = public.current_studio_id());

-- CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_assignments pa
        JOIN public.projects p ON p.id = pa.project_id
        WHERE p.client_id = clients.id
          AND p.studio_id = clients.studio_id
          AND pa.user_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "clients_insert_admin" ON public.clients;
CREATE POLICY "clients_insert_admin" ON public.clients FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND public.is_admin()
    AND public.is_studio_active(studio_id)
  );
DROP POLICY IF EXISTS "clients_update_admin" ON public.clients;
CREATE POLICY "clients_update_admin" ON public.clients FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND public.is_admin())
  WITH CHECK (studio_id = public.current_studio_id() AND public.is_admin());
DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
CREATE POLICY "clients_delete_admin" ON public.clients FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.can_access_project(id));
DROP POLICY IF EXISTS "projects_insert_admin" ON public.projects;
CREATE POLICY "projects_insert_admin" ON public.projects FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND public.is_admin()
    AND public.is_studio_active(studio_id)
  );
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(id)))
  WITH CHECK (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(id)));
DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
CREATE POLICY "projects_delete_admin" ON public.projects FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- PROJECT STAGES
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stages_select" ON public.project_stages;
CREATE POLICY "stages_select" ON public.project_stages FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.can_access_project(project_id));
DROP POLICY IF EXISTS "stages_insert" ON public.project_stages;
CREATE POLICY "stages_insert" ON public.project_stages FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND (public.is_admin() OR public.is_assigned_to_project(project_id))
  );
DROP POLICY IF EXISTS "stages_update" ON public.project_stages;
CREATE POLICY "stages_update" ON public.project_stages FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(project_id)))
  WITH CHECK (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(project_id)));
DROP POLICY IF EXISTS "stages_delete_admin" ON public.project_stages;
CREATE POLICY "stages_delete_admin" ON public.project_stages FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- PROJECT ASSIGNMENTS
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments_select" ON public.project_assignments;
CREATE POLICY "assignments_select" ON public.project_assignments FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR user_id = auth.uid()
      OR public.is_client_of_project(project_id)
    )
  );
DROP POLICY IF EXISTS "assignments_insert_admin" ON public.project_assignments;
CREATE POLICY "assignments_insert_admin" ON public.project_assignments FOR INSERT
  TO authenticated WITH CHECK (studio_id = public.current_studio_id() AND public.is_admin());
DROP POLICY IF EXISTS "assignments_update_admin" ON public.project_assignments;
CREATE POLICY "assignments_update_admin" ON public.project_assignments FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND public.is_admin())
  WITH CHECK (studio_id = public.current_studio_id() AND public.is_admin());
DROP POLICY IF EXISTS "assignments_delete_admin" ON public.project_assignments;
CREATE POLICY "assignments_delete_admin" ON public.project_assignments FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- MEDIA
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_select" ON public.media;
CREATE POLICY "media_select" ON public.media FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.can_access_project(project_id));
DROP POLICY IF EXISTS "media_insert" ON public.media;
CREATE POLICY "media_insert" ON public.media FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND (public.is_admin() OR public.is_assigned_to_project(project_id))
  );
DROP POLICY IF EXISTS "media_update" ON public.media;
CREATE POLICY "media_update" ON public.media FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(project_id)))
  WITH CHECK (studio_id = public.current_studio_id() AND (public.is_admin() OR public.is_assigned_to_project(project_id)));
DROP POLICY IF EXISTS "media_delete" ON public.media;
CREATE POLICY "media_delete" ON public.media FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.can_access_project(project_id));
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT
  TO authenticated WITH CHECK (studio_id = public.current_studio_id() AND public.can_access_project(project_id));
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.studio_id = messages.studio_id
        AND public.can_access_project(c.project_id)
    )
  );
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.studio_id = messages.studio_id
        AND public.can_access_project(c.project_id)
    )
  );
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  TO authenticated
  USING (
    studio_id = public.current_studio_id()
    AND (
      sender_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.studio_id = messages.studio_id
          AND public.can_access_project(c.project_id)
      )
    )
  )
  WITH CHECK (studio_id = public.current_studio_id());
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = client_id
          AND c.studio_id = payments.studio_id
          AND c.user_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
CREATE POLICY "payments_insert_admin" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND public.is_admin()
    AND public.is_studio_active(studio_id)
  );
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND public.is_admin())
  WITH CHECK (studio_id = public.current_studio_id() AND public.is_admin());
DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;
CREATE POLICY "payments_delete_admin" ON public.payments FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

