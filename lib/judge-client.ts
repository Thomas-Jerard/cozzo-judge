import type { Scorecard } from "@/lib/rubric";

export interface JudgeStatus {
  keyConfigured: boolean;
  defaultMode: "live" | "mock";
  defaultModel: string;
  models: { id: string; label: string; detail: string }[];
}

export type RequestMode = "auto" | "live" | "mock";

export class JudgeRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JudgeRequestError";
    this.status = status;
  }
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof JudgeRequestError && error.status === 429;
}

export async function readStatus(): Promise<JudgeStatus> {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not read whether a Nebius key is configured.");
  }
  return (await response.json()) as JudgeStatus;
}

export type StreamStep = "triage" | "score" | "quotes" | "propose" | "rescore";

export async function postStream<T extends { type: "result" }>(
  url: string,
  body: unknown,
  onStatus: (step: StreamStep) => void,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || !response.body) {
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new JudgeRequestError(data.error || "The judge failed.", response.status);
    }
    return data;
  }
  if (!response.ok) {
    throw new JudgeRequestError(`The judge failed (${response.status}).`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;
  const take = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { type?: string; step?: StreamStep; error?: string; status?: number };
    if (event.type === "status" && event.step) onStatus(event.step);
    if (event.type === "error") {
      throw new JudgeRequestError(event.error || "The judge failed.", event.status || 502);
    }
    if (event.type === "result") result = event as T;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) take(line);
  }
  if (buffer.trim()) take(buffer);
  if (!result) throw new JudgeRequestError("The judge closed the stream without a scorecard.", 502);
  return result;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new JudgeRequestError(data.error || "The judge failed.", response.status);
  }
  return data;
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatDuration(seconds?: number): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return minutes > 0 ? `${minutes}m ${remain}s` : `${remain}s`;
}

export function verdictLabel(verdict: Scorecard["verdict"]): string {
  if (verdict === "pass") return "Pass";
  if (verdict === "review") return "Needs review";
  return "Fail";
}

export function bandColor(score: number): string {
  if (score >= 85) return "var(--pass)";
  if (score >= 70) return "var(--review)";
  return "var(--fail)";
}
