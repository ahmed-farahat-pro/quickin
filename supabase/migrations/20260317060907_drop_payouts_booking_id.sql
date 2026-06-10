-- Drop the foreign key constraint explicitly
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_booking_id_fkey;

-- Drop the column
ALTER TABLE public.payouts DROP COLUMN IF EXISTS booking_id;;
