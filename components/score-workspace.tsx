"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CallResult } from "@/components/call-result";
import { CozzoCanary } from "@/components/cozzo-canary";
import { PageShell } from "@/components/page-shell";
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
import { combineBrief, OWN_EXAMPLE, transcriptHint, validateOwnCall } from "@/lib/own-call";
import type { Scorecard } from "@/lib/rubric";
import { encodeCardLink, reportMarkdown, type SharedCard } from "@/lib/share";
import { SCENARIOS, scenarioById, type SampleProvider, type SampleScenario } from "@/lib/samples";

export function ScoreWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("sample");
  const ownParam = searchParams.get("own") === "1";
  const routeKey = ownParam ? "own" : (requested ?? "dental");
  const initialScenario = scenarioById(requested);
  const [status, setStatus] = useState<JudgeStatus | null>(null);
  const [scenario, setScenario] = useState<SampleScenario>(initialScenario);
  const [provider, setProvider] = useState<SampleProvider>(initialScenario.providers[0]);
  const [format, setFormat] = useState<"plain" | "json">("plain");
  const [requirements, setRequirements] = useState(ownParam ? "" : initialScenario.requirements);
  const [transcript, setTranscript] = useState(ownParam ? "" : initialScenario.providers[0].plain);
  const [agentScript, setAgentScript] = useState("");
  const [businessFacts, setBusinessFacts] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
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
  const [ownMode, setOwnMode] = useState(ownParam);
  const [usingSample, setUsingSample] = useState(!ownParam);
  const [editing, setEditing] = useState(false);
  const seenRoute = useRef<string | null>(null);

  useEffect(() => {
    if (seenRoute.current === null) {
      seenRoute.current = routeKey;
      return;
    }
    if (seenRoute.current === routeKey) return;
    const own = ownParam;
    const sampleId = requested;
    const key = routeKey;
    seenRoute.current = key;
    queueMicrotask(() => {
      if (seenRoute.current !== key) return;
      if (own) {
        setOwnMode(true);
        setUsingSample(false);
        setEditing(true);
        setAgentScript("");
        setBusinessFacts("");
        setRequirements("");
        setTranscript("");
        setFormError(null);
        setFormat("plain");
        setCard(null);
        setBench(null);
        setAppeal(null);
        setRepair(null);
        setBeforeScore(null);
        setError(null);
        setNotice(null);
        setShareText(null);
        setRateLimited(false);
        return;
      }
      const next = scenarioById(sampleId);
      setOwnMode(false);
      setScenario(next);
      setProvider(next.providers[0]);
      setFormat("plain");
      setRequirements(next.requirements);
      setTranscript(next.providers[0].plain);
      setAgentScript("");
      setBusinessFacts("");
      setFormError(null);
      setCard(null);
      setBench(null);
      setAppeal(null);
      setRepair(null);
      setBeforeScore(null);
      setError(null);
      setNotice(null);
      setShareText(null);
      setRateLimited(false);
      setUsingSample(true);
      setEditing(false);
    });
  }, [ownParam, requested, routeKey]);

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

  function activeRequirements(): string {
    return ownMode ? combineBrief(agentScript, businessFacts) : requirements;
  }

  function callLabel(): string {
    if (ownMode) {
      const example =
        transcript === OWN_EXAMPLE.transcript &&
        agentScript === OWN_EXAMPLE.script &&
        businessFacts === OWN_EXAMPLE.facts;
      return example ? OWN_EXAMPLE.label : "Your call";
    }
    return usingSample ? `${scenario.business} · ${provider.name}` : "Pasted call";
  }

  function loadExample() {
    setTranscript(OWN_EXAMPLE.transcript);
    setAgentScript(OWN_EXAMPLE.script);
    setBusinessFacts(OWN_EXAMPLE.facts);
    setFormError(null);
    clearResult();
  }

  function showOwn() {
    if (ownMode && ownParam) return;
    router.replace("/score?own=1", { scroll: false });
  }

  function showSample() {
    if (!ownMode && !ownParam) return;
    router.replace(`/score?sample=${scenario.id}`, { scroll: false });
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
    if (ownMode) {
      const problem = validateOwnCall(transcript, agentScript, businessFacts);
      if (problem) {
        setFormError(problem);
        setError(null);
        setRateLimited(false);
        return;
      }
      setFormError(null);
    }
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
        requirements: activeRequirements(),
        label: callLabel(),
        model,
        mode: requestMode,
        stream: true,
      }, setStep);
      setCard(result.scorecard);
      setBench(result.bench);
      if (window.innerWidth < 1280) {
        document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        requirements: activeRequirements(),
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
        requirements: activeRequirements(),
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
  const ready = ownMode
    ? transcript.trim().length > 0 && combineBrief(agentScript, businessFacts).length > 0
    : requirements.trim().length > 0 && transcript.trim().length > 0;
  const hint = ownMode ? transcriptHint(transcript) : null;
  const exampleLoaded =
    ownMode &&
    transcript === OWN_EXAMPLE.transcript &&
    agentScript === OWN_EXAMPLE.script &&
    businessFacts === OWN_EXAMPLE.facts;
  const flowStep: 1 | 2 | 3 = loading && !card ? 2 : card ? 3 : 1;
  const samplePlain = provider.plain;
  const sampleJson = provider.audioJson;
  const showEditor = !usingSample || editing;

  return (
    <PageShell>
      <div className="grid gap-[var(--section-gap)]">
      <StepFlow step={flowStep} />

      {flowStep === 2 ? (
        <div className="flex flex-col items-start gap-6 py-6 sm:flex-row sm:items-center">
          <CozzoCanary pose="think" size={104} label="Cozzo the Canary listening to the call" />
          <div className="grid gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Cozzo is listening to the call</h1>
            <p className="measure text-lg leading-relaxed text-muted-foreground">{waitCopy(step, repairing)}</p>
          </div>
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
        <div className="grid items-start gap-8 xl:grid-cols-2 xl:gap-x-12">
          <div className="grid gap-8">
            <div className="grid gap-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {ownMode ? "Test your own call" : "Pick a call"}
              </h1>
              <p className="measure text-base leading-relaxed text-muted-foreground">
                {ownMode
                  ? "Paste the transcript. Add the agent’s script, the business facts, or both."
                  : "Choose a sample, or test a call of your own."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="How to choose a call">
              <button type="button" className="choice" aria-pressed={!ownMode} onClick={showSample}>
                <span className="block font-medium">Use a sample</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Dental, HVAC, or a med spa.</span>
              </button>
              <button type="button" className="choice" aria-pressed={ownMode} onClick={showOwn}>
                <span className="block font-medium">Test your own call</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Paste a transcript and the brief.</span>
              </button>
            </div>

            {ownMode ? (
              <div className="flex items-end gap-4">
                <CozzoCanary pose="peek" size={88} label="Cozzo the Canary waiting for a call" />
                <p className="measure pb-1 text-sm leading-relaxed text-muted-foreground">
                  Start each line with Agent: or Caller:. I’ll score it against the script and the facts.
                </p>
              </div>
            ) : (
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
                          className="choice"
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
                          className="choice"
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
            )}
          </div>

          {ownMode ? (
            <div className="grid gap-6 xl:col-start-2 xl:row-start-1 xl:row-span-3">
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="own-transcript">The call</Label>
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={loadExample}>
                    Load example
                  </Button>
                </div>
                <Textarea
                  id="own-transcript"
                  value={transcript}
                  placeholder={"Agent: Thanks for calling. How can I help?\nCaller: I need to book a visit."}
                  onChange={(event) => {
                    setTranscript(event.target.value);
                    setFormError(null);
                  }}
                  className="field-sizing-fixed min-h-56 text-sm leading-relaxed"
                />
                {hint ? <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
                {exampleLoaded ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">Harbor Voice example is in the boxes. Edit any line to make it yours.</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agent-script">
                  Agent script <span className="font-normal text-muted-foreground">optional</span>
                </Label>
                <Textarea
                  id="agent-script"
                  value={agentScript}
                  placeholder="You are the receptionist. Be brief. Do not invent a price."
                  onChange={(event) => {
                    setAgentScript(event.target.value);
                    setFormError(null);
                  }}
                  className="field-sizing-fixed min-h-28 text-sm leading-relaxed"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="business-facts">
                  Business facts <span className="font-normal text-muted-foreground">optional</span>
                </Label>
                <Textarea
                  id="business-facts"
                  value={businessFacts}
                  placeholder={"Hours: 8 to 5 weekdays. Cleaning: $189.\nOffer a person if the caller asks."}
                  onChange={(event) => {
                    setBusinessFacts(event.target.value);
                    setFormError(null);
                  }}
                  className="field-sizing-fixed min-h-36 text-sm leading-relaxed"
                />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Assistant, customer, and patient work as labels too. The call can be 80,000 characters. The script and
                facts together can be 20,000. A live score on the default model uses 2 of this network’s 10 scores this
                hour. Practice scores are not counted.
              </p>
            </div>
          ) : (
            <div
              className={`${showEditor ? "grid" : "hidden xl:grid"} gap-6 xl:col-start-2 xl:row-start-1 xl:row-span-3`}
            >
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
          )}

          {ownMode ? null : (
            <div className="grid gap-4">
              {showEditor ? null : (
                <button
                  type="button"
                  className="w-fit text-sm font-medium underline-offset-4 hover:underline xl:hidden"
                  onClick={() => setEditing(true)}
                >
                  Look at or edit this call
                </button>
              )}
            </div>
          )}

          <div className="grid gap-8">
            <div className="grid gap-4">
              <Button type="button" size="lg" className="h-12 w-full px-6 text-base sm:w-fit" disabled={busy || (!ownMode && !ready)} onClick={() => judge()}>
                Judge this call
              </Button>
              {formError ? (
                <p role="alert" className="text-sm leading-relaxed">{formError}</p>
              ) : null}
              {!ownMode && !ready ? <p className="text-sm text-muted-foreground">Add the script and the call first.</p> : null}
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
                <p className="measure text-sm leading-relaxed text-muted-foreground">{plainModeHelp(status, mode)}</p>
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
                  <p className="measure text-sm leading-relaxed text-muted-foreground">
                    Audio JSON is the timestamped file a speech-to-text tool already produced.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>
      ) : null}
      </div>
    </PageShell>
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
