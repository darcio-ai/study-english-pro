> Confirmado nos arquivos: hoje nada no app tem noção de idioma. As tabelas `lessons`, `exercises` e `reading_texts` não têm coluna de idioma; `Track` em `src/lib/learning.ts` é só `sales | tech | general`; os prompts de IA em `correct-grammar.functions.ts` e `evaluate-speaking.functions.ts` dizem "English teacher"; e `stt.functions.ts` envia `language: "en"` fixo.

# Espanhol no mesmo app

A boa notícia: **o motor não muda**. SRS, XP, conquistas, fila de revisão, gravador de áudio, lição runner, dashboard — tudo continua igual. O que muda é (1) marcar idioma no conteúdo, (2) um seletor Inglês/Espanhol, (3) tirar "inglês" dos lugares onde está fixo, e (4) escrever o conteúdo em espanhol.

## O que muda de verdade

### 1. Banco — coluna `language`
Adicionar `language text not null default 'en'` em `lessons`, `exercises` e `reading_texts`, e `preferred_language` em `user_progress`. Todo o conteúdo atual vira `'en'` automaticamente, então nada quebra.

O progresso passa a ser separado por idioma: seu nível de inglês avançado não te joga em espanhol avançado. As tabelas de progresso (`user_lesson_progress`, `review_queue`, `user_vocabulary`, `attempts`) já apontam para lições/exercícios específicos, então se separam sozinhas — exceto o **nível**, que hoje é um campo único em `user_progress`.

### 2. Nível — mesma escala, sem novo teste
Você pediu "os mesmos do inglês": mantemos iniciante / intermediário / avançado e **o resultado do teste atual vale para os dois idiomas**. Sem segundo teste de nivelamento por enquanto (dá pra adicionar depois se o espanhol ficar fácil ou difícil demais).

### 3. Seletor de idioma na interface
Um switch **🇬🇧 Inglês / 🇪🇸 Espanhol** no topo do Dashboard e da tela de Lições, acima do seletor de trilha. Trocar o idioma filtra lições, exercícios, leitura, revisão e vocabulário. A preferência fica salva.

### 4. IA — trocar o idioma-alvo
Quatro pontos hoje presos ao inglês:
- **Correção de gramática**: prompt vira "professor de espanhol para falantes de português" quando o exercício for `es`.
- **Avaliação de fala**: mesma troca, e o coach de pronúncia passa a apontar erros típicos de brasileiro em espanhol (ñ, r, j, "portunhol").
- **Transcrição (STT)**: `language: "es"` em vez de `"en"`.
- **Áudio (TTS)**: as vozes atuais já falam espanhol; só é preciso mandar o texto em espanhol.

Ponto forte pro espanhol: como português e espanhol são próximos, o feedback deve caçar **falsos amigos** (embarazada, exquisito, largo, oficina) e portunhol — vale um trecho dedicado no prompt.

### 5. Conteúdo — as 3 trilhas espelhadas
Espanhol nativo, não tradução literal do inglês. Mesma estrutura de unidades/lições:
- **Geral** — 15 iniciante (saudações, números, família, comida), 12 intermediário (viagem, hotel, restaurante, direções, compras), 10 avançado (opiniões, narrativa, expressões, subjuntivo). Diferença importante vs. inglês: **tú/usted** e o **subjuntivo** precisam de lições próprias.
- **Vendas** — prospecção, negociação, follow-up, objeções, com registro formal LatAm/Espanha.
- **Tech** — daily, code review, incidentes, documentação.
- **Leitura** — 6 textos com quiz.

Total: ~55 lições e ~215 exercícios em espanhol. **Sugiro entregar em 2 etapas**: primeiro a infraestrutura + trilha Geral completa (37 lições) para você testar de ponta a ponta, depois Vendas + Tech + leitura.

### 6. Identidade
"EnglishUp" deixa de fazer sentido. Sugestão: nome neutro (ex.: **LinguaUp** / **FluentUp**) nos títulos de página, manifesto PWA e ícones — ou manter o nome e só assumir o espanhol como extra. Você decide.

## Detalhes técnicos

- Migration: `ALTER TABLE ... ADD COLUMN language`, índices em `(language, track, level)`, `preferred_language` em `user_progress`. Sem RLS nova — políticas de leitura pública já cobrem.
- `src/lib/learning.ts`: novo tipo `Language = "en" | "es"` + labels/bandeiras, análogo a `Track`.
- Todas as queries `.eq("track", ...)` em `lessons.tsx`, `dashboard.tsx`, `exercise.tsx`, `listening.tsx`, `speaking*.tsx`, `reading.tsx`, `review.tsx` ganham `.eq("language", lang)`.
- Server functions recebem `language` no input validator; prompts passam a ser montados por idioma.
- Conteúdo entra via migrations de `INSERT` (mesmo processo usado nas trilhas atuais).

## O que **não** muda
Autenticação, perfis, PWA, conquistas, XP, SRS, gravador de áudio, exportações, telas de progresso e fraquezas.
