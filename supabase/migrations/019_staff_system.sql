-- Staff System Migration
-- Creates staff_profiles table for admin dashboard access

-- =============================================
-- STAFF PROFILES TABLE
-- =============================================

CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('admin', 'moderator')),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES staff_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_staff_profiles_role ON staff_profiles(role);
CREATE INDEX idx_staff_profiles_active ON staff_profiles(is_active) WHERE is_active = true;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own staff profile (no recursion)
CREATE POLICY "Users can view own staff profile"
  ON staff_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Staff can view all staff profiles (uses function to avoid recursion)
CREATE POLICY "Staff can view all staff profiles"
  ON staff_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp 
      WHERE sp.id = auth.uid() AND sp.is_active = true
    )
  );

-- Only admins can insert new staff
CREATE POLICY "Admins can insert staff"
  ON staff_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles sp 
      WHERE sp.id = auth.uid() AND sp.role = 'admin' AND sp.is_active = true
    )
  );

-- Only admins can update staff profiles
CREATE POLICY "Admins can update staff"
  ON staff_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp 
      WHERE sp.id = auth.uid() AND sp.role = 'admin' AND sp.is_active = true
    )
  );

-- =============================================
-- HELPER FUNCTION: Check if user is staff
-- =============================================

CREATE OR REPLACE FUNCTION is_staff(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_profiles 
    WHERE id = user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTION: Check if user is admin
-- =============================================

CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_profiles 
    WHERE id = user_id AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTION: Get staff role
-- =============================================

CREATE OR REPLACE FUNCTION get_staff_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
  staff_role TEXT;
BEGIN
  SELECT role INTO staff_role 
  FROM staff_profiles 
  WHERE id = user_id AND is_active = true;
  RETURN staff_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SEED FIRST ADMIN (Platform Owner)
-- =============================================
-- NOTE: Replace 'YOUR_USER_ID_HERE' with your actual auth.users UUID
-- You can find this in Supabase Dashboard > Authentication > Users

-- Example (uncomment and modify):
-- INSERT INTO staff_profiles (id, role, display_name, email)
-- VALUES (
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', -- Your user UUID
--   'admin',
--   'Platform Owner',
--   'your-email@example.com'
-- );

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION is_staff TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_role TO authenticated;
