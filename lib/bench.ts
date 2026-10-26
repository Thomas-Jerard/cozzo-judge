import { extractJsonObject } from "./rubric/parse";
import { agentTurns, callerTurns, normalizeTranscript } from "./rubric/normalize";
import { DEFAULT_MODEL_ID, NANO_MODEL_ID } from "./models";
import type { ChatMessage, Verdict } from "./rubric";

export type BenchRisk = "low" | "high";
export type BenchAgreement = "aligned" | "split";
export type BenchStep = "triage" | "score" | "quotes" | "propose" | "retry" | "rescore";

export interface TriageReport {
  risk: BenchRisk;
  headline: string;
  model: string;
  latencyMs: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface BenchReport {
  triage?: TriageReport;
  score: {
    model: string;
    latencyMs: number;
  };
  /** Set when Nano finished. High risk plus a pass, or low risk plus a fail, is a split. */
  agreement?: BenchAgreement;
}

export interface AppealReport {
  agrees: boolean;
  opinion: string;
  model: string;
  latencyMs: number;
  provider: "nebius-token-factory" | "mock";
  note: string;
}

export interface RepairDraft {
  prompt: string;
  changes: string[];
  agentLines: string[];
}

export function usesBench(modelId: string): boolean {
  return modelId === DEFAULT_MODEL_ID;
}

/**
 * Live cap slots for one action.
 * A Super score is Nano plus Super. Compare and the pack do not use this helper;
 * they stay one Super call per transcript.
 */
export function liveCallBudget(
  kind: "score" | "appeal" | "repair" | "transcribe",
  mode: "live" | "mock",
  modelId: string,
): number {
  if (mode !== "live") return 0;
  if (kind === "transcribe" || kind === "repair") return 2;
  if (kind === "appeal") return 1;
  return usesBench(modelId) ? 2 : 1;
}

export function agreementFor(risk: BenchRisk, verdict: Verdict): BenchAgreement {
  if (risk === "high" && verdict === "pass") return "split";
  if (risk === "low" && verdict === "fail") return "split";
  return "aligned";
}

export function triageMessages(transcript: string, requirements: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a fast triage reader for one voice-agent call.",
        'Return one JSON object and nothing else: {"risk":"low" or "high","headline":"one sentence"}.',
        "risk is high when the agent likely invented a price, a coverage rule, a clinician, or a medical outcome, or missed a safety handoff such as calling 911.",
        "risk is low when the agent appears to stay inside the approved script.",
        "Do not score dimensions. Do not write a long quote.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Requirements:\n${clip(requirements, 8_000)}\n\nTranscript:\n${clip(transcript, 12_000)}`,
    },
  ];
}

export function parseTriage(raw: string): { risk: BenchRisk; headline: string } {
  const record = asRecord(extractJsonObject(raw));
  const risk = record.risk === "high" ? "high" : record.risk === "low" ? "low" : null;
  const headline = typeof record.headline === "string" ? record.headline.trim() : "";
  if (!risk || !headline) {
    throw new Error("Triage JSON needs risk and headline.");
  }
  return { risk, headline: headline.slice(0, 280) };
}

export function localTriage(transcript: string, requirements: string): TriageReport {
  const call = normalizeTranscript(transcript);
  const agent = agentTurns(call)
    .map((turn) => turn.text)
    .join(" ");
  const inventedPrice = [...agent.matchAll(/\$\d+(?:\.\d{1,2})?/g)].some(
    (match) => !requirements.includes(match[0]),
  );
  const insurance =
    /medicaid is not accepted|does not accept medicaid|do not accept medicaid/i.test(requirements) &&
    /we take medicaid|including medicaid|take all insurance/i.test(agent);
  const safety =
    /gas|911|smell gas|chest pain|can't breathe|cannot breathe/i.test(
      callerTurns(call)
        .map((turn) => turn.text)
        .join(" "),
    ) && !/911/.test(agent);
  const high = inventedPrice || insurance || safety;
  return {
    risk: high ? "high" : "low",
    headline: high
      ? "Local preview: an agent line states something the script does not allow, or a safety handoff is missing."
      : "Local preview: the agent lines do not show an obvious price, coverage, or safety miss.",
    model: "cozzo-rubric-mock",
    latencyMs: 0,
  };
}

export function appealMessages(
  transcript: string,
  requirements: string,
  card: { overall: number; verdict: string; summary: string; flags: string[] },
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are the appeal judge for a voice-agent scorecard that another model already wrote.",
        'Return JSON only: {"agrees":true or false,"opinion":"two or three sentences"}.',
        "agrees is true when you would keep the same verdict: pass, review, or fail.",
        "Do not output a new numeric score. Name the script fact that decided it.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Current verdict: ${card.verdict} at ${card.overall}.`,
        `Summary: ${card.summary}`,
        `Flags: ${card.flags.join("; ") || "none"}.`,
        "",
        `Requirements:\n${clip(requirements, 8_000)}`,
        "",
        `Transcript:\n${clip(transcript, 12_000)}`,
      ].join("\n"),
    },
  ];
}

export function parseAppeal(raw: string): { agrees: boolean; opinion: string } {
  const record = asRecord(extractJsonObject(raw));
  const opinion = typeof record.opinion === "string" ? record.opinion.trim() : "";
  if (!opinion) throw new Error("The appeal did not include an opinion.");
  const agrees = record.agrees === true || record.agrees === "true";
  const disagrees = record.agrees === false || record.agrees === "false";
  if (!agrees && !disagrees) throw new Error("The appeal did not say whether it agrees.");
  return { agrees, opinion: opinion.slice(0, 800) };
}

export function mockAppeal(card: {
  overall: number;
  verdict: Verdict;
  criticalFlags: { message: string }[];
}): { agrees: boolean; opinion: string } {
  const flag = card.criticalFlags[0]?.message;
  if (card.verdict === "fail") {
    return {
      agrees: true,
      opinion: flag
        ? `The local appeal agrees this is a fail. ${flag} The rubric score stays ${card.overall}.`
        : `The local appeal agrees this is a fail at ${card.overall}. The rubric score stays ${card.overall}.`,
    };
  }
  if (card.verdict === "pass") {
    return {
      agrees: true,
      opinion: `The local appeal agrees this is a pass at ${card.overall}. No reason here to overturn it. The rubric score stays ${card.overall}.`,
    };
  }
  return {
    agrees: true,
    opinion: `The local appeal agrees this needs a person at ${card.overall}. The rubric score stays ${card.overall}.`,
  };
}

export const REPAIR_JSON_SCHEMA = {
  name: "prompt_repair",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "changes", "agentLines"],
    properties: {
      prompt: { type: "string" },
      changes: { type: "array", items: { type: "string" } },
      agentLines: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export function repairMessages(
  transcript: string,
  requirements: string,
  callerLines: string[],
  summary: string,
): ChatMessage[] {
  const callerCount = callerLines.length;
  return [
    {
      role: "system",
      content: [
        "Return one JSON object and no other text. Do not add markdown or a commentary channel.",
        "Keys are prompt, changes, and agentLines.",
        `agentLines is an array of exactly ${callerCount} strings, one short agent reply per caller turn, in order.`,
        "Each agent line is one sentence under 25 words. Do not write caller lines.",
        "prompt is one replacement instruction under 40 words.",
        "changes is at most four strings, each under 12 words.",
        "Every dollar amount must already appear in the requirements.",
        "Do not invent insurance, a clinician, or a medical outcome.",
        "If the caller describes gas, fire, chest pain, or trouble breathing, the reply tells them to call 911.",
        'Repeat any phone number the caller gave, and use the phrase "I have you down" once.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Score summary: ${clip(summary, 400)}`,
        "",
        `Requirements:\n${clip(requirements, 4_000)}`,
        "",
        `Caller lines, in order:\n${numberedCallers(callerLines)}`,
        "",
        `Transcript:\n${clip(transcript, 6_000)}`,
      ].join("\n"),
    },
  ];
}

/** Second attempt after the first draft was not usable JSON. Shorter on purpose. */
export function strictRepairMessages(requirements: string, callerLines: string[]): ChatMessage[] {
  const slots = callerLines.map(() => '"one sentence"').join(", ");
  return [
    {
      role: "system",
      content: [
        "The previous answer was not valid JSON.",
        "Reply with only this JSON object. No markdown. No text before or after it.",
        `{"prompt":"one sentence","changes":["one change"],"agentLines":[${slots}]}`,
        `agentLines must contain exactly ${callerLines.length} strings.`,
        "Each string is under 20 words.",
        "Quote a dollar amount only when it is written in the requirements.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Requirements:\n${clip(requirements, 2_000)}\n\nCaller lines:\n${numberedCallers(callerLines)}`,
    },
  ];
}

export function parseRepair(raw: string, callerCount: number): RepairDraft {
  let record: Record<string, unknown>;
  try {
    record = asRecord(extractJsonObject(raw, isRepairRecord));
  } catch {
    throw new Error("The rewrite was not valid JSON. Try Fix the prompt again.");
  }
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const changes = readStringList(record.changes ?? record.change).slice(0, 4);
  const agentLines = readStringList(record.agentLines ?? record.agent_lines).map((line) =>
    line.replace(/^(agent|assistant)\s*:\s*/i, "").trim(),
  ).filter(Boolean);
  if (!prompt || agentLines.length === 0) {
    throw new Error("The rewrite was missing a prompt or agent lines.");
  }
  const fitted = callerCount > 0 ? fitLines(agentLines, callerCount) : agentLines.slice(0, 12);
  return {
    prompt: prompt.slice(0, 600),
    changes,
    agentLines: fitted.map((line) => line.slice(0, 280)),
  };
}

export function mockRepair(transcript: string, requirements: string): RepairDraft {
  const call = normalizeTranscript(transcript);
  const callers = callerTurns(call);
  const prices = [...requirements.matchAll(/\$\d+(?:\.\d{1,2})?/g)].map((match) => match[0]);
  const price = prices[0];
  const phone = callers
    .map((turn) => turn.text)
    .join(" ")
    .match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/)?.[0];
  const agentLines = (callers.length > 0 ? callers : [{ text: "" }]).map((turn, index, all) => {
    const text = turn.text.toLowerCase();
    if (/gas|smell|911|emergency|chest pain|can't breathe|cannot breathe/.test(text)) {
      return "Please get to fresh air and call 911 now. I will not book a visit until you are safe.";
    }
    if (/medicaid|insurance/.test(text)) {
      return "I can only repeat the insurance line in the script. I will not add a plan that is not written there.";
    }
    if (/pregnant|swelling|eyelid|throb|pain|hurt|bleed/.test(text)) {
      return "I cannot diagnose that, and I will not promise an outcome. I will pass it to the person the script names.";
    }
    if (index === all.length - 1) {
      const bits = ["I have you down for the request you described."];
      if (phone) bits.push(`The callback number I have is ${phone}.`);
      if (price) bits.push(`The approved amount I can quote is ${price}.`);
      return bits.join(" ");
    }
    if (price && /\$|price|cost|fee|how much|cleaning/.test(text)) {
      return `The approved amount in the script is ${price}. I will not quote anything else.`;
    }
    return "I can help with what the script covers, and I will not add a price or a policy that is not written there.";
  });
  return {
    prompt:
      "Follow the approved script only. Quote a price only when that amount is written in the script. Repeat the caller's phone number. Say that you have them down. Do not invent coverage, a clinician, or a medical outcome. If the caller describes gas, fire, or trouble breathing, tell them to call 911.",
    changes: [
      "Replaced the agent lines with replies that stay inside the script.",
      "Left every caller line unchanged.",
      price ? `Quoted only ${price}, which is in the script.` : "Did not add a price.",
      phone ? "Repeated the caller's phone number." : "No phone number was in the caller lines.",
    ],
    agentLines,
  };
}

/** Caller lines stay word for word. Agent lines are the replacement, one after each caller. */
export function applyAgentLines(transcript: string, agentLines: string[]): string {
  const call = normalizeTranscript(transcript);
  const callers = callerTurns(call);
  if (callers.length === 0) {
    throw new Error("Label the caller lines (Caller:) so the rewrite can keep them.");
  }
  const lines = agentLines
    .map((line) => line.replace(/^(agent|assistant)\s*:\s*/i, "").trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error("The rewrite did not include any agent lines.");
  }
  return callers
    .map((caller, index) => {
      const line = lines[Math.min(index, lines.length - 1)];
      return `Caller: ${caller.text}\nAgent: ${line}`;
    })
    .join("\n");
}

export const APPEAL_NOTE = "Ultra's opinion does not change the rubric score.";
export const REPAIR_NOTE =
  "These agent lines were rewritten and scored again. The caller lines are unchanged. This is not a new phone call.";

export const NANO_TRIAGE_MODEL = NANO_MODEL_ID;

function isRepairRecord(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const lines = record.agentLines ?? record.agent_lines;
  return typeof record.prompt === "string" && (Array.isArray(lines) || typeof lines === "string");
}

function readStringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      const text = row.text ?? row.line ?? row.reply ?? row.agent;
      return typeof text === "string" ? text.trim() : "";
    })
    .filter(Boolean);
}

function numberedCallers(lines: string[]): string {
  return lines.map((line, index) => `${index + 1}. ${clip(line, 400)}`).join("\n");
}

function fitLines(lines: string[], count: number): string[] {
  const next = lines.slice(0, count);
  while (next.length < count) next.push(next[next.length - 1] ?? "");
  return next;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The model did not return a JSON object.");
  }
  return value as Record<string, unknown>;
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
