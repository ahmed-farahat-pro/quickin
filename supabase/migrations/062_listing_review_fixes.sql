-- 062_listing_review_fixes.sql

-- 1. Allow staff to view all listings (including unpublished/draft ones)
CREATE POLICY "Staff can view all listings"
  ON public.listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE staff_profiles.id = auth.uid()
      AND staff_profiles.is_active = true
    )
  );

-- 2. Allow staff to update all listings
CREATE POLICY "Staff can update all listings"
  ON public.listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE staff_profiles.id = auth.uid()
      AND staff_profiles.is_active = true
    )
  );

-- 3. Create a trigger to automatically notify admins and create an audit log
-- when a listing is created or updated to 'pending_review' status.
-- This runs with SECURITY DEFINER to bypass RLS for inserting notifications.
CREATE OR REPLACE FUNCTION handle_listing_review_submission()
RETURNS TRIGGER AS $$
DECLARE
  staff_id UUID;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.review_status = 'pending_review') OR 
     (TG_OP = 'UPDATE' AND NEW.review_status = 'pending_review' AND OLD.review_status != 'pending_review') THEN
     
     -- Insert audit log
     INSERT INTO public.audit_logs (
       actor_id, actor_type, action, action_category, entity_type, entity_id, entity_name, new_data, old_data, notes
     ) VALUES (
       NEW.user_id, 'user', 'listing.submitted_for_review', 'content', 'listing', NEW.id, NEW.title, row_to_json(NEW), CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END, 'Listing submitted for admin review.'
     );

     -- Insert notification for each active staff member
     FOR staff_id IN SELECT id FROM public.staff_profiles WHERE is_active = true LOOP
        INSERT INTO public.user_notifications (
          user_id, type, title, message, related_entity_id, related_entity_type
        ) VALUES (
          staff_id, 
          'listing_review', 
          'Listing Review Required', 
          'Host submitted listing "' || NEW.title || '" for review.', 
          NEW.id, 
          'listing'
        );
     END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_listing_review_submission ON public.listings;
CREATE TRIGGER trg_listing_review_submission
AFTER INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION handle_listing_review_submission();
