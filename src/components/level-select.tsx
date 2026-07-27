import { LEVELS, LEVEL_LABEL, type Level } from "@/components/englishup";

type Props = {
  value: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Segmented control to pick the difficulty of a free-practice session.
 */
export function LevelSelect({ value, onChange, disabled, className = "" }: Props) {
  return (
    <div
      role="group"
      aria-label="Nível da prática"
      className={`inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 ${className}`}
    >
      {LEVELS.map((lvl: Level) => (
        <button
          key={lvl}
          type="button"
          disabled={disabled}
          aria-pressed={value === lvl}
          onClick={() => value !== lvl && onChange(lvl)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
            value === lvl
              ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          {LEVEL_LABEL[lvl]}
        </button>
      ))}
    </div>
  );
}
