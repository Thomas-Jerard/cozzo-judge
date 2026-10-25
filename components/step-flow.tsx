import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Pick a call" },
  { n: 2, label: "Judge it" },
  { n: 3, label: "See the result" },
] as const;

export function StepFlow({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5" aria-label="Steps">
      {STEPS.map((item) => {
        const state = item.n === step ? "current" : item.n < step ? "done" : "upcoming";
        return (
          <li
            key={item.n}
            className="flex items-center gap-3"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                state === "current" && "bg-primary text-primary-foreground",
                state === "done" && "bg-foreground text-background",
                state === "upcoming" && "bg-muted text-muted-foreground",
              )}
            >
              {item.n}
            </span>
            <span className={cn("text-sm", state === "current" ? "font-medium" : "text-muted-foreground")}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
