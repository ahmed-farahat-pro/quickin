-- =============================================================================
-- Migration 046: Guest Favorite Trigger based on Reviews
-- =============================================================================

-- Create the function to calculate listing stats and update is_guest_favorite
CREATE OR REPLACE FUNCTION public.update_listing_guest_favorite_status()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_id UUID;
  v_review_count INT;
  v_avg_rating NUMERIC;
  v_avg_accuracy NUMERIC;
  v_avg_cleanliness NUMERIC;
  v_avg_communication NUMERIC;
  v_avg_location NUMERIC;
  v_avg_check_in NUMERIC;
  v_avg_value NUMERIC;
  v_is_guest_favorite BOOLEAN := FALSE;
BEGIN
  -- Determine which listing_id to update based on the operation
  IF TG_OP = 'DELETE' THEN
    v_listing_id := OLD.listing_id;
  ELSE
    v_listing_id := NEW.listing_id;
  END IF;

  -- Calculate aggregates for the listing, ignoring hidden reviews
  SELECT 
    COUNT(id),
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_accuracy)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_cleanliness)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_communication)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_location)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_check_in)::numeric, 2), 0),
    COALESCE(ROUND(AVG(rating_value)::numeric, 2), 0)
  INTO 
    v_review_count,
    v_avg_rating,
    v_avg_accuracy,
    v_avg_cleanliness,
    v_avg_communication,
    v_avg_location,
    v_avg_check_in,
    v_avg_value
  FROM public.reviews
  WHERE listing_id = v_listing_id AND is_hidden = false;

  -- Logic to determine if a listing is a Guest Favorite
  -- Airbnb criteria roughly requires min 5 reviews and high ratings (e.g. >= 4.90 overall)
  -- We'll enforce >= 5 reviews, >= 4.90 overall rating, and all subratings >= 4.8
  IF v_review_count >= 5 AND 
     v_avg_rating >= 4.90 AND
     v_avg_accuracy >= 4.80 AND
     v_avg_cleanliness >= 4.80 AND
     v_avg_communication >= 4.80 AND
     v_avg_location >= 4.80 AND
     v_avg_check_in >= 4.80 AND
     v_avg_value >= 4.80 
  THEN
    v_is_guest_favorite := TRUE;
  ELSE
    v_is_guest_favorite := FALSE;
  END IF;

  -- Update the listing's guest favorite status
  UPDATE public.listings
  SET is_guest_favorite = v_is_guest_favorite
  WHERE id = v_listing_id;

  RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for reviews table on insert, update, delete
DROP TRIGGER IF EXISTS trigger_update_listing_guest_favorite ON public.reviews;
CREATE TRIGGER trigger_update_listing_guest_favorite
  AFTER INSERT OR UPDATE OF rating, rating_accuracy, rating_cleanliness, rating_communication, rating_location, rating_check_in, rating_value, is_hidden OR DELETE
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_guest_favorite_status();
