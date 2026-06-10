
-- Add new columns
ALTER TABLE public.bookings
  ADD COLUMN commission_rate_id uuid REFERENCES public.commission_rates(id),
  ADD COLUMN subtotal numeric;

-- Populate from existing data
UPDATE public.bookings
SET commission_rate_id = (SELECT id FROM public.commission_rates WHERE effective_to IS NULL LIMIT 1),
    subtotal = total_price - guest_fee;

-- Make NOT NULL after population
ALTER TABLE public.bookings
  ALTER COLUMN commission_rate_id SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL;
;
