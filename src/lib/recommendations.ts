// Deterministic study coach: turns raw attempts into per-skill diagnostics,
// a daily plan and a weekly summary. No AI calls — pure aggregation.
import { supabase } from "@/integrations/supabase/client";

export type SkillKey = "writing" | "listening" | "speaking_read" | "speaking_free" | "reading";

export const SKILL_META: Record<SkillKey, { label: string; emoji: string; to: string }> = {
  writing: { label: "Escrita", emoji: "✏️", to: "/exercise" },
  listening: { label: "Escuta", emoji: "🎧", to: "/listening" },
  speaking_read: { label: "Pronúncia", emoji: "🎤", to: "/speaking" },
  speaking_free: { label: "Conversação", emoji: "💬", to: "/speaking-free" },
  reading: { label: "Leitura", emoji: "📖", to: "/reading" },
};

export const SKILL_ORDER: SkillKey[] = [
  "writing",
  "listening",
  "speaking_read",
  "speaking_free",
  "reading",
];

export type AttemptRow = {
  score: number | null;
  mode: string | null;
  grammar_focus: string | null;
  reading_text_id: string | null;
  created_at: string;
};

export type SkillDiagnosis = {
  skill: SkillKey;
  avg: number | null;
  recentAvg: number | null;
  previousAvg: number | null;
  trend: "up" | "down" | "flat" | null;
  count: number;
  lastPracticedAt: string | null;
  daysSincePractice: number | null;
  /** 0-100, higher = needs more practice */
  priority: number;
};

const DAY = 86400000;

export function skillOfAttempt(a: AttemptRow): SkillKey {
  if (a.reading_text_id) return "reading";
  const m = a.mode ?? "writing";
  if (m === "listening" || m === "speaking_read" || m === "speaking_free") return m;
  return "writing";
}

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Build a diagnosis for every skill from the attempt history (newest first). */
export function diagnoseSkills(attempts: AttemptRow[]): SkillDiagnosis[] {
  const now = Date.now();
  const grouped = new Map<SkillKey, AttemptRow[]>();
  for (const key of SKILL_ORDER) grouped.set(key, []);
  for (const a of attempts) {
    if (a.score === null) continue;
    grouped.get(skillOfAttempt(a))!.push(a);
  }

  return SKILL_ORDER.map((skill) => {
    const rows = grouped.get(skill)!;
    const scores = rows.map((r) => r.score ?? 0);
    const avg = avgOf(scores);
    const recentAvg = avgOf(scores.slice(0, 5));
    const previousAvg = scores.length >= 8 ? avgOf(scores.slice(5, 12)) : null;
    let trend: SkillDiagnosis["trend"] = null;
    if (recentAvg !== null && previousAvg !== null) {
      const delta = recentAvg - previousAvg;
      trend = delta >= 6 ? "up" : delta <= -6 ? "down" : "flat";
    }
    const lastPracticedAt = rows[0]?.created_at ?? null;
    const daysSincePractice = lastPracticedAt
      ? Math.floor((now - new Date(lastPracticedAt).getTime()) / DAY)
      : null;

    // Priority: low score + little practice + stale + falling trend.
    const scoreGap = recentAvg === null ? 65 : Math.max(0, 100 - recentAvg) * 0.6;
    const volumeGap = Math.max(0, 8 - rows.length) * 3;
    const staleGap = Math.min(20, (daysSincePractice ?? 14) * 2);
    const trendGap = trend === "down" ? 12 : trend === "up" ? -6 : 0;
    const priority = Math.max(0, Math.min(100, Math.round(scoreGap + volumeGap + staleGap + trendGap)));

    return {
      skill,
      avg,
      recentAvg,
      previousAvg,
      trend,
      count: rows.length,
      lastPracticedAt,
      daysSincePractice,
      priority,
    };
  }).sort((a, b) => b.priority - a.priority);
}

export type PlanBlock = {
  id: string;
  title: string;
  detail: string;
  emoji: string;
  to: string;
  reps: number;
  reason: string;
};

/** 3–5 concrete blocks for today, weighted towards the weakest skills. */
export function buildDailyPlan(params: {
  diagnoses: SkillDiagnosis[];
  reviewsDue: number;
  vocabDue: number;
  goalExercises: number;
}): PlanBlock[] {
  const { diagnoses, reviewsDue, vocabDue, goalExercises } = params;
  const blocks: PlanBlock[] = [];

  if (reviewsDue > 0) {
    blocks.push({
      id: "review",
      title: "Revisão pendente",
      detail: `${reviewsDue} ${reviewsDue === 1 ? "item" : "itens"} para revisar`,
      emoji: "🧠",
      to: "/review",
      reps: Math.min(reviewsDue, 10),
      reason: "Itens que você errou e estão no ponto de revisão",
    });
  }

  const weakest = diagnoses.slice(0, 3);
  let budget = Math.max(3, goalExercises);
  weakest.forEach((d, idx) => {
    const reps = idx === 0 ? Math.max(2, Math.ceil(budget * 0.5)) : Math.max(1, Math.round(budget * 0.25));
    budget = Math.max(0, budget - reps);
    const meta = SKILL_META[d.skill];
    blocks.push({
      id: `skill_${d.skill}`,
      title: meta.label,
      detail: `${reps} ${reps === 1 ? "exercício" : "exercícios"}`,
      emoji: meta.emoji,
      to: meta.to,
      reps,
      reason:
        d.count === 0
          ? "Você ainda não praticou essa habilidade"
          : d.recentAvg !== null && d.recentAvg < 70
            ? `Média recente ${d.recentAvg}/100`
            : d.daysSincePractice !== null && d.daysSincePractice >= 3
              ? `Sem praticar há ${d.daysSincePractice} dias`
              : "Manter o ritmo",
    });
  });

  if (vocabDue > 0) {
    blocks.push({
      id: "vocab",
      title: "Vocabulário",
      detail: `${Math.min(vocabDue, 10)} cartões`,
      emoji: "🃏",
      to: "/vocabulary",
      reps: Math.min(vocabDue, 10),
      reason: "Palavras salvas prontas para revisar",
    });
  }

  return blocks.slice(0, 5);
}

/** Level nudge for one skill, based on its recent scores. */
export function suggestSkillLevel(
  recentScores: number[],
  currentLevel: "beginner" | "intermediate" | "advanced",
): "up" | "down" | null {
  if (recentScores.length < 5) return null;
  const window = recentScores.slice(0, 8);
  const avg = window.reduce((a, b) => a + b, 0) / window.length;
  if (avg >= 85 && window.slice(0, 5).every((s) => s >= 78) && currentLevel !== "advanced") return "up";
  if (avg <= 45 && window.slice(0, 5).every((s) => s <= 55) && currentLevel !== "beginner") return "down";
  return null;
}

export type WeeklySummary = {
  weekStart: Date;
  attempts: number;
  goal: number;
  minutes: number;
  xp: number;
  daysActive: number;
  perSkill: { skill: SkillKey; avg: number | null; count: number; delta: number | null }[];
  mostPracticed: SkillKey | null;
  neglected: SkillKey | null;
  newWords: number;
  achievements: number;
  strength: string | null;
  improve: string | null;
  improveTo: string | null;
  history: { label: string; count: number }[];
};

export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return date;
}

export function buildWeeklySummary(params: {
  attempts: AttemptRow[];
  goalPerWeek: number;
  minutesPerAttempt: number;
  newWords: number;
  achievements: number;
  xp: number;
}): WeeklySummary {
  const { attempts, goalPerWeek, minutesPerAttempt, newWords, achievements, xp } = params;
  const weekStart = startOfWeek();
  const prevStart = new Date(weekStart.getTime() - 7 * DAY);

  const inWeek = attempts.filter((a) => new Date(a.created_at) >= weekStart);
  const inPrev = attempts.filter((a) => {
    const t = new Date(a.created_at);
    return t >= prevStart && t < weekStart;
  });

  const days = new Set(inWeek.map((a) => new Date(a.created_at).toDateString()));

  const perSkill = SKILL_ORDER.map((skill) => {
    const cur = inWeek.filter((a) => skillOfAttempt(a) === skill && a.score !== null);
    const prev = inPrev.filter((a) => skillOfAttempt(a) === skill && a.score !== null);
    const avg = avgOf(cur.map((a) => a.score ?? 0));
    const prevAvg = avgOf(prev.map((a) => a.score ?? 0));
    return {
      skill,
      avg,
      count: cur.length,
      delta: avg !== null && prevAvg !== null ? avg - prevAvg : null,
    };
  });

  const practiced = [...perSkill].sort((a, b) => b.count - a.count);
  const mostPracticed = practiced[0] && practiced[0].count > 0 ? practiced[0].skill : null;
  const neglected = [...perSkill].sort((a, b) => a.count - b.count)[0]?.skill ?? null;

  const scored = perSkill.filter((s) => s.avg !== null && s.count >= 2);
  const best = [...scored].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worst = [...scored].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];

  const history: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(weekStart.getTime() - i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const count = attempts.filter((a) => {
      const t = new Date(a.created_at);
      return t >= start && t < end;
    }).length;
    history.push({
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      count,
    });
  }

  const improveSkill = worst && worst !== best ? worst.skill : neglected;

  return {
    weekStart,
    attempts: inWeek.length,
    goal: goalPerWeek,
    minutes: inWeek.length * minutesPerAttempt,
    xp,
    daysActive: days.size,
    perSkill,
    mostPracticed,
    neglected,
    newWords,
    achievements,
    strength: best
      ? `${SKILL_META[best.skill].emoji} ${SKILL_META[best.skill].label} está seu ponto forte (${best.avg}/100).`
      : null,
    improve: improveSkill
      ? `${SKILL_META[improveSkill].emoji} ${SKILL_META[improveSkill].label} é o que mais precisa de atenção.`
      : null,
    improveTo: improveSkill ? SKILL_META[improveSkill].to : null,
  };
}

/** Recent attempts used by the coach (newest first). */
export async function fetchCoachAttempts(userId: string, limit = 200): Promise<AttemptRow[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("score, mode, grammar_focus, reading_text_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AttemptRow[];
}
