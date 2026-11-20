/*
# Automated Billing & Subscriptions (Razorpay & Stripe)
*/

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS billing_provider text DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_customer_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_subscription_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
  provider_payment_id text NOT NULL,
  provider_order_id text DEFAULT '',
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'studio')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_studio ON public.billing_transactions(studio_id, created_at DESC);

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_tx_select_admin" ON public.billing_transactions;
CREATE POLICY "billing_tx_select_admin" ON public.billing_transactions FOR SELECT
  TO authenticated USING (studio_id = public.current_studio_id() AND public.is_admin());
