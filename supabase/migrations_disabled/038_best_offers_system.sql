-- Add best_offer_status and best_offer_expires_at to listings table

-- Create enum for best_offer_status if it doesn't exist (using text check constraint instead for simplicity as per plan, but comment here for clarity)
-- Statuses: 'none', 'requested', 'approved', 'rejected'

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS best_offer_status text NOT NULL DEFAULT 'none' 
CHECK (best_offer_status IN ('none', 'requested', 'approved', 'rejected'));

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS best_offer_expires_at timestamptz DEFAULT NULL;

-- Create an index to make filtering by best offers fast
CREATE INDEX IF NOT EXISTS idx_listings_best_offer_status 
ON public.listings(best_offer_status);

CREATE INDEX IF NOT EXISTS idx_listings_best_offer_expires_at 
ON public.listings(best_offer_expires_at);

-- Comments
COMMENT ON COLUMN public.listings.best_offer_status IS 'Status of the Best Offer request: none, requested, approved, rejected';
COMMENT ON COLUMN public.listings.best_offer_expires_at IS 'Expiration timestamp for the Best Offer status. Only relevant if status is approved.';
