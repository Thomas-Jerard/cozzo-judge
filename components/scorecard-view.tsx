"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bandColor, downloadJson, formatDuration, verdictLabel } from "@/lib/judge-client";
import { PASS_AT, REVIEW_AT, type Scorecard } from "@/lib/rubric";

export function ScorecardView({
  card,
  mark,
}: {
  card: Scorecard;
  mark?: "ahead" | "behind" | "tied";
}) {
  const duration = formatDuration(card.call.durationSeconds);
  const tone = bandColor(card.verdict === "fail" ? Math.min(card.overall, 69) : card.overall);

  return (
    <article className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {card.call.label || "Untitled call"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={card.verdict === "fail" ? "destructive" : "secondary"}>
              {verdictLabel(card.verdict)}
            </Badge>
            {mark === "ahead" ? <Badge>Ahead</Badge> : null}
            {mark === "tied" ? <Badge variant="outline">Tied</Badge> : null}
            <Badge variant="outline">
              {card.judge.mode === "live" ? "Live" : "Mock"} · {shortModel(card.judge.model)}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            downloadJson(
              `cozzo-judge-${(card.call.label || "call").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
              card,
            )
          }
        >
          <Download />
          JSON
        </Button>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ScoreRing score={card.overall} color={tone} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-foreground">{card.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {card.call.turnCount} turns
            {duration ? ` · ${duration}` : ""}
            {card.call.format !== "plain" ? ` · ${card.call.format.toUpperCase()} source` : ""}
            {" · "}
            {PASS_AT}+ pass, {REVIEW_AT}–{PASS_AT - 1} review
          </p>
        </div>
      </div>

      {card.verdictOverridden ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          A critical flag fails this call even though the weighted score is {card.overall}.
        </p>
      ) : null}

      {card.criticalFlags.length > 0 ? (
        <ul className="space-y-2">
          {card.criticalFlags.map((flag) => (
            <li
              key={`${flag.code}-${flag.message}`}
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            >
              <span className="font-medium">{flag.severity === "critical" ? "Critical" : "Warning"}.</span>{" "}
              {flag.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        {card.dimensions.map((dimension) => (
          <details key={dimension.id} className="group rounded-xl bg-muted/60 px-3 py-2">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {dimension.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {Math.round(dimension.weight * 100)}%
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{dimension.score}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${dimension.score}%`,
                    background: bandColor(dimension.score),
                  }}
                />
              </div>
            </summary>
            <div className="mt-3 space-y-3 pb-1">
              <p className="text-sm leading-relaxed text-muted-foreground">{dimension.rationale}</p>
              {dimension.evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground">No verbatim quote was kept for this dimension.</p>
              ) : (
                dimension.evidence.map((item) => (
                  <figure key={item.quote} className="border-l-2 border-primary/50 pl-3">
                    <blockquote className="text-sm leading-relaxed">“{item.quote}”</blockquote>
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {item.note}
                      {item.verified ? "" : " · Not found verbatim in the transcript."}
                    </figcaption>
                  </figure>
                ))
              )}
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{card.judge.note}</p>
      {card.judge.promptTokens != null ? (
        <p className="text-xs text-muted-foreground">
          Token Factory usage: {card.judge.promptTokens} in
          {card.judge.completionTokens != null ? ` · ${card.judge.completionTokens} out` : ""}
        </p>
      ) : null}
    </article>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <svg viewBox="0 0 108 108" className="size-28 shrink-0" role="img" aria-label={`Overall score ${score}`}>
      <circle cx="54" cy="54" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
      <circle
        cx="54"
        cy="54"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 54 54)"
      />
      <text
        x="54"
        y="59"
        textAnchor="middle"
        fill="currentColor"
        fontSize="28"
        fontWeight="600"
        className="text-foreground"
      >
        {score}
      </text>
    </svg>
  );
}

function shortModel(model: string): string {
  if (model.includes("Lightning")) return "Nemotron 3.5 Lightning";
  if (model.includes("Super-VL")) return "Nemotron 3.5 Super VL";
  if (model.includes("Ultra")) return "Nemotron 3 Ultra";
  if (model.includes("Nano")) return "Nemotron 3 Nano";
  if (model.includes("super-120b") || model.includes("Super")) return "Nemotron 3 Super";
  if (model.includes("mock")) return "local rubric";
  return model;
}
