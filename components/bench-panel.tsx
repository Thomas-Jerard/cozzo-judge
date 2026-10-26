import type { AppealReport, BenchReport } from "@/lib/bench";
import { verdictLabel } from "@/lib/judge-client";
import type { Scorecard } from "@/lib/rubric";

export function BenchPanel({ bench, verdict }: { bench: BenchReport; verdict: Scorecard["verdict"] }) {
  const triage = bench.triage;
  const local = triage?.model.includes("mock") || bench.score.model.includes("mock");
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10" data-bench>
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Model bench</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {triage ? (
          <div>
            <dt className="text-xs text-muted-foreground">Triage</dt>
            <dd className="mt-1 text-sm font-medium">
              {triage.skipped ? "Skipped" : `${triage.risk === "high" ? "High" : "Low"} risk`}
              <span className="ml-2 font-normal text-muted-foreground">{latencyLabel(triage.latencyMs)}</span>
            </dd>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {triage.skipped ? triage.skipReason || "Nano did not return a risk line." : triage.headline}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{triage.model}</p>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Rubric score</dt>
          <dd className="mt-1 text-sm font-medium">
            {shortModel(bench.score.model)}
            <span className="ml-2 font-normal text-muted-foreground">{latencyLabel(bench.score.latencyMs)}</span>
          </dd>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{bench.score.model}</p>
        </div>
      </dl>
      {bench.agreement ? (
        <p className="mt-3 text-sm leading-relaxed">
          {local
            ? bench.agreement === "aligned"
              ? "The local risk line and the local score point the same way."
              : `The local risk line and the score disagree. The preview called it ${triage?.risk} risk, and the rubric marked it ${verdictLabel(verdict).toLowerCase()}.`
            : bench.agreement === "aligned"
              ? "Nano and Super agree on the direction of this call."
              : `Nano and Super disagree. Nano called it ${triage?.risk} risk, and Super marked it ${verdictLabel(verdict).toLowerCase()}. The number on the card is Super's.`}
        </p>
      ) : null}
    </section>
  );
}

export function AppealPanel({ appeal }: { appeal: AppealReport }) {
  return (
    <section className="rounded-2xl bg-accent/70 p-4 text-sm text-accent-foreground" data-appeal>
      <p className="text-xs font-medium tracking-[0.16em] uppercase">
        {appeal.model.includes("saved")
          ? `Saved run · ${appeal.agrees ? "agrees" : "disagrees"}`
          : `${appeal.agrees ? "Ultra agrees" : "Ultra disagrees"} · ${latencyLabel(appeal.latencyMs)}`}
      </p>
      <p className="mt-2 leading-relaxed">{appeal.opinion}</p>
      <p className="mt-2 text-xs">{appeal.note}</p>
      <p className="mt-1 font-mono text-[11px]">{appeal.model}</p>
    </section>
  );
}

export function latencyLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function shortModel(model: string): string {
  if (model.includes("mock")) return "Local rubric";
  if (model.includes("Ultra")) return "Nemotron 3 Ultra";
  if (model.includes("Nano")) return "Nemotron 3 Nano";
  if (model.includes("Lightning")) return "Nemotron 3.5 Lightning";
  if (model.includes("Super-VL")) return "Nemotron 3.5 Super VL";
  return "Nemotron 3 Super";
}
