import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIMENSIONS, PASS_AT } from "../lib/rubric/dimensions";
import { judgeCall } from "../lib/rubric/judge";
import { fingerprint, normalizeTranscript } from "../lib/rubric/normalize";
import { extractJsonObject, parseJudgment, quoteAppears } from "../lib/rubric/parse";
import { weightedOverall } from "../lib/rubric/verdict";
import { dentalHarbor, dentalNorthline, dentalRequirements } from "../lib/samples/dental";
import { findSampleFixture } from "../lib/samples/fixtures";
import { renderAudioJson, renderPlain } from "../lib/samples/format";
import { hvacHarbor, hvacNorthline, hvacRequirements } from "../lib/samples/hvac";
import { medspaHarbor, medspaNorthline, medspaRequirements } from "../lib/samples/medspa";
import { SCENARIOS } from "../lib/samples";
import { DEFAULT_MODEL_ID, NEMOTRON_MODELS, TOKEN_FACTORY_BASE_URL } from "../lib/models";

describe("rubric weights", () => {
  it("sums to 100 percent", () => {
    const total = DIMENSIONS.reduce((sum, dimension) => sum + dimension.weightPercent, 0);
    assert.equal(total, 100);
  });
});

describe("transcript normalization", () => {
  it("treats plain text and audio JSON as the same call", () => {
    const plain = renderPlain(dentalNorthline);
    const json = renderAudioJson({
      business: "Brightmolar Family Dental",
      provider: "Northline Voice",
      turns: dentalNorthline,
    });
    const fromPlain = normalizeTranscript(plain);
    const fromJson = normalizeTranscript(json);
    assert.equal(fromPlain.format, "plain");
    assert.equal(fromJson.format, "json");
    assert.equal(fingerprint(fromPlain.plainText), fingerprint(fromJson.plainText));
    assert.ok((fromJson.durationSeconds ?? 0) > 10);
    assert.equal(fromJson.turns.filter((turn) => turn.speaker === "agent").length, 5);
  });

  it("reads role-based message arrays", () => {
    const call = normalizeTranscript(
      JSON.stringify({
        messages: [
          { role: "assistant", content: "Thanks for calling Northwind Comfort today." },
          { role: "user", content: "The air conditioner died overnight." },
        ],
      }),
    );
    assert.equal(call.turns[0]?.speaker, "agent");
    assert.equal(call.turns[1]?.speaker, "caller");
    assert.match(call.plainText, /^Agent: Thanks/);
  });
});

describe("token factory models", () => {
  it("uses the verified host and ids, with super-120b as the default", () => {
    assert.equal(TOKEN_FACTORY_BASE_URL, "https://api.tokenfactory.nebius.com/v1");
    assert.equal(DEFAULT_MODEL_ID, "nvidia/nemotron-3-super-120b-a12b");
    assert.deepEqual(
      NEMOTRON_MODELS.map((model) => model.id),
      [
        "nvidia/nemotron-3-super-120b-a12b",
        "nvidia/Nemotron-3-Ultra-550b-a55b",
        "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        "nvidia/Nemotron-3_5-Lightning",
        "nvidia/Nemotron-3.5-Super-VL",
      ],
    );
  });
});

describe("model output parsing", () => {
  it("ignores think tags and markdown fences", () => {
    const parsed = extractJsonObject(
      `<think>checking the price</think>\n\`\`\`json\n{"summary":"ok","dimensions":[]}\n\`\`\``,
    ) as { summary: string };
    assert.equal(parsed.summary, "ok");
  });

  it("prefers the scorecard after a reasoning block and a draft object", () => {
    const parsed = extractJsonObject(
      `<reasoning>draft {"summary":"wrong"}</reasoning>\n` +
        "Score follows.\n```json\n" +
        '{"summary":"ok","dimensions":[]}\n' +
        "```\n",
    ) as { summary: string };
    assert.equal(parsed.summary, "ok");
  });

  it("reads a JSON object that was only inside a think tag", () => {
    const parsed = extractJsonObject(`<think>{"risk":"high","headline":"Invented a price."}</think>`) as {
      risk: string;
    };
    assert.equal(parsed.risk, "high");
  });

  it("reads JSON that follows an unclosed think tag", () => {
    const parsed = extractJsonObject(`<think>still scoring\n{"summary":"ok","dimensions":[]}`) as {
      summary: string;
    };
    assert.equal(parsed.summary, "ok");
  });

  it("rejects a quote that is not in the call", () => {
    assert.equal(quoteAppears("a price we never said", "Agent: The cleaning is $189."), false);
    assert.equal(quoteAppears("The cleaning is $189.", "Agent: The cleaning is $189."), true);
  });

  it("matches dashes, smart quotes, and collapsed whitespace", () => {
    const transcript = "Agent: The new-patient exam is $89. We don't take Medicaid.";
    assert.equal(quoteAppears("The new\u2011patient exam is $89.", transcript), true);
    assert.equal(quoteAppears("The new\u2013patient exam is $89.", transcript), true);
    assert.equal(quoteAppears("The new\uFF0Dpatient exam is $89.", transcript), true);
    assert.equal(quoteAppears("We don\u2019t take Medicaid.", transcript), true);
    assert.equal(quoteAppears("The  new-patient\nexam  is $89.", transcript), true);
    assert.equal(
      quoteAppears("said \u201Chello there\u201D", 'Agent: said "hello there" on the call.'),
      true,
    );
    assert.equal(quoteAppears("The new-patient exam is $189.", transcript), false);
  });

  it("keeps a non-breaking hyphen in the quote and still marks it verified", () => {
    const quote = "The new\u2011patient exam is $89.";
    const parsed = parseJudgment(
      JSON.stringify({
        summary: "Quoted the fee.",
        dimensions: [
          {
            id: "factual_accuracy",
            score: 90,
            rationale: "The fee matches the script.",
            evidence: [{ quote, note: "Fee line." }],
          },
        ],
        criticalFlags: [],
      }),
      {
        turns: [],
        plainText: "Agent: The new-patient exam is $89.",
        format: "plain",
        warnings: [],
      },
    );
    const evidence = parsed.dimensions.find((dimension) => dimension.id === "factual_accuracy")?.evidence ?? [];
    assert.equal(evidence[0]?.quote, quote);
    assert.equal(evidence[0]?.verified, true);
  });
});

describe("synthetic samples", () => {
  it("scores every calibrated sample and keeps quotes verbatim", async () => {
    const cases = [
      [dentalRequirements, dentalNorthline, true],
      [dentalRequirements, dentalHarbor, false],
      [hvacRequirements, hvacNorthline, true],
      [hvacRequirements, hvacHarbor, false],
      [medspaRequirements, medspaNorthline, true],
      [medspaRequirements, medspaHarbor, false],
    ] as const;

    for (const [requirements, turns, shouldPass] of cases) {
      const transcript = renderPlain(turns);
      const card = await judgeCall(
        { transcript, requirements, label: "sample" },
        { mode: "mock", model: "cozzo-rubric-mock", fixtures: findSampleFixture },
      );
      assert.equal(card.judge.mode, "mock");
      assert.equal(card.judge.provider, "mock");
      assert.equal(card.dimensions.length, 5);
      assert.equal(
        card.overall,
        weightedOverall(card.dimensions.map((dimension) => ({ id: dimension.id, score: dimension.score }))),
      );
      if (shouldPass) {
        assert.equal(card.verdict, "pass");
        assert.equal(card.criticalFlags.length, 0);
        assert.ok(card.overall >= PASS_AT);
      } else {
        assert.equal(card.verdict, "fail");
        assert.ok(card.criticalFlags.some((flag) => flag.severity === "critical"));
      }
      for (const dimension of card.dimensions) {
        assert.ok(dimension.evidence.length > 0, dimension.id);
        for (const item of dimension.evidence) {
          assert.equal(item.verified, true, item.quote);
        }
      }
    }
  });

  it("puts the stronger synthetic agent ahead in every industry", async () => {
    for (const scenario of SCENARIOS) {
      const [better, worse] = scenario.providers;
      const [good, bad] = await Promise.all([
        judgeCall(
          { transcript: better.plain, requirements: scenario.requirements },
          { mode: "mock", model: "mock", fixtures: findSampleFixture },
        ),
        judgeCall(
          { transcript: worse.plain, requirements: scenario.requirements },
          { mode: "mock", model: "mock", fixtures: findSampleFixture },
        ),
      ]);
      assert.ok(good.overall > bad.overall + 20, scenario.id);
    }
  });

  it("still separates the dental calls when no fixture is used", async () => {
    const good = await judgeCall(
      { transcript: renderPlain(dentalNorthline), requirements: dentalRequirements },
      { mode: "mock", model: "mock" },
    );
    const bad = await judgeCall(
      { transcript: renderPlain(dentalHarbor), requirements: dentalRequirements },
      { mode: "mock", model: "mock" },
    );
    assert.equal(good.verdict, "pass");
    assert.equal(bad.verdict, "fail");
    assert.ok(bad.criticalFlags.some((flag) => flag.code === "invented_price"));
    assert.ok(good.dimensions.find((dimension) => dimension.id === "hallucination")!.score > 70);
    assert.ok(bad.dimensions.find((dimension) => dimension.id === "hallucination")!.score < 40);
  });
});

describe("live scorecard assembly", () => {
  it("fails a high score when the model raises a critical flag", async () => {
    const transcript = renderPlain(dentalNorthline);
    const card = await judgeCall(
      { transcript, requirements: dentalRequirements },
      {
        mode: "live",
        model: "nvidia/nemotron-3-super-120b-a12b",
        complete: async () => ({
          content: JSON.stringify({
            summary: "Looks polished, but a required handoff was missed.",
            dimensions: DIMENSIONS.map((dimension) => ({
              id: dimension.id,
              score: 92,
              rationale: "Strong on the surface.",
              evidence: [{ quote: dentalNorthline[2]?.text, note: "A real line." }],
            })),
            criticalFlags: [
              { code: "missed_emergency", severity: "critical", message: "Safety handoff missed." },
            ],
          }),
          usage: { promptTokens: 120, completionTokens: 80 },
        }),
      },
    );
    assert.equal(card.verdict, "fail");
    assert.equal(card.verdictOverridden, true);
    assert.equal(card.judge.provider, "nebius-token-factory");
    assert.equal(card.judge.promptTokens, 120);
    assert.ok(card.overall >= PASS_AT);
  });

  it("retries once when the first live response is not JSON", async () => {
    let calls = 0;
    const card = await judgeCall(
      { transcript: renderPlain(dentalNorthline), requirements: dentalRequirements },
      {
        mode: "live",
        model: DEFAULT_MODEL_ID,
        complete: async () => {
          calls += 1;
          if (calls === 1) return "<think>no scorecard yet</think> not json";
          return scorecardJson();
        },
      },
    );
    assert.equal(calls, 2);
    assert.equal(card.verdict, "fail");
    assert.equal(card.judge.model, DEFAULT_MODEL_ID);
  });

  it("does not retry a Token Factory error", async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        judgeCall(
          { transcript: renderPlain(dentalNorthline), requirements: dentalRequirements },
          {
            mode: "live",
            model: DEFAULT_MODEL_ID,
            complete: async () => {
              calls += 1;
              throw new Error("Nebius Token Factory returned 500.");
            },
          },
        ),
      /returned 500/,
    );
    assert.equal(calls, 1);
  });
});

function scorecardJson() {
  return {
    content: JSON.stringify({
      summary: "Looks polished, but a required handoff was missed.",
      dimensions: DIMENSIONS.map((dimension) => ({
        id: dimension.id,
        score: 92,
        rationale: "Strong on the surface.",
        evidence: [{ quote: dentalNorthline[2]?.text, note: "A real line." }],
      })),
      criticalFlags: [{ code: "missed_emergency", severity: "critical", message: "Safety handoff missed." }],
    }),
    usage: { promptTokens: 120, completionTokens: 80 },
  };
}
