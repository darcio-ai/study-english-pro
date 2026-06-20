-- Drop restrictive type check if exists
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'writing',
  ADD COLUMN IF NOT EXISTS audio_script text,
  ADD COLUMN IF NOT EXISTS expected_response text;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS mode text;

CREATE INDEX IF NOT EXISTS idx_exercises_level_mode ON public.exercises(level, mode);

INSERT INTO public.exercises (level, type, mode, prompt_pt, prompt_en, audio_script, grammar_focus, model_answer) VALUES
('beginner','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','My name is John and I am a teacher.','present simple','My name is John and I am a teacher.'),
('beginner','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','I have two brothers and one sister.','have / family','I have two brothers and one sister.'),
('beginner','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','She goes to school every day.','present simple','She goes to school every day.'),
('intermediate','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','I have been studying English for three years.','present perfect continuous','I have been studying English for three years.'),
('intermediate','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','If it rains tomorrow, we will stay home.','1st conditional','If it rains tomorrow, we will stay home.'),
('intermediate','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','She told me she had already finished her homework.','reported speech','She told me she had already finished her homework.'),
('advanced','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','Had I known about the meeting, I would have attended it.','3rd conditional / inversion','Had I known about the meeting, I would have attended it.'),
('advanced','dictation','listening','Ouça a frase e escreva exatamente o que você ouviu.','Listen and write what you hear.','The project, which was launched last year, has exceeded all expectations.','relative clauses / passive','The project, which was launched last year, has exceeded all expectations.');

INSERT INTO public.exercises (level, type, mode, prompt_pt, prompt_en, content, grammar_focus, model_answer) VALUES
('beginner','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','Hello, how are you today?','greetings','Hello, how are you today?'),
('beginner','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','I would like a cup of coffee, please.','polite requests','I would like a cup of coffee, please.'),
('beginner','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','The weather is beautiful this morning.','vocabulary','The weather is beautiful this morning.'),
('intermediate','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','Although it was raining, we decided to go for a walk.','linking words','Although it was raining, we decided to go for a walk.'),
('intermediate','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','She has been working at this company since 2018.','present perfect','She has been working at this company since 2018.'),
('intermediate','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','I usually wake up early on weekdays.','adverbs of frequency','I usually wake up early on weekdays.'),
('advanced','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','The unprecedented circumstances required immediate, decisive action from the authorities.','advanced vocabulary','The unprecedented circumstances required immediate, decisive action from the authorities.'),
('advanced','pronunciation','speaking_read','Leia a frase em voz alta com clareza.','Read the sentence aloud clearly.','Had the engineers anticipated the structural flaws, the catastrophe could have been avoided.','3rd conditional / inversion','Had the engineers anticipated the structural flaws, the catastrophe could have been avoided.');

INSERT INTO public.exercises (level, type, mode, prompt_pt, prompt_en, expected_response, grammar_focus, model_answer) VALUES
('beginner','conversation','speaking_free','Conte sobre você. Diga seu nome, idade e o que você faz.','Tell me about yourself. Say your name, age, and what you do.','My name is ___. I am ___ years old. I am a ___.','personal info / present simple','My name is Maria. I am 30 years old. I am a teacher.'),
('beginner','conversation','speaking_free','Descreva sua família em 2-3 frases.','Describe your family in 2-3 sentences.','I have ___ brothers/sisters. My parents are ___. We live in ___.','family / present simple','I have one brother and one sister. My parents are teachers. We live in São Paulo.'),
('beginner','conversation','speaking_free','O que você fez no fim de semana passado?','What did you do last weekend?','Last weekend I ___. I also ___.','past simple','Last weekend I went to the beach. I also visited my grandmother.'),
('intermediate','conversation','speaking_free','Descreva sua rotina diária.','Describe your daily routine.','I usually wake up at ___. Then I ___. After work I ___.','present simple / adverbs','I usually wake up at seven. Then I have breakfast and go to work. After work I exercise and read a book.'),
('intermediate','conversation','speaking_free','Fale sobre suas férias dos sonhos. Para onde você iria e por quê?','Talk about your dream vacation. Where would you go and why?','I would go to ___ because ___. I would love to ___.','2nd conditional','I would go to Japan because I love the culture. I would love to visit Tokyo and try authentic sushi.'),
('intermediate','conversation','speaking_free','Conte sobre um livro ou filme que você gostou recentemente.','Tell me about a book or movie you enjoyed recently.','I recently watched/read ___. It was about ___. I liked it because ___.','past simple / opinions','I recently watched Inception. It was about dreams within dreams. I liked it because the plot was very clever.'),
('advanced','conversation','speaking_free','Qual é o maior desafio que a sua geração enfrenta? Justifique.','What is the biggest challenge your generation faces? Justify your answer.','I believe the biggest challenge is ___. This is because ___. As a result, ___.','complex argumentation','I believe the biggest challenge is climate change. This is because it threatens our future and requires urgent collective action. As a result, we must rethink consumption and energy.'),
('advanced','conversation','speaking_free','Se você pudesse mudar uma decisão do seu passado, qual seria e por quê?','If you could change one decision from your past, what would it be and why?','If I could change ___, I would ___. Looking back, I should have ___.','mixed conditionals / regrets','If I could change my college major, I would have studied medicine. Looking back, I should have followed my passion instead of practical considerations.');