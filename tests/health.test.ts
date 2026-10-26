import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { checkTranscription, publicDetail } from "../lib/health";

const original = process.env.NEBIUS_API_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.NEBIUS_API_KEY;
  else process.env.NEBIUS_API_KEY = original;
});

describe("health details", () => {
  it("strips a key and a bearer token from a provider message", () => {
    process.env.NEBIUS_API_KEY = "sk-test-secret-value";
    const detail = publicDetail("rejected Bearer sk-test-secret-value for sk-test-secret-value");
    assert.equal(detail.includes("sk-test-secret-value"), false);
    assert.match(detail, /\[redacted\]/);
  });

  it("checks ffmpeg and the whisper runtime without calling Nebius", async () => {
    const transcription = await checkTranscription();
    assert.equal(transcription.model, "Xenova/whisper-tiny.en");
    assert.equal(transcription.ffmpeg, true);
    assert.equal(transcription.runtime, true);
    assert.equal(transcription.ok, true);
    assert.equal(JSON.stringify(transcription).includes("NEBIUS"), false);
  });
});
