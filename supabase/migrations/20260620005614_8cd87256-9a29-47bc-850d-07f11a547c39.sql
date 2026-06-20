
-- exercises
CREATE TABLE public.exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  type text NOT NULL CHECK (type IN ('translate','correct_sentence','fill_blank','free_write')),
  prompt_pt text NOT NULL,
  prompt_en text NOT NULL,
  content text,
  grammar_focus text NOT NULL,
  model_answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.exercises TO anon, authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_exercises" ON public.exercises FOR SELECT USING (true);

-- user_progress
CREATE TABLE public.user_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  level text NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  exercises_completed int DEFAULT 0,
  streak_days int DEFAULT 0,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_progress_select" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_progress_insert" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_progress_update" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

-- attempts
CREATE TABLE public.attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id),
  user_input text NOT NULL,
  correction jsonb,
  score int CHECK (score BETWEEN 0 AND 100),
  grammar_focus text,
  level text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_attempts_select" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_attempts_insert" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX attempts_user_id_created_at_idx ON public.attempts (user_id, created_at DESC);

-- Auto-create user_progress row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_progress (user_id, level)
  VALUES (NEW.id, 'beginner')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed exercises
INSERT INTO public.exercises (level, type, prompt_pt, prompt_en, content, grammar_focus, model_answer) VALUES
('beginner','translate','Traduza usando Present Perfect: "Trabalho em vendas há 25 anos."','Translate using Present Perfect.',NULL,'Present Perfect','I''ve worked in sales for 25 years.'),
('beginner','correct_sentence','Corrija o erro de compound adjective.','Find and fix the compound adjective error.','He is a 35 years old manager.','Compound Adjective','He is a 35-year-old manager.'),
('beginner','fill_blank','Complete com a forma correta do verbo (escreva a frase completa).','Fill in with the correct verb form (write the full sentence).','My colleague ___ (work) as a sales analyst.','Third Person Singular','My colleague works as a sales analyst.'),
('beginner','correct_sentence','Corrija a preposição incorreta sobre home office.','Fix the incorrect preposition about working remotely.','I work in home office every day.','Prepositions - Work Location','I work from home every day.'),
('beginner','translate','Traduza: "Minha colega é analista de vendas."','Translate this sentence.',NULL,'Articles + Profession','My colleague is a sales analyst.'),
('beginner','correct_sentence','Corrija o artigo ausente.','Fix the missing article.','She is manager of the team.','Articles','She is a manager of the team.'),
('beginner','correct_sentence','Corrija o erro na forma negativa do verbo.','Fix the error in the negative verb form.','He don''t like making cold calls.','Third Person Singular - Negation','He doesn''t like making cold calls.'),
('beginner','translate','Traduza usando Simple Past: "Eu trabalhei no banco por cinco anos."','Translate using Simple Past.',NULL,'Simple Past','I worked at the bank for five years.'),
('intermediate','translate','Traduza usando Present Perfect Continuous: "Estou estudando inglês há seis meses."','Translate using Present Perfect Continuous.',NULL,'Present Perfect Continuous','I''ve been studying English for six months.'),
('intermediate','fill_blank','Complete com a forma correta dos verbos (escreva a frase completa).','Fill in the blanks with the correct verb forms (write the full sentence).','If I ___ (practice) every day, my English ___ (improve) quickly.','First Conditional','If I practice every day, my English will improve quickly.'),
('intermediate','correct_sentence','Corrija o erro no modal verb.','Fix the modal verb error.','You must to send the report by Friday.','Modal Verbs','You must send the report by Friday.'),
('intermediate','translate','Traduza usando Second Conditional: "Se eu tivesse mais tempo, estudaria inglês todos os dias."','Translate using Second Conditional.',NULL,'Second Conditional','If I had more time, I would study English every day.'),
('intermediate','correct_sentence','Corrija o erro na voz passiva.','Fix the passive voice error.','The proposal was approved by of the director.','Passive Voice','The proposal was approved by the director.'),
('intermediate','fill_blank','Complete com o pronome relativo correto (who, which, that) e escreva a frase completa.','Fill in with the correct relative pronoun and write the full sentence.','The client ___ signed the contract yesterday is our biggest account.','Relative Clauses','The client who signed the contract yesterday is our biggest account.'),
('intermediate','correct_sentence','Corrija o erro no reported speech.','Fix the reported speech error.','She said she will send the proposal tomorrow.','Reported Speech','She said she would send the proposal the next day.'),
('intermediate','translate','Traduza usando Present Perfect com "since": "Não falo com ele desde segunda-feira."','Translate using Present Perfect with since.',NULL,'Present Perfect - Since vs For','I haven''t spoken to him since Monday.'),
('advanced','translate','Traduza usando Third Conditional: "Se eu tivesse me preparado melhor, teria conseguido a promoção."','Translate using Third Conditional.',NULL,'Third Conditional','If I had prepared better, I would have gotten the promotion.'),
('advanced','correct_sentence','Corrija a estrutura de inversão após "Not only".','Fix the inverted structure after Not only.','Not only he missed the deadline, but also he didn''t inform the team.','Inversion','Not only did he miss the deadline, but he also failed to inform the team.'),
('advanced','fill_blank','Complete com o phrasal verb correto (go through, call off, put off, set up) e escreva a frase completa.','Fill in with the correct phrasal verb (go through, call off, put off, set up) and write the full sentence.','After months of negotiation, the deal finally ___ ___.','Business Phrasal Verbs','After months of negotiation, the deal finally went through.'),
('advanced','translate','Traduza este mixed conditional: "Se eu tivesse estudado mais quando jovem, estaria em uma posição melhor hoje."','Translate this mixed conditional.',NULL,'Mixed Conditionals','If I had studied more when I was young, I would be in a better position now.'),
('advanced','correct_sentence','Corrija o erro no subjuntivo formal.','Fix the subjunctive mood error.','It is essential that every team member attends the weekly meeting.','Subjunctive Mood','It is essential that every team member attend the weekly meeting.'),
('advanced','correct_sentence','Corrija o erro na cleft sentence.','Fix the cleft sentence error.','It was the strategy what made the campaign successful.','Cleft Sentences','It was the strategy that made the campaign successful.');
