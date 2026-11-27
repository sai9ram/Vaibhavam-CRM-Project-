/*
# Dynamic SaaS Plans Table (Manageable from Platform Master Admin)
*/

CREATE TABLE IF NOT EXISTS public.platform_plans (
  id text PRIMARY KEY CHECK (id IN ('starter', 'pro', 'studio')),
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_inr numeric(12,2) NOT NULL DEFAULT 0,
  price_usd numeric(12,2) NOT NULL DEFAULT 0,
  storage_limit_gb int NOT NULL DEFAULT 50,
  max_projects int NOT NULL DEFAULT 50,
  max_team_members int NOT NULL DEFAULT 5,
  recommended boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_plans_select_all" ON public.platform_plans;
CREATE POLICY "platform_plans_select_all" ON public.platform_plans FOR SELECT
  TO authenticated, anon USING (true);

INSERT INTO public.platform_plans (id, name, tagline, price_inr, price_usd, storage_limit_gb, max_projects, max_team_members, recommended, features)
VALUES
  (
    'starter',
    'Starter',
    'For solo photographers & small studios',
    999,
    19,
    50,
    50,
    5,
    false,
    '["Up to 50 projects","5 team members (admin & editors)","50 GB photo & video storage","Client portal, invoices & digital signatures"]'::jsonb
  ),
  (
    'pro',
    'Pro',
    'Best for growing wedding & event studios',
    2499,
    39,
    250,
    500,
    15,
    true,
    '["Up to 500 projects","15 team members","250 GB photo & video storage","Custom studio logo, brand colors & reports"]'::jsonb
  ),
  (
    'studio',
    'Studio',
    'For high-volume multi-team agencies',
    4999,
    79,
    1024,
    10000,
    100,
    false,
    '["Up to 10,000 projects","100 team members","1 TB photo & video storage","Priority onboarding & full audit logs"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
