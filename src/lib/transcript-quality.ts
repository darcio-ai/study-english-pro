export const MAX_STT_ATTEMPTS = 3;

const NON_LATIN =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u2E80-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/;

/**
 * Returns true when the transcription clearly isn't usable speech in the
 * target (latin-script) language — e.g. Chinese/Japanese/Cyrillic output,
 * empty text, or almost no latin letters.
 */
export function isUnreliableTranscript(raw: string | undefined | null): boolean {
  const text = (raw ?? "").trim();
  if (text.length < 2) return true;
  if (NON_LATIN.test(text)) return true;
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return true;
  return letters.length / text.length < 0.4;
}

export const UNRELIABLE_MESSAGE =
  "Não consegui entender o áudio. Vamos tentar de novo?";
