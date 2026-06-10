ALTER TABLE public.listings
  DROP COLUMN IF EXISTS best_offer_status,
  DROP COLUMN IF EXISTS best_offer_expires_at;;
