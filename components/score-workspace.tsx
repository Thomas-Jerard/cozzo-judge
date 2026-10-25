"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CallResult } from "@/components/call-result";
import { CozzoCanary } from "@/components/cozzo-canary";
import { JudgeSettings, modeHelp } from "@/components/judge-settings";
import { LimitNotice } from "@/components/limit-notice";
import { StepFlow } from "@/components/step-flow";
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
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
    setUsingSample(true);
  }

  function loadProvider(next: SampleProvider, nextFormat = format) {
    setProvider(next);
    setFormat(nextFormat);
    setTranscript(nextFormat === "json" ? next.audioJson : next.plain);
    clearResult();
    setEditing(false);
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

  const busy = loading || appealing || repairing;
  const ready = requirements.trim().length > 0 && transcript.trim().length > 0;
  const flowStep: 1 | 2 | 3 = loading && !card ? 2 : card ? 3 : 1;
  const samplePlain = provider.plain;
  const sampleJson = provider.audioJson;
  const showEditor = !usingSample || editing;

  return (
    <div className="mx-auto grid max-w-2xl gap-10 px-5 py-10 sm:px-6 sm:py-14">
      <StepFlow step={flowStep} />

      {flowStep === 2 ? (
        <div className="grid justify-items-start gap-4 py-8">
          <CozzoCanary pose="think" size={104} label="Cozzo the Canary listening to the call" />
          <h1 className="text-3xl font-semibold tracking-tight">Cozzo is listening to the call</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{waitCopy(step, repairing)}</p>
        </div>
      ) : null}

      {flowStep === 3 && card ? (
        <div className="grid gap-6">
          <CallResult
            card={card}
            bench={bench}
            appeal={appeal}
            beforeScore={beforeScore}
            repair={repair}
            onFix={() => fixPrompt()}
            fixing={repairing}
            onAppeal={() => askAppeal()}
            appealing={appealing}
            onCopyLink={() => copyLink()}
            onCopyReport={() => copyReport()}
            shareNotice={notice}
            shareText={shareText}
            onAnother={() => {
              clearResult();
              setEditing(false);
            }}
            statusNote={repairing ? repairProgress(step) : null}
          />
          {error && rateLimited ? (
            <LimitNotice
              message={error}
              actionLabel={
                limitTarget === "repair"
                  ? "Fix it with the practice judge"
                  : limitTarget === "appeal"
                    ? "Ask again with the practice judge"
                    : "Score with the practice judge"
              }
              disabled={busy}
              onAction={() =>
                limitTarget === "repair" ? fixPrompt("mock") : limitTarget === "appeal" ? askAppeal("mock") : judge("mock")
              }
            />
          ) : null}
          {error && !rateLimited ? (
            <p role="alert" className="text-sm leading-relaxed">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {flowStep === 1 ? (
        <div className="grid gap-10">
          <div className="grid gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pick a call</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Choose a sample, or paste a transcript and the script the business approved.
            </p>
          </div>

          {usingSample ? (
            <>
              <fieldset className="grid gap-3">
                <legend className="text-base font-medium">Which business?</legend>
                <div className="grid gap-3">
                  {SCENARIOS.map((item) => {
                    const selected = scenario.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => loadScenario(item)}
                        className={`rounded-2xl border px-4 py-4 text-left ${
                          selected ? "border-foreground bg-card" : "border-border bg-card/40"
                        }`}
                      >
                        <span className="block font-medium">{item.industry}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                          {item.business}. {item.summary}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-base font-medium">Which agent?</legend>
                <div className="grid gap-3">
                  {scenario.providers.map((item) => {
                    const selected = provider.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => loadProvider(item)}
                        className={`rounded-2xl border px-4 py-4 text-left ${
                          selected ? "border-foreground bg-card" : "border-border bg-card/40"
                        }`}
                      >
                        <span className="block font-medium">{item.name}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.blurb}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Synthetic example. Not a real caller. Northline Voice and Harbor Voice are fictional.
                </p>
              </fieldset>
            </>
          ) : (
            <div className="flex items-end gap-4">
              <CozzoCanary pose="peek" size={88} label="Cozzo the Canary waiting for a call" />
              <p className="pb-1 text-sm leading-relaxed text-muted-foreground">
                Paste the approved script and the call. I’ll wait.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => loadScenario(scenario)}
                >
                  Use a sample instead
                </button>
              </p>
            </div>
          )}

          {showEditor ? (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="requirements">The script the business approved</Label>
                <Textarea
                  id="requirements"
                  value={requirements}
                  onChange={(event) => {
                    setRequirements(event.target.value);
                    setUsingSample(false);
                  }}
                  className="field-sizing-fixed min-h-36 text-sm leading-relaxed"
                />
              </div>
              <TranscriptField
                id="transcript"
                label="The call"
                value={transcript}
                showFormats={false}
                onChange={(value) => {
                  setTranscript(value);
                  if (value !== provider.plain && value !== provider.audioJson) setUsingSample(false);
                }}
                format={format}
                onFormat={(next) => {
                  setFormat(next);
                  if (usingSample) setTranscript(next === "json" ? sampleJson : samplePlain);
                }}
                plain={samplePlain}
                audioJson={sampleJson}
              />
            </div>
          ) : (
            <button
              type="button"
              className="w-fit text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => setEditing(true)}
            >
              Look at or edit this call
            </button>
          )}

          {usingSample ? (
            <button
              type="button"
              className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setUsingSample(false);
                setEditing(true);
                setRequirements("");
                setTranscript("");
                clearResult();
              }}
            >
              Paste your own call instead
            </button>
          ) : null}

          <div className="grid gap-4">
            <Button type="button" size="lg" className="h-12 w-full px-6 text-base sm:w-fit" disabled={busy || !ready} onClick={() => judge()}>
              Judge this call
            </Button>
            {!ready ? <p className="text-sm text-muted-foreground">Add the script and the call first.</p> : null}
            {error && rateLimited ? (
              <LimitNotice
                message={error}
                actionLabel="Score with the practice judge"
                disabled={busy}
                onAction={() => judge("mock")}
              />
            ) : null}
            {error && !rateLimited ? (
              <div className="grid gap-3">
                <p role="alert" className="text-sm leading-relaxed">{error}</p>
                {mode !== "mock" ? (
                  <button
                    type="button"
                    className="w-fit text-sm font-medium underline-offset-4 hover:underline"
                    disabled={busy}
                    onClick={() => judge("mock")}
                  >
                    Score with the practice judge
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <details className="border-t border-border pt-6">
            <summary className="cursor-pointer text-base font-medium">Advanced</summary>
            <div className="mt-6 grid gap-6">
              <JudgeSettings status={status} model={model} mode={mode} onModel={setModel} onMode={setMode} />
              <p className="text-sm leading-relaxed text-muted-foreground">{plainModeHelp(status, mode)}</p>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Call format</p>
                <div className="flex gap-4 text-sm">
                  <button
                    type="button"
                    className={format === "plain" ? "font-medium" : "text-muted-foreground"}
                    onClick={() => {
                      setFormat("plain");
                      if (usingSample) setTranscript(samplePlain);
                    }}
                  >
                    Plain text
                  </button>
                  <button
                    type="button"
                    className={format === "json" ? "font-medium" : "text-muted-foreground"}
                    onClick={() => {
                      setFormat("json");
                      if (usingSample) setTranscript(sampleJson);
                    }}
                  >
                    Audio JSON
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Audio JSON is the timestamped file a speech-to-text tool already produced.
                </p>
              </div>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function repairProgress(step: StreamStep | null): string {
  if (step === "retry") return "The first draft was not usable. Trying once more.";
  if (step === "rescore" || step === "score") return "Scoring the rewrite.";
  if (step === "quotes") return "Checking the new lines.";
  return "Writing a shorter prompt.";
}

function waitCopy(step: StreamStep | null, repairing: boolean): string {
  if (repairing || step === "propose" || step === "rescore") return "Rewriting the instructions, then scoring them…";
  if (step === "triage") return "Reading the call…";
  if (step === "quotes") return "Checking the lines against the transcript…";
  return "Scoring it against the script…";
}

function plainModeHelp(status: JudgeStatus | null, mode: RequestMode): string {
  const detail = modeHelp(status, mode);
  if (mode === "mock") return "Practice scores stay on this machine. Nebius is not called.";
  return detail;
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
