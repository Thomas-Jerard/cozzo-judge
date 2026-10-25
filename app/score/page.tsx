import { Suspense } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ScoreWorkspace } from "@/components/score-workspace";

export const metadata: Metadata = {
  title: "Judge a call",
  description: "Pick a call, judge it, and read the score.",
};

export default function ScorePage() {
  return (
    <Suspense fallback={<PageShell><p className="text-sm text-muted-foreground">Loading…</p></PageShell>}>
      <ScoreWorkspace />
    </Suspense>
  );
}
