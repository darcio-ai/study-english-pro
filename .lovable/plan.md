# Programa guiado de 15 dias (metodologia do post do LinkedIn)

Criar um "Desafio 15 dias" complementar ao fluxo atual: nada do que existe é removido. O programa é uma trilha diária guiada (15 a 20 min/dia), inspirada no post — cada dia tem um tema, um objetivo e atividades — conectado às lições, práticas e revisões que o app já tem.

## Como vai funcionar para o usuário

- **Card "Desafio 15 dias"** na tela Início: mostra o dia atual, progresso (ex.: 6/15) e a missão do dia. Quem não começou vê um convite "Começar desafio".
- **Página do desafio**: lista dos 15 dias com check em cada dia concluído; o dia atual fica em destaque. Cada dia abre com:
  - Tema e objetivo (ex.: "Dia 5 — Família: aprender 15 palavras e usá-las em frases").
  - **Missões do dia** (2 a 4 blocos): mistura de conteúdo pronto (vocabulário com tradução, frases modelo, mini-diálogo para ler/ouvir) com atalhos para as práticas do app (escrita, escuta, fala, leitura) filtradas no tema do dia.
  - **Botão "Gerar variação com IA"**: cria exercícios extras do tema do dia (frases, quiz de múltipla escolha, diálogo) personalizados ao nível e idioma do usuário, com correção automática. Opcional — quem não clicar completa o dia só com o conteúdo fixo.
  - **Dia de revisão** (7 e 14) e **teste final** (dia 15): quiz com o vocabulário da semana/programa, como no post.
- Concluir as missões do dia marca o dia como feito, concede XP e alimenta streak, resumo semanal e plano de hoje já existentes.
- **6 programas**: iniciante, intermediário e avançado, em inglês e espanhol. O app sugere o programa do nível/idioma atual do usuário; dá para trocar.

## Vantagens da metodologia (o que ela agrega ao app)

- Constância: meta curta diária (15–20 min) reduz desistência.
- Progressão clara: tema por dia, revisão semanal e teste final dão sensação de conclusão.
- Complementar: usa as práticas que já existem em vez de competir com elas; os dados entram no diagnóstico por habilidade e no calendário.

## O que será construído

1. **Conteúdo**: curadoria dos 6 programas (15 dias cada: tema, objetivo, vocabulário com tradução, frases, diálogo, dias de revisão e teste final). Gerado com IA em lote e revisado, salvo como dados fixos — sem custo de IA no dia a dia.
2. **Tabelas novas**:
   - `programs` (idioma, nível, título) e `program_days` (programa, dia 1–15, tema, objetivo, conteúdo em JSON: vocabulário, frases, diálogo, quiz) — leitura pública.
   - `user_program_progress` (user_id, programa, dia_atual, dias concluídos, status) — RLS por `auth.uid()`, com GRANTs.
3. **Variação com IA**: nova função de servidor `generate-program-extras` (Lovable AI Gateway) que recebe tema/nível/idioma do dia e devolve frases + quiz + diálogo; respostas do quiz corrigidas no app, frases escritas corrigidas pela função de correção já existente.
4. **Telas**:
   - Nova rota `/desafio` (visão dos 15 dias + dia aberto com missões e botão de IA).
   - Card do desafio em `inicio.tsx` (progresso + missão do dia) e item de menu.
   - Conclusão de dia concede XP via `addXp` e registra em `attempts` (modo próprio) para alimentar diagnóstico e resumo semanal.
5. **Textos em pt-BR**; conteúdo filtrado por `preferred_language` e nível por habilidade não se aplica aqui (o programa usa o nível geral escolhido).

## Detalhes técnicos

- Migração única: `programs`, `program_days` (com GRANT SELECT a `public`, sem escrita), `user_program_progress` (GRANT a `authenticated`/`service_role`, RLS por usuário, políticas select/insert/update).
- Seed dos 90 dias de conteúdo (6 programas × 15) gerado via script com o gateway de IA e inserido por migração com INSERTs literais.
- `generate-program-extras` em `src/lib/*.functions.ts` com `requireSupabaseAuth`, validação zod, modelo rápido do gateway, resposta em JSON estrito com fallback de parsing (mesmo padrão endurecido de `correct-grammar`).
- `attempts` ganha reaproveitamento do modo existente (sem coluna nova): missões de escrita do dia usam o fluxo normal de correção.
- Nada muda em lições, plano inteligente, calendário ou revisão — o desafio apenas aponta para eles e compartilha XP/streak.
