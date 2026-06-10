-- Financial System Migration
-- Creates tables for payouts and payment verifications

-- =============================================
-- PAYOUTS TABLE
-- =============================================

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Amounts
  gross_amount DECIMAL(10, 2) NOT NULL, -- Total booking amount
  commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.10, -- Platform commission (10%)
  commission_amount DECIMAL(10, 2) NOT NULL, -- Calculated commission
  net_amount DECIMAL(10, 2) NOT NULL, -- Amount to pay host
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Payout details
  payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'vodafone_cash', 'instapay')),
  payout_reference TEXT, -- External transaction reference
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Staff tracking
  processed_by UUID REFERENCES staff_profiles(id),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_payouts_host ON payouts(host_id);
CREATE INDEX idx_payouts_booking ON payouts(booking_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created ON payouts(created_at DESC);

-- =============================================
-- PAYMENT VERIFICATIONS TABLE
-- For manual verification of Vodafone Cash/InstaPay payments
-- =============================================

CREATE TABLE payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Payment details
  payment_method TEXT NOT NULL CHECK (payment_method IN ('vodafone_cash', 'instapay', 'bank_transfer')),
  amount DECIMAL(10, 2) NOT NULL,
  transaction_reference TEXT, -- Guest-provided reference number
  
  -- Receipt
  receipt_url TEXT, -- Uploaded receipt image
  
  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  
  -- Staff tracking
  verified_by UUID REFERENCES staff_profiles(id)
);

-- Indexes
CREATE INDEX idx_payment_verifications_booking ON payment_verifications(booking_id);
CREATE INDEX idx_payment_verifications_guest ON payment_verifications(guest_id);
CREATE INDEX idx_payment_verifications_status ON payment_verifications(status);
CREATE INDEX idx_payment_verifications_created ON payment_verifications(created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

-- Hosts can view their own payouts
CREATE POLICY "Hosts can view own payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (host_id = auth.uid());

-- Staff can view all payouts
CREATE POLICY "Staff can view all payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can insert payouts
CREATE POLICY "Staff can insert payouts"
  ON payouts FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- Staff can update payouts
CREATE POLICY "Staff can update payouts"
  ON payouts FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- Guests can view their own payment verifications
CREATE POLICY "Guests can view own payment verifications"
  ON payment_verifications FOR SELECT
  TO authenticated
  USING (guest_id = auth.uid());

-- Guests can insert payment verifications for their bookings
CREATE POLICY "Guests can insert payment verifications"
  ON payment_verifications FOR INSERT
  TO authenticated
  WITH CHECK (guest_id = auth.uid());

-- Staff can view all payment verifications
CREATE POLICY "Staff can view all payment verifications"
  ON payment_verifications FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can update payment verifications
CREATE POLICY "Staff can update payment verifications"
  ON payment_verifications FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- =============================================
-- HELPER FUNCTION: Create payout for booking
-- =============================================

CREATE OR REPLACE FUNCTION create_payout_for_booking(
  p_booking_id UUID,
  p_commission_rate DECIMAL DEFAULT 0.10
)
RETURNS UUID AS $$
DECLARE
  v_payout_id UUID;
  v_host_id UUID;
  v_gross_amount DECIMAL;
  v_commission_amount DECIMAL;
  v_net_amount DECIMAL;
BEGIN
  -- Get booking details
  SELECT 
    l.host_id,
    b.total_price
  INTO v_host_id, v_gross_amount
  FROM bookings b
  JOIN listings l ON b.listing_id = l.id
  WHERE b.id = p_booking_id;

  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Calculate amounts
  v_commission_amount := v_gross_amount * p_commission_rate;
  v_net_amount := v_gross_amount - v_commission_amount;

  -- Create payout record
  INSERT INTO payouts (
    host_id, booking_id, gross_amount, commission_rate, 
    commission_amount, net_amount, status
  ) VALUES (
    v_host_id, p_booking_id, v_gross_amount, p_commission_rate,
    v_commission_amount, v_net_amount, 'pending'
  ) RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_payout_for_booking TO authenticated;
