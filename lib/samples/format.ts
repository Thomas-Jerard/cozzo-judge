export interface SampleTurn {
  speaker: "agent" | "caller";
  text: string;
  start: number;
  end: number;
}

export function script(
  lines: { speaker: "agent" | "caller"; text: string }[],
): SampleTurn[] {
  let cursor = 0.6;
  return lines.map((line) => {
    const start = round1(cursor);
    const duration = Math.max(1.5, line.text.split(/\s+/).length * 0.36);
    const end = round1(start + duration);
    cursor = end + 0.4;
    return { speaker: line.speaker, text: line.text, start, end };
  });
}

export function renderPlain(turns: SampleTurn[]): string {
  return turns
    .map((turn) => `${turn.speaker === "agent" ? "Agent" : "Caller"}: ${turn.text}`)
    .join("\n");
}

export function renderAudioJson(input: {
  business: string;
  provider: string;
  turns: SampleTurn[];
}): string {
  const duration = input.turns.at(-1)?.end ?? 0;
  return JSON.stringify(
    {
      synthetic: true,
      label: "SYNTHETIC EXAMPLE — not a real customer, patient, or caller",
      business: input.business,
      provider: input.provider,
      duration_seconds: duration,
      audio: {
        format: "wav",
        note: "No audio file ships with this sample. Timestamps are illustrative.",
      },
      utterances: input.turns.map((turn) => ({
        speaker: turn.speaker,
        text: turn.text,
        start: turn.start,
        end: turn.end,
        confidence: turn.speaker === "agent" ? 0.98 : 0.96,
      })),
    },
    null,
    2,
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
