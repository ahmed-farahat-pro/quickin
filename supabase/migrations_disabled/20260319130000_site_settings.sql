-- Site Settings Migration
-- Creates a single-row table to store site configuration like homepage hero, navigation, etc.

CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  navbar_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  footer_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert the default row so we always have ID = 1
INSERT INTO public.site_settings (id, hero_config, navbar_config, footer_config)
VALUES (
  1, 
  '{
    "background_type": "image",
    "media_url": null,
    "title": { "en": "Find your next adventure", "ar": "ابحث عن مغامرتك القادمة" },
    "subtitle": { "en": "Discover unique homes and experiences", "ar": "اكتشف منازل وتجارب فريدة" }
  }'::jsonb, 
  '{"links": []}'::jsonb, 
  '{"columns": []}'::jsonb
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read site settings
CREATE POLICY "Site settings are viewable by everyone" 
ON public.site_settings FOR SELECT 
USING (true);

-- Only admins/moderators can update site settings
CREATE POLICY "Site settings are updatable by staff" 
ON public.site_settings FOR UPDATE 
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
);

-- Create a storage bucket for site media (logos, hero backgrounds, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  52428800, -- 50MB for videos/images
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for the site-media bucket

-- Public can read site media
CREATE POLICY "Site media is publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'site-media');

-- Staff can insert site media
CREATE POLICY "Staff can upload site media" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'site-media' AND
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
    AND staff_profiles.role IN ('admin', 'moderator')
  )
);

-- Staff can update site media
CREATE POLICY "Staff can update site media" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'site-media' AND
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
    AND staff_profiles.role IN ('admin', 'moderator')
  )
);

-- Staff can delete site media
CREATE POLICY "Staff can delete site media" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'site-media' AND
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.id = auth.uid()
    AND staff_profiles.is_active = true
    AND staff_profiles.role IN ('admin', 'moderator')
  )
);
