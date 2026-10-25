import { normalizeTranscript } from "@/lib/rubric";
import { dentalHarbor, dentalRequirements } from "@/lib/samples/dental";
import { renderPlain } from "@/lib/samples/format";

export const TRANSCRIPT_LIMIT = 80_000;
export const REQUIREMENTS_LIMIT = 20_000;

export const OWN_EXAMPLE = {
  label: "Example · Harbor Voice",
  transcript: renderPlain(dentalHarbor),
  script:
    "You are the virtual receptionist for Brightmolar Family Dental. Be warm and brief. Follow only the business facts. Do not invent a price, an insurance rule, or a diagnosis.",
  facts: dentalRequirements,
};

export function combineBrief(script: string, facts: string): string {
  const parts: string[] = [];
  const scriptText = script.trim();
  const factsText = facts.trim();
  if (scriptText) parts.push(`Agent script:\n${scriptText}`);
  if (factsText) parts.push(`Business facts:\n${factsText}`);
  return parts.join("\n\n");
}

export function validateOwnCall(transcript: string, script: string, facts: string): string | null {
  const call = transcript.trim();
  if (!call) return "Paste the call. Start each line with Agent: or Caller:.";
  if (call.length > TRANSCRIPT_LIMIT) {
    return "That call is too long. Keep it under 80,000 characters.";
  }
  const parsed = normalizeTranscript(call);
  if (parsed.turns.length === 0) {
    return "No lines to score. Start each turn with Agent: or Caller:.";
  }
  const brief = combineBrief(script, facts);
  if (!brief) {
    return "Add the agent’s script or the business facts. The score checks the call against those.";
  }
  if (brief.length > REQUIREMENTS_LIMIT) {
    return "The script and facts are too long together. Keep them under 20,000 characters.";
  }
  return null;
}

export function transcriptHint(transcript: string): string | null {
  const call = transcript.trim();
  if (!call || call.length > TRANSCRIPT_LIMIT) return null;
  const parsed = normalizeTranscript(call);
  if (parsed.turns.length === 0) return null;
  if (parsed.turns.every((turn) => turn.speaker === "unknown")) {
    return "No Agent: or Caller: labels yet. The judge can still read it. Labels make the score sharper.";
  }
  return null;
}
