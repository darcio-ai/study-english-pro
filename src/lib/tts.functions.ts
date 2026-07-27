import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  text: z.string().min(1).max(4000).transform((t) => t.slice(0, 1000)),
  voice: z.enum(["alloy", "echo", "shimmer", "coral", "sage"]).default("alloy"),
});

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ audioBase64: string; mimeType: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: data.voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const msg = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new Error("Muitas requisições. Aguarde um momento.");
      }
      if (response.status === 402) {
        throw new Error("Créditos de IA esgotados.");
      }
      throw new Error(`Falha ao gerar áudio: ${response.status} ${msg}`);
    }

    const buf = await response.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { audioBase64: base64, mimeType: "audio/mpeg" };
  });
