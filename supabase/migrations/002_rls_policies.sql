-- Row Level Security Policies

-- Profiles: Anyone can view, users can update their own
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Categories: Anyone can view
CREATE POLICY "Categories are viewable by everyone" 
  ON public.categories FOR SELECT 
  USING (true);

-- Listings: Anyone can view published listings
CREATE POLICY "Published listings are viewable by everyone" 
  ON public.listings FOR SELECT 
  USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create listings" 
  ON public.listings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings" 
  ON public.listings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings" 
  ON public.listings FOR DELETE 
  USING (auth.uid() = user_id);

-- Bookings: Users can view their own bookings, hosts can view bookings for their listings
CREATE POLICY "Users can view their own bookings" 
  ON public.bookings FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT user_id FROM public.listings WHERE id = listing_id)
  );

CREATE POLICY "Users can create bookings" 
  ON public.bookings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" 
  ON public.bookings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Favorites: Users can manage their own favorites
CREATE POLICY "Users can view their own favorites" 
  ON public.favorites FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites" 
  ON public.favorites FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their favorites" 
  ON public.favorites FOR DELETE 
  USING (auth.uid() = user_id);

-- Reviews: Anyone can view, authenticated users can create for completed bookings
CREATE POLICY "Reviews are viewable by everyone" 
  ON public.reviews FOR SELECT 
  USING (true);

CREATE POLICY "Users can create reviews for their completed bookings" 
  ON public.reviews FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE id = booking_id AND user_id = auth.uid() AND status = 'completed'
    )
  );

CREATE POLICY "Users can update their own reviews" 
  ON public.reviews FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
  ON public.reviews FOR DELETE 
  USING (auth.uid() = user_id);
