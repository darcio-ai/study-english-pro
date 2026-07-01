# Trilha Geral estilo Duolingo

Hoje o app tem só trilhas **Vendas** e **Tecnologia**, ambas com vocabulário profissional avançado. Vou adicionar uma terceira trilha **Geral** (🌍) com lições curtas e progressivas — do "Hello, my name is..." até conversas do dia a dia — no formato Duolingo.

## O que vai mudar

### 1. Seletor de trilha (Lições)
Adicionar botão **🌍 Geral** ao lado de Vendas e Tecnologia em `src/routes/_authenticated/lessons.tsx`. A infraestrutura de trilhas já existe (`Track = "sales" | "tech" | "general"`), só falta expor e popular conteúdo.

### 2. Novas lições "Geral" (nível beginner)
Criar ~15 lições curtas em migration SQL, cobrindo o básico do básico:

```text
Unidade 1 — Primeiros contatos
  1. Hello & Goodbye (olá, tchau, bom dia)
  2. My name is... (apresentar-se)
  3. Numbers 1–20
  4. How are you? (respostas simples)

Unidade 2 — Sobre você
  5. I am / You are (verbo to be)
  6. Family (mother, father, sister...)
  7. Colors & basic adjectives
  8. Where are you from? (países/nacionalidades)

Unidade 3 — Dia a dia
  9. Days of the week
  10. Food & drinks (I like / I don't like)
  11. Time (What time is it?)
  12. Weather (It's sunny/cold/raining)

Unidade 4 — Ações simples
  13. Present simple (I work, I live, I study)
  14. Can / Can't (habilidades)
  15. Shopping (How much is it?)
```

Cada lição terá 4–6 exercícios de tipos variados (escrita curta, listening, speaking guiado) — mesmo formato dos exercícios que já existem, só com vocabulário controlado e frases curtas.

### 3. Nível "beginner" real
As lições Geral só aparecem em `beginner`. Isso dá ao usuário iniciante um caminho claro sem esbarrar em jargão de vendas/tech.

## Detalhes técnicos

- **Migration**: `INSERT INTO lessons` (~15 linhas) + `INSERT INTO exercises` (~70 linhas), tudo `track='general'`, `level='beginner'`. Sem mudança de schema — as tabelas já suportam.
- **Frontend**: só adicionar `"general"` ao array `["sales", "tech"]` em `lessons.tsx` (linha ~104). Labels e emoji já existem em `TRACK_LABEL`/`TRACK_EMOJI`.
- **Sem mudanças** em: dashboard, exercícios, review, vocabulário, achievements — tudo já é agnóstico de trilha.

## Perguntas rápidas antes de eu escrever

1. **Quantas lições no total?** Sugiro começar com ~15 (as 4 unidades acima). Prefere mais/menos?
2. **Exercícios por lição:** 4–6 exercícios curtos (padrão atual) — ok?
3. **Só nível beginner** por enquanto, ou já criar intermediate/advanced Geral também?
