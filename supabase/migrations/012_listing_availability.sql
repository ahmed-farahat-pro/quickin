-- Migration: Listing Availability Calendar
-- Purpose: Store per-date availability and price overrides for listings

CREATE TABLE IF NOT EXISTS public.listing_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  price_override DECIMAL(10,2), -- NULL = use calculated price (base + adjustments)
  note TEXT, -- Optional note for this date (e.g., "Eid holiday")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, date)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_listing_availability_listing_date 
  ON public.listing_availability(listing_id, date);

-- Enable RLS
ALTER TABLE public.listing_availability ENABLE ROW LEVEL SECURITY;

-- Policies: Hosts can manage their own listing availability
CREATE POLICY "Hosts can view their listing availability"
  ON public.listing_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_availability.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can insert their listing availability"
  ON public.listing_availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_availability.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can update their listing availability"
  ON public.listing_availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_availability.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can delete their listing availability"
  ON public.listing_availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_availability.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

-- Public can view availability for published listings (for booking calendar)
CREATE POLICY "Public can view availability of published listings"
  ON public.listing_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_availability.listing_id 
      AND listings.is_published = TRUE
    )
  );
