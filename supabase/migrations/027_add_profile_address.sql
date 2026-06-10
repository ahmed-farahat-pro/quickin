-- Add address column to profiles table
-- This column was missing and caused errors when users tried to update their profile

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.address IS 'User physical address for shipping/billing';
