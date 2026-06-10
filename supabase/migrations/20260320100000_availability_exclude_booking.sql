-- Extend check_listing_availability with an optional p_exclude_booking_id param.
-- When editing a booking's dates, pass its ID so its own range is not treated
-- as a conflict.  The DEFAULT NULL keeps existing 3-arg calls working.

CREATE OR REPLACE FUNCTION check_listing_availability(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (has_conflict boolean, conflict_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Check for host-blocked dates in [check_in, check_out)
  IF EXISTS (
    SELECT 1
    FROM listing_availability la
    WHERE la.listing_id = p_listing_id
      AND la.is_available = false
      AND la.date >= p_check_in
      AND la.date < p_check_out
  ) THEN
    RETURN QUERY SELECT true, 'Selected dates include unavailable dates'::text;
    RETURN;
  END IF;

  -- 2. Check for overlapping confirmed/active/pending bookings
  --    Exclude the given booking so edits don't conflict with themselves.
  IF EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.listing_id = p_listing_id
      AND b.status IN ('confirmed', 'active', 'pending')
      AND b.check_in < p_check_out
      AND b.check_out > p_check_in
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
  ) THEN
    RETURN QUERY SELECT true, 'Selected dates overlap with an existing booking'::text;
    RETURN;
  END IF;

  -- No conflicts
  RETURN QUERY SELECT false, NULL::text;
END;
$$;

-- Grant execute on the new 4-param overload
GRANT EXECUTE ON FUNCTION check_listing_availability(uuid, date, date, uuid) TO anon, authenticated, service_role;
