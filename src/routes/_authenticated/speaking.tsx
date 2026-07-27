import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { transcribeAudio } from "@/lib/stt.functions";
import { evaluateSpeaking, type SpeakingEvaluation } from "@/lib/evaluate-speaking.functions";
import { AudioRecorder } from "@/components/audio-recorder";
import { LevelPill, type Level } from "@/components/englishup";
import { useLanguage } from "@/hooks/use-language";
import { LANGUAGE_VOICE, type Language } from "@/lib/learning";


export const Route = createFileRoute("/_authenticated/speaking")({
  head: () => ({ meta: [{ title: "Speaking — EnglishUp" }] }),
  component: SpeakingPage,
});

type Exercise = {
  id: string;
  level: Level;
  prompt_pt: string;
  prompt_en: string;
  content: string;
  grammar_focus: string;
};

function SpeakingPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const ttsFn = useServerFn(synthesizeSpeech);
  const sttFn = useServerFn(transcribeAudio);
  const evalFn = useServerFn(evaluateSpeaking);
  const { language } = useLanguage(user.id);

  const [userLevel, setUserLevel] = useState<Level>("beginner");

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [generatingTts, setGeneratingTts] = useState(false);
  const audioUrlRef = useRef<string | null>(null);
  const recentIds = useRef<string[]>([]);

  const loadNext = useCallback(async (level: Level) => {
    setLoading(true);
    setEvaluation(null);
    setTranscript("");
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    try {
      let q = supabase.from("exercises").select("*").eq("mode", "speaking_read").eq("level", level);
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
          .eq("mode", "speaking_read")
          .eq("level", level);
        const arr = (all ?? []) as Exercise[];
        if (arr.length === 0) {
          toast.error("Nenhum exercício de speaking disponível.");
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

  async function playModel() {
    if (!exercise) return;
    setGeneratingTts(true);
    try {
      if (!audioUrlRef.current) {
        const result = await ttsFn({ data: { text: exercise.content, voice: "alloy" } });
        const bin = atob(result.audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.mimeType });
        audioUrlRef.current = URL.createObjectURL(blob);
      }
      const audio = new Audio(audioUrlRef.current);
      await audio.play();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reproduzir");
    } finally {
      setGeneratingTts(false);
    }
  }

  async function handleRecorded(audio: { base64: string; mimeType: string }) {
    if (!exercise) return;
    try {
      const stt = await sttFn({ data: { audioBase64: audio.base64, mimeType: audio.mimeType } });
      if (!stt.text) {
        toast.error("Não entendi sua fala. Tente novamente.");
        return;
      }
      setTranscript(stt.text);
      const evalResult = await evalFn({
        data: {
          transcript: stt.text,
          original: exercise.content,
          mode: "read",
          level: userLevel,
        },
      });
      setEvaluation(evalResult);
      await supabase.from("attempts").insert({
        user_id: user.id,
        exercise_id: exercise.id,
        user_input: stt.text,
        transcript: stt.text,
        correction: evalResult as unknown as never,
        score: evalResult.score,
        grammar_focus: exercise.grammar_focus,
        level: userLevel,
        mode: "speaking_read",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  function next() {
    if (!exercise) return;
    recentIds.current = [exercise.id, ...recentIds.current].slice(0, 3);
    loadNext(userLevel);
  }

  function renderSentenceWithErrors(sentence: string, mispronounced: string[]) {
    const set = new Set(mispronounced.map((w) => w.toLowerCase().replace(/[.,!?;:]/g, "")));
    return sentence.split(/(\s+)/).map((token, i) => {
      const clean = token.toLowerCase().replace(/[.,!?;:]/g, "");
      if (set.has(clean)) {
        return (
          <span key={i} className="text-red-600 dark:text-red-400 font-bold underline decoration-wavy">
            {token}
          </span>
        );
      }
      return <span key={i}>{token}</span>;
    });
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
            <span className="text-2xl">🎤</span>
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
                🎤 Leia em voz alta
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {exercise.prompt_pt}
              </p>

              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 mb-4">
                <p className="text-xl font-bold text-gray-900 dark:text-white leading-relaxed text-center">
                  {evaluation
                    ? renderSentenceWithErrors(exercise.content, evaluation.mispronounced_words)
                    : exercise.content}
                </p>
              </div>

              <button
                onClick={playModel}
                disabled={generatingTts}
                className="w-full mb-5 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50"
              >
                {generatingTts ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Ouvir modelo
              </button>

              {!evaluation && <AudioRecorder onRecorded={handleRecorded} />}
            </article>

            {evaluation && (
              <div className="mt-4 space-y-3">
                <div
                  className={`rounded-xl px-4 py-3 font-semibold ${
                    evaluation.score >= 80
                      ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100"
                      : evaluation.score >= 50
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                      : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100"
                  }`}
                >
                  {evaluation.score >= 80 ? "✅" : evaluation.score >= 50 ? "⚠️" : "❌"}{" "}
                  {evaluation.score}/100 — Precisão {evaluation.accuracy_pct}%
                  <p className="mt-1 italic font-normal text-sm opacity-90">{evaluation.feedback_pt}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Você falou
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{transcript}"</p>
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
