import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { JudgeError, type Scorecard } from "@/lib/rubric";
import { appealWithUltra } from "@/lib/score-run";
import {
  fallbackNotice,
  isSavedSample,
  limitMessage,
  savedAppeal,
  SAVED_NOTICE,
  shouldFallback,
} from "@/lib/saved-run";

export const maxDuration = 120;

const PROVIDER_APPEAL_NOTICE =
  "The second opinion didn't finish. The opinion below was prepared on this server and does not change the score. Nebius was not called.";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  try {
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    if (isSavedSample(transcript)) {
      return Response.json(savedAppeal(asScorecard(body.scorecard), SAVED_NOTICE));
    }
    const mode = resolveRequestMode(body.mode);
    const scorecard = asScorecard(body.scorecard);
    if (mode === "live" && requirements.trim() && transcript.trim()) {
      const limited = enforceLiveLimit(request, liveCallBudget("appeal", mode, scorecard.judge.model));
      if (limited) {
        return Response.json(savedAppeal(scorecard, fallbackNotice(await limitMessage(limited), "appeal")));
      }
    }
    const appeal = await appealWithUltra({ transcript, requirements, scorecard, mode });
    return Response.json({ appeal, scorecard, saved: false, fallback: false, notice: null });
  } catch (error) {
    if (shouldFallback(error)) {
      console.error("live appeal fell back", error instanceof Error ? error.message : error);
      try {
        return Response.json(savedAppeal(asScorecard(body.scorecard), PROVIDER_APPEAL_NOTICE));
      } catch (fallbackError) {
        return errorResponse(fallbackError);
      }
    }
    return errorResponse(error);
  }
}

function asScorecard(value: unknown): Scorecard {
  if (!value || typeof value !== "object") {
    throw new JudgeError("Send the scorecard to appeal.", 400);
  }
  const card = value as Scorecard;
  if (typeof card.overall !== "number" || !card.verdict || !card.summary) {
    throw new JudgeError("Send the scorecard to appeal.", 400);
  }
  card.criticalFlags = Array.isArray(card.criticalFlags) ? card.criticalFlags : [];
  return card;
}
