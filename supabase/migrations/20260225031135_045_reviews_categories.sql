ALTER TABLE public.reviews
  ADD COLUMN rating_accuracy INT CHECK (rating_accuracy >= 1 AND rating_accuracy <= 5),
  ADD COLUMN rating_cleanliness INT CHECK (rating_cleanliness >= 1 AND rating_cleanliness <= 5),
  ADD COLUMN rating_communication INT CHECK (rating_communication >= 1 AND rating_communication <= 5),
  ADD COLUMN rating_location INT CHECK (rating_location >= 1 AND rating_location <= 5),
  ADD COLUMN rating_check_in INT CHECK (rating_check_in >= 1 AND rating_check_in <= 5),
  ADD COLUMN rating_value INT CHECK (rating_value >= 1 AND rating_value <= 5),
  ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews" 
  ON public.reviews FOR UPDATE 
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews" 
  ON public.reviews FOR DELETE 
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Public read access for reviews" ON public.reviews;
CREATE POLICY "Public read access for reviews" 
  ON public.reviews FOR SELECT 
  USING (
    is_hidden = false OR
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true)
  );;
