import { money, type BudgetReportRow } from "@finance/shared";

export function BudgetUsage({ row }: { row: BudgetReportRow }) {
  const committed = row.actualCents + row.upcomingCents;
  const over = row.budgetCents !== null && committed > row.budgetCents;
  const tone = over ? "text-rose-700" : "text-emerald-700";
  const percentage = row.budgetCents ? (committed / row.budgetCents) * 100 : 0;
  const label = `${new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 1,
  }).format(percentage)}%`;
  return (
    <div className="w-full max-w-56">
      <p className="mb-1 text-[11px] text-muted-foreground xl:hidden">
        Used + bills · 150% max
      </p>
      {row.budgetCents === null ? (
        <span
          className="text-sm text-muted-foreground"
          aria-label="No budget percentage available"
        >
          —
        </span>
      ) : row.budgetCents === 0 && committed > 0 ? (
        <span className="text-xs font-medium text-rose-700">
          Over budget · no allowance
        </span>
      ) : (
        <div className="flex items-center gap-3 pt-4">
          <div
            role="meter"
            aria-label="Budget used including upcoming bills"
            aria-valuemin={0}
            aria-valuemax={150}
            aria-valuenow={Math.min(150, Math.max(0, percentage))}
            aria-valuetext={`${label} used including upcoming bills; ${money(committed)} of ${money(row.budgetCents)}. ${over ? "Over budget" : "Within budget"}.`}
            className="relative h-2 min-w-0 flex-1 rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full ${over ? "bg-rose-600" : "bg-emerald-600"}`}
              style={{
                width: `${Math.min(150, Math.max(0, percentage)) / 1.5}%`,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute -top-0.5 h-3 w-px bg-foreground/60"
              style={{ left: `${100 / 1.5}%` }}
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
                100%
              </span>
            </span>
          </div>
          <span
            className={`w-12 shrink-0 text-right text-xs font-medium tabular-nums ${tone}`}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
