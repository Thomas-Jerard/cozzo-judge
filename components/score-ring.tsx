"use client";

import { useEffect, useState, type CSSProperties } from "react";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({
  score,
  tone,
  ink,
  size = 176,
  caption,
}: {
  score: number;
  tone: string;
  /** Digit color. The arc stays `tone`, so a yellow review ring can keep dark digits. */
  ink?: string;
  size?: number;
  caption?: string;
}) {
  const safe = clampScore(score);
  const shown = useCountUp(safe);
  const offset = CIRCUMFERENCE * (1 - shown / 100);

  return (
    <figure className="grid justify-items-center gap-2">
      <div className="score-ring-slot relative" style={{ "--ring": `${size}px` } as CSSProperties}>
        <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="score-arc"
          />
        </svg>
        <p
          className="score-ring-num absolute inset-0 grid place-items-center font-semibold tabular-nums tracking-tight"
          style={{ color: ink ?? tone }}
          aria-hidden="true"
        >
          {shown}
        </p>
        <p className="sr-only">
          {caption ? `${caption} ` : ""}
          {safe} out of 100
        </p>
      </div>
      {caption ? <figcaption className="text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

function useCountUp(score: number): number {
  const [shown, setShown] = useState(score);

  useEffect(() => {
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setShown(score));
      return () => cancelAnimationFrame(frame);
    }
    frame = requestAnimationFrame(() => {
      setShown(0);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 900);
        const eased = 1 - (1 - t) ** 3;
        setShown(Math.round(score * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return shown;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
