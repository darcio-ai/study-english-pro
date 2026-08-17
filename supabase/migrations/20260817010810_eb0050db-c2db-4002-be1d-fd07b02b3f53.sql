CREATE TABLE public.study_plan (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  minutes_per_day integer NOT NULL DEFAULT 15,
  daily_goal_exercises integer NOT NULL DEFAULT 5,
  reminder_time text NOT NULL DEFAULT '19:00',
  reminders_enabled boolean NOT NULL DEFAULT false,
  timezone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan TO authenticated;
GRANT ALL ON public.study_plan TO service_role;
ALTER TABLE public.study_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_study_plan_all ON public.study_plan FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_study_plan_updated_at BEFORE UPDATE ON public.study_plan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  scheduled_time text,
  skill text NOT NULL DEFAULT 'writing',
  duration_minutes integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'planned',
  completed_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_study_sessions_all ON public.study_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX study_sessions_user_date_idx ON public.study_sessions (user_id, scheduled_for);

CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();