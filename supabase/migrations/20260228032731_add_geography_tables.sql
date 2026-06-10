CREATE TABLE public.countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso2 VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    emoji VARCHAR(10),
    latitude NUMERIC,
    longitude NUMERIC,
    translations JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_iso2 VARCHAR(2) NOT NULL REFERENCES public.countries(iso2) ON DELETE CASCADE,
    iso2 VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    translations JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(country_iso2, iso2)
);

CREATE TABLE public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_iso2 VARCHAR(2) NOT NULL REFERENCES public.countries(iso2) ON DELETE CASCADE,
    state_iso2 VARCHAR(10),
    name VARCHAR(255) NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    translations JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_custom BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    FOREIGN KEY (country_iso2, state_iso2) REFERENCES public.states(country_iso2, iso2) ON DELETE SET NULL
);

-- Add indexes for common query patterns
CREATE INDEX idx_countries_is_active ON public.countries(is_active);
CREATE INDEX idx_states_country_iso2 ON public.states(country_iso2);
CREATE INDEX idx_cities_country_iso2 ON public.cities(country_iso2);
CREATE INDEX idx_cities_state_iso2 ON public.cities(state_iso2);

-- Set up Row Level Security (RLS)
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Allow public read access (everyone needs to see countries/states/cities)
CREATE POLICY "Enable read access for all users" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.states FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.cities FOR SELECT USING (true);
;
