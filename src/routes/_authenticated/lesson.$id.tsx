import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play, Trophy, Bookmark } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { correctGrammar, type Correction } from "@/lib/correct-grammar.functions";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { transcribeAudio } from "@/lib/stt.functions";
import { evaluateSpeaking, type SpeakingEvaluation } from "@/lib/evaluate-speaking.functions";
import { AudioRecorder } from "@/components/audio-recorder";
import { LevelPill, type Level } from "@/components/englishup";
import {
  upsertReviewQueue,
  addXp,
  xpForScore,
  checkAndGrantAchievements,
  LANGUAGE_VOICE,
  type Language,
} from "@/lib/learning";


export const Route = createFileRoute("/_authenticated/lesson/$id")({
  head: () => ({ meta: [{ title: "Lição — EnglishUp" }] }),
  component: LessonRunner,
});

type Exercise = {
  id: string;
  level: Level;
  mode: "writing" | "listening" | "speaking_read" | "speaking_free";
  prompt_pt: string;
  prompt_en: string;
  content: string | null;
  audio_script: string | null;
  expected_response: string | null;
  grammar_focus: string;
  lesson_order: number | null;
};

type Lesson = {
  id: string;
  title: string;
  description_pt: string;
  grammar_focus: string;
  emoji: string;
  level: Level;
  language: Language;
};


const MODE_EMOJI: Record<Exercise["mode"], string> = {
  writing: "📝",
  listening: "🎧",
  speaking_read: "🎤",
  speaking_free: "💬",
};
const MODE_LABEL: Record<Exercise["mode"], string> = {
  writing: "Escrita",
  listening: "Listening",
  speaking_read: "Pronúncia",
  speaking_free: "Conversação",
};

function LessonRunner() {
  const { id: lessonId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const correctFn = useServerFn(correctGrammar);
  const ttsFn = useServerFn(synthesizeSpeech);
  const sttFn = useServerFn(transcribeAudio);
  const evalFn = useServerFn(evaluateSpeaking);

  const [index, setIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [savedWord, setSavedWord] = useState(false);
  const audioUrlRef = useRef<string | null>(null);

  const lessonQuery = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async (): Promise<Lesson> => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, description_pt, grammar_focus, emoji, level, language")
        .eq("id", lessonId)
        .single();
      if (error) throw error;
      return data as Lesson;
    },
  });

  const exercisesQuery = useQuery({
    queryKey: ["lesson_exercises", lessonId],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, level, mode, prompt_pt, prompt_en, content, audio_script, expected_response, grammar_focus, lesson_order")
        .eq("lesson_id", lessonId)
        .order("lesson_order");
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  const lessonLanguage: Language = lessonQuery.data?.language === "es" ? "es" : "en";
  const exercises = exercisesQuery.data ?? [];
  const exercise = exercises[index];

  const total = exercises.length;

  // Reset transient state when exercise changes
  useEffect(() => {
    setUserInput("");
    setCorrection(null);
    setEvaluation(null);
    setTranscript("");
    setSavedWord(false);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, [index]);

  const persistAttempt = useCallback(
    async (score: number, payload: object, input: string, mode: Exercise["mode"]) => {
      if (!exercise) return;
      await supabase.from("attempts").insert({
        user_id: user.id,
        exercise_id: exercise.id,
        user_input: input,
        correction: payload as never,
        score,
        grammar_focus: exercise.grammar_focus,
        level: exercise.level,
        mode,
        transcript: mode.startsWith("speaking") ? input : null,
      });
      await upsertReviewQueue({ userId: user.id, exerciseId: exercise.id, score });
      await addXp(user.id, xpForScore(score));
      setScores((s) => [...s, score]);
    },
    [exercise, user.id],
  );

  async function onCheckWriting() {
    if (!exercise || !userInput.trim()) return;
    setSubmitting(true);
    try {
      const targetEn =
        exercise.mode === "listening"
          ? `Listening dictation. Expected: "${exercise.audio_script}"`
          : exercise.prompt_en;
      const result = await correctFn({
        data: {
          userInput: userInput.trim(),
          exercisePromptEn: targetEn,
          exerciseContent: exercise.audio_script ?? exercise.content,
          grammarFocus: exercise.grammar_focus,
          level: exercise.level,
          language: lessonLanguage,

        },
      });
      setCorrection(result);
      await persistAttempt(result.score, result, userInput.trim(), exercise.mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function playAudio(text: string) {
    setPlaying(true);
    try {
      if (!audioUrlRef.current) {
        const result = await ttsFn({ data: { text, voice: LANGUAGE_VOICE[lessonLanguage] } });
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
      setPlaying(false);
    }
  }

  async function handleRecorded(audio: { base64: string; mimeType: string }) {
    if (!exercise) return;
    setSubmitting(true);
    try {
      const stt = await sttFn({
        data: { audioBase64: audio.base64, mimeType: audio.mimeType, language: lessonLanguage },
      });

      if (!stt.text) {
        toast.error("Não entendi sua fala.");
        setSubmitting(false);
        return;
      }
      setTranscript(stt.text);
      const isRead = exercise.mode === "speaking_read";
      const result = await evalFn({
        data: {
          transcript: stt.text,
          original: isRead ? (exercise.content ?? "") : (exercise.expected_response ?? ""),
          mode: isRead ? "read" : "free",
          level: exercise.level,
          promptEn: exercise.prompt_en,
          language: lessonLanguage,
        },

      });
      setEvaluation(result);
      await persistAttempt(result.score, result, stt.text, exercise.mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextExercise() {
    if (index + 1 >= total) {
      // Lesson complete
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1));
      await supabase.from("user_lesson_progress").upsert({
        user_id: user.id,
        lesson_id: lessonId,
        exercises_done: total,
        total_exercises: total,
        avg_score: avg,
        completed_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" });
      await checkAndGrantAchievements(user.id);
      setDone(true);
    } else {
      // Track in-progress
      await supabase.from("user_lesson_progress").upsert({
        user_id: user.id,
        lesson_id: lessonId,
        exercises_done: index + 1,
        total_exercises: total,
        avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1)) || null,
      }, { onConflict: "user_id,lesson_id" });
      setIndex(index + 1);
    }
  }

  async function saveCurrentWord() {
    if (!exercise || savedWord) return;
    // Save first non-trivial word from the exercise text as the user's flashcard
    const source = exercise.content ?? exercise.audio_script ?? exercise.expected_response ?? exercise.prompt_en;
    if (!source) return;
    const word = source.split(/\s+/).find((w) => w.length > 4 && /^[A-Za-z]+$/.test(w))?.toLowerCase();
    if (!word) {
      toast.info("Sem palavra para salvar neste exercício");
      return;
    }
    const { error } = await supabase.from("user_vocabulary").upsert({
      user_id: user.id,
      word_en: word,
      context_sentence: source,
      source_exercise_id: exercise.id,
    }, { onConflict: "user_id,word_en" });
    if (error) {
      toast.error("Erro ao salvar palavra");
      return;
    }
    setSavedWord(true);
    toast.success(`"${word}" salva no seu vocabulário`);
  }

  if (lessonQuery.isLoading || exercisesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!exercise && !done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Esta lição ainda não tem exercícios.</p>
          <button onClick={() => navigate({ to: "/lessons" })} className="text-indigo-600 hover:underline">
            Voltar para lições
          </button>
        </div>
      </main>
    );
  }

  if (done) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1));
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="mx-auto size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Trophy className="size-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Lição concluída! 🎉</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{lessonQuery.data?.title}</p>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-4 mb-5">
            <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Sua nota média</p>
            <p className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">{avg}/100</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
              +{scores.reduce((s, score) => s + xpForScore(score), 0)} XP
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/lessons" })}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Próxima lição →
          </button>
          <button
            onClick={restartLesson}
            className="mt-2 w-full py-3 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-center gap-2"
          >
            <RotateCcw className="size-4" /> Refazer lição
          </button>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="mt-2 w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Dashboard
          </button>

        </div>
      </main>
    );
  }

  const answered = !!correction || !!evaluation;
  const progressPercent = ((index + (answered ? 1 : 0)) / total) * 100;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => navigate({ to: "/lessons" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-3"
        >
          <ArrowLeft className="size-4" /> Sair da lição
        </button>

        {/* Lesson header + progress bar */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{lessonQuery.data?.emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {lessonQuery.data?.title}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Exercício {index + 1} de {total}
              </p>
            </div>
            <span className="text-xl">{MODE_EMOJI[exercise.mode]}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">
              {MODE_LABEL[exercise.mode]} · {exercise.grammar_focus}
            </span>
            <LevelPill level={exercise.level} size="sm" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{exercise.prompt_pt}</p>
          {exercise.mode !== "listening" && (
            <p className="text-base font-bold text-gray-900 dark:text-white mb-3">{exercise.prompt_en}</p>
          )}

          {/* WRITING-style content shown */}
          {exercise.mode === "writing" && exercise.content && (
            <div className="mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{exercise.content}</p>
            </div>
          )}

          {/* LISTENING button */}
          {exercise.mode === "listening" && exercise.audio_script && (
            <button
              onClick={() => playAudio(exercise.audio_script!)}
              disabled={playing || answered}
              className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold mb-3"
            >
              {playing ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5 fill-current" />}
              Ouvir frase
            </button>
          )}

          {/* SPEAKING_READ content */}
          {exercise.mode === "speaking_read" && exercise.content && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 mb-3">
              <p className="text-lg font-bold text-gray-900 dark:text-white text-center leading-relaxed">
                {renderWithErrors(exercise.content, evaluation?.mispronounced_words ?? [])}
              </p>
            </div>
          )}

          {/* SPEAKING_FREE suggested structure */}
          {exercise.mode === "speaking_free" && exercise.expected_response && !evaluation && (
            <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
              <p className="text-[11px] font-semibold uppercase text-gray-500 mb-1">💡 Estrutura sugerida</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">{exercise.expected_response}</p>
            </div>
          )}

          {/* INPUT — writing or listening */}
          {(exercise.mode === "writing" || exercise.mode === "listening") && (
            <>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={answered}
                rows={3}
                placeholder={exercise.mode === "listening" ? "Escreva o que você ouviu..." : "Escreva sua resposta em inglês..."}
                className="w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base disabled:opacity-70"
              />
              {!answered && (
                <button
                  onClick={onCheckWriting}
                  disabled={!userInput.trim() || submitting}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium"
                >
                  {submitting ? <><Loader2 className="size-4 animate-spin" /> Verificando...</> : "Verificar"}
                </button>
              )}
            </>
          )}

          {/* SPEAKING input */}
          {(exercise.mode === "speaking_read" || exercise.mode === "speaking_free") && !evaluation && (
            <>
              {exercise.mode === "speaking_read" && exercise.content && (
                <button
                  onClick={() => playAudio(exercise.content!)}
                  disabled={playing}
                  className="w-full mb-3 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 font-medium disabled:opacity-50"
                >
                  {playing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  Ouvir modelo
                </button>
              )}
              {submitting ? (
                <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
                  <Loader2 className="size-5 animate-spin" /> Avaliando...
                </div>
              ) : (
                <AudioRecorder onRecorded={handleRecorded} />
              )}
            </>
          )}
        </article>

        {/* Result panel */}
        {(correction || evaluation) && (
          <ResultPanel
            score={(correction?.score ?? evaluation?.score) ?? 0}
            feedback={correction?.positive_pt ?? evaluation?.feedback_pt ?? ""}
            corrected={correction?.corrected_text ?? evaluation?.corrected_text ?? ""}
            userText={correction ? userInput : transcript}
            errors={correction?.errors}
            isLastExercise={index + 1 >= total}
            onSaveWord={saveCurrentWord}
            saved={savedWord}
            onNext={nextExercise}
          />
        )}
      </div>
    </main>
  );
}

function renderWithErrors(sentence: string, mispronounced: string[]) {
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

function ResultPanel(props: {
  score: number;
  feedback: string;
  corrected: string;
  userText: string;
  errors?: Correction["errors"];
  isLastExercise: boolean;
  onSaveWord: () => void;
  saved: boolean;
  onNext: () => void;
}) {
  const { score, feedback, corrected, userText, errors, isLastExercise, onSaveWord, saved, onNext } = props;
  const cls =
    score >= 80
      ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100"
      : score >= 50
      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
      : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100";
  return (
    <div className="mt-4 space-y-3">
      <div className={`rounded-xl px-4 py-3 font-semibold ${cls}`}>
        {score >= 80 ? "✅" : score >= 50 ? "⚠️" : "❌"} {score}/100
        {feedback && <p className="mt-1 italic font-normal text-sm opacity-90">{feedback}</p>}
      </div>
      {corrected && corrected !== userText && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-green-500 p-4">
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Versão ideal</div>
          <p className="font-bold text-gray-900 dark:text-white">{corrected}</p>
        </div>
      )}
      {errors && errors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Erros</h3>
          <ul className="space-y-2">
            {errors.map((e, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-red-500 line-through">{e.segment}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">{e.corrected}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">{e.explanation_pt}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onSaveWord}
          disabled={saved}
          className="py-2.5 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center justify-center gap-1.5 hover:bg-gray-50 disabled:opacity-60"
        >
          <Bookmark className={`size-4 ${saved ? "fill-current text-indigo-500" : ""}`} />
          {saved ? "Salva" : "Salvar palavra"}
        </button>
        <button
          onClick={onNext}
          className="py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
        >
          {isLastExercise ? "Finalizar lição 🏆" : "Próximo →"}
        </button>
      </div>
    </div>
  );
}
