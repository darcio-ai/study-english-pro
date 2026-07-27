import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PLACEMENT_QUESTIONS, calculateLevel } from "@/lib/placement-questions";
import { LEVEL_LABEL, type Level } from "@/components/englishup";

export const Route = createFileRoute("/_authenticated/placement")({
  head: () => ({ meta: [{ title: "Teste de Nível — EnglishUp" }] }),
  component: PlacementPage,
});

function PlacementPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [finalLevel, setFinalLevel] = useState<Level | null>(null);
  const [saving, setSaving] = useState(false);

  const total = PLACEMENT_QUESTIONS.length;
  const q = PLACEMENT_QUESTIONS[index];
  const progress = ((index + (selected !== null ? 1 : 0)) / total) * 100;

  async function finalize(allAnswers: number[]) {
    setSaving(true);
    let correct = 0;
    allAnswers.forEach((a, i) => {
      if (a === PLACEMENT_QUESTIONS[i].answer) correct += 1;
    });
    const level = calculateLevel(correct);

    const { data: prog } = await supabase
      .from("user_progress")
      .select("preferred_language")
      .eq("user_id", user.id)
      .maybeSingle();
    const lang = prog?.preferred_language === "es" ? "es" : "en";

    const { error: pErr } = await supabase
      .from("user_progress")
      .update({ level })
      .eq("user_id", user.id);
    const { error: prErr } = await supabase
      .from("profiles")
      .update({ placement_done: true })
      .eq("user_id", user.id);

    // Seed every free-practice skill with the placement result; the user can
    // refine each one later on its own practice screen.
    await supabase.from("user_skill_levels").upsert(
      (["writing", "listening", "speaking", "reading"] as const).map((skill) => ({
        user_id: user.id,
        language: lang,
        skill,
        level,
      })),
      { onConflict: "user_id,language,skill" },
    );
    if (typeof window !== "undefined") {
      for (const skill of ["writing", "listening", "speaking", "reading"]) {
        window.localStorage.setItem(`skill_level_${lang}_${skill}`, level);
      }
    }

    if (pErr || prErr) toast.error("Erro ao salvar resultado");
    setFinalLevel(level);
    setFinished(true);
    setSaving(false);
  }

  function onConfirm() {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);
    if (index + 1 >= total) {
      finalize(newAnswers);
    } else {
      setIndex(index + 1);
    }
  }

  if (finished && finalLevel) {
    const correct = answers.filter((a, i) => a === PLACEMENT_QUESTIONS[i].answer).length;
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
            <Trophy className="size-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Teste concluído! 🎉
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Você acertou <span className="font-semibold">{correct}/{total}</span>
          </p>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
              Seu nível
            </p>
            <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300">
              {LEVEL_LABEL[finalLevel]}
            </p>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-2">
              {finalLevel === "beginner" && "Vamos começar com o básico — você está no caminho certo!"}
              {finalLevel === "intermediate" && "Bom domínio do inglês! Vamos aperfeiçoar."}
              {finalLevel === "advanced" && "Excelente! Vamos focar em fluência e nuances."}
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/exercise" })}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Começar a praticar →
          </button>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="mt-2 w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Ir para o dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
              Teste de Nível
            </h1>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {index + 1} / {total}
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
            {q.level} · {q.focus}
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-5 leading-snug">
            {q.question}
          </p>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const active = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all min-h-[52px] flex items-center gap-3 ${
                    active
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 size-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 dark:border-gray-600 text-gray-500"
                    }`}
                  >
                    {active ? <CheckCircle2 className="size-4" /> : String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm font-medium">{opt}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onConfirm}
            disabled={selected === null || saving}
            className="mt-5 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {saving ? "Calculando..." : index + 1 >= total ? "Finalizar teste" : "Próxima"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          Responda com calma. Você não pode voltar às questões anteriores.
        </p>
      </div>
    </main>
  );
}
