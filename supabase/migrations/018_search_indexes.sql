-- Search Performance Indexes
-- Optimizes queries for search with filters

-- =============================================
-- BOOKING & AVAILABILITY INDEXES
-- =============================================

-- Optimize availability checks (date range overlap queries)
CREATE INDEX IF NOT EXISTS idx_bookings_listing_dates 
  ON bookings(listing_id, check_in, check_out) 
  WHERE status IN ('confirmed', 'pending');

CREATE INDEX IF NOT EXISTS idx_listing_availability_lookup 
  ON listing_availability(listing_id, date, is_available);

-- =============================================
-- ATTRIBUTE FILTERING INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_listing_attributes_lookup 
  ON listing_attributes(listing_id, attribute_id);

CREATE INDEX IF NOT EXISTS idx_listing_attributes_by_attribute 
  ON listing_attributes(attribute_id, listing_id);

-- =============================================
-- LISTINGS SEARCH INDEXES
-- =============================================

-- Price range filtering
CREATE INDEX IF NOT EXISTS idx_listings_price 
  ON listings(price_per_night) 
  WHERE is_published = true;

-- Guest capacity filtering
CREATE INDEX IF NOT EXISTS idx_listings_guests 
  ON listings(max_guests) 
  WHERE is_published = true;

-- Location search (trigram for fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_listings_location_trgm 
  ON listings USING gin (location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_city_trgm 
  ON listings USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_country_trgm 
  ON listings USING gin (country gin_trgm_ops);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_listings_search_combo 
  ON listings(is_published, max_guests, price_per_night);
