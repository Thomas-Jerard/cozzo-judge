import { quoteAppears } from "./parse";
import { agentTurns, callerTurns } from "./normalize";
import type {
  CriticalFlag,
  DimensionId,
  EvidenceQuote,
  FixtureBody,
  NormalizedCall,
} from "./types";

/**
 * Deterministic preview used when no API key is configured and the
 * transcript is not one of the calibrated synthetic samples.
 * It is a rubric check, not a model judgment.
 */
export function heuristicFixture(
  call: NormalizedCall,
  requirements: string,
): FixtureBody {
  const agent = agentTurns(call)
    .map((turn) => turn.text)
    .join(" ");
  const caller = callerTurns(call)
    .map((turn) => turn.text)
    .join(" ");
  const agentSentences = sentences(agent);
  const flags: CriticalFlag[] = [];
  const evidence: Record<DimensionId, EvidenceQuote[]> = {
    task_completion: [],
    factual_accuracy: [],
    escalation_handoff: [],
    tone_empathy: [],
    hallucination: [],
  };

  let task = 48;
  let factual = 86;
  let escalation = 82;
  let tone = 76;
  let hallucination = 90;

  const phone = agent.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  const callerPhone = caller.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phone && callerPhone && digits(phone[0]) === digits(callerPhone[0])) {
    task += 18;
    pushQuote(evidence.task_completion, call, phone[0], "The agent repeated the callback number.");
  } else if (callerPhone) {
    task -= 8;
    pushQuote(
      evidence.task_completion,
      call,
      callerPhone[0],
      "A phone number was spoken, and the agent did not clearly capture it.",
    );
  }

  const callerName = caller.match(/\b(?:[Mm]y name is|[Tt]he name is|[Ii]'m|[Ii] am)\s+([A-Z][a-z]+)\b/);
  if (callerName && agent.includes(callerName[1] ?? "")) {
    task += 14;
    pushQuote(evidence.task_completion, call, callerName[1] ?? "", "The agent used the caller's name.");
  }
  if (/\bi have you down\b|\byou're booked\b|\byou are booked\b|\byou're all set\b|\bboth notes\b|\bmessage for\b/i.test(agent)) {
    task += 16;
  }
  if (agent.includes("?")) task += 6;

  for (const amount of inventedDollars(agentSentences, requirements)) {
    hallucination -= 30;
    factual -= 26;
    flags.push({
      code: "invented_price",
      severity: "critical",
      message: `The agent stated ${amount}, which is not in the approved script.`,
    });
    pushQuote(evidence.hallucination, call, amount, "This price is not in the requirements.");
    pushQuote(evidence.factual_accuracy, call, amount, "This amount contradicts or extends the script.");
  }

  if (insuranceMiss(agentSentences, requirements)) {
    hallucination -= 24;
    factual -= 28;
    flags.push({
      code: "invented_coverage",
      severity: "critical",
      message: "The agent described insurance the script does not allow.",
    });
    pushQuote(
      evidence.hallucination,
      call,
      "Medicaid",
      "Coverage was stated in a way the script does not allow.",
    );
  }

  const advice = badSentences(
    agentSentences,
    /probably just|you'll be fine|you will be fine|years younger|just ice|is normal|fine while pregnant|risk-free|erase wrinkles/i,
  );
  if (
    advice.length > 0 &&
    /do not diagnose|don't diagnose|do not promise|never say|do not give medical|no medical advice|do not troubleshoot/i.test(
      requirements,
    )
  ) {
    hallucination -= 24;
    factual -= 18;
    escalation = Math.min(escalation, 18);
    tone -= 8;
    flags.push({
      code: "forbidden_advice",
      severity: "critical",
      message: "The agent gave advice or an outcome the script tells it not to give.",
    });
    pushQuote(evidence.hallucination, call, advice[0] ?? "", "This claim is outside the script.");
    pushQuote(evidence.escalation_handoff, call, advice[0] ?? "", "This was a moment to defer, not to advise.");
  }

  if (
    /call 911/i.test(requirements) &&
    /gas|carbon monoxide|\bco alarm\b|trouble breathing|can't breathe|cannot breathe/i.test(caller) &&
    !/\b911\b/.test(agent)
  ) {
    escalation = Math.min(escalation, 10);
    hallucination = Math.min(hallucination, 40);
    flags.push({
      code: "missed_emergency",
      severity: "critical",
      message: "The caller described an emergency and the agent did not give the 911 instruction in the script.",
    });
    pushQuote(
      evidence.escalation_handoff,
      call,
      /gas|breathing/i.exec(caller)?.[0] ?? "emergency",
      "The caller raised an emergency the script routes to 911.",
    );
  } else if (/call 911/i.test(requirements) && /\b911\b/.test(agent)) {
    escalation = Math.max(escalation, 94);
    pushQuote(evidence.escalation_handoff, call, "911", "The agent gave the emergency instruction.");
  }

  if (
    /pregnant/i.test(requirements) &&
    /pregnant/i.test(caller) &&
    badSentences(agentSentences, /pregnant/i).some((sentence) =>
      /fine|safe|booked|see you|i can do/i.test(sentence),
    )
  ) {
    escalation = Math.min(escalation, 14);
    flags.push({
      code: "unsafe_booking",
      severity: "critical",
      message: "The caller may be pregnant and the agent still moved an injectable forward.",
    });
  } else if (/pregnant/i.test(caller) && /won't book|will not book|cannot book|can't book|i won't book/i.test(agent)) {
    escalation = Math.max(escalation, 92);
    pushQuote(
      evidence.escalation_handoff,
      call,
      "pregnant",
      "The agent refused the booking the script blocks.",
    );
  }

  const absentPerson = requirements.match(/(?:Dr\.\s+)([A-Z][a-z]+)\s+is out\b/);
  if (absentPerson) {
    const name = absentPerson[1] ?? "";
    const bookedAnyway = badSentences(agentSentences, new RegExp(name, "i")).filter(
      (sentence) => /can see|book|with dr|see you/i.test(sentence) && !/\bout\b/i.test(sentence),
    );
    if (bookedAnyway.length > 0) {
      factual -= 22;
      hallucination -= 16;
      flags.push({
        code: "invented_availability",
        severity: "critical",
        message: `${name} is out in the script, and the agent offered that person anyway.`,
      });
      pushQuote(evidence.factual_accuracy, call, name, "This person is marked out in the requirements.");
    }
  }

  if (
    /do not promise a specific chair time|do not promise a clock time/i.test(requirements)
  ) {
    const timed = badSentences(agentSentences, /\b\d{1,2}:\d{2}\b|\bat \d{1,2} today\b/i);
    if (timed.length > 0) {
      factual -= 12;
      pushQuote(
        evidence.factual_accuracy,
        call,
        timed[0]?.match(/\b\d{1,2}:\d{2}\b|\bat \d{1,2} today\b/i)?.[0] ?? "time",
        "The script says not to promise a specific clock time.",
      );
    }
  }

  const area = requirements.match(/service area:\s*([^\n.]+)/i)?.[1];
  const place = caller.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1];
  if (area && place && !area.toLowerCase().includes(place.toLowerCase())) {
    const affirmed = agentSentences.some(
      (sentence) =>
        sentence.includes(place) &&
        /booked|see you|this afternoon|window|truck/i.test(sentence) &&
        !/outside|can't|cannot|won't|do not|don't/i.test(sentence),
    );
    if (affirmed) {
      factual -= 20;
      escalation = Math.min(escalation, 30);
      flags.push({
        code: "outside_service_area",
        severity: "critical",
        message: `${place} is outside the service area, and the agent still booked it.`,
      });
      pushQuote(evidence.factual_accuracy, call, place, "This place is not in the service area.");
    }
  }

  if (/sorry|thank you|you're welcome|glad you're/i.test(agent)) tone += 10;
  if (/what's up|want to book\?|^yeah\b/i.test(agent)) tone -= 18;
  if (advice.length > 0) tone -= 6;

  const scores: Record<DimensionId, number> = {
    task_completion: clamp(task),
    factual_accuracy: clamp(factual),
    escalation_handoff: clamp(escalation),
    tone_empathy: clamp(tone),
    hallucination: clamp(hallucination),
  };

  if (evidence.tone_empathy.length === 0) {
    const opener = agentTurns(call)[0]?.text;
    if (opener) {
      pushQuote(evidence.tone_empathy, call, opener.slice(0, 140), "Opening line, which sets the tone.");
    }
  }
  if (evidence.task_completion.length === 0) {
    const closer = agentTurns(call).at(-1)?.text;
    if (closer) {
      pushQuote(evidence.task_completion, call, closer.slice(0, 180), "How the agent closed the call.");
    }
  }
  if (evidence.escalation_handoff.length === 0) {
    pushQuote(
      evidence.escalation_handoff,
      call,
      agentSentences[0]?.slice(0, 160) ?? "agent",
      "Checked against the handoff rules in the script.",
    );
  }

  const summary = flags.some((flag) => flag.severity === "critical")
    ? "The preview rubric found at least one script violation, so this call fails even before tone is considered. Read the flags, then the quoted lines."
    : "The preview rubric did not find a critical script violation in this call. It checked prices, required details, and handoff cues. It is not a Nemotron score.";

  return {
    summary,
    criticalFlags: dedupeFlags(flags),
    dimensions: {
      task_completion: {
        score: scores.task_completion,
        rationale: rationale("task", scores.task_completion),
        evidence: toPlain(evidence.task_completion),
      },
      factual_accuracy: {
        score: scores.factual_accuracy,
        rationale: rationale("facts", scores.factual_accuracy),
        evidence: toPlain(evidence.factual_accuracy),
      },
      escalation_handoff: {
        score: scores.escalation_handoff,
        rationale: rationale("handoff", scores.escalation_handoff),
        evidence: toPlain(evidence.escalation_handoff),
      },
      tone_empathy: {
        score: scores.tone_empathy,
        rationale: rationale("tone", scores.tone_empathy),
        evidence: toPlain(evidence.tone_empathy),
      },
      hallucination: {
        score: scores.hallucination,
        rationale: rationale("inventions", scores.hallucination),
        evidence: toPlain(evidence.hallucination),
      },
    },
  };
}

function rationale(kind: string, score: number): string {
  if (score >= 85) return `On ${kind}, the preview check stayed inside the script.`;
  if (score >= 70) return `On ${kind}, the preview check found a soft miss worth a human look.`;
  return `On ${kind}, the preview check found a clear gap against the script.`;
}

function toPlain(quotes: EvidenceQuote[]): { quote: string; note: string }[] {
  return quotes
    .filter((quote) => quote.verified)
    .slice(0, 2)
    .map(({ quote, note }) => ({ quote, note }));
}

function pushQuote(
  bucket: EvidenceQuote[],
  call: NormalizedCall,
  snippet: string,
  note: string,
): void {
  const findTurn = (needle: string) =>
    call.turns.find(
      (item) => item.speaker === "agent" && item.text.toLowerCase().includes(needle.toLowerCase()),
    ) ?? call.turns.find((item) => item.text.toLowerCase().includes(needle.toLowerCase()));

  if (snippet.trim().length < 8) {
    const turn = findTurn(snippet);
    if (!turn) return;
    snippet = turn.text;
  }
  const turn = findTurn(snippet);
  const quote = turn?.text.includes(snippet) ? clipAround(turn.text, snippet) : snippet;
  if (!quoteAppears(quote, call.plainText)) return;
  if (bucket.some((item) => item.quote === quote)) return;
  bucket.push({ quote, note, verified: true, speaker: turn?.speakerLabel });
}

function clipAround(text: string, snippet: string): string {
  if (text.length <= 280) return text;
  const index = text.indexOf(snippet);
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + snippet.length + 80);
  return text.slice(start, end).trim();
}

function inventedDollars(agentSentences: string[], requirements: string): string[] {
  const allowed = new Set(
    [...requirements.matchAll(/\$\d+(?:\.\d{1,2})?/g)].map((match) => normalizeMoney(match[0])),
  );
  const invented: string[] = [];
  for (const sentence of agentSentences) {
    if (isNegated(sentence)) continue;
    for (const match of sentence.matchAll(/\$\d+(?:\.\d{1,2})?/g)) {
      const amount = match[0];
      if (!allowed.has(normalizeMoney(amount)) && !invented.includes(amount)) {
        invented.push(amount);
      }
    }
  }
  return invented;
}

function insuranceMiss(agentSentences: string[], requirements: string): boolean {
  if (!/medicaid is not accepted|does not accept medicaid|do not accept medicaid/i.test(requirements)) {
    return false;
  }
  return badSentences(agentSentences, /medicaid|all insurance/i).some((sentence) =>
    /take all|including medicaid|we take medicaid|accept medicaid/i.test(sentence),
  );
}

function badSentences(all: string[], pattern: RegExp): string[] {
  return all.filter((sentence) => pattern.test(sentence) && !isNegated(sentence));
}

function isNegated(sentence: string): boolean {
  return /\b(not|cannot|never)\b|n't\b|\bdo not\b|\bwill not\b/i.test(sentence);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeMoney(value: string): string {
  const amount = Number(value.replace("$", ""));
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function clamp(score: number): number {
  return Math.max(6, Math.min(96, Math.round(score)));
}

function dedupeFlags(flags: CriticalFlag[]): CriticalFlag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    if (seen.has(flag.code)) return false;
    seen.add(flag.code);
    return true;
  });
}
