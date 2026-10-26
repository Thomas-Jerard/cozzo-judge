import { errorResponse } from "@/lib/http";
import { resolveModel } from "@/lib/models";
import { completeWithNebius, resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { judgeCall } from "@/lib/rubric";
import { findSampleFixture } from "@/lib/samples/fixtures";
import {
  examplePair,
  fallbackNotice,
  limitMessage,
  savedPair,
  shouldFallback,
} from "@/lib/saved-run";

export const maxDuration = 120;

interface CallBody {
  label?: unknown;
  transcript?: unknown;
}

const PROVIDER_COMPARE_NOTICE =
  "Live compare didn't finish. The comparison below is the saved Brightmolar example, Northline Voice beside Harbor Voice. It is not a score of the calls you sent.";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const calls = Array.isArray(body.calls) ? (body.calls as CallBody[]) : [];
  if (calls.length !== 2) {
    return Response.json({ error: "Compare needs exactly two transcripts." }, { status: 400 });
  }

  try {
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    const pairCalls = calls.map((call) => ({
      transcript: typeof call.transcript === "string" ? call.transcript : "",
      label: typeof call.label === "string" ? call.label : undefined,
    }));
    const prepared = await savedPair(pairCalls, requirements);
    if (prepared) return Response.json(prepared);

    const mode = resolveRequestMode(body.mode);
    const model = resolveModel(typeof body.model === "string" ? body.model : undefined);

    if (mode === "live" && requirements.trim() && pairCalls.every((call) => call.transcript.trim())) {
      const limited = enforceLiveLimit(request, pairCalls.length);
      if (limited) {
        return Response.json(await examplePair(fallbackNotice(await limitMessage(limited), "compare")));
      }
    }
    const scorecards = await Promise.all(
      pairCalls.map((call) =>
        judgeCall(
          { transcript: call.transcript, requirements, label: call.label },
          {
            mode,
            model: model.id,
            fixtures: findSampleFixture,
            complete: mode === "live" ? (messages) => completeWithNebius(model.id, messages) : undefined,
          },
        ),
      ),
    );
    return Response.json({ scorecards, saved: false, fallback: false, notice: null });
  } catch (error) {
    if (shouldFallback(error)) {
      console.error("live compare fell back", error instanceof Error ? error.message : error);
      return Response.json(await examplePair(PROVIDER_COMPARE_NOTICE));
    }
    return errorResponse(error);
  }
}
