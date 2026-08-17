import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type StudyPlan = {
  weekdays: number[];
  minutes_per_day: number;
  daily_goal_exercises: number;
  reminder_time: string;
  reminders_enabled: boolean;
};

export const DEFAULT_PLAN: StudyPlan = {
  weekdays: [1, 2, 3, 4, 5],
  minutes_per_day: 15,
  daily_goal_exercises: 5,
  reminder_time: "19:00",
  reminders_enabled: false,
};

export const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Loads and saves the user's study plan preferences. */
export function useStudyPlan(userId: string) {
  const [plan, setPlan] = useState<StudyPlan>(DEFAULT_PLAN);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("study_plan")
        .select("weekdays, minutes_per_day, daily_goal_exercises, reminder_time, reminders_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setPlan({
          weekdays: (data.weekdays ?? DEFAULT_PLAN.weekdays) as number[],
          minutes_per_day: data.minutes_per_day ?? DEFAULT_PLAN.minutes_per_day,
          daily_goal_exercises: data.daily_goal_exercises ?? DEFAULT_PLAN.daily_goal_exercises,
          reminder_time: data.reminder_time ?? DEFAULT_PLAN.reminder_time,
          reminders_enabled: data.reminders_enabled ?? false,
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const savePlan = useCallback(
    async (patch: Partial<StudyPlan>) => {
      const next = { ...plan, ...patch };
      setPlan(next);
      const { error } = await supabase
        .from("study_plan")
        .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
      if (error) throw error;
    },
    [plan, userId],
  );

  return { plan, savePlan, ready };
}
