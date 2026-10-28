# EnglishUp: a speaking-first English learning platform

**Role:** Solo builder (product, architecture, content, technical decisions)
**Stack:** React 19, TanStack Start, TypeScript, Tailwind v4, Supabase (Postgres, Auth, RLS), Vercel AI SDK, Whisper (STT), Gemini (LLM evaluation), TTS
**Build tool:** Lovable (AI-assisted development), directed and audited end-to-end by me
**Status:** Feature-complete, pre-launch, personal validation phase

> The original product and architecture spec I wrote before any code was generated lives in [`docs/initial-spec.md`](docs/initial-spec.md).

---

## 1. The problem

I had failed at learning English several times, always for the same three reasons:

1. **Inconsistent routine.** Study sessions with no fixed cadence, easy to skip.
2. **Grammar-only methods.** Apps and courses that drill rules but never force real production of the language.
3. **Speaking avoidance.** Every serious plan eventually requires speaking out loud and getting corrected, and every plan quietly avoided that step.

Generic apps solve none of these for an adult professional: no structured feedback on *spoken* output, no error-driven spaced repetition, no vocabulary tracks for a technical or sales career. EnglishUp removes the excuse: the speaking step is not optional, not ungraded and not generic.

## 2. Architecture

### Core loop

```
User records audio
   → Whisper (STT) transcribes
   → Gemini evaluates against the expected response and returns a
     structured result (score, mispronounced words, feedback)
     validated by a Zod schema, never free text
   → TTS generates spoken feedback
   → Result written to review_queue / user_vocabulary
     with the next spaced-repetition interval scheduled
```

All four exercise modes (`writing`, `speaking_read`, `speaking_free`, `listening`) share this evaluation backbone, adapted per input/output type.

### Key decisions

- **Server-side evaluation.** TanStack Start server functions handle grading and LLM calls, so provider keys and scoring logic never reach the browser. LLM traffic goes through Lovable's OpenAI-compatible AI Gateway.
- **Hand-rolled spaced repetition.** 1 / 3 / 7 / 14 / 30 / 60-day steps, reset to day 1 on failure, applied to two independent queues: grammar/error review and vocabulary. Same family as Anki's SM-2, sized to this schema.
- **Anti-cheat by design.** Achievement and XP grants run through a server function using the Postgres service role, which re-validates the criteria against real database state. The client can request an evaluation but never assert its result. This was a requirement from the first schema draft, not a later patch.
- **Row Level Security hardened iteratively.** 9 migrations over about 11 days, each tightening RLS on tables that don't need direct client writes (progress, achievements, review queue), re-verifying every screen against the new policy set.
- **Content model.** 55 lessons and 215 exercises across 4 modes, 3 levels and 3 tracks (general, tech, sales). The tech and sales tracks map to my own vocabulary needs (code review language, deal negotiation language).

## 3. What is measurable

**Delivery scope (verifiable):**

| Metric | Value |
|---|---|
| Schema migrations to reach hardened RLS | 9, over ~11 days |
| Lessons / exercises | 55 / 215 |
| Exercise modes | 4 |
| Screens wired to live business logic | 13 |
| Stubs/TODOs found in an audit of the business logic | 0 |
| Pipeline stages shipped | STT → LLM evaluation → TTS → SRS scheduling |

**Known risks (found in my own audit, not hidden):**

- A migration dropped the `CHECK` constraint on `exercises.type` and it was never recreated. The server-side Zod schema is the only remaining guard against a malformed `type` via direct SQL insert.
- Zero automated test coverage.
- Speaking evaluation depends on a single hardcoded model name, with no fallback if it is deprecated on the gateway.

**What I don't have, and why:** there are no usage metrics (DAU, retention) because the product has not been opened to external users. Before writing any billing code I found three blockers: no payment infrastructure, no per-user API cost ceiling (each speaking exercise fires three uncapped LLM calls), and roughly 53 days of content runway under a one-time-charge model. The next step is pulling real per-user API cost from the gateway to validate unit economics before building anything else.

## 4. Main technical challenges

- **Gradeable LLM output instead of free text.** Constrained the evaluation to a Zod schema at the server-function boundary, so the client always receives a typed, predictable shape.
- **Non-negotiable anti-cheat.** Any client-writable progress table is client-forgeable, so every grant goes through a service-role function that re-checks the criteria.
- **Hardening security without breaking a working app.** Nine small RLS migrations, each re-validated, instead of one large rewrite.
- **Pausing a bad monetization plan.** Decided to measure real per-user cost before shipping a billing flow on assumptions.

## 5. My contribution

- Defined the product concept and the initial schema and architecture spec (data model, RLS approach, server-function-as-proxy for every graded call) before any code was generated.
- Directed the 9-migration security hardening pass, policy by policy.
- Designed the spaced-repetition logic and its two independent queues.
- Set the server-side anti-cheat requirement from the first draft.
- Authored all 55 lessons and 215 exercises, including the tech and sales tracks.
- Ran the audit that surfaced the `CHECK` gap, the missing tests and the single-model dependency.
- Built the system with Lovable as the implementation layer while owning architecture, security posture and content.

## Repository notes

- This project is connected to Lovable; commits to `main` sync back to the editor.
- `.env` contains only the Supabase project URL, project ID and **publishable (anon) key**. These are designed to ship to the browser; data access is enforced by Row Level Security. Service-role credentials live only in server-side environment variables and are not in this repository.
