-- Attributes & Capabilities System
-- Flexible system for describing what a place offers

-- =============================================
-- LOOKUP TABLES
-- =============================================

-- Attribute value types (option, number)
CREATE TABLE IF NOT EXISTS attribute_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attribute categories for grouping
CREATE TABLE IF NOT EXISTS attribute_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon_class TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CORE TABLES
-- =============================================

-- Main attributes table
CREATE TABLE IF NOT EXISTS attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES attribute_categories(id) ON DELETE SET NULL,
  type_id UUID REFERENCES attribute_types(id) ON DELETE RESTRICT NOT NULL,
  icon_class TEXT,              -- font icon (e.g., "lucide:wifi", "fa-wifi")
  icon_url TEXT,                -- fallback image URL
  is_filterable BOOLEAN DEFAULT true,
  is_highlighted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = system
  is_approved BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Options for attributes with type = 'option'
CREATE TABLE IF NOT EXISTS attribute_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(attribute_id, code)
);

-- Junction table: listing <-> attribute values
CREATE TABLE IF NOT EXISTS listing_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE NOT NULL,
  value_option_id UUID REFERENCES attribute_options(id) ON DELETE SET NULL,  -- for type = option
  value_number NUMERIC,         -- for type = number (>=1 means "has")
  notes TEXT,                   -- optional host notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, attribute_id)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE attribute_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_attributes ENABLE ROW LEVEL SECURITY;

-- Public read for lookup tables
CREATE POLICY "Anyone can view attribute types"
  ON attribute_types FOR SELECT USING (true);

CREATE POLICY "Anyone can view attribute categories"
  ON attribute_categories FOR SELECT USING (true);

-- Attributes: view approved/system OR own pending
CREATE POLICY "Anyone can view approved attributes"
  ON attributes FOR SELECT
  USING (is_approved = true AND is_enabled = true);

CREATE POLICY "Users can view own pending attributes"
  ON attributes FOR SELECT
  USING (created_by = auth.uid() AND is_approved = false);

CREATE POLICY "Users can create attributes"
  ON attributes FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    is_approved = false
  );

CREATE POLICY "Users can update own pending attributes"
  ON attributes FOR UPDATE
  USING (created_by = auth.uid() AND is_approved = false);

CREATE POLICY "Users can delete own pending attributes"
  ON attributes FOR DELETE
  USING (created_by = auth.uid() AND is_approved = false);

-- Attribute options: public read
CREATE POLICY "Anyone can view attribute options"
  ON attribute_options FOR SELECT USING (true);

-- Listing attributes: public read, owner write
CREATE POLICY "Anyone can view listing attributes"
  ON listing_attributes FOR SELECT USING (true);

CREATE POLICY "Owners can manage listing attributes"
  ON listing_attributes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND user_id = auth.uid())
  );

CREATE POLICY "Owners can update listing attributes"
  ON listing_attributes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND user_id = auth.uid())
  );

CREATE POLICY "Owners can delete listing attributes"
  ON listing_attributes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND user_id = auth.uid())
  );

-- =============================================
-- SEED DATA
-- =============================================

-- Seed attribute types
INSERT INTO attribute_types (code, label) VALUES
  ('option', 'Selection'),
  ('number', 'Numeric')
ON CONFLICT (code) DO NOTHING;

-- Seed categories
INSERT INTO attribute_categories (code, label, icon_class, display_order) VALUES
  ('utilities', 'Utilities', 'lucide:zap', 1),
  ('comfort', 'Comfort & Amenities', 'lucide:sofa', 2),
  ('views', 'Views & Surroundings', 'lucide:mountain', 3),
  ('access', 'Access & Parking', 'lucide:car', 4),
  ('safety', 'Safety & Security', 'lucide:shield', 5),
  ('entertainment', 'Entertainment', 'lucide:tv', 6),
  ('kitchen', 'Kitchen & Dining', 'lucide:utensils', 7)
ON CONFLICT (code) DO NOTHING;

-- Seed common attributes
DO $$
DECLARE
  v_option_type_id UUID;
  v_number_type_id UUID;
  v_cat_utilities UUID;
  v_cat_comfort UUID;
  v_cat_views UUID;
  v_cat_access UUID;
  v_cat_safety UUID;
  v_cat_entertainment UUID;
  v_cat_kitchen UUID;
  v_attr_id UUID;
BEGIN
  -- Get type IDs
  SELECT id INTO v_option_type_id FROM attribute_types WHERE code = 'option';
  SELECT id INTO v_number_type_id FROM attribute_types WHERE code = 'number';
  
  -- Get category IDs
  SELECT id INTO v_cat_utilities FROM attribute_categories WHERE code = 'utilities';
  SELECT id INTO v_cat_comfort FROM attribute_categories WHERE code = 'comfort';
  SELECT id INTO v_cat_views FROM attribute_categories WHERE code = 'views';
  SELECT id INTO v_cat_access FROM attribute_categories WHERE code = 'access';
  SELECT id INTO v_cat_safety FROM attribute_categories WHERE code = 'safety';
  SELECT id INTO v_cat_entertainment FROM attribute_categories WHERE code = 'entertainment';
  SELECT id INTO v_cat_kitchen FROM attribute_categories WHERE code = 'kitchen';

  -- WiFi (option)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved, is_highlighted)
  VALUES ('wifi', 'WiFi', v_cat_utilities, v_option_type_id, 'lucide:wifi', true, true)
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_attr_id;
  
  IF v_attr_id IS NOT NULL THEN
    INSERT INTO attribute_options (attribute_id, code, label, display_order) VALUES
      (v_attr_id, 'none', 'No WiFi', 1),
      (v_attr_id, 'available', 'WiFi Available', 2),
      (v_attr_id, 'fast', 'Fast WiFi', 3)
    ON CONFLICT (attribute_id, code) DO NOTHING;
  END IF;

  -- Air Conditioning (number: 1 = has)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved, is_highlighted)
  VALUES ('ac', 'Air Conditioning', v_cat_comfort, v_number_type_id, 'lucide:fan', true, true)
  ON CONFLICT (code) DO NOTHING;

  -- Heating (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('heating', 'Heating', v_cat_comfort, v_number_type_id, 'lucide:flame', true)
  ON CONFLICT (code) DO NOTHING;

  -- Sea View (option)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved, is_highlighted)
  VALUES ('sea_view', 'Sea View', v_cat_views, v_option_type_id, 'lucide:waves', true, true)
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_attr_id;
  
  IF v_attr_id IS NOT NULL THEN
    INSERT INTO attribute_options (attribute_id, code, label, display_order) VALUES
      (v_attr_id, 'none', 'No Sea View', 1),
      (v_attr_id, 'partial', 'Partial Sea View', 2),
      (v_attr_id, 'full', 'Full Sea View', 3)
    ON CONFLICT (attribute_id, code) DO NOTHING;
  END IF;

  -- Elevator (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('elevator', 'Elevator', v_cat_access, v_number_type_id, 'lucide:arrow-up-down', true)
  ON CONFLICT (code) DO NOTHING;

  -- Parking (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved, is_highlighted)
  VALUES ('parking', 'Parking Spaces', v_cat_access, v_number_type_id, 'lucide:car', true, true)
  ON CONFLICT (code) DO NOTHING;

  -- Pool (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved, is_highlighted)
  VALUES ('pool', 'Swimming Pool', v_cat_comfort, v_number_type_id, 'lucide:waves', true, true)
  ON CONFLICT (code) DO NOTHING;

  -- TV (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('tv', 'TV', v_cat_entertainment, v_number_type_id, 'lucide:tv', true)
  ON CONFLICT (code) DO NOTHING;

  -- Washer (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('washer', 'Washing Machine', v_cat_comfort, v_number_type_id, 'lucide:shirt', true)
  ON CONFLICT (code) DO NOTHING;

  -- Kitchen (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('kitchen', 'Full Kitchen', v_cat_kitchen, v_number_type_id, 'lucide:utensils', true)
  ON CONFLICT (code) DO NOTHING;

  -- Security Camera (number)
  INSERT INTO attributes (code, label, category_id, type_id, icon_class, is_approved)
  VALUES ('security_camera', 'Security Camera', v_cat_safety, v_number_type_id, 'lucide:camera', true)
  ON CONFLICT (code) DO NOTHING;

END $$;
