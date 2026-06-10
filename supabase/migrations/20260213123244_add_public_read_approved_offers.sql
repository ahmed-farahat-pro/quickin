-- Allow anyone (including unauthenticated) to read approved offers
-- This is needed for the public search filter and listing badge display
CREATE POLICY "anyone_read_approved_offers" ON public.listing_best_offers
  FOR SELECT
  USING (status = 'approved'::best_offer_status);;
