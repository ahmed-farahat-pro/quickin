-- Migration 055: Add More Translations
-- Adds translations column to lifestyle_categories, listing_conditions, and property_types

-- 1. Schema Updates
ALTER TABLE public.lifestyle_categories ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.listing_conditions ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.property_types ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 2. Populate Lifestyle Categories
UPDATE public.lifestyle_categories SET translations = '{"ar": "استوائي", "fr": "Tropical", "es": "Tropical"}'::jsonb WHERE name = 'Tropical';
UPDATE public.lifestyle_categories SET translations = '{"ar": "تزلج", "fr": "Ski", "es": "Esquí"}'::jsonb WHERE name = 'Skiing';
UPDATE public.lifestyle_categories SET translations = '{"ar": "تخييم", "fr": "Camping", "es": "Camping"}'::jsonb WHERE name = 'Camping';
UPDATE public.lifestyle_categories SET translations = '{"ar": "منازل صغيرة", "fr": "Minuscules maisons", "es": "Casas diminutas"}'::jsonb WHERE name = 'Tiny Homes';
UPDATE public.lifestyle_categories SET translations = '{"ar": "شاطئ", "fr": "Plage", "es": "Playa"}'::jsonb WHERE name = 'Beach';
UPDATE public.lifestyle_categories SET translations = '{"ar": "جبال", "fr": "Montagnes", "es": "Montañas"}'::jsonb WHERE name = 'Mountains';
UPDATE public.lifestyle_categories SET translations = '{"ar": "مدينة", "fr": "Ville", "es": "Ciudad"}'::jsonb WHERE name = 'City';
UPDATE public.lifestyle_categories SET translations = '{"ar": "ريف", "fr": "Campagne", "es": "Campo"}'::jsonb WHERE name = 'Countryside';
UPDATE public.lifestyle_categories SET translations = '{"ar": "فاخر", "fr": "Luxe", "es": "Lujo"}'::jsonb WHERE name = 'Luxe';
UPDATE public.lifestyle_categories SET translations = '{"ar": "قلاع", "fr": "Châteaux", "es": "Castillos"}'::jsonb WHERE name = 'Castles';
UPDATE public.lifestyle_categories SET translations = '{"ar": "مطل على البحيرة", "fr": "Bord de lac", "es": "Frente al lago"}'::jsonb WHERE name = 'Lakefront';
UPDATE public.lifestyle_categories SET translations = '{"ar": "قطبي", "fr": "Arctique", "es": "Ártico"}'::jsonb WHERE name = 'Arctic';
UPDATE public.lifestyle_categories SET translations = '{"ar": "صحراء", "fr": "Désert", "es": "Desierto"}'::jsonb WHERE name = 'Desert';

-- 3. Populate Listing Conditions
UPDATE public.listing_conditions SET translations = '{"ar": "ممنوع التدخين", "fr": "Non-fumeur", "es": "No fumar"}'::jsonb WHERE name = 'No smoking';
UPDATE public.listing_conditions SET translations = '{"ar": "ممنوع الحيوانات الأليفة", "fr": "Pas d''animaux", "es": "No se admiten mascotas"}'::jsonb WHERE name = 'No pets';
UPDATE public.listing_conditions SET translations = '{"ar": "ممنوع الحفلات أو الفعاليات", "fr": "Pas de fêtes ni d''événements", "es": "No se permiten fiestas ni eventos"}'::jsonb WHERE name = 'No parties or events';
UPDATE public.listing_conditions SET translations = '{"ar": "ساعات الهدوء", "fr": "Heures de calme", "es": "Horas de silencio"}'::jsonb WHERE name = 'Quiet hours';
UPDATE public.listing_conditions SET translations = '{"ar": "تسجيل الوصول بعد الساعة 2 مساءً", "fr": "Arrivée après 14h00", "es": "Check-in después de las 2 PM"}'::jsonb WHERE name = 'Check-in after 2 PM';
UPDATE public.listing_conditions SET translations = '{"ar": "تسجيل المغادرة قبل الساعة 11 صباحاً", "fr": "Départ avant 11h00", "es": "Check-out antes de las 11 AM"}'::jsonb WHERE name = 'Check-out before 11 AM';
UPDATE public.listing_conditions SET translations = '{"ar": "مطلوب التحقق من الهوية", "fr": "Vérification d''identité requise", "es": "Se requiere verificación de identidad"}'::jsonb WHERE name = 'ID verification required';
UPDATE public.listing_conditions SET translations = '{"ar": "الحد الأقصى للإشغال", "fr": "Occupation maximale", "es": "Ocupación máxima"}'::jsonb WHERE name = 'Maximum occupancy';
UPDATE public.listing_conditions SET translations = '{"ar": "لا يسمح بضيوف غير مسجلين", "fr": "Pas d''invités non enregistrés", "es": "No se permiten huéspedes no registrados"}'::jsonb WHERE name = 'No unregistered guests';
UPDATE public.listing_conditions SET translations = '{"ar": "احترام الجيران", "fr": "Respecter les voisins", "es": "Respetar a los vecinos"}'::jsonb WHERE name = 'Respect neighbors';

-- 4. Populate Property Types
UPDATE public.property_types SET translations = '{"ar": "شقة", "fr": "Appartement", "es": "Apartamento"}'::jsonb WHERE name = 'Apartment';
UPDATE public.property_types SET translations = '{"ar": "منزل", "fr": "Maison", "es": "Casa"}'::jsonb WHERE name = 'House';
UPDATE public.property_types SET translations = '{"ar": "فيلا", "fr": "Villa", "es": "Villa"}'::jsonb WHERE name = 'Villa';
UPDATE public.property_types SET translations = '{"ar": "بيت ضيافة", "fr": "Maison d''hôtes", "es": "Casa de huéspedes"}'::jsonb WHERE name = 'Guest House';
UPDATE public.property_types SET translations = '{"ar": "فندق", "fr": "Hôtel", "es": "Hotel"}'::jsonb WHERE name = 'Hotel';
UPDATE public.property_types SET translations = '{"ar": "وحدة", "fr": "Unité", "es": "Unidad"}'::jsonb WHERE name = 'Unit';
UPDATE public.property_types SET translations = '{"ar": "تأجير يخوت", "fr": "Location de yacht", "es": "Alquiler de yates"}'::jsonb WHERE name = 'Yacht Rental';
UPDATE public.property_types SET translations = '{"ar": "تأجير سيارات", "fr": "Location de voiture", "es": "Alquiler de coches"}'::jsonb WHERE name = 'Car Rental';
UPDATE public.property_types SET translations = '{"ar": "مساحة فعاليات", "fr": "Espace événementiel", "es": "Espacio para eventos"}'::jsonb WHERE name = 'Event Space';
UPDATE public.property_types SET translations = '{"ar": "تجربة", "fr": "Expérience", "es": "Experiencia"}'::jsonb WHERE name = 'Experience';;
