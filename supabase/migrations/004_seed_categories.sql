-- Seed data for categories
INSERT INTO public.categories (name, slug, icon) VALUES
  ('Beach', 'beach', 'waves'),
  ('Mountains', 'mountain', 'mountain'),
  ('Cities', 'city', 'building'),
  ('Countryside', 'countryside', 'tree-pine'),
  ('Tropical', 'tropical', 'palm-tree'),
  ('Lakefront', 'lakefront', 'anchor'),
  ('Skiing', 'skiing', 'snowflake'),
  ('Camping', 'camping', 'tent'),
  ('Desert', 'desert', 'sun'),
  ('Arctic', 'arctic', 'wind'),
  ('Castles', 'castles', 'castle'),
  ('Luxe', 'luxe', 'gem'),
  ('Trending', 'trending', 'flame'),
  ('Tiny Homes', 'tiny-homes', 'home')
ON CONFLICT (slug) DO NOTHING;
