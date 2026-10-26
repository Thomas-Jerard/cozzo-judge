import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { MAX_AUDIO_SECONDS, SAMPLE_RATE, TranscribeError, durationProblem } from "./limits";

const MAX_PCM_BYTES = (MAX_AUDIO_SECONDS * SAMPLE_RATE + SAMPLE_RATE) * 4;

export interface DecodedAudio {
  samples: Float32Array;
  durationSeconds: number;
}

export async function decodeToPcm(bytes: Uint8Array, extension: string): Promise<DecodedAudio> {
  if (!ffmpegPath) {
    throw new TranscribeError("The audio decoder is not available on this server.", 500);
  }
  const dir = await mkdtemp(join(tmpdir(), "cozzo-audio-"));
  const input = join(dir, `call.${extension}`);
  try {
    await writeFile(input, bytes);
    const pcm = await runFfmpeg(ffmpegPath, [
      "-hide_banner",
      "-nostdin",
      "-i",
      input,
      "-ac",
      "1",
      "-ar",
      String(SAMPLE_RATE),
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "pipe:1",
    ]);
    const samples = new Float32Array(pcm.byteLength / 4);
    new Uint8Array(samples.buffer).set(pcm);
    const durationSeconds = samples.length / SAMPLE_RATE;
    const problem = durationProblem(durationSeconds);
    if (problem) throw new TranscribeError(problem);
    return { samples, durationSeconds };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(error);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PCM_BYTES) {
        fail(new TranscribeError("That recording is longer than 10 minutes. Trim it and try again."));
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", () => {
      fail(new TranscribeError("The audio decoder could not start.", 500));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new TranscribeError("That file could not be read as audio. Use an mp3, wav, m4a, webm, mp4, or ogg recording."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}
