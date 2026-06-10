
CREATE TABLE public.commission_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_rate       numeric NOT NULL CHECK (host_rate >= 0 AND host_rate < 1),
  guest_rate      numeric NOT NULL CHECK (guest_rate >= 0 AND guest_rate < 1),
  best_offer_rate numeric NOT NULL CHECK (best_offer_rate >= 0 AND best_offer_rate < 1),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_by      uuid REFERENCES public.staff_profiles(id),
  created_at      timestamptz DEFAULT now(),
  notes           text
);

CREATE UNIQUE INDEX commission_rates_single_active
  ON public.commission_rates ((true))
  WHERE effective_to IS NULL;

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read commission rates"
  ON public.commission_rates FOR SELECT USING (true);

CREATE POLICY "Staff can manage commission rates"
  ON public.commission_rates FOR ALL USING (true) WITH CHECK (true);
;
