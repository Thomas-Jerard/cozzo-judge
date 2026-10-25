import { DIMENSION_IDS } from "./types";
import { dimensionById } from "./dimensions";
import { clampScore } from "./verdict";
import type {
  CriticalFlag,
  DimensionId,
  DimensionScore,
  EvidenceQuote,
  NormalizedCall,
} from "./types";

export interface ParsedJudgment {
  summary: string;
  dimensions: DimensionScore[];
  criticalFlags: CriticalFlag[];
}

const CLOSED_REASONING = /<(think|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi;

export class JsonScorecardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonScorecardError";
  }
}

/** Drop reasoning channels and markdown fences, then parse the scorecard object. */
export function extractJsonObject(raw: string): unknown {
  const stripped = balancedObjects(stripModelWrapping(raw));
  const fromRaw = stripped.length > 0 ? [] : balancedObjects(raw);
  const candidates = stripped.length > 0 ? stripped : fromRaw;
  const scorecard = candidates.find(hasDimensions) ?? candidates.find(isRecord);
  if (!scorecard) {
    throw new JsonScorecardError(
      candidates.length === 0
        ? "The model did not return a JSON scorecard."
        : "The model returned a scorecard that was not valid JSON.",
    );
  }
  return scorecard;
}

function hasDimensions(value: unknown): boolean {
  return isRecord(value) && "dimensions" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripModelWrapping(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "");
  text = text.replace(CLOSED_REASONING, "");
  const unclosed = /<(think|reasoning|analysis)\b[^>]*>/i.exec(text);
  if (unclosed && unclosed.index != null) {
    const tail = text.slice(unclosed.index + unclosed[0].length);
    text = tail.includes("{") ? `${text.slice(0, unclosed.index)}${tail}` : text.slice(0, unclosed.index);
  }
  text = text.replace(/<\/(think|reasoning|analysis)>/gi, "");
  text = text.replace(/```(?:json|javascript|js)?/gi, "");
  return text.trim();
}

function balancedObjects(text: string): unknown[] {
  const found: unknown[] = [];
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf("{", index);
    if (start === -1) break;
    const slice = firstBalancedObject(text.slice(start));
    if (!slice) break;
    try {
      found.push(JSON.parse(slice));
    } catch {
      index = start + 1;
      continue;
    }
    index = start + slice.length;
  }
  return found;
}

function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export function parseJudgment(raw: string, call: NormalizedCall): ParsedJudgment {
  const value = extractJsonObject(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JsonScorecardError("The model returned a scorecard that was not an object.");
  }
  const record = value as Record<string, unknown>;
  const summary =
    typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim()
      : "The model returned scores without a written summary.";

  const provided = new Map<DimensionId, DimensionScore>();
  const rows = Array.isArray(record.dimensions) ? record.dimensions : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = item.id;
    if (!isDimensionId(id) || provided.has(id)) continue;
    const dimension = dimensionById(id);
    const evidence = readEvidence(item.evidence, call);
    provided.set(id, {
      id,
      name: dimension.name,
      weight: dimension.weightPercent / 100,
      score: clampScore(typeof item.score === "number" ? item.score : Number(item.score)),
      rationale:
        typeof item.rationale === "string" && item.rationale.trim()
          ? item.rationale.trim()
          : "No rationale was provided for this dimension.",
      evidence,
    });
  }

  const dimensions = DIMENSION_IDS.map((id) => {
    return (
      provided.get(id) ?? {
        id,
        name: dimensionById(id).name,
        weight: dimensionById(id).weightPercent / 100,
        score: 0,
        rationale: "The model omitted this dimension.",
        evidence: [],
      }
    );
  });

  return {
    summary,
    dimensions,
    criticalFlags: readFlags(record.criticalFlags),
  };
}

function readEvidence(value: unknown, call: NormalizedCall): EvidenceQuote[] {
  if (!Array.isArray(value)) return [];
  const quotes: EvidenceQuote[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quote = typeof row.quote === "string" ? row.quote.trim() : "";
    if (quote.length < 8) continue;
    const clipped = quote.length > 400 ? `${quote.slice(0, 397)}...` : quote;
    quotes.push({
      quote: clipped,
      note:
        typeof row.note === "string" && row.note.trim()
          ? row.note.trim()
          : "Cited by the judge.",
      verified: quoteAppears(clipped, call.plainText),
    });
    if (quotes.length === 3) break;
  }
  return quotes;
}

/**
 * Dash, hyphen, and minus characters that NFKC leaves unchanged.
 * Compared as ASCII hyphen-minus so a model quote can match the transcript.
 */
const DASH_VARIANTS =
  /[\u00AD\u058A\u05BE\u1400\u1806\u2010\u2011\u2012\u2013\u2014\u2015\u2043\u207B\u208B\u2212\u2E17\u2E1A\u2E3A\u2E3B\u2E40\u2E5D\u301C\u3030\u30A0\uFE31\uFE32\uFE58\uFE63\uFF0D]/g;

const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]/g;
const DOUBLE_QUOTES = /[\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033\u2036]/g;

export function quoteAppears(quote: string, transcript: string): boolean {
  const needle = normalizeForMatch(quote);
  if (needle.length < 8) return false;
  return normalizeForMatch(transcript).includes(needle);
}

/** NFKC, ASCII dashes and quotes, then collapsed whitespace. Used only for matching. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(DASH_VARIANTS, "-")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readFlags(value: unknown): CriticalFlag[] {
  if (!Array.isArray(value)) return [];
  const flags: CriticalFlag[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const message = typeof row.message === "string" ? row.message.trim() : "";
    if (!message) continue;
    const code =
      typeof row.code === "string" && row.code.trim()
        ? row.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 48)
        : "flag";
    flags.push({
      code,
      severity: row.severity === "warning" ? "warning" : "critical",
      message,
    });
    if (flags.length === 6) break;
  }
  return flags;
}

function isDimensionId(value: unknown): value is DimensionId {
  return typeof value === "string" && (DIMENSION_IDS as readonly string[]).includes(value);
}
