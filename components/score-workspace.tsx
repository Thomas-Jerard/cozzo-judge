"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppealPanel, BenchPanel } from "@/components/bench-panel";
import { JudgeSettings, modeHelp } from "@/components/judge-settings";
import { JudgeProgress } from "@/components/judge-progress";
import { LimitNotice } from "@/components/limit-notice";
import { RepairPanel } from "@/components/repair-panel";
import { ScorecardView } from "@/components/scorecard-view";
import { TranscriptField } from "@/components/transcript-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppealReport, BenchReport } from "@/lib/bench";
import { usesBench } from "@/lib/bench";
import {
  isRateLimitError,
  postJson,
  postStream,
  readStatus,
  type JudgeStatus,
  type RequestMode,
  type StreamStep,
} from "@/lib/judge-client";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import type { Scorecard } from "@/lib/rubric";
import { encodeCardLink, reportMarkdown, type SharedCard } from "@/lib/share";
import { SCENARIOS, scenarioById, type SampleProvider, type SampleScenario } from "@/lib/samples";

export function ScoreWorkspace() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("sample");
  const [status, setStatus] = useState<JudgeStatus | null>(null);
  const [scenario, setScenario] = useState<SampleScenario>(() => scenarioById(requested));
  const [provider, setProvider] = useState<SampleProvider>(() => scenarioById(requested).providers[0]);
  const [format, setFormat] = useState<"plain" | "json">("plain");
  const [requirements, setRequirements] = useState(scenario.requirements);
  const [transcript, setTranscript] = useState(provider.plain);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [mode, setMode] = useState<RequestMode>("auto");
  const [card, setCard] = useState<Scorecard | null>(null);
  const [bench, setBench] = useState<BenchReport | null>(null);
  const [appeal, setAppeal] = useState<AppealReport | null>(null);
  const [repair, setRepair] = useState<RepairState | null>(null);
  const [beforeScore, setBeforeScore] = useState<number | null>(null);
  const [step, setStep] = useState<StreamStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [limitTarget, setLimitTarget] = useState<"score" | "appeal" | "repair">("score");
  const [loading, setLoading] = useState(false);
  const [appealing, setAppealing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [usingSample, setUsingSample] = useState(true);
  const seenSample = useRef<string | null>(null);

  useEffect(() => {
    const id = requested ?? "dental";
    if (seenSample.current === null) {
      seenSample.current = id;
      return;
    }
    if (seenSample.current === id) return;
    seenSample.current = id;
    const next = scenarioById(id);
    setScenario(next);
    setProvider(next.providers[0]);
    setFormat("plain");
    setRequirements(next.requirements);
    setTranscript(next.providers[0].plain);
    setCard(null);
    setBench(null);
    setAppeal(null);
    setRepair(null);
    setError(null);
    setNotice(null);
    setUsingSample(true);
  }, [requested]);

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

  function loadScenario(next: SampleScenario, nextProvider = next.providers[0], nextFormat: "plain" | "json" = "plain") {
    setScenario(next);
    setProvider(nextProvider);
    setFormat(nextFormat);
    setRequirements(next.requirements);
    setTranscript(nextFormat === "json" ? nextProvider.audioJson : nextProvider.plain);
    clearResult();
    setUsingSample(true);
  }

  function loadProvider(next: SampleProvider, nextFormat = format) {
    setProvider(next);
    setFormat(nextFormat);
    setTranscript(nextFormat === "json" ? next.audioJson : next.plain);
    clearResult();
    setUsingSample(true);
  }

  function clearResult() {
    setCard(null);
    setBench(null);
    setAppeal(null);
    setRepair(null);
    setBeforeScore(null);
    setError(null);
    setNotice(null);
    setShareText(null);
    setRateLimited(false);
  }

  async function judge(forced?: RequestMode) {
    const requestMode = forced ?? mode;
    setLoading(true);
    setError(null);
    setNotice(null);
    setShareText(null);
    setRateLimited(false);
    setLimitTarget("score");
    setAppeal(null);
    setRepair(null);
    setBeforeScore(null);
    setStep(usesBench(model) ? "triage" : "score");
    try {
      const result = await postStream<{ type: "result"; scorecard: Scorecard; bench: BenchReport }>("/api/judge", {
        transcript,
        requirements,
        label: usingSample ? `${scenario.business} · ${provider.name}` : "Pasted call",
        model,
        mode: requestMode,
        stream: true,
      }, setStep);
      setCard(result.scorecard);
      setBench(result.bench);
      if (window.innerWidth < 1024) {
        document.getElementById("scorecard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (caught) {
      setCard(null);
      setBench(null);
      setRateLimited(isRateLimitError(caught));
      setError(caught instanceof Error ? caught.message : "The judge failed.");
    } finally {
      setLoading(false);
      setStep(null);
    }
  }

  async function askAppeal(forced?: RequestMode) {
    if (!card) return;
    setAppealing(true);
    setError(null);
    setNotice(null);
    setRateLimited(false);
    setLimitTarget("appeal");
    try {
      const result = await postJson<{ appeal: AppealReport }>("/api/appeal", {
        transcript,
        requirements,
        scorecard: card,
        mode: forced ?? mode,
      });
      setAppeal(result.appeal);
    } catch (caught) {
      setRateLimited(isRateLimitError(caught));
      setError(caught instanceof Error ? caught.message : "The appeal failed.");
    } finally {
      setAppealing(false);
    }
  }

  async function fixPrompt(forced?: RequestMode) {
    if (!card) return;
    const before = card.overall;
    setRepairing(true);
    setError(null);
    setNotice(null);
    setRateLimited(false);
    setLimitTarget("repair");
    setStep("propose");
    try {
      const result = await postStream<{ type: "result"; repair: RepairPayload }>("/api/repair", {
        transcript,
        requirements,
        label: card.call.label,
        summary: card.summary,
        beforeOverall: before,
        model,
        mode: forced ?? mode,
        stream: true,
      }, setStep);
      setBeforeScore(before);
      setRepair(result.repair);
      setCard(result.repair.scorecard);
      setBench(result.repair.bench);
      setAppeal(null);
    } catch (caught) {
      setRateLimited(isRateLimitError(caught));
      setError(caught instanceof Error ? caught.message : "The rewrite failed.");
    } finally {
      setRepairing(false);
      setStep(null);
    }
  }

  async function copyReport() {
    if (!card) return;
    const markdown = reportMarkdown(sharedPayload(card, bench, appeal, repair, beforeScore));
    const ok = await writeClipboard(markdown);
    setShareText(ok ? null : markdown);
    setNotice(ok ? "Report copied." : "Clipboard is blocked. Select the report below.");
  }

  async function copyLink() {
    if (!card) return;
    try {
      const path = await encodeCardLink(sharedPayload(card, bench, appeal, repair, beforeScore));
      if (!path) {
        setShareText(null);
        setNotice("This card is too long for a link. Copy the report instead.");
        return;
      }
      const url = `${window.location.origin}${path}`;
      const ok = await writeClipboard(url);
      setShareText(ok ? null : url);
      setNotice(ok ? "Link copied." : "Clipboard is blocked. Select the link below.");
    } catch {
      setNotice("Could not build a link for this card. Copy the report instead.");
    }
  }

  const live = mode === "live" || (mode === "auto" && status?.keyConfigured);
  const busy = loading || appealing || repairing;
  const samplePlain = provider.plain;
  const sampleJson = provider.audioJson;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
      <div className="grid gap-6">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Single call</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Score a call against the script</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Paste a transcript, or start from a synthetic dental, HVAC, or med spa call. With Super selected, Nano writes a
            risk line first and Super writes the score. Ultra can appeal it without changing the number.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sample businesses">
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={usingSample && scenario.id === item.id}
              onClick={() => loadScenario(item)}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-foreground/10 ${
                usingSample && scenario.id === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted"
              }`}
            >
              {item.industry}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUsingSample(false);
              setRequirements("");
              setTranscript("");
              clearResult();
            }}
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground"
          >
            Blank call
          </button>
        </div>

        {usingSample ? (
          <div className="rounded-xl bg-accent/70 px-4 py-3 text-sm text-accent-foreground">
            <p className="font-medium">Synthetic example · {scenario.business}</p>
            <p className="mt-1">{scenario.summary} Not a real customer.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenario.providers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={provider.id === item.id}
                  onClick={() => loadProvider(item)}
                  className={`rounded-lg px-3 py-1.5 text-left text-xs ring-1 ring-foreground/10 ${
                    provider.id === item.id ? "bg-background" : "bg-background/50"
                  }`}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="text-muted-foreground">{item.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="requirements">Business script and requirements</Label>
          <Textarea
            id="requirements"
            value={requirements}
            onChange={(event) => {
              setRequirements(event.target.value);
              setUsingSample(false);
            }}
            className="field-sizing-fixed min-h-40 text-sm leading-relaxed"
          />
        </div>

        <TranscriptField
          id="transcript"
          label="Call transcript"
          value={transcript}
          onChange={(value) => {
            setTranscript(value);
            if (value !== provider.plain && value !== provider.audioJson) setUsingSample(false);
          }}
          format={format}
          onFormat={(next) => {
            setFormat(next);
            if (usingSample) {
              setTranscript(next === "json" ? sampleJson : samplePlain);
            }
          }}
          plain={samplePlain}
          audioJson={sampleJson}
        />

        <JudgeSettings status={status} model={model} mode={mode} onModel={setModel} onMode={setMode} />
        <p className="text-xs leading-relaxed text-muted-foreground">{modeHelp(status, mode)}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" className="h-10 px-4" disabled={busy} onClick={() => judge()}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            {loading ? (live ? "Nemotron is reading the call…" : "Scoring against the rubric…") : "Judge this call"}
          </Button>
          {card ? (
            <>
              <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => fixPrompt()}>
                {repairing ? <Loader2 className="animate-spin" /> : null}
                Fix the prompt
              </Button>
              <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => askAppeal()}>
                {appealing ? <Loader2 className="animate-spin" /> : null}
                Ask Ultra
              </Button>
            </>
          ) : null}
          {error && !rateLimited && mode !== "mock" ? (
            <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => judge("mock")}>
              Score with the mock judge
            </Button>
          ) : null}
        </div>
        {error && rateLimited ? (
          <LimitNotice
            message={error}
            actionLabel={
              limitTarget === "repair"
                ? "Fix it with the mock judge"
                : limitTarget === "appeal"
                  ? "Appeal with the mock judge"
                  : "Score with the mock judge"
            }
            disabled={busy}
            onAction={() =>
              limitTarget === "repair" ? fixPrompt("mock") : limitTarget === "appeal" ? askAppeal("mock") : judge("mock")
            }
          />
        ) : null}
        {error && !rateLimited ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        {shareText ? (
          <textarea
            readOnly
            aria-label="Share text"
            value={shareText}
            className="min-h-20 w-full rounded-lg bg-muted/70 p-3 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : null}
      </div>

      <div id="scorecard" className="grid gap-4 lg:sticky lg:top-24">
        {step ? <JudgeProgress step={step} pipeline={usesBench(model) || repairing} /> : null}
        {bench && card ? <BenchPanel bench={bench} verdict={card.verdict} /> : null}
        {appeal ? <AppealPanel appeal={appeal} /> : null}
        {repair && beforeScore != null ? (
          <RepairPanel
            before={beforeScore}
            after={repair.scorecard.overall}
            prompt={repair.prompt}
            changes={repair.changes}
            transcript={repair.transcript}
            proposeLatencyMs={repair.proposeLatencyMs}
            provider={repair.provider}
          />
        ) : null}
        {card ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copyReport()}>
                Copy report
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copyLink()}>
                Copy link
              </Button>
            </div>
            <ScorecardView card={card} />
          </>
        ) : step ? null : (
          <div className="flex min-h-80 flex-col justify-center rounded-2xl border border-dashed border-border bg-card/60 p-6">
            <p className="text-lg font-medium">The scorecard lands here.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {usingSample
                ? `${provider.name} at ${scenario.business} is loaded. Judge it, or switch to the other provider to see a miss.`
                : "Paste a transcript and the script the business meant the agent to follow."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RepairPayload {
  prompt: string;
  changes: string[];
  transcript: string;
  note: string;
  scorecard: Scorecard;
  bench: BenchReport;
  proposeLatencyMs: number;
  provider: "nebius-token-factory" | "mock";
}

type RepairState = RepairPayload;

function sharedPayload(
  card: Scorecard,
  bench: BenchReport | null,
  appeal: AppealReport | null,
  repair: RepairState | null,
  beforeScore: number | null,
): SharedCard {
  return {
    v: 1,
    scorecard: card,
    bench: bench ?? undefined,
    appeal: appeal ?? undefined,
    repair:
      repair && beforeScore != null
        ? {
            prompt: repair.prompt,
            changes: repair.changes,
            before: beforeScore,
            after: repair.scorecard.overall,
            note: repair.note,
          }
        : undefined,
  };
}

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
