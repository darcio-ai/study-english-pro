## EnglishUp — Build Plan

A complete English learning app for Brazilian Portuguese speakers, built on TanStack Start + Lovable Cloud (Supabase) + Lovable AI Gateway.

### 1. Backend (Lovable Cloud)

Enable Lovable Cloud, then run one migration creating:
- `exercises` (public read)
- `user_progress` (own rows only)
- `attempts` (own rows only)

All tables get RLS + explicit GRANTs to `authenticated` (and `anon` SELECT on `exercises`). Seed the 22 exercises from the spec via the same migration.

Add a DB trigger on `auth.users` insert that creates a `user_progress` row at level `beginner` (more reliable than client-side insert).

### 2. AI correction (server function, not Edge Function)

`src/lib/correct-grammar.functions.ts` — a `createServerFn` protected by `requireSupabaseAuth` that:
- accepts `{ userInput, exercisePromptEn, exerciseContent, grammarFocus, level }`
- calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with the same system prompt from the spec, using `Output.object` (Zod schema) for guaranteed JSON: `errors[]`, `corrected_text`, `score`, `positive_pt`
- returns the parsed object
- surfaces 429 / 402 cleanly

No `ANTHROPIC_API_KEY` needed — `LOVABLE_API_KEY` is auto-provisioned.

### 3. Auth

Email/password only (per spec — no social login mentioned). Uses the integration-managed `/auth` route and `_authenticated/` layout.

### 4. Routes

```
src/routes/
  __root.tsx              shell + Inter font link + onAuthStateChange
  index.tsx               redirects to /dashboard or /auth
  _authenticated/
    route.tsx             (integration-managed gate)
    dashboard.tsx         hub: stats, level selector, recent attempts, logout
    exercise.tsx          practice screen
    progress.tsx          charts
```

### 5. Pages (UI per spec)

**Dashboard**: greeting, level pill (click to cycle/change → updates `user_progress.level`), three stat cards, primary "Praticar agora" button, last 5 attempts list with grammar focus / score badge / level / relative time (date-fns ptBR), logout button.

**Exercise**: fetches one random exercise at user's level excluding last 3 IDs (kept in component state). Renders prompt_pt, prompt_en, optional content box, auto-grow textarea, "Verificar resposta" button. On submit calls the server fn, then animates in the correction panel: colored score header, optional `positive_pt`, green-bordered corrected text box, errors list (red strike-through segment → bold green corrected, explanation_pt, monospace rule pill), or "Perfeito!" message. Two buttons: "Tentar novamente" (clear) and "Próximo exercício" (insert attempt, increment `exercises_completed`, update `last_activity_at`, recompute streak, push id to recentIds, load next).

**Progress**: three stat cards (total, average score, this week). Recharts line chart (avg score by day, last 7 days, Seg–Dom labels) and bar chart (count per grammar_focus, sorted desc). Empty state with CTA.

### 6. Design system

Tailwind v4. Inter loaded via `<link>` in `__root.tsx` head, registered in `@theme` as `--font-sans`. Semantic tokens defined in `src/styles.css` (`--color-primary` → indigo-600, surfaces, etc.). Level/score/error styles use the exact Tailwind classes from the spec. Full dark mode via `dark:` classes; theme toggle not requested so default to system. Max-w-lg centered, mobile-first, `pb-20` on exercise page.

Install `recharts` and `date-fns`.

### 7. Streak logic

On "Próximo exercício", compute the new streak server-side inside the same server function (or in a small DB function) by comparing `last_activity_at` to today: same day → unchanged, yesterday → +1, otherwise → reset to 1. Persist via `user_progress` update.

### Technical notes

- AI call uses `@ai-sdk/openai-compatible` + `ai` with the Lovable Gateway helper; structured output via `Output.object` so we never hand-parse model text.
- All DB writes go through `requireSupabaseAuth` server functions, so RLS enforces ownership and the client never holds a service key.
- Public-read `exercises` query runs from the browser supabase client (anon SELECT policy).
- Random selection uses `order by random() limit 1` with a `not in (...)` filter for recentIds.
