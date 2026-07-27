import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  transcript: z.string().min(1).max(2000),
  original: z.string().min(1).max(2000),
  mode: z.enum(["read", "free"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  promptEn: z.string().max(500).optional(),
  language: z.enum(["en", "es"]).optional().default("en"),
});


const EvaluationSchema = z.object({
  score: z.number(),
  accuracy_pct: z.number(),
  mispronounced_words: z.array(z.string()),
  corrected_text: z.string(),
  feedback_pt: z.string(),
});

export type SpeakingEvaluation = {
  score: number;
  accuracy_pct: number;
  mispronounced_words: string[];
  corrected_text: string;
  feedback_pt: string;
};

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeEvaluation(raw: unknown, fallbackText: string): SpeakingEvaluation {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const words = Array.isArray(obj.mispronounced_words)
    ? obj.mispronounced_words.map((w) => str(w)).filter(Boolean)
    : [];
  return {
    score: clampScore(obj.score),
    accuracy_pct: clampScore(obj.accuracy_pct),
    mispronounced_words: words,
    corrected_text: str(obj.corrected_text).trim() || fallbackText,
    feedback_pt: str(obj.feedback_pt),
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


export const evaluateSpeaking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<SpeakingEvaluation> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const targetLanguage = data.language === "es" ? "Spanish" : "English";

    const system =
      data.mode === "read"
        ? `You are a ${targetLanguage} pronunciation coach for Brazilian Portuguese speakers.
Compare the student's TRANSCRIBED speech to the ORIGINAL sentence they were supposed to read aloud.
- score: 0-100 reflecting how closely the transcript matches the original (case/punctuation insensitive).
- accuracy_pct: 0-100, percentage of words correctly spoken in order.
- mispronounced_words: list of original words that appear missing, distorted, or replaced in the transcript.
- corrected_text: the original sentence (verbatim).
- feedback_pt: 1-2 short sentences in Brazilian Portuguese with concrete pronunciation tips. Praise if score >= 85.`
        : `You are a ${targetLanguage} speaking tutor for Brazilian Portuguese speakers.
The student answered a free conversation prompt aloud. The TRANSCRIPT is what they actually said.
Student level: ${data.level}.
Evaluate fluency, grammar, vocabulary, and relevance to the question.
- score: 0-100 overall.
- accuracy_pct: 0-100, grammar correctness percentage.
- mispronounced_words: list of words that look like transcription errors hinting at pronunciation issues (max 5; empty if none clear).
- corrected_text: improved/natural version of what the student said, written in ${targetLanguage}.
- feedback_pt: 2-3 short sentences in Brazilian Portuguese with constructive feedback. Praise effort.`;

    const userMessage =
      data.mode === "read"
        ? `ORIGINAL: "${data.original}"
TRANSCRIPT: "${data.transcript}"`
        : `QUESTION (${targetLanguage}): "${data.promptEn ?? ""}"
SUGGESTED STRUCTURE: "${data.original}"
STUDENT TRANSCRIPT: "${data.transcript}"`;


    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt: userMessage,
        experimental_output: Output.object({ schema: EvaluationSchema as never }),
      });
      return experimental_output as SpeakingEvaluation;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("Muitas requisições. Aguarde.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha ao avaliar: ${msg}`);
    }
  });
