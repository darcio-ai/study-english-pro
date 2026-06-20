import { ReactNode } from "react";

export type Level = "beginner" | "intermediate" | "advanced";

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

const LEVEL_CLASSES: Record<Level, string> = {
  beginner:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  intermediate:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  advanced:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function LevelPill({
  level,
  size = "md",
  interactive = false,
}: {
  level: Level;
  size?: "sm" | "md";
  interactive?: boolean;
}) {
  const sizeCls = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeCls} ${LEVEL_CLASSES[level]} ${
        interactive ? "ring-1 ring-inset ring-black/5 cursor-pointer" : ""
      }`}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  let cls = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900";
  if (score >= 80) {
    cls = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-900";
  } else if (score >= 50) {
    cls = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900";
  }
  return (
    <span className={`inline-flex items-center text-xs font-semibold rounded-full border px-2 py-0.5 ${cls}`}>
      {score}
    </span>
  );
}

export function GrammarFocusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
      {children}
    </span>
  );
}
