-- Create the review status ENUM
CREATE TYPE public.listing_review_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

-- Add review_status and review_notes to listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS review_status public.listing_review_status NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create an index to quickly filter listings by their review status (especially for admins)
CREATE INDEX IF NOT EXISTS idx_listings_review_status ON public.listings(review_status);

-- Update existing listings to 'approved' to avoid breaking backwards compatibility
UPDATE public.listings SET review_status = 'approved' WHERE is_published = TRUE;

-- Provide a comment for documentation
COMMENT ON COLUMN public.listings.review_status IS 'Status of the listing admin review process';
COMMENT ON COLUMN public.listings.review_notes IS 'Notes from the admin regarding the review status (e.g. rejection reasons)';
