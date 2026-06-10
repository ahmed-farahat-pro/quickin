
-- ============================================================
-- Payment & Financial System Migration
-- ============================================================

-- 1. Platform Settings (key/value for configurable rates)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.staff_profiles(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read platform_settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage platform_settings"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

-- Seed default commission rates
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('host_commission_rate', '0.10', 'Commission rate charged to hosts (0.10 = 10%)'),
  ('guest_commission_rate', '0.02', 'Service fee rate charged to guests (0.02 = 2%)')
ON CONFLICT (key) DO NOTHING;

-- 2. Cancellation Policies lookup table
CREATE TABLE IF NOT EXISTS public.cancellation_policies (
  code text PRIMARY KEY,
  label text NOT NULL,
  full_refund_days_before int NOT NULL DEFAULT 1,
  partial_refund_pct numeric NOT NULL DEFAULT 0,
  partial_refund_days_before int NOT NULL DEFAULT 0,
  no_refund_days_before int NOT NULL DEFAULT 0,
  description text,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cancellation_policies"
  ON public.cancellation_policies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage cancellation_policies"
  ON public.cancellation_policies FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

-- Seed cancellation policies
INSERT INTO public.cancellation_policies (code, label, full_refund_days_before, partial_refund_pct, partial_refund_days_before, no_refund_days_before, description, translations) VALUES
  ('flexible', 'Flexible', 1, 0, 0, 0,
   'Full refund up to 1 day before check-in.',
   '{"ar": {"label": "مرن", "description": "استرداد كامل حتى يوم واحد قبل تسجيل الوصول."}}'::jsonb),
  ('moderate', 'Moderate', 5, 50, 1, 0,
   'Full refund 5+ days before check-in. 50% refund 1-5 days before.',
   '{"ar": {"label": "معتدل", "description": "استرداد كامل قبل 5 أيام أو أكثر من تسجيل الوصول. استرداد 50% قبل 1-5 أيام."}}'::jsonb),
  ('strict', 'Strict', 14, 50, 7, 0,
   'Full refund 14+ days before. 50% refund 7-14 days before. No refund within 7 days.',
   '{"ar": {"label": "صارم", "description": "استرداد كامل قبل 14 يومًا أو أكثر. استرداد 50% قبل 7-14 يومًا. لا استرداد خلال 7 أيام."}}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 3. Escrow Transactions
CREATE TYPE escrow_type AS ENUM ('hold', 'release', 'refund');
CREATE TYPE escrow_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  type escrow_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status escrow_status NOT NULL DEFAULT 'pending',
  initiated_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_escrow_booking ON public.escrow_transactions(booking_id);
CREATE INDEX idx_escrow_status ON public.escrow_transactions(status);

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage escrow_transactions"
  ON public.escrow_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Booking participants can read their escrow"
  ON public.escrow_transactions FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.user_id = auth.uid()
      UNION
      SELECT b.id FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE l.user_id = auth.uid()
    )
  );

-- 4. User Balances
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  available_balance numeric NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  on_hold_balance numeric NOT NULL DEFAULT 0 CHECK (on_hold_balance >= 0),
  total_earned numeric NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balance"
  ON public.user_balances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can read all balances"
  ON public.user_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

-- Note: writes to user_balances should only happen via server/admin actions,
-- so we allow INSERT/UPDATE for authenticated but actual enforcement is at the application layer.
CREATE POLICY "System can write balances"
  ON public.user_balances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update balances"
  ON public.user_balances FOR UPDATE
  TO authenticated
  USING (true);

-- 5. Balance Transactions (immutable ledger)
CREATE TYPE balance_tx_type AS ENUM ('credit', 'debit', 'hold', 'release', 'refund', 'withdrawal', 'commission');

CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  type balance_tx_type NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  reference_type text,
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_balance_tx_user ON public.balance_transactions(user_id);
CREATE INDEX idx_balance_tx_ref ON public.balance_transactions(reference_type, reference_id);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON public.balance_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can read all transactions"
  ON public.balance_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "System can insert transactions"
  ON public.balance_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Alter bookings table — add financial columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_earnings numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_payout_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none'
    CHECK (escrow_status IN ('none', 'held', 'released', 'refunded'));

-- 7. Refunds table
CREATE TYPE refund_type AS ENUM ('full', 'partial');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'processed');

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text,
  refund_type refund_type NOT NULL DEFAULT 'full',
  policy_applied text REFERENCES public.cancellation_policies(code),
  status refund_status NOT NULL DEFAULT 'pending',
  initiated_by uuid REFERENCES auth.users(id),
  processed_by uuid REFERENCES public.staff_profiles(id),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_refunds_booking ON public.refunds(booking_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage refunds"
  ON public.refunds FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Booking participants can read their refunds"
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.user_id = auth.uid()
      UNION
      SELECT b.id FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE l.user_id = auth.uid()
    )
  );

-- 8. DB function: get_platform_setting
CREATE OR REPLACE FUNCTION public.get_platform_setting(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value text;
BEGIN
  SELECT value INTO v_value
  FROM public.platform_settings
  WHERE key = p_key;

  -- Fallback defaults
  IF v_value IS NULL THEN
    CASE p_key
      WHEN 'host_commission_rate' THEN v_value := '0.10';
      WHEN 'guest_commission_rate' THEN v_value := '0.02';
      ELSE v_value := NULL;
    END CASE;
  END IF;

  RETURN v_value;
END;
$$;
;
