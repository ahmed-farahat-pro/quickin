-- Conditions System for Listings
-- Allows hosts to select or propose conditions that guests must accept

-- Main conditions table
CREATE TABLE IF NOT EXISTS listing_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,  -- optional icon/image for better clarity
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = system-created
  is_approved BOOLEAN DEFAULT false,  -- must be approved by admin to be usable by all hosts
  is_system BOOLEAN DEFAULT false,  -- system presets (always approved, can't be deleted)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assignment table: links conditions to listings
CREATE TABLE IF NOT EXISTS listing_condition_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  condition_id UUID REFERENCES listing_conditions(id) ON DELETE CASCADE NOT NULL,
  is_required BOOLEAN DEFAULT true,  -- guest must check this to book
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, condition_id)
);

-- Enable RLS
ALTER TABLE listing_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_condition_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listing_conditions

-- Everyone can view approved or system conditions
CREATE POLICY "Anyone can view approved conditions"
  ON listing_conditions FOR SELECT
  USING (is_approved = true OR is_system = true);

-- Users can view their own pending conditions
CREATE POLICY "Users can view their pending conditions"
  ON listing_conditions FOR SELECT
  USING (created_by = auth.uid() AND is_approved = false);

-- Users can create conditions (will be pending)
CREATE POLICY "Users can create conditions"
  ON listing_conditions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    is_approved = false AND
    is_system = false
  );

-- Users can update their own pending conditions
CREATE POLICY "Users can update their pending conditions"
  ON listing_conditions FOR UPDATE
  USING (created_by = auth.uid() AND is_approved = false AND is_system = false);

-- Users can delete their own pending conditions
CREATE POLICY "Users can delete their pending conditions"
  ON listing_conditions FOR DELETE
  USING (created_by = auth.uid() AND is_approved = false AND is_system = false);

-- RLS Policies for listing_condition_assignments

-- Anyone can view condition assignments (to see listing requirements)
CREATE POLICY "Anyone can view condition assignments"
  ON listing_condition_assignments FOR SELECT
  USING (true);

-- Listing owners can manage their condition assignments
CREATE POLICY "Owners can manage condition assignments"
  ON listing_condition_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings 
      WHERE listings.id = listing_id AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update condition assignments"
  ON listing_condition_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings 
      WHERE listings.id = listing_id AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete condition assignments"
  ON listing_condition_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings 
      WHERE listings.id = listing_id AND listings.user_id = auth.uid()
    )
  );

-- Seed system conditions (always available)
INSERT INTO listing_conditions (name, description, is_approved, is_system) VALUES
  ('No smoking', 'Smoking is not allowed anywhere on the property', true, true),
  ('No pets', 'Pets are not allowed on the property', true, true),
  ('No parties or events', 'Parties, events, and large gatherings are not permitted', true, true),
  ('Quiet hours', 'Guests must observe quiet hours (typically 10 PM - 8 AM)', true, true),
  ('Check-in after 2 PM', 'Check-in time is after 2:00 PM', true, true),
  ('Check-out before 11 AM', 'Check-out time is before 11:00 AM', true, true),
  ('ID verification required', 'Guests must provide valid ID upon check-in', true, true),
  ('Maximum occupancy', 'The number of guests must not exceed the listing capacity', true, true),
  ('No unregistered guests', 'All guests staying overnight must be registered in the booking', true, true),
  ('Respect neighbors', 'Guests must be respectful of neighbors and the surrounding community', true, true)
ON CONFLICT DO NOTHING;
