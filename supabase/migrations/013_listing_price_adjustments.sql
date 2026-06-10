-- Migration: Listing Price Adjustments
-- Purpose: Store pricing adjustments for weekends, holidays, and seasonal rates

CREATE TABLE IF NOT EXISTS public.listing_price_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Weekend Rate", "Eid Holiday", "Summer Season"
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('percentage', 'fixed')),
  adjustment_value DECIMAL(10,2) NOT NULL, -- e.g., 10 for +10% or 50 for +50 EGP
  -- For recurring adjustments (weekends)
  applies_to_days TEXT[] DEFAULT '{}', -- e.g., ['friday', 'saturday'] for weekend
  -- For date-range adjustments (holidays, seasons)
  start_date DATE, -- NULL = no date restriction
  end_date DATE,
  -- For specific dates (one-time events)
  specific_dates DATE[] DEFAULT '{}',
  priority INT DEFAULT 0, -- Higher priority adjustments apply last
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_price_adjustments_listing 
  ON public.listing_price_adjustments(listing_id);

-- Enable RLS
ALTER TABLE public.listing_price_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies: Hosts can manage their own price adjustments
CREATE POLICY "Hosts can view their price adjustments"
  ON public.listing_price_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_price_adjustments.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can insert their price adjustments"
  ON public.listing_price_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_price_adjustments.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can update their price adjustments"
  ON public.listing_price_adjustments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_price_adjustments.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can delete their price adjustments"
  ON public.listing_price_adjustments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_price_adjustments.listing_id 
      AND listings.user_id = auth.uid()
    )
  );

-- Public can view adjustments for published listings (to calculate prices)
CREATE POLICY "Public can view adjustments of published listings"
  ON public.listing_price_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = listing_price_adjustments.listing_id 
      AND listings.is_published = TRUE
    )
  );

-- Helper function to calculate price for a specific date
CREATE OR REPLACE FUNCTION calculate_listing_price(
  p_listing_id UUID,
  p_date DATE
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_base_price DECIMAL(10,2);
  v_final_price DECIMAL(10,2);
  v_override DECIMAL(10,2);
  v_adjustment RECORD;
  v_day_name TEXT;
BEGIN
  -- Get base price from listing
  SELECT price_per_night INTO v_base_price
  FROM public.listings WHERE id = p_listing_id;
  
  IF v_base_price IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check for price override on this specific date
  SELECT price_override INTO v_override
  FROM public.listing_availability
  WHERE listing_id = p_listing_id AND date = p_date;
  
  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;
  
  -- Start with base price
  v_final_price := v_base_price;
  v_day_name := lower(to_char(p_date, 'day'));
  v_day_name := trim(v_day_name); -- Remove trailing spaces
  
  -- Apply adjustments in priority order
  FOR v_adjustment IN
    SELECT * FROM public.listing_price_adjustments
    WHERE listing_id = p_listing_id
      AND is_active = TRUE
      AND (
        -- Day-based adjustment (weekend)
        v_day_name = ANY(applies_to_days)
        -- Date range adjustment (seasons)
        OR (start_date IS NOT NULL AND end_date IS NOT NULL 
            AND p_date BETWEEN start_date AND end_date)
        -- Specific date adjustment (holidays)
        OR p_date = ANY(specific_dates)
      )
    ORDER BY priority ASC
  LOOP
    IF v_adjustment.adjustment_type = 'percentage' THEN
      v_final_price := v_final_price * (1 + v_adjustment.adjustment_value / 100);
    ELSE -- fixed
      v_final_price := v_final_price + v_adjustment.adjustment_value;
    END IF;
  END LOOP;
  
  RETURN ROUND(v_final_price, 2);
END;
$$ LANGUAGE plpgsql STABLE;
