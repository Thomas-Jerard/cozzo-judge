import { access } from "node:fs/promises";
import { constants } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { completeWithNebius } from "@/lib/nebius";
import { liveDailyCap, liveIpHourlyCap } from "@/lib/rate-limit";
import { WHISPER_MODEL_ID } from "@/lib/transcribe/whisper";

const WASM_PATH = "node_modules/@xenova/transformers/dist/ort-wasm-simd.wasm";
const WEIGHTS_PATH = "/tmp/cozzo-whisper/Xenova/whisper-tiny.en/onnx/encoder_model_quantized.onnx";

export interface NebiusHealth {
  ok: boolean;
  status: "ok" | "unconfigured" | "down";
  model: string;
  latencyMs: number | null;
  detail?: string;
}

export interface TranscriptionHealth {
  ok: boolean;
  model: string;
  ffmpeg: boolean;
  runtime: boolean;
  weightsCached: boolean;
}

export function publicDetail(value: string): string {
  const secret = process.env.NEBIUS_API_KEY?.trim();
  let text = value.replace(/\s+/g, " ").trim();
  if (secret) text = text.replaceAll(secret, "[redacted]");
  text = text.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  text = text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  return text.slice(0, 180);
}

export async function checkNebius(): Promise<NebiusHealth> {
  const model = process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL_ID;
  if (!process.env.NEBIUS_API_KEY?.trim()) {
    return { ok: false, status: "unconfigured", model, latencyMs: null };
  }
  const started = Date.now();
  try {
    await completeWithNebius(model, [{ role: "user", content: "Reply with the single word ready." }], {
      maxTokens: 16,
      timeoutMs: 8_000,
      disableThinking: true,
    });
    return { ok: true, status: "ok", model, latencyMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model check failed.";
    return {
      ok: false,
      status: "down",
      model,
      latencyMs: Date.now() - started,
      detail: publicDetail(message),
    };
  }
}

export async function checkTranscription(): Promise<TranscriptionHealth> {
  const [ffmpeg, runtime, weightsCached] = await Promise.all([
    fileReady(ffmpegPath),
    fileReady(WASM_PATH),
    fileReady(WEIGHTS_PATH),
  ]);
  return {
    ok: ffmpeg && runtime,
    model: WHISPER_MODEL_ID,
    ffmpeg,
    runtime,
    weightsCached,
  };
}

export async function healthReport(): Promise<{
  ok: boolean;
  limits: { ipHourly: number; daily: number; routeMaxDurationSeconds: number };
  nebius: NebiusHealth;
  transcription: TranscriptionHealth;
}> {
  const [nebius, transcription] = await Promise.all([checkNebius(), checkTranscription()]);
  return {
    ok: nebius.ok && transcription.ok,
    limits: {
      ipHourly: liveIpHourlyCap(),
      daily: liveDailyCap(),
      routeMaxDurationSeconds: 120,
    },
    nebius,
    transcription,
  };
}

async function fileReady(path: string | null): Promise<boolean> {
  if (!path) return false;
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
