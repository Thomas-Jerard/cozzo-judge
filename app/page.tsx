import Link from "next/link";
import { CozzoCanary } from "@/components/cozzo-canary";
import { PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { DIMENSIONS, PASS_AT, REVIEW_AT } from "@/lib/rubric";
import { SCENARIOS } from "@/lib/samples";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <PageShell className="py-14 sm:py-20">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
        <CozzoCanary pose="wave" size={120} label="Cozzo the Canary waving hello" />
        <div className="grid gap-1 pb-1">
          <p className="font-heading text-lg font-semibold">Hi, I’m Cozzo the Canary.</p>
          <p className="measure text-base leading-relaxed text-muted-foreground">
            A canary in the coal mine for voice agents.
          </p>
        </div>
      </div>
      <h1 className="mt-8 max-w-[22ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.1]">
        Did the agent do the job, or make it up?
      </h1>
      <p className="measure mt-5 text-lg leading-relaxed text-muted-foreground">
        Pick a call, or paste one. Judge it against the script the business approved. Then read the score.
      </p>
      <ol className="mt-8 grid gap-4 text-base xl:grid-cols-3" aria-label="How a score works">
        <li className="surface-card flex gap-4">
          <span className="font-medium">1</span>
          <span>Pick a call, or paste a transcript and the script.</span>
        </li>
        <li className="surface-card flex gap-4">
          <span className="font-medium">2</span>
          <span>Judge it.</span>
        </li>
        <li className="surface-card flex gap-4">
          <span className="font-medium">3</span>
          <span>Read the score, the verdict, and the main issues. Fix the prompt if you want a rewrite.</span>
        </li>
      </ol>
      <div className="mt-10">
        <Link href="/score?sample=dental" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}>
          Judge a call
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Powered by NVIDIA Nemotron on Nebius</p>

      <div className="mt-12 grid gap-4">
        <p className="text-sm font-medium">Start from a sample</p>
        <div className="grid gap-4 xl:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <Link key={scenario.id} href={`/score?sample=${scenario.id}`} className="surface-card block">
              <span className="block font-medium">{scenario.industry}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{scenario.summary}</span>
            </Link>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Synthetic examples. Not real callers.</p>
      </div>

      <details className="mt-12 border-t border-border pt-6">
        <summary className="cursor-pointer text-base font-medium">How scoring works</summary>
        <div className="mt-5 grid gap-4">
          <p className="measure text-sm leading-relaxed text-muted-foreground">
            {PASS_AT} and above passes. {REVIEW_AT} to {PASS_AT - 1} needs a person to look. Any serious miss fails the
            call. Live scores use NVIDIA Nemotron on Nebius: a fast read, then the score, and a second opinion only if
            you ask.
          </p>
          <ol className="grid gap-4 xl:grid-cols-2">
            {DIMENSIONS.map((dimension) => (
              <li key={dimension.id} className="surface-card">
                <p className="font-medium">
                  {dimension.name}
                  <span className="ml-2 font-normal text-muted-foreground">{dimension.weightPercent}%</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{dimension.highMeans}</p>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </PageShell>
  );
}
