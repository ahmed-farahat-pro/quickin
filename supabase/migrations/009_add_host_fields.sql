-- Add new columns for Host capabilities
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS cleaning_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS house_rules TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS is_pets_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'flexible';

-- Provide comments for clarity
COMMENT ON COLUMN public.listings.cleaning_fee IS 'One-time cleaning fee added to the total booking price';
COMMENT ON COLUMN public.listings.currency IS 'Currency code (e.g., EGP, USD)';
COMMENT ON COLUMN public.listings.is_pets_allowed IS 'Whether pets are allowed in the listing';
