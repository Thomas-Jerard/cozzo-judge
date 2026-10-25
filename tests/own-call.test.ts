import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combineBrief, OWN_EXAMPLE, transcriptHint, validateOwnCall } from "../lib/own-call";

describe("own call", () => {
  it("joins the script and the facts into one brief", () => {
    assert.equal(
      combineBrief("  Be brief.  ", "  Cleaning is $189.  "),
      "Agent script:\nBe brief.\n\nBusiness facts:\nCleaning is $189.",
    );
    assert.equal(combineBrief("", "Hours: 8 to 5."), "Business facts:\nHours: 8 to 5.");
    assert.equal(combineBrief("   ", "  "), "");
  });

  it("asks for a transcript and at least one brief", () => {
    assert.match(validateOwnCall("", "Be brief.", "Hours: 8 to 5.") ?? "", /Paste the call/);
    assert.match(validateOwnCall("Agent: Hello.", "", "  ") ?? "", /script or the business facts/);
    assert.equal(validateOwnCall("Agent: Hello.\nCaller: Hi.", "", "Hours: 8 to 5."), null);
    assert.equal(validateOwnCall("Agent: Hello.", "Be brief.", ""), null);
  });

  it("rejects a call or a brief that is past the limit", () => {
    assert.match(validateOwnCall("A".repeat(80_001), "Be brief.", "") ?? "", /80,000/);
    assert.match(validateOwnCall("Agent: Hello.", "S".repeat(20_001), "") ?? "", /20,000/);
  });

  it("warns when a pasted call has no speaker labels", () => {
    assert.match(transcriptHint("Hello, I need a cleaning tomorrow.") ?? "", /No Agent:/);
    assert.equal(transcriptHint("Agent: Hello.\nCaller: Hi."), null);
  });

  it("loads an example the parser can read", () => {
    assert.equal(validateOwnCall(OWN_EXAMPLE.transcript, OWN_EXAMPLE.script, OWN_EXAMPLE.facts), null);
    assert.match(OWN_EXAMPLE.transcript, /Agent:/);
    assert.match(OWN_EXAMPLE.transcript, /Caller:/);
  });
});
