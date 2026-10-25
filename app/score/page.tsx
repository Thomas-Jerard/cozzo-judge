import { Suspense } from "react";
import type { Metadata } from "next";
import { ScoreWorkspace } from "@/components/score-workspace";

export const metadata: Metadata = {
  title: "Score a call",
  description: "Score one voice-agent transcript against a business script.",
};

export default function ScorePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-muted-foreground">Loading the bench…</p>}>
      <ScoreWorkspace />
    </Suspense>
  );
}
