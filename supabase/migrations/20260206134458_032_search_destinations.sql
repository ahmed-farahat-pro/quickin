-- Create PostGIS extension if not exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum for destination types
CREATE TYPE public.destination_type AS ENUM ('city', 'area', 'curated');

-- Create search_destinations table
CREATE TABLE IF NOT EXISTS public.search_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location geography(POINT),
  radius_km FLOAT DEFAULT 10.0,
  type public.destination_type DEFAULT 'city',
  country TEXT DEFAULT 'Egypt',
  include_surrounding BOOLEAN DEFAULT false,
  listing_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_destinations_location ON public.search_destinations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_search_destinations_active ON public.search_destinations(is_active);
CREATE INDEX IF NOT EXISTS idx_search_destinations_type ON public.search_destinations(type);

-- Functional index on listings for radius search performance
-- Assumes listings has latitude and longitude columns
CREATE INDEX IF NOT EXISTS idx_listings_geo_location 
ON public.listings 
USING GIST ( CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography) );

-- Enable RLS
ALTER TABLE public.search_destinations ENABLE ROW LEVEL SECURITY;

-- Policies

-- Public read access (active only)
CREATE POLICY "Public can view active destinations"
  ON public.search_destinations FOR SELECT
  USING (is_active = true);

-- Staff manage access (all operations)
CREATE POLICY "Staff can manage destinations"
  ON public.search_destinations FOR ALL
  TO authenticated
  USING (is_staff());

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_search_destinations_updated_at
    BEFORE UPDATE ON public.search_destinations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();;
