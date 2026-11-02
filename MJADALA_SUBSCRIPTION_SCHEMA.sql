-- MJADALA BUSINESS SUBSCRIPTIONS — SAFE SCHEMA EXTENSION
-- Adds selected plan to applications and a separate payment ledger.
-- Does NOT alter marketplace product orders or claim a payment is successful.

ALTER TABLE public.mj_business_applications
  ADD COLUMN IF NOT EXISTS plan_id uuid
  REFERENCES public.mj_business_plans(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS mj_business_applications_plan_id_idx
  ON public.mj_business_applications(plan_id);

CREATE TABLE IF NOT EXISTS public.mj_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  application_id uuid REFERENCES public.mj_business_applications(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.mj_business_plans(id) ON DELETE RESTRICT,
  amount_kes numeric(12,2) NOT NULL CHECK (amount_kes >= 0),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','processing','paid','failed','cancelled')),
  payment_method text NOT NULL DEFAULT 'mpesa',
  merchant_request_id text,
  checkout_request_id text,
  mpesa_receipt_number text,
  result_code integer,
  result_description text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mj_subscription_payments_checkout_unique UNIQUE (checkout_request_id)
);

CREATE INDEX IF NOT EXISTS mj_subscription_payments_user_created_idx
  ON public.mj_subscription_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mj_subscription_payments_status_idx
  ON public.mj_subscription_payments(payment_status);

ALTER TABLE public.mj_subscription_payments ENABLE ROW LEVEL SECURITY;

-- Owners may read only their own payment records. No client-side INSERT/UPDATE
-- policy is created: payment creation and callback updates must use the trusted
-- server-side Daraja Edge Functions with the service-role key.
DROP POLICY IF EXISTS mj_subscription_payments_read_own
  ON public.mj_subscription_payments;
CREATE POLICY mj_subscription_payments_read_own
  ON public.mj_subscription_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mj_subscription_payments_creator_read
  ON public.mj_subscription_payments;
CREATE POLICY mj_subscription_payments_creator_read
  ON public.mj_subscription_payments
  FOR SELECT TO authenticated
  USING (public.mj_is_creator_admin());

-- Keep updated_at current for trusted server-side updates.
CREATE OR REPLACE FUNCTION public.mj_touch_subscription_payment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mj_subscription_payments_touch_updated_at
  ON public.mj_subscription_payments;
CREATE TRIGGER mj_subscription_payments_touch_updated_at
BEFORE UPDATE ON public.mj_subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.mj_touch_subscription_payment_updated_at();

-- Your existing plan prices/trials are intentionally preserved.
