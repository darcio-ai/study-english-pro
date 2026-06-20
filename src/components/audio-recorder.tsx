import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 30;

type Status = "idle" | "recording" | "processing";

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
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const base64 = btoa(bin);
          await onRecorded({ base64, mimeType: recorder.mimeType });
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
