ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- Cleanup the "ddddd" and Arabic-only titles to be English primarily, with Arabic in `translations`
UPDATE public.listings SET 
  title = 'Two Bedroom Chalet',
  description = 'Located on the second floor near the new and old aqua park, walkway, and main gate.',
  translations = '{"ar": {"title": "شاليه غرفتين وصالة مكيفين وحمام", "description": "دور ثاني جنب الاكوا الجديدة والقديمة والممشى والبوابة"}}'::jsonb
WHERE id = '43378b1c-c0a7-4e8d-8d58-36433fbde507';

UPDATE public.listings SET 
  title = 'Studio with One Bedroom',
  description = 'Fourth floor facing the aqua park and artificial waves.',
  translations = '{"ar": {"title": "استديو غرفه وصالة مكيفين وحمام", "description": "دور رابع امام الاكوا والامواج الصناعية"}}'::jsonb
WHERE id = '807cf21b-41c1-4d2c-86f4-5fc44b82bfb1';

UPDATE public.listings SET 
  title = 'Cozy Family Apartment',
  description = 'A spacious and comfortable apartment perfect for family vacations.',
  translations = '{"ar": {"title": "شقة عائلية مريحة", "description": "شقة واسعة ومريحة مثالية لقضاء العطلات العائلية."}}'::jsonb
WHERE id = '53bdbef2-b8f2-4cd1-8584-18f8aceeaa7d';

UPDATE public.listings SET 
  title = 'Banana Beach House',
  description = 'Enjoy a fun getaway at this unique beach house.',
  translations = '{"ar": {"title": "بيت شاطئ الموز", "description": "استمتع بعطلة ممتعة في بيت الشاطئ الفريد هذا."}}'::jsonb
WHERE id = '0c1a7694-487c-485c-9834-5a3087d298ba';

UPDATE public.listings SET 
  title = 'Resort With Sports Facilities',
  description = 'The village has many pools, free aqua park for kids, adult aqua park with tickets, artificial waves lake, kids games, animation, walkway with all restaurants and cafes, parties until morning, brand shops, and golf car service.',
  translations = '{"ar": {"title": "قرية سياحية بمرافق رياضية متكاملة", "description": "القريه بها بسينات كتير جدا واكوا بارك للأطفال مجانا اكوا للكبار بتكت وبحيرة بامواج صناعيه والعاب أطفال وانيميشن مشايه بها جميع المطاعم والكافتريات حفلات وسهر لحد الصبح محلات براندات جولف كار لخدمه النزلاء"}}'::jsonb
WHERE id = '53eb2f89-7e2a-4d6b-8a46-92fa7cb3f344';

-- Apply English & Arabic translations for the remaining valid English properties
UPDATE public.listings SET translations = '{"ar": {"title": "فيلا مذهلة مطلة على المحيط", "description": "اختبر أقصى درجات الفخامة على شاطئ البحر في هذه الفيلا المذهلة في ماليبو. استيقظ على مناظر بانورامية للمحيط ونم على صوت الأمواج. يتميز هذا المنزل المصمم بشكل جميل بنوافذ ممتدة من الأرض حتى السقف ومطبخ ذواقة وسطح خاص مثالي لاحتساء الكوكتيل عند غروب الشمس."}}'::jsonb WHERE id = '8c8e68c2-3c3a-42df-834f-b15289fbaeb4';
UPDATE public.listings SET translations = '{"ar": {"title": "شقة لوفت عصرية في وسط المدينة", "description": "حياة المدينة في أفضل حالاتها. تقع هذه الشقة اللوفت العصرية والأنيقة في قلب مانهاتن مع سهولة الوصول إلى المطاعم الفاخرة والتسوق والترفيه. توفر النوافذ الممتدة من الأرض إلى السقف إطلالات مذهلة على المدينة."}}'::jsonb WHERE id = 'c127e7b5-8a01-4ccb-a7ad-9a96be5746e4';
UPDATE public.listings SET translations = '{"ar": {"title": "مساحة فعاليات 707", "description": "حدث جيد يمكنك إقامته هنا"}}'::jsonb WHERE id = 'a96dabaa-0642-45a6-ae40-e1e56e332c2f';
UPDATE public.listings SET translations = '{"ar": {"title": "بنغل الجنة الاستوائية", "description": "ملاذك على الجزيرة في انتظارك في هذا البنغل الجميل المواجه للشاطئ. خطوات من الشواطئ الرملية البيضاء البكر مع مياه صافية وضوح الشمس. مثالي لقضاء عطلة رومانسية أو ملاذ هادئ."}}'::jsonb WHERE id = '66fef52c-d713-4285-a4f5-96818f89063c';
UPDATE public.listings SET translations = '{"ar": {"title": "شاليه 1", "description": "مكان رائع وجيد"}}'::jsonb WHERE id = '1d483f2c-3abd-4c4e-aeb5-7b9d3c1cef30';
UPDATE public.listings SET translations = '{"ar": {"title": "مكان اختبار 2", "description": "في مكان ما على الأرض."}}'::jsonb WHERE id = '43cdcb12-5b3a-4458-ad24-fba842cfa106';
UPDATE public.listings SET translations = '{"ar": {"title": "مزرعة توسكانية تاريخية", "description": "اختبر الحياة في الريف الإيطالي في هذه المزرعة المرممة بشكل جميل من القرن الثامن عشر. محاطة ببساتين الزيتون وكروم العنب مع مناظر خلابة لتلال توسكانا."}}'::jsonb WHERE id = '95039ae1-0f8f-4437-871c-c78f02891ee9';
UPDATE public.listings SET translations = '{"ar": {"title": "ملاذ على ضفاف البحيرة", "description": "هدوء بجوار البحيرة. توفر هذه الفيلا الأنيقة وصولاً مباشراً إلى البحيرة ورصيف قوارب خاص ومناظر جبلية خلابة عبر المياه. المزيج المثالي من الفخامة والجمال الطبيعي."}}'::jsonb WHERE id = '43d29ba5-e640-4bd5-98e7-45ee49add100';
UPDATE public.listings SET translations = '{"ar": {"title": "منزل واحة الصحراء", "description": "حياة صحراوية عصرية مع مناظر غروب مذهلة. يتميز هذا المنزل المعاصر بمسبح خاص وحوض استحمام ساخن وحياة داخلية وخارجية سلسة. اختبر سحر صحراء سونوران."}}'::jsonb WHERE id = '3443447b-89f8-402f-a698-026e77e0fbca';
UPDATE public.listings SET translations = '{"ar": {"title": "كوخ على شاطئ البحر", "description": "استيقظ على مناظر المحيط في هذا الكوخ الساحر على শاطئ البحر. مثالي لراكبي الأمواج ومحبي الشاطئ مع وصول مباشر إلى الشاطئ. استمتع بأسلوب الحياة الهادئ في خليج بايرون."}}'::jsonb WHERE id = 'f3af7ff9-9c04-409e-ad88-6fac4e433f33';
UPDATE public.listings SET translations = '{"ar": {"title": "كابينة جبلية مريحة", "description": "اهرب إلى هذا الملاذ الجبلي الساحر الذي يقع في قلب أسبن. استمتع بمناظر جبلية خلابة من السطح الملتف، واسترخ بجانب المدفأة، أو استكشف مسارات المشي لمسافات طويلة ومنحدرات التزلج القريبة."}}'::jsonb WHERE id = 'f3040cce-c337-4113-ba6b-b982103bc6b1';
UPDATE public.listings SET translations = '{"ar": {"title": "مكان اختبار", "description": "وصف لمكان الاختبار هذا"}}'::jsonb WHERE id = '97816cfa-d3b5-4b4e-bc45-66f19b304340';

-- Enforce EGP currency fallback just in case
UPDATE public.listings SET currency = 'EGP' WHERE currency IS NULL OR currency = '';;
