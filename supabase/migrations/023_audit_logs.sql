-- Audit Logs Migration
-- Creates comprehensive audit logging for admin actions

-- =============================================
-- AUDIT LOGS TABLE
-- =============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor identification
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'staff', 'admin', 'system')),
  actor_email TEXT, -- Denormalized for quick reference
  
  -- Action details
  action TEXT NOT NULL, -- e.g., 'listing.activate', 'user.ban', 'booking.confirm'
  action_category TEXT, -- e.g., 'user_management', 'content', 'financial'
  
  -- Target entity
  entity_type TEXT, -- e.g., 'listing', 'user', 'booking', 'payout'
  entity_id UUID,
  entity_name TEXT, -- Denormalized for display (e.g., listing title, user name)
  
  -- Data snapshots
  old_data JSONB, -- State before action
  new_data JSONB, -- State after action
  changes JSONB, -- Specific fields that changed
  
  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  request_id TEXT, -- For correlating with application logs
  
  -- Additional context
  metadata JSONB, -- Any extra context
  notes TEXT, -- Admin notes/reason for action
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES FOR EFFICIENT QUERYING
-- =============================================

-- Primary query patterns
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_actor_type ON audit_logs(actor_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Composite indexes for common filters
CREATE INDEX idx_audit_logs_actor_action ON audit_logs(actor_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_entity_action ON audit_logs(entity_type, entity_id, action, created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only staff can view audit logs
CREATE POLICY "Staff can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Only staff can insert audit logs
CREATE POLICY "Staff can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- System can insert via service role (no RLS check)
-- This is handled by using service_role key for system-generated logs

-- =============================================
-- HELPER FUNCTION: Create audit log entry
-- =============================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_actor_type TEXT;
  v_actor_email TEXT;
  v_action_category TEXT;
BEGIN
  -- Determine actor type
  IF is_admin(auth.uid()) THEN
    v_actor_type := 'admin';
  ELSIF is_staff(auth.uid()) THEN
    v_actor_type := 'staff';
  ELSE
    v_actor_type := 'user';
  END IF;

  -- Get actor email
  SELECT email INTO v_actor_email
  FROM auth.users WHERE id = auth.uid();

  -- Determine action category from action name
  v_action_category := split_part(p_action, '.', 1);

  -- Insert audit log
  INSERT INTO audit_logs (
    actor_id, actor_type, actor_email,
    action, action_category,
    entity_type, entity_id, entity_name,
    old_data, new_data,
    notes, metadata
  ) VALUES (
    auth.uid(), v_actor_type, v_actor_email,
    p_action, v_action_category,
    p_entity_type, p_entity_id, p_entity_name,
    p_old_data, p_new_data,
    p_notes, p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_audit_log TO authenticated;

-- =============================================
-- ACTION CONSTANTS REFERENCE
-- =============================================
-- These are the standard action names to use:
--
-- User Management:
--   user.warn, user.ban, user.unban, user.message
--
-- Content Management:
--   listing.activate, listing.deactivate, listing.delete
--   attribute.approve, attribute.reject
--   condition.approve, condition.reject
--
-- Financial:
--   payout.process, payout.complete, payout.fail
--   payment.verify, payment.reject
--
-- Disputes:
--   dispute.open, dispute.assign, dispute.resolve, dispute.close
--
-- Staff:
--   staff.create, staff.deactivate, staff.update
--
-- Booking:
--   booking.cancel_admin, booking.refund
-- =============================================
