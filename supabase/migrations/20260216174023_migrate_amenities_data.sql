DO $$
DECLARE
    r RECORD;
    amenity_text TEXT;
    attr_code TEXT;
    attr_id UUID;
BEGIN
    FOR r IN SELECT id, amenities FROM listings WHERE amenities IS NOT NULL AND jsonb_array_length(to_jsonb(amenities)) > 0 LOOP
        FOREACH amenity_text IN ARRAY r.amenities LOOP
            -- Normalize text to code (simple lowercase & replace ' ' with '_')
            attr_code := lower(replace(amenity_text, ' ', '_'));
            
            -- Handle specific mappings if code doesn't match exactly
            IF attr_code = 'air_conditioning' THEN attr_code := 'ac'; END IF;
            IF attr_code = 'free_parking' THEN attr_code := 'parking'; END IF;
            IF attr_code = 'washing_machine' THEN attr_code := 'washer'; END IF;

            -- Find attribute ID
            SELECT id INTO attr_id FROM attributes WHERE code = attr_code;

            IF attr_id IS NOT NULL THEN
                -- Insert into listing_attributes if not exists
                INSERT INTO listing_attributes (listing_id, attribute_id, value_number)
                VALUES (r.id, attr_id, 1)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;;
