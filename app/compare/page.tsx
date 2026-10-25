import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareWorkspace } from "@/components/compare-workspace";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Advanced",
  description: "Compare two voice agents, or run the three-scenario pack.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<PageShell><p className="text-sm text-muted-foreground">Loading…</p></PageShell>}>
      <CompareWorkspace />
    </Suspense>
  );
}
