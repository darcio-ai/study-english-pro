import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  language: z.enum(["en", "es"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  theme: z.string().min(1).max(200),
  objectivePt: z.string().min(1).max(500),
});

const ExtrasSchema = z.object({
  extra_phrases: z.array(z.object({ text: z.string(), translation_pt: z.string() })),
  extra_dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })),
});

export type ProgramExtras = {
  extra_phrases: { text: string; translation_pt: string }[];
  extra_dialogue: { speaker: string; line: string }[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeExtras(raw: unknown): ProgramExtras {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const phrases = Array.isArray(obj.extra_phrases) ? obj.extra_phrases : [];
  const dialogue = Array.isArray(obj.extra_dialogue) ? obj.extra_dialogue : [];
  return {
    extra_phrases: phrases
      .map((p) => {
        const item = (p ?? {}) as Record<string, unknown>;
        return { text: str(item.text), translation_pt: str(item.translation_pt) };
      })
      .filter((p) => p.text && p.translation_pt),
    extra_dialogue: dialogue
      .map((d) => {
        const item = (d ?? {}) as Record<string, unknown>;
        return { speaker: str(item.speaker) || "A", line: str(item.line) };
      })
      .filter((d) => d.line),
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

export const generateProgramExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ProgramExtras> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const targetLanguage = data.language === "es" ? "Spanish" : "English";
    const systemPrompt = `You are a ${targetLanguage} teacher for Brazilian Portuguese speakers.
Student level: ${data.level}.
Generate extra practice material for one day of a 15-day challenge, on the given theme.
Return:
- extra_phrases: 5 NEW useful phrases in ${targetLanguage} about the theme, each with translation_pt in Brazilian Portuguese
- extra_dialogue: a short dialogue (6 to 8 lines) in ${targetLanguage} between speakers A and B about the theme
Keep vocabulary appropriate for the level. Do not repeat obvious examples. Always return every field.`;

    const userMessage = `Theme: ${data.theme}
Objective: ${data.objectivePt}`;

    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userMessage,
        experimental_output: Output.object({ schema: ExtrasSchema as never }),
      });
      return normalizeExtras(experimental_output);
    } catch (err: unknown) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const parsed = parseLooseJson(err.text);
        if (parsed) return normalizeExtras(parsed);
        throw new Error("Não consegui gerar o conteúdo extra. Tente novamente.");
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        throw new Error("Muitas requisições. Aguarde um momento e tente novamente.");
      }
      if (msg.includes("402")) {
        throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      }
      throw new Error(`Falha ao gerar conteúdo extra: ${msg}`);
    }
  });
