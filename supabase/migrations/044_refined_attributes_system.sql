-- Migration 044: Refined Attributes System
-- 1. Schema Updates
-- 2. Data Migration & Cleanup
-- 3. New Specific View Attributes

-- 1. Schema Updates
ALTER TABLE public.attribute_options ADD COLUMN IF NOT EXISTS tier INT DEFAULT 1;
ALTER TABLE public.listing_attributes ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT NULL;

-- 2. Data Migration & Cleanup
-- Map existing options to tiers based on their current labels/codes
UPDATE public.attribute_options
SET tier = CASE 
  WHEN code ILIKE '%fast%' OR code ILIKE '%high%' OR code ILIKE '%premium%' OR code ILIKE '%full%' THEN 2
  WHEN code ILIKE '%panorama%' OR code ILIKE '%direct%' THEN 3
  WHEN code ILIKE 'none' OR code ILIKE 'no_%' OR code ILIKE 'no-%' THEN 0
  ELSE 1
END;

-- DELETE Tier 0 listing attributes (the "None" values)
DELETE FROM public.listing_attributes
WHERE value_option_id IN (SELECT id FROM public.attribute_options WHERE tier = 0);

-- DELETE Tier 0 options themselves
DELETE FROM public.attribute_options WHERE tier = 0;

-- 3. Specific View Attributes Refinement
DO $$
DECLARE
  v_cat_views UUID;
  v_option_type UUID;
  v_attr_sea_id UUID;
  v_attr_city_id UUID;
  v_attr_garden_id UUID;
BEGIN
  SELECT id INTO v_cat_views FROM public.attribute_categories WHERE code = 'views' LIMIT 1;
  SELECT id INTO v_option_type FROM public.attribute_types WHERE code = 'option' LIMIT 1;

  -- Update Sea View
  UPDATE public.attributes SET label = 'Sea View', category_id = v_cat_views WHERE code = 'sea_view';
  
  -- City View
  INSERT INTO public.attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('city_view', 'City View', v_cat_views, v_option_type, 'lucide:building-2', true)
  ON CONFLICT (code) DO UPDATE SET category_id = v_cat_views;

  -- Garden
  UPDATE public.attributes SET category_id = v_cat_views WHERE code = 'garden';

  -- Add Tiers for Sea View
  SELECT id INTO v_attr_sea_id FROM public.attributes WHERE code = 'sea_view';
  IF v_attr_sea_id IS NOT NULL THEN
    INSERT INTO public.attribute_options (attribute_id, code, label, tier, display_order) VALUES
      (v_attr_sea_id, 'partial_sea_view', 'Partial Sea View', 1, 1),
      (v_attr_sea_id, 'full_sea_view', 'Full Sea View', 2, 2),
      (v_attr_sea_id, 'panoramic_sea_view', 'Panoramic Sea View', 3, 3)
    ON CONFLICT (attribute_id, code) DO UPDATE SET tier = EXCLUDED.tier;
  END IF;

  -- Add Tiers for City View
  SELECT id INTO v_attr_city_id FROM public.attributes WHERE code = 'city_view';
  IF v_attr_city_id IS NOT NULL THEN
    INSERT INTO public.attribute_options (attribute_id, code, label, tier, display_order) VALUES
      (v_attr_city_id, 'street_city_view', 'Street View', 1, 1),
      (v_attr_city_id, 'skyline_city_view', 'Skyline View', 2, 2),
      (v_attr_city_id, 'landmark_city_view', 'Landmark View', 3, 3)
    ON CONFLICT (attribute_id, code) DO UPDATE SET tier = EXCLUDED.tier;
  END IF;

  -- Add Tiers for Garden
  SELECT id INTO v_attr_garden_id FROM public.attributes WHERE code = 'garden';
  IF v_attr_garden_id IS NOT NULL THEN
    INSERT INTO public.attribute_options (attribute_id, code, label, tier, display_order) VALUES
      (v_attr_garden_id, 'shared_garden', 'Shared Garden', 1, 1),
      (v_attr_garden_id, 'private_garden', 'Private Garden', 2, 2)
    ON CONFLICT (attribute_id, code) DO UPDATE SET tier = EXCLUDED.tier;
  END IF;

  -- Add River View (General)
  INSERT INTO public.attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('river_view', 'River View', v_cat_views, v_option_type, 'lucide:waves', true)
  ON CONFLICT (code) DO UPDATE SET category_id = v_cat_views;

  -- Add Tiers for River View
  DECLARE
    v_attr_river_id UUID;
  BEGIN
    SELECT id INTO v_attr_river_id FROM public.attributes WHERE code = 'river_view';
    IF v_attr_river_id IS NOT NULL THEN
      INSERT INTO public.attribute_options (attribute_id, code, label, tier, display_order) VALUES
        (v_attr_river_id, 'partial_river_view', 'Partial River View', 1, 1),
        (v_attr_river_id, 'full_river_view', 'Full River View', 2, 2),
        (v_attr_river_id, 'panoramic_river_view', 'Panoramic River View', 3, 3)
      ON CONFLICT (attribute_id, code) DO UPDATE SET tier = EXCLUDED.tier;
    END IF;
  END;

END $$;
