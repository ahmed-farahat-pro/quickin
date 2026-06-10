-- Revamp Categories and Update Listings Table
-- 1. Update listings table to allow 0 bedrooms/beds/bathrooms by default
-- 2. Add type and display_order to categories table
-- 3. Seed new category data

-- Part 1: Update Listings Defaults
ALTER TABLE public.listings 
  ALTER COLUMN bedrooms SET DEFAULT 0,
  ALTER COLUMN beds SET DEFAULT 0,
  ALTER COLUMN bathrooms SET DEFAULT 0;

-- Part 2: Update Categories Table
ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('home', 'service')) DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories(display_order);

-- Part 3: Seed Data (Clean Slate Approach)
-- We'll use a temporary table to insert new data then update existing or insert new ones
-- Since we want a robust system, let's truncate and re-seed to ensure consistency with the design
-- WARNING: This deletes existing categories. If listings reference them, we might have issues.
-- However, since this is a prototype/dev environment and we are "refactoring", we'll assume it's safe to clear or upsert.
-- To be safe, we'll UPSERT based on 'slug'.

INSERT INTO public.categories (name, slug, type, icon, display_order, is_special) VALUES
  -- Special
  ('Best Offers', 'best-offers', 'home', 'Sparkles', 0, TRUE),
  
  -- Homes
  ('Beach', 'beach', 'home', 'Waves', 1, FALSE),
  ('Mountains', 'mountain', 'home', 'Mountain', 2, FALSE),
  ('Cities', 'city', 'home', 'Building2', 3, FALSE),
  ('Countryside', 'countryside', 'home', 'TreePine', 4, FALSE),
  ('Tropical', 'tropical', 'home', 'Palmtree', 5, FALSE),
  ('Lakefront', 'lakefront', 'home', 'Anchor', 6, FALSE),
  ('Skiing', 'skiing', 'home', 'Snowflake', 7, FALSE),
  ('Camping', 'camping', 'home', 'Tent', 8, FALSE),
  ('Desert', 'desert', 'home', 'Sun', 9, FALSE),
  ('Castles', 'castles', 'home', 'Castle', 10, FALSE),
  ('Luxe', 'luxe', 'home', 'Gem', 11, FALSE),
  ('Tiny Homes', 'tiny-homes', 'home', 'Home', 12, FALSE),
  ('Trending', 'trending', 'home', 'Flame', 13, FALSE),

  -- Services
  ('Yacht Rental', 'yacht', 'service', 'Ship', 20, FALSE),
  ('Events & Parties', 'events', 'service', 'PartyPopper', 21, FALSE),
  ('Beach Buggy', 'beach-buggy', 'service', 'Car', 22, FALSE)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_special = EXCLUDED.is_special;

-- Ensure any existing categories not in our list are handled (optional, maybe set them to home/99)
UPDATE public.categories SET type = 'home', display_order = 99 WHERE type IS NULL;
