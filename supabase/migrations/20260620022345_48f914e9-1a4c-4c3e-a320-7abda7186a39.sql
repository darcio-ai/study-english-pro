DROP POLICY IF EXISTS "own_user_achievements_insert" ON public.user_achievements;

CREATE POLICY "no_user_progress_delete" ON public.user_progress AS RESTRICTIVE FOR DELETE USING (false);