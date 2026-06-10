-- Migration: Add latitude and longitude as computed columns from location_geo

-- Add latitude column as generated column from location_geo
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS latitude double precision 
GENERATED ALWAYS AS (ST_Y(location_geo::geometry)) STORED;

-- Add longitude column as generated column from location_geo
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS longitude double precision 
GENERATED ALWAYS AS (ST_X(location_geo::geometry)) STORED;;
