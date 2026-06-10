-- Add banners_config to site_settings
ALTER TABLE public.site_settings
ADD COLUMN banners_config JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Insert the default "Best Offers" banner to migrate the existing static behavior
UPDATE public.site_settings
SET banners_config = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'text', jsonb_build_object(
      'en', 'Best Offers of the Week — Explore curated deals on handpicked stays',
      'ar', 'أفضل عروض الأسبوع — استكشف صفقات مختارة لإقامات منتقاة بعناية'
    ),
    'preset', 'primary',
    'advanced_classes', '',
    'icon', 'Tag',
    'link', '/?bestOffer=true',
    'is_closable', false,
    'is_active', true
  )
)
WHERE id = 1;;
