
DROP FUNCTION IF EXISTS get_destination_with_wkt(UUID);

CREATE OR REPLACE FUNCTION get_destination_with_wkt(dest_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  label TEXT,
  description TEXT,
  image_url TEXT,
  type TEXT,
  country TEXT,
  include_surrounding BOOLEAN,
  listing_ids UUID[],
  is_active BOOLEAN,
  radius_km DOUBLE PRECISION,
  location TEXT,
  display_order INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    id,
    created_at,
    updated_at,
    label,
    description,
    image_url,
    type::TEXT,
    country,
    include_surrounding,
    listing_ids,
    is_active,
    radius_km,
    ST_AsText(location) AS location,
    display_order
  FROM search_destinations
  WHERE id = dest_id;
$$;
;
