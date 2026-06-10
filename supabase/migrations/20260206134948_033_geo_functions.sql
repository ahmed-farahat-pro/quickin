-- RPC function to search listings by distance
-- Allows chaining with other filters
create or replace function get_listings_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision
)
returns setof public.listings
language sql
stable
as $$
  select *
  from public.listings
  where st_dwithin(
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    radius_km * 1000
  )
$$;;
