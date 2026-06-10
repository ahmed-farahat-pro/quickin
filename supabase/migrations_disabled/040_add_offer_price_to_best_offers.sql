-- Add offer_price column to listing_best_offers table
-- This column stores the discounted price per night for the best offer period

ALTER TABLE public.listing_best_offers
ADD COLUMN IF NOT EXISTS offer_price NUMERIC DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.listing_best_offers.offer_price IS 'The discounted price per night during this best offer period. When approved, this price overrides all other pricing for dates in the range.';
