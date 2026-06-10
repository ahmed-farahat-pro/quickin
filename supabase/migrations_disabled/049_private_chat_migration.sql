-- =============================================================================
-- Migration 049: Private Feedback to JSONB Chat
-- =============================================================================

-- 1. Convert private_feedback from TEXT to JSONB
-- We'll try to migrate existing text into the new format [ { "message": "...", ... } ]
-- If it's NULL, it remains NULL or becomes an empty array.
ALTER TABLE public.reviews
  ALTER COLUMN private_feedback TYPE JSONB 
  USING (
    CASE 
      WHEN private_feedback IS NULL THEN '[]'::jsonb
      ELSE json_build_array(
        json_build_object(
          'role', 'guest',
          'message', private_feedback,
          'created_at', now()
        )
      )::jsonb
    END
  ),
  ALTER COLUMN private_feedback SET DEFAULT '[]'::jsonb;
