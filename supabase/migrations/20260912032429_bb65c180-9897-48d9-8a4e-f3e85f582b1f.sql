CREATE TABLE public.programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  language text NOT NULL DEFAULT 'en',
  level text NOT NULL,
  title text NOT NULL,
  description_pt text NOT NULL,
  emoji text DEFAULT '🗓️',
  created_at timestamptz DEFAULT now(),
  UNIQUE (language, level)
);
GRANT SELECT ON public.programs TO anon;
GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_programs" ON public.programs FOR SELECT TO public USING (true);

CREATE TABLE public.program_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  day integer NOT NULL,
  theme text NOT NULL,
  objective_pt text NOT NULL,
  kind text NOT NULL DEFAULT 'lesson',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (program_id, day)
);
GRANT SELECT ON public.program_days TO anon;
GRANT SELECT ON public.program_days TO authenticated;
GRANT ALL ON public.program_days TO service_role;
ALTER TABLE public.program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_program_days" ON public.program_days FOR SELECT TO public USING (true);

CREATE TABLE public.user_program_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  current_day integer NOT NULL DEFAULT 1,
  completed_days integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_program_progress TO authenticated;
GRANT ALL ON public.user_program_progress TO service_role;
ALTER TABLE public.user_program_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_program_progress_all" ON public.user_program_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_program_progress_updated_at BEFORE UPDATE ON public.user_program_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();