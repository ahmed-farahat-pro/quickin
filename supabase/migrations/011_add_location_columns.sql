-- Add city and state columns to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

-- Update RLS policies if necessary (existing ones cover updates to keys)
-- No changes needed for RLS as they are row-based
