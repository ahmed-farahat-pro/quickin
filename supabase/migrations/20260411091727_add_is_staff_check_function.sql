-- Function to check if a user is a staff member (bypassing RLS)
CREATE OR REPLACE FUNCTION public.is_staff_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = p_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to public (authenticated and anon)
GRANT EXECUTE ON FUNCTION public.is_staff_member(UUID) TO public;
