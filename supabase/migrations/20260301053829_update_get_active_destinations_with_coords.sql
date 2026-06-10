CREATE OR REPLACE FUNCTION public.get_active_destinations_with_coords(p_locale text DEFAULT 'en'::text)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, label text, description text, image_url text, type text, country text, include_surrounding boolean, listing_ids uuid[], is_active boolean, radius_km double precision, display_order integer, lat double precision, lng double precision)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    id,
    created_at,
    COALESCE(translations->>p_locale, label),
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
$function$;
