import { errorResponse } from "./http";

export function ndjsonResponse(work: (send: (event: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await work(send);
      } catch (error) {
        const response = errorResponse(error);
        const payload = (await response.json()) as { error?: string };
        send({
          type: "error",
          error: payload.error ?? "The judge failed.",
          status: response.status,
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
