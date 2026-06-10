-- Validates that a date range has no blocked or booked dates for a listing.
-- Returns a single row: has_conflict (boolean) and conflict_reason (text).
-- SECURITY DEFINER so it can see all bookings regardless of RLS.
-- Only exposes a boolean + reason string — no raw booking data leaks.

CREATE OR REPLACE FUNCTION check_listing_availability(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date
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
  IF EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.listing_id = p_listing_id
      AND b.status IN ('confirmed', 'active', 'pending')
      AND b.check_in < p_check_out
      AND b.check_out > p_check_in
  ) THEN
    RETURN QUERY SELECT true, 'Selected dates overlap with an existing booking'::text;
    RETURN;
  END IF;

  -- No conflicts
  RETURN QUERY SELECT false, NULL::text;
END;
$$;

-- Allow authenticated users to check availability (no sensitive data exposed)
GRANT EXECUTE ON FUNCTION check_listing_availability(uuid, date, date) TO anon, authenticated, service_role;;
