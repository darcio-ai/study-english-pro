CREATE TABLE public.user_skill_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  language text NOT NULL DEFAULT 'en',
  skill text NOT NULL,
  level text NOT NULL DEFAULT 'beginner',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, language, skill)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skill_levels TO authenticated;
GRANT ALL ON public.user_skill_levels TO service_role;

ALTER TABLE public.user_skill_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_skill_levels_all" ON public.user_skill_levels
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_skill_levels_updated_at
  BEFORE UPDATE ON public.user_skill_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();