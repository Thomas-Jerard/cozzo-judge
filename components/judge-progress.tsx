import type { StreamStep } from "@/lib/judge-client";

const COPY: Record<StreamStep, { title: string; detail: string }> = {
  triage: { title: "Nano", detail: "Reading the call for a risk line" },
  score: { title: "Super", detail: "Scoring the five rubric dimensions" },
  quotes: { title: "Quotes", detail: "Checking each line against the transcript" },
  propose: { title: "Rewrite", detail: "Writing a tighter prompt and new agent lines" },
  rescore: { title: "Rescore", detail: "Scoring the revised lines" },
};

export function JudgeProgress({
  step,
  pipeline,
}: {
  step: StreamStep;
  pipeline: boolean;
}) {
  const steps: StreamStep[] = pipeline
    ? step === "propose" || step === "rescore"
      ? ["propose", "rescore", "quotes"]
      : ["triage", "score", "quotes"]
    : ["score", "quotes"];
  const active = steps.indexOf(step);
  return (
    <ol className="grid gap-2" aria-live="polite">
      {steps.map((id, index) => {
        const state = index < active ? "done" : index === active ? "active" : "wait";
        return (
          <li
            key={id}
            data-step={id}
            data-state={state}
            className={`rounded-xl px-3 py-2 text-sm ring-1 ring-foreground/10 ${
              state === "active" ? "bg-card" : "bg-card/50 text-muted-foreground"
            }`}
          >
            <span className="font-medium text-foreground">{COPY[id].title}</span>
            <span className="mt-0.5 block text-xs">{COPY[id].detail}</span>
          </li>
        );
      })}
    </ol>
  );
}
