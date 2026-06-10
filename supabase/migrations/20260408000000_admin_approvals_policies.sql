-- Add RLS policies for admins to view and manage all attributes and conditions

-- Policies for attributes
CREATE POLICY "Admins can view all attributes"
  ON attributes FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all attributes"
  ON attributes FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all attributes"
  ON attributes FOR DELETE
  USING (is_admin(auth.uid()));

-- Policies for listing_conditions
CREATE POLICY "Admins can view all conditions"
  ON listing_conditions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all conditions"
  ON listing_conditions FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all conditions"
  ON listing_conditions FOR DELETE
  USING (is_admin(auth.uid()));
