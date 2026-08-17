import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Play, RotateCcw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LevelPill, type Level } from "@/components/englishup";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import { TRACK_EMOJI, TRACK_LABEL, type Track } from "@/lib/learning";


export const Route = createFileRoute("/_authenticated/lessons")({
  head: () => ({ meta: [{ title: "Lições — EnglishUp" }] }),
  component: LessonsPage,
});

type Lesson = {
  id: string;
  level: Level;
  track: Track;
  unit_number: number;
  lesson_number: number;
  title: string;
  description_pt: string;
  grammar_focus: string;
  emoji: string;
};

type LessonProgress = {
  lesson_id: string;
  exercises_done: number;
  total_exercises: number;
  avg_score: number | null;
  completed_at: string | null;
};

function LessonsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage(user.id);
  const [track, setTrack] = useState<Track>("sales");
  const [userLevel, setUserLevel] = useState<Level>("beginner");


  useEffect(() => {
    supabase
      .from("user_progress")
      .select("level, preferred_track")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.level) setUserLevel(data.level as Level);
        if (data?.preferred_track) setTrack(data.preferred_track as Track);
      });
  }, [user.id]);

  async function changeTrack(newTrack: Track) {
    setTrack(newTrack);
    await supabase.from("user_progress").update({ preferred_track: newTrack }).eq("user_id", user.id);
  }

  const lessonsQuery = useQuery({
    queryKey: ["lessons", track, language],
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("track", track)
        .eq("language", language)
        .order("unit_number")
        .order("lesson_number");
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
  });


  const progressQuery = useQuery({
    queryKey: ["lesson_progress", user.id],
    queryFn: async (): Promise<LessonProgress[]> => {
      const { data, error } = await supabase
        .from("user_lesson_progress")
        .select("lesson_id, exercises_done, total_exercises, avg_score, completed_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as LessonProgress[];
    },
  });

  const progressMap = new Map((progressQuery.data ?? []).map((p) => [p.lesson_id, p]));
  const lessons = lessonsQuery.data ?? [];

  // Group by level
  const grouped: Record<Level, Lesson[]> = { beginner: [], intermediate: [], advanced: [] };
  for (const l of lessons) grouped[l.level].push(l);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Lições 📚</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Caminho estruturado por tema</p>

        <div className="mb-4">
          <LanguageSwitch value={language} onChange={setLanguage} size="sm" />
        </div>


        {/* Track switcher */}
        <div className="flex gap-2 mb-6">
          {(["general", "sales", "tech"] as Track[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTrack(t)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                track === t
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {TRACK_EMOJI[t]} {TRACK_LABEL[t]}
            </button>
          ))}
        </div>

        {(["beginner", "intermediate", "advanced"] as Level[]).map((lvl) => {
          const list = grouped[lvl];
          if (list.length === 0) return null;
          const locked = lvl !== userLevel && !(
            (lvl === "beginner") ||
            (lvl === "intermediate" && userLevel === "advanced") ||
            (lvl === "intermediate" && userLevel === "beginner") ||
            (lvl === "advanced" && userLevel === "intermediate") ||
            (lvl === "advanced" && userLevel === "advanced")
          );
          return (
            <section key={lvl} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <LevelPill level={lvl} size="sm" />
                {locked && <Lock className="size-3.5 text-gray-400" />}
              </div>
              <div className="space-y-3">
                {list.map((lesson) => {
                  const prog = progressMap.get(lesson.id);
                  const done = prog?.completed_at != null;
                  const inProgress = prog && !done && prog.exercises_done > 0;
                  const percent = prog && prog.total_exercises > 0
                    ? Math.round((prog.exercises_done / prog.total_exercises) * 100)
                    : 0;
                  return (
                    <Link
                      key={lesson.id}
                      to="/lesson/$id"
                      params={{ id: lesson.id }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md transition-all"
                    >
                      <div className="flex-shrink-0 size-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
                        {lesson.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Unidade {lesson.unit_number} · Lição {lesson.lesson_number}
                        </p>
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {lesson.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {lesson.grammar_focus}
                        </p>
                        {inProgress && (
                          <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {done ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate({ to: "/lesson/$id", params: { id: lesson.id } });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                          >
                            <RotateCcw className="size-3.5" /> Refazer
                          </span>
                        ) : (
                          <Play className="size-5 text-indigo-500 fill-current" />
                        )}
                      </div>

                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
