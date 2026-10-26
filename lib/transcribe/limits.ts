export const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "webm", "mp4", "ogg"] as const;

/** Stay under Vercel's 4.5 MB function body limit, with room for the multipart wrapper. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export const MAX_AUDIO_SECONDS = 10 * 60;

export const SAMPLE_RATE = 16_000;

export class TranscribeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TranscribeError";
    this.status = status;
  }
}

export function audioExtension(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  const extension = match?.[1]?.toLowerCase();
  if (!extension || !AUDIO_EXTENSIONS.includes(extension as (typeof AUDIO_EXTENSIONS)[number])) return null;
  return extension;
}

export function audioFileProblem(name: string, size: number): string | null {
  if (!audioExtension(name)) return "Use an mp3, wav, m4a, webm, mp4, or ogg file.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > MAX_AUDIO_BYTES) {
    return "That file is over 4 MB. A Vercel function can only accept about 4.5 MB, so keep the recording under 4 MB and 10 minutes.";
  }
  return null;
}

export function durationProblem(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0.05) return "No audio was found in that file.";
  if (seconds > MAX_AUDIO_SECONDS) return "That recording is longer than 10 minutes. Trim it and try again.";
  return null;
}

export function isSilent(samples: Float32Array): boolean {
  if (samples.length === 0) return true;
  const step = Math.max(1, Math.floor(samples.length / 8000));
  let sum = 0;
  let count = 0;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index] ?? 0;
    sum += sample * sample;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count)) < 0.005;
}
