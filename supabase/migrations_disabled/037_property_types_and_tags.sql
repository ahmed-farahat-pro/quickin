-- Database Migration: Property Types & Lifestyle Tags
-- 1. Create property_types table
-- 2. Rename categories -> lifestyle_categories (and drop type)
-- 3. Create listing_lifestyles M2M table
-- 4. Update listings table

-- 1. Property Types Table
CREATE TABLE IF NOT EXISTS public.property_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT CHECK (type IN ('home', 'service')) DEFAULT 'home', -- Keeping type here for high-level logic
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Property Types
INSERT INTO public.property_types (name, slug, type, description, icon) VALUES
  -- Homes
  ('Apartment', 'apartment', 'home', 'A rented unit in a multi-unit building', 'Building'),
  ('House', 'house', 'home', 'A standalone residential building', 'Home'),
  ('Villa', 'villa', 'home', 'A luxurious vacation home, often with a pool', 'Gem'),
  ('Guest House', 'guest-house', 'home', 'A separate unit on the same property as the main house', 'Home'),
  ('Hotel', 'hotel', 'home', 'A room in a hotel or boutique hotel', 'Building2'),
  ('Unit', 'unit', 'home', 'A generic rental unit', 'Building'),
  
  -- Services
  ('Yacht Rental', 'yacht', 'service', 'A boat or yacht for charter', 'Ship'),
  ('Car Rental', 'car', 'service', 'A vehicle for rent', 'Car'),
  ('Event Space', 'event-space', 'service', 'A venue for parties or events', 'PartyPopper'),
  ('Experience', 'experience', 'service', 'A guided activity or tour', 'MapBase')
ON CONFLICT (slug) DO NOTHING;

-- 2. Refactor Categories -> Lifestyle Categories
-- First, rename the table
ALTER TABLE public.categories RENAME TO lifestyle_categories;

-- Remove 'type' column as vibes are now global/generic
ALTER TABLE public.lifestyle_categories DROP COLUMN IF EXISTS type;

-- Seed/Update Lifestyle Tags (Ensure we have the latest list)
INSERT INTO public.lifestyle_categories (name, slug, icon, display_order, is_special) VALUES
  ('Beach', 'beach', 'Waves', 1, FALSE),
  ('Mountains', 'mountain', 'Mountain', 2, FALSE),
  ('City', 'city', 'Building2', 3, FALSE),
  ('Countryside', 'countryside', 'TreePine', 4, FALSE),
  ('Luxe', 'luxe', 'Gem', 5, FALSE),
  ('Castles', 'castles', 'Castle', 6, FALSE),
  ('Trending', 'trending', 'Flame', 7, FALSE),
  ('Lakefront', 'lakefront', 'Anchor', 8, FALSE),
  ('Arctic', 'arctic', 'Wind', 9, FALSE),
  ('Desert', 'desert', 'Sun', 10, FALSE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- 3. Listings Updates
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS property_type_id UUID REFERENCES public.property_types(id);

-- 4. Many-to-Many Table for Lifestyles
CREATE TABLE IF NOT EXISTS public.listing_lifestyles (
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  lifestyle_category_id UUID REFERENCES public.lifestyle_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, lifestyle_category_id)
);

-- RLS Policies for new tables
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read property_types" ON public.property_types FOR SELECT USING (true);

ALTER TABLE public.listing_lifestyles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read listing_lifestyles" ON public.listing_lifestyles FOR SELECT USING (true);
CREATE POLICY "Hosts manage their listing lifestyles" ON public.listing_lifestyles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_lifestyles.listing_id AND user_id = auth.uid())
);

-- Migration Logic: Map existing listings to a default Property Type if null
DO $$
DECLARE
  v_default_home_id UUID;
  v_default_service_id UUID;
BEGIN
  SELECT id INTO v_default_home_id FROM public.property_types WHERE slug = 'house' LIMIT 1;
  SELECT id INTO v_default_service_id FROM public.property_types WHERE slug = 'experience' LIMIT 1;

  -- Update listings that have no property type yet
  -- (Simple heuristic: if it has 0 beds/baths, maybe service? For now default all to House to be safe, user can update)
  UPDATE public.listings SET property_type_id = v_default_home_id WHERE property_type_id IS NULL;
  
  -- Move existing category_id to listing_lifestyles
  INSERT INTO public.listing_lifestyles (listing_id, lifestyle_category_id, is_primary)
  SELECT id, category_id, TRUE
  FROM public.listings
  WHERE category_id IS NOT NULL
  ON CONFLICT (listing_id, lifestyle_category_id) DO NOTHING;

END $$;

-- Finally, remove the old column (Optional, maybe keep for backward compat for a bit? Plan said remove. Let's remove to force clean usage)
-- ALTER TABLE public.listings DROP COLUMN category_id; 
-- commented out for safety for 5 mins, but plan says remove. Let's do it to ensure compilation errors guide us.
ALTER TABLE public.listings DROP COLUMN category_id;
