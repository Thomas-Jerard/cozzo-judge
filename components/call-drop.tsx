"use client";

import { useState } from "react";
import { isRateLimitError, postFormStream, type RequestMode, type StreamStep } from "@/lib/judge-client";
import { audioFileProblem } from "@/lib/transcribe/limits";

export function CallDrop({
  mode,
  disabled,
  onTranscript,
}: {
  mode: RequestMode;
  disabled?: boolean;
  onTranscript: (transcript: string, note: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function transcribe(next: File, forced?: RequestMode) {
    const problem = audioFileProblem(next.name, next.size);
    if (problem) {
      setError(problem);
      setRateLimited(false);
      return;
    }
    setFile(next);
    setBusy(true);
    setError(null);
    setRateLimited(false);
    setProgress("Reading the recording…");
    const body = new FormData();
    body.set("file", next);
    body.set("mode", forced ?? mode);
    try {
      const result = await postFormStream<{ type: "result"; transcript: string; note: string }>("/api/transcribe", body, (step) => {
        setProgress(progressCopy(step));
      });
      onTranscript(result.transcript, result.note);
      setProgress(null);
    } catch (caught) {
      setProgress(null);
      setRateLimited(isRateLimitError(caught));
      setError(caught instanceof Error ? caught.message : "The transcription failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label
        aria-busy={busy}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && !disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (busy || disabled) return;
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) void transcribe(dropped);
        }}
        className={`grid cursor-pointer gap-1 rounded-2xl border border-dashed px-4 py-4 ${over ? "border-foreground bg-card" : "border-border"} ${busy || disabled ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          type="file"
          accept=".mp3,.wav,.m4a,.webm,.mp4,.ogg,audio/*,video/mp4,video/webm,video/ogg"
          className="sr-only"
          aria-label="Call recording"
          disabled={busy || disabled}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            if (picked) void transcribe(picked);
          }}
        />
        <span className="text-sm font-medium">{progress ?? "Drop a recording, or click to browse"}</span>
        <span className="text-sm leading-relaxed text-muted-foreground">
          mp3, wav, m4a, webm, mp4, or ogg. Up to 4 MB and 10 minutes.
        </span>
      </label>
      {error ? (
        <div className="grid gap-2">
          <p role="alert" className="text-sm leading-relaxed">
            {error}
          </p>
          {rateLimited && file ? (
            <button
              type="button"
              className="w-fit text-sm font-medium underline-offset-4 hover:underline"
              disabled={busy}
              onClick={() => void transcribe(file, "mock")}
            >
              Transcribe with the practice judge
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function progressCopy(step: StreamStep): string {
  if (step === "label") return "Labeling Agent and Caller…";
  if (step === "transcribe") return "Transcribing the words…";
  return "Reading the recording…";
}
