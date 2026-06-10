-- Force recalculate Guest Favorite status for all listings
-- This ensures that if the logic changed or ratings changed manually, the status is updated.

DO $$
DECLARE
    l_record RECORD;
BEGIN
    FOR l_record IN SELECT id FROM public.listings LOOP
        -- Trigger the already defined AFTER trigger function by doing a dummy update
        -- Or manually call the logic. For safety, we'll manually apply the logic to all.
        
        DECLARE
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
            WHERE listing_id = l_record.id AND is_hidden = false;

            -- Logic from 050 (lowered count to 1, but strict ratings >= 4.5/4.8)
            IF v_review_count >= 1 AND 
               v_avg_rating >= 4.80 AND
               v_avg_accuracy >= 4.50 AND
               v_avg_cleanliness >= 4.50 AND
               v_avg_communication >= 4.50 AND
               v_avg_location >= 4.50 AND
               v_avg_check_in >= 4.50 AND
               v_avg_value >= 4.50 
            THEN
                v_is_guest_favorite := TRUE;
            ELSE
                v_is_guest_favorite := FALSE;
            END IF;

            UPDATE public.listings
            SET is_guest_favorite = v_is_guest_favorite
            WHERE id = l_record.id;
        END;
    END LOOP;
END $$;
;
