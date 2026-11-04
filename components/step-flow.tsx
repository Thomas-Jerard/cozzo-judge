import { Check, ClipboardList, Gauge, Scale } from "lucide-react";
import { Fragment } from "react";

const STEPS = [
  { n: 1, label: "Pick a call", Icon: ClipboardList },
  { n: 2, label: "Judge it", Icon: Scale },
  { n: 3, label: "See the result", Icon: Gauge },
] as const;

export function StepFlow({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flow" aria-label="Steps">
      {STEPS.map((item, index) => {
        const state = item.n === step ? "current" : item.n < step ? "done" : "upcoming";
        const Icon = state === "done" ? Check : item.Icon;
        return (
          <Fragment key={item.n}>
            {index > 0 ? <li aria-hidden="true" className="flow-line" data-done={item.n <= step} /> : null}
            <li className="flow-item" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="flow-dot">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span
                className={
                  state === "current"
                    ? "text-sm font-semibold"
                    : "hidden text-sm text-muted-foreground sm:inline"
                }
              >
                <span className="sr-only">Step {item.n}: </span>
                {item.label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
