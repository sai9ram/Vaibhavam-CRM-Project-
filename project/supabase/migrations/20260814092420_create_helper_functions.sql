/*
# Wedding CRM — Step 2: Helper functions for role-based access control

These functions are used by RLS policies to determine access:
- is_admin(): true if current user's role is super_admin
- is_staff(): true if current user is super_admin or editor
- is_assigned_to_project(uuid): true if editor is assigned to given project (or admin)
- is_client_of_project(uuid): true if current user owns the client record for given project
- can_access_project(uuid): true if admin, assigned editor, or project client
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'raw_app_meta_data' ->> 'role', '') = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'raw_app_meta_data' ->> 'role', '') IN ('super_admin', 'editor');
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

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
    WHERE p.id = p_project_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.is_assigned_to_project(p_project_id)
    OR public.is_client_of_project(p_project_id);
$$;
