
CREATE OR REPLACE FUNCTION get_active_destinations_with_coords()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  label TEXT,
  description TEXT,
  image_url TEXT,
  type TEXT,
  country TEXT,
  include_surrounding BOOLEAN,
  listing_ids UUID[],
  is_active BOOLEAN,
  radius_km DOUBLE PRECISION,
  display_order INTEGER,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id,
    created_at,
    label,
    description,
    image_url,
    type::TEXT,
    country,
    include_surrounding,
    listing_ids,
    is_active,
    radius_km,
    display_order,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng
  FROM search_destinations
  WHERE is_active = TRUE
  ORDER BY display_order ASC NULLS LAST, created_at DESC;
$$;
;
