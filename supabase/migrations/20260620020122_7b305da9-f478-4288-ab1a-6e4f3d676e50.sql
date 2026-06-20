
-- ============================================
-- 1. NEW SCHEMA TABLES
-- ============================================

-- Lessons: structured curriculum
CREATE TABLE public.lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  track text NOT NULL DEFAULT 'sales' CHECK (track IN ('sales','tech','general')),
  unit_number int NOT NULL,
  lesson_number int NOT NULL,
  title text NOT NULL,
  description_pt text NOT NULL,
  grammar_focus text NOT NULL,
  emoji text DEFAULT '📘',
  created_at timestamptz DEFAULT now(),
  UNIQUE(level, track, unit_number, lesson_number)
);
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_lessons" ON public.lessons FOR SELECT USING (true);

-- Add lesson_id and order to exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_order int,
  ADD COLUMN IF NOT EXISTS track text DEFAULT 'sales' CHECK (track IN ('sales','tech','general'));

CREATE INDEX IF NOT EXISTS idx_exercises_lesson ON public.exercises(lesson_id, lesson_order);
CREATE INDEX IF NOT EXISTS idx_exercises_track_level ON public.exercises(track, level, mode);

-- User lesson progress
CREATE TABLE public.user_lesson_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  exercises_done int NOT NULL DEFAULT 0,
  total_exercises int NOT NULL DEFAULT 0,
  avg_score int,
  completed_at timestamptz,
  started_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lesson_progress TO authenticated;
GRANT ALL ON public.user_lesson_progress TO service_role;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_lesson_progress_all" ON public.user_lesson_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Review queue (spaced repetition for errors)
CREATE TABLE public.review_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  last_score int NOT NULL,
  interval_days int NOT NULL DEFAULT 1,
  next_review_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  review_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_queue TO authenticated;
GRANT ALL ON public.review_queue TO service_role;
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_review_all" ON public.review_queue FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_review_due ON public.review_queue(user_id, next_review_at);

-- User vocabulary flashcards
CREATE TABLE public.user_vocabulary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word_en text NOT NULL,
  translation_pt text,
  context_sentence text,
  source_exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  interval_days int NOT NULL DEFAULT 1,
  next_review_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  review_count int NOT NULL DEFAULT 0,
  ease int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, word_en)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vocabulary TO authenticated;
GRANT ALL ON public.user_vocabulary TO service_role;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_vocab_all" ON public.user_vocabulary FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_vocab_due ON public.user_vocabulary(user_id, next_review_at);

-- Reading texts
CREATE TABLE public.reading_texts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  track text NOT NULL DEFAULT 'sales' CHECK (track IN ('sales','tech','general')),
  title text NOT NULL,
  body text NOT NULL,
  questions jsonb NOT NULL,
  key_vocabulary jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.reading_texts TO anon, authenticated;
GRANT ALL ON public.reading_texts TO service_role;
ALTER TABLE public.reading_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_reading" ON public.reading_texts FOR SELECT USING (true);

-- Achievements catalog
CREATE TABLE public.achievements (
  code text PRIMARY KEY,
  title text NOT NULL,
  description_pt text NOT NULL,
  emoji text NOT NULL,
  criteria jsonb NOT NULL,
  xp_reward int NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_achievements" ON public.achievements FOR SELECT USING (true);

-- User achievements
CREATE TABLE public.user_achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_code text REFERENCES public.achievements(code) ON DELETE CASCADE NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_code)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_achievements_select" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_user_achievements_insert" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add XP and preferred track to user_progress
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS xp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_track text DEFAULT 'sales' CHECK (preferred_track IN ('sales','tech','general'));

-- Add reading_text_id to attempts for reading mode tracking
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS reading_text_id uuid REFERENCES public.reading_texts(id) ON DELETE SET NULL;

-- ============================================
-- 2. WIPE OLD EXERCISES & SEED BUSINESS ENGLISH
-- ============================================

-- Clean old exercises (cascades to attempts? No — attempts.exercise_id has no CASCADE, just becomes orphan)
-- Keep attempts intact, just remove exercises
DELETE FROM public.exercises;

-- ============================================
-- 3. SEED LESSONS (Business English: Sales + Tech)
-- ============================================

-- BEGINNER SALES (Unit 1)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('beginner','sales',1,1,'Introducing Yourself in Sales','Apresente-se a um cliente: nome, empresa, função.','present simple / to be','👋'),
('beginner','sales',1,2,'Your Product & Company','Descreva o que sua empresa faz e o produto que você vende.','present simple / have','🏢'),
('beginner','sales',1,3,'Asking About the Customer','Perguntas básicas para entender necessidades.','question words','❓');

-- BEGINNER TECH (Unit 2)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('beginner','tech',2,1,'Standup Meetings','Frases essenciais para daily standups.','present continuous / past simple','🌅'),
('beginner','tech',2,2,'Reporting a Bug','Descrever problemas técnicos para o time.','past simple / passive voice','🐛'),
('beginner','tech',2,3,'Talking About Tools','Falar sobre stack, linguagens e ferramentas.','present simple / prepositions','💻');

-- INTERMEDIATE SALES (Unit 3)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('intermediate','sales',3,1,'Discovery Calls','Conduzir uma reunião de descoberta com cliente.','present perfect / question formation','🔍'),
('intermediate','sales',3,2,'Handling Objections','Responder a objeções comuns de preço e timing.','modal verbs / 1st conditional','🛡️'),
('intermediate','sales',3,3,'Following Up','Emails e mensagens de follow-up profissionais.','present perfect / linking words','📧');

-- INTERMEDIATE TECH (Unit 4)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('intermediate','tech',4,1,'Code Reviews','Dar e receber feedback em pull requests.','should / could / passive','👀'),
('intermediate','tech',4,2,'Technical Specifications','Escrever e discutir specs técnicas.','passive voice / reported speech','📋'),
('intermediate','tech',4,3,'Incident Response','Comunicar incidentes em produção.','past perfect / would have','🚨');

-- ADVANCED SALES (Unit 5)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('advanced','sales',5,1,'Negotiating Contracts','Vocabulário avançado de negociação.','3rd conditional / inversion','🤝'),
('advanced','sales',5,2,'Strategic Account Management','Conversas estratégicas com C-level.','complex modals / nominalisation','📊'),
('advanced','sales',5,3,'Pitching to Investors','Pitch deck e Q&A com investidores.','advanced phrasal verbs / hedging','🎯');

-- ADVANCED TECH (Unit 6)
INSERT INTO public.lessons (level, track, unit_number, lesson_number, title, description_pt, grammar_focus, emoji) VALUES
('advanced','tech',6,1,'System Architecture Discussions','Discutir trade-offs de arquitetura.','conditional perfect / formal register','🏗️'),
('advanced','tech',6,2,'Leading Engineering Teams','Comunicação como tech lead / staff engineer.','modal verbs of obligation / subjunctive','🧑‍💼'),
('advanced','tech',6,3,'Tech Conference Talks','Apresentar uma palestra técnica.','rhetorical devices / advanced collocations','🎤');

-- ============================================
-- 4. SEED EXERCISES (linked to lessons)
-- ============================================
-- Helper: use a temp CTE approach with lesson titles

-- B1 SALES Lesson 1 - Introducing Yourself
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, expected_response, lesson_id, lesson_order)
SELECT 'beginner','sales','translate','writing','Traduza: "Meu nome é Carlos. Sou gerente de vendas da Acme."','Translate to English.',NULL,'present simple / to be','My name is Carlos. I am a sales manager at Acme.',NULL,NULL,id,1 FROM public.lessons WHERE title='Introducing Yourself in Sales';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','sales','dictation','listening','Ouça e escreva a apresentação.','Listen and write what you hear.',NULL,'present simple / to be','My name is Carlos. I am a sales manager at Acme.','Hi, I am Sarah and I work in the sales team.',id,2 FROM public.lessons WHERE title='Introducing Yourself in Sales';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','pronunciation','speaking_read','Leia em voz alta como se fosse uma apresentação real.','Read aloud as if introducing yourself.','Nice to meet you. I am the account manager for your region.','professional greetings','Nice to meet you. I am the account manager for your region.',id,3 FROM public.lessons WHERE title='Introducing Yourself in Sales';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','sales','conversation','speaking_free','Se apresente para um novo cliente. Diga seu nome, empresa e função.','Introduce yourself to a new client. Say your name, company, and role.',NULL,'self-introduction','Hello, my name is Ana. I work at TechCorp as a sales representative. Nice to meet you.','My name is ___. I work at ___ as a ___.',id,4 FROM public.lessons WHERE title='Introducing Yourself in Sales';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','correct_sentence','writing','Corrija a apresentação.','Fix the introduction.','I am work at Acme since five years.','present simple vs present perfect','I have worked at Acme for five years.',id,5 FROM public.lessons WHERE title='Introducing Yourself in Sales';

-- B1 SALES Lesson 2 - Product & Company
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','translate','writing','Traduza: "Nossa empresa vende software de CRM para pequenas empresas."','Translate.',NULL,'present simple','Our company sells CRM software for small businesses.',id,1 FROM public.lessons WHERE title='Your Product & Company';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','sales','dictation','listening','Ouça a descrição do produto.','Listen and write.',NULL,'product description','We offer a platform that helps teams close more deals.','We offer a platform that helps teams close more deals.',id,2 FROM public.lessons WHERE title='Your Product & Company';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','pronunciation','speaking_read','Leia o pitch curto.','Read this short pitch.','Our product saves your team five hours every week.','elevator pitch','Our product saves your team five hours every week.',id,3 FROM public.lessons WHERE title='Your Product & Company';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','sales','conversation','speaking_free','Descreva o que sua empresa faz em 2-3 frases.','Describe what your company does in 2-3 sentences.',NULL,'company description','My company builds AI tools for sales teams. We help reps automate follow-ups and close deals faster.','My company ___. We help ___ by ___.',id,4 FROM public.lessons WHERE title='Your Product & Company';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','fill_blank','writing','Complete: "Our solution ___ (help) clients ___ (save) time."','Fill in the blanks.','Our solution ___ (help) clients ___ (save) time.','present simple / infinitive','Our solution helps clients save time.',id,5 FROM public.lessons WHERE title='Your Product & Company';

-- B1 SALES Lesson 3 - Asking About Customer
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','translate','writing','Traduza: "Qual é o maior desafio da sua equipe hoje?"','Translate.',NULL,'question words','What is the biggest challenge for your team today?',id,1 FROM public.lessons WHERE title='Asking About the Customer';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','sales','dictation','listening','Ouça a pergunta de descoberta.','Listen and write.',NULL,'discovery question','How many people work in your sales department?','How many people work in your sales department?',id,2 FROM public.lessons WHERE title='Asking About the Customer';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','sales','pronunciation','speaking_read','Leia esta pergunta com entonação curiosa.','Read with rising intonation.','Could you tell me a little more about your current process?','polite questions','Could you tell me a little more about your current process?',id,3 FROM public.lessons WHERE title='Asking About the Customer';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','sales','conversation','speaking_free','Faça 3 perguntas para conhecer um cliente novo.','Ask 3 questions to get to know a new client.',NULL,'discovery questions','What does your company do? How big is your team? What problem are you trying to solve?','What ___? How ___? When ___?',id,4 FROM public.lessons WHERE title='Asking About the Customer';

-- B1 TECH Lesson 1 - Standup
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','translate','writing','Traduza: "Ontem terminei a feature de login."','Translate.',NULL,'past simple','Yesterday I finished the login feature.',id,1 FROM public.lessons WHERE title='Standup Meetings';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','tech','dictation','listening','Ouça o update de standup.','Listen to the standup update.',NULL,'standup','Today I am working on the API integration.','Today I am working on the API integration.',id,2 FROM public.lessons WHERE title='Standup Meetings';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','pronunciation','speaking_read','Leia este update.','Read aloud.','I am currently blocked on the database migration. I need help from the DBA team.','blockers','I am currently blocked on the database migration. I need help from the DBA team.',id,3 FROM public.lessons WHERE title='Standup Meetings';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','tech','conversation','speaking_free','Faça seu standup: o que fez ontem, o que vai fazer hoje, blockers.','Give your standup update.',NULL,'standup format','Yesterday I fixed the login bug. Today I am going to work on the new dashboard. No blockers.','Yesterday I ___. Today I ___. ___ blockers.',id,4 FROM public.lessons WHERE title='Standup Meetings';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','correct_sentence','writing','Corrija a frase do standup.','Fix the standup sentence.','Yesterday I am working on the bug fix.','past simple vs present continuous','Yesterday I worked on the bug fix.',id,5 FROM public.lessons WHERE title='Standup Meetings';

-- B1 TECH Lesson 2 - Bug Report
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','translate','writing','Traduza: "O botão não funciona quando eu clico nele."','Translate.',NULL,'present simple / negation','The button does not work when I click on it.',id,1 FROM public.lessons WHERE title='Reporting a Bug';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','tech','dictation','listening','Ouça o report de bug.','Listen to the bug report.',NULL,'bug report','The app crashes every time I open the settings page.','The app crashes every time I open the settings page.',id,2 FROM public.lessons WHERE title='Reporting a Bug';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','pronunciation','speaking_read','Leia este report.','Read aloud.','Steps to reproduce: open the form, fill in the email, click submit. The error appears.','reproduction steps','Steps to reproduce: open the form, fill in the email, click submit. The error appears.',id,3 FROM public.lessons WHERE title='Reporting a Bug';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','tech','conversation','speaking_free','Reporte um bug: o que esperava, o que aconteceu, como reproduzir.','Report a bug verbally.',NULL,'bug reporting','I expected the form to submit, but I got a 500 error. To reproduce, just fill in any name and click save.','I expected ___, but ___. To reproduce ___.',id,4 FROM public.lessons WHERE title='Reporting a Bug';

-- B1 TECH Lesson 3 - Tools
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'beginner','tech','translate','writing','Traduza: "Eu trabalho com React no front-end e Python no back-end."','Translate.',NULL,'present simple / prepositions','I work with React on the front-end and Python on the back-end.',id,1 FROM public.lessons WHERE title='Talking About Tools';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'beginner','tech','dictation','listening','Ouça sobre a stack.','Listen about the stack.',NULL,'tech stack','Our backend runs on Node.js and we use PostgreSQL as our database.','Our backend runs on Node.js and we use PostgreSQL as our database.',id,2 FROM public.lessons WHERE title='Talking About Tools';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'beginner','tech','conversation','speaking_free','Descreva sua stack atual.','Describe your current tech stack.',NULL,'tech vocabulary','I mostly work with TypeScript and React. For the backend we use Node.js with Express, and we deploy on AWS.','I work with ___. We use ___ for ___. We deploy on ___.',id,3 FROM public.lessons WHERE title='Talking About Tools';

-- INTERMEDIATE SALES Lesson 1 - Discovery
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','translate','writing','Traduza: "Há quanto tempo vocês têm enfrentado esse problema?"','Translate.',NULL,'present perfect continuous','How long have you been facing this problem?',id,1 FROM public.lessons WHERE title='Discovery Calls';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'intermediate','sales','dictation','listening','Ouça a pergunta de discovery.','Listen.',NULL,'discovery','What does success look like for you in the next six months?','What does success look like for you in the next six months?',id,2 FROM public.lessons WHERE title='Discovery Calls';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','pronunciation','speaking_read','Leia a pergunta com tom consultivo.','Read with consultative tone.','Walk me through how your team currently handles inbound leads.','consultative selling','Walk me through how your team currently handles inbound leads.',id,3 FROM public.lessons WHERE title='Discovery Calls';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','sales','conversation','speaking_free','Faça uma pergunta SPIN sobre as implicações do problema do cliente.','Ask a SPIN implication question.',NULL,'SPIN selling','If your team continues losing leads at this rate, what impact would that have on your quarterly targets?','If ___ continues, what impact ___ on ___?',id,4 FROM public.lessons WHERE title='Discovery Calls';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','correct_sentence','writing','Corrija a pergunta.','Fix the question.','Since when you are using this tool?','question word order','Since when have you been using this tool?',id,5 FROM public.lessons WHERE title='Discovery Calls';

-- INTERMEDIATE SALES Lesson 2 - Objections
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','translate','writing','Traduza: "Eu entendo sua preocupação com o preço. Posso explicar o ROI?"','Translate.',NULL,'modal verbs / polite phrasing','I understand your concern about the price. Can I explain the ROI?',id,1 FROM public.lessons WHERE title='Handling Objections';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','pronunciation','speaking_read','Leia esta resposta a uma objeção.','Read this objection response.','That is a fair point. If we could include onboarding at no extra cost, would that work for you?','objection handling','That is a fair point. If we could include onboarding at no extra cost, would that work for you?',id,2 FROM public.lessons WHERE title='Handling Objections';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','sales','conversation','speaking_free','Cliente diz: "Está muito caro." Responda usando feel-felt-found.','Client says it is too expensive. Respond using feel-felt-found.',NULL,'feel-felt-found','I understand how you feel. Many of our clients felt the same way initially, but they found that the platform paid for itself in 4 months.','I understand how you feel. Others felt ___, but they found ___.',id,3 FROM public.lessons WHERE title='Handling Objections';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'intermediate','sales','dictation','listening','Ouça a objeção do cliente.','Listen to the client objection.',NULL,'objection','We are not really sure this is the right time for us to invest.','We are not really sure this is the right time for us to invest.',id,4 FROM public.lessons WHERE title='Handling Objections';

-- INTERMEDIATE SALES Lesson 3 - Follow Up
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','translate','writing','Traduza: "Conforme combinado em nossa última reunião, segue a proposta."','Translate this email opener.',NULL,'past participle / formal','As discussed in our last meeting, please find the proposal attached.',id,1 FROM public.lessons WHERE title='Following Up';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','sales','pronunciation','speaking_read','Leia este follow-up de voicemail.','Read this voicemail follow-up.','Hi John, just circling back on the proposal I sent last Tuesday. Let me know your thoughts when you get a chance.','professional voicemail','Hi John, just circling back on the proposal I sent last Tuesday. Let me know your thoughts when you get a chance.',id,2 FROM public.lessons WHERE title='Following Up';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','sales','conversation','speaking_free','Deixe um voicemail de follow-up educado mas com senso de urgência.','Leave a polite follow-up voicemail with light urgency.',NULL,'follow-up','Hi Sarah, this is Ana from TechCorp. I am following up on the contract review. We have a slot opening next Tuesday — would love to lock it in. Talk soon.','Hi ___, I am following up on ___. We have ___ — let me know if ___.',id,3 FROM public.lessons WHERE title='Following Up';

-- INTERMEDIATE TECH Lesson 1 - Code Reviews
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','tech','translate','writing','Traduza: "Talvez fosse melhor extrair essa lógica para um helper."','Translate.',NULL,'modal verbs / hedging','It might be better to extract this logic into a helper.',id,1 FROM public.lessons WHERE title='Code Reviews';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','tech','pronunciation','speaking_read','Leia este comentário de PR.','Read this PR comment.','This looks good overall. One nit: could we add a test case for the empty array scenario?','PR feedback','This looks good overall. One nit: could we add a test case for the empty array scenario?',id,2 FROM public.lessons WHERE title='Code Reviews';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','tech','conversation','speaking_free','Dê um feedback construtivo sobre um PR com problema de performance.','Give constructive feedback on a PR with a performance issue.',NULL,'PR feedback','Nice work overall. One concern: the nested loop could become slow with larger datasets. What do you think about using a map for the lookup?','Nice work. One concern: ___. What about ___?',id,3 FROM public.lessons WHERE title='Code Reviews';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'intermediate','tech','dictation','listening','Ouça o feedback do review.','Listen.',NULL,'code review','I would suggest renaming this variable to something more descriptive.','I would suggest renaming this variable to something more descriptive.',id,4 FROM public.lessons WHERE title='Code Reviews';

-- INTERMEDIATE TECH Lesson 2 - Specs
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','tech','translate','writing','Traduza: "A feature deve suportar até 10 mil usuários simultâneos."','Translate.',NULL,'modal verbs / passive','The feature must support up to 10,000 concurrent users.',id,1 FROM public.lessons WHERE title='Technical Specifications';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','tech','pronunciation','speaking_read','Leia esta spec.','Read this spec.','The API endpoint should return a paginated response with a maximum of 100 items per page.','API specs','The API endpoint should return a paginated response with a maximum of 100 items per page.',id,2 FROM public.lessons WHERE title='Technical Specifications';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','tech','conversation','speaking_free','Explique os requisitos não-funcionais de uma nova feature.','Explain the non-functional requirements of a new feature.',NULL,'NFR vocabulary','The system must handle at least 5,000 requests per second with a P95 latency under 200 milliseconds. It also needs to be horizontally scalable.','The system must handle ___. It also needs ___.',id,3 FROM public.lessons WHERE title='Technical Specifications';

-- INTERMEDIATE TECH Lesson 3 - Incidents
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'intermediate','tech','translate','writing','Traduza: "O banco de dados ficou indisponível por 15 minutos."','Translate.',NULL,'past simple / passive','The database was unavailable for 15 minutes.',id,1 FROM public.lessons WHERE title='Incident Response';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, audio_script, lesson_id, lesson_order)
SELECT 'intermediate','tech','dictation','listening','Ouça o update do incidente.','Listen.',NULL,'incident update','We have identified the root cause and a fix is being deployed now.','We have identified the root cause and a fix is being deployed now.',id,2 FROM public.lessons WHERE title='Incident Response';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'intermediate','tech','conversation','speaking_free','Comunique um incidente em produção: o que aconteceu, impacto, próximos passos.','Communicate a production incident.',NULL,'incident comms','At 2:15 PM we experienced a database outage affecting checkout. About 30% of users were impacted. We have restored service and are investigating the root cause.','At ___ we experienced ___. Impact: ___. We have ___ and are ___.',id,3 FROM public.lessons WHERE title='Incident Response';

-- ADVANCED SALES Lesson 1 - Negotiation
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','sales','translate','writing','Traduza: "Se tivéssemos fechado naquele momento, teríamos garantido o desconto."','Translate using 3rd conditional.',NULL,'3rd conditional','If we had closed at that point, we would have secured the discount.',id,1 FROM public.lessons WHERE title='Negotiating Contracts';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','sales','pronunciation','speaking_read','Leia esta proposta de barganha.','Read this counter-offer.','We could potentially absorb the implementation fee, provided you commit to a three-year term.','negotiation','We could potentially absorb the implementation fee, provided you commit to a three-year term.',id,2 FROM public.lessons WHERE title='Negotiating Contracts';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','sales','conversation','speaking_free','Proponha um trade-off em uma negociação travada por preço.','Propose a trade-off in a price-stuck negotiation.',NULL,'concessions','I hear you on the budget constraint. What if we phased the rollout — starting with a smaller seat count this quarter and expanding next quarter when your renewal hits?','I hear you on ___. What if we ___ in exchange for ___?',id,3 FROM public.lessons WHERE title='Negotiating Contracts';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','sales','correct_sentence','writing','Corrija a inversão.','Fix the inversion.','Not only we offer the lowest price, but also the best support.','inversion','Not only do we offer the lowest price, but we also offer the best support.',id,4 FROM public.lessons WHERE title='Negotiating Contracts';

-- ADVANCED SALES Lesson 2 - Strategic Account
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','sales','translate','writing','Traduza: "Gostaria de discutir como podemos alinhar nossa parceria com sua estratégia de transformação digital."','Translate.',NULL,'formal register','I would like to discuss how we can align our partnership with your digital transformation strategy.',id,1 FROM public.lessons WHERE title='Strategic Account Management';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','sales','conversation','speaking_free','Apresente um QBR (Quarterly Business Review) para um CFO.','Pitch a QBR summary to a CFO.',NULL,'executive comms','Over the last quarter, your team realized a 23% lift in conversion attributable to our platform, translating to roughly $1.4M in incremental revenue. Looking ahead, the proposed expansion would deliver a 4x ROI in year one.','Over the last quarter ___. Looking ahead, ___ would deliver ___.',id,2 FROM public.lessons WHERE title='Strategic Account Management';

-- ADVANCED SALES Lesson 3 - Pitching Investors
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','sales','pronunciation','speaking_read','Leia esta abertura de pitch.','Read this pitch opener.','We are tackling a 12-billion-dollar problem that incumbent solutions have failed to address for over a decade.','investor pitch','We are tackling a 12-billion-dollar problem that incumbent solutions have failed to address for over a decade.',id,1 FROM public.lessons WHERE title='Pitching to Investors';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','sales','conversation','speaking_free','Responda a um investidor cético sobre seu TAM.','Respond to an investor skeptical about your TAM.',NULL,'investor Q&A','That is a fair challenge. While our bottoms-up TAM is conservative at $8B, the adjacent markets we plan to enter in years 3-5 expand the addressable opportunity to roughly $24B.','That is a fair challenge. While ___, the ___ expand the opportunity to ___.',id,2 FROM public.lessons WHERE title='Pitching to Investors';

-- ADVANCED TECH Lesson 1 - Architecture
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','tech','translate','writing','Traduza: "Optar por microsserviços teria introduzido uma complexidade operacional desnecessária."','Translate.',NULL,'conditional perfect','Opting for microservices would have introduced unnecessary operational complexity.',id,1 FROM public.lessons WHERE title='System Architecture Discussions';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','tech','pronunciation','speaking_read','Leia esta análise de trade-off.','Read this trade-off analysis.','The eventual consistency model offers better availability, but at the cost of more complex client-side reconciliation logic.','architecture','The eventual consistency model offers better availability, but at the cost of more complex client-side reconciliation logic.',id,2 FROM public.lessons WHERE title='System Architecture Discussions';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','tech','conversation','speaking_free','Defenda sua escolha de arquitetura monolítica contra a sugestão de microsserviços.','Defend monolith choice against microservices suggestion.',NULL,'technical argumentation','I appreciate the suggestion, but given our team size and current scale, a modular monolith strikes the right balance. We retain deployment simplicity while keeping clear bounded contexts that we can extract later if needed.','I appreciate the suggestion, but given ___, ___. We retain ___ while keeping ___.',id,3 FROM public.lessons WHERE title='System Architecture Discussions';

-- ADVANCED TECH Lesson 2 - Leading Teams
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','tech','translate','writing','Traduza: "É essencial que cada engenheiro seja dono da qualidade do seu próprio código."','Translate using subjunctive.',NULL,'subjunctive','It is essential that every engineer own the quality of their own code.',id,1 FROM public.lessons WHERE title='Leading Engineering Teams';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','tech','conversation','speaking_free','Dê feedback difícil a um engenheiro sênior que está bloqueando o time.','Give tough feedback to a senior engineer blocking the team.',NULL,'difficult conversations','I want to be transparent with you. The team has flagged that decisions on your projects have been taking longer than expected, which is creating downstream blockers. How can we work together to unblock the flow?','I want to be transparent. The team has flagged ___. How can we ___?',id,2 FROM public.lessons WHERE title='Leading Engineering Teams';

-- ADVANCED TECH Lesson 3 - Conference Talks
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, lesson_id, lesson_order)
SELECT 'advanced','tech','pronunciation','speaking_read','Leia esta abertura de palestra.','Read this talk opener.','How many of you have ever spent an entire weekend chasing a bug that turned out to be a single missing semicolon? Yeah, me too.','rhetorical opening','How many of you have ever spent an entire weekend chasing a bug that turned out to be a single missing semicolon? Yeah, me too.',id,1 FROM public.lessons WHERE title='Tech Conference Talks';
INSERT INTO public.exercises (level, track, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer, expected_response, lesson_id, lesson_order)
SELECT 'advanced','tech','conversation','speaking_free','Responda a uma pergunta hostil na Q&A após sua palestra.','Respond to a hostile Q&A question after your talk.',NULL,'Q&A handling','That is a great question, and honestly something we debated internally. The short answer is: we benchmarked both approaches and the data showed a 40% improvement with the approach I presented. Happy to share the methodology offline.','That is a great question. The short answer is ___. Happy to ___ offline.',id,2 FROM public.lessons WHERE title='Tech Conference Talks';

-- ============================================
-- 5. SEED READING TEXTS (Business English)
-- ============================================

INSERT INTO public.reading_texts (level, track, title, body, questions, key_vocabulary) VALUES
('beginner','sales','First Day in Sales',
'Maria started her new job at TechCorp last Monday. She is a junior sales representative. Her job is to call new customers and explain the product. On her first day, she met her manager, Carlos. Carlos showed her the CRM system and gave her a list of 20 leads to contact. Maria was nervous but excited. By Friday, she had already booked three meetings for the next week.',
'[
  {"q": "What is Maria''s job?", "options": ["Manager", "Junior sales representative", "Engineer"], "answer": 1, "explanation_pt": "O texto diz claramente: \"She is a junior sales representative\"."},
  {"q": "Who is Carlos?", "options": ["A customer", "Her manager", "Another rep"], "answer": 1, "explanation_pt": "O texto menciona \"her manager, Carlos\"."},
  {"q": "How many meetings did she book by Friday?", "options": ["20", "Two", "Three"], "answer": 2, "explanation_pt": "\"she had already booked three meetings\"."}
]'::jsonb,
'[{"word":"lead","pt":"potencial cliente"},{"word":"book a meeting","pt":"agendar uma reunião"},{"word":"CRM","pt":"sistema de gestão de clientes"}]'::jsonb),

('beginner','tech','Joining a New Engineering Team',
'James joined the platform team at StartupX two weeks ago. As a backend engineer, his first task was to fix a small bug in the authentication service. His onboarding buddy, Priya, helped him set up the development environment and explained the codebase. The standup happens every day at 10 AM. James was surprised by how friendly everyone was. After his first pull request was merged, the team celebrated with virtual high-fives in Slack.',
'[
  {"q": "What is James''s role?", "options": ["Frontend engineer", "Backend engineer", "Product manager"], "answer": 1, "explanation_pt": "\"As a backend engineer\" indica claramente."},
  {"q": "Who helped him onboard?", "options": ["His manager", "Priya, his onboarding buddy", "The CEO"], "answer": 1, "explanation_pt": "\"His onboarding buddy, Priya\"."},
  {"q": "When does the standup happen?", "options": ["Every day at 10 AM", "Once a week", "Only on Mondays"], "answer": 0, "explanation_pt": "\"The standup happens every day at 10 AM\"."}
]'::jsonb,
'[{"word":"onboarding","pt":"integração de novo funcionário"},{"word":"pull request","pt":"solicitação de merge de código"},{"word":"merge","pt":"integrar código"}]'::jsonb),

('intermediate','sales','Closing the Quarter',
'It was the last week of Q3, and the sales team was scrambling. Sophie, the regional director, had committed to a number that now seemed out of reach. Three deals were stuck in legal review, and one major prospect had gone silent for ten days. Rather than panicking, Sophie called an emergency meeting. The team divided responsibilities: she would personally reach out to the silent prospect, while two reps focused on expediting the contracts. By Thursday afternoon, two contracts were signed and the prospect had agreed to a final call. They closed the quarter at 98% of target — short, but respectable.',
'[
  {"q": "Why was Sophie under pressure?", "options": ["She was new", "End of quarter and targets at risk", "She was being laid off"], "answer": 1, "explanation_pt": "\"last week of Q3\" + \"committed to a number that now seemed out of reach\"."},
  {"q": "What strategy did Sophie use?", "options": ["Hired more reps", "Divided responsibilities and led by example", "Lowered the target"], "answer": 1, "explanation_pt": "\"The team divided responsibilities: she would personally reach out\"."},
  {"q": "What does ''expediting the contracts'' mean?", "options": ["Cancelling them", "Speeding them up", "Translating them"], "answer": 1, "explanation_pt": "''Expedite'' significa acelerar um processo."}
]'::jsonb,
'[{"word":"prospect","pt":"prospect, cliente em potencial"},{"word":"expedite","pt":"acelerar"},{"word":"to close the quarter","pt":"fechar o trimestre"}]'::jsonb),

('intermediate','tech','Postmortem',
'Last Tuesday at 3:42 PM, the checkout service went down for 47 minutes. The incident was triggered by a routine deployment that contained a subtle race condition in the new payment retry logic. Under load, the service exhausted its database connection pool and started returning 500 errors. The on-call engineer was paged within 90 seconds and rolled back the deployment, restoring service. Approximately 12,000 customers were affected, and we estimate $230,000 in lost revenue. Going forward, we are implementing load tests in the deployment pipeline and adding connection pool monitoring with proactive alerts.',
'[
  {"q": "What caused the outage?", "options": ["Hardware failure", "A race condition in new code", "DDoS attack"], "answer": 1, "explanation_pt": "\"a subtle race condition in the new payment retry logic\"."},
  {"q": "How long did the on-call take to respond?", "options": ["47 minutes", "Within 90 seconds", "12 hours"], "answer": 1, "explanation_pt": "\"was paged within 90 seconds\"."},
  {"q": "What is the preventive action?", "options": ["Hiring more on-call engineers", "Load tests + pool monitoring", "Removing the payment retry feature"], "answer": 1, "explanation_pt": "\"implementing load tests in the deployment pipeline and adding connection pool monitoring\"."}
]'::jsonb,
'[{"word":"race condition","pt":"condição de corrida"},{"word":"rollback","pt":"reverter"},{"word":"on-call","pt":"plantão"},{"word":"postmortem","pt":"análise pós-incidente"}]'::jsonb),

('advanced','sales','Navigating a Complex Enterprise Deal',
'When our team first engaged with Globex, the deal looked straightforward: a 200-seat expansion of an existing contract. Six months and four stakeholders later, the picture had changed dramatically. The CFO had been replaced, procurement had instituted a new vendor consolidation policy, and a competing vendor had quietly secured a foothold in the IT department. Rather than retreating, we leaned in. We orchestrated a multi-threaded campaign: our CTO briefed their new CFO on long-term cost projections, our customer success team produced a granular ROI report from the existing deployment, and we proactively addressed the competing vendor by demonstrating integration capabilities they could not match. The contract closed in Q4 — not as a 200-seat expansion, but as a strategic 600-seat partnership with multi-year terms.',
'[
  {"q": "What was the original deal size?", "options": ["600 seats", "200 seats", "Multi-year only"], "answer": 1, "explanation_pt": "\"a 200-seat expansion of an existing contract\"."},
  {"q": "What does ''multi-threaded campaign'' mean here?", "options": ["Using AI agents", "Engaging multiple stakeholders simultaneously", "Sending many emails"], "answer": 1, "explanation_pt": "Refere-se a engajar vários stakeholders ao mesmo tempo (CTO, customer success, etc)."},
  {"q": "Why did the deal ultimately grow?", "options": ["Discount applied", "Strategic value demonstrated across multiple stakeholders", "Competition disappeared"], "answer": 1, "explanation_pt": "A estratégia multi-threaded provou valor estratégico, transformando uma expansão em parceria de 600 lugares."}
]'::jsonb,
'[{"word":"stakeholder","pt":"parte interessada"},{"word":"multi-threaded","pt":"em múltiplas frentes"},{"word":"procurement","pt":"compras / suprimentos"},{"word":"to lean in","pt":"se aprofundar / abraçar o desafio"}]'::jsonb),

('advanced','tech','RFC: Migration to Event-Driven Architecture',
'This RFC proposes migrating our order-processing pipeline from a synchronous request-response model to an event-driven architecture using Apache Kafka as the message backbone. The current monolithic flow has reached its scaling ceiling: end-to-end latency under peak load exceeds our P99 SLO of 800ms, and coupling between services has made independent deployments increasingly difficult. The proposed architecture decomposes the pipeline into discrete services communicating via durable event streams, with each consumer maintaining its own materialized view of the data it needs. Trade-offs include increased operational complexity around schema evolution and exactly-once delivery semantics. Mitigations include adopting the schema registry pattern and leveraging Kafka''s idempotent producer guarantees. We estimate a 14-week migration with parallel running for the final four weeks to ensure rollback capability.',
'[
  {"q": "What is the current bottleneck?", "options": ["Disk space", "Latency and tight coupling", "Frontend rendering"], "answer": 1, "explanation_pt": "\"end-to-end latency under peak load exceeds our P99 SLO\" e \"coupling between services\"."},
  {"q": "What pattern mitigates schema evolution risk?", "options": ["Microservices", "Schema registry pattern", "GraphQL"], "answer": 1, "explanation_pt": "\"adopting the schema registry pattern\"."},
  {"q": "Why include 4 weeks of parallel running?", "options": ["To save costs", "To enable rollback if migration fails", "Legal compliance"], "answer": 1, "explanation_pt": "\"parallel running for the final four weeks to ensure rollback capability\"."}
]'::jsonb,
'[{"word":"RFC","pt":"Request for Comments — proposta técnica"},{"word":"SLO","pt":"Service Level Objective"},{"word":"materialized view","pt":"visão materializada"},{"word":"idempotent","pt":"idempotente"}]'::jsonb);

-- ============================================
-- 6. SEED ACHIEVEMENTS
-- ============================================

INSERT INTO public.achievements (code, title, description_pt, emoji, criteria, xp_reward) VALUES
('first_step', 'First Step', 'Complete seu primeiro exercício', '🌱', '{"type":"attempts","count":1}'::jsonb, 50),
('streak_3', 'On Fire', 'Mantenha uma sequência de 3 dias', '🔥', '{"type":"streak","days":3}'::jsonb, 100),
('streak_7', 'Unstoppable', 'Mantenha uma sequência de 7 dias', '🚀', '{"type":"streak","days":7}'::jsonb, 250),
('streak_30', 'Native Speaker', '30 dias consecutivos de prática', '👑', '{"type":"streak","days":30}'::jsonb, 1000),
('perfectionist', 'Perfectionist', '10 exercícios com nota 100', '💯', '{"type":"perfect_attempts","count":10}'::jsonb, 300),
('polyglot', 'Voice Polyglot', 'Use todos os 4 modos (writing, listening, speaking, conversation) em um único dia', '🎭', '{"type":"all_modes_one_day"}'::jsonb, 200),
('reviewer', 'Master Reviewer', 'Complete 20 revisões da fila de revisão', '🔁', '{"type":"reviews_done","count":20}'::jsonb, 250),
('lesson_master', 'Lesson Master', 'Complete 5 lições completas', '📚', '{"type":"lessons_completed","count":5}'::jsonb, 400),
('level_up', 'Level Up', 'Suba para um nível mais alto', '⬆️', '{"type":"level_increase"}'::jsonb, 500),
('vocabulary_builder', 'Vocabulary Builder', 'Salve 25 palavras no seu vocabulário', '🧠', '{"type":"vocab_saved","count":25}'::jsonb, 200);

-- ============================================
-- 7. TOTALS PER LESSON
-- ============================================

UPDATE public.user_lesson_progress ulp
SET total_exercises = (SELECT COUNT(*) FROM public.exercises WHERE lesson_id = ulp.lesson_id);
