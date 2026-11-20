/*
# Invoices & Service Agreements with Digital Signature
# Multi-tenant, tamper-proof legal records
*/

-- 1. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  title text NOT NULL DEFAULT 'Photography Services Invoice',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'paid')),
  due_date date,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_studio_id ON public.invoices(studio_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);

DROP TRIGGER IF EXISTS trg_sync_invoices_studio ON public.invoices;
CREATE TRIGGER trg_sync_invoices_studio
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR (status <> 'draft' AND public.is_client_of_project(project_id))
    )
  );
DROP POLICY IF EXISTS "invoices_insert_admin" ON public.invoices;
CREATE POLICY "invoices_insert_admin" ON public.invoices FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND public.is_admin()
    AND public.is_studio_active(studio_id)
  );
DROP POLICY IF EXISTS "invoices_update_admin" ON public.invoices;
CREATE POLICY "invoices_update_admin" ON public.invoices FOR UPDATE
  TO authenticated
  USING (studio_id = public.current_studio_id() AND public.is_admin())
  WITH CHECK (studio_id = public.current_studio_id() AND public.is_admin());
DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
CREATE POLICY "invoices_delete_admin" ON public.invoices FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());

-- 2. SERVICE AGREEMENTS WITH DIGITAL SIGNATURE
CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Photography Service Agreement',
  terms_text text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'signed')),
  studio_signer_name text DEFAULT '',
  client_signer_name text DEFAULT '',
  signature_data_url text DEFAULT '',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_studio_id ON public.agreements(studio_id);
CREATE INDEX IF NOT EXISTS idx_agreements_project_id ON public.agreements(project_id);

DROP TRIGGER IF EXISTS trg_sync_agreements_studio ON public.agreements;
CREATE TRIGGER trg_sync_agreements_studio
  BEFORE INSERT OR UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_child_studio_id();

-- Prevent tampering with or deleting a signed agreement
CREATE OR REPLACE FUNCTION public.protect_signed_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'signed' THEN
      RAISE EXCEPTION 'Signed agreements cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION 'Signed agreements are locked and cannot be edited.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_agreement ON public.agreements;
CREATE TRIGGER trg_protect_signed_agreement
  BEFORE UPDATE OR DELETE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_agreement();

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agreements_select" ON public.agreements;
CREATE POLICY "agreements_select" ON public.agreements FOR SELECT
  TO authenticated USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR (status <> 'draft' AND public.is_client_of_project(project_id))
    )
  );
DROP POLICY IF EXISTS "agreements_insert_admin" ON public.agreements;
CREATE POLICY "agreements_insert_admin" ON public.agreements FOR INSERT
  TO authenticated WITH CHECK (
    studio_id = public.current_studio_id()
    AND public.is_admin()
    AND public.is_studio_active(studio_id)
  );
DROP POLICY IF EXISTS "agreements_update" ON public.agreements;
CREATE POLICY "agreements_update" ON public.agreements FOR UPDATE
  TO authenticated
  USING (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR (status = 'sent' AND public.is_client_of_project(project_id))
    )
  )
  WITH CHECK (
    studio_id = public.current_studio_id()
    AND (
      public.is_admin()
      OR (status = 'signed' AND public.is_client_of_project(project_id))
    )
  );
DROP POLICY IF EXISTS "agreements_delete_admin" ON public.agreements;
CREATE POLICY "agreements_delete_admin" ON public.agreements FOR DELETE
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());
