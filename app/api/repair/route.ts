import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { DEFAULT_MODEL_ID, resolveModel } from "@/lib/models";
import { ndjsonResponse } from "@/lib/ndjson";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { repairWithSuper } from "@/lib/score-run";
import {
  fallbackNotice,
  isSavedSample,
  limitMessage,
  savedRepair,
  SAVED_NOTICE,
  shouldFallback,
} from "@/lib/saved-run";

export const maxDuration = 120;

const PROVIDER_REPAIR_NOTICE =
  "Live Fix the prompt didn't finish. The rewrite below was prepared on this server so you still have a before and after. Nebius was not called.";

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
    const beforeOverall = typeof body.beforeOverall === "number" ? body.beforeOverall : undefined;
    const label = typeof body.label === "string" ? body.label : undefined;
    const stream = body.stream === true;

    if (isSavedSample(transcript) && requirements.trim()) {
      const saved = await savedRepair({
        transcript,
        requirements,
        label,
        beforeOverall,
        notice: SAVED_NOTICE,
        fallback: false,
      });
      return deliver(stream, saved);
    }

    const mode = resolveRequestMode(body.mode);
    const requested = resolveModel(typeof body.model === "string" ? body.model : undefined);
    const modelId = requested.id === DEFAULT_MODEL_ID ? requested.id : DEFAULT_MODEL_ID;
    const input = {
      transcript,
      requirements,
      label,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      mode,
      modelId,
      beforeOverall,
    };

    if (mode === "live" && requirements.trim() && transcript.trim()) {
      const limited = enforceLiveLimit(request, liveCallBudget("repair", mode, modelId));
      if (limited) {
        const saved = await savedRepair({
          transcript,
          requirements,
          label: input.label,
          beforeOverall,
          notice: fallbackNotice(await limitMessage(limited), "repair"),
          fallback: true,
        });
        return deliver(stream, saved);
      }
    }

    if (stream) {
      return ndjsonResponse(async (send) => {
        try {
          const repair = await repairWithSuper(input, (step) => send({ type: "status", step }));
          send({ type: "result", repair, saved: false, fallback: false, notice: null });
        } catch (error) {
          if (!shouldFallback(error)) throw error;
          console.error("live repair fell back", error instanceof Error ? error.message : error);
          const saved = await savedRepair({
            transcript,
            requirements,
            label: input.label,
            beforeOverall,
            notice: PROVIDER_REPAIR_NOTICE,
            fallback: true,
          });
          send({ type: "result", ...saved });
        }
      });
    }

    const repair = await repairWithSuper(input);
    return Response.json({ repair, saved: false, fallback: false, notice: null });
  } catch (error) {
    if (shouldFallback(error) && typeof body.transcript === "string" && typeof body.requirements === "string") {
      console.error("live repair fell back", error instanceof Error ? error.message : error);
      try {
        const saved = await savedRepair({
          transcript: body.transcript,
          requirements: body.requirements,
          label: typeof body.label === "string" ? body.label : undefined,
          beforeOverall: typeof body.beforeOverall === "number" ? body.beforeOverall : undefined,
          notice: PROVIDER_REPAIR_NOTICE,
          fallback: true,
        });
        return Response.json(saved);
      } catch (fallbackError) {
        return errorResponse(fallbackError);
      }
    }
    return errorResponse(error);
  }
}

function deliver(stream: boolean, saved: Awaited<ReturnType<typeof savedRepair>>): Response {
  if (!stream) return Response.json(saved);
  return ndjsonResponse(async (send) => {
    send({ type: "status", step: "rescore" });
    send({ type: "result", ...saved });
  });
}
