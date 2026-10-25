import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareWorkspace } from "@/components/compare-workspace";

export const metadata: Metadata = {
  title: "Advanced",
  description: "Compare two voice agents, or run the three-scenario pack.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-muted-foreground">Loading…</p>}>
      <CompareWorkspace />
    </Suspense>
  );
}
