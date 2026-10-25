"use client";

import { useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/judge-client";
import { normalizeTranscript } from "@/lib/rubric";
import { cn } from "@/lib/utils";

export function TranscriptField({
  id,
  label,
  value,
  onChange,
  format,
  onFormat,
  plain,
  audioJson,
  showFormats = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  format: "plain" | "json";
  onFormat: (format: "plain" | "json") => void;
  plain: string;
  audioJson: string;
  showFormats?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const preview = useMemo(() => normalizeTranscript(value), [value]);
  const duration = formatDuration(preview.durationSeconds);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex flex-wrap gap-2">
          {showFormats ? (
            <div className="flex rounded-lg bg-muted p-0.5">
              <FormatButton active={format === "plain"} onClick={() => onFormat("plain")}>
                Plain text
              </FormatButton>
              <FormatButton active={format === "json"} onClick={() => onFormat("json")}>
                Audio JSON
              </FormatButton>
            </div>
          ) : null}
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.json,.vtt,text/plain,application/json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 500_000) {
                setUploadError("Keep uploads under 500 KB.");
                return;
              }
              setUploadError(null);
              const text = await file.text();
              onChange(text);
              onFormat(text.trim().startsWith("{") || text.trim().startsWith("[") ? "json" : "plain");
            }}
          />
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="field-sizing-fixed max-h-96 min-h-64 font-mono text-[13px] leading-relaxed"
        placeholder={"Agent: Thanks for calling.\nCaller: I need to book a visit."}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {preview.turns.length === 0
            ? "No turns yet."
            : `${preview.turns.length} turns · ${preview.turns.filter((turn) => turn.speaker === "agent").length} agent · ${preview.turns.filter((turn) => turn.speaker === "caller").length} caller`}
          {duration ? ` · ${duration}` : ""}
        </p>
        <div className="flex gap-3">
          <button type="button" className="hover:text-foreground" onClick={() => onChange(plain)}>
            Load plain sample
          </button>
          {showFormats ? (
            <button type="button" className="hover:text-foreground" onClick={() => { onChange(audioJson); onFormat("json"); }}>
              Load JSON sample
            </button>
          ) : null}
        </div>
      </div>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      {preview.warnings.length > 0 ? (
        <p className="text-xs text-[var(--review)]">{preview.warnings.join(" ")}</p>
      ) : null}
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
