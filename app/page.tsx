import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DIMENSIONS, PASS_AT, REVIEW_AT } from "@/lib/rubric";
import { SCENARIOS } from "@/lib/samples";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
      <section className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
          For buyers comparing voice agents
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl sm:leading-[1.05]">
          Did the agent do the job, or make it up?
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A buyer comparing voice agents can paste the call and the script the business approved. The scorecard shows
          whether the agent booked the job, stayed on script, or invented a price.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="How the models split the work">
          <li className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Nano</p>
            <p className="mt-2 text-sm leading-relaxed">A fast risk line, before the score. High or low, with the time it took.</p>
          </li>
          <li className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Super</p>
            <p className="mt-2 text-sm leading-relaxed">The rubric score: task, facts, handoff, tone, and made-up answers.</p>
          </li>
          <li className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Ultra</p>
            <p className="mt-2 text-sm leading-relaxed">An appeal when you ask. The rubric number stays where Super put it.</p>
          </li>
        </ol>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          If the call fails, Fix the prompt rewrites the agent lines, keeps the caller’s words, and scores that rewrite.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/score?sample=dental" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
            Score the dental sample
          </Link>
          <Link
            href="/compare?sample=dental"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
          >
            Compare two agents
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Three synthetic calls load with the app. Without a Nebius key, the mock judge still returns a scorecard.
        </p>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="Synthetic samples">
        {SCENARIOS.map((scenario) => (
          <article key={scenario.id} className="flex flex-col rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{scenario.industry}</p>
            <h2 className="mt-2 text-lg font-semibold">{scenario.business}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{scenario.summary}</p>
            <p className="mt-4 text-xs text-muted-foreground">Synthetic example. Not a real caller.</p>
            <div className="mt-4 flex gap-4 text-sm font-medium">
              <Link href={`/score?sample=${scenario.id}`} className="text-primary hover:underline">
                Score
              </Link>
              <Link href={`/compare?sample=${scenario.id}`} className="text-primary hover:underline">
                Compare
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-20" aria-labelledby="rubric-heading">
        <h2 id="rubric-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          The same five questions, every call
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Weights live in one module so a later Voice Agent Evaluator bot can score with the same rules. {PASS_AT} and
          above passes. {REVIEW_AT} to {PASS_AT - 1} needs a person. Any critical flag fails the call.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {DIMENSIONS.map((dimension, index) => (
            <li key={dimension.id} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <p className="text-xs font-medium text-primary">
                {String(index + 1).padStart(2, "0")} · {dimension.weightPercent}%
              </p>
              <h3 className="mt-2 font-semibold">{dimension.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dimension.highMeans}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 grid gap-6 rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">1 · The call</p>
          <h2 className="mt-2 font-semibold">Transcript in, script beside it</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Plain speaker labels, or an audio-transcript JSON with timestamps. Upload a .txt, .json, or .vtt.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">2 · The model</p>
          <h2 className="mt-2 font-semibold">Nano, then Super, then Ultra</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Live scores call those NVIDIA Nemotron models on Nebius Token Factory. The key stays on the server. A quote
            that is not in the transcript is marked, not trusted.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">3 · The card</p>
          <h2 className="mt-2 font-semibold">A number, and the quote</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every dimension keeps the line it used. Quotes that are not in the transcript are marked, not trusted.
          </p>
        </div>
      </section>
    </div>
  );
}
