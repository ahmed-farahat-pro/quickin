-- Create booking_messages table
CREATE TABLE booking_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_booking_messages_booking_id ON booking_messages(booking_id);
CREATE INDEX idx_booking_messages_created_at ON booking_messages(created_at DESC);

-- Enable RLS
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

-- Guests can select and insert messages for their bookings
CREATE POLICY "Guests can access messages for their bookings"
  ON booking_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Guests can send messages for their bookings"
  ON booking_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Hosts can select and insert messages for their listings' bookings
CREATE POLICY "Hosts can access messages for their listings"
  ON booking_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON b.listing_id = l.id
      WHERE b.id = booking_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can send messages for their listings"
  ON booking_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON b.listing_id = l.id
      WHERE b.id = booking_id AND l.user_id = auth.uid()
    )
  );

-- Admins can access and send messages for all bookings
CREATE POLICY "Staff can access all booking messages"
  ON booking_messages FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can send messages for all bookings"
  ON booking_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND is_staff(auth.uid())
  );

-- Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE booking_messages;;
