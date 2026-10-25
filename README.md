# Cozzo Judge

Cozzo Judge scores a voice-agent phone call against the script the business meant the agent to follow. Paste or upload a transcript, add the requirements, and get a scorecard: an overall score, five dimension scores, critical flags, and quotes taken from the call.

It is a hackathon entry for [Cozzo](https://cozzo.io), built for the Nebius x NVIDIA Global AI Hackathon (Best Apps and Agents). It is a prototype for evaluating calls. It does not change rankings, prices, or sponsorship labels on cozzo.io.

Live scoring calls an NVIDIA Nemotron model through the [Nebius Token Factory](https://tokenfactory.nebius.com) OpenAI-compatible API. The key stays on the server. With no key, a mock judge still scores the included synthetic calls.

## Devpost description

Cozzo helps businesses pick a voice agent. Price pages and feature grids do not show whether the agent booked the job, stayed inside the script, or invented a price when it got stuck. Cozzo Judge closes that gap.

A reviewer pastes a call transcript, or uploads the JSON a speech-to-text pipeline already produced, plus the business's approved script. NVIDIA Nemotron, served by Nebius Token Factory, scores the call on task completion, factual accuracy, escalation and handoff, tone and empathy, and made-up answers. The scorecard quotes the lines it used. A critical miss, such as a skipped 911 instruction or an invented fee, fails the call even when the weighted score looks acceptable.

Compare mode runs the same script against two agents and shows the gap dimension by dimension. A pack run scores three synthetic scenarios, a dental office, an HVAC company, and a med spa, so a buyer can see a pattern instead of one lucky call. Northline Voice and Harbor Voice are fictional labels. The calls are synthetic examples, clearly marked in the product.

The rubric is a plain TypeScript module (`lib/rubric`) with no UI and no network code, so a later paid Voice Agent Evaluator bot can import the same weights, prompt, and verdict rules.

How Nebius and NVIDIA are used: the Next.js server calls `POST /v1/chat/completions` on `https://api.tokenfactory.nebius.com/v1`. A default live score is two calls. `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` writes a one-line risk read (15 second timeout). `nvidia/nemotron-3-super-120b-a12b` writes the rubric score. If Nano fails, Super still scores and the card says triage was skipped. **Ask Ultra** calls `nvidia/Nemotron-3-Ultra-550b-a55b` for an opinion and does not change the number. **Fix the prompt** asks Super for a replacement prompt and new agent lines, keeps the caller lines, and scores that rewrite. Compare and the scenario pack stay one Super call per transcript. The same host also serves `nvidia/Nemotron-3_5-Lightning` and `nvidia/Nemotron-3.5-Super-VL` when you pick them in the menu; those choices skip the Nano step. `NEBIUS_API_KEY` is read from the environment and is never shipped to the browser. If the key is absent, mock mode runs the same scorecard shape locally so the demo still works.

## Run it locally

```bash
npm install
cp .env.example .env.local
# optional: put a Nebius Token Factory key in NEBIUS_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For this repo's usual local port, `npm run dev -- --port 43123 --hostname 0.0.0.0`.

```bash
npm test         # rubric, transcript parser, synthetic scorecards
npm run live-smoke  # six synthetic calls through Token Factory; needs NEBIUS_API_KEY
npm run lint
npm run build
npm start
```

The dental sample is loaded on **Score a call**. **Compare** loads both providers for that script. **Run all three scenarios** scores the pack.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEBIUS_API_KEY` | For live scores | Token Factory bearer token. Server only. |
| `NEBIUS_BASE_URL` | No | Overrides the Token Factory host. Default is `https://api.tokenfactory.nebius.com/v1`. |
| `NEBIUS_MODEL` | No | Default model id. Falls back to `nvidia/nemotron-3-super-120b-a12b`. |
| `JUDGE_MODE` | No | `auto` (default), `live`, or `mock`. `auto` is live only when a key is present. |
| `LIVE_IP_HOURLY_CAP` | No | Live scorecards per visitor IP per rolling hour. Default `10`. |
| `LIVE_DAILY_CAP` | No | Live scorecards across all visitors per UTC day. Default `300`. |

Create a key in Nebius Token Factory and keep it in `.env.local` or in the host's secret store. Do not commit it.

On Vercel, add `NEBIUS_API_KEY` in project settings. Route handlers set `maxDuration = 120` so one live call, plus a single retry when the model returns invalid JSON, can finish. Each Token Factory request times out after 55 seconds. If a host cuts the request off, score with Super or raise the function duration on a plan that allows it.

## Live rate limits

Live scoring is capped so a public demo cannot spend the Nebius balance. Mock scoring is not counted.

- 10 live scorecards per visitor IP per rolling hour (`LIVE_IP_HOURLY_CAP`).
- 300 live scorecards per UTC day across everyone (`LIVE_DAILY_CAP`).
- A Super score on **Score a call** counts as 2 (Nano triage plus the Super scorecard). Any other model counts as 1. **Ask Ultra** counts as 1. **Fix the prompt** counts as 2 (the rewrite, then the rescore). **Compare** counts as 2, one Super scorecard each, with no Nano step. **Run all three scenarios** is three compares, so it counts as 6.
- A request that does not fit in the remaining budget is refused as a whole. Nothing is reserved.
- The response is HTTP 429 with a short explanation. The page shows that message and a button to score the same call, pair, or pack with the mock judge.

The counters are in memory on each server instance. Vercel does not share that memory across isolates, and a cold start starts from zero. The cap can therefore be exceeded when more than one instance is serving traffic. There is no KV store. An automatic JSON retry is one extra model call and is not a second scorecard in the count. The visitor IP is `x-real-ip` when the host sets it, otherwise the first address in `x-forwarded-for`.

## Architecture

```
Browser
  Score a call · Compare · scenario pack · /card#… (the scorecard is in the URL)
        │
        ▼
POST /api/judge          stream: NDJSON status, then the scorecard
  live + Super (default):
    1. Nano   nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B   risk line, 15s
    2. Super  nvidia/nemotron-3-super-120b-a12b       rubric score
    3. quote check, no model
  any other model: that model only
POST /api/appeal         Ultra  nvidia/Nemotron-3-Ultra-550b-a55b
                         opinion only, the rubric number stays
POST /api/repair         Super writes the prompt and agent lines
                         caller lines are copied through
                         Super scores the rewrite (no second Nano call)
POST /api/compare        Super once per transcript
        │
        ▼
lib/rubric                normalize → prompt or mock → parse → weighted score
        │
        ├── mock: calibrated fixtures for the six synthetic calls,
        │         otherwise a deterministic heuristic
        └── live: lib/nebius.ts
                  Authorization: Bearer $NEBIUS_API_KEY
                  POST https://api.tokenfactory.nebius.com/v1/chat/completions
```

The browser never sees the API key. It sends the transcript, the requirements, a model id, and a mode. The server decides whether that mode is allowed.

`lib/rubric` is the reusable piece. `judgeCall()` takes a transcript, requirements, and either `mode: "mock"` or a `complete()` function. A bot can pass its own Nebius client and skip the React app. Quote checking, weights, and the critical-flag override live in that module so the bot cannot drift from the scorecard UI.

Transcripts accepted:

- Plain text with `Agent:` / `Caller:` labels (also Assistant, User, Customer, and a few other labels). Lines without a label continue the previous turn.
- JSON with `utterances`, `messages`, `transcript_object`, `segments`, or `turns`. Roles such as `assistant` and `user` map to agent and caller. `start` / `end` become timestamps. A top-level `duration_seconds` is kept.
- A simple WebVTT file.

Evidence quotes are marked verified when the text appears in the transcript after Unicode NFKC, ASCII dashes and quotes, and collapsed whitespace. The quote on the scorecard stays as the model wrote it. A quote the model invented is shown and marked unverified.

## Rubric

Version `1.0.0`. Every dimension is 0–100. Higher is better, including made-up answers: 100 means the agent invented nothing.

| Dimension | Weight | A high score means |
| --- | ---: | --- |
| Task completion | 30% | The caller left with the booking, answer, or complete message the script requires. |
| Factual accuracy | 25% | Prices, hours, coverage, service area, and who is working match the script. |
| Escalation and handoff | 20% | Safety issues and human-only requests were handed off the way the script says. |
| Tone and empathy | 10% | The agent was clear, polite, and appropriately warm. |
| Made-up answers | 15% | No invented prices, policies, diagnoses, or outcomes. |

The overall score is the weighted sum, rounded. Bands:

- **Pass** at 85 or above, and no critical flag.
- **Needs review** from 70 to 84, and no critical flag.
- **Fail** below 70, or any critical flag.

A critical flag fails the call even when the weighted score would have passed. The scorecard says when that override happened. The numeric score stays visible so a buyer can see both facts.

Compare mode calls a gap of 3 points or less a tie.

The model is asked for JSON only. The parser strips `<think>`, `<reasoning>`, and `<analysis>` blocks, then markdown fences, and keeps the object that contains `dimensions`. A live score that still is not JSON is requested once more. Each request times out after 55 seconds. If Token Factory rejects `response_format: json_object`, the server retries that request once without it. `npm run live-smoke` sends all six synthetic calls through this path and prints scores and latency. It does not print the API key.

## Mock mode

Mock mode is the default whenever `NEBIUS_API_KEY` is empty. The UI also has an explicit Mock control, and a failed live call can be re-scored with the mock judge.

- The six synthetic calls use hand-written scorecards so a demo is stable and the quotes match the script.
- Any other transcript uses a deterministic heuristic: prices that are not in the script, insurance contradictions, forbidden advice, a missed 911 line, bookings for someone the script says is out, and out-of-area dispatch. It is labeled as a local preview. It is not a Nemotron score.

The mock path does not call the network. Mock still fills the bench with a local risk line, a local Ultra appeal, and a local rewrite so the buttons can be demonstrated without a key. Those cards are labeled mock.

## Synthetic samples

All three businesses, both providers, and every phone number are fictional. The UI labels them as synthetic examples.

| Scenario | Business | What the call is testing |
| --- | --- | --- |
| Dental office | Brightmolar Family Dental | New-patient fee, Medicaid, a dentist who is out, tooth pain with no diagnosis. |
| HVAC company | Northwind Comfort | Gas smell and 911, diagnostic fee versus a parts quote, Austin / Round Rock only. |
| Med spa | Lumen & Co. Med Spa | Menu price, no outcome promise, possible pregnancy, swelling handed to the medical director. |

Northline Voice follows the script. Harbor Voice does not. That split is deliberate so Compare has something to show. Neither name is a product listed on Cozzo.

Each sample can be viewed as plain text or as audio-transcript JSON with illustrative timestamps. There is no audio file.

## Deploy

The app is a Next.js App Router project and deploys on Vercel with no extra services and no database.

1. Import the repository.
2. Set `NEBIUS_API_KEY`. Leave it unset if the deployment should stay on the mock judge.
3. Build command `npm run build`, output handled by the Next.js preset.

`cacheComponents` is on, which is this Next.js version's scaffold default. Route handlers do not set a custom runtime, because that option conflicts with cache components. `GET /api/status` calls `connection()` so the key check is not frozen at build time.

## What this does not do

It does not place phone calls, store recordings, or decide HIPAA compliance. A med spa sample that handles swelling is a script-following test, not medical advice. Scores are a review aid.

## License

MIT. See [LICENSE](LICENSE).
