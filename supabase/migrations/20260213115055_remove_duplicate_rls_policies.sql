-- Remove old duplicate policies (keep the new consistently-named ones)
DROP POLICY IF EXISTS "Admins can update offers" ON public.listing_best_offers;
DROP POLICY IF EXISTS "Admins can view all offers" ON public.listing_best_offers;
DROP POLICY IF EXISTS "Hosts can insert own offers" ON public.listing_best_offers;
DROP POLICY IF EXISTS "Hosts can view own offers" ON public.listing_best_offers;;
