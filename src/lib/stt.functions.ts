import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1),
  language: z.enum(["en", "es"]).optional().default("en"),
  prompt: z.string().max(500).optional(),
});



function extFromMime(mime: string): string {
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m === "audio/webm") return "webm";
  if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/m4a") return "m4a";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/ogg") return "ogg";
  return "webm";
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.length < 512) {
      throw new Error("Áudio muito curto ou vazio. Tente gravar novamente.");
    }

    const ext = extFromMime(data.mimeType);
    const blob = new Blob([new Uint8Array(bytes)], { type: data.mimeType });
    const form = new FormData();
    form.append("file", blob, `recording.${ext}`);
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("language", data.language ?? "en");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const msg = await response.text().catch(() => "");
      if (response.status === 429) throw new Error("Muitas requisições. Aguarde um momento.");
      if (response.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na transcrição: ${response.status} ${msg}`);
    }

    const json = (await response.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
