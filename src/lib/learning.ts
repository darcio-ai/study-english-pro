// Client-safe helpers for the learning loop:
// - review queue (spaced repetition for errors)
// - vocabulary SRS scheduling
// - XP and achievement granting
// - mode tracking for "all modes one day"
import { supabase } from "@/integrations/supabase/client";

export type Track = "sales" | "tech" | "general";
export type Mode = "writing" | "listening" | "speaking_read" | "speaking_free";

const SRS_INTERVALS = [1, 3, 7, 14, 30, 60];

export function nextInterval(currentDays: number, success: boolean): number {
  if (!success) return 1;
  const idx = SRS_INTERVALS.findIndex((d) => d >= currentDays);
  const next = SRS_INTERVALS[Math.min(idx + 1, SRS_INTERVALS.length - 1)] ?? 60;
  return next;
}

/** Add or update review queue entry. Called when score < 70 (failed) or on a successful review. */
export async function upsertReviewQueue(params: {
  userId: string;
  exerciseId: string;
  score: number;
  asReview?: boolean;
}) {
  const { userId, exerciseId, score, asReview } = params;
  const { data: existing } = await supabase
    .from("review_queue")
    .select("id, interval_days, review_count")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  const success = score >= 70;

  if (!existing) {
    if (success && !asReview) return; // don't enqueue a success
    const next = nextInterval(0, success);
    await supabase.from("review_queue").insert({
      user_id: userId,
      exercise_id: exerciseId,
      last_score: score,
      interval_days: next,
      next_review_at: new Date(Date.now() + next * 86400000).toISOString(),
      review_count: 0,
    });
    return;
  }

  if (asReview && success && existing.interval_days >= 30) {
    // graduated — remove from queue
    await supabase.from("review_queue").delete().eq("id", existing.id);
    return;
  }

  const next = nextInterval(existing.interval_days, success);
  await supabase
    .from("review_queue")
    .update({
      last_score: score,
      interval_days: next,
      next_review_at: new Date(Date.now() + next * 86400000).toISOString(),
      review_count: existing.review_count + (asReview ? 1 : 0),
    })
    .eq("id", existing.id);
}

/** Increment XP for the user. */
export async function addXp(userId: string, amount: number) {
  const { data } = await supabase
    .from("user_progress")
    .select("xp")
    .eq("user_id", userId)
    .maybeSingle();
  const current = data?.xp ?? 0;
  await supabase.from("user_progress").update({ xp: current + amount }).eq("user_id", userId);
}

/** XP awarded per attempt by score band. */
export function xpForScore(score: number): number {
  if (score >= 90) return 20;
  if (score >= 70) return 12;
  if (score >= 40) return 6;
  return 3;
}

type AchievementCriteria =
  | { type: "attempts"; count: number }
  | { type: "streak"; days: number }
  | { type: "perfect_attempts"; count: number }
  | { type: "all_modes_one_day" }
  | { type: "reviews_done"; count: number }
  | { type: "lessons_completed"; count: number }
  | { type: "level_increase" }
  | { type: "vocab_saved"; count: number };

/** Evaluate all achievements; insert any newly-unlocked ones. Returns the newly unlocked codes. */
export async function checkAndGrantAchievements(userId: string): Promise<string[]> {
  const [achievementsRes, unlockedRes, attemptsRes, progressRes, reviewRes, lessonsRes, vocabRes] = await Promise.all([
    supabase.from("achievements").select("code, criteria, xp_reward"),
    supabase.from("user_achievements").select("achievement_code").eq("user_id", userId),
    supabase
      .from("attempts")
      .select("score, mode, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("user_progress").select("streak_days").eq("user_id", userId).maybeSingle(),
    supabase.from("review_queue").select("review_count").eq("user_id", userId),
    supabase.from("user_lesson_progress").select("completed_at").eq("user_id", userId).not("completed_at", "is", null),
    supabase.from("user_vocabulary").select("id").eq("user_id", userId),
  ]);

  const unlocked = new Set((unlockedRes.data ?? []).map((u) => u.achievement_code));
  const achievements = achievementsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];
  const streak = progressRes.data?.streak_days ?? 0;
  const reviewsDone = (reviewRes.data ?? []).reduce((s, r) => s + (r.review_count ?? 0), 0);
  const lessonsCompleted = (lessonsRes.data ?? []).length;
  const vocabCount = (vocabRes.data ?? []).length;

  const todayKey = new Date().toISOString().slice(0, 10);
  const modesToday = new Set(
    attempts
      .filter((a) => a.created_at?.slice(0, 10) === todayKey)
      .map((a) => a.mode ?? "writing"),
  );

  const newlyUnlocked: string[] = [];
  for (const a of achievements) {
    if (unlocked.has(a.code)) continue;
    const c = a.criteria as AchievementCriteria;
    let met = false;
    switch (c.type) {
      case "attempts":
        met = attempts.length >= c.count;
        break;
      case "streak":
        met = streak >= c.days;
        break;
      case "perfect_attempts":
        met = attempts.filter((a) => (a.score ?? 0) === 100).length >= c.count;
        break;
      case "all_modes_one_day":
        met = ["writing", "listening", "speaking_read", "speaking_free"].every((m) => modesToday.has(m));
        break;
      case "reviews_done":
        met = reviewsDone >= c.count;
        break;
      case "lessons_completed":
        met = lessonsCompleted >= c.count;
        break;
      case "vocab_saved":
        met = vocabCount >= c.count;
        break;
      default:
        met = false;
    }
    if (met) {
      const { error } = await supabase.from("user_achievements").insert({
        user_id: userId,
        achievement_code: a.code,
      });
      if (!error) {
        newlyUnlocked.push(a.code);
        await addXp(userId, a.xp_reward ?? 50);
      }
    }
  }
  return newlyUnlocked;
}

/** Suggest a level change based on the last 10 attempts. */
export function suggestLevelChange(
  recentScores: number[],
  currentLevel: "beginner" | "intermediate" | "advanced",
): "up" | "down" | null {
  if (recentScores.length < 5) return null;
  const last10 = recentScores.slice(0, 10);
  const avg = last10.reduce((a, b) => a + b, 0) / last10.length;
  const consecutiveHigh = last10.slice(0, 7).every((s) => s >= 80);
  const consecutiveLow = last10.slice(0, 5).every((s) => s <= 40);
  if (avg >= 85 && consecutiveHigh && currentLevel !== "advanced") return "up";
  if (avg <= 40 && consecutiveLow && currentLevel !== "beginner") return "down";
  return null;
}

export const TRACK_LABEL: Record<Track, string> = {
  sales: "Vendas",
  tech: "Tecnologia",
  general: "Geral",
};

export const TRACK_EMOJI: Record<Track, string> = {
  sales: "💼",
  tech: "💻",
  general: "🌍",
};
