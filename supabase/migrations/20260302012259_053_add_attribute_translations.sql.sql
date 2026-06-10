-- Migration 053: Add Attribute Translations
-- Adds translations column to attribute system tables and populates with initial data

-- 1. Schema Updates
ALTER TABLE public.attribute_categories ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.attributes ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.attribute_options ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 2. Populate Attribute Categories
UPDATE public.attribute_categories SET translations = '{"ar": "مرافق", "fr": "Services public", "es": "Servicios"}'::jsonb WHERE code = 'utilities';
UPDATE public.attribute_categories SET translations = '{"ar": "الراحة والمرافق", "fr": "Confort et commodités", "es": "Confort y servicios"}'::jsonb WHERE code = 'comfort';
UPDATE public.attribute_categories SET translations = '{"ar": "الإطلالات والمحيط", "fr": "Vues et environs", "es": "Vistas y alrededores"}'::jsonb WHERE code = 'views';
UPDATE public.attribute_categories SET translations = '{"ar": "الوصول والمواقف", "fr": "Accès et parking", "es": "Acceso y aparcamiento"}'::jsonb WHERE code = 'access';
UPDATE public.attribute_categories SET translations = '{"ar": "السلامة والأمن", "fr": "Sûreté et sécurité", "es": "Seguridad y protección"}'::jsonb WHERE code = 'safety';
UPDATE public.attribute_categories SET translations = '{"ar": "الترفيه", "fr": "Divertissement", "es": "Entretenimiento"}'::jsonb WHERE code = 'entertainment';
UPDATE public.attribute_categories SET translations = '{"ar": "المطبخ وتناول الطعام", "fr": "Cuisine et salle à manger", "es": "Cocina y comedor"}'::jsonb WHERE code = 'kitchen';

-- 3. Populate Attributes
UPDATE public.attributes SET translations = '{"ar": "واي فاي", "fr": "WiFi", "es": "WiFi"}'::jsonb WHERE code = 'wifi';
UPDATE public.attributes SET translations = '{"ar": "تكييف هواء", "fr": "Climatisation", "es": "Aire acondicionado"}'::jsonb WHERE code = 'ac';
UPDATE public.attributes SET translations = '{"ar": "تدفئة", "fr": "Chauffage", "es": "Calefacción"}'::jsonb WHERE code = 'heating';
UPDATE public.attributes SET translations = '{"ar": "مصعد", "fr": "Ascenseur", "es": "Ascensor"}'::jsonb WHERE code = 'elevator';
UPDATE public.attributes SET translations = '{"ar": "مواقف السيارات", "fr": "Places de parking", "es": "Plazas de aparcamiento"}'::jsonb WHERE code = 'parking';
UPDATE public.attributes SET translations = '{"ar": "حمام سباحة", "fr": "Piscine", "es": "Piscina"}'::jsonb WHERE code = 'pool';
UPDATE public.attributes SET translations = '{"ar": "تلفزيون", "fr": "Télévision", "es": "Televisión"}'::jsonb WHERE code = 'tv';
UPDATE public.attributes SET translations = '{"ar": "غسالة ملابس", "fr": "Lave-linge", "es": "Lavadora"}'::jsonb WHERE code = 'washer';
UPDATE public.attributes SET translations = '{"ar": "مطبخ كامل", "fr": "Cuisine complète", "es": "Cocina completa"}'::jsonb WHERE code = 'kitchen';
UPDATE public.attributes SET translations = '{"ar": "كاميرا مراقبة", "fr": "Caméra de sécurité", "es": "Cámara de seguridad"}'::jsonb WHERE code = 'security_camera';
UPDATE public.attributes SET translations = '{"ar": "الوصول إلى الشاطئ", "fr": "Accès à la plage", "es": "Acceso a la playa"}'::jsonb WHERE code = 'beach_access';
UPDATE public.attributes SET translations = '{"ar": "حوض استحمام ساخن", "fr": "Baignoire d''hydromassage", "es": "Jacuzzi"}'::jsonb WHERE code = 'hot_tub';
UPDATE public.attributes SET translations = '{"ar": "مدفأة", "fr": "Cheminée", "es": "Chimenea"}'::jsonb WHERE code = 'fireplace';
UPDATE public.attributes SET translations = '{"ar": "رصيف القوارب", "fr": "Quai pour bateaux", "es": "Muelle"}'::jsonb WHERE code = 'boat_dock';
UPDATE public.attributes SET translations = '{"ar": "إطلالة على البحر", "fr": "Vue sur mer", "es": "Vista al mar"}'::jsonb WHERE code = 'sea_view';
UPDATE public.attributes SET translations = '{"ar": "إطلالة على المدينة", "fr": "Vue sur la ville", "es": "Vista a la ciudad"}'::jsonb WHERE code = 'city_view';
UPDATE public.attributes SET translations = '{"ar": "حديقة", "fr": "Jardin", "es": "Jardín"}'::jsonb WHERE code = 'garden';
UPDATE public.attributes SET translations = '{"ar": "إطلالة على النهر", "fr": "Vue sur la rivière", "es": "Vista al río"}'::jsonb WHERE code = 'river_view';

-- 4. Populate Attribute Options
UPDATE public.attribute_options SET translations = '{"ar": "واي فاي متوفر", "fr": "WiFi disponible", "es": "WiFi disponible"}'::jsonb WHERE code = 'available' AND attribute_id IN (SELECT id FROM public.attributes WHERE code = 'wifi');
UPDATE public.attribute_options SET translations = '{"ar": "واي فاي سريع", "fr": "WiFi rapide", "es": "WiFi rápido"}'::jsonb WHERE code = 'fast' AND attribute_id IN (SELECT id FROM public.attributes WHERE code = 'wifi');

UPDATE public.attribute_options SET translations = '{"ar": "إطلالة جزئية على البحر", "fr": "Vue partielle sur mer", "es": "Vista parcial al mar"}'::jsonb WHERE code = 'partial_sea_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة كاملة على البحر", "fr": "Vue complète sur mer", "es": "Vista completa al mar"}'::jsonb WHERE code = 'full_sea_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة بانورامية على البحر", "fr": "Vue panoramique sur mer", "es": "Vista panorámica al mar"}'::jsonb WHERE code = 'panoramic_sea_view';

UPDATE public.attribute_options SET translations = '{"ar": "إطلالة على الشارع", "fr": "Vue sur la rue", "es": "Vista a la calle"}'::jsonb WHERE code = 'street_city_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة على الأفق", "fr": "Vue sur l''horizon", "es": "Vista al skyline"}'::jsonb WHERE code = 'skyline_city_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة على معلم", "fr": "Vue sur un monument", "es": "Vista a un punto de interés"}'::jsonb WHERE code = 'landmark_city_view';

UPDATE public.attribute_options SET translations = '{"ar": "حديقة مشتركة", "fr": "Jardin partagé", "es": "Jardín compartido"}'::jsonb WHERE code = 'shared_garden';
UPDATE public.attribute_options SET translations = '{"ar": "حديقة خاصة", "fr": "Jardin privé", "es": "Jardín privado"}'::jsonb WHERE code = 'private_garden';

UPDATE public.attribute_options SET translations = '{"ar": "إطلالة جزئية على النهر", "fr": "Vue partielle sur la rivière", "es": "Vista parcial al río"}'::jsonb WHERE code = 'partial_river_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة كاملة على النهر", "fr": "Vue complète sur la rivière", "es": "Vue complète au rivière"}'::jsonb WHERE code = 'full_river_view';
UPDATE public.attribute_options SET translations = '{"ar": "إطلالة بانورامية على النهر", "fr": "Vue panoramique sur la rivière", "es": "Vista panorámica al río"}'::jsonb WHERE code = 'panoramic_river_view';;
