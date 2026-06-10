-- Drop insecure UPDATE policies on bookings table
-- We are moving all booking updates to secure Server Actions to prevent arbitrary modification of financial fields

DROP POLICY IF EXISTS "Hosts can update bookings for their listings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;

-- Add default settings for booking timeouts if they don't exist yet
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('auto_complete_days', '3', 'Number of days after check-out to automatically complete a booking and release funds'),
  ('auto_cancel_days', '2', 'Number of days to automatically cancel a pending booking waiting for payment')
ON CONFLICT (key) DO NOTHING;
