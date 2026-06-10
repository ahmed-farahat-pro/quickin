-- Create the Enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    END IF;
END $$;

-- Alter table to use the new Enum
ALTER TABLE public.bookings 
  DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Drop dependent RLS policy to allow column type change
DROP POLICY IF EXISTS "Users can create reviews for their completed bookings" ON public.reviews;

-- Drop old default first
ALTER TABLE public.bookings 
  ALTER COLUMN status DROP DEFAULT;

-- Change type
ALTER TABLE public.bookings 
  ALTER COLUMN status TYPE booking_status USING status::booking_status;

-- Set new default
ALTER TABLE public.bookings 
  ALTER COLUMN status SET DEFAULT 'pending'::booking_status;

-- Recreate RLS policy
CREATE POLICY "Users can create reviews for their completed bookings" 
  ON public.reviews FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE id = booking_id AND user_id = auth.uid() AND status = 'completed'::booking_status
    )
  );
