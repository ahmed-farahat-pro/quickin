-- Add google_maps_link column
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

-- Safely handle existing NULLs before applying NOT NULL constraint
-- Defaulting to Cairo coordinates (or 0,0) if missing, to prevent migration failure
UPDATE listings 
SET latitude = 30.0444, longitude = 31.2357 
WHERE latitude IS NULL OR longitude IS NULL;

-- Make latitude and longitude NOT NULL
ALTER TABLE listings 
ALTER COLUMN latitude SET NOT NULL;

ALTER TABLE listings 
ALTER COLUMN longitude SET NOT NULL;
