import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { resolveModel } from "@/lib/models";
import { ndjsonResponse } from "@/lib/ndjson";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { scoreWithBench } from "@/lib/score-run";
import {
  exampleScore,
  fallbackNotice,
  limitMessage,
  preparedScore,
  PROVIDER_NOTICE,
  shouldFallback,
  type SavedScore,
} from "@/lib/saved-run";

export const maxDuration = 120;

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
    const label = typeof body.label === "string" ? body.label : undefined;
    const stream = body.stream === true;
    const prepared = await preparedScore(transcript, requirements, label);
    if (prepared) return deliver(stream, prepared);

    const mode = resolveRequestMode(body.mode);
    const model = resolveModel(typeof body.model === "string" ? body.model : undefined);
    const input = { transcript, requirements, label };

    if (mode === "live" && chargeable(requirements, [transcript])) {
      const limited = enforceLiveLimit(request, liveCallBudget("score", mode, model.id));
      if (limited) {
        const saved = await exampleScore(fallbackNotice(await limitMessage(limited), "score"));
        return deliver(stream, saved);
      }
    }

    if (stream) {
      return ndjsonResponse(async (send) => {
        try {
          const result = await scoreWithBench(input, {
            mode,
            modelId: model.id,
            onStatus: (step) => send({ type: "status", step }),
          });
          send({ type: "result", scorecard: result.scorecard, bench: result.bench, saved: false, fallback: false, notice: null });
        } catch (error) {
          if (!shouldFallback(error)) throw error;
          console.error("live score fell back", error instanceof Error ? error.message : error);
          const saved = await exampleScore(PROVIDER_NOTICE);
          send({ type: "result", ...saved });
        }
      });
    }

    const result = await scoreWithBench(input, { mode, modelId: model.id });
    return Response.json({ scorecard: result.scorecard, bench: result.bench, saved: false, fallback: false, notice: null });
  } catch (error) {
    if (shouldFallback(error)) {
      console.error("live score fell back", error instanceof Error ? error.message : error);
      return Response.json(await exampleScore(PROVIDER_NOTICE));
    }
    return errorResponse(error);
  }
}

function deliver(stream: boolean, saved: SavedScore): Response {
  if (!stream) return Response.json(saved);
  return ndjsonResponse(async (send) => {
    send({ type: "status", step: "score" });
    send({ type: "result", ...saved });
  });
}

function chargeable(requirements: string, transcripts: string[]): boolean {
  return requirements.trim().length > 0 && transcripts.every((transcript) => transcript.trim().length > 0);
}
