import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Volume2, Check, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { nextInterval } from "@/lib/learning";

export const Route = createFileRoute("/_authenticated/vocabulary")({
  head: () => ({ meta: [{ title: "Vocabulário — EnglishUp" }] }),
  component: VocabularyPage,
});

type VocabCard = {
  id: string;
  word_en: string;
  translation_pt: string | null;
  context_sentence: string | null;
  interval_days: number;
  next_review_at: string;
  review_count: number;
};

function VocabularyPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ttsFn = useServerFn(synthesizeSpeech);
  const [mode, setMode] = useState<"list" | "review">("list");
  const [flipped, setFlipped] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const vocabQuery = useQuery({
    queryKey: ["vocabulary", user.id],
    queryFn: async (): Promise<VocabCard[]> => {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VocabCard[];
    },
  });

  const allCards = vocabQuery.data ?? [];
  const now = Date.now();
  const dueCards = allCards.filter((c) => new Date(c.next_review_at).getTime() <= now);
  const reviewCards = mode === "review" ? dueCards : [];
  const current = reviewCards[reviewIdx];

  async function playWord(word: string) {
    setPlaying(true);
    try {
      const result = await ttsFn({ data: { text: word, voice: "alloy" } });
      const bin = atob(result.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } catch {
      toast.error("Erro ao reproduzir");
    } finally {
      setPlaying(false);
    }
  }

  async function recordReview(success: boolean) {
    if (!current) return;
    const next = nextInterval(current.interval_days, success);
    await supabase
      .from("user_vocabulary")
      .update({
        interval_days: next,
        next_review_at: new Date(Date.now() + next * 86400000).toISOString(),
        review_count: current.review_count + 1,
        ease: success ? 1 : -1,
      })
      .eq("id", current.id);
    if (reviewIdx + 1 >= reviewCards.length) {
      toast.success("Revisão concluída! 🎉");
      setMode("list");
      setReviewIdx(0);
      setFlipped(false);
      queryClient.invalidateQueries({ queryKey: ["vocabulary", user.id] });
    } else {
      setReviewIdx(reviewIdx + 1);
      setFlipped(false);
    }
  }

  async function deleteCard(id: string) {
    await supabase.from("user_vocabulary").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["vocabulary", user.id] });
  }

  if (mode === "review" && current) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 flex flex-col">
        <button
          onClick={() => { setMode("list"); setReviewIdx(0); setFlipped(false); }}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Sair da revisão
        </button>
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          <p className="text-center text-xs text-gray-500 mb-3">
            Card {reviewIdx + 1} de {reviewCards.length}
          </p>

          <button
            onClick={() => setFlipped(!flipped)}
            className="flex-1 min-h-[280px] bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 p-6 flex flex-col items-center justify-center text-center hover:border-indigo-400 transition-all"
          >
            {!flipped ? (
              <>
                <p className="text-4xl font-extrabold text-gray-900 dark:text-white mb-3">{current.word_en}</p>
                <p className="text-xs text-gray-400">Toque para ver a tradução</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">
                  {current.translation_pt ?? "(sem tradução)"}
                </p>
                {current.context_sentence && (
                  <p className="text-sm italic text-gray-600 dark:text-gray-400 mt-2">
                    "{current.context_sentence}"
                  </p>
                )}
              </>
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); playWord(current.word_en); }}
            disabled={playing}
            className="mt-4 inline-flex items-center justify-center gap-2 mx-auto py-2 px-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
          >
            {playing ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
            Ouvir pronúncia
          </button>

          {flipped && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => recordReview(false)}
                className="py-3 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 font-semibold inline-flex items-center justify-center gap-2"
              >
                <X className="size-5" /> Esqueci
              </button>
              <button
                onClick={() => recordReview(true)}
                className="py-3 rounded-xl bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 font-semibold inline-flex items-center justify-center gap-2"
              >
                <Check className="size-5" /> Lembrei
              </button>
            </div>
          )}
        </div>
      </main>
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

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Vocabulário 🧠</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {allCards.length} palavras · {dueCards.length} para revisar
        </p>

        {dueCards.length > 0 && (
          <button
            onClick={() => { setMode("review"); setReviewIdx(0); setFlipped(false); }}
            className="w-full py-3 mb-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Revisar {dueCards.length} card{dueCards.length > 1 ? "s" : ""} →
          </button>
        )}

        {allCards.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">Nenhuma palavra salva ainda.</p>
            <p className="text-xs text-gray-500">
              Use o botão "Salvar palavra" durante os exercícios.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allCards.map((c) => {
              const isDue = new Date(c.next_review_at).getTime() <= Date.now();
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{c.word_en}</span>
                      {isDue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">due</span>}
                    </div>
                    {c.translation_pt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.translation_pt}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteCard(c.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
