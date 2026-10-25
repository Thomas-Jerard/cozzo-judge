import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { DEFAULT_MODEL_ID, resolveModel } from "@/lib/models";
import { ndjsonResponse } from "@/lib/ndjson";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { repairWithSuper } from "@/lib/score-run";

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
    const requested = resolveModel(typeof body.model === "string" ? body.model : undefined);
    const modelId = requested.id === DEFAULT_MODEL_ID ? requested.id : DEFAULT_MODEL_ID;
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    const beforeOverall = typeof body.beforeOverall === "number" ? body.beforeOverall : undefined;
    if (mode === "live" && requirements.trim() && transcript.trim()) {
      const limited = enforceLiveLimit(request, liveCallBudget("repair", mode, modelId));
      if (limited) return limited;
    }
    const input = {
      transcript,
      requirements,
      label: typeof body.label === "string" ? body.label : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      mode,
      modelId,
      beforeOverall,
    };
    if (body.stream === true) {
      return ndjsonResponse(async (send) => {
        const repair = await repairWithSuper(input, (step) => send({ type: "status", step }));
        send({ type: "result", repair });
      });
    }
    const repair = await repairWithSuper(input);
    return Response.json({ repair });
  } catch (error) {
    return errorResponse(error);
  }
}
