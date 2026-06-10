-- Allow staff to update user profiles for verification status changes
-- This fixes the issue where admins/staff cannot update verification_status_id

-- Policy for staff to update profiles
CREATE POLICY "Staff can update user profiles" 
  ON public.profiles FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles 
      WHERE staff_profiles.id = auth.uid() 
      AND staff_profiles.is_active = true
    )
  );

-- Also ensure staff can view all profiles
CREATE POLICY "Staff can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles 
      WHERE staff_profiles.id = auth.uid() 
      AND staff_profiles.is_active = true
    )
  );
