/**
 * Cozzo Judge rubric.
 *
 * Import this module from a scorecard UI, an API route, or a later
 * Voice Agent Evaluator bot. It does not read environment variables and
 * does not call Nebius itself. Pass a `complete` function for a live run.
 */

export { RUBRIC_VERSION, DIMENSION_IDS } from "./types";
export type {
  ChatMessage,
  CompleteFn,
  CompletionResult,
  CriticalFlag,
  DimensionId,
  DimensionScore,
  EvidenceQuote,
  FixtureBody,
  FixtureLookup,
  JudgeInput,
  JudgeMode,
  NormalizedCall,
  Scorecard,
  TranscriptTurn,
  Verdict,
} from "./types";

export { DIMENSIONS, PASS_AT, REVIEW_AT, dimensionById } from "./dimensions";
export { fingerprint, normalizeTranscript } from "./normalize";
export { buildJudgeMessages } from "./prompt";
export { extractJsonObject, JsonScorecardError, parseJudgment, quoteAppears } from "./parse";
export { clampScore, verdictFor, weightedOverall } from "./verdict";
export { judgeCall, JudgeError } from "./judge";
export { heuristicFixture } from "./heuristic";
