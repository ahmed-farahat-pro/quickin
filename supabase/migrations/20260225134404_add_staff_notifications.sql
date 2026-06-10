CREATE TABLE staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_id UUID,
  related_entity_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all notifications" ON staff_notifications
  FOR SELECT USING (EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid()));

CREATE POLICY "Staff can update notifications" ON staff_notifications
  FOR UPDATE USING (EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid()));

-- Trigger for new bookings
CREATE OR REPLACE FUNCTION notify_admin_new_booking()
RETURNS TRIGGER AS $$
DECLARE
  listing_title TEXT;
BEGIN
  -- Get listing title for better message
  SELECT title INTO listing_title FROM listings WHERE id = NEW.listing_id;

  INSERT INTO staff_notifications (type, title, message, related_entity_id, related_entity_type)
  VALUES (
    'new_booking',
    'New Booking Request',
    'A new booking request (' || NEW.reservation_code || ') has been submitted for: ' || COALESCE(listing_title, 'Unknown Listing'),
    NEW.id,
    'booking'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_booking_notification
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_booking();;
