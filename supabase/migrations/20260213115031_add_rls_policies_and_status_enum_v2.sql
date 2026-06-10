-- 1. Create the status enum type
CREATE TYPE public.best_offer_status AS ENUM ('requested', 'approved', 'rejected', 'expired', 'cancelled');

-- 2. Drop the old CHECK constraint and default
ALTER TABLE public.listing_best_offers DROP CONSTRAINT IF EXISTS listing_best_offers_status_check;
ALTER TABLE public.listing_best_offers ALTER COLUMN status DROP DEFAULT;

-- 3. Convert the column from text to enum
ALTER TABLE public.listing_best_offers 
  ALTER COLUMN status TYPE public.best_offer_status USING status::public.best_offer_status;

-- 4. Set default with the correct type
ALTER TABLE public.listing_best_offers 
  ALTER COLUMN status SET DEFAULT 'requested'::public.best_offer_status;

-- 5. Add RLS policies

-- Hosts can read their own offers (via listing ownership)
CREATE POLICY "hosts_read_own_offers" ON public.listing_best_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_best_offers.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Hosts can insert offers for their own listings
CREATE POLICY "hosts_insert_own_offers" ON public.listing_best_offers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_best_offers.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Hosts can update their own offers (e.g. cancel)
CREATE POLICY "hosts_update_own_offers" ON public.listing_best_offers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_best_offers.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Staff/Admin can read all offers
CREATE POLICY "staff_read_all_offers" ON public.listing_best_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE staff_profiles.id = auth.uid()
      AND staff_profiles.role IN ('admin', 'staff', 'super_admin')
    )
  );

-- Staff/Admin can update all offers (approve/reject)
CREATE POLICY "staff_update_all_offers" ON public.listing_best_offers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE staff_profiles.id = auth.uid()
      AND staff_profiles.role IN ('admin', 'staff', 'super_admin')
    )
  );;
