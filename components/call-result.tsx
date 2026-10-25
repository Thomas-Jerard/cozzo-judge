"use client";

import { Loader2 } from "lucide-react";
import { CozzoCanary, type CanaryAccent } from "@/components/cozzo-canary";
import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import type { AppealReport, BenchReport } from "@/lib/bench";
import { downloadJson, verdictLabel } from "@/lib/judge-client";
import type { DimensionScore, Scorecard } from "@/lib/rubric";

export function CallResult({
  card,
  bench,
  appeal,
  beforeScore,
  repair,
  onFix,
  fixing,
  onAppeal,
  appealing,
  onCopyLink,
  onCopyReport,
  shareNotice,
  shareText,
  onAnother,
  statusNote,
  layout = "split",
}: {
  card: Scorecard;
  bench?: BenchReport | null;
  appeal?: AppealReport | null;
  beforeScore?: number | null;
  repair?: {
    prompt: string;
    changes: string[];
    transcript: string;
    note: string;
  } | null;
  onFix?: () => void;
  fixing?: boolean;
  onAppeal?: () => void;
  appealing?: boolean;
  onCopyLink?: () => void;
  onCopyReport?: () => void;
  shareNotice?: string | null;
  shareText?: string | null;
  onAnother?: () => void;
  statusNote?: string | null;
  layout?: "split" | "stack";
}) {
  const issues = topIssues(card).filter(
    (issue) => !card.criticalFlags.some((flag) => flag.message === issue),
  );
  const tone = verdictTone(card.verdict);
  const ringSize = layout === "stack" ? 132 : 176;

  return (
    <article id="result" className={layout === "split" ? "score-split score-split-wide" : "score-split"}>
      <div className="grid min-w-0 gap-8">
      <header className="grid gap-5">
        <p className="text-sm text-muted-foreground">{card.call.label || "This call"}</p>
        <div className={beforeScore != null ? "score-hero score-hero-pair" : "score-hero"}>
          <CozzoCanary pose="idle" size={layout === "stack" ? 72 : 96} accent={card.verdict} label={canaryLabel(card.verdict)} />
          {beforeScore != null ? (
            <>
              <ScoreRing
                score={beforeScore}
                tone={bandTone(beforeScore)}
                ink={scoreInk(bandTone(beforeScore))}
                size={Math.round(ringSize * 0.78)}
                caption="Before"
              />
              <ScoreRing score={card.overall} tone={tone} ink={scoreInk(tone)} size={ringSize} caption="After" />
              <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl" style={{ color: scoreInk(tone) }}>
                {deltaLabel(card.overall - beforeScore)}
              </p>
            </>
          ) : (
            <ScoreRing score={card.overall} tone={tone} ink={scoreInk(tone)} size={ringSize} />
          )}
        </div>
        <h1>
          <span className="verdict-pill" style={pillStyle(card.verdict, tone)}>
            {verdictLabel(card.verdict)}
          </span>
        </h1>
        <p className="measure text-lg leading-relaxed">{card.summary}</p>
      </header>

      {card.criticalFlags.length > 0 ? (
        <section className="flag-card grid gap-2" role="alert">
          <h2 className="font-medium">{card.criticalFlags.length > 1 ? "Critical flags" : "Critical flag"}</h2>
          <ul className="grid gap-2">
            {card.criticalFlags.map((flag) => (
              <li key={`${flag.code}-${flag.message}`} className="text-sm leading-relaxed">
                {flag.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {issues.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">What stood out</h2>
          <ol className="grid gap-3">
            {issues.map((issue, index) => (
              <li key={`${index}-${issue}`} className="text-base leading-relaxed">
                {issue}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {beforeScore != null ? (
        <p className="text-base leading-relaxed">
          The first score was {beforeScore}. This rewrite scored {card.overall}. The caller’s words are the same. This
          is a rewritten transcript, not a new phone call.
        </p>
      ) : null}

      {statusNote ? (
        <p aria-live="polite" className="text-base leading-relaxed text-muted-foreground">
          {statusNote}
        </p>
      ) : null}

      {onFix ? (
        <div>
          <Button type="button" size="lg" className="h-12 px-6 text-base" disabled={fixing} onClick={onFix}>
            {fixing ? <Loader2 className="animate-spin" /> : null}
            {fixing ? "Rewriting the instructions…" : "Fix the prompt"}
          </Button>
        </div>
      ) : null}

      {onAnother ? (
        <button type="button" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onAnother}>
          Judge another call
        </button>
      ) : null}
      </div>

      <div className="score-aside">
        <section className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">The five checks</h2>
          {orderedChecks(card).map((dimension) => (
            <CheckBar key={dimension.id} dimension={dimension} />
          ))}
        </section>

        {repair ? (
          <details className="py-2">
            <summary className="cursor-pointer text-base font-medium">What the rewrite changed</summary>
            <div className="mt-5 grid gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{repair.note}</p>
              <p className="text-sm leading-relaxed">{repair.prompt}</p>
              <ul className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
                {repair.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              {repair.transcript ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Read the rewritten call</summary>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
                    {repair.transcript}
                  </pre>
                </details>
              ) : null}
            </div>
          </details>
        ) : null}

        {bench ? (
          <details className="py-2">
            <summary className="cursor-pointer text-base font-medium">How the models worked</summary>
            <div className="mt-5 grid gap-3 text-sm leading-relaxed">
              <BenchCopy bench={bench} verdict={card.verdict} />
              <p className="text-muted-foreground">
                {card.judge.mode === "live" ? "Live score." : "Practice score. Nebius was not called."}{" "}
                {card.judge.note}
              </p>
            </div>
          </details>
        ) : null}

        {onAppeal || appeal ? (
          <details className="py-2">
            <summary className="cursor-pointer text-base font-medium">Second opinion</summary>
            <div className="mt-5 grid gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                A larger model reads the same call and says whether it agrees. The score above stays put.
              </p>
              {onAppeal ? (
                <Button type="button" variant="outline" className="h-10 w-fit px-4" disabled={appealing} onClick={onAppeal}>
                  {appealing ? <Loader2 className="animate-spin" /> : null}
                  {appealing ? "Reading the appeal…" : "Ask for a second opinion"}
                </Button>
              ) : null}
              {appeal ? (
                <div className="grid gap-2 text-sm leading-relaxed">
                  <p className="font-medium">{appeal.agrees ? "Agrees with this verdict." : "Disagrees with this verdict."}</p>
                  <p>{appeal.opinion}</p>
                  <p className="text-muted-foreground">{appeal.note}</p>
                  <p className="font-mono text-xs text-muted-foreground">{appeal.model}</p>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}

        <details className="py-2">
          <summary className="cursor-pointer text-base font-medium">Share this score</summary>
          <div className="mt-5 flex flex-wrap gap-4">
            {onCopyReport ? (
              <button type="button" className="text-sm font-medium underline-offset-4 hover:underline" onClick={onCopyReport}>
                Copy a report
              </button>
            ) : null}
            {onCopyLink ? (
              <button type="button" className="text-sm font-medium underline-offset-4 hover:underline" onClick={onCopyLink}>
                Copy a link
              </button>
            ) : null}
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={() =>
                downloadJson(
                  `cozzo-judge-${(card.call.label || "call").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
                  card,
                )
              }
            >
              Download JSON
            </button>
          </div>
          {shareNotice ? <p className="mt-3 text-sm text-muted-foreground">{shareNotice}</p> : null}
          {shareText ? (
            <textarea
              readOnly
              aria-label="Share text"
              value={shareText}
              className="mt-3 min-h-20 w-full rounded-lg bg-muted p-3 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </details>
      </div>
    </article>
  );
}

function BenchCopy({ bench, verdict }: { bench: BenchReport; verdict: Scorecard["verdict"] }) {
  const triage = bench.triage;
  const local = Boolean(triage?.model.includes("mock") || bench.score.model.includes("mock"));
  return (
    <>
      {triage?.skipped ? (
        <p>The fast read did not finish{triage.skipReason ? `: ${triage.skipReason}` : ""}. The score still came back.</p>
      ) : triage ? (
        <p>
          {local ? "A local preview" : "Nano"} called this {triage.risk} risk in {latencyLabel(triage.latencyMs)}.{" "}
          {triage.headline}
        </p>
      ) : null}
      <p>
        {local ? "The local rubric" : "Super"} wrote the score in {latencyLabel(bench.score.latencyMs)}.
      </p>
      {bench.agreement ? (
        <p>
          {local
            ? bench.agreement === "aligned"
              ? "The preview and the score point the same way."
              : `The preview called it ${triage?.risk} risk, and the score is ${verdictLabel(verdict).toLowerCase()}.`
            : bench.agreement === "aligned"
              ? "Nano and Super agree on the direction of this call."
              : `Nano called it ${triage?.risk} risk, and Super marked it ${verdictLabel(verdict).toLowerCase()}. The number above is Super’s.`}
        </p>
      ) : null}
      <p className="font-mono text-xs text-muted-foreground">
        {triage && !triage.skipped ? triage.model : null}
        {triage && !triage.skipped ? " · " : null}
        {bench.score.model}
      </p>
    </>
  );
}

const CHECK_ORDER = [
  "task_completion",
  "factual_accuracy",
  "escalation_handoff",
  "hallucination",
  "tone_empathy",
] as const;

function orderedChecks(card: Scorecard): DimensionScore[] {
  return CHECK_ORDER.map((id) => card.dimensions.find((dimension) => dimension.id === id)).filter(
    (dimension): dimension is DimensionScore => Boolean(dimension),
  );
}

function CheckBar({ dimension }: { dimension: DimensionScore }) {
  const weight = Math.round(dimension.weight * 100);
  const earned = Math.round((dimension.score * weight) / 100);
  const tone = bandTone(dimension.score);
  return (
    <details className="check-row rounded-2xl border border-border px-4 py-3">
      <summary className="grid gap-2">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium">
            {shortCheckName(dimension.id)}
            <span className="ml-2 font-normal text-muted-foreground">{weight}</span>
          </span>
          <span className="check-points text-sm tabular-nums text-muted-foreground">
            {earned} / {weight}
          </span>
        </span>
        <span className="block h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full" style={{ width: `${clamp(dimension.score)}%`, background: tone }} />
        </span>
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{dimension.rationale}</p>
        {dimension.evidence.map((item) => (
          <figure key={item.quote} className="border-l border-border pl-3">
            <blockquote className="text-sm leading-relaxed">“{item.quote}”</blockquote>
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {item.note}
              {item.verified ? "" : " This line was not found in the transcript."}
            </figcaption>
          </figure>
        ))}
      </div>
    </details>
  );
}

const SHORT_CHECK: Record<string, string> = {
  task_completion: "Task",
  factual_accuracy: "Facts",
  escalation_handoff: "Handoff",
  hallucination: "Hallucination",
  tone_empathy: "Tone",
};

function shortCheckName(id: string): string {
  return SHORT_CHECK[id] ?? id;
}

function scoreInk(tone: string): string {
  return tone === "#ffc927" ? "var(--review-ink)" : tone;
}

function verdictTone(verdict: Scorecard["verdict"]): string {
  if (verdict === "pass") return "var(--pass)";
  if (verdict === "review") return "#ffc927";
  return "var(--fail)";
}

function bandTone(score: number): string {
  if (score >= 85) return "var(--pass)";
  if (score >= 70) return "#ffc927";
  return "var(--fail)";
}

function pillStyle(verdict: Scorecard["verdict"], tone: string): { background: string; color: string } {
  return {
    background: tone,
    color: verdict === "review" ? "#1c1917" : "var(--background)",
  };
}

function deltaLabel(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

function clamp(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function canaryLabel(verdict: CanaryAccent): string {
  if (verdict === "pass") return "Cozzo the Canary, pleased with this call";
  if (verdict === "review") return "Cozzo the Canary, asking for another look";
  return "Cozzo the Canary, flagging this call";
}

export function topIssues(card: Scorecard): string[] {
  const flags = card.criticalFlags.map((flag) => flag.message).filter(Boolean);
  if (flags.length >= 3) return flags.slice(0, 3);
  const weak = [...card.dimensions]
    .filter((dimension) => dimension.score < 85)
    .sort((a, b) => a.score - b.score)
    .map((dimension) => dimension.rationale)
    .filter((line) => line && !flags.includes(line));
  return [...flags, ...weak].slice(0, 3);
}

function latencyLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} seconds`;
}
