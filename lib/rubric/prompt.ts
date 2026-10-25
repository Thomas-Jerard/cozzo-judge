import { DIMENSIONS } from "./dimensions";
import { RUBRIC_VERSION, type ChatMessage, type JudgeInput, type NormalizedCall } from "./types";

export function buildJudgeMessages(
  input: JudgeInput,
  call: NormalizedCall,
): ChatMessage[] {
  const dimensionGuide = DIMENSIONS.map(
    (dimension) =>
      `- ${dimension.id} (${dimension.name}, weight ${dimension.weightPercent}%): ${dimension.prompt}`,
  ).join("\n");

  const timing = call.durationSeconds
    ? `Audio-transcript duration: ${call.durationSeconds} seconds.`
    : "No audio duration was provided.";

  return [
    {
      role: "system",
      content: `You are Cozzo Judge, an evaluator of business voice agents. You score a call against the business's own script. You do not give medical, legal, or repair advice of your own. You only judge whether the agent followed the requirements.

Rubric version ${RUBRIC_VERSION}. Score each dimension from 0 to 100. Higher is better on every dimension, including hallucination (100 means the agent invented nothing).

${dimensionGuide}

Return one JSON object and nothing else. No markdown fences. No preamble. Shape:
{
  "summary": "2 or 3 sentences a buyer can read",
  "dimensions": [
    {
      "id": "task_completion" | "factual_accuracy" | "escalation_handoff" | "tone_empathy" | "hallucination",
      "score": 0,
      "rationale": "one or two sentences",
      "evidence": [{ "quote": "verbatim words from the transcript", "note": "why this line matters" }]
    }
  ],
  "criticalFlags": [
    { "code": "short_snake_case", "severity": "critical" | "warning", "message": "what went wrong" }
  ]
}

Rules:
- Include all five dimension ids exactly once.
- Evidence quotes must be copied verbatim from the transcript, between 12 and 280 characters. At least one quote per dimension when the transcript has relevant speech.
- Do not quote the requirements as if the agent said them.
- Use a critical flag for invented prices or policies, medical or safety advice the script forbids, a missed 911 or emergency handoff, or a booking the script says must not be made.
- If the call did not require a handoff, say that in escalation_handoff and do not invent a miss.
- Score the agent, not the caller.`,
    },
    {
      role: "user",
      content: `Business requirements and approved script:
${input.requirements.trim()}

Call label: ${input.label?.trim() || "Untitled call"}
Source format: ${call.format}. ${timing}
${call.warnings.length ? `Parser notes: ${call.warnings.join(" ")}` : ""}

Transcript:
${call.plainText}`,
    },
  ];
}
