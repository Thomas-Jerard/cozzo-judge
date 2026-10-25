import type { AppealReport, BenchReport } from "./bench";
import type { Scorecard } from "./rubric";

export interface SharedRepair {
  prompt: string;
  changes: string[];
  before: number;
  after: number;
  note: string;
}

export interface SharedCard {
  v: 1;
  scorecard: Scorecard;
  bench?: BenchReport;
  appeal?: Pick<AppealReport, "agrees" | "opinion" | "model" | "latencyMs" | "provider" | "note">;
  repair?: SharedRepair;
}

const MAX_HASH = 12_000;

export async function encodeCardLink(card: SharedCard): Promise<string | null> {
  const json = JSON.stringify(card);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const hash = bytesToBase64Url(bytes);
  if (hash.length > MAX_HASH) return null;
  return `/card#${hash}`;
}

export async function decodeCardHash(hash: string): Promise<SharedCard> {
  const bytes = base64UrlToBytes(hash.trim());
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const parsed = JSON.parse(text) as SharedCard;
  if (parsed?.v !== 1 || !parsed.scorecard || typeof parsed.scorecard.overall !== "number") {
    throw new Error("This link does not contain a Cozzo Judge scorecard.");
  }
  return parsed;
}

export function reportMarkdown(card: SharedCard): string {
  const score = card.scorecard;
  const lines = [
    `# Cozzo Judge · ${score.call.label || "Call"}`,
    "",
    `**${score.overall} · ${score.verdict}**`,
    "",
    score.summary,
    "",
    `Judge: ${score.judge.mode} · \`${score.judge.model}\``,
  ];
  const triage = card.bench?.triage;
  if (triage?.skipped) {
    lines.push(`Nano triage skipped (${triage.skipReason || "no risk line"}). Super still scored the call.`);
  } else if (triage) {
    lines.push(
      `Nano triage: ${triage.risk} risk in ${triage.latencyMs} ms. ${triage.headline}`,
    );
  }
  if (card.bench?.score) {
    lines.push(`Score model \`${card.bench.score.model}\` in ${card.bench.score.latencyMs} ms.`);
  }
  if (card.bench?.agreement) {
    lines.push(`Nano and Super: ${card.bench.agreement}.`);
  }
  lines.push("", "## Dimensions", "");
  for (const dimension of score.dimensions) {
    lines.push(`- ${dimension.name} (${Math.round(dimension.weight * 100)}%): ${dimension.score}. ${dimension.rationale}`);
  }
  if (score.criticalFlags.length > 0) {
    lines.push("", "## Flags", "");
    for (const flag of score.criticalFlags) {
      lines.push(`- ${flag.severity}: ${flag.message}`);
    }
  }
  if (card.appeal) {
    lines.push(
      "",
      "## Appeal",
      "",
      `${card.appeal.agrees ? "Agrees" : "Disagrees"} · \`${card.appeal.model}\` · ${card.appeal.latencyMs} ms`,
      "",
      card.appeal.opinion,
      "",
      card.appeal.note,
    );
  }
  if (card.repair) {
    lines.push(
      "",
      "## Revised agent lines",
      "",
      `${card.repair.before} → ${card.repair.after}`,
      "",
      card.repair.note,
      "",
      card.repair.prompt,
      "",
    );
    for (const change of card.repair.changes) lines.push(`- ${change}`);
  }
  lines.push("", "Powered by Cozzo · https://cozzo.io");
  return lines.join("\n");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
