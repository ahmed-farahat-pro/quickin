
CREATE OR REPLACE FUNCTION get_destination_with_wkt(dest_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  label TEXT,
  description TEXT,
  image_url TEXT,
  type TEXT,
  country TEXT,
  include_surrounding BOOLEAN,
  listing_ids TEXT[],
  is_active BOOLEAN,
  radius_km NUMERIC,
  location TEXT,
  display_order INTEGER
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
    ST_AsText(location) AS location,
    display_order
  FROM search_destinations
  WHERE id = dest_id;
$$;
;
