-- Update property_types translations to include both name and description

UPDATE public.property_types
SET translations = '{"ar": {"name": "شقة", "description": "وحدة مستأجرة في مبنى متعدد الوحدات"}, "es": {"name": "Apartamento", "description": "Una unidad alquilada en un edificio de unidades múltiples"}, "fr": {"name": "Appartement", "description": "Une unité louée dans un immeuble à logements multiples"}}'::jsonb
WHERE name = 'Apartment';

UPDATE public.property_types
SET translations = '{"ar": {"name": "منزل", "description": "مبنى سكني مستقل"}, "es": {"name": "Casa", "description": "Un edificio residencial independiente"}, "fr": {"name": "Maison", "description": "Un bâtiment résidentiel indépendant"}}'::jsonb
WHERE name = 'House';

UPDATE public.property_types
SET translations = '{"ar": {"name": "بيت ضيافة", "description": "وحدة منفصلة في نفس العقار كمنزل رئيسي"}, "es": {"name": "Casa de huéspedes", "description": "Una unidad separada en la misma propiedad que la casa principal"}, "fr": {"name": "Maison d''hôtes", "description": "Une unité séparée sur la même propriété que la maison principale"}}'::jsonb
WHERE name = 'Guest House';

UPDATE public.property_types
SET translations = '{"ar": {"name": "فندق", "description": "غرفة في فندق أو فندق بوتيك"}, "es": {"name": "Hotel", "description": "Una habitación en un hotel o en un hotel boutique"}, "fr": {"name": "Hôtel", "description": "Une chambre dans un hôtel ou un hôtel-boutique"}}'::jsonb
WHERE name = 'Hotel';

UPDATE public.property_types
SET translations = '{"ar": {"name": "وحدة", "description": "وحدة إيجار عامة"}, "es": {"name": "Unidad", "description": "Una unidad de alquiler genérica"}, "fr": {"name": "Unité", "description": "Une unité de location générique"}}'::jsonb
WHERE name = 'Unit';

UPDATE public.property_types
SET translations = '{"ar": {"name": "تأجير يخوت", "description": "قارب أو يخت للتأجير"}, "es": {"name": "Alquiler de yates", "description": "Un barco o yate para alquilar"}, "fr": {"name": "Location de yacht", "description": "Un bateau ou un yacht à louer"}}'::jsonb
WHERE name = 'Yacht Rental';

UPDATE public.property_types
SET translations = '{"ar": {"name": "تأجير سيارات", "description": "مركبة للإيجار"}, "es": {"name": "Alquiler de coches", "description": "Un vehículo en alquiler"}, "fr": {"name": "Location de voiture", "description": "Un véhicule à louer"}}'::jsonb
WHERE name = 'Car Rental';

UPDATE public.property_types
SET translations = '{"ar": {"name": "مساحة فعاليات", "description": "مكان للحفلات أو الفعاليات"}, "es": {"name": "Espacio para eventos", "description": "Un lugar para fiestas o eventos"}, "fr": {"name": "Espace événementiel", "description": "Un lieu pour les fêtes ou les événements"}}'::jsonb
WHERE name = 'Event Space';

UPDATE public.property_types
SET translations = '{"ar": {"name": "تجربة", "description": "نشاط أو جولة إرشادية"}, "es": {"name": "Experiencia", "description": "Una actividad guiada o tour"}, "fr": {"name": "Expérience", "description": "Une activité guidée ou une visite"}}'::jsonb
WHERE name = 'Experience';

UPDATE public.property_types
SET translations = '{"ar": {"name": "فيلا", "description": "منزل عطلات فاخر، غالباً مع مسبح"}, "es": {"name": "Villa", "description": "Una lujosa casa de vacaciones, a menudo con piscina"}, "fr": {"name": "Villa", "description": "Une luxueuse maison de vacances, souvent avec piscine"}}'::jsonb
WHERE name = 'Villa';
