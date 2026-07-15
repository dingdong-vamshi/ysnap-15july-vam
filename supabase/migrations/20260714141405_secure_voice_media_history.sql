-- Browser recordings are normally WebM/Opus; native Expo recordings are MP4/M4A.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic'
]
WHERE id = 'media';

-- Updates must enforce ownership both before and after the mutation.
DROP POLICY IF EXISTS sessions_update ON public.translation_sessions;
CREATE POLICY sessions_update
ON public.translation_sessions
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS items_update ON public.translation_items;
CREATE POLICY items_update
ON public.translation_items
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS voice_profiles_update ON public.voice_profiles;
CREATE POLICY voice_profiles_update
ON public.voice_profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
