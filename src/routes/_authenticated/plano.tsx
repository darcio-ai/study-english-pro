import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, CalendarDays, Check, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useStudyPlan, WEEKDAY_LABEL } from "@/hooks/use-study-plan";
import {
  SKILL_META,
  SKILL_ORDER,
  buildDailyPlan,
  buildWeeklySummary,
  diagnoseSkills,
  fetchCoachAttempts,
  startOfWeek,
  type SkillKey,
} from "@/lib/recommendations";
import {
  notificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/plano")({
  head: () => ({
    meta: [
      { title: "Plano e calendário de estudos — EnglishUp" },
      {
        name: "description",
        content:
          "Monte seu calendário de estudos, defina metas diárias, agende sessões e acompanhe o resumo semanal de progresso.",
      },
      { property: "og:title", content: "Plano e calendário de estudos — EnglishUp" },
      {
        property: "og:description",
        content: "Metas diárias, sessões agendadas, lembretes opcionais e resumo semanal do seu progresso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

type Tab = "calendar" | "week" | "settings";

type SessionRow = {
  id: string;
  scheduled_for: string;
  scheduled_time: string | null;
  skill: string;
  duration_minutes: number;
  status: string;
};

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlanPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { plan, savePlan, ready } = useStudyPlan(user.id);
  const [tab, setTab] = useState<Tab>("calendar");
  const [permission, setPermission] = useState<PermissionState>(() => notificationPermission());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const attemptsQuery = useQuery({
    queryKey: ["coach_attempts", user.id],
    queryFn: () => fetchCoachAttempts(user.id, 300),
  });

  const sessionsQuery = useQuery({
    queryKey: ["study_sessions", user.id],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, scheduled_for, scheduled_time, skill, duration_minutes, status")
        .eq("user_id", user.id)
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const vocabQuery = useQuery({
    queryKey: ["week_new_words", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_vocabulary")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfWeek().toISOString());
      return count ?? 0;
    },
  });

  const achQuery = useQuery({
    queryKey: ["week_achievements", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("unlocked_at", startOfWeek().toISOString());
      return count ?? 0;
    },
  });

  const xpQuery = useQuery({
    queryKey: ["plan_xp", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("xp")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.xp ?? 0;
    },
  });

  const attempts = useMemo(() => attemptsQuery.data ?? [], [attemptsQuery.data]);
  const sessions = sessionsQuery.data ?? [];

  const diagnoses = useMemo(() => diagnoseSkills(attempts), [attempts]);
  const summary = useMemo(
    () =>
      buildWeeklySummary({
        attempts,
        goalPerWeek: plan.daily_goal_exercises * plan.weekdays.length,
        minutesPerAttempt: Math.max(1, Math.round(plan.minutes_per_day / Math.max(1, plan.daily_goal_exercises))),
        newWords: vocabQuery.data ?? 0,
        achievements: achQuery.data ?? 0,
        xp: xpQuery.data ?? 0,
      }),
    [attempts, plan, vocabQuery.data, achQuery.data, xpQuery.data],
  );

  const attemptsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attempts) {
      const key = isoDate(new Date(a.created_at));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [attempts]);

  async function toggleReminders(next: boolean) {
    if (next) {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== "granted") {
        await savePlan({ reminders_enabled: false });
        return;
      }
    }
    await savePlan({ reminders_enabled: next });
  }

  async function addSession(form: { date: string; time: string; skill: SkillKey; minutes: number }) {
    await supabase.from("study_sessions").insert({
      user_id: user.id,
      scheduled_for: form.date,
      scheduled_time: form.time || null,
      skill: form.skill,
      duration_minutes: form.minutes,
      status: "planned",
    });
    queryClient.invalidateQueries({ queryKey: ["study_sessions", user.id] });
  }

  async function completeSession(id: string) {
    await supabase
      .from("study_sessions")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["study_sessions", user.id] });
  }

  async function removeSession(id: string) {
    await supabase.from("study_sessions").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["study_sessions", user.id] });
  }

  const todayKey = isoDate(new Date());
  const doneToday = attemptsByDay.get(todayKey) ?? 0;
  const dailyPlan = buildDailyPlan({
    diagnoses,
    reviewsDue: 0,
    vocabDue: 0,
    goalExercises: plan.daily_goal_exercises,
  });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-20">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate({ to: "/inicio" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Início
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <CalendarDays className="size-6 text-indigo-600 dark:text-indigo-400" /> Plano de estudos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Meta de hoje: {doneToday}/{plan.daily_goal_exercises} exercícios
        </p>

        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-xl mb-5">
          {(
            [
              ["calendar", "Calendário"],
              ["week", "Semana"],
              ["settings", "Ajustes"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "calendar" && (
          <CalendarTab
            month={month}
            setMonth={setMonth}
            attemptsByDay={attemptsByDay}
            goal={plan.daily_goal_exercises}
            weekdays={plan.weekdays}
            sessions={sessions}
            onAdd={addSession}
            onComplete={completeSession}
            onRemove={removeSession}
          />
        )}

        {tab === "week" && <WeekTab summary={summary} />}

        {tab === "settings" && ready && (
          <SettingsTab
            plan={plan}
            savePlan={savePlan}
            permission={permission}
            toggleReminders={toggleReminders}
          />
        )}

        {tab === "calendar" && dailyPlan.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Sugestão para hoje</h2>
            <div className="space-y-2">
              {dailyPlan.map((b) => (
                <Link
                  key={b.id}
                  to={b.to}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <span className="text-xl">{b.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {b.title} · {b.detail}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{b.reason}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function CalendarTab({
  month,
  setMonth,
  attemptsByDay,
  goal,
  weekdays,
  sessions,
  onAdd,
  onComplete,
  onRemove,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  attemptsByDay: Map<string, number>;
  goal: number;
  weekdays: number[];
  sessions: SessionRow[];
  onAdd: (f: { date: string; time: string; skill: SkillKey; minutes: number }) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState("19:00");
  const [skill, setSkill] = useState<SkillKey>("listening");
  const [minutes, setMinutes] = useState(15);

  const first = new Date(month);
  const offset = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const today = isoDate(new Date());

  const upcoming = sessions
    .filter((s) => s.status === "planned" && s.scheduled_for >= today)
    .slice(0, 6);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
            {month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABEL.map((d) => (
            <span key={d} className="text-[10px] text-center text-gray-400">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const key = isoDate(d);
            const count = attemptsByDay.get(key) ?? 0;
            const isStudyDay = weekdays.includes(d.getDay());
            const past = key < today;
            const state =
              count >= goal ? "done" : count > 0 ? "partial" : past && isStudyDay ? "missed" : "idle";
            return (
              <span
                key={key}
                title={`${count} exercício(s)`}
                className={`aspect-square rounded-lg text-[11px] flex items-center justify-center font-medium ${
                  state === "done"
                    ? "bg-green-500 text-white"
                    : state === "partial"
                      ? "bg-amber-400 text-white"
                      : state === "missed"
                        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                } ${key === today ? "ring-2 ring-indigo-500" : ""}`}
              >
                {d.getDate()}
              </span>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded bg-green-500 inline-block" /> meta batida
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded bg-amber-400 inline-block" /> parcial
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded bg-red-300 inline-block" /> perdido
          </span>
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sessões agendadas</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 font-semibold"
          >
            <Plus className="size-4" /> Agendar
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              />
              <select
                value={skill}
                onChange={(e) => setSkill(e.target.value as SkillKey)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              >
                {SKILL_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SKILL_META[s].emoji} {SKILL_META[s].label}
                  </option>
                ))}
              </select>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              >
                {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={async () => {
                await onAdd({ date, time, skill, minutes });
                setShowForm(false);
              }}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              Salvar sessão
            </button>
          </div>
        )}

        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma sessão agendada.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <span className="text-xl">{SKILL_META[s.skill as SkillKey]?.emoji ?? "📘"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {SKILL_META[s.skill as SkillKey]?.label ?? s.skill} · {s.duration_minutes} min
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(`${s.scheduled_for}T12:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                    {s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onComplete(s.id)}
                  aria-label="Marcar como feita"
                  className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => onRemove(s.id)}
                  aria-label="Remover sessão"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function WeekTab({ summary }: { summary: ReturnType<typeof buildWeeklySummary> }) {
  const pct = summary.goal > 0 ? Math.min(100, Math.round((summary.attempts / summary.goal) * 100)) : 0;
  const maxHistory = Math.max(1, ...summary.history.map((h) => h.count));

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Sua semana</h2>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Exercícios" value={`${summary.attempts}/${summary.goal}`} />
          <Stat label="Minutos" value={`${summary.minutes}`} />
          <Stat label="Dias ativos" value={`${summary.daysActive}/7`} />
          <Stat label="XP total" value={`${summary.xp}`} />
          <Stat label="Palavras novas" value={`${summary.newWords}`} />
          <Stat label="Conquistas" value={`${summary.achievements}`} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Notas por habilidade</h2>
        <div className="space-y-2">
          {summary.perSkill.map((s) => (
            <div key={s.skill} className="flex items-center gap-3">
              <span className="text-sm text-gray-900 dark:text-white flex-1">
                {SKILL_META[s.skill].emoji} {SKILL_META[s.skill].label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{s.count}x</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                {s.avg ?? "—"}
              </span>
              <span
                className={`text-xs w-12 text-right ${
                  s.delta === null ? "text-gray-400" : s.delta >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {s.delta === null ? "—" : `${s.delta >= 0 ? "+" : ""}${s.delta}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(summary.strength || summary.improve) && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 mb-4">
          {summary.strength && (
            <p className="text-sm text-indigo-900 dark:text-indigo-100 mb-1">👏 {summary.strength}</p>
          )}
          {summary.improve && (
            <p className="text-sm text-indigo-900 dark:text-indigo-100">🎯 {summary.improve}</p>
          )}
          {summary.improveTo && (
            <Link
              to={summary.improveTo}
              className="mt-3 block w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold text-center"
            >
              Praticar isso agora
            </Link>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Últimas 6 semanas</h2>
        <div className="flex items-end gap-2 h-28">
          {summary.history.map((h) => (
            <div key={h.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{h.count}</span>
              <div
                className="w-full bg-indigo-500 rounded-t"
                style={{ height: `${Math.max(4, (h.count / maxHistory) * 80)}px` }}
              />
              <span className="text-[10px] text-gray-400">{h.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function SettingsTab({
  plan,
  savePlan,
  permission,
  toggleReminders,
}: {
  plan: ReturnType<typeof useStudyPlan>["plan"];
  savePlan: ReturnType<typeof useStudyPlan>["savePlan"];
  permission: PermissionState;
  toggleReminders: (next: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Dias de estudo</h2>
        <div className="flex gap-1.5">
          {WEEKDAY_LABEL.map((label, idx) => {
            const active = plan.weekdays.includes(idx);
            return (
              <button
                key={label}
                onClick={() =>
                  savePlan({
                    weekdays: active
                      ? plan.weekdays.filter((d) => d !== idx)
                      : [...plan.weekdays, idx].sort((a, b) => a - b),
                  })
                }
                className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Minutos por dia</span>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={plan.minutes_per_day}
            onChange={(e) => savePlan({ minutes_per_day: Number(e.target.value) })}
            className="w-full mt-2 accent-indigo-600"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{plan.minutes_per_day} min</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Meta diária de exercícios</span>
          <input
            type="range"
            min={1}
            max={20}
            value={plan.daily_goal_exercises}
            onChange={(e) => savePlan({ daily_goal_exercises: Number(e.target.value) })}
            className="w-full mt-2 accent-indigo-600"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {plan.daily_goal_exercises} exercícios
          </span>
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-2 mb-2">
          <BellRing className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lembrete de estudo</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Uma notificação por dia, no horário escolhido, só se a meta ainda não estiver concluída. Nada é
              enviado sem sua autorização e você pode desligar quando quiser.
            </p>
          </div>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Horário</span>
          <input
            type="time"
            value={plan.reminder_time}
            onChange={(e) => savePlan({ reminder_time: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          />
        </label>

        {permission === "unsupported" ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Este dispositivo/navegador não suporta notificações. Você ainda verá o lembrete dentro do app.
          </p>
        ) : permission === "denied" ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            As notificações foram bloqueadas nas configurações do navegador. Libere-as ali para ativar o
            lembrete.
          </p>
        ) : plan.reminders_enabled ? (
          <button
            onClick={() => toggleReminders(false)}
            className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            Desativar lembretes
          </button>
        ) : (
          <button
            onClick={() => toggleReminders(true)}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
          >
            Ativar lembretes
          </button>
        )}
      </div>
    </div>
  );
}
