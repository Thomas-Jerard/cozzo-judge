import { NANO_MODEL_ID } from "@/lib/models";
import { completeWithNebius } from "@/lib/nebius";
import { parseSpeakerLabels, type LabeledTurn, type SpeechSegment } from "./turns";

export const SPEAKER_MODEL_ID = NANO_MODEL_ID;

const SYSTEM = `You label turns in a phone call between a voice agent and a human caller.
The agent works for the business and usually speaks first. The caller is the customer.
Copy the words. Do not invent, translate, or summarize.
Merge consecutive lines from the same person.
Return JSON only: {"turns":[{"speaker":"agent"|"caller","text":"..."}]}`;

export async function labelWithNemotron(segments: SpeechSegment[]): Promise<LabeledTurn[] | null> {
  const body = segments
    .map((segment, index) => `${index + 1}. [${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${segment.text}`)
    .join("\n");
  try {
    const first = await ask(body, false);
    if (first) return first;
    return await ask(`${body}\n\nReply with the JSON object only.`, true);
  } catch {
    return null;
  }
}

async function ask(body: string, repair: boolean): Promise<LabeledTurn[] | null> {
  const result = await completeWithNebius(
    SPEAKER_MODEL_ID,
    [
      { role: "system", content: repair ? `${SYSTEM}\nThe last reply was not usable JSON. Return only the object.` : SYSTEM },
      { role: "user", content: body },
    ],
    {
      maxTokens: repair ? 700 : 900,
      timeoutMs: 32_000,
      disableThinking: true,
      jsonSchema: {
        name: "speaker_labels",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            turns: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  speaker: { type: "string", enum: ["agent", "caller"] },
                  text: { type: "string" },
                },
                required: ["speaker", "text"],
              },
            },
          },
          required: ["turns"],
        },
      },
    },
  );
  return parseSpeakerLabels(result.content);
}
