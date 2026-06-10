-- Add best_offer_subtotal snapshot for promo commission
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS best_offer_subtotal numeric NOT NULL DEFAULT 0;

UPDATE public.bookings
SET best_offer_subtotal = 0
WHERE best_offer_subtotal IS NULL;
