-- Migration: Identity Verification (KYC)
-- Purpose: Add verification status and document storage for user identity verification

-- Create verification_statuses lookup table
CREATE TABLE IF NOT EXISTS public.verification_statuses (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  label_ar TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default verification statuses
INSERT INTO public.verification_statuses (code, label, label_ar, description, sort_order) VALUES
  ('unverified', 'Unverified', 'غير موثق', 'User has not submitted verification documents', 1),
  ('pending', 'Pending Review', 'قيد المراجعة', 'Documents submitted, awaiting admin review', 2),
  ('verified', 'Verified', 'موثق', 'Identity verified by admin', 3),
  ('rejected', 'Rejected', 'مرفوض', 'Verification rejected, user can resubmit', 4)
ON CONFLICT (code) DO NOTHING;

-- Add verification columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status_id INT REFERENCES public.verification_statuses(id) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS id_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_back_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.staff_profiles(id);

-- Create index for verification status queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status_id);

-- Enable RLS on verification_statuses
ALTER TABLE public.verification_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for verification_statuses (read-only for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view verification statuses" ON public.verification_statuses;
CREATE POLICY "Anyone can view verification statuses" ON public.verification_statuses
  FOR SELECT USING (true);

-- Create storage bucket for identity documents (if not exists)
-- Note: This needs to be run via Supabase dashboard or using supabase CLI
-- The bucket should be PRIVATE (not public)

-- Create helper function to check if user is verified
CREATE OR REPLACE FUNCTION public.is_user_verified(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  status_code TEXT;
BEGIN
  SELECT vs.code INTO status_code
  FROM public.profiles p
  JOIN public.verification_statuses vs ON p.verification_status_id = vs.id
  WHERE p.id = user_id;
  
  RETURN status_code = 'verified';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user verification status
CREATE OR REPLACE FUNCTION public.get_user_verification_status(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  status_code TEXT;
BEGIN
  SELECT vs.code INTO status_code
  FROM public.profiles p
  JOIN public.verification_statuses vs ON p.verification_status_id = vs.id
  WHERE p.id = user_id;
  
  RETURN COALESCE(status_code, 'unverified');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON TABLE public.verification_statuses IS 'Lookup table for user identity verification statuses';
COMMENT ON COLUMN public.profiles.verification_status_id IS 'Foreign key to verification_statuses table';
COMMENT ON COLUMN public.profiles.id_front_url IS 'URL to uploaded ID card front image';
COMMENT ON COLUMN public.profiles.id_back_url IS 'URL to uploaded ID card back image';
COMMENT ON COLUMN public.profiles.selfie_url IS 'URL to uploaded selfie image';
COMMENT ON COLUMN public.profiles.verification_notes IS 'Admin notes about verification decision';
COMMENT ON COLUMN public.profiles.verification_submitted_at IS 'When user submitted documents for verification';
COMMENT ON COLUMN public.profiles.verified_at IS 'When admin verified/rejected the user';
COMMENT ON COLUMN public.profiles.verified_by IS 'Staff member who verified/rejected the user';
