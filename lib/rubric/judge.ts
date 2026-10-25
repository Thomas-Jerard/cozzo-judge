import { dimensionById } from "./dimensions";
import { heuristicFixture } from "./heuristic";
import { agentTurns, callerTurns, normalizeTranscript } from "./normalize";
import { JsonScorecardError, parseJudgment, quoteAppears, type ParsedJudgment } from "./parse";
import { buildJudgeMessages } from "./prompt";
import { DIMENSION_IDS, RUBRIC_VERSION } from "./types";
import { verdictFor, weightedOverall } from "./verdict";
import type {
  CompleteFn,
  CompletionResult,
  DimensionId,
  FixtureLookup,
  JudgeInput,
  JudgeMode,
  Scorecard,
} from "./types";

const MOCK_MODEL = "cozzo-rubric-mock";

export async function judgeCall(
  input: JudgeInput,
  options: {
    mode: JudgeMode;
    model: string;
    complete?: CompleteFn;
    fixtures?: FixtureLookup;
    /** When false, a bad JSON scorecard is not sent to the model a second time. */
    retryInvalidJson?: boolean;
  },
): Promise<Scorecard> {
  const requirements = input.requirements?.trim() ?? "";
  if (!requirements) {
    throw new JudgeError("Add the business script or requirements so the judge has something to score against.", 400);
  }
  if (requirements.length > 20_000) {
    throw new JudgeError("Requirements are too long. Keep them under 20,000 characters.", 400);
  }

  const transcript = input.transcript ?? "";
  if (transcript.length > 80_000) {
    throw new JudgeError("That transcript is too long. Keep it under 80,000 characters.", 400);
  }

  const call = normalizeTranscript(transcript);
  if (call.turns.length === 0) {
    throw new JudgeError("Paste or upload a transcript before scoring.", 400);
  }

  const label = input.label?.trim() || undefined;

  if (options.mode === "mock") {
    const fixture = options.fixtures?.(call.plainText) ?? null;
    const body = fixture ?? heuristicFixture(call, requirements);
    const card = assemble(
      {
        summary: body.summary,
        criticalFlags: body.criticalFlags,
        dimensions: (Object.keys(body.dimensions) as DimensionId[]).map((id) => {
          const value = body.dimensions[id];
          const defined = dimensionById(id);
          return {
            id,
            name: defined.name,
            weight: defined.weightPercent / 100,
            score: value.score,
            rationale: value.rationale,
            evidence: value.evidence.map((item) => ({
              quote: item.quote,
              note: item.note,
              verified: quoteAppears(item.quote, call.plainText),
            })),
          };
        }),
      },
      call,
      label,
      {
        mode: "mock",
        model: MOCK_MODEL,
        provider: "mock",
        note: fixture
          ? "Calibrated preview for this synthetic sample. A live run calls NVIDIA Nemotron on Nebius Token Factory."
          : "Heuristic preview from the local rubric. It did not call Nebius. A live run uses NVIDIA Nemotron.",
      },
    );
    return card;
  }

  if (!options.complete) {
    throw new JudgeError("Live judging needs a Token Factory client.", 500);
  }

  const messages = buildJudgeMessages({ ...input, requirements, label }, call);
  let completion = asResult(await options.complete(messages));
  let parsed: ParsedJudgment;
  try {
    parsed = parseJudgment(completion.content, call);
  } catch (error) {
    if (!(error instanceof JsonScorecardError) || options.retryInvalidJson === false) throw error;
    completion = asResult(await options.complete(messages));
    parsed = parseJudgment(completion.content, call);
  }
  return assemble(parsed, call, label, {
    mode: "live",
    model: options.model,
    provider: "nebius-token-factory",
    note: "Scored by an NVIDIA Nemotron model on Nebius Token Factory.",
    promptTokens: completion.usage?.promptTokens,
    completionTokens: completion.usage?.completionTokens,
  });
}

function assemble(
  parsed: {
    summary: string;
    dimensions: Scorecard["dimensions"];
    criticalFlags: Scorecard["criticalFlags"];
  },
  call: ReturnType<typeof normalizeTranscript>,
  label: string | undefined,
  judge: Scorecard["judge"],
): Scorecard {
  const dimensions = DIMENSION_IDS.map((id) => {
    const dimension = parsed.dimensions.find((item) => item.id === id);
    const defined = dimensionById(id);
    return {
      id,
      name: defined.name,
      weight: defined.weightPercent / 100,
      score: dimension?.score ?? 0,
      rationale: dimension?.rationale ?? "This dimension was not scored.",
      evidence: dimension?.evidence ?? [],
    };
  });
  const overall = weightedOverall(dimensions);
  const { verdict, verdictOverridden } = verdictFor(overall, parsed.criticalFlags);
  const duration =
    call.durationSeconds ??
    call.turns.reduce<number | undefined>((max, turn) => {
      if (turn.endSeconds == null) return max;
      return max == null ? turn.endSeconds : Math.max(max, turn.endSeconds);
    }, undefined);

  return {
    rubricVersion: RUBRIC_VERSION,
    overall,
    verdict,
    verdictOverridden,
    summary: parsed.summary,
    dimensions,
    criticalFlags: parsed.criticalFlags,
    call: {
      label,
      turnCount: call.turns.length,
      agentTurns: agentTurns(call).length,
      callerTurns: callerTurns(call).length,
      durationSeconds: duration,
      format: call.format,
      warnings: call.warnings,
    },
    judge,
  };
}

function asResult(value: CompletionResult | string): CompletionResult {
  return typeof value === "string" ? { content: value } : value;
}

export class JudgeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JudgeError";
    this.status = status;
  }
}
