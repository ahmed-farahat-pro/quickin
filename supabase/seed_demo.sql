-- =============================================================================
-- QuickIn DEMO SEED  (run AFTER migrations, via psql as the postgres superuser)
-- Idempotent: safe to re-run. Creates users, enriches the 8 demo listings with
-- real coordinates + photos, and adds reviews, a wishlist and a booking.
--   Host/Admin login : admin@quickin.test / password123
--   Guest login      : guest@quickin.test / password123
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Guest auth user (trigger auto-creates the profile)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'guest@quickin.test',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Sara Guest"}'::jsonb,
  '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Profiles: make the admin a verified host, ensure guest profile exists
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name)
VALUES ('a1b2c3d4-0000-4000-8000-000000000001', 'guest@quickin.test', 'Sara Guest')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET is_host = true,
    full_name = 'Adam Host',
    bio = 'Superhost passionate about hospitality — managing boutique stays worldwide.',
    phone = '+1 (310) 555-0142',
    avatar_url = 'https://i.pravatar.cc/300?img=12'
WHERE id = 'edeb65a3-e6e3-4fd7-aabb-962ddf0906a8';

UPDATE public.profiles
SET full_name = 'Sara Guest',
    phone = '+20 100 555 0199',
    avatar_url = 'https://i.pravatar.cc/300?img=45'
WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001';

-- Best-effort identity verification (columns exist only after migration 026)
DO $$
BEGIN
  UPDATE public.profiles
  SET verification_status_id = (SELECT id FROM public.verification_statuses
                                WHERE lower(name) IN ('verified','approved') LIMIT 1),
      verified_at = now()
  WHERE id = 'edeb65a3-e6e3-4fd7-aabb-962ddf0906a8';
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Make the admin a STAFF admin so /admin is reachable
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO public.staff_profiles (id, email, display_name, role, is_active)
  VALUES ('edeb65a3-e6e3-4fd7-aabb-962ddf0906a8', 'admin@quickin.test', 'Adam (Admin)', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true, role = 'admin';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Ensure exactly one active commission rate exists
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.commission_rates WHERE effective_to IS NULL) THEN
    INSERT INTO public.commission_rates (host_rate, guest_rate, best_offer_rate, notes)
    VALUES (0.10, 0.12, 0.05, 'Demo default commission');
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Enrich the 8 demo listings: type, currency, code, policy, geo, photos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_listing_id UUID;
  v_pt_id UUID;
  v_life_id UUID;
  -- title, lat, lng, property_type slug, lifestyle slug, code
  rows_arr TEXT[][] := ARRAY[
    ARRAY['Stunning Ocean View Villa', '34.0259',  '-118.7798', 'villa',       'beach',       'QK-MALIBU1'],
    ARRAY['Cozy Mountain Cabin',       '39.1911',  '-106.8175', 'house',       'mountain',    'QK-ASPEN01'],
    ARRAY['Modern Downtown Loft',      '40.7128',  '-74.0060',  'apartment',   'city',        'QK-NYC0001'],
    ARRAY['Tropical Paradise Bungalow','9.5120',   '100.0136',  'guest-house', 'beach',       'QK-SAMUI01'],
    ARRAY['Historic Tuscan Farmhouse', '43.7696',  '11.2558',   'house',       'countryside', 'QK-TUSCAN1'],
    ARRAY['Lakeside Retreat',          '45.9844',  '9.2572',    'villa',       'lakefront',   'QK-COMO001'],
    ARRAY['Desert Oasis Home',         '33.4942',  '-111.9261', 'house',       'desert',      'QK-SCOTTS1'],
    ARRAY['Beachfront Cottage',        '-28.6474', '153.6020',  'house',       'beach',       'QK-BYRON01']
  ];
  img_sets TEXT[][] := ARRAY[
    ARRAY['photo-1499793983690-e29da59ef1c2','photo-1600596542815-ffad4c1539a9','photo-1600607687939-ce8a6c25118c','photo-1613977257363-707ba9348227'],
    ARRAY['photo-1518780664697-55e3ad937233','photo-1449158743715-0a90ebb6d2d8','photo-1551524559-8af4e6624178','photo-1564013799919-ab600027ffc6'],
    ARRAY['photo-1502672260266-1c1ef2d93688','photo-1560448204-e02f11c3d0e2','photo-1505691938895-1758d7feb511','photo-1493809842364-78817add7ffb'],
    ARRAY['photo-1540541338287-41700207dee6','photo-1582719508461-905c673771fd','photo-1571003123894-1f0594d2b5d9','photo-1520250497591-112f2f40a3f4'],
    ARRAY['photo-1523217582562-09d0def993a6','photo-1564501049412-61c2a3083791','photo-1576013551627-0cc20b96c2a7','photo-1505691938895-1758d7feb511'],
    ARRAY['photo-1564013799919-ab600027ffc6','photo-1502005229762-cf1b2da7c5d6','photo-1512917774080-9991f1c4c750','photo-1600585154340-be6161a56a0c'],
    ARRAY['photo-1613490493576-7fde63acd811','photo-1600047509807-ba8f99d2cdde','photo-1600566753086-00f18fb6b3ea','photo-1600210492493-0946911123ea'],
    ARRAY['photo-1600596542815-ffad4c1539a9','photo-1582268611958-ebfd161ef9cf','photo-1505693416388-ac5ce068fe85','photo-1502672260266-1c1ef2d93688']
  ];
  cats TEXT[] := ARRAY['exterior','living','bedroom','kitchen'];
  i INT;
  j INT;
BEGIN
  FOR i IN 1 .. array_length(rows_arr, 1) LOOP
    SELECT id INTO v_listing_id FROM public.listings WHERE title = rows_arr[i][1] LIMIT 1;
    CONTINUE WHEN v_listing_id IS NULL;

    SELECT id INTO v_pt_id   FROM public.property_types      WHERE slug = rows_arr[i][4] LIMIT 1;
    SELECT id INTO v_life_id FROM public.lifestyle_categories WHERE slug = rows_arr[i][5] LIMIT 1;

    -- Core fields (guard each optional column independently)
    BEGIN UPDATE public.listings SET currency = 'USD'              WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.listings SET min_nights = 2               WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.listings SET cleaning_fee = 45            WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.listings SET listing_code = rows_arr[i][6] WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.listings SET is_published = true, is_guest_favorite = (i <= 3) WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;

    IF v_pt_id IS NOT NULL THEN
      BEGIN UPDATE public.listings SET property_type_id = v_pt_id WHERE id = v_listing_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    END IF;

    -- Cancellation policy (FK to cancellation_policies.code)
    BEGIN
      UPDATE public.listings
      SET cancellation_policy = (ARRAY['flexible','moderate','firm'])[1 + (i % 3)]
      WHERE id = v_listing_id;
    EXCEPTION WHEN undefined_column OR foreign_key_violation THEN NULL; END;

    -- Geo point (PostGIS geography) — unqualified ST_ like the project migrations
    BEGIN
      UPDATE public.listings
      SET location_geo = ST_SetSRID(
            ST_MakePoint(rows_arr[i][3]::float8, rows_arr[i][2]::float8), 4326)::geography
      WHERE id = v_listing_id;
    EXCEPTION WHEN undefined_column OR undefined_function THEN NULL; END;

    -- Lifestyle link (M2M)
    IF v_life_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.listing_lifestyles (listing_id, lifestyle_category_id, is_primary)
        VALUES (v_listing_id, v_life_id, true)
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN undefined_table THEN NULL; END;
    END IF;

    -- Photos: refresh demo images for this listing
    BEGIN
      DELETE FROM public.listing_images WHERE listing_id = v_listing_id;
      FOR j IN 1 .. array_length(img_sets, 2) LOOP
        INSERT INTO public.listing_images (listing_id, url, "order", category, caption)
        VALUES (
          v_listing_id,
          'https://images.unsplash.com/' || img_sets[i][j] || '?w=1200&q=80',
          j - 1,
          cats[j],
          NULL
        );
      END LOOP;
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reviews from the guest on the first three listings
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_guest UUID := 'a1b2c3d4-0000-4000-8000-000000000001';
  v_lid UUID;
  titles TEXT[] := ARRAY['Stunning Ocean View Villa','Modern Downtown Loft','Lakeside Retreat'];
  comments TEXT[] := ARRAY[
    'Absolutely breathtaking views and spotless throughout. The host was incredibly responsive!',
    'Perfect location in the heart of the city. Stylish, comfortable and great value.',
    'A peaceful lakeside escape — we did not want to leave. Highly recommended.'
  ];
  i INT;
BEGIN
  FOR i IN 1 .. array_length(titles,1) LOOP
    SELECT id INTO v_lid FROM public.listings WHERE title = titles[i] LIMIT 1;
    CONTINUE WHEN v_lid IS NULL;
    IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE listing_id = v_lid AND user_id = v_guest) THEN
      BEGIN
        INSERT INTO public.reviews (listing_id, user_id, rating, comment,
              rating_cleanliness, rating_accuracy, rating_communication, rating_location, rating_value, rating_check_in)
        VALUES (v_lid, v_guest, 5, comments[i], 5, 5, 5, 5, 4, 5);
      EXCEPTION WHEN undefined_column THEN
        INSERT INTO public.reviews (listing_id, user_id, rating, comment)
        VALUES (v_lid, v_guest, 5, comments[i]);
      END;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. A wishlist with two saved listings for the guest
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_guest UUID := 'a1b2c3d4-0000-4000-8000-000000000001';
  v_wid UUID;
  v_lid UUID;
  titles TEXT[] := ARRAY['Tropical Paradise Bungalow','Historic Tuscan Farmhouse'];
  i INT;
BEGIN
  SELECT id INTO v_wid FROM public.wishlists WHERE user_id = v_guest AND name = 'Dream Getaways' LIMIT 1;
  IF v_wid IS NULL THEN
    INSERT INTO public.wishlists (user_id, name) VALUES (v_guest, 'Dream Getaways') RETURNING id INTO v_wid;
  END IF;
  FOR i IN 1 .. array_length(titles,1) LOOP
    SELECT id INTO v_lid FROM public.listings WHERE title = titles[i] LIMIT 1;
    CONTINUE WHEN v_lid IS NULL;
    IF NOT EXISTS (SELECT 1 FROM public.wishlist_items WHERE wishlist_id = v_wid AND listing_id = v_lid) THEN
      INSERT INTO public.wishlist_items (wishlist_id, listing_id) VALUES (v_wid, v_lid);
    END IF;
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 8. One confirmed booking for the guest (best-effort against the live schema)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_guest UUID := 'a1b2c3d4-0000-4000-8000-000000000001';
  v_lid UUID;
  v_rate UUID;
  v_nightly NUMERIC;
BEGIN
  SELECT id, price_per_night INTO v_lid, v_nightly FROM public.listings WHERE title = 'Cozy Mountain Cabin' LIMIT 1;
  SELECT id INTO v_rate FROM public.commission_rates WHERE effective_to IS NULL LIMIT 1;
  IF v_lid IS NULL OR v_rate IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE listing_id = v_lid AND user_id = v_guest) THEN
    INSERT INTO public.bookings (
      listing_id, user_id, check_in, check_out, guests,
      subtotal, best_offer_subtotal, commission_rate_id, status, reservation_code
    ) VALUES (
      v_lid, v_guest,
      (now() + interval '14 days')::date,
      (now() + interval '18 days')::date,
      2,
      v_nightly * 4, 0, v_rate, 'confirmed', 'RSV-DEMO01'
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Booking seed skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------
DO $$
DECLARE c1 INT; c2 INT; c3 INT; c4 INT;
BEGIN
  SELECT count(*) INTO c1 FROM public.listings;
  SELECT count(*) INTO c2 FROM public.listing_images;
  SELECT count(*) INTO c3 FROM public.reviews;
  SELECT count(*) INTO c4 FROM public.bookings;
  RAISE NOTICE 'DEMO SEED DONE — listings=%, images=%, reviews=%, bookings=%', c1, c2, c3, c4;
END $$;
