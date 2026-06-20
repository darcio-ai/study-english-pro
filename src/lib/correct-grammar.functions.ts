import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  userInput: z.string().min(1).max(2000),
  exercisePromptEn: z.string().min(1).max(500),
  exerciseContent: z.string().max(500).nullable().optional(),
  grammarFocus: z.string().min(1).max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]),
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
  score: z.number().int().min(0).max(100),
  positive_pt: z.string(),
});

export type Correction = z.infer<typeof CorrectionSchema>;

export const correctGrammar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<Correction> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an English grammar teacher for Brazilian Portuguese speakers.
Student level: ${data.level}.
Identify grammar errors in the student's answer. For each error provide:
- segment: exact incorrect text from student's answer
- corrected: corrected version of that segment
- type: short grammar category
- explanation_pt: explanation in Brazilian Portuguese, max 2 sentences
- rule: grammar rule in English, max 1 sentence
Also provide:
- corrected_text: full corrected version of the student's answer
- score: 0-100 reflecting overall correctness
- positive_pt: one encouraging sentence in Portuguese if score >= 60, else empty string
If the answer is fully correct, return empty errors array and score 100.`;

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
