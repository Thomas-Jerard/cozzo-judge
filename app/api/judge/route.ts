import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { resolveModel } from "@/lib/models";
import { ndjsonResponse } from "@/lib/ndjson";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { scoreWithBench } from "@/lib/score-run";

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
    const model = resolveModel(typeof body.model === "string" ? body.model : undefined);
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    const input = {
      transcript,
      requirements,
      label: typeof body.label === "string" ? body.label : undefined,
    };
    if (mode === "live" && chargeable(requirements, [transcript])) {
      const limited = enforceLiveLimit(request, liveCallBudget("score", mode, model.id));
      if (limited) return limited;
    }

    if (body.stream === true) {
      return ndjsonResponse(async (send) => {
        const result = await scoreWithBench(input, {
          mode,
          modelId: model.id,
          onStatus: (step) => send({ type: "status", step }),
        });
        send({ type: "result", scorecard: result.scorecard, bench: result.bench });
      });
    }

    const result = await scoreWithBench(input, { mode, modelId: model.id });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

function chargeable(requirements: string, transcripts: string[]): boolean {
  return requirements.trim().length > 0 && transcripts.every((transcript) => transcript.trim().length > 0);
}
