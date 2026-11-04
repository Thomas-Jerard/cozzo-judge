import Link from "next/link";
import { ArrowRight, ClipboardList, Gauge, Scale, Snowflake, Sparkles, Stethoscope } from "lucide-react";
import { CozzoCanary } from "@/components/cozzo-canary";
import { PageShell } from "@/components/page-shell";
import { ScoreRing } from "@/components/score-ring";
import { buttonVariants } from "@/components/ui/button";
import { DIMENSIONS, PASS_AT, REVIEW_AT } from "@/lib/rubric";
import { SCENARIOS } from "@/lib/samples";
import { cn } from "@/lib/utils";

const SAMPLE_ICON = { dental: Stethoscope, hvac: Snowflake, medspa: Sparkles } as const;

// Numbers below are the saved HVAC sample run (Northwind Comfort, Northline Voice) that ships with the app.
const PREVIEW = {
  score: 96,
  label: "Northwind Comfort · Northline Voice",
  checks: [
    { name: "Task", earned: 29, of: 30 },
    { name: "Facts", earned: 24, of: 25 },
    { name: "Handoff", earned: 20, of: 20 },
    { name: "Hallucination", earned: 15, of: 15 },
    { name: "Tone", earned: 9, of: 10 },
  ],
};

const HOW = [
  { Icon: ClipboardList, title: "Pick a call", body: "Pick a call, or paste a transcript and the script." },
  { Icon: Scale, title: "Judge it", body: "Judge it." },
  {
    Icon: Gauge,
    title: "Read the score",
    body: "Read the score, the verdict, and the main issues. Fix the prompt if you want a rewrite.",
  },
];

export default function HomePage() {
  return (
    <PageShell className="py-12 sm:py-16">
      <section className="hero">
        <div className="grid gap-6">
          <div className="flex items-center gap-4">
            <CozzoCanary pose="wave" size={84} label="Cozzo the Canary waving hello" />
            <div className="grid gap-1">
              <p className="font-heading text-lg font-semibold">Hi, I’m Cozzo the Canary.</p>
              <p className="text-base leading-relaxed text-muted-foreground">A canary in the coal mine for voice agents.</p>
            </div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
            Did the agent do the job, <span className="grad-text">or make it up?</span>
          </h1>
          <p className="measure text-lg leading-relaxed text-muted-foreground">
            Paste your own call, or start from a sample. Judge it against the script the business approved. Then read the
            score.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/score?own=1"
              className={cn(buttonVariants({ size: "lg" }), "btn-glow h-12 px-6 text-base text-white")}
            >
              Test your own call
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/score?sample=dental"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6 text-base")}
            >
              Judge a call
            </Link>
          </div>
          <p className="eyebrow w-fit">Powered by NVIDIA Nemotron on Nebius</p>
        </div>

        <Link
          href="/score?sample=hvac"
          className="glow-card rise rise-2 grid gap-5 isolate"
          aria-label="Open the HVAC sample score"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{PREVIEW.label}</p>
            <span className="rounded-full bg-[var(--pass)] px-3 py-1 text-sm font-semibold text-[var(--background)]">
              Pass
            </span>
          </div>
          <div className="flex items-center gap-5">
            <ScoreRing score={PREVIEW.score} tone="var(--pass)" size={132} caption="Saved sample run" />
            <ul className="grid flex-1 gap-2.5">
              {PREVIEW.checks.map((check) => (
                <li key={check.name} className="grid gap-1">
                  <span className="flex justify-between text-xs">
                    <span className="font-medium">{check.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {check.earned} / {check.of}
                    </span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-[var(--pass)]"
                      style={{ width: `${Math.round((check.earned / check.of) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <span className="sample-cta">
            See this score <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      </section>

      <section className="mt-16 grid gap-5" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-semibold tracking-tight">
          How a score works
        </h2>
        <ol className="stepper">
          {HOW.map(({ Icon, title, body }, index) => (
            <li key={title} className={`stepper-item rise rise-${index + 2}`}>
              <span className="stepper-icon">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="grid gap-1">
                <span className="stepper-num">Step {index + 1}</span>
                <span className="font-semibold">{title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-5" aria-labelledby="samples-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="samples-title" className="text-2xl font-semibold tracking-tight">
            Start from a sample
          </h2>
          <p className="text-sm text-muted-foreground">Synthetic examples. Not real callers.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((scenario) => {
            const Icon = SAMPLE_ICON[scenario.id];
            return (
              <Link key={scenario.id} href={`/score?sample=${scenario.id}`} className="sample-card">
                <span className="sample-icon">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="block font-semibold">{scenario.industry}</span>
                <span className="block text-sm leading-relaxed text-muted-foreground">{scenario.summary}</span>
                <span className="sample-cta mt-1">
                  Judge this call <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <details className="panel mt-16">
        <summary className="cursor-pointer text-base font-semibold">How scoring works</summary>
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
