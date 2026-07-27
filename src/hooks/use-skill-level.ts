import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/components/englishup";
import type { Language } from "@/lib/learning";

export type Skill = "writing" | "listening" | "speaking" | "reading";

export const SKILL_LABEL: Record<Skill, string> = {
  writing: "Escrita",
  listening: "Escuta",
  speaking: "Fala",
  reading: "Leitura",
};

function storageKey(language: Language, skill: Skill) {
  return `skill_level_${language}_${skill}`;
}

function isLevel(value: unknown): value is Level {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function readStored(language: Language, skill: Skill): Level | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(language, skill));
  return isLevel(raw) ? raw : null;
}

/**
 * Level chosen by the user for one skill in one language.
 * Falls back to the general level from user_progress (set by the placement test)
 * until the user picks a specific level for that skill.
 */
export function useSkillLevel(userId: string, language: Language, skill: Skill) {
  const [level, setLevelState] = useState<Level>(() => readStored(language, skill) ?? "beginner");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const cached = readStored(language, skill);
    if (cached) setLevelState(cached);

    (async () => {
      const { data: row } = await supabase
        .from("user_skill_levels")
        .select("level")
        .eq("user_id", userId)
        .eq("language", language)
        .eq("skill", skill)
        .maybeSingle();
      if (cancelled) return;

      if (row && isLevel(row.level)) {
        setLevelState(row.level);
        window.localStorage.setItem(storageKey(language, skill), row.level);
        setReady(true);
        return;
      }

      const { data: prog } = await supabase
        .from("user_progress")
        .select("level")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const fallback: Level = isLevel(prog?.level) ? prog.level : "beginner";
      setLevelState(fallback);
      window.localStorage.setItem(storageKey(language, skill), fallback);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, language, skill]);

  const setLevel = useCallback(
    async (next: Level) => {
      setLevelState(next);
      window.localStorage.setItem(storageKey(language, skill), next);
      const { error } = await supabase
        .from("user_skill_levels")
        .upsert(
          { user_id: userId, language, skill, level: next },
          { onConflict: "user_id,language,skill" },
        );
      if (error) throw error;
    },
    [userId, language, skill],
  );

  return { level, setLevel, ready };
}
