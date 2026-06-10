-- Create image_categories table
CREATE TABLE IF NOT EXISTS public.image_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for image_categories
ALTER TABLE public.image_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone" 
  ON public.image_categories FOR SELECT 
  USING (true);

-- Seed initial categories
INSERT INTO public.image_categories (slug, label, icon) VALUES
  ('exterior', 'Exterior', 'Home'),
  ('interior', 'Interior', 'Armchair'),
  ('bedroom', 'Bedroom', 'Bed'),
  ('bathroom', 'Bathroom', 'Bath'),
  ('living', 'Living Room', 'Tv'),
  ('kitchen', 'Kitchen', 'Utensils'),
  ('other', 'Other', 'Grid')
ON CONFLICT (slug) DO NOTHING;

-- Create listing_images table
CREATE TABLE IF NOT EXISTS public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES public.image_categories(slug) DEFAULT 'other',
  caption TEXT,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Images are viewable by everyone" 
  ON public.listing_images FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert images for their own listings" 
  ON public.listing_images FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update images for their own listings" 
  ON public.listing_images FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images for their own listings" 
  ON public.listing_images FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON public.listing_images(listing_id);

-- Data Migration: Move images from listings.images array to listing_images table
DO $$
DECLARE
    r RECORD;
    img_url TEXT;
    img_order INT;
BEGIN
    FOR r IN SELECT id, images FROM public.listings WHERE images IS NOT NULL AND array_length(images, 1) > 0 LOOP
        img_order := 0;
        FOREACH img_url IN ARRAY r.images LOOP
            INSERT INTO public.listing_images (listing_id, url, category, "order")
            VALUES (r.id, img_url, 'other', img_order);
            img_order := img_order + 1;
        END LOOP;
    END LOOP;
END $$;
