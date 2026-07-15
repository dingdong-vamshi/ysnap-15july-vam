-- Migration: Create Activity History and History Files Storage
-- Target Database: jstylllvekaqibooizbl (Development)

-- 1. Create handle_updated_at helper function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create activity_history table
CREATE TABLE IF NOT EXISTS public.activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  tool text NOT NULL,
  operation_type text NOT NULL,
  title text,
  source_language text,
  target_language text,
  source_text text,
  translated_text text,
  transcript jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds integer,
  input_asset_path text,
  output_asset_path text,
  thumbnail_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_history_tool_check CHECK (tool IN ('type', 'voice', 'camera', 'conversation', 'accent_changer', 'voice_clone')),
  CONSTRAINT activity_history_user_client_request_unique UNIQUE(user_id, client_request_id)
);

-- 3. Create updated_at trigger
DROP TRIGGER IF EXISTS trigger_activity_history_updated_at ON public.activity_history;
CREATE TRIGGER trigger_activity_history_updated_at
  BEFORE UPDATE ON public.activity_history
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Table RLS and Create Policies
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_history_select ON public.activity_history;
CREATE POLICY activity_history_select ON public.activity_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS activity_history_insert ON public.activity_history;
CREATE POLICY activity_history_insert ON public.activity_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS activity_history_update ON public.activity_history;
CREATE POLICY activity_history_update ON public.activity_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS activity_history_delete ON public.activity_history;
CREATE POLICY activity_history_delete ON public.activity_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Set up Storage Bucket: history-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'history-files',
  'history-files',
  false,
  52428800, -- 50MB
  ARRAY[
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
)
ON CONFLICT (id) DO NOTHING;

-- 6. Create Storage RLS Policies (explicitly scoped to history-files)
DROP POLICY IF EXISTS storage_history_files_insert ON storage.objects;
CREATE POLICY storage_history_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'history-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS storage_history_files_select ON storage.objects;
CREATE POLICY storage_history_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'history-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS storage_history_files_update ON storage.objects;
CREATE POLICY storage_history_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'history-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'history-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS storage_history_files_delete ON storage.objects;
CREATE POLICY storage_history_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'history-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 7. Indexes for optimized performance
CREATE INDEX IF NOT EXISTS activity_history_user_id_idx ON public.activity_history (user_id);
CREATE INDEX IF NOT EXISTS activity_history_tool_idx ON public.activity_history (tool);
CREATE INDEX IF NOT EXISTS activity_history_operation_type_idx ON public.activity_history (operation_type);
CREATE INDEX IF NOT EXISTS activity_history_created_at_desc_idx ON public.activity_history (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_history_composite_idx ON public.activity_history (user_id, tool, created_at DESC);

-- 8. Analytics RPC Function
CREATE OR REPLACE FUNCTION public.get_practice_analytics(range_days integer)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_start_date timestamptz;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF range_days IS NOT NULL AND range_days > 0 THEN
    v_start_date := now() - (range_days || ' days')::interval;
  ELSE
    v_start_date := '1970-01-01 00:00:00+00'::timestamptz;
  END IF;

  WITH user_history AS (
    SELECT * FROM public.activity_history
    WHERE user_id = v_user_id AND created_at >= v_start_date
  ),
  practice_time AS (
    SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds
    FROM user_history
    WHERE tool IN ('voice', 'conversation', 'accent_changer')
  ),
  active_days_count AS (
    SELECT COUNT(DISTINCT created_at::date) as active_days
    FROM user_history
  ),
  translations_cnt AS (
    SELECT COUNT(*) as cnt
    FROM user_history
    WHERE tool IN ('type', 'voice', 'camera')
  ),
  conversations_cnt AS (
    SELECT COUNT(*) as cnt
    FROM user_history
    WHERE tool = 'conversation'
  ),
  most_used_lang AS (
    SELECT target_language, COUNT(*) as cnt
    FROM user_history
    WHERE target_language IS NOT NULL AND target_language != ''
    GROUP BY target_language
    ORDER BY cnt DESC
    LIMIT 1
  ),
  most_used_tool_name AS (
    SELECT tool, COUNT(*) as cnt
    FROM user_history
    GROUP BY tool
    ORDER BY cnt DESC
    LIMIT 1
  ),
  tool_usage_agg AS (
    SELECT json_object_agg(tool, count) as val FROM (
      SELECT tool, COUNT(*) as count
      FROM user_history
      GROUP BY tool
    ) t
  ),
  daily_activity_agg AS (
    SELECT json_object_agg(day_num, count) as val FROM (
      SELECT EXTRACT(DOW FROM created_at)::integer as day_num, COUNT(*) as count
      FROM user_history
      GROUP BY day_num
    ) d
  ),
  practice_by_day_agg AS (
    SELECT json_object_agg(activity_date, mins) as val FROM (
      SELECT created_at::date::text as activity_date, ROUND(SUM(duration_seconds)::numeric / 60, 1) as mins
      FROM user_history
      WHERE tool IN ('voice', 'conversation', 'accent_changer')
      GROUP BY created_at::date
    ) p
  ),
  lang_usage_agg AS (
    SELECT json_object_agg(target_language, count) as val FROM (
      SELECT target_language, COUNT(*) as count
      FROM user_history
      WHERE target_language IS NOT NULL AND target_language != ''
      GROUP BY target_language
    ) l
  ),
  streak_calc AS (
    WITH dates AS (
      SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date as act_date
      FROM public.activity_history
      WHERE user_id = v_user_id
    ),
    streak_groups AS (
      SELECT act_date, act_date - (ROW_NUMBER() OVER (ORDER BY act_date DESC))::integer as grp
      FROM dates
    ),
    streak_durations AS (
      SELECT grp, COUNT(*) as duration, MAX(act_date) as max_date
      FROM streak_groups
      GROUP BY grp
    )
    SELECT COALESCE(MAX(duration), 0) as streak
    FROM streak_durations
    WHERE max_date >= CURRENT_DATE - 1
  )
  SELECT json_build_object(
    'total_practice_time_seconds', (SELECT total_seconds FROM practice_time),
    'translations_count', (SELECT cnt FROM translations_cnt),
    'conversations_count', (SELECT cnt FROM conversations_cnt),
    'active_days', (SELECT active_days FROM active_days_count),
    'streak_days', COALESCE((SELECT MAX(streak) FROM streak_calc), 0),
    'most_used_language', COALESCE((SELECT target_language FROM most_used_lang), 'None'),
    'most_used_tool', COALESCE((SELECT tool FROM most_used_tool_name), 'None'),
    'tool_usage', COALESCE((SELECT val FROM tool_usage_agg), '{}'::json),
    'weekly_activity', COALESCE((SELECT val FROM daily_activity_agg), '{}'::json),
    'practice_time_by_day', COALESCE((SELECT val FROM practice_by_day_agg), '{}'::json),
    'language_activity', COALESCE((SELECT val FROM lang_usage_agg), '{}'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
