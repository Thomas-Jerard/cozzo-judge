import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JudgeError } from "../lib/rubric";
import { dentalHarbor, dentalRequirements } from "../lib/samples/dental";
import { renderAudioJson, renderPlain } from "../lib/samples/format";
import { SCENARIOS } from "../lib/samples";
import {
  examplePair,
  exampleScore,
  isSavedSample,
  preparedScore,
  PROVIDER_NOTICE,
  savedAppeal,
  savedPair,
  savedRepair,
  SAVED_MODEL,
  shouldFallback,
} from "../lib/saved-run";

describe("saved sample runs", () => {
  it("serves Harbor instantly and labels it as a saved run", async () => {
    const saved = await preparedScore(renderPlain(dentalHarbor), dentalRequirements, "Brightmolar Family Dental · Harbor Voice");
    assert.ok(saved);
    assert.equal(saved.saved, true);
    assert.equal(saved.fallback, false);
    assert.equal(saved.scorecard.verdict, "fail");
    assert.equal(saved.scorecard.judge.model, SAVED_MODEL);
    assert.match(saved.notice, /Saved run/);
    assert.match(saved.scorecard.judge.note, /did not use a rate-limit slot/);
    assert.equal(saved.bench.score.latencyMs, 0);
  });

  it("recognizes the audio JSON for every sample", () => {
    for (const scenario of SCENARIOS) {
      for (const provider of scenario.providers) {
        assert.equal(isSavedSample(provider.plain), true);
        assert.equal(isSavedSample(provider.audioJson), true);
      }
    }
    assert.equal(isSavedSample("Agent: Hello.\nCaller: This is not a sample."), false);
  });

  it("keeps the saved Harbor example distinct from a call that failed live", async () => {
    const saved = await exampleScore(PROVIDER_NOTICE);
    assert.equal(saved.fallback, true);
    assert.equal(saved.scorecard.call.label, "Saved example · Harbor Voice");
    assert.equal(saved.scorecard.verdict, "fail");
    assert.match(saved.notice, /not a score of the call you sent/);
  });

  it("serves both sides of a sample pair without a live call", async () => {
    const dental = SCENARIOS[0];
    const pair = await savedPair(
      [
        { transcript: dental.providers[0].plain, label: dental.providers[0].name },
        { transcript: dental.providers[1].plain, label: dental.providers[1].name },
      ],
      dental.requirements,
    );
    assert.ok(pair);
    assert.equal(pair.scorecards[0].verdict, "pass");
    assert.equal(pair.scorecards[1].verdict, "fail");
    const fallback = await examplePair("Live compare didn't finish.");
    assert.equal(fallback.fallback, true);
    assert.match(fallback.scorecards[0].call.label ?? "", /Northline/);
    assert.match(fallback.scorecards[1].call.label ?? "", /Harbor/);
  });

  it("prepares a Harbor rewrite that scores higher than the saved call", async () => {
    const original = await preparedScore(renderPlain(dentalHarbor), dentalRequirements, "Harbor Voice");
    const repaired = await savedRepair({
      transcript: renderPlain(dentalHarbor),
      requirements: dentalRequirements,
      label: "Harbor Voice",
      beforeOverall: original?.scorecard.overall,
      notice: "Saved run.",
      fallback: false,
    });
    assert.ok(original);
    assert.equal(repaired.saved, true);
    assert.equal(repaired.repair.scorecard.judge.model, SAVED_MODEL);
    assert.ok(repaired.repair.scorecard.overall > original.scorecard.overall);
    const appeal = savedAppeal(original.scorecard, "Saved run.");
    assert.equal(appeal.appeal.model, SAVED_MODEL);
    assert.equal(appeal.appeal.agrees, true);
  });

  it("falls back from a provider failure and keeps a validation error", () => {
    assert.equal(shouldFallback(new Error("Nebius Token Factory timed out after 55 seconds.")), true);
    assert.equal(shouldFallback(new Error("Nebius Token Factory returned 402. insufficient_quota")), true);
    assert.equal(shouldFallback(new JudgeError("Paste or upload a transcript before scoring.", 400)), false);
    assert.equal(shouldFallback(new Error("NEBIUS_API_KEY is not set.")), false);
  });

  it("recognizes the Harbor audio JSON as the same saved call", async () => {
    const json = renderAudioJson({
      business: "Brightmolar Family Dental",
      provider: "Harbor Voice",
      turns: dentalHarbor,
    });
    const saved = await preparedScore(json, dentalRequirements, "Harbor Voice");
    assert.ok(saved);
    assert.equal(saved.scorecard.verdict, "fail");
  });
});
