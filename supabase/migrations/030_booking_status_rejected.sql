-- Fix: booking_status is an ENUM, not a TEXT column with a CHECK constraint.
-- We need to add the 'rejected' value to the enum type.

-- This command adds the value to the enum list
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'rejected';

-- Just in case there was a check constraint from an even older version, we can try to drop it
-- (It likely doesn't exist or isn't active if the column is ENUM)
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
