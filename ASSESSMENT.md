# Cozzo Judge — hackathon assessment

Date: 25 October 2026. Track: Best Apps and Agents, Nebius x NVIDIA Global AI Hackathon.

Rules read from https://nebiusglobalaihackathon.devpost.com/rules. Stage One is pass/fail: a real attempt at the track, running on Nebius Token Factory, using at least one NVIDIA open model. Stage Two scores four criteria with equal weight. Ties break in the order listed below.

This file scores the app **before** the changes in the same commit, then says what this pass is shipping. Scores are out of 10. They are not the judges' scores.

## Stage One

Pass. The live path calls `POST /v1/chat/completions` on `https://api.tokenfactory.nebius.com/v1` with NVIDIA Nemotron ids. The key stays on the server. Mock mode is labeled as mock. The product is a voice-agent evaluator, which is an app someone buying an agent would actually open.

## Stage Two

| Criterion | Score | What a judge can already see | What is weak |
| --- | ---: | --- | --- |
| Technological Implementation | 6.5 | Token Factory client, five catalog model ids, JSON retry, 55s timeout, quote checks, per-IP and daily caps. Rubric is a plain module with no UI imports. | Every live score is one completion, usually Super. Nano, Ultra, Lightning, and Super VL are a dropdown, not a job each. No agent loop. The cap is in-memory per instance, so it is not a hard global lock. |
| Design | 7 | Score, compare, and a three-scenario pack. Synthetic calls are labeled. Empty, error, and rate-limit states exist. Mock is an explicit fallback. | A live score sits on a spinner for the whole request. The result is not a link you can hand someone. The home page states the problem, then does not show how the models divide the work. |
| Potential Impact | 7 | The audience is a person choosing a voice agent. The failure mode is specific: invented price, missed 911, booked the dentist who is out. Three industries, evidence quotes, critical-flag fail. | The product stops at the grade. The buyer still has to invent the prompt fix. Nothing shows the score moving after a change. |
| Quality of the Idea | 6 | Evidence has to appear in the transcript. Weights are fixed and documented. Compare uses the same tie band Cozzo uses for latency. That is domain knowledge, not a generic rubric pasted into a chat box. | "Ask an LLM to grade a transcript" is an obvious shape. The track text asks for Nano or Super on the fast path and Ultra when the reasoning is hard. A dropdown does not make that case. |

Equal weights put the pre-change app at about **6.6 / 10**. That should clear Stage One. It is not yet a finalist shape: the track is Apps **and Agents**, and the model guidance is part of the brief.

## Ranked changes

Impact is how much it moves a Stage Two score. Risk is whether it can break the live demo at cozzo-judge.vercel.app before the 30 October deadline.

| Rank | Change | Criteria it moves | Risk | This pass |
| --- | --- | --- | --- | --- |
| 1 | Default live score runs Nano for a fast risk line, then Super for the rubric. Show both latencies. If they disagree (high risk but a pass, or low risk but a fail), say so. | Implementation, Idea | Medium. Extra call and a few seconds. Super remains the only writer of the score. Nano failure must not fail the score. Pack and compare stay Super-only so a 6-call pack still fits the hourly cap. | Ship |
| 2 | Ultra is an appeal, not a rescore. One button on a scorecard, and one on a comparison. The rubric number does not change. | Implementation, Idea | Low. One extra call, only when asked. | Ship |
| 3 | Fix step: Super proposes a revised agent prompt and replacement agent lines. Caller lines stay put. Super scores the revised call. Show before and after. | Impact, Idea, Design | Medium. Two calls. Must be labeled as a rewritten transcript, not a new phone call. Mock path has to work with no key. | Ship |
| 4 | Progress events (NDJSON) so the wait shows Nano, then Super, then the quote check. | Design | Low. The old JSON response stays for clients that do not stream. | Ship |
| 5 | Home page states the buyer, the failure, and the three-model bench in the first screen. | Design, Impact | Low. | Ship |
| 6 | Copy a markdown report and open a `/card#…` link. No database. | Design | Low. Very long cards can make a long URL. | Ship |
| 7 | README diagram of who calls which model. Demo script uses the new buttons. | All, because judges may not click past the video | Low. | Ship |
| 8 | Run Super twice and show agreement. | Implementation | High cost. Doubles a score and can blow the hourly cap during a demo. The Nano/Super split above is the consistency check that does not add a third full grade. | Defer |
| 9 | Autonomous red-team that invents new caller attacks. | Idea | High. More calls, easy to look unfocused next to the fix loop, and easy to break the demo. | Defer |
| 10 | Shared KV for the rate cap, or Nebius Serverless Jobs. | Implementation | High for this week. The rules encourage Serverless and do not require it. The in-memory limit is already documented. | Defer |
| 11 | Change rubric weights or the critical-flag override. | — | No evidence the weights are wrong. A critical miss should still fail a polite call. | Do not |

## What "done" means for this pass

- Scoring math, dimension ids, weights, and the critical-flag override stay as they are.
- Compare and the three-scenario pack still call Super once per transcript.
- A default live score reserves 2 cap slots (Nano + Super). An appeal reserves 1. A fix reserves 2. Mock reserves 0.
- If Nano errors or times out, Super still scores and the card says triage was skipped.
