import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareWorkspace } from "@/components/compare-workspace";

export const metadata: Metadata = {
  title: "Compare agents",
  description: "Score two voice-agent transcripts against the same script.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-muted-foreground">Loading the comparison…</p>}>
      <CompareWorkspace />
    </Suspense>
  );
}
