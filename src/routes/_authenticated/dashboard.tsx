import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, BookOpen, Flame, Award, BarChart3, Pencil, RotateCcw, Check, X } from "lucide-react";
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, placement_done")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar nome");
      return;
    }
    setEditingName(false);
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Nome atualizado");
  }

  async function retakePlacement() {
    const { error } = await supabase
      .from("profiles")
      .update({ placement_done: false })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao reiniciar teste");
      return;
    }
    navigate({ to: "/placement" });
  }

  const p = progressQuery.data;
  const attempts = attemptsQuery.data ?? [];
  const displayName = profileQuery.data?.display_name ?? user.email?.split("@")[0] ?? "Você";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Olá 👋</p>
            {editingName ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="flex-1 min-w-0 px-2 py-1 text-xl font-bold rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={saveName} className="p-2 rounded-lg bg-indigo-600 text-white" aria-label="Salvar">
                  <Check className="size-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-2 rounded-lg text-gray-500" aria-label="Cancelar">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                className="group flex items-center gap-2 text-left"
              >
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {displayName}
                </h1>
                <Pencil className="size-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-0.5">
              {user.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors flex-shrink-0"
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
            <div className="absolute z-10 left-0 mt-2 flex flex-col gap-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[160px]">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => changeLevel(l)}
                  className="text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
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

        {/* Practice modes */}
        <div className="grid grid-cols-2 gap-3">
          <ModeCard to="/exercise" emoji="📝" label="Escrever" sub="Gramática" />
          <ModeCard to="/listening" emoji="🎧" label="Ouvir" sub="Listening" />
          <ModeCard to="/speaking" emoji="🎤" label="Falar" sub="Pronúncia" />
          <ModeCard to="/speaking-free" emoji="💬" label="Conversar" sub="Speaking livre" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <Link
            to="/progress"
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <BarChart3 className="size-4" /> Ver progresso
          </Link>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button
            onClick={retakePlacement}
            className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:underline"
          >
            <RotateCcw className="size-4" /> Refazer teste
          </button>
        </div>

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
