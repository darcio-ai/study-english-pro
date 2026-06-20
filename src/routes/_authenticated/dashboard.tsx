import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, Flame, BarChart3, Pencil, Check, X, RefreshCw, Trophy, BookOpen, Brain, Target, Zap, Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { LevelPill, type Level, LEVELS, LEVEL_LABEL } from "@/components/englishup";
import { TRACK_EMOJI, TRACK_LABEL, type Track } from "@/lib/learning";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EnglishUp" }] }),
  component: Dashboard,
});

type ProgressData = {
  level: Level;
  exercises_completed: number;
  streak_days: number;
  xp: number;
  preferred_track: Track;
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
    queryFn: async (): Promise<ProgressData> => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("level, exercises_completed, streak_days, xp, preferred_track")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: insertErr } = await supabase
          .from("user_progress")
          .insert({ user_id: user.id, level: "beginner" })
          .select("level, exercises_completed, streak_days, xp, preferred_track")
          .single();
        if (insertErr) throw insertErr;
        return created as ProgressData;
      }
      return data as ProgressData;
    },
  });

  const reviewsDueQuery = useQuery({
    queryKey: ["reviews_due_count", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("review_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString());
      return count ?? 0;
    },
  });

  const vocabDueQuery = useQuery({
    queryKey: ["vocab_due_count", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_vocabulary")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString());
      return count ?? 0;
    },
  });

  const nextLessonQuery = useQuery({
    queryKey: ["next_lesson", user.id, progressQuery.data?.preferred_track, progressQuery.data?.level],
    queryFn: async () => {
      const track = progressQuery.data?.preferred_track ?? "sales";
      const level = progressQuery.data?.level ?? "beginner";
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, emoji, unit_number, lesson_number")
        .eq("track", track)
        .eq("level", level)
        .order("unit_number")
        .order("lesson_number");
      const { data: progress } = await supabase
        .from("user_lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id);
      const completed = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
      return (lessons ?? []).find((l) => !completed.has(l.id)) ?? null;
    },
    enabled: !!progressQuery.data,
  });

  const recentAttemptsQuery = useQuery({
    queryKey: ["recent_attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, grammar_focus, level, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const achievementsQuery = useQuery({
    queryKey: ["unlocked_count", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (progressQuery.error) toast.error("Erro ao carregar progresso");
  }, [progressQuery.error]);

  async function changeLevel(level: Level) {
    setLevelMenuOpen(false);
    const { error } = await supabase.from("user_progress").update({ level }).eq("user_id", user.id);
    if (error) return toast.error("Erro ao alterar nível");
    queryClient.invalidateQueries({ queryKey: ["user_progress", user.id] });
    queryClient.invalidateQueries({ queryKey: ["next_lesson", user.id] });
    toast.success(`Nível: ${LEVEL_LABEL[level]}`);
  }

  async function changeTrack(track: Track) {
    await supabase.from("user_progress").update({ preferred_track: track }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["user_progress", user.id] });
    queryClient.invalidateQueries({ queryKey: ["next_lesson", user.id] });
  }

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return toast.error("Nome vazio");
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("user_id", user.id);
    if (error) return toast.error("Erro ao salvar");
    setEditingName(false);
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  const p = progressQuery.data;
  const displayName = profileQuery.data?.display_name ?? user.email?.split("@")[0] ?? "Você";
  const reviewsDue = reviewsDueQuery.data ?? 0;
  const vocabDue = vocabDueQuery.data ?? 0;
  const nextLesson = nextLessonQuery.data;
  const recentAttempts = recentAttemptsQuery.data ?? [];
  const unlockedCount = achievementsQuery.data ?? 0;
  const placementDone = profileQuery.data?.placement_done === true;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-20">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
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
                <button onClick={saveName} className="p-2 rounded-lg bg-indigo-600 text-white"><Check className="size-4" /></button>
                <button onClick={() => setEditingName(false)} className="p-2 text-gray-500"><X className="size-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                className="flex items-center gap-1.5 text-left"
                aria-label="Editar nome"
              >
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{displayName}</h1>
                <Pencil className="size-4 text-gray-400 shrink-0" />
              </button>
            )}
          </div>
          <button onClick={logout} aria-label="Sair" className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <LogOut className="size-5" />
          </button>
        </div>

        {/* Track + Level + XP row */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative">
            <button onClick={() => setLevelMenuOpen(!levelMenuOpen)} disabled={!p}>
              {p ? <LevelPill level={p.level} interactive /> : <span className="text-xs">…</span>}
            </button>
            {levelMenuOpen && p && (
              <div className="absolute z-10 left-0 mt-2 flex flex-col gap-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[160px]">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => changeLevel(l)} className="text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]">
                    <LevelPill level={l} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {(["sales", "tech"] as Track[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTrack(t)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                p?.preferred_track === t
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {TRACK_EMOJI[t]} {TRACK_LABEL[t]}
            </button>
          ))}

          <div className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
            <Zap className="size-3 fill-current" />
            {p?.xp ?? 0} XP
          </div>
        </div>

        {/* Streak + Lessons + Achievements */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatCard icon={<Flame className="size-4 text-orange-500" />} label="Streak" value={`${p?.streak_days ?? 0}d`} />
          <StatCard icon={<BookOpen className="size-4 text-indigo-600" />} label="Exercícios" value={p?.exercises_completed ?? 0} />
          <Link to="/achievements" className="block">
            <StatCard icon={<Trophy className="size-4 text-amber-500" />} label="Conquistas" value={unlockedCount} />
          </Link>
        </div>

        {/* Placement test banner — show prominently if not done */}
        {!placementDone && (
          <Link
            to="/placement"
            className="block mb-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Descubra seu nível</p>
                <p className="text-xs opacity-90">Faça o teste rápido em 5 minutos</p>
              </div>
              <span className="text-xl">→</span>
            </div>
          </Link>
        )}

        {/* Hero CTA: Next Lesson */}
        {nextLesson && (
          <Link
            to="/lesson/$id"
            params={{ id: nextLesson.id }}
            className="block mb-3 p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{nextLesson.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs opacity-80">Próxima lição</p>
                <h2 className="text-lg font-bold truncate">{nextLesson.title}</h2>
                <p className="text-xs opacity-80 mt-0.5">
                  Unidade {nextLesson.unit_number} · Lição {nextLesson.lesson_number}
                </p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>
        )}

        {/* Review + Vocabulary alerts */}
        {(reviewsDue > 0 || vocabDue > 0) && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Link
              to="/review"
              className={`p-3 rounded-xl border-2 transition-all ${
                reviewsDue > 0
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`size-4 ${reviewsDue > 0 ? "text-amber-600" : "text-gray-400"}`} />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">Revisões</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{reviewsDue}</p>
            </Link>
            <Link
              to="/vocabulary"
              className={`p-3 rounded-xl border-2 transition-all ${
                vocabDue > 0
                  ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Brain className={`size-4 ${vocabDue > 0 ? "text-purple-600" : "text-gray-400"}`} />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">Vocabulário</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{vocabDue}</p>
            </Link>
          </div>
        )}

        {/* Practice modes */}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 mt-6">Prática livre</h2>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <ModeCard to="/exercise" emoji="📝" label="Escrever" />
          <ModeCard to="/listening" emoji="🎧" label="Ouvir" />
          <ModeCard to="/speaking" emoji="🎤" label="Falar" />
          <ModeCard to="/speaking-free" emoji="💬" label="Conversar" />
          <ModeCard to="/reading" emoji="📖" label="Ler" />
          <ModeCard to="/vocabulary" emoji="🧠" label="Vocab" />
        </div>

        {/* Bottom nav links */}
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <Link to="/lessons" className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300">
            <BookOpen className="size-4 text-indigo-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Lições</span>
          </Link>
          <Link to="/weaknesses" className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300">
            <Target className="size-4 text-rose-500" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Fraquezas</span>
          </Link>
          <Link to="/progress" className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300">
            <BarChart3 className="size-4 text-emerald-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Progresso</span>
          </Link>
        </div>

        {/* Recent activity */}
        {recentAttempts.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Atividade recente</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {recentAttempts.map((a) => (
                <div key={a.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.grammar_focus ?? "—"}</p>
                    <p className="text-xs text-gray-500">
                      {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR }) : ""}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${
                    (a.score ?? 0) >= 70 ? "text-green-600" : (a.score ?? 0) >= 50 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {a.score ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ModeCard({ to, emoji, label }: { to: string; emoji: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 py-4 px-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md active:scale-95 transition-all min-h-[90px]"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-gray-900 dark:text-white">{label}</span>
    </Link>
  );
}
