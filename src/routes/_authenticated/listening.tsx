import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { correctGrammar, type Correction } from "@/lib/correct-grammar.functions";
import { LevelPill, type Level } from "@/components/englishup";
import { useLanguage } from "@/hooks/use-language";
import { LANGUAGE_VOICE, type Language } from "@/lib/learning";


export const Route = createFileRoute("/_authenticated/listening")({
  head: () => ({ meta: [{ title: "Listening — EnglishUp" }] }),
  component: ListeningPage,
});

type Exercise = {
  id: string;
  level: Level;
  prompt_pt: string;
  prompt_en: string;
  audio_script: string;
  grammar_focus: string;
};

const MAX_PLAYS = 3;

function ListeningPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const ttsFn = useServerFn(synthesizeSpeech);
  const correctFn = useServerFn(correctGrammar);

  const [userLevel, setUserLevel] = useState<Level>("beginner");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [plays, setPlays] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recentIds = useRef<string[]>([]);

  const loadNext = useCallback(async (level: Level) => {
    setLoading(true);
    setCorrection(null);
    setUserInput("");
    setPlays(0);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    try {
      let q = supabase.from("exercises").select("*").eq("mode", "listening").eq("level", level);
      if (recentIds.current.length > 0) {
        q = q.not("id", "in", `(${recentIds.current.join(",")})`);
      }
      const { data, error } = await q.limit(50);
      if (error) throw error;
      const list = (data ?? []) as Exercise[];
      if (list.length === 0) {
        recentIds.current = [];
        const { data: all } = await supabase
          .from("exercises")
          .select("*")
          .eq("mode", "listening")
          .eq("level", level);
        const arr = (all ?? []) as Exercise[];
        if (arr.length === 0) {
          toast.error("Nenhum exercício de listening disponível para este nível.");
          return;
        }
        setExercise(arr[Math.floor(Math.random() * arr.length)]);
      } else {
        setExercise(list[Math.floor(Math.random() * list.length)]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const lvl = (data?.level as Level) ?? "beginner";
      setUserLevel(lvl);
      loadNext(lvl);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, loadNext]);

  async function playAudio() {
    if (!exercise || plays >= MAX_PLAYS) return;
    setGenerating(true);
    try {
      if (!audioUrlRef.current) {
        const result = await ttsFn({ data: { text: exercise.audio_script, voice: "alloy" } });
        const bin = atob(result.audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.mimeType });
        audioUrlRef.current = URL.createObjectURL(blob);
      }
      const audio = new Audio(audioUrlRef.current);
      await audio.play();
      setPlays((p) => p + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reproduzir");
    } finally {
      setGenerating(false);
    }
  }

  async function onCheck() {
    if (!exercise || !userInput.trim()) return;
    setSubmitting(true);
    try {
      const result = await correctFn({
        data: {
          userInput: userInput.trim(),
          exercisePromptEn: `Listening dictation. Expected: "${exercise.audio_script}"`,
          exerciseContent: exercise.audio_script,
          grammarFocus: exercise.grammar_focus,
          level: userLevel,
        },
      });
      setCorrection(result);
      await supabase.from("attempts").insert({
        user_id: user.id,
        exercise_id: exercise.id,
        user_input: userInput,
        correction: result as unknown as never,
        score: result.score,
        grammar_focus: exercise.grammar_focus,
        level: userLevel,
        mode: "listening",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function next() {
    if (!exercise) return;
    recentIds.current = [exercise.id, ...recentIds.current].slice(0, 3);
    loadNext(userLevel);
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎧</span>
            <LevelPill level={userLevel} size="sm" />
          </div>
        </div>

        {loading || !exercise ? (
          <div className="flex justify-center py-20 text-gray-500">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                🎧 Listening
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {exercise.prompt_pt}
              </p>

              <button
                onClick={playAudio}
                disabled={plays >= MAX_PLAYS || generating || !!correction}
                className="w-full inline-flex items-center justify-center gap-3 py-5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-lg transition-colors"
              >
                {generating ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Play className="size-6 fill-current" />
                )}
                {plays === 0 ? "Ouvir frase" : `Ouvir novamente (${plays}/${MAX_PLAYS})`}
              </button>
              {plays >= MAX_PLAYS && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Limite de reproduções atingido
                </p>
              )}

              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={!!correction || plays === 0}
                rows={3}
                placeholder={plays === 0 ? "Ouça primeiro, depois escreva o que ouviu" : "Escreva o que você ouviu..."}
                className="mt-4 w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[80px] text-base disabled:opacity-70"
              />

              {!correction && (
                <button
                  onClick={onCheck}
                  disabled={!userInput.trim() || submitting}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Verificando...
                    </>
                  ) : (
                    "Verificar"
                  )}
                </button>
              )}
            </article>

            {correction && (
              <div className="mt-4 space-y-3">
                <div
                  className={`rounded-xl px-4 py-3 font-semibold ${
                    correction.score >= 80
                      ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100"
                      : correction.score >= 50
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                      : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100"
                  }`}
                >
                  {correction.score >= 80 ? "✅" : correction.score >= 50 ? "⚠️" : "❌"}{" "}
                  {correction.score}/100
                  {correction.positive_pt && (
                    <p className="mt-1 italic font-normal text-sm opacity-80">{correction.positive_pt}</p>
                  )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-green-500 p-4">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Frase correta
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white">{exercise.audio_script}</p>
                </div>
                <button
                  onClick={next}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Próximo →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
