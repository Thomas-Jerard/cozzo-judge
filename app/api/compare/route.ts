import { errorResponse } from "@/lib/http";
import { resolveModel } from "@/lib/models";
import { completeWithNebius, resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { judgeCall } from "@/lib/rubric";
import { findSampleFixture } from "@/lib/samples/fixtures";

export const maxDuration = 120;

interface CallBody {
  label?: unknown;
  transcript?: unknown;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const calls = Array.isArray(body.calls) ? (body.calls as CallBody[]) : [];
  if (calls.length !== 2) {
    return Response.json(
      { error: "Compare needs exactly two transcripts." },
      { status: 400 },
    );
  }

  try {
    const mode = resolveRequestMode(body.mode);
    const model = resolveModel(typeof body.model === "string" ? body.model : undefined);
    const requirements = typeof body.requirements === "string" ? body.requirements : "";
    const transcripts = calls.map((call) => (typeof call.transcript === "string" ? call.transcript : ""));
    if (mode === "live" && requirements.trim() && transcripts.every((transcript) => transcript.trim())) {
      const limited = enforceLiveLimit(request, transcripts.length);
      if (limited) return limited;
    }
    const scorecards = await Promise.all(
      calls.map((call) =>
        judgeCall(
          {
            transcript: typeof call.transcript === "string" ? call.transcript : "",
            requirements,
            label: typeof call.label === "string" ? call.label : undefined,
          },
          {
            mode,
            model: model.id,
            fixtures: findSampleFixture,
            complete:
              mode === "live"
                ? (messages) => completeWithNebius(model.id, messages)
                : undefined,
          },
        ),
      ),
    );
    return Response.json({ scorecards });
  } catch (error) {
    return errorResponse(error);
  }
}
