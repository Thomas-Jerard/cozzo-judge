import { extractJsonObject } from "@/lib/rubric/parse";

export interface SpeechSegment {
  text: string;
  start: number;
  end: number;
}

export interface LabeledTurn {
  speaker: "agent" | "caller";
  text: string;
}

const GAP_SECONDS = 0.7;

export function segmentsFromWhisper(output: { text?: string; chunks?: { text?: string; timestamp?: [number | null, number | null] }[] }): SpeechSegment[] {
  const chunks = output.chunks ?? [];
  const segments = chunks
    .map((chunk) => ({
      text: cleanSpeech(chunk.text ?? ""),
      start: typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : 0,
      end: typeof chunk.timestamp?.[1] === "number" ? chunk.timestamp[1] : 0,
    }))
    .filter((segment) => segment.text.length > 0);
  if (segments.length > 0) return segments;
  const text = cleanSpeech(output.text ?? "");
  return text ? [{ text, start: 0, end: 0 }] : [];
}

export function labelLocally(segments: SpeechSegment[]): LabeledTurn[] {
  const turns: LabeledTurn[] = [];
  let speaker: LabeledTurn["speaker"] = "agent";
  let lastEnd = 0;
  for (const segment of segments) {
    if (turns.length > 0 && segment.start - lastEnd >= GAP_SECONDS) {
      speaker = speaker === "agent" ? "caller" : "agent";
    }
    pushTurn(turns, speaker, segment.text);
    lastEnd = Math.max(lastEnd, segment.end);
  }
  return turns;
}

export function parseSpeakerLabels(raw: string): LabeledTurn[] | null {
  try {
    const value = extractJsonObject(raw, (item) => {
      return Boolean(item) && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as { turns?: unknown }).turns);
    }) as { turns?: unknown };
    if (!Array.isArray(value.turns)) return null;
    const turns: LabeledTurn[] = [];
    for (const item of value.turns) {
      if (!item || typeof item !== "object") continue;
      const record = item as { speaker?: unknown; text?: unknown };
      const speaker = record.speaker === "caller" ? "caller" : record.speaker === "agent" ? "agent" : null;
      const text = typeof record.text === "string" ? cleanSpeech(record.text) : "";
      if (!speaker || !text) continue;
      pushTurn(turns, speaker, text);
    }
    return turns.length > 0 ? turns : null;
  } catch {
    return null;
  }
}

export function formatTranscript(turns: LabeledTurn[]): string {
  return turns
    .filter((turn) => turn.text.trim().length > 0)
    .map((turn) => `${turn.speaker === "agent" ? "Agent" : "Caller"}: ${turn.text.trim()}`)
    .join("\n");
}

function pushTurn(turns: LabeledTurn[], speaker: LabeledTurn["speaker"], text: string) {
  const clean = cleanSpeech(text);
  if (!clean) return;
  const previous = turns[turns.length - 1];
  if (previous && previous.speaker === speaker) {
    previous.text = `${previous.text} ${clean}`.trim();
    return;
  }
  turns.push({ speaker, text: clean });
}

function cleanSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
