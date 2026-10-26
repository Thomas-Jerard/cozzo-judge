import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeToPcm } from "../lib/transcribe/audio";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  audioFileProblem,
  durationProblem,
  isSilent,
} from "../lib/transcribe/limits";
import { formatTranscript, labelLocally, parseSpeakerLabels, segmentsFromWhisper } from "../lib/transcribe/turns";

describe("audio upload limits", () => {
  it("accepts the call formats and refuses anything else or a file over 4 MB", () => {
    assert.equal(audioFileProblem("call.MP3", 1200), null);
    assert.equal(audioFileProblem("clip.m4a", 10), null);
    assert.equal(audioFileProblem("room.webm", 10), null);
    assert.match(audioFileProblem("notes.txt", 10) ?? "", /mp3, wav/);
    assert.match(audioFileProblem("call.mp3", 0) ?? "", /empty/);
    assert.match(audioFileProblem("call.wav", MAX_AUDIO_BYTES + 1) ?? "", /4 MB/);
    assert.equal(MAX_AUDIO_SECONDS, 600);
  });

  it("stops a recording past 10 minutes and an empty decode", () => {
    assert.equal(durationProblem(30), null);
    assert.match(durationProblem(601) ?? "", /10 minutes/);
    assert.match(durationProblem(0) ?? "", /No audio/);
  });

  it("treats near-zero samples as silence", () => {
    assert.equal(isSilent(new Float32Array(1600)), true);
    const loud = new Float32Array(1600);
    loud[10] = 0.2;
    assert.equal(isSilent(loud), false);
  });
});

describe("speaker lines", () => {
  it("reads whisper chunks and formats Agent and Caller lines", () => {
    const segments = segmentsFromWhisper({
      text: "ignored when chunks exist",
      chunks: [
        { text: " Thanks for calling. ", timestamp: [0, 1.2] },
        { text: "I need a tune-up.", timestamp: [2.4, 4] },
      ],
    });
    assert.equal(formatTranscript(labelLocally(segments)), "Agent: Thanks for calling.\nCaller: I need a tune-up.");
  });

  it("keeps the same speaker across a short pause and switches after a gap", () => {
    const turns = labelLocally([
      { text: "Hello.", start: 0, end: 0.4 },
      { text: "How can I help?", start: 0.6, end: 1.2 },
      { text: "Thursday, please.", start: 2.2, end: 3 },
    ]);
    assert.deepEqual(
      turns.map((turn) => turn.speaker),
      ["agent", "caller"],
    );
  });

  it("reads speaker JSON out of a reasoning block", () => {
    const raw = `<think>two people</think>
{"turns":[{"speaker":"agent","text":"Brightmolar, how can I help?"},{"speaker":"agent","text":"A cleaning is $189."},{"speaker":"caller","text":"Book me Thursday."}]}`;
    assert.equal(
      formatTranscript(parseSpeakerLabels(raw) ?? []),
      "Agent: Brightmolar, how can I help? A cleaning is $189.\nCaller: Book me Thursday.",
    );
    assert.equal(parseSpeakerLabels("no json here"), null);
  });
});

describe("ffmpeg decode", () => {
  it("decodes a one-second silent wav", async () => {
    const decoded = await decodeToPcm(wavSilence(1), "wav");
    assert.ok(decoded.durationSeconds > 0.9 && decoded.durationSeconds < 1.1);
    assert.equal(decoded.samples.length > 15000, true);
    assert.equal(isSilent(decoded.samples), true);
  });
});

function wavSilence(seconds: number, sampleRate = 16000): Uint8Array {
  const frames = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(frames * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return new Uint8Array(Buffer.concat([header, data]));
}
