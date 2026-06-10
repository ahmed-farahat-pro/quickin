-- 1. Convert private_feedback from TEXT to JSONB
ALTER TABLE public.reviews
  ALTER COLUMN private_feedback TYPE JSONB 
  USING (
    CASE 
      WHEN private_feedback IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'role', 'guest',
          'message', private_feedback,
          'created_at', now()
        )
      )
    END
  ),
  ALTER COLUMN private_feedback SET DEFAULT '[]'::jsonb;;
