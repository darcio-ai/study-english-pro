import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progresso — EnglishUp" }] }),
  component: ProgressPage,
});

type AttemptRow = {
  score: number | null;
  grammar_focus: string | null;
  created_at: string;
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ProgressPage() {
  const { user } = Route.useRouteContext();

  const attemptsQuery = useQuery({
    queryKey: ["all_attempts", user.id],
    queryFn: async (): Promise<AttemptRow[]> => {
      const { data, error } = await supabase
        .from("attempts")
        .select("score, grammar_focus, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as AttemptRow[];
    },
  });

  const attempts = attemptsQuery.data ?? [];
  const total = attempts.length;
  const avg = total
    ? Math.round(attempts.reduce((a, b) => a + (b.score ?? 0), 0) / total)
    : 0;

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const thisWeek = attempts.filter(
    (a) => new Date(a.created_at).getTime() >= sevenDaysAgo,
  ).length;

  // Last 7 days line chart
  const today = new Date();
  const byDay: { label: string; avg: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end = start + 86400000;
    const dayAttempts = attempts.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= start && t < end;
    });
    const dayAvg = dayAttempts.length
      ? Math.round(
          dayAttempts.reduce((s, x) => s + (x.score ?? 0), 0) / dayAttempts.length,
        )
      : 0;
    byDay.push({ label: DAY_LABELS[d.getDay()], avg: dayAvg });
  }

  // By grammar focus
  const focusMap = new Map<string, number>();
  for (const a of attempts) {
    if (!a.grammar_focus) continue;
    focusMap.set(a.grammar_focus, (focusMap.get(a.grammar_focus) ?? 0) + 1);
  }
  const byFocus = Array.from(focusMap.entries())
    .map(([name, count]) => ({
      name: name.length > 14 ? name.slice(0, 13) + "…" : name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Meu Progresso 📊
        </h1>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Total" value={total} />
          <Stat label="Nota média" value={`${avg}/100`} />
          <Stat label="Esta semana" value={thisWeek} />
        </div>

        {total === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Nenhum exercício ainda. Que tal começar agora?
            </p>
            <Link
              to="/exercise"
              className="inline-block py-2.5 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              Praticar →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <ChartCard title="Notas dos últimos 7 dias">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={byDay} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(120,120,140,0.3)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Exercícios por categoria">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byFocus} margin={{ left: 0, right: 0, top: 8, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.2)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(120,120,140,0.3)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}
