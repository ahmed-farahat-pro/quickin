-- Secure function to get booked dates for a listing
-- This replaces the need for admin client access, providing better security (least privilege)
-- It exposes ONLY the check-in and check-out dates for confirmed bookings
-- Returns a set of date ranges

CREATE OR REPLACE FUNCTION get_listing_booked_dates(listing_uuid uuid)
RETURNS TABLE (check_in date, check_out date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.check_in, b.check_out
  FROM bookings b
  WHERE b.listing_id = listing_uuid
  AND b.status = 'confirmed';
END;
$$;

-- Allow public access (anyone can see availability)
GRANT EXECUTE ON FUNCTION get_listing_booked_dates(uuid) TO anon, authenticated, service_role;
