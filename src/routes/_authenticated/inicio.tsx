import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  CalendarDays,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Mic,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import { useStudyPlan } from "@/hooks/use-study-plan";
import { maybeFireReminder } from "@/lib/reminders";
import {
  SKILL_META,
  buildDailyPlan,
  buildWeeklySummary,
  diagnoseSkills,
  fetchCoachAttempts,
} from "@/lib/recommendations";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "O que vamos praticar hoje? — EnglishUp" },
      {
        name: "description",
        content:
          "Escolha como estudar hoje: lições, prática livre de escrita, escuta, fala e leitura, revisão ou vocabulário.",
      },
      { property: "og:title", content: "O que vamos praticar hoje? — EnglishUp" },
      {
        property: "og:description",
        content: "Escolha sua prática do dia no EnglishUp: lições, escuta, fala, leitura e revisão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, setLanguage } = useLanguage(user.id);

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

  const displayName = profileQuery.data?.display_name ?? user.email?.split("@")[0] ?? "Você";
  const placementDone = profileQuery.data?.placement_done === true;
  const reviewsDue = reviewsDueQuery.data ?? 0;
  const vocabDue = vocabDueQuery.data ?? 0;

  async function skipPlacement() {
    await supabase
      .from("profiles")
      .upsert({ user_id: user.id, placement_done: true }, { onConflict: "user_id" });
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="mb-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Olá 👋</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{displayName}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">O que você quer fazer agora?</p>
        </div>

        <div className="mb-5">
          <LanguageSwitch value={language} onChange={setLanguage} size="sm" />
        </div>

        {!placementDone && (
          <div className="mb-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-indigo-900 dark:text-indigo-100">Descobrir meu nível</h2>
            </div>
            <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mb-4">
              25 perguntas rápidas (≈2 min) para ajustar as lições ao seu nível. É opcional.
            </p>
            <button
              onClick={() => navigate({ to: "/placement" })}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              Fazer teste de nível
            </button>
            <button
              onClick={skipPlacement}
              className="mt-2 w-full py-2 text-sm text-indigo-700/80 dark:text-indigo-300/80 hover:underline"
            >
              Pular por agora, começar no nível iniciante
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ActionCard to="/lessons" icon={<GraduationCap className="size-6" />} title="Lições" subtitle="Trilha guiada" primary />
          <ActionCard to="/exercise" icon={<PenLine className="size-6" />} title="Escrita" subtitle="Prática livre" />
          <ActionCard to="/listening" icon={<Headphones className="size-6" />} title="Escuta" subtitle="Prática livre" />
          <ActionCard to="/speaking" icon={<Mic className="size-6" />} title="Fala" subtitle="Prática livre" />
          <ActionCard to="/reading" icon={<BookOpen className="size-6" />} title="Leitura" subtitle="Textos + quiz" />
          <ActionCard
            to="/review"
            icon={<Brain className="size-6" />}
            title="Revisão"
            subtitle={reviewsDue > 0 ? `${reviewsDue} pendentes` : "Em dia"}
          />
          <ActionCard
            to="/vocabulary"
            icon={<Sparkles className="size-6" />}
            title="Vocabulário"
            subtitle={vocabDue > 0 ? `${vocabDue} cartões` : "Em dia"}
          />
          <ActionCard to="/dashboard" icon={<LayoutDashboard className="size-6" />} title="Dashboard" subtitle="Progresso" />
        </div>

        {placementDone && (
          <button
            onClick={() => navigate({ to: "/placement" })}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            <RotateCcw className="size-4" /> Refazer teste de nível
          </button>
        )}
      </div>
    </main>
  );
}

function ActionCard({
  to,
  icon,
  title,
  subtitle,
  primary = false,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border p-4 min-h-[104px] flex flex-col justify-between transition-colors ${
        primary
          ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-700"
      }`}
    >
      <span className={primary ? "text-white" : "text-indigo-600 dark:text-indigo-400"}>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`block text-xs ${primary ? "text-indigo-100" : "text-gray-500 dark:text-gray-400"}`}>
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
