import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { forecast, money } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button, cn } from "../components/ui/button";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
  SectionTitle,
  Pill,
} from "../components/common/primitives";
import { BalanceChart } from "../components/common/Chart";
import { Budgets } from "../components/planning/Budgets";
import { Bills } from "../components/planning/Bills";
export function Plan() {
  const query = useSnapshot();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "budgets";
  const [days, setDays] = useState(90);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const points = forecast(data, days);
  const end = points.at(-1)!;
  const minimum = Math.min(...points.map((p) => p.balanceCents));
  return (
    <>
      <PageHeading
        eyebrow="A little intention"
        title="Make room for tomorrow."
        description="A spending plan, a clear calendar and a useful look ahead."
      />
      <div className="mb-7 flex w-fit max-w-full gap-1 overflow-auto rounded-xl border bg-[#efefed] p-1">
        {[
          ["budgets", "Budgets"],
          ["bills", "Bills & income"],
          ["subscriptions", "Subscriptions"],
          ["forecast", "Forecast"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setParams({ tab: id! })}
            className={cn(
              "min-h-10 rounded-lg px-4 text-xs font-medium whitespace-nowrap",
              tab === id
                ? "bg-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "budgets" ? (
        <Budgets data={data} />
      ) : tab === "bills" ? (
        <Bills data={data} />
      ) : tab === "subscriptions" ? (
        <Bills data={data} subscriptions />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {[30, 90, 180, 365].map((value) => (
              <Button
                key={value}
                variant={days === value ? "default" : "secondary"}
                size="sm"
                onClick={() => setDays(value)}
              >
                {value} days
              </Button>
            ))}
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Starting balance", points[0]!.balanceCents],
              ["Projected balance", end.balanceCents],
              ["Lowest projected balance", minimum],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {money(Number(value))}
                </p>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle
              action={
                <Pill tone={minimum < 0 ? "warning" : "positive"}>
                  {minimum < 0 ? "Review upcoming spending" : "Looking ahead"}
                </Pill>
              }
            >
              Your next {days} days
            </SectionTitle>
            <BalanceChart
              points={points.filter(
                (_, i) =>
                  i % Math.max(1, Math.floor(days / 60)) === 0 || i === days,
              )}
              label={
                "Projected balance starts at " +
                money(points[0]!.balanceCents) +
                " and ends at " +
                money(end.balanceCents) +
                ". Lowest balance " +
                money(minimum) +
                "."
              }
            />
          </Card>
          <Card className="mt-6">
            <SectionTitle>What goes into this picture</SectionTitle>
            <ul className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <li>
                Starting funds are bank and cash balances, less outstanding
                credit-card balances.
              </li>
              <li>
                Unrecorded occurrences due today are included on the next day.
                Upcoming income, bills and subscriptions come from your active
                schedules. Matched occurrences are already included in your
                ledger.
              </li>
              <li>
                Monthly budget allowances are reduced by actual spending and
                scheduled category expenses, then spread evenly across the
                remaining days.
              </li>
              <li>
                Transfers and credit-card repayments move money without counting
                spending twice. Assets such as property and superannuation are
                excluded from available funds.
              </li>
            </ul>
            <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">
              This is an estimate based on your records. Unbudgeted, unscheduled
              future expenses are not included.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
