-- =============================================================================
-- SEED DATA: Sample Listings
-- =============================================================================
-- Description: Populates the database with sample listing data for development
--              and demonstration purposes.
-- 
-- Prerequisites:
--   - Run 001_initial_schema.sql first (creates tables)
--   - Run 002_rls_policies.sql (security policies)
--   - Run 003_functions.sql (helper functions)
--   - Run 004_seed_categories.sql (category lookup data)
--   - Admin user must exist in auth.users and profiles
--
-- Admin User ID: edeb65a3-e6e3-4fd7-aabb-962ddf0906a8
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Update Admin Profile to Host Status
-- -----------------------------------------------------------------------------
-- Set the admin user as a host so they can own listings
UPDATE public.profiles 
SET 
  is_host = true,
  full_name = COALESCE(full_name, 'Admin Host'),
  bio = 'Superhost with a passion for hospitality. Managing premium properties worldwide.'
WHERE id = 'edeb65a3-e6e3-4fd7-aabb-962ddf0906a8';

-- -----------------------------------------------------------------------------
-- Insert Sample Listings
-- -----------------------------------------------------------------------------
-- Each listing references:
--   - user_id: The admin host who owns the listing
--   - category_id: Looked up from categories table by slug
--   - images: Array of Unsplash URLs for high-quality photos
--   - amenities: Array of available amenities
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  -- Admin user ID constant
  v_admin_id CONSTANT UUID := 'edeb65a3-e6e3-4fd7-aabb-962ddf0906a8';
  
  -- Category IDs (looked up from categories table)
  v_beach_id UUID;
  v_mountain_id UUID;
  v_city_id UUID;
  v_tropical_id UUID;
  v_countryside_id UUID;
  v_lakefront_id UUID;
  v_desert_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- LOCAL SEED: create the admin/host auth user so the FK below is satisfied.
  -- The on_auth_user_created trigger auto-creates the matching profile row.
  -- Login: admin@quickin.test / password123
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'admin@quickin.test', extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Host"}'::jsonb,
    '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- Safety net in case the trigger did not fire
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_admin_id, 'admin@quickin.test', 'Admin Host')
  ON CONFLICT (id) DO NOTHING;

  -- Lookup category IDs by slug
  SELECT id INTO v_beach_id FROM public.categories WHERE slug = 'beach';
  SELECT id INTO v_mountain_id FROM public.categories WHERE slug = 'mountain';
  SELECT id INTO v_city_id FROM public.categories WHERE slug = 'city';
  SELECT id INTO v_tropical_id FROM public.categories WHERE slug = 'tropical';
  SELECT id INTO v_countryside_id FROM public.categories WHERE slug = 'countryside';
  SELECT id INTO v_lakefront_id FROM public.categories WHERE slug = 'lakefront';
  SELECT id INTO v_desert_id FROM public.categories WHERE slug = 'desert';

  -- -------------------------------------------------------------------------
  -- Listing 1: Beachfront Villa (Malibu)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Stunning Ocean View Villa',
    'Experience the ultimate beachfront luxury in this stunning Malibu villa. ' ||
    'Wake up to panoramic ocean views and fall asleep to the sound of waves. ' ||
    'This beautifully designed home features floor-to-ceiling windows, ' ||
    'a gourmet kitchen, and a private deck perfect for sunset cocktails.',
    350,
    'Malibu, California', 'United States',
    8, 4, 5, 3,
    v_beach_id,
    ARRAY[
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80'
    ],
    ARRAY['WiFi', 'Pool', 'Kitchen', 'Air conditioning', 'Free parking'],
    true,  -- is_guest_favorite
    true   -- is_published
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 2: Mountain Cabin (Aspen)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Cozy Mountain Cabin',
    'Escape to this charming mountain retreat nestled in the heart of Aspen. ' ||
    'Enjoy stunning mountain views from the wrap-around deck, ' ||
    'cozy up by the fireplace, or explore nearby hiking trails and ski slopes.',
    275,
    'Aspen, Colorado', 'United States',
    6, 3, 4, 2,
    v_mountain_id,
    ARRAY[
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'
    ],
    ARRAY['WiFi', 'Kitchen', 'Fireplace', 'Free parking', 'TV'],
    false,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 3: Downtown Loft (New York)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Modern Downtown Loft',
    'City living at its finest. This sleek, modern loft is located in the heart ' ||
    'of Manhattan with easy access to world-class dining, shopping, and entertainment. ' ||
    'Floor-to-ceiling windows offer stunning city views.',
    420,
    'New York City, New York', 'United States',
    4, 2, 2, 2,
    v_city_id,
    ARRAY[
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'
    ],
    ARRAY['WiFi', 'Kitchen', 'TV', 'Air conditioning'],
    true,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 4: Tropical Bungalow (Thailand)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Tropical Paradise Bungalow',
    'Your island escape awaits in this beautiful beachfront bungalow. ' ||
    'Steps from pristine white sand beaches with crystal clear waters. ' ||
    'Perfect for a romantic getaway or peaceful retreat.',
    180,
    'Koh Samui', 'Thailand',
    4, 2, 2, 1,
    v_tropical_id,
    ARRAY['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80'],
    ARRAY['WiFi', 'Pool', 'Beach Access', 'Air conditioning'],
    false,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 5: Tuscan Farmhouse (Italy)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Historic Tuscan Farmhouse',
    'Experience Italian countryside living in this beautifully restored ' ||
    '18th-century farmhouse. Surrounded by olive groves and vineyards ' ||
    'with breathtaking views of the Tuscan hills.',
    295,
    'Florence', 'Italy',
    10, 5, 6, 4,
    v_countryside_id,
    ARRAY['https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80'],
    ARRAY['WiFi', 'Pool', 'Kitchen', 'Garden', 'Free parking'],
    true,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 6: Lake Villa (Lake Como)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Lakeside Retreat',
    'Serenity by the lake. This elegant villa offers direct lake access, ' ||
    'private boat dock, and stunning mountain views across the water. ' ||
    'The perfect blend of luxury and natural beauty.',
    450,
    'Lake Como', 'Italy',
    8, 4, 5, 3,
    v_lakefront_id,
    ARRAY['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80'],
    ARRAY['WiFi', 'Kitchen', 'Boat Dock', 'Garden'],
    false,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 7: Desert Home (Arizona)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Desert Oasis Home',
    'Modern desert living with stunning sunset views. This contemporary home ' ||
    'features a private pool, hot tub, and seamless indoor-outdoor living. ' ||
    'Experience the magic of the Sonoran Desert.',
    225,
    'Scottsdale, Arizona', 'United States',
    6, 3, 4, 2,
    v_desert_id,
    ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80'],
    ARRAY['WiFi', 'Pool', 'Hot Tub', 'Air conditioning', 'Free parking'],
    false,
    true
  ) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Listing 8: Beach Cottage (Australia)
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    user_id, title, description, price_per_night,
    location, country, max_guests, bedrooms, beds, bathrooms,
    category_id, images, amenities, is_guest_favorite, is_published
  ) VALUES (
    v_admin_id,
    'Beachfront Cottage',
    'Wake up to ocean views in this charming beachfront cottage. ' ||
    'Perfect for surfers and beach lovers with direct beach access. ' ||
    'Enjoy the laid-back Byron Bay lifestyle.',
    320,
    'Byron Bay', 'Australia',
    6, 3, 4, 2,
    v_beach_id,
    ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80'],
    ARRAY['WiFi', 'Kitchen', 'Beach Access', 'Free parking'],
    false,
    true
  ) ON CONFLICT DO NOTHING;

  -- Log success
  RAISE NOTICE 'Successfully seeded % demo listings', 8;
END $$;

-- =============================================================================
-- End of Seed Data
-- =============================================================================
