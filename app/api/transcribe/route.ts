import { liveCallBudget } from "@/lib/bench";
import { errorResponse } from "@/lib/http";
import { ndjsonResponse } from "@/lib/ndjson";
import { resolveRequestMode } from "@/lib/nebius";
import { enforceLiveLimit } from "@/lib/rate-limit";
import { EXAMPLE_TRANSCRIPT, EXAMPLE_TRANSCRIPT_NOTE, limitMessage, shouldFallback } from "@/lib/saved-run";
import { WHISPER_MODEL_ID } from "@/lib/transcribe/whisper";
import { SPEAKER_MODEL_ID } from "@/lib/transcribe/label";
import { audioFileProblem } from "@/lib/transcribe/limits";
import { transcribeUpload } from "@/lib/transcribe/run";

export const maxDuration = 120;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the recording as a file." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an audio or video file." }, { status: 400 });
  }

  const filename = file.name || "call.wav";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = audioFileProblem(filename, bytes.byteLength);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  let mode: "live" | "mock";
  try {
    mode = resolveRequestMode(typeof form.get("mode") === "string" ? form.get("mode") : "auto");
  } catch (error) {
    return errorResponse(error);
  }

  let labelMode = mode;
  let limitNote: string | null = null;
  if (mode === "live") {
    const limited = enforceLiveLimit(request, liveCallBudget("transcribe", mode, SPEAKER_MODEL_ID));
    if (limited) {
      labelMode = "mock";
      limitNote = `${await limitMessage(limited)} Speaker labels are a guess from the pauses, and Nebius was not called. Edit the lines before you score.`;
    }
  }

  return ndjsonResponse(async (send) => {
    try {
      const result = await transcribeUpload(bytes, filename, labelMode, (step) => send({ type: "status", step }));
      send({
        type: "result",
        ...result,
        note: limitNote ?? result.note,
        saved: false,
        fallback: false,
      });
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      console.error("transcription fell back", error instanceof Error ? error.message : error);
      send({
        type: "result",
        transcript: EXAMPLE_TRANSCRIPT,
        note: EXAMPLE_TRANSCRIPT_NOTE,
        model: WHISPER_MODEL_ID,
        labeledBy: "guess",
        saved: true,
        fallback: true,
      });
    }
  });
}
