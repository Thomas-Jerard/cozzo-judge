import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agreementFor,
  applyAgentLines,
  liveCallBudget,
  localTriage,
  mockRepair,
  parseRepair,
  parseTriage,
} from "../lib/bench";
import { DEFAULT_MODEL_ID, NANO_MODEL_ID, ULTRA_MODEL_ID } from "../lib/models";
import { judgeCall } from "../lib/rubric";
import { dentalHarbor, dentalNorthline, dentalRequirements } from "../lib/samples/dental";
import { findSampleFixture } from "../lib/samples/fixtures";
import { renderPlain } from "../lib/samples/format";
import { decodeCardHash, encodeCardLink } from "../lib/share";
import type { Scorecard } from "../lib/rubric";

describe("bench budget and agreement", () => {
  it("charges Nano plus Super only for a default live score", () => {
    assert.equal(liveCallBudget("score", "live", DEFAULT_MODEL_ID), 2);
    assert.equal(liveCallBudget("score", "live", ULTRA_MODEL_ID), 1);
    assert.equal(liveCallBudget("score", "live", NANO_MODEL_ID), 1);
    assert.equal(liveCallBudget("score", "mock", DEFAULT_MODEL_ID), 0);
    assert.equal(liveCallBudget("appeal", "live", DEFAULT_MODEL_ID), 1);
    assert.equal(liveCallBudget("repair", "live", DEFAULT_MODEL_ID), 2);
    assert.equal(liveCallBudget("repair", "mock", DEFAULT_MODEL_ID), 0);
    assert.equal(liveCallBudget("transcribe", "live", NANO_MODEL_ID), 2);
    assert.equal(liveCallBudget("transcribe", "mock", DEFAULT_MODEL_ID), 0);
  });

  it("treats a high-risk pass and a low-risk fail as a split", () => {
    assert.equal(agreementFor("high", "pass"), "split");
    assert.equal(agreementFor("low", "fail"), "split");
    assert.equal(agreementFor("high", "fail"), "aligned");
    assert.equal(agreementFor("low", "pass"), "aligned");
    assert.equal(agreementFor("high", "review"), "aligned");
    assert.equal(agreementFor("low", "review"), "aligned");
  });
});

describe("triage parsing", () => {
  it("reads a risk line out of a reasoning block", () => {
    const parsed = parseTriage(
      `<think>The $49 line is not in the script.</think>\n\`\`\`json\n{"risk":"high","headline":"The agent invented a price."}\n\`\`\``,
    );
    assert.equal(parsed.risk, "high");
    assert.match(parsed.headline, /invented a price/i);
  });

  it("flags the Harbor sample and not the Northline sample", () => {
    const harbor = localTriage(renderPlain(dentalHarbor), dentalRequirements);
    const northline = localTriage(renderPlain(dentalNorthline), dentalRequirements);
    assert.equal(harbor.risk, "high");
    assert.equal(northline.risk, "low");
  });
});

describe("prompt repair", () => {
  it("keeps caller lines and drops the invented agent lines", () => {
    const original = renderPlain(dentalHarbor);
    const draft = mockRepair(original, dentalRequirements);
    const revised = applyAgentLines(original, draft.agentLines);
    assert.match(revised, /I need a cleaning/);
    assert.match(revised, /Do you take Medicaid\? Can I see Dr\. Nguyen this afternoon\?/);
    assert.match(revised, /Elena Vasquez\./);
    assert.doesNotMatch(revised, /\$49/);
    assert.match(revised, /I have you down/);
    assert.match(revised, /\$189/);
  });

  it("reads a rewrite from a fence, a reasoning channel, and trailing text", () => {
    const draft = parseRepair(
      `<think>The $49 price is invented.</think>\n\`\`\`json\n{"prompt":"Stay on script.","changes":["Drop the invented price."],"agentLines":["The exam is $189."]}\n\`\`\`\nThat should do it.`,
      1,
    );
    assert.equal(draft.prompt, "Stay on script.");
    assert.deepEqual(draft.agentLines, ["The exam is $189."]);
  });

  it("closes a rewrite the model cut off, and ignores a scorecard in the same text", () => {
    const draft = parseRepair(
      '{"summary":"ok","dimensions":[]}\n{"prompt":"Stay on script.","changes":["Drop the invented price.",],"agentLines":["The exam is $189."',
      1,
    );
    assert.equal(draft.agentLines[0], "The exam is $189.");
    assert.equal(draft.changes[0], "Drop the invented price.");
  });

  it("accepts agent_lines and line objects", () => {
    const draft = parseRepair(
      '{"prompt":"Stay on script.","changes":"Drop the price.","agent_lines":[{"line":"Agent: The exam is $189."}]}',
      1,
    );
    assert.equal(draft.agentLines[0], "The exam is $189.");
    assert.equal(draft.changes[0], "Drop the price.");
  });

  it("fits a short rewrite to the caller count", () => {
    const draft = parseRepair(
      '{"prompt":"Stay on script.","changes":["Drop the invented price."],"agentLines":["The exam is $189."]}',
      2,
    );
    assert.equal(draft.agentLines.length, 2);
    assert.equal(draft.agentLines[0], "The exam is $189.");
    assert.equal(draft.agentLines[1], "The exam is $189.");
  });

  it("scores the rewritten Harbor call higher than the original", async () => {
    const original = renderPlain(dentalHarbor);
    const before = await judgeCall(
      { transcript: original, requirements: dentalRequirements },
      { mode: "mock", model: DEFAULT_MODEL_ID, fixtures: findSampleFixture },
    );
    const revised = applyAgentLines(original, mockRepair(original, dentalRequirements).agentLines);
    const after = await judgeCall(
      { transcript: revised, requirements: dentalRequirements, label: "revised" },
      { mode: "mock", model: DEFAULT_MODEL_ID, fixtures: findSampleFixture },
    );
    assert.ok(after.overall > before.overall, `${after.overall} should beat ${before.overall}`);
    assert.equal(before.verdict, "fail");
  });
});

describe("share link", () => {
  it("round-trips a scorecard through the hash", async () => {
    const scorecard = {
      overall: 42,
      verdict: "fail",
      summary: "Invented a price.",
      call: { label: "Harbor" },
      judge: { mode: "mock", model: "cozzo-rubric-mock" },
      dimensions: [],
      criticalFlags: [],
    } as unknown as Scorecard;
    const path = await encodeCardLink({
      v: 1,
      scorecard,
      bench: { score: { model: DEFAULT_MODEL_ID, latencyMs: 1200 }, agreement: "aligned" },
    });
    assert.ok(path?.startsWith("/card#"));
    const decoded = await decodeCardHash(path!.slice("/card#".length));
    assert.equal(decoded.scorecard.overall, 42);
    assert.equal(decoded.bench?.agreement, "aligned");
    assert.equal(decoded.scorecard.summary, "Invented a price.");
  });
});
