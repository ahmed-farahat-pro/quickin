-- Disputes System Migration
-- Creates tables for dispute resolution

-- =============================================
-- DISPUTES TABLE
-- =============================================

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Disputed parties
  guest_id UUID NOT NULL REFERENCES profiles(id),
  host_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Dispute details
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('cancellation', 'refund', 'complaint', 'property_issue', 'payment_issue', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_guest', 'pending_host', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Assignment
  assigned_to UUID REFERENCES staff_profiles(id),
  
  -- Resolution
  resolution_type TEXT CHECK (resolution_type IN ('full_refund', 'partial_refund', 'no_refund', 'host_favor', 'guest_favor', 'mutual_agreement', 'dismissed')),
  resolution_notes TEXT,
  refund_amount DECIMAL(10, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Who opened it
  opened_by TEXT NOT NULL CHECK (opened_by IN ('guest', 'host', 'admin'))
);

-- Indexes
CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_guest ON disputes(guest_id);
CREATE INDEX idx_disputes_host ON disputes(host_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_assigned ON disputes(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_disputes_priority ON disputes(priority, created_at DESC);
CREATE INDEX idx_disputes_created ON disputes(created_at DESC);

-- =============================================
-- DISPUTE MESSAGES TABLE
-- =============================================

CREATE TABLE dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('guest', 'host', 'staff', 'admin', 'system')),
  
  -- Message content
  message TEXT NOT NULL,
  
  -- Attachments (optional)
  attachments JSONB, -- Array of {url, filename, type}
  
  -- Internal notes (only visible to staff)
  is_internal BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dispute_messages_dispute ON dispute_messages(dispute_id);
CREATE INDEX idx_dispute_messages_sender ON dispute_messages(sender_id);
CREATE INDEX idx_dispute_messages_created ON dispute_messages(created_at);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

-- Users can view disputes they're involved in
CREATE POLICY "Users can view own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (guest_id = auth.uid() OR host_id = auth.uid());

-- Users can insert disputes for their bookings
CREATE POLICY "Users can create disputes"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    guest_id = auth.uid() OR host_id = auth.uid()
  );

-- Staff can view all disputes
CREATE POLICY "Staff can view all disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can update disputes
CREATE POLICY "Staff can update disputes"
  ON disputes FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- Users can view non-internal messages in their disputes
CREATE POLICY "Users can view dispute messages"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM disputes d 
      WHERE d.id = dispute_id 
      AND (d.guest_id = auth.uid() OR d.host_id = auth.uid())
    )
  );

-- Staff can view all messages including internal
CREATE POLICY "Staff can view all dispute messages"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Users can insert messages in their disputes
CREATE POLICY "Users can add dispute messages"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    NOT is_internal AND
    EXISTS (
      SELECT 1 FROM disputes d 
      WHERE d.id = dispute_id 
      AND (d.guest_id = auth.uid() OR d.host_id = auth.uid())
    )
  );

-- Staff can insert messages (including internal)
CREATE POLICY "Staff can add dispute messages"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- =============================================
-- UPDATE TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_dispute_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispute_updated
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_dispute_timestamp();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get open dispute count for a booking
CREATE OR REPLACE FUNCTION get_booking_dispute_count(p_booking_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM disputes 
    WHERE booking_id = p_booking_id 
    AND status NOT IN ('resolved', 'closed')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's active disputes count
CREATE OR REPLACE FUNCTION get_user_active_disputes(p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM disputes 
    WHERE (guest_id = p_user_id OR host_id = p_user_id)
    AND status NOT IN ('resolved', 'closed')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_booking_dispute_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_disputes TO authenticated;
