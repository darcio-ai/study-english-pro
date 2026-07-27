import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { correctGrammar, type Correction } from "@/lib/correct-grammar.functions";
import { useLanguage } from "@/hooks/use-language";
import { useSkillLevel } from "@/hooks/use-skill-level";
import { LevelSelect } from "@/components/level-select";
import type { Language } from "@/lib/learning";

import {
  GrammarFocusBadge,
  ScoreBadge,
  type Level,
} from "@/components/englishup";

export const Route = createFileRoute("/_authenticated/exercise")({
  head: () => ({ meta: [{ title: "Praticar — EnglishUp" }] }),
  component: ExercisePage,
});

type Exercise = {
  id: string;
  level: Level;
  prompt_pt: string;
  prompt_en: string;
  content: string | null;
  grammar_focus: string;
};

function ExercisePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const correctFn = useServerFn(correctGrammar);
  const { language } = useLanguage(user.id);


  const { level: userLevel, setLevel, ready } = useSkillLevel(user.id, language, "writing");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const recentIdsRef = useRef<string[]>([]);

  const loadNext = useCallback(
    async (level: Level, lang: Language) => {
      setLoading(true);
      setCorrection(null);
      setUserInput("");
      try {
        let query = supabase
          .from("exercises")
          .select("*")
          .eq("level", level)
          .eq("language", lang);
        if (recentIdsRef.current.length > 0) {
          query = query.not("id", "in", `(${recentIdsRef.current.join(",")})`);
        }
        const { data, error } = await query.limit(50);
        if (error) throw error;
        const list = (data ?? []) as Exercise[];
        if (list.length === 0) {
          // exhausted, reset
          recentIdsRef.current = [];
          const { data: all } = await supabase
            .from("exercises")
            .select("*")
            .eq("level", level)
            .eq("language", lang);
          const arr = (all ?? []) as Exercise[];
          if (arr.length === 0) {
            setExercise(null);
            toast.error("Nenhum exercício disponível para este nível.");
            return;
          }
          setExercise(arr[Math.floor(Math.random() * arr.length)]);
        } else {
          setExercise(list[Math.floor(Math.random() * list.length)]);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar exercício");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load exercise once the skill level for this language is known
  useEffect(() => {
    if (!ready) return;
    loadNext(userLevel, language);
  }, [ready, userLevel, language, loadNext]);

  function changeLevel(next: Level) {
    setLevel(next).catch(() => toast.error("Não foi possível salvar o nível"));
  }


  async function onCheck() {
    if (!exercise || !userInput.trim()) return;
    setSubmitting(true);
    try {
      const result = await correctFn({
        data: {
          userInput: userInput.trim(),
          exercisePromptEn: exercise.prompt_en,
          exerciseContent: exercise.content,
          grammarFocus: exercise.grammar_focus,
          level: userLevel,
          language,

        },
      });
      setCorrection(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao verificar");
    } finally {
      setSubmitting(false);
    }
  }

  function tryAgain() {
    setCorrection(null);
    setUserInput("");
  }

  async function next() {
    if (!exercise || !correction) return;
    // Save attempt
    const { error: insErr } = await supabase.from("attempts").insert({
      user_id: user.id,
      exercise_id: exercise.id,
      user_input: userInput,
      correction: correction as unknown as never,
      score: correction.score,
      grammar_focus: exercise.grammar_focus,
      level: userLevel,
    });
    if (insErr) {
      toast.error("Erro ao salvar tentativa");
      return;
    }

    // Update progress (streak + count)
    const { data: prog } = await supabase
      .from("user_progress")
      .select("exercises_completed, streak_days, last_activity_at")
      .eq("user_id", user.id)
      .single();

    let streak = prog?.streak_days ?? 0;
    if (prog?.last_activity_at) {
      const last = new Date(prog.last_activity_at);
      const today = new Date();
      const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.round((todayDay - lastDay) / 86400000);
      if (diffDays === 0) {
        // same day, keep streak (ensure at least 1)
        streak = Math.max(streak, 1);
      } else if (diffDays === 1) {
        streak = streak + 1;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }

    await supabase
      .from("user_progress")
      .update({
        exercises_completed: (prog?.exercises_completed ?? 0) + 1,
        streak_days: streak,
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Track recent
    recentIdsRef.current = [exercise.id, ...recentIdsRef.current].slice(0, 3);
    loadNext(userLevel, language);
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <LevelSelect value={userLevel} onChange={changeLevel} disabled={loading} />
            {exercise && <GrammarFocusBadge>{exercise.grammar_focus}</GrammarFocusBadge>}
          </div>
        </div>

        {loading || !exercise ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                📘 Instrução
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {exercise.prompt_pt}
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {exercise.prompt_en}
              </p>

              {exercise.content && (
                <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Frase
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                    {exercise.content}
                  </p>
                </div>
              )}

              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={!!correction}
                rows={4}
                placeholder="Escreva sua resposta em inglês..."
                className="mt-4 w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[96px] text-base disabled:opacity-70"
              />

              {!correction && (
                <button
                  onClick={onCheck}
                  disabled={!userInput.trim() || submitting}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Verificando com IA...
                    </>
                  ) : (
                    "Verificar resposta"
                  )}
                </button>
              )}
            </article>

            {correction && (
              <CorrectionPanel correction={correction} onRetry={tryAgain} onNext={next} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function CorrectionPanel({
  correction,
  onRetry,
  onNext,
}: {
  correction: Correction;
  onRetry: () => void;
  onNext: () => void;
}) {
  const { score, positive_pt, corrected_text, errors } = correction;

  let scoreClass =
    "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100";
  let scoreLabel = `❌ ${score}/100 — Vamos revisar`;
  if (score >= 80) {
    scoreClass = "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100";
    scoreLabel = `✅ ${score}/100 — Muito bem!`;
  } else if (score >= 50) {
    scoreClass = "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
    scoreLabel = `⚠️ ${score}/100 — Quase lá!`;
  }

  return (
    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`rounded-xl px-4 py-3 font-semibold ${scoreClass}`}>
        {scoreLabel}
        {positive_pt && (
          <p className="mt-1 italic font-normal text-sm opacity-80">{positive_pt}</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-green-500 p-4">
        <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
          Versão corrigida
        </div>
        <p className="font-bold text-gray-900 dark:text-white">{corrected_text}</p>
      </div>

      {errors.length === 0 ? (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-900 rounded-xl p-4 text-green-800 dark:text-green-200 font-medium">
          Perfeito! Nenhum erro encontrado. 🎉
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Erros encontrados:
          </h3>
          <ul className="space-y-3">
            {errors.map((e, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-red-500 line-through">{e.segment}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    {e.corrected}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {e.explanation_pt}
                </p>
                <span className="inline-block mt-1 font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-0.5">
                  {e.rule}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onRetry}
          className="py-2.5 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Tentar novamente
        </button>
        <button
          onClick={onNext}
          className="py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
