import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/lib/learning";

const STORAGE_KEY = "learn_language";

function readStored(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
}

/**
 * Target language the user is studying (English or Spanish).
 * Cached in localStorage to avoid a flash, persisted in user_progress.
 */
export function useLanguage(userId: string) {
  const [language, setLanguageState] = useState<Language>(readStored);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("user_progress")
      .select("preferred_language")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.preferred_language) return;
        const lang: Language = data.preferred_language === "es" ? "es" : "en";
        setLanguageState(lang);
        window.localStorage.setItem(STORAGE_KEY, lang);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setLanguage = useCallback(
    async (lang: Language) => {
      setLanguageState(lang);
      window.localStorage.setItem(STORAGE_KEY, lang);
      await supabase.from("user_progress").update({ preferred_language: lang }).eq("user_id", userId);
    },
    [userId],
  );

  return { language, setLanguage };
}
