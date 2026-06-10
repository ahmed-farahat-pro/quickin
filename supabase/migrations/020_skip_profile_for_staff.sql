-- Migration: Update handle_new_user to skip staff members
-- Staff members should not have a guest/host profile automatically created

-- Replace the function to check for is_staff metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip profile creation for staff members
  -- Staff are invited via admin panel and have is_staff metadata set
  IF (NEW.raw_user_meta_data->>'is_staff')::boolean = true THEN
    RETURN NEW;
  END IF;

  -- Create profile for regular users (guests/hosts)
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
