import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";
import { TranscribeError } from "./limits";
import { segmentsFromWhisper, type SpeechSegment } from "./turns";

/** English Whisper tiny. Nebius Token Factory does not host a speech model. */
export const WHISPER_MODEL_ID = "Xenova/whisper-tiny.en";

const WHISPER_TIMEOUT_MS = 90_000;

let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function loadTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  env.cacheDir = "/tmp/cozzo-whisper";
  env.allowLocalModels = false;
  // Threaded wasm workers fail in Node with a blob: path. One thread uses the plain wasm build.
  env.backends.onnx.wasm.numThreads = 1;
  transcriber ??= pipeline("automatic-speech-recognition", WHISPER_MODEL_ID) as Promise<AutomaticSpeechRecognitionPipeline>;
  return transcriber;
}

export async function transcribeSamples(samples: Float32Array): Promise<SpeechSegment[]> {
  const model = await withTimeout(loadTranscriber(), WHISPER_TIMEOUT_MS, "Loading the transcriber took too long. Try again in a moment.");
  const output = await withTimeout(
    // whisper-tiny.en is English-only. Forcing language/task tokens makes it return an empty transcript.
    model(samples, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    }),
    WHISPER_TIMEOUT_MS,
    "That recording took too long to transcribe. Try a shorter one.",
  );
  const single = Array.isArray(output) ? output[0] : output;
  const segments = segmentsFromWhisper(single ?? {});
  if (segments.length === 0) {
    throw new TranscribeError("No speech was found in that file.");
  }
  return segments;
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TranscribeError(message, 504)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
