import type { NormalizedCall, TranscriptTurn } from "./types";

const SPEAKER_LINE =
  /^(agent|assistant|bot|receptionist|rep|ai|caller|customer|user|patient|client|guest|speaker\s*\d+|[ac])\s*[:\-–—]\s*(.*)$/i;

const AGENT_NAMES = new Set([
  "agent",
  "assistant",
  "bot",
  "receptionist",
  "rep",
  "ai",
  "a",
]);

const CALLER_NAMES = new Set([
  "caller",
  "customer",
  "user",
  "patient",
  "client",
  "guest",
  "c",
]);

const TURN_KEYS = [
  "utterances",
  "transcript_object",
  "messages",
  "segments",
  "turns",
  "results",
];

export function fingerprint(plain: string): string {
  return plain.replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeTranscript(input: string): NormalizedCall {
  const raw = input.replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return {
      turns: [],
      plainText: "",
      format: "plain",
      warnings: ["The transcript is empty."],
    };
  }

  if (raw.startsWith("WEBVTT")) {
    return finalize(parseVtt(raw), "vtt");
  }

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return finalize(parseJsonValue(JSON.parse(raw) as unknown), "json");
    } catch {
      return finalize(parsePlain(raw), "plain", [
        "This looks like JSON, but it did not parse. It was read as plain text.",
      ]);
    }
  }

  return finalize(parsePlain(raw), "plain");
}

function finalize(
  partial: {
    turns: TranscriptTurn[];
    durationSeconds?: number;
    warnings?: string[];
  },
  format: NormalizedCall["format"],
  extraWarnings: string[] = [],
): NormalizedCall {
  const warnings = [...(partial.warnings ?? []), ...extraWarnings];
  const turns = partial.turns.filter((turn) => turn.text.trim().length > 0);
  if (turns.length === 0) {
    warnings.push("No spoken turns were found.");
  } else if (turns.every((turn) => turn.speaker === "unknown")) {
    warnings.push(
      "No speaker labels were found. The judge will treat the text as one unlabeled call.",
    );
  }
  return {
    turns,
    plainText: turns
      .map((turn) => `${turn.speakerLabel}: ${turn.text.trim()}`)
      .join("\n"),
    format,
    durationSeconds: partial.durationSeconds,
    warnings,
  };
}

export function parsePlain(input: string): {
  turns: TranscriptTurn[];
  warnings: string[];
} {
  const turns: TranscriptTurn[] = [];
  const warnings: string[] = [];

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(SPEAKER_LINE);
    if (!match) {
      const previous = turns[turns.length - 1];
      if (previous) {
        previous.text = `${previous.text} ${trimmed}`.trim();
      } else {
        turns.push(makeTurn("unknown", "Speaker", trimmed));
      }
      continue;
    }
    const label = match[1] ?? "Speaker";
    const text = (match[2] ?? "").trim();
    const speaker = speakerFromLabel(label);
    turns.push(
      makeTurn(
        speaker,
        speaker === "agent" ? "Agent" : speaker === "caller" ? "Caller" : label,
        text,
      ),
    );
  }

  return { turns, warnings };
}

function parseVtt(input: string): { turns: TranscriptTurn[]; warnings: string[] } {
  const body = input
    .replace(/^WEBVTT[^\n]*\n/, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(
      /\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*\n/g,
      "",
    );
  const parsed = parsePlain(body);
  parsed.warnings.unshift("Read as a WebVTT caption file.");
  return parsed;
}

function parseJsonValue(value: unknown): {
  turns: TranscriptTurn[];
  durationSeconds?: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (typeof value === "string") {
    return { ...parsePlain(value), warnings };
  }

  const record = asRecord(value);
  const durationSeconds = readDuration(record);
  const embedded =
    record && typeof record.transcript === "string" ? record.transcript : null;
  const list = findTurnArray(value, 0);

  if (!list) {
    if (embedded) return { ...parsePlain(embedded), durationSeconds, warnings };
    warnings.push("JSON did not contain a list of turns.");
    return { turns: [], durationSeconds, warnings };
  }

  const turns: TranscriptTurn[] = [];
  let skipped = 0;
  for (const item of list) {
    const turn = turnFromUnknown(item);
    if (turn) turns.push(turn);
    else skipped += 1;
  }
  if (skipped > 0) {
    warnings.push(`${skipped} JSON item${skipped === 1 ? "" : "s"} had no text and were skipped.`);
  }
  if (turns.length === 0 && embedded) {
    return { ...parsePlain(embedded), durationSeconds, warnings };
  }
  return { turns, durationSeconds, warnings };
}

function findTurnArray(value: unknown, depth: number): unknown[] | null {
  if (Array.isArray(value)) {
    return value.some((item) => item && typeof item === "object") ? value : null;
  }
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  for (const key of TURN_KEYS) {
    if (!(key in record)) continue;
    const nested = findTurnArray(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function turnFromUnknown(value: unknown): TranscriptTurn | null {
  const record = asRecord(value);
  if (!record) return null;
  const text = firstString(record, ["text", "content", "transcript", "utterance"]);
  if (!text) return null;
  const label =
    firstString(record, ["speaker", "role", "speaker_label", "speakerLabel"]) ??
    "Speaker";
  const speaker = speakerFromLabel(label);
  const speakerLabel =
    speaker === "agent" ? "Agent" : speaker === "caller" ? "Caller" : label;
  const start = firstNumber(record, ["start", "start_time", "startSeconds", "start_ms"]);
  const end = firstNumber(record, ["end", "end_time", "endSeconds", "end_ms"]);
  const turn = makeTurn(speaker, speakerLabel, text.trim());
  if (start != null) {
    turn.startSeconds = start > 1000 ? start / 1000 : start;
  }
  if (end != null) {
    turn.endSeconds = end > 1000 ? end / 1000 : end;
  }
  return turn;
}

function makeTurn(
  speaker: TranscriptTurn["speaker"],
  speakerLabel: string,
  text: string,
): TranscriptTurn {
  return { speaker, speakerLabel, text };
}

function speakerFromLabel(label: string): TranscriptTurn["speaker"] {
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  if (AGENT_NAMES.has(key)) return "agent";
  if (CALLER_NAMES.has(key)) return "caller";
  if (key.includes("agent") || key.includes("assistant") || key.includes("bot")) {
    return "agent";
  }
  if (key.includes("caller") || key.includes("customer") || key.includes("user")) {
    return "caller";
  }
  return "unknown";
}

function readDuration(record: Record<string, unknown> | null): number | undefined {
  if (!record) return undefined;
  const value = firstNumber(record, [
    "duration_seconds",
    "durationSeconds",
    "duration",
  ]);
  if (value == null) return undefined;
  return value > 1000 ? value / 1000 : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function firstNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

export function agentTurns(call: NormalizedCall): TranscriptTurn[] {
  return call.turns.filter((turn) => turn.speaker === "agent");
}

export function callerTurns(call: NormalizedCall): TranscriptTurn[] {
  return call.turns.filter((turn) => turn.speaker === "caller");
}
