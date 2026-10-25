import {
  APPEAL_NOTE,
  NANO_TRIAGE_MODEL,
  REPAIR_NOTE,
  agreementFor,
  appealMessages,
  applyAgentLines,
  localTriage,
  mockAppeal,
  mockRepair,
  parseAppeal,
  parseRepair,
  parseTriage,
  REPAIR_JSON_SCHEMA,
  repairMessages,
  strictRepairMessages,
  triageMessages,
  usesBench,
  type AppealReport,
  type BenchReport,
  type BenchStep,
} from "./bench";
import { ULTRA_MODEL_ID } from "./models";
import { completeWithNebius } from "./nebius";
import { JudgeError, judgeCall, type JudgeInput, type JudgeMode, type Scorecard } from "./rubric";
import { callerTurns, normalizeTranscript } from "./rubric/normalize";
import { findSampleFixture } from "./samples/fixtures";

const NANO_TIMEOUT_MS = 15_000;
const NANO_MAX_TOKENS = 400;
/** Propose, one stricter retry, and the rescore stay inside the 120s route. */
const REPAIR_PROPOSE_MS = 40_000;
const REPAIR_RETRY_MS = 32_000;
const REPAIR_RESCORE_MS = 40_000;
const REPAIR_PROPOSE_TOKENS = 900;
const REPAIR_RETRY_TOKENS = 600;

export async function scoreWithBench(
  input: JudgeInput,
  options: {
    mode: JudgeMode;
    modelId: string;
    onStatus?: (step: BenchStep) => void;
    /** Live repairs already spent their second call on the rewrite, so the rescore skips Nano. */
    skipTriage?: boolean;
    timeoutMs?: number;
    /** Repair rescore skips the extra JSON retry so the route stays inside 120 seconds. */
    retryInvalidJson?: boolean;
  },
): Promise<{ scorecard: Scorecard; bench: BenchReport }> {
  const pipelined = usesBench(options.modelId) && !options.skipTriage;
  let triage: BenchReport["triage"];
  if (pipelined) {
    options.onStatus?.("triage");
    triage =
      options.mode === "mock"
        ? localTriage(input.transcript, input.requirements)
        : await liveTriage(input.transcript, input.requirements);
  }

  options.onStatus?.("score");
  const started = Date.now();
  const scorecard = await judgeCall(input, {
    mode: options.mode,
    model: options.modelId,
    fixtures: findSampleFixture,
    complete:
      options.mode === "live"
        ? (messages) =>
            completeWithNebius(options.modelId, messages, {
              timeoutMs: options.timeoutMs,
            })
        : undefined,
    retryInvalidJson: options.retryInvalidJson,
  });
  options.onStatus?.("quotes");
  const bench: BenchReport = {
    triage,
    score: { model: scorecard.judge.model, latencyMs: Date.now() - started },
    agreement: triage && !triage.skipped ? agreementFor(triage.risk, scorecard.verdict) : undefined,
  };
  return { scorecard, bench };
}

export async function appealWithUltra(
  input: {
    transcript: string;
    requirements: string;
    scorecard: Scorecard;
    mode: JudgeMode;
  },
  onStatus?: (step: BenchStep) => void,
): Promise<AppealReport> {
  onStatus?.("score");
  if (input.mode === "mock") {
    const opinion = mockAppeal(input.scorecard);
    return {
      ...opinion,
      model: "cozzo-rubric-mock",
      latencyMs: 0,
      provider: "mock",
      note: `${APPEAL_NOTE} This appeal was written locally and did not call Nebius.`,
    };
  }
  const started = Date.now();
  const messages = appealMessages(input.transcript, input.requirements, {
    overall: input.scorecard.overall,
    verdict: input.scorecard.verdict,
    summary: input.scorecard.summary,
    flags: input.scorecard.criticalFlags.map((flag) => flag.message),
  });
  const opinion = await completeJson(ULTRA_MODEL_ID, messages, 800, (raw) => parseAppeal(raw));
  return {
    ...opinion,
    model: ULTRA_MODEL_ID,
    latencyMs: Date.now() - started,
    provider: "nebius-token-factory",
    note: APPEAL_NOTE,
  };
}

export async function repairWithSuper(
  input: JudgeInput & { mode: JudgeMode; modelId: string; beforeOverall?: number; summary?: string },
  onStatus?: (step: BenchStep) => void,
): Promise<{
  prompt: string;
  changes: string[];
  transcript: string;
  note: string;
  beforeOverall: number | null;
  scorecard: Scorecard;
  bench: BenchReport;
  proposeLatencyMs: number;
  provider: "nebius-token-factory" | "mock";
  model: string;
}> {
  const callers = callerTurns(normalizeTranscript(input.transcript));
  if (callers.length === 0) {
    throw new JudgeError("Label the caller lines (Caller:) so the rewrite can keep them.", 400);
  }
  onStatus?.("propose");
  const proposeStarted = Date.now();
  const callerLines = callers.map((turn) => turn.text);
  const draft =
    input.mode === "mock"
      ? mockRepair(input.transcript, input.requirements)
      : await proposeLiveRepair(input, callerLines, onStatus);
  const proposeLatencyMs = input.mode === "mock" ? 0 : Date.now() - proposeStarted;
  const transcript = applyAgentLines(input.transcript, draft.agentLines);
  const label = input.label ? `${input.label} · revised agent lines` : "Revised agent lines";
  onStatus?.("rescore");
  let scored: Awaited<ReturnType<typeof scoreWithBench>>;
  try {
    scored = await scoreWithBench(
    { transcript, requirements: input.requirements, label },
    {
      mode: input.mode,
      modelId: input.modelId,
      skipTriage: input.mode === "live",
      timeoutMs: input.mode === "live" ? REPAIR_RESCORE_MS : undefined,
      retryInvalidJson: false,
      onStatus: (step) => {
        if (step === "score" || step === "quotes") onStatus?.(step === "score" ? "rescore" : "quotes");
      },
    },
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error("Scoring the rewrite did not finish in time. Try Fix the prompt again.");
    }
    throw error;
  }
  return {
    prompt: draft.prompt,
    changes: draft.changes,
    transcript,
    note: REPAIR_NOTE,
    beforeOverall: input.beforeOverall ?? null,
    scorecard: scored.scorecard,
    bench: scored.bench,
    proposeLatencyMs,
    provider: input.mode === "live" ? "nebius-token-factory" : "mock",
    model: input.modelId,
  };
}

async function liveTriage(transcript: string, requirements: string) {
  const started = Date.now();
  try {
    const completion = await completeWithNebius(NANO_TRIAGE_MODEL, triageMessages(transcript, requirements), {
      maxTokens: NANO_MAX_TOKENS,
      timeoutMs: NANO_TIMEOUT_MS,
    });
    const parsed = parseTriage(completion.content);
    return {
      ...parsed,
      model: NANO_TRIAGE_MODEL,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      risk: "low" as const,
      headline: "Triage did not finish.",
      model: NANO_TRIAGE_MODEL,
      latencyMs: Date.now() - started,
      skipped: true,
      skipReason: error instanceof Error ? error.message.slice(0, 180) : "Nano did not return a risk line.",
    };
  }
}

async function proposeLiveRepair(
  input: JudgeInput & { modelId: string; summary?: string; label?: string },
  callerLines: string[],
  onStatus?: (step: BenchStep) => void,
) {
  const summary =
    input.summary ||
    (input.label ? `${input.label} needs a tighter prompt.` : "The scorecard needs a tighter prompt.");
  const parse = (raw: string) => parseRepair(raw, callerLines.length);
  try {
    return await completeRepair(input.modelId, repairMessages(input.transcript, input.requirements, callerLines, summary), {
      maxTokens: REPAIR_PROPOSE_TOKENS,
      timeoutMs: REPAIR_PROPOSE_MS,
    }, parse);
  } catch (error) {
    onStatus?.("retry");
    try {
      return await completeRepair(
        input.modelId,
        strictRepairMessages(input.requirements, callerLines),
        { maxTokens: REPAIR_RETRY_TOKENS, timeoutMs: REPAIR_RETRY_MS },
        parse,
      );
    } catch (retryError) {
      if (isTimeoutError(retryError) || isTimeoutError(error)) {
        throw new Error("The rewrite did not finish in time. Try Fix the prompt again.");
      }
      throw retryError;
    }
  }
}

async function completeRepair<T>(
  modelId: string,
  messages: { role: "system" | "user"; content: string }[],
  limits: { maxTokens: number; timeoutMs: number },
  parse: (raw: string) => T,
): Promise<T> {
  const completion = await completeWithNebius(modelId, messages, {
    maxTokens: limits.maxTokens,
    timeoutMs: limits.timeoutMs,
    jsonSchema: {
      name: REPAIR_JSON_SCHEMA.name,
      strict: REPAIR_JSON_SCHEMA.strict,
      schema: REPAIR_JSON_SCHEMA.schema as unknown as Record<string, unknown>,
    },
    disableThinking: true,
  });
  return parse(completion.content);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

async function completeJson<T>(
  modelId: string,
  messages: { role: "system" | "user"; content: string }[],
  maxTokens: number,
  parse: (raw: string) => T,
): Promise<T> {
  let completion = await completeWithNebius(modelId, messages, { maxTokens });
  try {
    return parse(completion.content);
  } catch {
    completion = await completeWithNebius(modelId, messages, { maxTokens });
    return parse(completion.content);
  }
}
