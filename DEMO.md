# Cozzo Judge demo script

Aim for about 2 minutes 40 seconds so the recording stays under the 3-minute limit. Record the browser, not a slide deck. Speak the bold lines, or close to them.

Before you hit record:

- Open the deployed app, or `npm run dev`.
- If `NEBIUS_API_KEY` is set, leave the judge on **Auto** and the model on **Nemotron 3 Super**. That is the path that runs Nano, then Super.
- If the key is not set, say so and show the mock badge. Do not pretend a mock score came from Nebius. The bench, the appeal, and Fix the prompt still run locally and are labeled mock.

## 0:00 — The problem, and who does what

Open the home page. Stay on the first screen.

**“A buyer comparing voice agents cannot see the call in a feature grid. Cozzo Judge scores the transcript against the script the business approved.”**

Point at the three cards. **“Nano is the fast risk line. Super writes the rubric score. Ultra is the appeal, and it does not move the number.”**

## 0:22 — One good call, two models

Open **Score the dental sample**. The banner says synthetic. Northline Voice is loaded.

**“Brightmolar Family Dental is fictional. Northline is a fictional provider, not a vendor on cozzo.io.”**

Click **Judge this call**. The progress list should move from Nano, to Super, to the quote check.

When the card lands, point at the model bench: Nano’s risk, Super’s latency, and both model ids. **“Two Nemotron calls on Nebius Token Factory. Nano said the risk was low. Super scored the rubric. The key never left the server.”**

If the badge says **Mock**, point at the Auto note instead. **“No key here, so this bench is the local rubric. The same buttons call Nemotron when the key is set.”**

Open **Factual accuracy** and read one quote. **“The evidence is a line from the call.”**

## 0:58 — The miss

Click **Harbor Voice**, then **Judge this call**.

**“Same script. Harbor invents a $49 special, says they take Medicaid, and books Dr. Nguyen, who is out.”**

Point at the critical flags and the Fail. If the bench says Nano and Super disagree, read that sentence. **“The number on the card is Super’s. Nano only says whether the call looks risky.”**

## 1:25 — Fix the prompt

Click **Fix the prompt**. Wait through Rewrite, then Rescore.

Point at the before and after numbers. **“Super wrote a tighter prompt and new agent lines. The caller’s words are the same. This is a rewritten transcript, not a new phone call, and the score moved.”**

Open **Read the rewritten transcript** only if there is time, and show that the caller lines are still Elena’s.

## 1:55 — Ultra appeal

Click **Ask Ultra**.

**“Ultra reads the same call and says whether it agrees. The ring does not change. That is the hard reasoning step, used only when we ask.”**

If you are on the revised card, Ultra is appealing the rewrite. That is fine. Say so in one clause.

## 2:15 — Compare, then hand it over

Open **Compare**. Click **Judge this pair**.

**“Northline leads. Compare stays on Super, one call per transcript, so the pack still fits the demo cap. A gap of three points or less is a tie.”**

Back on the scorecard, or from the score you still have, click **Copy link** or **Copy report**. **“The link is the scorecard. There is no account.”**

## 2:35 — Close

Scroll to the footer.

**“Powered by Cozzo. This scores calls. It does not change the rankings on cozzo.io.”**

Stop. Do not add a credits roll.
