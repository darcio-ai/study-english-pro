import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { suggestLevelChange } from "@/lib/learning";
import { LevelPill, type Level } from "@/components/englishup";

export const Route = createFileRoute("/_authenticated/weaknesses")({
  head: () => ({ meta: [{ title: "Mural de Fraquezas — EnglishUp" }] }),
  component: WeaknessesPage,
});

type AttemptRow = {
  score: number | null;
  grammar_focus: string | null;
  mode: string | null;
  created_at: string;
};

function WeaknessesPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const attemptsQuery = useQuery({
    queryKey: ["weaknesses_attempts", user.id],
    queryFn: async (): Promise<AttemptRow[]> => {
      const { data, error } = await supabase
        .from("attempts")
        .select("score, grammar_focus, mode, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AttemptRow[];
    },
  });

  const progressQuery = useQuery({
    queryKey: ["weakness_progress", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const attempts = attemptsQuery.data ?? [];
  const currentLevel = (progressQuery.data?.level as Level) ?? "beginner";

  // Group by grammar focus
  const focusMap = new Map<string, { total: number; sum: number; count: number }>();
  for (const a of attempts) {
    if (!a.grammar_focus || a.score === null) continue;
    const entry = focusMap.get(a.grammar_focus) ?? { total: 0, sum: 0, count: 0 };
    entry.sum += a.score;
    entry.count += 1;
    entry.total = a.score;
    focusMap.set(a.grammar_focus, entry);
  }
  const weaknesses = Array.from(focusMap.entries())
    .map(([focus, { sum, count }]) => ({ focus, avg: Math.round(sum / count), count }))
    .filter((w) => w.count >= 2)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);

  // Skill breakdown
  const modeMap = new Map<string, { sum: number; count: number }>();
  for (const a of attempts) {
    if (a.score === null) continue;
    const m = a.mode ?? "writing";
    const entry = modeMap.get(m) ?? { sum: 0, count: 0 };
    entry.sum += a.score;
    entry.count += 1;
    modeMap.set(m, entry);
  }
  const modeStats = Array.from(modeMap.entries()).map(([mode, { sum, count }]) => ({
    mode,
    avg: Math.round(sum / count),
    count,
  }));

  const scores = attempts.map((a) => a.score ?? 0);
  const suggestion = suggestLevelChange(scores, currentLevel);

  const modeLabel: Record<string, string> = {
    writing: "✏️ Escrita",
    listening: "🎧 Listening",
    speaking_read: "🎤 Pronúncia",
    speaking_free: "💬 Conversação",
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Pontos a melhorar 🎯</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Baseado nas suas últimas 100 tentativas</p>

        {/* Level suggestion */}
        {suggestion && (
          <div className={`rounded-xl border-2 p-4 mb-6 ${
            suggestion === "up"
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
          }`}>
            <div className="flex items-start gap-3">
              {suggestion === "up" ? (
                <TrendingUp className="size-6 text-green-600" />
              ) : (
                <TrendingDown className="size-6 text-amber-600" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {suggestion === "up" ? "Você está pronto para subir!" : "Talvez seja melhor revisar fundamentos"}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {suggestion === "up"
                    ? "Suas últimas notas estão altas. Que tal um desafio maior?"
                    : "Suas notas indicam que um nível mais fácil ajudaria."}
                </p>
                <Link to="/dashboard" className="inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2">
                  Ajustar nível →
                </Link>
              </div>
            </div>
          </div>
        )}

        {attempts.length < 5 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Faça mais alguns exercícios para ver sua análise personalizada.
            </p>
          </div>
        ) : (
          <>
            {/* Skill breakdown */}
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Performance por skill</h2>
              <div className="space-y-2">
                {modeStats.map((s) => (
                  <div
                    key={s.mode}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                      {modeLabel[s.mode] ?? s.mode}
                    </span>
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.avg >= 70 ? "bg-green-500" : s.avg >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${s.avg}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                      {s.avg}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Top weaknesses */}
            <section>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-amber-500" />
                Categorias com mais dificuldade
              </h2>
              {weaknesses.length === 0 ? (
                <p className="text-sm text-gray-500">Sem padrões claros ainda.</p>
              ) : (
                <div className="space-y-2">
                  {weaknesses.map((w) => (
                    <div
                      key={w.focus}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{w.focus}</p>
                        <p className="text-xs text-gray-500">{w.count} tentativas</p>
                      </div>
                      <div className={`text-sm font-bold ${
                        w.avg >= 70 ? "text-green-600" : w.avg >= 50 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {w.avg}/100
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                to="/lessons"
                className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-center text-sm"
              >
                Praticar mais
              </Link>
              <Link
                to="/progress"
                className="py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-center text-sm"
              >
                Ver gráficos
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
