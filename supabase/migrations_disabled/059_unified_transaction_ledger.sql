-- Migration: Unified Transaction Ledger
-- Spec: docs/superpowers/specs/2026-03-16-unified-transaction-ledger-design.md

-- =============================================================
-- STEP 1: Drop balance_transactions table (before escrow rename to avoid FK confusion)
-- =============================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view their own balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can insert balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can update balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can delete balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Staff can view all balance transactions" ON balance_transactions;

-- Drop the table (cascades FKs)
DROP TABLE IF EXISTS balance_transactions CASCADE;

-- Drop related enums
DROP TYPE IF EXISTS balance_tx_type CASCADE;
DROP TYPE IF EXISTS balance_transaction_ref_type CASCADE;

-- =============================================================
-- STEP 2: Create transaction_type enum and transactions table
-- =============================================================

CREATE TYPE transaction_type AS ENUM (
  'payment',
  'guest_fee',
  'earning',
  'commission_base',
  'commission_promo',
  'refund',
  'withdrawal',
  'cash_commission',
  'reversal'
);

CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  type            transaction_type NOT NULL,
  amount          numeric NOT NULL,
  booking_id      uuid REFERENCES bookings(id),
  refund_id       uuid REFERENCES refunds(id),
  payout_id       uuid REFERENCES payouts(id),
  reversal_of_id  uuid REFERENCES transactions(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  notes           text,

  CONSTRAINT transactions_has_reference
    CHECK (booking_id IS NOT NULL OR payout_id IS NOT NULL OR refund_id IS NOT NULL),

  CONSTRAINT transactions_reversal_integrity
    CHECK (
      (type = 'reversal' AND reversal_of_id IS NOT NULL)
      OR
      (type != 'reversal' AND reversal_of_id IS NULL)
    )
);

-- Prevent double-reversals
CREATE UNIQUE INDEX transactions_single_reversal
  ON transactions (reversal_of_id) WHERE reversal_of_id IS NOT NULL;

-- Query performance indexes
CREATE INDEX transactions_user_id ON transactions (user_id);
CREATE INDEX transactions_booking_id ON transactions (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX transactions_payout_id ON transactions (payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX transactions_refund_id ON transactions (refund_id) WHERE refund_id IS NOT NULL;

-- Reversal sign enforcement trigger
CREATE OR REPLACE FUNCTION check_reversal_sign()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'reversal' THEN
    IF NEW.amount != -1 * (SELECT amount FROM transactions WHERE id = NEW.reversal_of_id) THEN
      RAISE EXCEPTION 'Reversal amount must be opposite sign of original transaction';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_reversal_sign
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_reversal_sign();

-- RLS policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Staff can view all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All transaction creation happens server-side via service_role client.

-- =============================================================
-- STEP 3: Rename escrow_transactions → escrow
-- =============================================================

-- Drop old RLS policies (they reference the old table name)
DROP POLICY IF EXISTS "Users can view escrow for their bookings" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can manage escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Staff can view all escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can insert escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can update escrow transactions" ON escrow_transactions;

ALTER TABLE escrow_transactions RENAME TO escrow;

-- Recreate RLS policies with new table name
CREATE POLICY "Users can view escrow for their bookings" ON escrow
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings WHERE user_id = auth.uid()
      UNION
      SELECT b.id FROM bookings b
        JOIN listings l ON b.listing_id = l.id
        WHERE l.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all escrow" ON escrow
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid())
  );

-- =============================================================
-- STEP 4: Drop amount from escrow
-- =============================================================

ALTER TABLE escrow DROP COLUMN IF EXISTS amount;

-- =============================================================
-- STEP 5: Drop amount from payouts
-- =============================================================

ALTER TABLE payouts DROP COLUMN IF EXISTS amount;

-- =============================================================
-- STEP 6: Rewrite get_user_balance() function
-- =============================================================

CREATE OR REPLACE FUNCTION get_user_balance(p_user_id uuid)
RETURNS TABLE (
  available_balance numeric,
  on_hold_balance   numeric,
  total_earned      numeric
) AS $$
DECLARE
  v_total numeric;
  v_guest_held numeric;
  v_host_held numeric;
  v_earned numeric;
BEGIN
  -- Total ledger balance (all transactions)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total
  FROM transactions t
  WHERE t.user_id = p_user_id;

  -- Guest on-hold: user's payment + guest_fee txns on bookings still in escrow
  SELECT COALESCE(ABS(SUM(t.amount)), 0)
  INTO v_guest_held
  FROM transactions t
  JOIN bookings b ON t.booking_id = b.id
  WHERE t.user_id = p_user_id
    AND t.type IN ('payment', 'guest_fee')
    AND b.escrow_status = 'held';

  -- Host on-hold: expected payouts for bookings on user's listings that are held
  -- No host transactions exist yet (created at release), so derive from booking fees
  SELECT COALESCE(SUM(fees.host_payout), 0)
  INTO v_host_held
  FROM bookings b
  JOIN listings l ON b.listing_id = l.id
  CROSS JOIN LATERAL calc_booking_fees(b.id) AS fees
  WHERE l.user_id = p_user_id
    AND b.escrow_status = 'held';

  -- Total earned: only earning-type transactions
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_earned
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.type = 'earning';

  available_balance := v_total - v_guest_held;
  on_hold_balance := v_guest_held + v_host_held;
  total_earned := v_earned;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================
-- STEP 7: Drop functions that are no longer needed
-- =============================================================

DROP FUNCTION IF EXISTS calc_payout_amounts(uuid);
DROP FUNCTION IF EXISTS create_payout_for_booking(uuid, numeric);
