/*
# Wedding CRM — Step 3: Enable RLS and create policies

Enables Row Level Security on all tables and creates role-based access policies.
Admins have full CRUD. Editors access assigned projects. Clients access their own projects.
*/

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  TO authenticated USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_assignments pa
      JOIN public.projects p ON p.id = pa.project_id
      WHERE p.client_id = clients.id AND pa.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "clients_insert_admin" ON public.clients;
CREATE POLICY "clients_insert_admin" ON public.clients FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "clients_update_admin" ON public.clients;
CREATE POLICY "clients_update_admin" ON public.clients FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
CREATE POLICY "clients_delete_admin" ON public.clients FOR DELETE
  TO authenticated USING (public.is_admin());

-- PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT
  TO authenticated USING (public.can_access_project(id));
DROP POLICY IF EXISTS "projects_insert_admin" ON public.projects;
CREATE POLICY "projects_insert_admin" ON public.projects FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_assigned_to_project(id))
  WITH CHECK (public.is_admin() OR public.is_assigned_to_project(id));
DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
CREATE POLICY "projects_delete_admin" ON public.projects FOR DELETE
  TO authenticated USING (public.is_admin());

-- PROJECT STAGES
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stages_select" ON public.project_stages;
CREATE POLICY "stages_select" ON public.project_stages FOR SELECT
  TO authenticated USING (public.can_access_project(project_id));
DROP POLICY IF EXISTS "stages_insert" ON public.project_stages;
CREATE POLICY "stages_insert" ON public.project_stages FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_assigned_to_project(project_id));
DROP POLICY IF EXISTS "stages_update" ON public.project_stages;
CREATE POLICY "stages_update" ON public.project_stages FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_assigned_to_project(project_id))
  WITH CHECK (public.is_admin() OR public.is_assigned_to_project(project_id));
DROP POLICY IF EXISTS "stages_delete_admin" ON public.project_stages;
CREATE POLICY "stages_delete_admin" ON public.project_stages FOR DELETE
  TO authenticated USING (public.is_admin());

-- PROJECT ASSIGNMENTS
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments_select" ON public.project_assignments;
CREATE POLICY "assignments_select" ON public.project_assignments FOR SELECT
  TO authenticated USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = project_id AND c.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "assignments_insert_admin" ON public.project_assignments;
CREATE POLICY "assignments_insert_admin" ON public.project_assignments FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "assignments_update_admin" ON public.project_assignments;
CREATE POLICY "assignments_update_admin" ON public.project_assignments FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "assignments_delete_admin" ON public.project_assignments;
CREATE POLICY "assignments_delete_admin" ON public.project_assignments FOR DELETE
  TO authenticated USING (public.is_admin());

-- MEDIA
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_select" ON public.media;
CREATE POLICY "media_select" ON public.media FOR SELECT
  TO authenticated USING (public.can_access_project(project_id));
DROP POLICY IF EXISTS "media_insert" ON public.media;
CREATE POLICY "media_insert" ON public.media FOR INSERT
  TO authenticated WITH CHECK (public.is_admin() OR public.is_assigned_to_project(project_id));
DROP POLICY IF EXISTS "media_update" ON public.media;
CREATE POLICY "media_update" ON public.media FOR UPDATE
  TO authenticated USING (public.is_admin() OR public.is_assigned_to_project(project_id))
  WITH CHECK (public.is_admin() OR public.is_assigned_to_project(project_id));
DROP POLICY IF EXISTS "media_delete" ON public.media;
CREATE POLICY "media_delete" ON public.media FOR DELETE
  TO authenticated USING (public.is_admin());

-- CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT
  TO authenticated USING (public.can_access_project(project_id));
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT
  TO authenticated WITH CHECK (public.can_access_project(project_id));
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE
  TO authenticated USING (public.is_admin());

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.can_access_project(c.project_id)
    )
  );
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.can_access_project(c.project_id)
    )
  );
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  TO authenticated USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.can_access_project(c.project_id)
    )
  ) WITH CHECK (true);
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  TO authenticated USING (public.is_admin());

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT
  TO authenticated USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
CREATE POLICY "payments_insert_admin" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;
CREATE POLICY "payments_delete_admin" ON public.payments FOR DELETE
  TO authenticated USING (public.is_admin());
