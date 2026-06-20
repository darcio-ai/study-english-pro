// Server-side achievement granting. Criteria are validated against the
// authenticated user's real data using the service-role client, so users
// cannot grant themselves achievements (or XP) by calling the API directly.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AchievementCriteria =
  | { type: "attempts"; count: number }
  | { type: "streak"; days: number }
  | { type: "perfect_attempts"; count: number }
  | { type: "all_modes_one_day" }
  | { type: "reviews_done"; count: number }
  | { type: "lessons_completed"; count: number }
  | { type: "level_increase" }
  | { type: "vocab_saved"; count: number };

export const grantAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [achievementsRes, unlockedRes, attemptsRes, progressRes, reviewRes, lessonsRes, vocabRes] = await Promise.all([
      supabaseAdmin.from("achievements").select("code, criteria, xp_reward"),
      supabaseAdmin.from("user_achievements").select("achievement_code").eq("user_id", userId),
      supabaseAdmin
        .from("attempts")
        .select("score, mode, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("user_progress").select("streak_days, xp").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("review_queue").select("review_count").eq("user_id", userId),
      supabaseAdmin.from("user_lesson_progress").select("completed_at").eq("user_id", userId).not("completed_at", "is", null),
      supabaseAdmin.from("user_vocabulary").select("id").eq("user_id", userId),
    ]);

    const unlocked = new Set((unlockedRes.data ?? []).map((u) => u.achievement_code));
    const achievements = achievementsRes.data ?? [];
    const attempts = attemptsRes.data ?? [];
    const streak = progressRes.data?.streak_days ?? 0;
    let xp = progressRes.data?.xp ?? 0;
    const reviewsDone = (reviewRes.data ?? []).reduce((s, r) => s + (r.review_count ?? 0), 0);
    const lessonsCompleted = (lessonsRes.data ?? []).length;
    const vocabCount = (vocabRes.data ?? []).length;

    const todayKey = new Date().toISOString().slice(0, 10);
    const modesToday = new Set(
      attempts.filter((a) => a.created_at?.slice(0, 10) === todayKey).map((a) => a.mode ?? "writing"),
    );

    const newlyUnlocked: string[] = [];
    let xpDelta = 0;
    for (const a of achievements) {
      if (unlocked.has(a.code)) continue;
      const c = a.criteria as AchievementCriteria;
      let met = false;
      switch (c.type) {
        case "attempts": met = attempts.length >= c.count; break;
        case "streak": met = streak >= c.days; break;
        case "perfect_attempts": met = attempts.filter((x) => (x.score ?? 0) === 100).length >= c.count; break;
        case "all_modes_one_day":
          met = ["writing", "listening", "speaking_read", "speaking_free"].every((m) => modesToday.has(m));
          break;
        case "reviews_done": met = reviewsDone >= c.count; break;
        case "lessons_completed": met = lessonsCompleted >= c.count; break;
        case "vocab_saved": met = vocabCount >= c.count; break;
        default: met = false;
      }
      if (met) {
        const { error } = await supabaseAdmin
          .from("user_achievements")
          .insert({ user_id: userId, achievement_code: a.code });
        if (!error) {
          newlyUnlocked.push(a.code);
          xpDelta += a.xp_reward ?? 50;
        }
      }
    }

    if (xpDelta > 0) {
      await supabaseAdmin.from("user_progress").update({ xp: xp + xpDelta }).eq("user_id", userId);
    }

    return newlyUnlocked;
  });
