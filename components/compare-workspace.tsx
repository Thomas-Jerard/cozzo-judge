"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppealPanel } from "@/components/bench-panel";
import { CallResult } from "@/components/call-result";
import { JudgeSettings, modeHelp } from "@/components/judge-settings";
import { LimitNotice } from "@/components/limit-notice";
import { TranscriptField } from "@/components/transcript-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isRateLimitError,
  postJson,
  readStatus,
  verdictLabel,
  type JudgeStatus,
  type RequestMode,
} from "@/lib/judge-client";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import type { AppealReport } from "@/lib/bench";
import { DIMENSIONS, type Scorecard } from "@/lib/rubric";
import { SCENARIOS, scenarioById, type SampleScenario } from "@/lib/samples";

interface Pair {
  scorecards: [Scorecard, Scorecard];
}

interface PackRow {
  id: string;
  industry: string;
  left?: number;
  right?: number;
  winner?: string;
  error?: string;
}

export function CompareWorkspace() {
  const searchParams = useSearchParams();
  const initial = scenarioById(searchParams.get("sample"));
  const [status, setStatus] = useState<JudgeStatus | null>(null);
  const [scenario, setScenario] = useState<SampleScenario>(initial);
  const [requirements, setRequirements] = useState(initial.requirements);
  const [leftLabel, setLeftLabel] = useState(initial.providers[0].name);
  const [rightLabel, setRightLabel] = useState(initial.providers[1].name);
  const [leftText, setLeftText] = useState(initial.providers[0].plain);
  const [rightText, setRightText] = useState(initial.providers[1].plain);
  const [leftFormat, setLeftFormat] = useState<"plain" | "json">("plain");
  const [rightFormat, setRightFormat] = useState<"plain" | "json">("plain");
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [mode, setMode] = useState<RequestMode>("auto");
  const [pair, setPair] = useState<Pair | null>(null);
  const [appeal, setAppeal] = useState<AppealReport | null>(null);
  const [appealing, setAppealing] = useState(false);
  const [pack, setPack] = useState<PackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [limitTarget, setLimitTarget] = useState<"pair" | "pack" | "appeal">("pair");
  const [loading, setLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        setModel(next.defaultModel || DEFAULT_MODEL_ID);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function loadScenario(next: SampleScenario) {
    setScenario(next);
    setRequirements(next.requirements);
    setLeftLabel(next.providers[0].name);
    setRightLabel(next.providers[1].name);
    setLeftText(next.providers[0].plain);
    setRightText(next.providers[1].plain);
    setLeftFormat("plain");
    setRightFormat("plain");
    setPair(null);
    setError(null);
  }

  async function judgePair(forced?: RequestMode) {
    setLoading(true);
    setError(null);
    setRateLimited(false);
    try {
      const result = await postJson<Pair>("/api/compare", {
        requirements,
        model,
        mode: forced ?? mode,
        calls: [
          { label: leftLabel || "Provider A", transcript: leftText },
          { label: rightLabel || "Provider B", transcript: rightText },
        ],
      });
      setAppeal(null);
      setPair({ scorecards: [result.scorecards[0], result.scorecards[1]] });
      if (window.innerWidth < 1024) {
        document.getElementById("comparison")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (caught) {
      setPair(null);
      setRateLimited(isRateLimitError(caught));
      setLimitTarget("pair");
      setError(caught instanceof Error ? caught.message : "The comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runPack(forced?: RequestMode) {
    setPackLoading(true);
    setError(null);
    setRateLimited(false);
    setPack(SCENARIOS.map((item) => ({ id: item.id, industry: item.industry })));
    const rows: PackRow[] = [];
    const requestMode = forced ?? mode;
    for (const item of SCENARIOS) {
      try {
        const result = await postJson<Pair>("/api/compare", {
          requirements: item.requirements,
          model,
          mode: requestMode,
          calls: [
            { label: item.providers[0].name, transcript: item.providers[0].plain },
            { label: item.providers[1].name, transcript: item.providers[1].plain },
          ],
        });
        const [left, right] = result.scorecards;
        rows.push({
          id: item.id,
          industry: item.industry,
          left: left.overall,
          right: right.overall,
          winner: winnerName(left, right, item.providers[0].name, item.providers[1].name),
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "This scenario failed.";
        rows.push({
          id: item.id,
          industry: item.industry,
          error: message,
        });
        if (isRateLimitError(caught)) {
          setRateLimited(true);
          setLimitTarget("pack");
          setError(message);
          for (const rest of SCENARIOS.slice(rows.length)) {
            rows.push({
              id: rest.id,
              industry: rest.industry,
              error: "Not scored. The live limit was reached.",
            });
          }
          break;
        }
      }
      setPack([...rows, ...SCENARIOS.slice(rows.length).map((item) => ({ id: item.id, industry: item.industry }))]);
    }
    setPack(rows);
    setPackLoading(false);
  }

  async function askAppeal(forced?: RequestMode) {
    if (!pair) return;
    const [leftCard, rightCard] = pair.scorecards;
    const behind =
      leftCard.overall <= rightCard.overall
        ? { card: leftCard, transcript: leftText }
        : { card: rightCard, transcript: rightText };
    setAppealing(true);
    setError(null);
    setRateLimited(false);
    try {
      const result = await postJson<{ appeal: AppealReport }>("/api/appeal", {
        transcript: behind.transcript,
        requirements,
        scorecard: behind.card,
        mode: forced ?? mode,
      });
      setAppeal(result.appeal);
    } catch (caught) {
      setRateLimited(isRateLimitError(caught));
      setLimitTarget("appeal");
      setError(caught instanceof Error ? caught.message : "The appeal failed.");
    } finally {
      setAppealing(false);
    }
  }

  const left = pair?.scorecards[0];
  const right = pair?.scorecards[1];
  const lead = left && right ? leadOf(left, right) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">Advanced</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Compare two agents</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Optional. The main path is one call at a time. Here, the same script is scored for two agents. A gap of three
        points or less is a tie.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={scenario.id === item.id}
            onClick={() => loadScenario(item)}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-foreground/10 ${
              scenario.id === item.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {item.industry}
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-accent/70 px-4 py-3 text-sm text-accent-foreground">
        Synthetic example · {scenario.business}. {scenario.summary} Northline Voice and Harbor Voice are fictional labels.
      </p>

      <div className="mt-6 grid gap-2">
        <Label htmlFor="shared-requirements">Shared script and requirements</Label>
        <Textarea
          id="shared-requirements"
          value={requirements}
          onChange={(event) => setRequirements(event.target.value)}
          className="field-sizing-fixed min-h-36 text-sm leading-relaxed"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProviderColumn
          title="Provider A"
          label={leftLabel}
          onLabel={setLeftLabel}
          text={leftText}
          onText={setLeftText}
          format={leftFormat}
          onFormat={setLeftFormat}
          plain={scenario.providers[0].plain}
          audioJson={scenario.providers[0].audioJson}
        />
        <ProviderColumn
          title="Provider B"
          label={rightLabel}
          onLabel={setRightLabel}
          text={rightText}
          onText={setRightText}
          format={rightFormat}
          onFormat={setRightFormat}
          plain={scenario.providers[1].plain}
          audioJson={scenario.providers[1].audioJson}
        />
      </div>

      <details className="mt-8 border-t border-border pt-6">
        <summary className="cursor-pointer text-base font-medium">Model and connection</summary>
        <div className="mt-6 grid gap-4">
          <JudgeSettings status={status} model={model} mode={mode} onModel={setModel} onMode={setMode} />
          <p className="text-sm leading-relaxed text-muted-foreground">{modeHelp(status, mode)}</p>
        </div>
      </details>

      <div className="mt-8 grid gap-4">
        <div className="flex flex-col items-start gap-4">
          <Button type="button" size="lg" className="h-12 px-6 text-base" disabled={loading || packLoading} onClick={() => judgePair()}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            {loading ? "Comparing the calls…" : "Judge this pair"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            disabled={loading || packLoading}
            onClick={() => runPack()}
          >
            {packLoading ? "Scoring the three scenarios…" : "Run all three scenarios"}
          </button>
          {error && !rateLimited && mode !== "mock" ? (
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              disabled={loading || packLoading}
              onClick={() => judgePair("mock")}
            >
              Compare with the practice judge
            </button>
          ) : null}
        </div>
        {error && rateLimited ? (
          <LimitNotice
            message={error}
            actionLabel={
              limitTarget === "pack"
                ? "Run the pack with the mock judge"
                : limitTarget === "appeal"
                  ? "Appeal with the mock judge"
                  : "Compare with the mock judge"
            }
            disabled={loading || packLoading || appealing}
            onAction={() =>
              limitTarget === "pack" ? runPack("mock") : limitTarget === "appeal" ? askAppeal("mock") : judgePair("mock")
            }
          />
        ) : null}
        {error && !rateLimited ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {left && right && lead ? (
        <section id="comparison" className="mt-10 grid gap-6">
          <div className="grid gap-3">
            <p className="text-2xl font-semibold tracking-tight">{lead.headline}</p>
            <p className="text-base leading-relaxed text-muted-foreground">{lead.detail}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Dimension</th>
                  <th className="px-4 py-3 font-medium">{left.call.label}</th>
                  <th className="px-4 py-3 font-medium">{right.call.label}</th>
                  <th className="px-4 py-3 font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((dimension) => {
                  const a = left.dimensions.find((item) => item.id === dimension.id)?.score ?? 0;
                  const b = right.dimensions.find((item) => item.id === dimension.id)?.score ?? 0;
                  return (
                    <tr key={dimension.id} className="border-t border-border/80">
                      <td className="px-4 py-3">{dimension.name}</td>
                      <td className="px-4 py-3 tabular-nums">{a}</td>
                      <td className="px-4 py-3 tabular-nums">{b}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {a === b ? "0" : a > b ? `+${a - b} left` : `+${b - a} right`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border font-medium">
                  <td className="px-4 py-3">Overall</td>
                  <td className="px-4 py-3 tabular-nums">
                    {left.overall} · {verdictLabel(left.verdict)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {right.overall} · {verdictLabel(right.verdict)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Math.abs(left.overall - right.overall)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details>
            <summary className="cursor-pointer text-base font-medium">Second opinion</summary>
            <div className="mt-4 grid gap-4">
              <button
                type="button"
                className="w-fit text-sm font-medium underline-offset-4 hover:underline"
                disabled={loading || packLoading || appealing}
                onClick={() => askAppeal()}
              >
                {appealing ? "Reading the appeal…" : "Ask for a second opinion on the lower score"}
              </button>
              {appeal ? <AppealPanel appeal={appeal} /> : null}
            </div>
          </details>
          <div className="grid gap-12 lg:grid-cols-2">
            <CallResult card={left} />
            <CallResult card={right} />
          </div>
        </section>
      ) : null}

      {pack ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Scenario pack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dental, HVAC, and med spa. Each row is the same script scored for Northline Voice and Harbor Voice.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Scenario</th>
                  <th className="px-4 py-3 font-medium">Northline</th>
                  <th className="px-4 py-3 font-medium">Harbor</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {pack.map((row) => (
                  <tr key={row.id} className="border-t border-border/80">
                    <td className="px-4 py-3">{row.industry}</td>
                    <td className="px-4 py-3 tabular-nums">{row.left ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{row.right ?? "—"}</td>
                    <td className="px-4 py-3">{row.error ?? row.winner ?? (packLoading ? "Scoring…" : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProviderColumn(props: {
  title: string;
  label: string;
  onLabel: (value: string) => void;
  text: string;
  onText: (value: string) => void;
  format: "plain" | "json";
  onFormat: (format: "plain" | "json") => void;
  plain: string;
  audioJson: string;
}) {
  const fieldId = props.title.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{props.title}</p>
      <div className="grid gap-2">
        <Label htmlFor={`${fieldId}-name`}>Name on the scorecard</Label>
        <Input
          id={`${fieldId}-name`}
          value={props.label}
          onChange={(event) => props.onLabel(event.target.value)}
        />
      </div>
      <TranscriptField
        id={`${fieldId}-transcript`}
        label="Transcript"
        value={props.text}
        onChange={props.onText}
        format={props.format}
        onFormat={props.onFormat}
        plain={props.plain}
        audioJson={props.audioJson}
      />
    </div>
  );
}

function leadOf(left: Scorecard, right: Scorecard): {
  headline: string;
  detail: string;
  markLeft?: "ahead" | "tied";
  markRight?: "ahead" | "tied";
} {
  const gap = left.overall - right.overall;
  const leftName = left.call.label || "Provider A";
  const rightName = right.call.label || "Provider B";
  if (Math.abs(gap) <= 3) {
    return {
      headline: `${leftName} and ${rightName} are tied.`,
      detail: `The scores are ${left.overall} and ${right.overall}. A gap of three points or less stays a tie.`,
      markLeft: "tied",
      markRight: "tied",
    };
  }
  if (gap > 0) {
    return {
      headline: `${leftName} leads by ${gap} points.`,
      detail: `${left.overall} against ${right.overall}. Open a dimension to read the quotes behind the gap.`,
      markLeft: "ahead",
    };
  }
  return {
    headline: `${rightName} leads by ${-gap} points.`,
    detail: `${right.overall} against ${left.overall}. Open a dimension to read the quotes behind the gap.`,
    markRight: "ahead",
  };
}

function winnerName(left: Scorecard, right: Scorecard, leftLabel: string, rightLabel: string): string {
  const gap = left.overall - right.overall;
  if (Math.abs(gap) <= 3) return "Tie";
  return gap > 0 ? leftLabel : rightLabel;
}
