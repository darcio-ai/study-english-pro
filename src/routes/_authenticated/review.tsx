import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { correctGrammar, type Correction } from "@/lib/correct-grammar.functions";
import { upsertReviewQueue, addXp, xpForScore, checkAndGrantAchievements } from "@/lib/learning";
import { LevelPill, type Level } from "@/components/englishup";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Revisão — EnglishUp" }] }),
  component: ReviewPage,
});

type ReviewItem = {
  id: string;
  exercise_id: string;
  last_score: number;
  interval_days: number;
  exercises: {
    id: string;
    level: Level;
    prompt_pt: string;
    prompt_en: string;
    content: string | null;
    audio_script: string | null;
    grammar_focus: string;
    mode: string;
  };
};

function ReviewPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const correctFn = useServerFn(correctGrammar);

  const [idx, setIdx] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reviewQuery = useQuery({
    queryKey: ["review_due", user.id],
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data, error } = await supabase
        .from("review_queue")
        .select("id, exercise_id, last_score, interval_days, exercises(id, level, prompt_pt, prompt_en, content, audio_script, grammar_focus, mode)")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .order("next_review_at")
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewItem[];
    },
  });

  const items = reviewQuery.data ?? [];
  const item = items[idx];

  useEffect(() => {
    setUserInput("");
    setCorrection(null);
  }, [idx]);

  async function onCheck() {
    if (!item || !userInput.trim()) return;
    setSubmitting(true);
    try {
      const ex = item.exercises;
      const targetEn =
        ex.mode === "listening"
          ? `Listening dictation. Expected: "${ex.audio_script}"`
          : ex.prompt_en;
      const result = await correctFn({
        data: {
          userInput: userInput.trim(),
          exercisePromptEn: targetEn,
          exerciseContent: ex.audio_script ?? ex.content,
          grammarFocus: ex.grammar_focus,
          level: ex.level,
        },
      });
      setCorrection(result);
      await supabase.from("attempts").insert({
        user_id: user.id,
        exercise_id: ex.id,
        user_input: userInput,
        correction: result as never,
        score: result.score,
        grammar_focus: ex.grammar_focus,
        level: ex.level,
        mode: ex.mode,
      });
      await upsertReviewQueue({
        userId: user.id,
        exerciseId: ex.id,
        score: result.score,
        asReview: true,
      });
      await addXp(user.id, xpForScore(result.score) + 5); // bonus for reviewing
      await checkAndGrantAchievements(user.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (idx + 1 >= items.length) {
      toast.success("Revisão concluída! 🎉");
      queryClient.invalidateQueries({ queryKey: ["review_due", user.id] });
      navigate({ to: "/dashboard" });
    } else {
      setIdx(idx + 1);
    }
  }

  if (reviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="size-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tudo em dia!</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            Nenhuma revisão pendente. Continue praticando para criar novos itens.
          </p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Voltar ao dashboard
          </button>
        </div>
      </main>
    );
  }

  const ex = item.exercises;
  const isListening = ex.mode === "listening";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </button>

        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="size-5 text-amber-500" />
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
            Revisão {idx + 1} de {items.length}
          </h1>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-amber-400 border-y border-r border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-400">
              🔁 Revisão · {ex.grammar_focus}
            </span>
            <LevelPill level={ex.level} size="sm" />
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Você teve {item.last_score}/100 nesta antes. Vamos revisar!
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{ex.prompt_pt}</p>
          {!isListening && (
            <p className="text-base font-bold text-gray-900 dark:text-white mb-3">{ex.prompt_en}</p>
          )}
          {ex.content && !isListening && (
            <div className="mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.content}</p>
            </div>
          )}
          {isListening && ex.audio_script && (
            <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm">
              <p className="text-[11px] font-semibold uppercase text-amber-700 mb-1">Frase original (revisão)</p>
              <p className="text-gray-900 dark:text-white font-medium">{ex.audio_script}</p>
            </div>
          )}

          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={!!correction}
            rows={3}
            placeholder="Sua resposta..."
            className="w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base disabled:opacity-70"
          />

          {!correction ? (
            <button
              onClick={onCheck}
              disabled={!userInput.trim() || submitting}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium"
            >
              {submitting ? <><Loader2 className="size-4 animate-spin" /> Verificando...</> : "Verificar"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className={`rounded-xl px-4 py-3 font-semibold ${
                correction.score >= 80
                  ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100"
                  : correction.score >= 50
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                  : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100"
              }`}>
                {correction.score}/100
                {correction.positive_pt && (
                  <p className="mt-1 italic font-normal text-sm opacity-90">{correction.positive_pt}</p>
                )}
              </div>
              {correction.corrected_text !== userInput && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-green-500 p-4">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Versão ideal</div>
                  <p className="font-bold text-gray-900 dark:text-white">{correction.corrected_text}</p>
                </div>
              )}
              <button
                onClick={next}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {idx + 1 >= items.length ? "Finalizar revisão" : "Próxima revisão →"}
              </button>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
