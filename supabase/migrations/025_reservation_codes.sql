-- Migration: Reservation Codes
-- Purpose: Add unique 6-character alphanumeric codes to bookings for easy reference

-- Add reservation_code column to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS reservation_code CHAR(6) UNIQUE;

-- Create index for reservation code lookups
CREATE INDEX IF NOT EXISTS idx_bookings_code ON public.bookings(reservation_code);

-- Auto-generate alphanumeric reservation code
-- Uses A-Z (excluding O, I) and 2-9 (excluding 0, 1) to avoid confusion
-- 6 characters gives 30^6 = 729 million possible combinations
CREATE OR REPLACE FUNCTION generate_reservation_code() 
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  attempts INT := 0;
  max_attempts INT := 20;
BEGIN
  -- Only generate if code is not already set
  IF NEW.reservation_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  LOOP
    -- Generate random 6-character code
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE reservation_code = code) THEN
      NEW.reservation_code := code;
      RETURN NEW;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique reservation code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating reservation codes
DROP TRIGGER IF EXISTS set_reservation_code ON public.bookings;
CREATE TRIGGER set_reservation_code 
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_reservation_code();

-- Generate codes for existing bookings that don't have one
DO $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  booking_record RECORD;
  attempts INT;
BEGIN
  FOR booking_record IN SELECT id FROM public.bookings WHERE reservation_code IS NULL
  LOOP
    attempts := 0;
    LOOP
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      
      IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE reservation_code = code) THEN
        UPDATE public.bookings SET reservation_code = code WHERE id = booking_record.id;
        EXIT;
      END IF;
      
      attempts := attempts + 1;
      IF attempts >= 20 THEN
        RAISE WARNING 'Could not generate code for booking %', booking_record.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
