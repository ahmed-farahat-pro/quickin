-- =============================================================================
-- Migration: Add sorting parameters to search_listings
-- =============================================================================

-- Drop existing function if return type changed (PG requires this)
-- Dropping all potential previous versions to be safe
DROP FUNCTION IF EXISTS search_listings(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  UUID[], TEXT, BOOLEAN, TEXT, TEXT[], INT, NUMERIC, NUMERIC,
  DATE, DATE, TEXT[], BOOLEAN, INT, INT
);

DROP FUNCTION IF EXISTS search_listings(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  UUID[], TEXT, BOOLEAN, TEXT, TEXT[], INT, NUMERIC, NUMERIC,
  DATE, DATE, TEXT[], BOOLEAN, INT, INT, TEXT
);

DROP FUNCTION IF EXISTS search_listings(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  UUID[], TEXT, BOOLEAN, TEXT, TEXT[], INT, NUMERIC, NUMERIC,
  DATE, DATE, TEXT[], BOOLEAN, INT, INT, TEXT, TEXT, UUID
);

-- Single RPC function that handles ALL search filtering in one roundtrip
CREATE OR REPLACE FUNCTION search_listings(
  -- Location / geo
  p_location TEXT DEFAULT NULL,
  p_geo_lat DOUBLE PRECISION DEFAULT NULL,
  p_geo_lng DOUBLE PRECISION DEFAULT NULL,
  p_geo_radius_km DOUBLE PRECISION DEFAULT NULL,
  p_specific_ids UUID[] DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_include_surrounding BOOLEAN DEFAULT TRUE,
  -- Filters
  p_category_slug TEXT DEFAULT NULL,
  p_property_type_slugs TEXT[] DEFAULT NULL,
  p_guests INT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_check_in DATE DEFAULT NULL,
  p_check_out DATE DEFAULT NULL,
  p_attribute_codes TEXT[] DEFAULT NULL,
  p_best_offer BOOLEAN DEFAULT FALSE,
  -- Pagination
  p_limit INT DEFAULT 12,
  p_offset INT DEFAULT 0,
  p_locale TEXT DEFAULT 'en',
  -- Sorting & Personalization
  p_sort_by TEXT DEFAULT 'recommended',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  -- Listing columns
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  price_per_night NUMERIC,
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  max_guests INT,
  bedrooms INT,
  beds INT,
  bathrooms INT,
  property_type_id UUID,
  is_guest_favorite BOOLEAN,
  is_published BOOLEAN,
  cleaning_fee NUMERIC,
  currency TEXT,
  cancellation_policy TEXT,
  listing_code CHAR(4),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Aggregated fields
  avg_rating NUMERIC,
  review_count BIGINT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  best_offer_price NUMERIC,
  -- Computed pricing
  display_price NUMERIC,
  total_price NUMERIC,
  num_nights INT,
  -- JSON aggregated relations
  host_json JSONB,
  property_type_json JSONB,
  lifestyles_json JSONB,
  images_json JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id UUID;
  v_lifestyle_listing_ids UUID[];
  v_property_type_ids UUID[];
  v_offer_listing_ids UUID[];
  v_attribute_ids UUID[];
  v_blocked_listing_ids UUID[];
  
  -- User preference variables
  v_pref_cities UUID[];
  v_pref_countries UUID[];
  v_pref_avg_price NUMERIC;
  v_pref_property_types UUID[];
  v_pref_lifestyles UUID[];
BEGIN
  -- 1. Resolve category slug -> listing IDs via M2M
  IF p_category_slug IS NOT NULL THEN
    SELECT lc.id INTO v_category_id FROM public.lifestyle_categories lc WHERE lc.slug = p_category_slug LIMIT 1;
    IF v_category_id IS NOT NULL THEN
      SELECT array_agg(ll.listing_id) INTO v_lifestyle_listing_ids FROM public.listing_lifestyles ll WHERE ll.lifestyle_category_id = v_category_id;
    END IF;
    IF v_lifestyle_listing_ids IS NULL THEN v_lifestyle_listing_ids := ARRAY[]::UUID[]; END IF;
  END IF;

  -- 2. Resolve property type slugs -> IDs
  IF p_property_type_slugs IS NOT NULL AND array_length(p_property_type_slugs, 1) > 0 THEN
    SELECT array_agg(pt.id) INTO v_property_type_ids FROM public.property_types pt WHERE pt.slug = ANY(p_property_type_slugs);
  END IF;

  -- 3. Resolve best offer listing IDs
  IF p_best_offer THEN
    SELECT array_agg(DISTINCT lbo.listing_id) INTO v_offer_listing_ids FROM public.listing_best_offers lbo WHERE lbo.status = 'approved' AND lbo.start_date <= (CURRENT_DATE + 7) AND lbo.end_date >= CURRENT_DATE;
    IF v_offer_listing_ids IS NULL THEN v_offer_listing_ids := ARRAY[]::UUID[]; END IF;
  END IF;

  -- 4. Resolve attribute codes -> IDs for ALL-match filter
  IF p_attribute_codes IS NOT NULL AND array_length(p_attribute_codes, 1) > 0 THEN
    SELECT array_agg(a.id) INTO v_attribute_ids FROM public.attributes a WHERE a.code = ANY(p_attribute_codes);
  END IF;

  -- 5. Find blocked listings (by bookings or availability) for date filter
  IF p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
    SELECT array_agg(DISTINCT blocked_id) INTO v_blocked_listing_ids FROM (
      SELECT b.listing_id AS blocked_id FROM public.bookings b WHERE b.status IN ('confirmed', 'pending') AND b.check_in < p_check_out AND b.check_out > p_check_in
      UNION
      SELECT la.listing_id AS blocked_id FROM public.listing_availability la WHERE la.is_available = FALSE AND la.date >= p_check_in AND la.date <= p_check_out
    ) AS blocked;
  END IF;

  -- 6. Gather User Preferences if sorting by recommended and user is provided
  IF p_sort_by = 'recommended' AND p_user_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT l.city_id), array_agg(DISTINCT l.country_id), AVG(l.price_per_night)
    INTO v_pref_cities, v_pref_countries, v_pref_avg_price
    FROM public.bookings b JOIN public.listings l ON b.listing_id = l.id WHERE b.user_id = p_user_id;

    SELECT array_agg(DISTINCT l.property_type_id) INTO v_pref_property_types
    FROM (
      SELECT bk.listing_id FROM public.bookings bk WHERE bk.user_id = p_user_id 
      UNION 
      SELECT wi.listing_id FROM public.wishlist_items wi JOIN public.wishlists w ON wi.wishlist_id = w.id WHERE w.user_id = p_user_id
    ) user_listings
    JOIN public.listings l ON l.id = user_listings.listing_id;

    SELECT array_agg(DISTINCT ll.lifestyle_category_id) INTO v_pref_lifestyles
    FROM (
      SELECT bk2.listing_id FROM public.bookings bk2 WHERE bk2.user_id = p_user_id 
      UNION 
      SELECT wi2.listing_id FROM public.wishlist_items wi2 JOIN public.wishlists w2 ON wi2.wishlist_id = w2.id WHERE w2.user_id = p_user_id
    ) user_listings
    JOIN public.listing_lifestyles ll ON ll.listing_id = user_listings.listing_id;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT l.id AS lid,
      CASE
        WHEN p_sort_by = 'distance' AND p_geo_lat IS NOT NULL AND p_geo_lng IS NOT NULL THEN
           ST_Distance(l.location_geo, ST_SetSRID(ST_MakePoint(p_geo_lng, p_geo_lat), 4326))
        ELSE NULL
      END as distance_calc,
      CASE
        WHEN p_sort_by = 'recommended' AND p_user_id IS NOT NULL THEN
          (CASE WHEN l.city_id = ANY(v_pref_cities) OR l.country_id = ANY(v_pref_countries) THEN 1 ELSE 0 END) +
          (CASE WHEN l.price_per_night BETWEEN (COALESCE(v_pref_avg_price, 0) * 0.7) AND (COALESCE(v_pref_avg_price, 0) * 1.3) THEN 1 ELSE 0 END) +
          (CASE WHEN l.property_type_id = ANY(v_pref_property_types) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS (SELECT 1 FROM public.listing_lifestyles ll WHERE ll.listing_id = l.id AND ll.lifestyle_category_id = ANY(v_pref_lifestyles)) THEN 1 ELSE 0 END)
        ELSE 0
      END as match_score
    FROM public.listings l
    WHERE l.is_published = TRUE
      -- Specific IDs filter
      AND (p_specific_ids IS NULL OR l.id = ANY(p_specific_ids))
      -- Geo search filter
      AND (p_geo_lat IS NULL OR p_geo_lng IS NULL OR p_geo_radius_km IS NULL OR ST_DWithin(l.location_geo, ST_SetSRID(ST_MakePoint(p_geo_lng, p_geo_lat), 4326), p_geo_radius_km * 1000))
      -- Country enforcement
      AND (
        p_country IS NULL OR p_include_surrounding = TRUE
        OR EXISTS (SELECT 1 FROM public.countries co WHERE co.id = l.country_id AND (co.name ILIKE p_country OR co.iso2 ILIKE p_country))
      )
      -- Text location search
      AND (
        p_location IS NULL OR p_geo_lat IS NOT NULL OR p_specific_ids IS NOT NULL
        OR (
          l.title ILIKE '%' || p_location || '%'
          OR l.location ILIKE '%' || p_location || '%'
          OR EXISTS (SELECT 1 FROM public.cities ci WHERE ci.id = l.city_id AND ci.name ILIKE '%' || p_location || '%')
          OR EXISTS (SELECT 1 FROM public.countries co WHERE co.id = l.country_id AND co.name ILIKE '%' || p_location || '%')
          OR EXISTS (SELECT 1 FROM public.states st WHERE st.id = l.state_id AND st.name ILIKE '%' || p_location || '%')
        )
      )
      -- Category filter
      AND (p_category_slug IS NULL OR l.id = ANY(v_lifestyle_listing_ids))
      -- Property type filter
      AND (v_property_type_ids IS NULL OR l.property_type_id = ANY(v_property_type_ids))
      -- Guest capacity
      AND (p_guests IS NULL OR p_guests <= 0 OR l.max_guests >= p_guests)
      -- Price range
      AND (p_price_min IS NULL OR p_price_min <= 0 OR l.price_per_night >= p_price_min)
      AND (p_price_max IS NULL OR p_price_max <= 0 OR l.price_per_night <= p_price_max)
      -- Best offer filter
      AND (NOT p_best_offer OR l.id = ANY(v_offer_listing_ids))
      -- Date availability
      AND (v_blocked_listing_ids IS NULL OR NOT (l.id = ANY(v_blocked_listing_ids)))
      -- Attribute ALL-match filter
      AND (
        v_attribute_ids IS NULL
        OR (SELECT count(DISTINCT la2.attribute_id) FROM public.listing_attributes la2 WHERE la2.listing_id = l.id AND la2.attribute_id = ANY(v_attribute_ids)) = array_length(v_attribute_ids, 1)
      )
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    l.id, l.user_id,
    COALESCE((l.translations->p_locale->>'title'), l.title) AS title,
    COALESCE((l.translations->p_locale->>'description'), l.description) AS description,
    l.price_per_night, l.location,
    COALESCE((ci.translations->p_locale->>'name'), ci.name) AS city,
    COALESCE((st.translations->p_locale->>'name'), st.name) AS state,
    COALESCE((co.translations->p_locale->>'name'), co.name) AS country,
    l.max_guests, l.bedrooms, l.beds, l.bathrooms, l.property_type_id, l.is_guest_favorite, l.is_published,
    l.cleaning_fee, l.currency, l.cancellation_policy, l.listing_code, l.created_at, l.updated_at,
    COALESCE(r_agg.avg_rating, 0) AS avg_rating,
    COALESCE(r_agg.review_count, 0) AS review_count,
    CASE WHEN l.location_geo IS NOT NULL THEN ST_Y(l.location_geo::geometry) ELSE NULL END AS lat,
    CASE WHEN l.location_geo IS NOT NULL THEN ST_X(l.location_geo::geometry) ELSE NULL END AS lng,
    bo.offer_price AS best_offer_price,
    COALESCE(pricing.display_price, l.price_per_night) AS display_price,
    pricing.total_price AS total_price,
    pricing.num_nights AS num_nights,
    to_jsonb(p.*) AS host_json,
    CASE WHEN pt.id IS NOT NULL THEN to_jsonb(pt.*) ELSE NULL END AS property_type_json,
    COALESCE(ls_agg.lifestyles, '[]'::jsonb) AS lifestyles_json,
    COALESCE(img_agg.images, '[]'::jsonb) AS images_json,
    c.cnt AS total_count
  FROM filtered f
  CROSS JOIN counted c
  JOIN public.listings l ON l.id = f.lid
  LEFT JOIN public.profiles p ON p.id = l.user_id
  LEFT JOIN public.property_types pt ON pt.id = l.property_type_id
  LEFT JOIN public.cities ci ON ci.id = l.city_id
  LEFT JOIN public.states st ON st.id = l.state_id
  LEFT JOIN public.countries co ON co.id = l.country_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rv.rating)::numeric, 2) AS avg_rating, COUNT(rv.id) AS review_count
    FROM public.reviews rv WHERE rv.listing_id = l.id AND rv.is_hidden = false
  ) r_agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT lbo2.offer_price FROM public.listing_best_offers lbo2 WHERE lbo2.listing_id = l.id AND lbo2.status = 'approved' AND lbo2.end_date >= CURRENT_DATE AND lbo2.offer_price IS NOT NULL ORDER BY lbo2.offer_price ASC LIMIT 1
  ) bo ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
          ROUND((
            SELECT AVG(COALESCE(day_offer.offer_price, calculate_listing_price(l.id, d.d::DATE)))
            FROM generate_series(p_check_in, p_check_out - 1, '1 day'::interval) AS d(d)
            LEFT JOIN LATERAL (
              SELECT lbo3.offer_price FROM public.listing_best_offers lbo3 WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL AND d.d::DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND d.d::DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE ORDER BY lbo3.offer_price ASC LIMIT 1
            ) day_offer ON TRUE
          ), 2)
        ELSE
          COALESCE(
            (SELECT lbo3.offer_price FROM public.listing_best_offers lbo3 WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL AND CURRENT_DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND CURRENT_DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE ORDER BY lbo3.offer_price ASC LIMIT 1),
            calculate_listing_price(l.id, CURRENT_DATE)
          )
      END AS display_price,
      CASE
        WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
          ROUND((
            SELECT SUM(COALESCE(day_offer.offer_price, calculate_listing_price(l.id, d.d::DATE)))
            FROM generate_series(p_check_in, p_check_out - 1, '1 day'::interval) AS d(d)
            LEFT JOIN LATERAL (
              SELECT lbo3.offer_price FROM public.listing_best_offers lbo3 WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL AND d.d::DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND d.d::DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE ORDER BY lbo3.offer_price ASC LIMIT 1
            ) day_offer ON TRUE
          ), 2)
        ELSE NULL
      END AS total_price,
      CASE WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN (p_check_out - p_check_in) ELSE NULL END AS num_nights
  ) pricing ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('lifestyle_category', to_jsonb(lc.*), 'is_primary', ll2.is_primary)) AS lifestyles
    FROM public.listing_lifestyles ll2 JOIN public.lifestyle_categories lc ON lc.id = ll2.lifestyle_category_id WHERE ll2.listing_id = l.id
  ) ls_agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('url', li.url, 'order', li."order") ORDER BY li."order" ASC) AS images
    FROM public.listing_images li WHERE li.listing_id = l.id
  ) img_agg ON TRUE
  ORDER BY 
    CASE WHEN p_sort_by = 'price_asc' THEN COALESCE(pricing.display_price, l.price_per_night) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'price_desc' THEN COALESCE(pricing.display_price, l.price_per_night) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'rating' THEN COALESCE(r_agg.avg_rating, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'rating' THEN COALESCE(r_agg.review_count, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'distance' THEN f.distance_calc END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'newest' THEN l.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN f.match_score END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN COALESCE(r_agg.avg_rating, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN COALESCE(r_agg.review_count, 0) END DESC NULLS LAST,
    l.created_at DESC, -- tie breaker
    l.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;
