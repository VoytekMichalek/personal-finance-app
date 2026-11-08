import { Check } from "lucide-react";
export function ImportProgress({
  label,
  steps,
  current,
}: {
  label: string;
  steps: string[];
  current: number;
}) {
  return (
    <ol aria-label={label} className="mb-7 grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const n = index + 1,
          completed = n < current,
          active = n === current;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${active ? "border-primary/30 bg-blue-50 font-semibold text-primary" : completed ? "border-emerald-100 bg-emerald-50/40 text-emerald-800" : "bg-white text-muted-foreground"}`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-white">
              {completed ? <Check size={15} /> : n}
            </span>
            <span>
              {step}
              <span className="sr-only">
                {completed
                  ? ", completed"
                  : active
                    ? ", current"
                    : ", upcoming"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
