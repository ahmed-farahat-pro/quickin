-- Migration: 035_migrate_listings_geo.sql

-- 1. Add location_geo column
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS location_geo geography(POINT, 4326);

-- 2. Backfill data from latitude/longitude
-- We cast to geometry first to create point, then to geography
UPDATE public.listings
SET location_geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 3. Drop old index if exists
DROP INDEX IF EXISTS idx_listings_geo_location;

-- 4. Create new index on location_geo
CREATE INDEX IF NOT EXISTS idx_listings_location_geo 
ON public.listings 
USING GIST (location_geo);

-- 5. Update get_listings_nearby function to use new column
-- The function signature stays the same (input lat/lng), but logic changes
CREATE OR REPLACE FUNCTION get_listings_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision
)
RETURNS SETOF public.listings
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.listings
  WHERE st_dwithin(
    location_geo,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000
  )
$$;

-- 6. Drop old columns (SAFE OPERATION? Yes, we have data in location_geo)
ALTER TABLE public.listings 
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude;
