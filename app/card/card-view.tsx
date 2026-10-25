"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppealPanel, BenchPanel } from "@/components/bench-panel";
import { ScorecardView } from "@/components/scorecard-view";
import { decodeCardHash, type SharedCard } from "@/lib/share";

export function CardView() {
  const [card, setCard] = useState<SharedCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      queueMicrotask(() => setError("empty"));
      return;
    }
    let cancelled = false;
    decodeCardHash(hash)
      .then((next) => {
        if (!cancelled) setCard(next);
      })
      .catch(() => {
        if (!cancelled) setError("bad");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error === "empty") {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">No scorecard in this link</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Score a call, then choose Copy link. The card is stored in the URL itself, so there is no account and no database.
        </p>
        <Link href="/score?sample=dental" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Score the dental sample
        </Link>
      </div>
    );
  }

  if (error === "bad") {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">This scorecard link could not be read</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The hash is missing a piece or it was edited. Score the call again and copy a new link.
        </p>
      </div>
    );
  }

  if (!card) {
    return <p className="px-5 py-16 text-sm text-muted-foreground">Opening the scorecard…</p>;
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-10">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Shared scorecard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{card.scorecard.call.label || "Call"}</h1>
      </div>
      {card.bench ? <BenchPanel bench={card.bench} verdict={card.scorecard.verdict} /> : null}
      {card.appeal ? (
        <AppealPanel
          appeal={{
            ...card.appeal,
            provider: card.appeal.provider,
          }}
        />
      ) : null}
      {card.repair ? (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Revised agent lines</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {card.repair.before} <span className="text-muted-foreground">→</span> {card.repair.after}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.repair.note}</p>
          <p className="mt-3 text-sm leading-relaxed">{card.repair.prompt}</p>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {card.repair.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <ScorecardView card={card.scorecard} />
    </div>
  );
}
