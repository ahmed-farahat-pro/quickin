CREATE TABLE public.custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title JSONB NOT NULL DEFAULT '{"en": "", "ar": ""}'::jsonb,
  content JSONB NOT NULL DEFAULT '{"en": "", "ar": ""}'::jsonb,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public pages are viewable by everyone" 
ON public.custom_pages FOR SELECT 
USING (is_published = true);

CREATE POLICY "Custom pages are updatable by staff" 
ON public.custom_pages FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
    AND staff_profiles.role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
    AND staff_profiles.role IN ('admin', 'moderator')
  )
);;
