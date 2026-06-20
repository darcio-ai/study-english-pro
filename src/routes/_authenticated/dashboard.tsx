import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, BookOpen, Flame, Award, ArrowRight, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { LevelPill, ScoreBadge, type Level, LEVELS, LEVEL_LABEL } from "@/components/englishup";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — EnglishUp" }],
  }),
  component: Dashboard,
});

type Progress = {
  level: Level;
  exercises_completed: number;
  streak_days: number;
};

type Attempt = {
  id: string;
  score: number | null;
  grammar_focus: string | null;
  level: string | null;
  created_at: string;
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);

  const progressQuery = useQuery({
    queryKey: ["user_progress", user.id],
    queryFn: async (): Promise<Progress> => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("level, exercises_completed, streak_days")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Fallback insert if trigger somehow didn't fire
        const { data: created, error: insertErr } = await supabase
          .from("user_progress")
          .insert({ user_id: user.id, level: "beginner" })
          .select("level, exercises_completed, streak_days")
          .single();
        if (insertErr) throw insertErr;
        return created as Progress;
      }
      return data as Progress;
    },
  });

  const attemptsQuery = useQuery({
    queryKey: ["recent_attempts", user.id],
    queryFn: async (): Promise<Attempt[]> => {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, grammar_focus, level, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Attempt[];
    },
  });

  useEffect(() => {
    if (progressQuery.error) toast.error("Erro ao carregar progresso");
  }, [progressQuery.error]);

  async function changeLevel(level: Level) {
    setLevelMenuOpen(false);
    const { error } = await supabase
      .from("user_progress")
      .update({ level })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao alterar nível");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["user_progress", user.id] });
    toast.success(`Nível alterado para ${LEVEL_LABEL[level]}`);
  }

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = progressQuery.data;
  const attempts = attemptsQuery.data ?? [];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Olá! 👋
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[180px] sm:max-w-[260px]">
              {user.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            aria-label="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </div>

        {/* Level selector */}
        <div className="mb-6 relative">
          <button
            onClick={() => setLevelMenuOpen((v) => !v)}
            disabled={!p}
            className="inline-flex items-center gap-2"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">Seu nível:</span>
            {p ? <LevelPill level={p.level} interactive /> : <span className="text-xs">…</span>}
          </button>
          {levelMenuOpen && p && (
            <div className="absolute z-10 mt-2 flex flex-col gap-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => changeLevel(l)}
                  className="text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <LevelPill level={l} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={<BookOpen className="size-4 text-indigo-600" />}
            label="Exercícios"
            value={p?.exercises_completed ?? 0}
          />
          <StatCard
            icon={<Flame className="size-4 text-orange-500" />}
            label="Sequência"
            value={`${p?.streak_days ?? 0}d`}
          />
          <StatCard
            icon={<Award className="size-4 text-purple-500" />}
            label="Nível"
            value={p ? LEVEL_LABEL[p.level].slice(0, 4) : "—"}
          />
        </div>

        {/* CTA */}
        <Link
          to="/exercise"
          className="block w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold shadow-sm transition-colors"
        >
          Praticar agora →
        </Link>
        <Link
          to="/progress"
          className="mt-3 flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <BarChart3 className="size-4" /> Ver progresso
        </Link>

        {/* Recent attempts */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Atividade recente
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {attempts.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhuma atividade ainda. Comece a praticar! 🚀
              </div>
            ) : (
              attempts.map((a) => (
                <div key={a.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {a.grammar_focus ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <ScoreBadge score={a.score ?? 0} />
                  {a.level ? <LevelPill level={a.level as Level} size="sm" /> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
