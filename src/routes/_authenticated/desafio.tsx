import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";
import { addXp, checkAndGrantAchievements, xpForScore } from "@/lib/learning";
import { generateProgramExtras, type ProgramExtras } from "@/lib/generate-program-extras.functions";
import {
  PROGRAMS,
  PROGRAM_LEVEL_LABEL,
  loadProgramDays,
  type ProgramDay,
  type ProgramLevel,
  type ProgramMeta,
} from "@/data/programs";

export const Route = createFileRoute("/_authenticated/desafio")({
  head: () => ({
    meta: [
      { title: "Desafio 15 dias — EnglishUp" },
      {
        name: "description",
        content: "Programa guiado de 15 dias com vocabulário, frases, diálogos e quiz diário, em inglês ou espanhol.",
      },
      { property: "og:title", content: "Desafio 15 dias — EnglishUp" },
      {
        property: "og:description",
        content: "15 dias de estudo guiado, 15 a 20 minutos por dia, com revisões e teste final.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChallengePage,
});

type ProgressRow = {
  id: string;
  program_id: string;
  current_day: number;
  completed_days: number[];
  status: string;
};

function ChallengePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { language } = useLanguage(user.id);

  const levelQuery = useQuery({
    queryKey: ["user_level", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.level ?? "beginner") as ProgramLevel;
    },
  });

  const progressQuery = useQuery({
    queryKey: ["program_progress", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_program_progress")
        .select("id, program_id, current_day, completed_days, status")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });

  const programs = useMemo(() => PROGRAMS.filter((p) => p.language === language), [language]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId || !progressQuery.data || !levelQuery.data) return;
    const active = progressQuery.data.find((r) => r.status === "active");
    const activeProgram = active && programs.find((p) => p.id === active.program_id);
    const levelProgram = programs.find((p) => p.level === levelQuery.data);
    setSelectedId((activeProgram ?? levelProgram ?? programs[0])?.id ?? null);
  }, [selectedId, progressQuery.data, levelQuery.data, programs]);

  const program = programs.find((p) => p.id === selectedId) ?? null;
  const progress = progressQuery.data?.find((r) => r.program_id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/inicio" className="p-2 -ml-2 text-gray-500 dark:text-gray-400">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Desafio 15 dias</h1>
        </div>

        <div className="flex gap-2 mb-5">
          {programs.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-colors ${
                p.id === selectedId
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {PROGRAM_LEVEL_LABEL[p.level]}
            </button>
          ))}
        </div>

        {!program || progressQuery.isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando…</p>
        ) : (
          <ProgramView
            key={program.id}
            userId={user.id}
            program={program}
            progress={progress}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["program_progress", user.id] })}
          />
        )}
      </div>
    </main>
  );
}

function ProgramView({
  userId,
  program,
  progress,
  onChanged,
}: {
  userId: string;
  program: ProgramMeta;
  progress: ProgressRow | null;
  onChanged: () => void;
}) {
  const [days, setDays] = useState<ProgramDay[] | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProgramDays(program.language, program.level).then((d) => {
      if (!cancelled) setDays(d);
    });
    return () => {
      cancelled = true;
    };
  }, [program.language, program.level]);

  const completedDays = progress?.completed_days ?? [];
  const currentDay = progress?.current_day ?? 1;
  const isDone = progress?.status === "completed";

  async function start() {
    const { error } = await supabase.from("user_program_progress").insert({
      user_id: userId,
      program_id: program.id,
      current_day: 1,
      completed_days: [],
      status: "active",
    });
    if (error) {
      toast.error("Não foi possível iniciar o desafio.");
      return;
    }
    onChanged();
    setOpenDay(1);
  }

  async function restart() {
    if (!progress) return;
    await supabase
      .from("user_program_progress")
      .update({ current_day: 1, completed_days: [], status: "active" })
      .eq("id", progress.id);
    onChanged();
    setOpenDay(1);
  }

  return (
    <div>
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
        <h2 className="font-bold text-gray-900 dark:text-white">{program.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{program.descriptionPt}</p>
        {progress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{completedDays.length}/15 dias concluídos</span>
              {isDone && <span className="font-semibold text-emerald-600">Concluído 🎉</span>}
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600"
                style={{ width: `${Math.round((completedDays.length / 15) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {!progress && (
          <button
            onClick={start}
            className="mt-4 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Começar o desafio
          </button>
        )}
        {progress && (
          <button
            onClick={restart}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:underline"
          >
            <RotateCcw className="size-3.5" /> Recomeçar do dia 1
          </button>
        )}
      </section>

      {progress && days && (
        <>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {days.map((d) => {
              const done = completedDays.includes(d.day);
              const locked = !done && d.day > currentDay;
              const isCurrent = !done && d.day === currentDay;
              return (
                <button
                  key={d.day}
                  disabled={locked}
                  onClick={() => setOpenDay(openDay === d.day ? null : d.day)}
                  className={`aspect-square rounded-xl text-sm font-bold flex items-center justify-center border transition-colors ${
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isCurrent
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : locked
                          ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {done ? <Check className="size-4" /> : locked ? <Lock className="size-3.5" /> : d.day}
                </button>
              );
            })}
          </div>

          {isDone && (
            <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 mb-4 text-center">
              <Trophy className="size-8 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-gray-900 dark:text-white">Desafio concluído!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Você terminou os 15 dias. Refaça quando quiser ou suba de nível.
              </p>
            </section>
          )}

          {openDay !== null && days[openDay - 1] && (
            <DayView
              key={`${program.id}-${openDay}-${completedDays.length}`}
              userId={userId}
              program={program}
              day={days[openDay - 1]!}
              alreadyDone={completedDays.includes(openDay)}
              progress={progress}
              onCompleted={onChanged}
            />
          )}

          {openDay === null && !isDone && (
            <button
              onClick={() => setOpenDay(currentDay)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              Abrir dia {currentDay}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DayView({
  userId,
  program,
  day,
  alreadyDone,
  progress,
  onCompleted,
}: {
  userId: string;
  program: ProgramMeta;
  day: ProgramDay;
  alreadyDone: boolean;
  progress: ProgressRow;
  onCompleted: () => void;
}) {
  const quiz = day.content.quiz ?? [];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extras, setExtras] = useState<ProgramExtras | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const correct = quiz.filter((q, i) => answers[i] === q.answer).length;
  const score = quiz.length > 0 ? Math.round((correct / quiz.length) * 100) : 100;
  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);

  const kindLabel = day.kind === "review" ? "Revisão" : day.kind === "final" ? "Teste final" : "Lição";

  async function completeDay() {
    setSaving(true);
    try {
      const nextCompleted = Array.from(new Set([...progress.completed_days, day.day])).sort((a, b) => a - b);
      const finished = nextCompleted.length >= 15;
      const { error } = await supabase
        .from("user_program_progress")
        .update({
          completed_days: nextCompleted,
          current_day: Math.min(15, Math.max(progress.current_day, day.day + 1)),
          status: finished ? "completed" : "active",
        })
        .eq("id", progress.id);
      if (error) throw error;

      await supabase.from("attempts").insert({
        user_id: userId,
        user_input: `Desafio 15 dias — dia ${day.day}: ${day.theme}`,
        score,
        grammar_focus: `desafio:${day.theme}`,
        level: program.level,
        mode: "writing",
      });

      const xp = xpForScore(score) + (day.kind === "final" ? 30 : 5);
      await addXp(userId, xp);
      const unlocked = await checkAndGrantAchievements(userId);
      toast.success(`Dia ${day.day} concluído! +${xp} XP`);
      if (unlocked.length > 0) toast.success(`🏆 Nova conquista desbloqueada!`);
      onCompleted();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function generateExtras() {
    setLoadingExtras(true);
    try {
      const result = await generateProgramExtras({
        data: {
          language: program.language,
          level: program.level,
          theme: day.theme,
          objectivePt: day.objective_pt,
        },
      });
      if (result.extra_phrases.length === 0 && result.extra_dialogue.length === 0) {
        toast.error("A IA não retornou conteúdo. Tente novamente.");
      } else {
        setExtras(result);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar conteúdo extra.");
    } finally {
      setLoadingExtras(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Dia {day.day} · {kindLabel}
        </span>
        {alreadyDone && <Check className="size-4 text-emerald-500" />}
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{day.theme}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{day.objective_pt}</p>

      {day.content.vocabulary && day.content.vocabulary.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📚 Vocabulário</h4>
          <div className="space-y-1.5">
            {day.content.vocabulary.map((v, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
                <span className="font-medium text-gray-900 dark:text-white">{v.term}</span>
                <span className="text-gray-500 dark:text-gray-400 text-right">{v.translation_pt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {day.content.phrases && day.content.phrases.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">💬 Frases úteis</h4>
          <div className="space-y-1.5">
            {day.content.phrases.map((p, i) => (
              <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.text}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p.translation_pt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {day.content.dialogue && day.content.dialogue.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🗣️ Diálogo</h4>
          <div className="space-y-1.5">
            {day.content.dialogue.map((l, i) => (
              <p key={i} className="text-sm text-gray-800 dark:text-gray-200">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{l.speaker}:</span> {l.line}
              </p>
            ))}
          </div>
        </div>
      )}

      {quiz.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">✅ Quiz ({quiz.length} perguntas)</h4>
          <div className="space-y-4">
            {quiz.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                  {qi + 1}. {q.question}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {q.options.map((opt) => {
                    const selected = answers[qi] === opt;
                    const isAnswer = checked && opt === q.answer;
                    const isWrong = checked && selected && opt !== q.answer;
                    return (
                      <button
                        key={opt}
                        disabled={checked}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: opt }))}
                        className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                          isAnswer
                            ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-800 dark:text-emerald-200"
                            : isWrong
                              ? "bg-red-50 dark:bg-red-900/30 border-red-400 text-red-800 dark:text-red-200"
                              : selected
                                ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-gray-900 dark:text-white"
                                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!checked ? (
            <button
              onClick={() => setChecked(true)}
              disabled={!allAnswered}
              className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold disabled:opacity-40"
            >
              Verificar respostas
            </button>
          ) : (
            <p className="mt-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
              Você acertou {correct}/{quiz.length} — nota {score}/100
            </p>
          )}
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
        <button
          onClick={generateExtras}
          disabled={loadingExtras}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-semibold disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          {loadingExtras ? "Gerando com IA…" : extras ? "Gerar outra variação" : "Quero mais prática (IA)"}
        </button>

        {extras && (
          <div className="mt-3 space-y-3">
            {extras.extra_phrases.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">✨ Frases extras</h4>
                <div className="space-y-1.5">
                  {extras.extra_phrases.map((p, i) => (
                    <div key={i} className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{p.text}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.translation_pt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {extras.extra_dialogue.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">✨ Diálogo extra</h4>
                <div className="space-y-1.5">
                  {extras.extra_dialogue.map((l, i) => (
                    <p key={i} className="text-sm text-gray-800 dark:text-gray-200">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{l.speaker}:</span> {l.line}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!alreadyDone && (
        <button
          onClick={completeDay}
          disabled={saving || (quiz.length > 0 && !checked)}
          className="mt-4 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-40"
        >
          {saving ? "Salvando…" : `Concluir dia ${day.day}`}
        </button>
      )}
    </section>
  );
}
