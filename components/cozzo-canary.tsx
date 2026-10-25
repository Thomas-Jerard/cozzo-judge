const POSES = {
  wave: "/brand/canary-wave.svg",
  idle: "/brand/canary-idle.svg",
  think: "/brand/canary-think.svg",
  peek: "/brand/canary-peek.svg",
} as const;

export type CanaryPose = keyof typeof POSES;
export type CanaryAccent = "pass" | "review" | "fail";

const ACCENT: Record<CanaryAccent, string> = {
  pass: "bg-[rgba(4,120,87,0.12)] shadow-[0_0_0_6px_rgba(4,120,87,0.38)]",
  review: "bg-[rgba(255,201,39,0.24)] shadow-[0_0_0_6px_#ffc927]",
  fail: "bg-[rgba(255,179,138,0.35)] shadow-[0_0_0_6px_rgba(190,18,60,0.45)]",
};

export function CozzoCanary({
  pose = "idle",
  size = 96,
  label,
  accent,
}: {
  pose?: CanaryPose;
  size?: number;
  label: string;
  accent?: CanaryAccent;
}) {
  const image = (
    // The artwork is the canary published on cozzo.io. Next/Image does not serve these SVGs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={POSES[pose]}
      width={size}
      height={pose === "peek" ? Math.round(size * (38 / 72)) : size}
      alt={accent ? "" : label}
      className="canary-bob h-auto max-w-full"
    />
  );

  if (!accent) return image;

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 rounded-full p-1 ${ACCENT[accent]}`}
    >
      {image}
    </span>
  );
}
