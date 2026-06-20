-- Block direct INSERT on user_achievements (server function uses service role, bypasses RLS)
CREATE POLICY "no_direct_insert_user_achievements"
  ON public.user_achievements
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (false);

-- Block UPDATE on attempts
CREATE POLICY "no_update_attempts"
  ON public.attempts
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

-- Block DELETE on attempts
CREATE POLICY "no_delete_attempts"
  ON public.attempts
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (false);