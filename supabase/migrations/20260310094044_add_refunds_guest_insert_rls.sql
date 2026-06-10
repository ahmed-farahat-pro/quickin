
-- Allow guests to create refund records for their own bookings
CREATE POLICY "Guests can create refunds for their bookings"
  ON refunds FOR INSERT
  TO authenticated
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b WHERE b.user_id = auth.uid()
    )
  );
;
