ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS best_offer_status text NOT NULL DEFAULT 'none' 
CHECK (best_offer_status IN ('none', 'requested', 'approved', 'rejected'));

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS best_offer_expires_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_best_offer_status 
ON public.listings(best_offer_status);

CREATE INDEX IF NOT EXISTS idx_listings_best_offer_expires_at 
ON public.listings(best_offer_expires_at);;
