DROP POLICY IF EXISTS "Staff can delete all listings" ON listings;

CREATE POLICY "Staff can delete all listings"
  ON listings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
  ));