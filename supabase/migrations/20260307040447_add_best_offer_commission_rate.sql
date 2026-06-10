-- Add the default best offer commission rate to platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('best_offer_commission_rate', '0.02')
ON CONFLICT (key) DO NOTHING;;
