# Cozzo Judge demo script

Aim for about 2 minutes 40 seconds so the recording stays under the 3-minute limit. Record the browser, not a slide deck. Speak the bold lines, or close to them.

Before you hit record:

- Open the deployed app, or `npm run dev`.
- Leave the connection on **Auto**. Do not open Advanced unless the last half-minute needs it.
- If `NEBIUS_API_KEY` is set, one score is a real Nemotron call. If it is not set, say so when you open **How the models worked**. Do not pretend a practice score came from Nebius.

## 0:00 — Three steps

Open the home page. Stay on the first screen.

Point at Cozzo the Canary. **“Hi, I’m Cozzo. A canary in the coal mine for voice agents.”**

**“A buyer comparing voice agents cannot see the call in a feature grid. Cozzo Judge is three steps. Pick a call. Judge it. Read the score.”**

Point at the numbered list, then at the quiet line under the button. **“The score is powered by NVIDIA Nemotron on Nebius.”**

Click **Judge a call**.

## 0:20 — Pick a call

The steps at the top should show **1 Pick a call**.

**“Brightmolar Family Dental is fictional. I’ll start with Harbor Voice, the agent that misses the script.”**

Click **Harbor Voice**. Do not open the transcript.

Click **Judge this call**. Step 2 should say **Cozzo is listening to the call**, plus one sentence. Not a wall of model names.

## 0:45 — The result

When the result lands, stay at the top. Point at Cozzo, the number, the word Fail, the sentence, and the short list of issues. The canary keeps one pose. The ring around it changes with the verdict.

**“The score is the big thing. Fail is in plain words. These are the issues: an invented price, Medicaid, and a dentist who is out.”**

Click **Fix the prompt**. It is the only filled button on this screen.

## 1:20 — The rewrite

Wait on that same button. The line under it says a shorter prompt is being written, then scored. When the number changes, point at the line that says the first score and the rewrite score.

**“The caller’s words stayed. The agent lines were rewritten, and the score moved. This is not a new phone call.”**

## 1:50 — The detail, only if you open it

Open **The five checks** and read one quote. **“The line is from the call.”**

Open **How the models worked**. **“Nano did the fast read. Super wrote the number. Both ran on Nebius Token Factory, and the key stayed on the server.”**

If the score says it was a practice run, say that instead.

Open **Second opinion** and click **Ask for a second opinion**. **“That is the larger model. It says whether it agrees. The number stays where it is.”**

## 2:20 — Advanced, briefly

Open **Advanced** in the header. Click **Judge this pair** if you have time.

**“Compare is optional. Same script, two agents. The everyday path is still one call.”**

Back on the result, open **Share this score** only if a link is useful. **“You can hand someone the score. There is no account.”**

## 2:35 — Close

Scroll to the footer.

**“Powered by Cozzo. Powered by NVIDIA Nemotron on Nebius. This scores calls. It does not change the rankings on cozzo.io.”**

Stop. Do not add a credits roll.
