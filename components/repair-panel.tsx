import { REPAIR_NOTE } from "@/lib/bench";
import { latencyLabel } from "@/components/bench-panel";

export function RepairPanel({
  before,
  after,
  prompt,
  changes,
  transcript,
  proposeLatencyMs,
  provider,
}: {
  before: number;
  after: number;
  prompt: string;
  changes: string[];
  transcript: string;
  proposeLatencyMs: number;
  provider: "nebius-token-factory" | "mock";
}) {
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10" data-repair>
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Revised agent lines</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {before} <span className="text-muted-foreground">→</span> {after}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{REPAIR_NOTE}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {provider === "mock" ? "Local rewrite, no Nebius call." : `Prompt written in ${latencyLabel(proposeLatencyMs)}.`}
      </p>
      <p className="mt-3 text-sm leading-relaxed">{prompt}</p>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Read the rewritten transcript</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/70 p-3 text-xs leading-relaxed">
          {transcript}
        </pre>
      </details>
    </section>
  );
}
