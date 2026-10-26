import { agreementFor, localTriage, mockAppeal, type AppealReport, type BenchReport } from "@/lib/bench";
import { fingerprint, JudgeError, judgeCall, normalizeTranscript, type Scorecard } from "@/lib/rubric";
import { repairWithSuper } from "@/lib/score-run";
import {
  dentalHarbor,
  dentalHarborRevised,
  dentalNorthline,
  dentalRequirements,
  HARBOR_REPAIR_CHANGES,
  HARBOR_REPAIR_PROMPT,
} from "@/lib/samples/dental";
import { findSampleFixture } from "@/lib/samples/fixtures";
import { renderPlain } from "@/lib/samples/format";
import { TranscribeError } from "@/lib/transcribe/limits";

export const SAVED_MODEL = "cozzo-saved-run";

export const SAVED_NOTICE =
  "Saved run. This score was prepared before judging week. Nebius was not called, and it did not use a rate-limit slot.";

export const PROVIDER_NOTICE =
  "Live scoring didn't finish. The score below is the saved Harbor Voice example, so you still have a result. It is not a score of the call you sent.";

export const SAVED_REPAIR_NOTE =
  "Saved run. The caller’s words stay. The agent lines are a prepared rewrite, scored on this server. Nebius was not called.";

export const SAVED_APPEAL_NOTE =
  "Saved run. This opinion was prepared on the server and does not change the score. Nebius was not called.";

export const EXAMPLE_TRANSCRIPT = renderPlain(dentalHarbor);

export const EXAMPLE_TRANSCRIPT_NOTE =
  "That recording could not be transcribed. These lines are the saved Harbor Voice example, so you can still score a call. Edit them before you score. Nebius was not called.";

export interface SavedScore {
  scorecard: Scorecard;
  bench: BenchReport;
  saved: true;
  fallback: boolean;
  notice: string;
}

export function isSavedSample(transcript: string): boolean {
  const plain = normalizeTranscript(transcript).plainText;
  return Boolean(plain && findSampleFixture(plain));
}

export function shouldFallback(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error instanceof JudgeError && error.status < 500) return false;
  if (error instanceof TranscribeError && error.status < 500) return false;
  if (/NEBIUS_API_KEY|Unknown model/i.test(error.message)) return false;
  return true;
}

export async function preparedScore(transcript: string, requirements: string, label?: string): Promise<SavedScore | null> {
  if (!isSavedSample(transcript)) return null;
  const scorecard = stampScore(
    await judgeCall(
      { transcript, requirements, label },
      { mode: "mock", model: SAVED_MODEL, fixtures: findSampleFixture },
    ),
  );
  return bundle(transcript, requirements, scorecard, false, SAVED_NOTICE);
}

export async function exampleScore(notice: string): Promise<SavedScore> {
  const prepared = await preparedScore(EXAMPLE_TRANSCRIPT, dentalRequirements, "Saved example · Harbor Voice");
  if (!prepared) throw new Error("The Harbor saved run is missing.");
  return { ...prepared, fallback: true, notice };
}

export async function examplePair(notice: string): Promise<{
  scorecards: [Scorecard, Scorecard];
  saved: true;
  fallback: true;
  notice: string;
}> {
  const left = await preparedScore(renderPlain(dentalNorthline), dentalRequirements, "Saved example · Northline Voice");
  const right = await preparedScore(EXAMPLE_TRANSCRIPT, dentalRequirements, "Saved example · Harbor Voice");
  if (!left || !right) throw new Error("The saved dental pair is missing.");
  return {
    scorecards: [left.scorecard, right.scorecard],
    saved: true,
    fallback: true,
    notice,
  };
}

export async function savedPair(
  calls: { transcript: string; label?: string }[],
  requirements: string,
): Promise<{ scorecards: Scorecard[]; saved: true; fallback: false; notice: string } | null> {
  const scorecards: Scorecard[] = [];
  for (const call of calls) {
    const prepared = await preparedScore(call.transcript, requirements, call.label);
    if (!prepared) return null;
    scorecards.push(prepared.scorecard);
  }
  return {
    scorecards,
    saved: true,
    fallback: false,
    notice: "Saved run. These scores were prepared before judging week. Nebius was not called, and they did not use a rate-limit slot.",
  };
}

export function savedAppeal(card: Scorecard, notice: string): { appeal: AppealReport; saved: true; fallback: boolean; notice: string } {
  const opinion = mockAppeal(card);
  return {
    appeal: {
      ...opinion,
      model: SAVED_MODEL,
      latencyMs: 0,
      provider: "mock",
      note: SAVED_APPEAL_NOTE,
    },
    saved: true,
    fallback: notice !== SAVED_NOTICE,
    notice,
  };
}

export async function savedRepair(input: {
  transcript: string;
  requirements: string;
  label?: string;
  beforeOverall?: number;
  notice: string;
  fallback: boolean;
}): Promise<{
  repair: Awaited<ReturnType<typeof repairWithSuper>>;
  saved: true;
  fallback: boolean;
  notice: string;
}> {
  if (isHarborCall(input.transcript)) {
    return harborSavedRepair(input);
  }
  const repair = await repairWithSuper({
    transcript: input.transcript,
    requirements: input.requirements,
    label: input.label,
    beforeOverall: input.beforeOverall,
    mode: "mock",
    modelId: SAVED_MODEL,
  });
  repair.scorecard = stampScore(repair.scorecard);
  repair.bench = stampBench(input.transcript, input.requirements, repair.scorecard, repair.bench);
  repair.note = SAVED_REPAIR_NOTE;
  repair.model = SAVED_MODEL;
  repair.provider = "mock";
  repair.proposeLatencyMs = 0;
  return { repair, saved: true, fallback: input.fallback, notice: input.notice };
}

export async function limitMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Live scoring is paused for this network right now.";
  } catch {
    return "Live scoring is paused for this network right now.";
  }
}

export function fallbackNotice(message: string, kind: "score" | "compare" | "repair" | "appeal"): string {
  const lead = message.replace(/\s+/g, " ").trim();
  if (kind === "compare") {
    return `${lead} The comparison below is the saved Brightmolar example, Northline Voice beside Harbor Voice. It is not a score of the calls you sent.`;
  }
  if (kind === "repair") {
    return `${lead} The rewrite below was prepared on this server so you still have a before and after. Nebius was not called.`;
  }
  if (kind === "appeal") {
    return `${lead} The opinion below was prepared on this server and does not change the score. Nebius was not called.`;
  }
  return `${lead} The score below is the saved Harbor Voice example, so you still have a result. It is not a score of the call you sent.`;
}

function isHarborCall(transcript: string): boolean {
  const plain = normalizeTranscript(transcript).plainText;
  return Boolean(plain) && fingerprint(plain) === fingerprint(renderPlain(dentalHarbor));
}

async function harborSavedRepair(input: {
  transcript: string;
  requirements: string;
  label?: string;
  beforeOverall?: number;
  notice: string;
  fallback: boolean;
}): Promise<{
  repair: Awaited<ReturnType<typeof repairWithSuper>>;
  saved: true;
  fallback: boolean;
  notice: string;
}> {
  const transcript = renderPlain(dentalHarborRevised);
  const label = input.label ? `${input.label} · revised agent lines` : "Revised agent lines";
  const scorecard = stampScore(
    await judgeCall(
      { transcript, requirements: input.requirements, label },
      { mode: "mock", model: SAVED_MODEL, fixtures: findSampleFixture },
    ),
  );
  const repair: Awaited<ReturnType<typeof repairWithSuper>> = {
    prompt: HARBOR_REPAIR_PROMPT,
    changes: [...HARBOR_REPAIR_CHANGES],
    transcript,
    note: SAVED_REPAIR_NOTE,
    beforeOverall: input.beforeOverall ?? null,
    scorecard,
    bench: stampBench(transcript, input.requirements, scorecard),
    proposeLatencyMs: 0,
    provider: "mock",
    model: SAVED_MODEL,
  };
  return { repair, saved: true, fallback: input.fallback, notice: input.notice };
}

function bundle(
  transcript: string,
  requirements: string,
  scorecard: Scorecard,
  fallback: boolean,
  notice: string,
): SavedScore {
  return {
    scorecard,
    bench: stampBench(transcript, requirements, scorecard),
    saved: true,
    fallback,
    notice,
  };
}

function stampScore(card: Scorecard): Scorecard {
  return {
    ...card,
    judge: {
      ...card.judge,
      mode: "mock",
      model: SAVED_MODEL,
      provider: "mock",
      note: SAVED_NOTICE,
      promptTokens: undefined,
      completionTokens: undefined,
    },
  };
}

function stampBench(
  transcript: string,
  requirements: string,
  scorecard: Scorecard,
  existing?: BenchReport,
): BenchReport {
  const triage = existing?.triage
    ? { ...existing.triage, model: SAVED_MODEL, latencyMs: 0 }
    : { ...localTriage(transcript, requirements), model: SAVED_MODEL, latencyMs: 0 };
  return {
    triage,
    score: { model: SAVED_MODEL, latencyMs: 0 },
    agreement: triage.skipped ? existing?.agreement : agreementFor(triage.risk, scorecard.verdict),
  };
}
