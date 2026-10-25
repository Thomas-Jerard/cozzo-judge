import { PASS_AT, REVIEW_AT, dimensionById } from "./dimensions";
import type { CriticalFlag, DimensionId, DimensionScore, Verdict } from "./types";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function weightedOverall(
  scores: Pick<DimensionScore, "id" | "score">[],
): number {
  const total = scores.reduce((sum, item) => {
    return sum + item.score * dimensionById(item.id).weightPercent;
  }, 0);
  return Math.round(total / 100);
}

export function verdictFor(
  overall: number,
  flags: Pick<CriticalFlag, "severity">[],
): { verdict: Verdict; verdictOverridden: boolean } {
  const critical = flags.some((flag) => flag.severity === "critical");
  const band: Verdict =
    overall >= PASS_AT ? "pass" : overall >= REVIEW_AT ? "review" : "fail";
  if (critical) {
    return { verdict: "fail", verdictOverridden: band !== "fail" };
  }
  return { verdict: band, verdictOverridden: false };
}

export function emptyDimension(id: DimensionId, rationale: string): DimensionScore {
  const dimension = dimensionById(id);
  return {
    id,
    name: dimension.name,
    weight: dimension.weightPercent / 100,
    score: 0,
    rationale,
    evidence: [],
  };
}
