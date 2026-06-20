import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Conquistas — EnglishUp" }] }),
  component: AchievementsPage,
});

type Achievement = {
  code: string;
  title: string;
  description_pt: string;
  emoji: string;
  xp_reward: number;
};

function AchievementsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const allQuery = useQuery({
    queryKey: ["all_achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from("achievements")
        .select("code, title, description_pt, emoji, xp_reward")
        .order("xp_reward");
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });

  const unlockedQuery = useQuery({
    queryKey: ["unlocked_achievements", user.id],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("achievement_code")
        .eq("user_id", user.id);
      if (error) throw error;
      return new Set((data ?? []).map((u) => u.achievement_code));
    },
  });

  const progressQuery = useQuery({
    queryKey: ["xp_progress", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("xp")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const all = allQuery.data ?? [];
  const unlocked = unlockedQuery.data ?? new Set();
  const xp = progressQuery.data?.xp ?? 0;
  const unlockedCount = all.filter((a) => unlocked.has(a.code)).length;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Conquistas 🏆</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {unlockedCount} de {all.length} desbloqueadas
        </p>

        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white mb-6">
          <p className="text-xs uppercase tracking-wide opacity-80">Total XP</p>
          <p className="text-4xl font-extrabold mt-1">{xp.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {all.map((a) => {
            const isUnlocked = unlocked.has(a.code);
            return (
              <div
                key={a.code}
                className={`rounded-xl p-4 text-center border-2 transition-all ${
                  isUnlocked
                    ? "bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700 shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60"
                }`}
              >
                <div className="relative inline-block">
                  <span className={`text-4xl ${!isUnlocked ? "grayscale" : ""}`}>{a.emoji}</span>
                  {!isUnlocked && (
                    <Lock className="size-3 absolute bottom-0 right-0 text-gray-500" />
                  )}
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mt-2">{a.title}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                  {a.description_pt}
                </p>
                <p className="text-[10px] mt-2 font-bold text-indigo-600 dark:text-indigo-400">
                  +{a.xp_reward} XP
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
