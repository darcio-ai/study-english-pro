import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { LevelPill, type Level } from "@/components/englishup";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import { addXp, checkAndGrantAchievements, TRACK_EMOJI, TRACK_LABEL, type Track } from "@/lib/learning";


export const Route = createFileRoute("/_authenticated/reading")({
  head: () => ({ meta: [{ title: "Leitura — EnglishUp" }] }),
  component: ReadingPage,
});

type ReadingQuestion = { q: string; options: string[]; answer: number; explanation_pt: string };
type ReadingText = {
  id: string;
  level: Level;
  track: Track;
  title: string;
  body: string;
  questions: ReadingQuestion[];
  key_vocabulary: { word: string; pt: string }[] | null;
};

function ReadingPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage(user.id);
  const [track, setTrack] = useState<Track>("sales");
  const [userLevel, setUserLevel] = useState<Level>("beginner");
  const [selectedText, setSelectedText] = useState<ReadingText | null>(null);


  useEffect(() => {
    supabase
      .from("user_progress")
      .select("level, preferred_track")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.level) setUserLevel(data.level as Level);
        if (data?.preferred_track) setTrack(data.preferred_track as Track);
      });
  }, [user.id]);

  const textsQuery = useQuery({
    queryKey: ["reading_texts", track, language],
    queryFn: async (): Promise<ReadingText[]> => {
      const { data, error } = await supabase
        .from("reading_texts")
        .select("*")
        .eq("track", track)
        .eq("language", language)
        .order("level");

      if (error) throw error;
      return (data ?? []) as unknown as ReadingText[];
    },
  });

  if (selectedText) {
    return (
      <ReadingDetail
        text={selectedText}
        onBack={() => setSelectedText(null)}
        userId={user.id}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Leitura 📖</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Compreensão de textos profissionais</p>

        <div className="mb-4">
          <LanguageSwitch value={language} onChange={setLanguage} size="sm" />
        </div>


        <div className="flex gap-2 mb-6">
          {(["sales", "tech"] as Track[]).map((t) => (
            <button
              key={t}
              onClick={() => setTrack(t)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                track === t
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {TRACK_EMOJI[t]} {TRACK_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(textsQuery.data ?? []).map((t) => {
            const tooHard =
              (t.level === "advanced" && userLevel === "beginner") ||
              (t.level === "intermediate" && userLevel === "beginner");
            return (
              <button
                key={t.id}
                onClick={() => setSelectedText(t)}
                className="w-full text-left flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 size-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <BookOpen className="size-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <LevelPill level={t.level} size="sm" />
                    {tooHard && <span className="text-[10px] text-amber-600">acima do seu nível</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                    {t.body.slice(0, 100)}…
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function ReadingDetail({ text, onBack, userId }: { text: ReadingText; onBack: () => void; userId: string }) {
  const [phase, setPhase] = useState<"read" | "quiz" | "done">("read");
  const [answers, setAnswers] = useState<(number | null)[]>(text.questions.map(() => null));
  const [results, setResults] = useState<boolean[]>([]);

  function submit() {
    const r = answers.map((a, i) => a === text.questions[i].answer);
    setResults(r);
    const correct = r.filter(Boolean).length;
    const score = Math.round((correct / text.questions.length) * 100);
    // Persist as attempt
    supabase.from("attempts").insert({
      user_id: userId,
      user_input: JSON.stringify(answers),
      correction: { results: r, score } as never,
      score,
      grammar_focus: `reading: ${text.title}`,
      level: text.level,
      mode: "writing",
      reading_text_id: text.id,
    }).then(() => addXp(userId, Math.round(score / 5)));
    if (correct === text.questions.length) toast.success("Acertou tudo! 🎉");
    checkAndGrantAchievements(userId);
    setPhase("done");
  }

  async function saveWord(word: string, pt: string) {
    const { error } = await supabase.from("user_vocabulary").upsert({
      user_id: userId,
      word_en: word.toLowerCase(),
      translation_pt: pt,
      context_sentence: text.body.split(/[.!?]/).find((s) => s.toLowerCase().includes(word.toLowerCase())) ?? null,
    }, { onConflict: "user_id,word_en" });
    if (error) return toast.error("Erro ao salvar");
    toast.success(`"${word}" salva`);
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <ArrowLeft className="size-4" /> Textos
        </button>

        <div className="flex items-center gap-2 mb-3">
          <LevelPill level={text.level} size="sm" />
          <span className="text-xs text-gray-500">{TRACK_LABEL[text.track]}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{text.title}</h1>

        {phase === "read" && (
          <>
            <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
              <p className="text-base text-gray-900 dark:text-white leading-relaxed whitespace-pre-line">{text.body}</p>
            </article>

            {text.key_vocabulary && text.key_vocabulary.length > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 mb-4">
                <h3 className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300 mb-2">
                  📚 Vocabulário-chave
                </h3>
                <ul className="space-y-1.5">
                  {text.key_vocabulary.map((v, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="font-semibold text-gray-900 dark:text-white">{v.word}</span>
                        <span className="text-gray-500 dark:text-gray-400"> — {v.pt}</span>
                      </span>
                      <button
                        onClick={() => saveWord(v.word, v.pt)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + salvar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setPhase("quiz")}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              Responder perguntas →
            </button>
          </>
        )}

        {phase === "quiz" && (
          <div className="space-y-4">
            {text.questions.map((q, qi) => (
              <div key={qi} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="font-semibold text-gray-900 dark:text-white mb-3">
                  {qi + 1}. {q.q}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => {
                        const next = [...answers];
                        next[qi] = oi;
                        setAnswers(next);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border-2 text-sm transition-all ${
                        answers[qi] === oi
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submit}
              disabled={answers.some((a) => a === null)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold"
            >
              Conferir respostas
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center">
              <p className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {results.filter(Boolean).length}/{text.questions.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">corretas</p>
            </div>
            {text.questions.map((q, qi) => {
              const ok = results[qi];
              const userIdx = answers[qi];
              return (
                <div
                  key={qi}
                  className={`rounded-xl border p-4 ${
                    ok
                      ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {ok ? (
                      <Check className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{q.q}</p>
                  </div>
                  {!ok && userIdx !== null && (
                    <p className="text-xs text-red-700 dark:text-red-300 mb-1">
                      Sua resposta: <span className="line-through">{q.options[userIdx]}</span>
                    </p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                    Correta: <span className="font-semibold">{q.options[q.answer]}</span>
                  </p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic">{q.explanation_pt}</p>
                </div>
              );
            })}
            <button
              onClick={onBack}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              Outro texto →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
