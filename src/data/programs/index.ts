// Desafio 15 dias — conteúdo estático dos programas (inglês e espanhol, 3 níveis).
// Os dias ficam em JSON ao lado deste arquivo; o banco guarda apenas o progresso do usuário.

export type ProgramLanguage = "en" | "es";
export type ProgramLevel = "beginner" | "intermediate" | "advanced";

export type ProgramQuizItem = {
  question: string;
  options: string[];
  answer: string;
};

export type ProgramDayContent = {
  vocabulary?: { term: string; translation_pt: string; example?: string }[];
  phrases?: { text: string; translation_pt: string }[];
  dialogue?: { speaker: string; line: string }[];
  quiz?: ProgramQuizItem[];
};

export type ProgramDay = {
  day: number;
  theme: string;
  objective_pt: string;
  kind: "lesson" | "review" | "final";
  content: ProgramDayContent;
};

export type ProgramMeta = {
  id: string;
  language: ProgramLanguage;
  level: ProgramLevel;
  title: string;
  descriptionPt: string;
  emoji: string;
};

export const PROGRAMS: ProgramMeta[] = [
  {
    id: "93b96cad-aec5-5cf2-85f2-961d18e8d4bd",
    language: "en",
    level: "beginner",
    title: "Desafio 15 dias — Inglês Iniciante",
    descriptionPt: "Do zero ao básico: cumprimentos, família, rotina, casa e comida, em 15 a 20 minutos por dia.",
    emoji: "🗓️",
  },
  {
    id: "6ce5ba4f-2061-57e2-9e98-754f7173ec08",
    language: "en",
    level: "intermediate",
    title: "Desafio 15 dias — Inglês Intermediário",
    descriptionPt: "Viagens, compras, planos e conversas do dia a dia para destravar seu inglês.",
    emoji: "🗓️",
  },
  {
    id: "5f4832c9-1aad-5a62-aee0-4da414233397",
    language: "en",
    level: "advanced",
    title: "Desafio 15 dias — Inglês Avançado",
    descriptionPt: "Negociações, expressões idiomáticas, debates e registros formais para lapidar seu inglês.",
    emoji: "🗓️",
  },
  {
    id: "de274568-a62b-5a81-a37a-a79c9c3fc329",
    language: "es",
    level: "beginner",
    title: "Desafio 15 dias — Espanhol Iniciante",
    descriptionPt: "Do zero ao básico: saudações, família, rotina, casa e comida, em 15 a 20 minutos por dia.",
    emoji: "🗓️",
  },
  {
    id: "ff202dbe-cfd1-5921-9193-8b475b960316",
    language: "es",
    level: "intermediate",
    title: "Desafio 15 dias — Espanhol Intermediário",
    descriptionPt: "Viagens, compras, planos e conversas do dia a dia para destravar seu espanhol.",
    emoji: "🗓️",
  },
  {
    id: "4005232e-8668-5cf2-bd0c-169b923841d7",
    language: "es",
    level: "advanced",
    title: "Desafio 15 dias — Espanhol Avançado",
    descriptionPt: "Negociações, expressões idiomáticas, debates e registros formais para lapidar seu espanhol.",
    emoji: "🗓️",
  },
];

export const PROGRAM_LEVEL_LABEL: Record<ProgramLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

const LOADERS: Record<string, () => Promise<{ default: { days: ProgramDay[] } }>> = {
  "en-beginner": () => import("./en-beginner.json") as never,
  "en-intermediate": () => import("./en-intermediate.json") as never,
  "en-advanced": () => import("./en-advanced.json") as never,
  "es-beginner": () => import("./es-beginner.json") as never,
  "es-intermediate": () => import("./es-intermediate.json") as never,
  "es-advanced": () => import("./es-advanced.json") as never,
};

const cache = new Map<string, ProgramDay[]>();

/** Load the 15 days of one program (lazy, cached). */
export async function loadProgramDays(language: ProgramLanguage, level: ProgramLevel): Promise<ProgramDay[]> {
  const key = `${language}-${level}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mod = await LOADERS[key]!();
  const days = mod.default.days;
  cache.set(key, days);
  return days;
}
