-- Drop the computed latitude/longitude columns
-- We will extract coordinates from location_geo in queries instead
ALTER TABLE public.listings DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.listings DROP COLUMN IF EXISTS longitude;;
