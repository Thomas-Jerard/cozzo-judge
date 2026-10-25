import type { DimensionId } from "./types";

export interface RubricDimension {
  id: DimensionId;
  name: string;
  /** Integer percent of the overall score. The five values sum to 100. */
  weightPercent: number;
  /** What a high score means, in buyer language. */
  highMeans: string;
  /** Instruction included in the model prompt. */
  prompt: string;
}

/**
 * Buyer-facing rubric for a voice-agent call.
 * Weights favor whether the job got done and whether the agent stayed
 * inside the script. Tone matters, and it cannot rescue a made-up price
 * or a missed handoff.
 */
export const DIMENSIONS: readonly RubricDimension[] = [
  {
    id: "task_completion",
    name: "Task completion",
    weightPercent: 30,
    highMeans: "The caller left with the booking, answer, or complete message the script requires.",
    prompt:
      "Did the agent finish the caller's actual job: book, reschedule, answer from the script, dispatch, or take a complete message? A confident close that skipped a required detail (name, phone, address, consent) is incomplete. Score only the agent.",
  },
  {
    id: "factual_accuracy",
    name: "Factual accuracy",
    weightPercent: 25,
    highMeans: "Prices, hours, insurance, service area, and policies match the script.",
    prompt:
      "Did every factual statement match the business requirements? Hours, prices, insurance, who is working, service area, and what the business will not do all count. Paraphrase is fine. A contradicted fact is not.",
  },
  {
    id: "escalation_handoff",
    name: "Escalation and handoff",
    weightPercent: 20,
    highMeans: "Safety issues, complaints, and human-only requests were handed off as the script says.",
    prompt:
      "When the script required a human, a message, a refusal, or an emergency instruction (including 911), did the agent do it? If nothing in the call required a handoff, score this high and say so. A missed safety handoff is a severe miss.",
  },
  {
    id: "tone_empathy",
    name: "Tone and empathy",
    weightPercent: 10,
    highMeans: "The agent was clear, polite, and appropriately warm.",
    prompt:
      "Was the agent clear, polite, and appropriately warm without being robotic, slangy, pushy, or dismissive? Do not reward warmth that papers over a wrong answer. Quote the line that sets the tone.",
  },
  {
    id: "hallucination",
    name: "Made-up answers",
    weightPercent: 15,
    highMeans: "The agent did not invent prices, policies, diagnoses, or outcomes.",
    prompt:
      "Did the agent invent facts, prices, availability, coverage, medical or technical advice, or outcomes that are not in the requirements? Higher is better: 100 means no invented content. Quote the invented line, or quote the refusal if the agent declined to invent one.",
  },
] as const;

export const PASS_AT = 85;
export const REVIEW_AT = 70;

const WEIGHT_TOTAL = DIMENSIONS.reduce((sum, dimension) => sum + dimension.weightPercent, 0);

if (WEIGHT_TOTAL !== 100) {
  throw new Error(`Rubric weights must sum to 100. They sum to ${WEIGHT_TOTAL}.`);
}

export function dimensionById(id: DimensionId): RubricDimension {
  const found = DIMENSIONS.find((dimension) => dimension.id === id);
  if (!found) {
    throw new Error(`Unknown rubric dimension: ${id}`);
  }
  return found;
}

export function weightFraction(id: DimensionId): number {
  return dimensionById(id).weightPercent / 100;
}
