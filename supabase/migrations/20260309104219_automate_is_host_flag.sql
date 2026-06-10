CREATE OR REPLACE FUNCTION update_is_host_on_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set is_host to true when a user creates their first listing
  UPDATE public.profiles
  SET is_host = true
  WHERE id = NEW.user_id AND is_host = false;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_listing_created ON public.listings;
CREATE TRIGGER on_listing_created
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION update_is_host_on_listing();;
