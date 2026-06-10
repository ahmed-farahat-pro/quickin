ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'stalled';
ALTER TABLE public.bookings ADD COLUMN paid_amount numeric;;
