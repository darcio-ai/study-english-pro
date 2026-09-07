# English Journey Pro

# EnglishUp — English Learning App for Brazilian Portuguese Speakers

Build a complete English learning web app called EnglishUp. Stack: React + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL + Edge Functions).

---

## SUPABASE: DATABASE SCHEMA

Run this migration:

create table if not exists exercises (
  id uuid default gen_random_uuid() primary key,
  level text not null check (level in ('beginner','intermediate','advanced')),
  type text not null check (type in ('translate','correct_sentence','fill_blank','free_write')),
  prompt_pt text not null,
  prompt_en text not null,
  content text,
  grammar_focus text not null,
  model_answer text not null,
  created_at timestamptz default now()
);

create table if not exists user_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  exercises_completed int default 0,
  streak_days int default 0,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  exercise_id uuid references exercises(id),
  user_input text not null,
  correction jsonb,
  score int check (score between 0 and 100),
  grammar_focus text,
  level text,
  created_at timestamptz default now()
);

alter table exercises enable row level security;
create policy "public_read_exercises" on exercises for select using (true);

alter table user_progress enable row level security;
create policy "own_progress_select" on user_progress for select using (auth.uid() = user_id);
create policy "own_progress_insert" on user_progress for insert with check (auth.uid() = user_id);
create policy "own_progress_update" on user_progress for update using (auth.uid() = user_id);

alter table attempts enable row level security;
create policy "own_attempts_select" on attempts for select using (auth.uid() = user_id);
create policy "own_attempts_insert" on attempts for insert with check (auth.uid() = user_id);

---

## SUPABASE: EDGE FUNCTION

Create Supabase Edge Function named: correct-grammar

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userInput, exercisePromptEn, exerciseContent, grammarFocus, level } = await req.json()

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

    const systemPrompt = `You are an English grammar teacher for Brazilian Portuguese speakers.
Student level: ${level}.
Return ONLY valid JSON, no markdown, no extra text:
{
  "errors": [
    {
      "segment": "exact incorrect text from student answer",
      "corrected": "correct version of that segment",
      "type": "grammar category",
      "explanation_pt": "explanation in Brazilian Portuguese, max 2 sentences",
      "rule": "grammar rule in English, max 1 sentence"
    }
  ],
  "corrected_text": "full corrected version of the student answer",
  "score": 0-100,
  "positive_pt": "one encouraging sentence in Portuguese if score >= 60, else empty string"
}
If the answer is fully correct, return empty errors array and score 100.`

    const userMessage = `Exercise instruction: ${exercisePromptEn}
${exerciseContent ? `Sentence to work with: ${exerciseContent}` : ''}
Grammar focus: ${grammarFocus}
Student answer: "${userInput}"
Return JSON only.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    const data = await response.json()
    const correction = JSON.parse(data.content[0].text)

    return new Response(JSON.stringify(correction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

---

## SUPABASE: SEED DATA

Insert after creating tables:

INSERT INTO exercises (level, type, prompt_pt, prompt_en, content, grammar_focus, model_answer) VALUES

('beginner','translate','Traduza usando Present Perfect: "Trabalho em vendas há 25 anos."','Translate using Present Perfect.',null,'Present Perfect','I''ve worked in sales for 25 years.'),

('beginner','correct_sentence','Corrija o erro de compound adjective.','Find and fix the compound adjective error.','He is a 35 years old manager.','Compound Adjective','He is a 35-year-old manager.'),

('beginner','fill_blank','Complete com a forma correta do verbo (escreva a frase completa).','Fill in with the correct verb form (write the full sentence).','My colleague ___ (work) as a sales analyst.','Third Person Singular','My colleague works as a sales analyst.'),

('beginner','correct_sentence','Corrija a preposição incorreta sobre home office.','Fix the incorrect preposition about working remotely.','I work in home office every day.','Prepositions - Work Location','I work from home every day.'),

('beginner','translate','Traduza: "Minha colega é analista de vendas."','Translate this sentence.',null,'Articles + Profession','My colleague is a sales analyst.'),

('beginner','correct_sentence','Corrija o artigo ausente.','Fix the missing article.','She is manager of the team.','Articles','She is a manager of the team.'),

('beginner','correct_sentence','Corrija o erro na forma negativa do verbo.','Fix the error in the negative verb form.','He don''t like making cold calls.','Third Person Singular - Negation','He doesn''t like making cold calls.'),

('beginner','translate','Traduza usando Simple Past: "Eu trabalhei no banco por cinco anos."','Translate using Simple Past.',null,'Simple Past','I worked at the bank for five years.'),

('intermediate','translate','Traduza usando Present Perfect Continuous: "Estou estudando inglês há seis meses."','Translate using Present Perfect Continuous.',null,'Present Perfect Continuous','I''ve been studying English for six months.'),

('intermediate','fill_blank','Complete com a forma correta dos verbos (escreva a frase completa).','Fill in the blanks with the correct verb forms (write the full sentence).','If I ___ (practice) every day, my English ___ (improve) quickly.','First Conditional','If I practice every day, my English will improve quickly.'),

('intermediate','correct_sentence','Corrija o erro no modal verb.','Fix the modal verb error.','You must to send the report by Friday.','Modal Verbs','You must send the report by Friday.'),

('intermediate','translate','Traduza usando Second Conditional: "Se eu tivesse mais tempo, estudaria inglês todos os dias."','Translate using Second Conditional.',null,'Second Conditional','If I had more time, I would study English every day.'),

('intermediate','correct_sentence','Corrija o erro na voz passiva.','Fix the passive voice error.','The proposal was approved by of the director.','Passive Voice','The proposal was approved by the director.'),

('intermediate','fill_blank','Complete com o pronome relativo correto (who, which, that) e escreva a frase completa.','Fill in with the correct relative pronoun and write the full sentence.','The client ___ signed the contract yesterday is our biggest account.','Relative Clauses','The client who signed the contract yesterday is our biggest account.'),

('intermediate','correct_sentence','Corrija o erro no reported speech.','Fix the reported speech error.','She said she will send the proposal tomorrow.','Reported Speech','She said she would send the proposal the next day.'),

('intermediate','translate','Traduza usando Present Perfect com "since": "Não falo com ele desde segunda-feira."','Translate using Present Perfect with since.',null,'Present Perfect - Since vs For','I haven''t spoken to him since Monday.'),

('advanced','translate','Traduza usando Third Conditional: "Se eu tivesse me preparado melhor, teria conseguido a promoção."','Translate using Third Conditional.',null,'Third Conditional','If I had prepared better, I would have gotten the promotion.'),

('advanced','correct_sentence','Corrija a estrutura de inversão após "Not only".','Fix the inverted structure after Not only.','Not only he missed the deadline, but also he didn''t inform the team.','Inversion','Not only did he miss the deadline, but he also failed to inform the team.'),

('advanced','fill_blank','Complete com o phrasal verb correto (go through, call off, put off, set up) e escreva a frase completa.','Fill in with the correct phrasal verb (go through, call off, put off, set up) and write the full sentence.','After months of negotiation, the deal finally ___ ___.','Business Phrasal Verbs','After months of negotiation, the deal finally went through.'),

('advanced','translate','Traduza este mixed conditional: "Se eu tivesse estudado mais quando jovem, estaria em uma posição melhor hoje."','Translate this mixed conditional.',null,'Mixed Conditionals','If I had studied more when I was young, I would be in a better position now.'),

('advanced','correct_sentence','Corrija o erro no subjuntivo formal.','Fix the subjunctive mood error.','It is essential that every team member attends the weekly meeting.','Subjunctive Mood','It is essential that every team member attend the weekly meeting.'),

('advanced','correct_sentence','Corrija o erro na cleft sentence.','Fix the cleft sentence error.','It was the strategy what made the campaign successful.','Cleft Sentences','It was the strategy that made the campaign successful.');

---

## APP ROUTES

/ → if authenticated redirect to /dashboard, else redirect to /auth
/auth → Login and Register
/dashboard → Main hub
/exercise → Practice screen
/progress → Progress charts

---

## PAGE: /auth

Centered card layout. Logo "EnglishUp 🇧🇷→🇺🇸" at top.
Two tabs: "Entrar" and "Criar conta".
Fields: email + password.
On signup success: insert row into user_progress (user_id, level='beginner') then redirect to /dashboard.
On login success: redirect to /dashboard.

---

## PAGE: /dashboard

Header: "Olá! 👋" + user email
Level badge pill (clickable to change): green=Iniciante, blue=Intermediário, purple=Avançado
When level changes: update user_progress.level in Supabase.

Stats row — 3 cards:
- Exercícios feitos: user_progress.exercises_completed
- Sequência: user_progress.streak_days dias
- Nível: current level badge

Primary button: "Praticar agora →" → /exercise
Secondary link: "Ver progresso" → /progress

Recent attempts section — last 5 from attempts table, ordered by created_at desc:
Each row: grammar_focus | score badge (colored) | level pill | time ago (e.g. "há 2 horas")
If empty: "Nenhuma atividade ainda. Comece a praticar! 🚀"

Logout button in top right corner.

---

## PAGE: /exercise

State: exercise (object), userInput (string), isLoading (boolean), correction (null or object), recentIds (array, last 3 exercise ids)

On load: fetch one random exercise from exercises table where level = user's current level and id NOT IN recentIds. Query: select * from exercises where level = '{userLevel}' and id != all('{recentIds}') order by random() limit 1

Top bar:
- Back arrow → /dashboard
- Level pill
- Grammar focus badge (exercise.grammar_focus)

Exercise card:
- Section "📘 Instrução:" — prompt_pt in gray (Portuguese instruction for the student)
- prompt_en in bold black (English instruction)
- If exercise.content is not null: gray bordered box labeled "Frase:" containing exercise.content
- Textarea: placeholder "Escreva sua resposta em inglês...", min-rows=3, auto-grow, disabled when correction is visible
- "Verificar resposta" button: indigo, full width on mobile, disabled if textarea empty
- While loading: show spinner + "Verificando com IA..."

Call edge function on submit:
supabase.functions.invoke('correct-grammar', {
  body: {
    userInput,
    exercisePromptEn: exercise.prompt_en,
    exerciseContent: exercise.content,
    grammarFocus: exercise.grammar_focus,
    level: userLevel
  }
})

Correction panel (animated fade-in slide-up, shown after response):

Score header:
- score >= 80: green bg "✅ score/100 — Muito bem!"
- score 50-79: amber bg "⚠️ score/100 — Quase lá!"
- score < 50: red bg "❌ score/100 — Vamos revisar"

If positive_pt not empty: italic gray text below score

Corrected text box: green left border, label "Versão corrigida:", corrected_text in bold

Errors section (if errors.length > 0):
Title: "Erros encontrados:"
For each error:
- "segment" in red with line-through styling
- Arrow →
- "corrected" in bold green
- New line: explanation_pt in gray text (text-sm)
- New line: "rule" in monospace code pill (bg-gray-100 dark:bg-gray-800, rounded, px-2 py-0.5, text-xs font-mono)

If errors.length === 0: green text "Perfeito! Nenhum erro encontrado. 🎉"

Two buttons:
- "Tentar novamente" (secondary outline): clears textarea, clears correction, keeps same exercise
- "Próximo exercício →" (indigo primary): saves attempt, loads next exercise

On "Próximo exercício":
1. Insert to attempts: { user_id, exercise_id: exercise.id, user_input: userInput, correction: correctionObject, score: correction.score, grammar_focus: exercise.grammar_focus, level: userLevel }
2. Update user_progress: exercises_completed + 1, last_activity_at = now()
3. Add exercise.id to recentIds (keep only last 3)
4. Fetch new exercise avoiding recentIds, reset all state

---

## PAGE: /progress

Header: "Meu Progresso 📊"

Stats row — 3 cards:
- Total exercícios: count(*) from attempts where user_id = current user
- Nota média: avg(score) from attempts, show as "X/100"
- Esta semana: count(*) from attempts where created_at >= now() - interval '7 days'

Chart 1 — "Notas dos últimos 7 dias" (Line chart, use recharts):
Data: group attempts by day (last 7 days), average score per day
X axis: day labels (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
Y axis: 0 to 100
Line color: indigo-600

Chart 2 — "Exercícios por categoria" (Bar chart, use recharts):
Data: group attempts by grammar_focus, count per category, sort descending
X axis: grammar_focus (abbreviated if too long)
Y axis: count
Bar color: indigo-400

If no attempts data: "Nenhum exercício ainda. Que tal começar agora?" + button to /exercise

Back link to /dashboard at top.

---

## DESIGN SYSTEM

Font: Inter from Google Fonts
Primary color: indigo-600, hover indigo-700
Background: gray-50 (dark: gray-900)
Cards: white rounded-xl shadow-sm (dark: gray-800)
Max width: max-w-lg centered on desktop, full width on mobile with p-4 padding
Transitions: all correction panels fade in + slide up (transition-all duration-300)

Level colors:
- beginner: bg-green-100 text-green-800 (dark: bg-green-900 text-green-200)
- intermediate: bg-blue-100 text-blue-800 (dark: bg-blue-900 text-blue-200)
- advanced: bg-purple-100 text-purple-800 (dark: bg-purple-900 text-purple-200)

Score badge colors:
- >= 80: bg-green-100 text-green-800 border-green-200
- 50-79: bg-amber-100 text-amber-800 border-amber-200
- < 50: bg-red-100 text-red-800 border-red-200

Error display:
- Incorrect segment: text-red-500 line-through
- Corrected segment: text-green-600 font-semibold
- Explanation: text-gray-600 dark:text-gray-400 text-sm
- Rule pill: font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-0.5

Full dark mode support using Tailwind dark: classes throughout.
Mobile-first. Bottom padding pb-20 on exercise page to account for mobile keyboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://study-english-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/033e9678-c7a1-4c68-b62c-dd5892360112).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
