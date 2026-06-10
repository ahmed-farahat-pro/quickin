ALTER TABLE public.listing_best_offers 
DROP CONSTRAINT IF EXISTS listing_best_offers_status_check;

ALTER TABLE public.listing_best_offers
ADD CONSTRAINT listing_best_offers_status_check 
CHECK (status IN ('requested', 'approved', 'rejected', 'expired', 'cancelled'));;
