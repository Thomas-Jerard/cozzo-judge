import { JudgeError } from "./rubric";
import { TranscribeError } from "./transcribe/limits";

export function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "The judge failed.";
  const status =
    error instanceof JudgeError || error instanceof TranscribeError
      ? error.status
      : /Unknown model|NEBIUS_API_KEY|mock mode/.test(message)
        ? 400
        : 502;
  return Response.json({ error: message }, { status });
}
