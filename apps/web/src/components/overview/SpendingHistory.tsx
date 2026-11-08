import { VisualTitle } from "../common/VisualTitle";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { money, spendingHistory, type Snapshot } from "@finance/shared";
import { Card } from "../common/primitives";

export function SpendingHistory({
  data,
  owner,
}: {
  data: Snapshot;
  owner: string;
}) {
  const months = spendingHistory(data, owner);
  const total = months.reduce((sum, m) => sum + m.spentCents, 0);
  const max = Math.max(1, ...months.map((m) => Math.abs(m.spentCents)));
  const scope =
    owner === "all"
      ? "Whole household"
      : owner === "household"
        ? "Shared only"
        : (data.people.find((p) => p.id === owner)?.name ?? "Selected person");
  const link = (from: string, to: string) =>
    `/expenses?${new URLSearchParams({ from, to, ...(owner !== "all" ? { owner } : {}) })}`;
  return (
    <Card>
      <VisualTitle
        title="Past spending"
        context={`${scope} · last six complete months. Expenses less refunds; transfers and income are excluded. Totals reflect imported and recorded transactions, so months with missing history may be incomplete.`}
        action={
          <Link
            to={link(months[0]!.from, months.at(-1)!.to)}
            className="text-xs text-primary"
          >
            Explore expenses
          </Link>
        }
      />
      <p className="text-2xl font-semibold tabular-nums">{money(total)}</p>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        {money(Math.round(total / 6))} monthly average · last six complete
        months
      </p>
      <div className="grid gap-1">
        {months.map((m) => (
          <Link
            key={m.from}
            to={link(m.from, m.to)}
            className="rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="mb-1.5 flex items-center gap-2 text-xs">
              <span className="flex-1">
                {new Intl.DateTimeFormat("en-AU", {
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(m.from + "T00:00:00Z"))}
              </span>
              <span className="font-medium tabular-nums">
                {m.count ? money(m.spentCents) : "No spending recorded"}
              </span>
              <ChevronRight size={13} className="text-muted-foreground" />
            </div>
            <div className="h-1 rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${(Math.abs(m.spentCents) / max) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
