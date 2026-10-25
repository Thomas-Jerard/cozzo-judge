import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { JudgeError, type Scorecard } from "@/lib/rubric";
import { appealWithUltra } from "@/lib/score-run";

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  try {
    const mode = resolveRequestMode(body.mode);
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    const scorecard = asScorecard(body.scorecard);
    if (mode === "live" && requirements.trim() && transcript.trim()) {
      const limited = enforceLiveLimit(request, liveCallBudget("appeal", mode, scorecard.judge.model));
      if (limited) return limited;
    }
    const appeal = await appealWithUltra({ transcript, requirements, scorecard, mode });
    return Response.json({ appeal, scorecard });
  } catch (error) {
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
