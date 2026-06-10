ALTER TABLE public.listings 
ADD COLUMN country_id uuid REFERENCES public.countries(id),
ADD COLUMN state_id uuid REFERENCES public.states(id),
ADD COLUMN city_id uuid REFERENCES public.cities(id);

WITH RandomCities AS (
  SELECT l.id as listing_id, c.id as city_id, s.id as state_id, ctr.id as country_id
  FROM public.listings l
  CROSS JOIN LATERAL (
    SELECT id, state_iso2, country_iso2 FROM public.cities ORDER BY random() LIMIT 1
  ) c
  LEFT JOIN public.states s ON s.iso2 = c.state_iso2 AND s.country_iso2 = c.country_iso2
  LEFT JOIN public.countries ctr ON ctr.iso2 = c.country_iso2
)
UPDATE public.listings l
SET 
  country_id = rc.country_id,
  state_id = rc.state_id,
  city_id = rc.city_id
FROM RandomCities rc
WHERE l.id = rc.listing_id;

UPDATE public.listings
SET country_id = (SELECT id FROM public.countries WHERE name = 'Egypt' LIMIT 1)
WHERE country_id IS NULL;

ALTER TABLE public.listings
DROP COLUMN country,
DROP COLUMN state,
DROP COLUMN city;;
