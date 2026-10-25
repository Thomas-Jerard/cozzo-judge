/**
 * Shared types for the Cozzo Judge rubric.
 * This module is the contract a future Voice Agent Evaluator bot can import
 * without depending on the Next.js app.
 */

export const RUBRIC_VERSION = "1.0.0";

export const DIMENSION_IDS = [
  "task_completion",
  "factual_accuracy",
  "escalation_handoff",
  "tone_empathy",
  "hallucination",
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export type Verdict = "pass" | "review" | "fail";

export type JudgeMode = "live" | "mock";

export interface TranscriptTurn {
  speaker: "agent" | "caller" | "unknown";
  speakerLabel: string;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface NormalizedCall {
  turns: TranscriptTurn[];
  /** Speaker-labeled plain text. Evidence quotes are checked against this. */
  plainText: string;
  format: "plain" | "json" | "vtt";
  durationSeconds?: number;
  warnings: string[];
}

export interface EvidenceQuote {
  quote: string;
  speaker?: string;
  note: string;
  /** True when the quote appears verbatim in the transcript. */
  verified: boolean;
}

export interface DimensionScore {
  id: DimensionId;
  name: string;
  /** Share of the overall score, from 0 to 1. */
  weight: number;
  /** 0–100. Higher is better on every dimension, including made-up answers. */
  score: number;
  rationale: string;
  evidence: EvidenceQuote[];
}

export interface CriticalFlag {
  code: string;
  severity: "critical" | "warning";
  message: string;
}

export interface Scorecard {
  rubricVersion: string;
  overall: number;
  verdict: Verdict;
  /** True when a critical flag failed a score that would otherwise pass or need review. */
  verdictOverridden: boolean;
  summary: string;
  dimensions: DimensionScore[];
  criticalFlags: CriticalFlag[];
  call: {
    label?: string;
    turnCount: number;
    agentTurns: number;
    callerTurns: number;
    durationSeconds?: number;
    format: NormalizedCall["format"];
    warnings: string[];
  };
  judge: {
    mode: JudgeMode;
    model: string;
    provider: "nebius-token-factory" | "mock";
    note: string;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface JudgeInput {
  transcript: string;
  requirements: string;
  label?: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface CompletionResult {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export type CompleteFn = (
  messages: ChatMessage[],
) => Promise<CompletionResult | string>;

/** Hand-authored preview for a known synthetic sample. Quotes must be verbatim. */
export interface FixtureBody {
  summary: string;
  dimensions: Record<
    DimensionId,
    {
      score: number;
      rationale: string;
      evidence: { quote: string; note: string }[];
    }
  >;
  criticalFlags: CriticalFlag[];
}

export type FixtureLookup = (plainText: string) => FixtureBody | null;
