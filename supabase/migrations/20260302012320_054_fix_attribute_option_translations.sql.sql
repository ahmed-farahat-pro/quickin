UPDATE public.attribute_options 
SET translations = '{"ar": "واي فاي متوفر", "fr": "WiFi disponible", "es": "WiFi disponible"}'::jsonb 
WHERE code = 'wifi_available';

UPDATE public.attribute_options 
SET translations = '{"ar": "واي فاي سريع", "fr": "WiFi rapide", "es": "WiFi rápido"}'::jsonb 
WHERE code = 'fast_wifi';;
