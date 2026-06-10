-- Drop the deprecated images column from listings table
-- Data has been migrated to listing_images table
ALTER TABLE public.listings DROP COLUMN IF EXISTS images;
