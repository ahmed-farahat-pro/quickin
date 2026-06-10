-- Update listing_conditions translations to include both name and description

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "ممنوع التدخين", "description": "يُمنع التدخين في أي مكان في العقار"}, "es": {"name": "No fumar", "description": "No se permite fumar en ninguna parte de la propiedad"}, "fr": {"name": "Non-fumeur", "description": "Il est interdit de fumer partout dans la propriété"}}'::jsonb 
WHERE name = 'No smoking';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "ممنوع الحيوانات الأليفة", "description": "لا يسمح بالحيوانات الأليفة في العقار"}, "es": {"name": "No se admiten mascotas", "description": "No se admiten mascotas en la propiedad"}, "fr": {"name": "Pas d''animaux", "description": "Les animaux ne sont pas autorisés dans la propriété"}}'::jsonb 
WHERE name = 'No pets';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "ممنوع الحفلات أو الفعاليات", "description": "لا يسمح بإقامة الحفلات أو الفعاليات أو التجمعات الكبيرة"}, "es": {"name": "No se permiten fiestas ni eventos", "description": "No se permiten fiestas, eventos ni grandes reuniones"}, "fr": {"name": "Pas de fêtes ni d''événements", "description": "Les fêtes, événements et grands rassemblements ne sont pas autorisés"}}'::jsonb 
WHERE name = 'No parties or events';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "ساعات الهدوء", "description": "يجب على الضيوف التزام الهدوء (عادة من 10 مساءً إلى 8 صباحاً)"}, "es": {"name": "Horas de silencio", "description": "Los huéspedes deben respetar las horas de silencio (generalmente de 10 PM a 8 AM)"}, "fr": {"name": "Heures de calme", "description": "Les clients doivent respecter les heures de calme (généralement de 22h00 à 8h00)"}}'::jsonb 
WHERE name = 'Quiet hours';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "تسجيل الوصول بعد الساعة 2 مساءً", "description": "وقت تسجيل الوصول بعد الساعة 2:00 مساءً"}, "es": {"name": "Check-in después de las 2 PM", "description": "La hora de check-in es después de las 2:00 PM"}, "fr": {"name": "Arrivée après 14h00", "description": "L''heure d''arrivée est après 14h00"}}'::jsonb 
WHERE name = 'Check-in after 2 PM';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "تسجيل المغادرة قبل الساعة 11 صباحاً", "description": "وقت تسجيل المغادرة قبل الساعة 11:00 صباحاً"}, "es": {"name": "Check-out antes de las 11 AM", "description": "La hora de check-out es antes de las 11:00 AM"}, "fr": {"name": "Départ avant 11h00", "description": "L''heure de départ est avant 11h00"}}'::jsonb 
WHERE name = 'Check-out before 11 AM';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "مطلوب التحقق من الهوية", "description": "يجب على الضيوف تقديم هوية صالحة عند تسجيل الوصول"}, "es": {"name": "Se requiere verificación de identidad", "description": "Los huéspedes deben proporcionar una identificación válida al hacer el check-in"}, "fr": {"name": "Vérification d''identité requise", "description": "Les clients doivent fournir une pièce d''identité valide lors de l''enregistrement"}}'::jsonb 
WHERE name = 'ID verification required';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "الحد الأقصى للإشغال", "description": "يجب ألا يتجاوز عدد الضيوف السعة القصوى للإعلان"}, "es": {"name": "Ocupación máxima", "description": "El número de huéspedes no debe exceder la capacidad del anuncio"}, "fr": {"name": "Occupation maximale", "description": "Le nombre de personnes ne doit pas dépasser la capacité de l''annonce"}}'::jsonb 
WHERE name = 'Maximum occupancy';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "لا يسمح بضيوف غير مسجلين", "description": "يجب تسجيل جميع الضيوف المقيمين طوال الليل في الحجز"}, "es": {"name": "No se permiten huéspedes no registrados", "description": "Todos los huéspedes que pasen la noche deben estar registrados en la reserva"}, "fr": {"name": "Pas d''invités non enregistrés", "description": "Tous les clients passant la nuit doivent être enregistrés dans la réservation"}}'::jsonb 
WHERE name = 'No unregistered guests';

UPDATE public.listing_conditions 
SET translations = '{"ar": {"name": "احترام الجيران", "description": "يجب على الضيوف احترام الجيران والمجتمع المحيط"}, "es": {"name": "Respetar a los vecinos", "description": "Los huéspedes deben ser respetuosos con los vecinos y la comunidad circundante"}, "fr": {"name": "Respecter les voisins", "description": "Les clients doivent être respectueux des voisins et de la communauté environnante"}}'::jsonb 
WHERE name = 'Respect neighbors';;
