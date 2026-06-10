-- Migration: Listing Enhancements
-- Purpose: Add listing code, min nights, and special conditions to listings

-- Add new columns to listings table
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS listing_code CHAR(4) UNIQUE,
  ADD COLUMN IF NOT EXISTS min_nights INT DEFAULT 1 CHECK (min_nights >= 1),
  ADD COLUMN IF NOT EXISTS special_conditions TEXT;

-- Create index for listing code lookups
CREATE INDEX IF NOT EXISTS idx_listings_code ON public.listings(listing_code);

-- Auto-generate alphanumeric listing code
-- Uses A-Z (excluding O, I) and 2-9 (excluding 0, 1) to avoid confusion
-- This gives 30^4 = 810,000 possible combinations
CREATE OR REPLACE FUNCTION generate_listing_code() 
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  attempts INT := 0;
  max_attempts INT := 20;
BEGIN
  -- Only generate if code is not already set
  IF NEW.listing_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  LOOP
    -- Generate random 4-character code
    code := '';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM public.listings WHERE listing_code = code) THEN
      NEW.listing_code := code;
      RETURN NEW;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique listing code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating listing codes
DROP TRIGGER IF EXISTS set_listing_code ON public.listings;
CREATE TRIGGER set_listing_code 
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION generate_listing_code();

-- Generate codes for existing listings that don't have one
DO $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  listing_record RECORD;
  attempts INT;
BEGIN
  FOR listing_record IN SELECT id FROM public.listings WHERE listing_code IS NULL
  LOOP
    attempts := 0;
    LOOP
      code := '';
      FOR i IN 1..4 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      
      IF NOT EXISTS (SELECT 1 FROM public.listings WHERE listing_code = code) THEN
        UPDATE public.listings SET listing_code = code WHERE id = listing_record.id;
        EXIT;
      END IF;
      
      attempts := attempts + 1;
      IF attempts >= 20 THEN
        RAISE WARNING 'Could not generate code for listing %', listing_record.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
