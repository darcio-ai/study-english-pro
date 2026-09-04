import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 30;
const TARGET_RATE = 16000;

type Status = "idle" | "recording" | "processing";

/** Decode any recorded container and re-encode as 16 kHz mono 16-bit WAV. */
async function toWav(input: ArrayBuffer): Promise<ArrayBuffer> {
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(input.slice(0));
  } finally {
    void ctx.close();
  }

  // Downmix to mono
  const chans = decoded.numberOfChannels;
  const mono = new Float32Array(decoded.length);
  for (let c = 0; c < chans; c++) {
    const d = decoded.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / chans;
  }

  // Resample (linear) to TARGET_RATE
  const ratio = decoded.sampleRate / TARGET_RATE;
  const outLen = Math.max(1, Math.floor(mono.length / ratio));
  const samples = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = pos - i0;
    samples[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}


export function AudioRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (audio: { base64: string; mimeType: string }) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mime) {
        stream.getTracks().forEach((t) => t.stop());
        toast.error("Seu navegador não suporta gravação de áudio.");
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size < 1024) {
          setStatus("idle");
          toast.error("Gravação muito curta. Tente novamente.");
          return;
        }
        setStatus("processing");
        try {
          const buf = await blob.arrayBuffer();
          const wav = await toWav(buf);
          const bytes = new Uint8Array(wav);
          let bin = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
          }
          const base64 = btoa(bin);
          await onRecorded({ base64, mimeType: "audio/wav" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao processar áudio");
        } finally {
          setStatus("idle");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);
    } catch {
      toast.error("Permissão de microfone negada.");
    }
  }

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }

  const isRec = status === "recording";
  const isProc = status === "processing";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={isRec ? stop : start}
        disabled={disabled || isProc}
        aria-label={isRec ? "Parar gravação" : "Iniciar gravação"}
        className={`size-24 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isRec
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : isProc
            ? "bg-gray-400"
            : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
        } text-white disabled:opacity-50`}
      >
        {isProc ? (
          <Loader2 className="size-10 animate-spin" />
        ) : isRec ? (
          <Square className="size-10 fill-current" />
        ) : (
          <Mic className="size-10" />
        )}
      </button>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {isRec
          ? `🔴 Gravando... ${seconds}s / ${MAX_SECONDS}s`
          : isProc
          ? "Processando..."
          : "Toque para gravar"}
      </p>
    </div>
  );
}
