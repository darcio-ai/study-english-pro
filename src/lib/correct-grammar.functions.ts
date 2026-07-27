import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  userInput: z.string().min(1).max(2000),
  exercisePromptEn: z.string().min(1).max(500),
  exerciseContent: z.string().max(500).nullable().optional(),
  grammarFocus: z.string().min(1).max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  language: z.enum(["en", "es"]).optional().default("en"),
});


const CorrectionSchema = z.object({
  errors: z.array(
    z.object({
      segment: z.string(),
      corrected: z.string(),
      type: z.string(),
      explanation_pt: z.string(),
      rule: z.string(),
    }),
  ),
  corrected_text: z.string(),
  score: z.number(),
  positive_pt: z.string(),
});

export type Correction = {
  errors: {
    segment: string;
    corrected: string;
    type: string;
    explanation_pt: string;
    rule: string;
  }[];
  corrected_text: string;
  score: number;
  positive_pt: string;
};

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCorrection(raw: unknown, fallbackText: string): Correction {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawErrors = Array.isArray(obj.errors) ? obj.errors : [];
  const errors = rawErrors
    .map((e) => {
      const item = (e ?? {}) as Record<string, unknown>;
      return {
        segment: str(item.segment),
        corrected: str(item.corrected),
        type: str(item.type) || "grammar",
        explanation_pt: str(item.explanation_pt),
        rule: str(item.rule),
      };
    })
    .filter((e) => e.segment || e.corrected || e.explanation_pt);

  return {
    errors,
    corrected_text: str(obj.corrected_text).trim() || fallbackText,
    score: clampScore(obj.score),
    positive_pt: str(obj.positive_pt),
  };
}

function parseLooseJson(text: string | undefined): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}


export const correctGrammar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<Correction> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const isEs = data.language === "es";
    const targetLanguage = isEs ? "Spanish" : "English";
    const extra = isEs
      ? `
The student is a Brazilian Portuguese speaker, so pay special attention to:
- "portunhol" (Portuguese words or spellings used as if they were Spanish)
- false friends (embarazada, exquisito, largo, oficina, pelado, rato, salsa, vaso)
- ser/estar, por/para, gender and number agreement, and use of the subjunctive
- missing accents and ñ`
      : "";

    const systemPrompt = `You are a ${targetLanguage} grammar teacher for Brazilian Portuguese speakers.
Student level: ${data.level}.
Identify grammar errors in the student's answer. For each error provide:
- segment: exact incorrect text from student's answer
- corrected: corrected version of that segment
- type: short grammar category
- explanation_pt: explanation in Brazilian Portuguese, max 2 sentences
- rule: grammar rule written in ${targetLanguage}, max 1 sentence
Also provide:
- corrected_text: full corrected version of the student's answer, in ${targetLanguage}
- score: 0-100 reflecting overall correctness
- positive_pt: one encouraging sentence in Portuguese if score >= 60, else empty string
If the answer is fully correct, return empty errors array and score 100.${extra}`;


    const userMessage = `Exercise instruction: ${data.exercisePromptEn}
${data.exerciseContent ? `Sentence to work with: ${data.exerciseContent}` : ""}
Grammar focus: ${data.grammarFocus}
Student answer: "${data.userInput}"`;

    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userMessage,
        experimental_output: Output.object({ schema: CorrectionSchema as never }),
      });
      return experimental_output as Correction;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        throw new Error("Muitas requisições. Aguarde um momento e tente novamente.");
      }
      if (msg.includes("402")) {
        throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      }
      throw new Error(`Falha ao corrigir: ${msg}`);
    }
  });
