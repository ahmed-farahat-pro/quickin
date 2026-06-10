-- User Management Migration
-- Creates tables for warnings, bans, and admin messaging

-- =============================================
-- USER WARNINGS TABLE (Graduated Warning System)
-- =============================================

CREATE TABLE user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Warning details
  warning_level INTEGER NOT NULL CHECK (warning_level BETWEEN 1 AND 3),
  -- 1 = Formal Warning (first offense)
  -- 2 = Formal Warning (second offense)
  -- 3 = Final Warning (last chance before ban)
  
  reason TEXT NOT NULL,
  details TEXT, -- Extended description
  
  -- Related entity (optional)
  related_entity_type TEXT CHECK (related_entity_type IN ('listing', 'booking', 'review', 'message')),
  related_entity_id UUID,
  
  -- Staff tracking
  issued_by UUID NOT NULL REFERENCES staff_profiles(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- For time-limited warnings
  
  -- Acknowledgement
  acknowledged_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_user_warnings_user ON user_warnings(user_id);
CREATE INDEX idx_user_warnings_level ON user_warnings(warning_level);
CREATE INDEX idx_user_warnings_active ON user_warnings(is_active) WHERE is_active = true;
CREATE INDEX idx_user_warnings_created ON user_warnings(created_at DESC);

-- =============================================
-- USER BANS TABLE
-- =============================================

CREATE TABLE user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Ban details
  ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  reason TEXT NOT NULL,
  details TEXT, -- Extended description
  
  -- Duration (for temporary bans)
  duration_days INTEGER, -- NULL for permanent
  expires_at TIMESTAMPTZ, -- NULL for permanent
  
  -- Staff tracking
  banned_by UUID NOT NULL REFERENCES staff_profiles(id),
  unbanned_by UUID REFERENCES staff_profiles(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  unbanned_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_user_bans_user ON user_bans(user_id);
CREATE INDEX idx_user_bans_active ON user_bans(is_active) WHERE is_active = true;
CREATE INDEX idx_user_bans_expires ON user_bans(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================
-- ADMIN MESSAGES TABLE (Staff-to-User Messaging)
-- =============================================

CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Message content
  category TEXT NOT NULL CHECK (category IN ('warning', 'approval', 'rejection', 'notice', 'ban')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Related entity (optional)
  related_entity_type TEXT CHECK (related_entity_type IN ('listing', 'booking', 'review', 'payout', 'warning', 'ban', 'attribute', 'condition')),
  related_entity_id UUID,
  
  -- Sender
  sent_by UUID NOT NULL REFERENCES staff_profiles(id),
  
  -- Read tracking
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_admin_messages_user ON admin_messages(user_id);
CREATE INDEX idx_admin_messages_category ON admin_messages(category);
CREATE INDEX idx_admin_messages_unread ON admin_messages(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_admin_messages_created ON admin_messages(created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own warnings
CREATE POLICY "Users can view own warnings"
  ON user_warnings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can view all warnings
CREATE POLICY "Staff can view all warnings"
  ON user_warnings FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can insert warnings
CREATE POLICY "Staff can insert warnings"
  ON user_warnings FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- Staff can update warnings
CREATE POLICY "Staff can update warnings"
  ON user_warnings FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- Users can view their own bans
CREATE POLICY "Users can view own bans"
  ON user_bans FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can view all bans
CREATE POLICY "Staff can view all bans"
  ON user_bans FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can insert bans
CREATE POLICY "Staff can insert bans"
  ON user_bans FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- Staff can update bans (for unbanning)
CREATE POLICY "Staff can update bans"
  ON user_bans FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- Users can view their own admin messages
CREATE POLICY "Users can view own admin messages"
  ON admin_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update own admin messages"
  ON admin_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can view all admin messages
CREATE POLICY "Staff can view all admin messages"
  ON admin_messages FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can insert admin messages
CREATE POLICY "Staff can insert admin messages"
  ON admin_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_bans 
    WHERE user_id = p_user_id 
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user warning count
CREATE OR REPLACE FUNCTION get_user_warning_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM user_warnings 
    WHERE user_id = p_user_id 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's highest warning level
CREATE OR REPLACE FUNCTION get_user_max_warning_level(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE((
    SELECT MAX(warning_level) FROM user_warnings 
    WHERE user_id = p_user_id 
    AND is_active = true
  ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread message count for user
CREATE OR REPLACE FUNCTION get_unread_admin_message_count(p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM admin_messages 
    WHERE user_id = p_user_id 
    AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_user_banned TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_warning_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_max_warning_level TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_admin_message_count TO authenticated;
