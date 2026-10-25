import { Suspense } from "react";
import type { Metadata } from "next";
import { ScoreWorkspace } from "@/components/score-workspace";

export const metadata: Metadata = {
  title: "Judge a call",
  description: "Pick a call, judge it, and read the score.",
};

export default function ScorePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-muted-foreground">Loading…</p>}>
      <ScoreWorkspace />
    </Suspense>
  );
}
