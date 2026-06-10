-- 1. Drop trigger
DROP TRIGGER IF EXISTS trigger_update_listing_guest_favorite ON public.reviews;

-- 2. Convert INT ratings to DECIMAL(2,1)
ALTER TABLE public.reviews
  ALTER COLUMN rating TYPE DECIMAL(2,1),
  ALTER COLUMN rating_accuracy TYPE DECIMAL(2,1),
  ALTER COLUMN rating_cleanliness TYPE DECIMAL(2,1),
  ALTER COLUMN rating_communication TYPE DECIMAL(2,1),
  ALTER COLUMN rating_location TYPE DECIMAL(2,1),
  ALTER COLUMN rating_check_in TYPE DECIMAL(2,1),
  ALTER COLUMN rating_value TYPE DECIMAL(2,1);

-- 3. Add private feedback column
ALTER TABLE public.reviews
  ADD COLUMN private_feedback TEXT;

-- 4. Recreate the trigger
CREATE TRIGGER trigger_update_listing_guest_favorite
  AFTER INSERT OR UPDATE OF rating, rating_accuracy, rating_cleanliness, rating_communication, rating_location, rating_check_in, rating_value, is_hidden OR DELETE
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_guest_favorite_status();

-- 5. Update SELECT policy
DROP POLICY IF EXISTS "Public read access for reviews" ON public.reviews;
CREATE POLICY "Public read access for reviews" 
  ON public.reviews FOR SELECT 
  USING (
    is_hidden = false OR
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true) OR
    EXISTS (
      SELECT 1 FROM public.listings l 
      WHERE l.id = reviews.listing_id AND l.user_id = auth.uid()
    )
  );;
