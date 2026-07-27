import { LANGUAGES, LANGUAGE_FLAG, LANGUAGE_LABEL, type Language } from "@/lib/learning";

export function LanguageSwitch({
  value,
  onChange,
  size = "md",
}: {
  value: Language;
  onChange: (lang: Language) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm";
  return (
    <div
      role="group"
      aria-label="Idioma que você está estudando"
      className="inline-flex gap-1 p-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          aria-pressed={value === lang}
          className={`rounded-lg font-semibold transition-all ${pad} ${
            value === lang
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          {LANGUAGE_FLAG[lang]} {LANGUAGE_LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
