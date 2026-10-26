import { decodeToPcm } from "./audio";
import { labelWithNemotron } from "./label";
import { audioExtension, audioFileProblem, isSilent, TranscribeError } from "./limits";
import { formatTranscript, labelLocally, type LabeledTurn } from "./turns";
import { transcribeSamples, WHISPER_MODEL_ID } from "./whisper";

export interface TranscriptDraft {
  transcript: string;
  note: string;
  model: string;
  labeledBy: "nemotron" | "guess";
}

export async function transcribeUpload(
  bytes: Uint8Array,
  filename: string,
  mode: "live" | "mock",
  onStatus?: (step: "read" | "transcribe" | "label") => void,
  beforeModel?: () => Promise<void>,
): Promise<TranscriptDraft> {
  const problem = audioFileProblem(filename, bytes.byteLength);
  if (problem) throw new TranscribeError(problem);
  const extension = audioExtension(filename);
  if (!extension) throw new TranscribeError("Use an mp3, wav, m4a, webm, mp4, or ogg file.");

  onStatus?.("read");
  const decoded = await decodeToPcm(bytes, extension);
  if (isSilent(decoded.samples)) {
    throw new TranscribeError("No speech was found in that file.");
  }

  await beforeModel?.();
  onStatus?.("transcribe");
  const segments = await transcribeSamples(decoded.samples);

  let turns: LabeledTurn[] = labelLocally(segments);
  let labeledBy: TranscriptDraft["labeledBy"] = "guess";
  if (mode === "live") {
    onStatus?.("label");
    const labeled = await labelWithNemotron(segments);
    if (labeled && labeled.length > 0) {
      turns = labeled;
      labeledBy = "nemotron";
    }
  }

  const transcript = formatTranscript(turns);
  if (!transcript) throw new TranscribeError("No speech was found in that file.");
  return {
    transcript,
    note: noteFor(mode, labeledBy),
    model: WHISPER_MODEL_ID,
    labeledBy,
  };
}

function noteFor(mode: "live" | "mock", labeledBy: TranscriptDraft["labeledBy"]): string {
  if (mode === "mock") {
    return "Practice run. Whisper wrote the words on this server. Speaker labels are a guess from the pauses. Edit them before you score. Nebius was not called.";
  }
  if (labeledBy === "nemotron") {
    return "Whisper tiny wrote the words. Nemotron Nano labeled Agent and Caller. Edit anything that looks wrong before you score.";
  }
  return "Whisper tiny wrote the words. Speaker labels are a guess because the labeling pass did not come back. Edit them before you score.";
}
