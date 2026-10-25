"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CallResult } from "@/components/call-result";
import { CozzoCanary } from "@/components/cozzo-canary";
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
      <div className="mx-auto grid max-w-xl justify-items-start gap-4 px-5 py-16">
        <CozzoCanary pose="peek" size={88} label="Cozzo the Canary waiting for a scorecard" />
        <h1 className="text-3xl font-semibold tracking-tight">No scorecard in this link</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Score a call, then choose Copy link. The card is stored in the URL itself, so there is no account and no database.
        </p>
        <Link href="/score?sample=dental" className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
          Judge a call
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
    return (
      <div className="grid justify-items-start gap-3 px-5 py-16">
        <CozzoCanary pose="think" size={88} label="Cozzo the Canary opening the scorecard" />
        <p className="text-sm text-muted-foreground">Cozzo is opening the scorecard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <CallResult
        card={card.scorecard}
        bench={card.bench}
        appeal={card.appeal}
        beforeScore={card.repair?.before}
        repair={
          card.repair
            ? {
                prompt: card.repair.prompt,
                changes: card.repair.changes,
                transcript: "",
                note: card.repair.note,
              }
            : null
        }
      />
    </div>
  );
}
