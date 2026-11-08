import { CategoryIcon } from "../common/VisualIcon";
import { Link } from "react-router-dom";
import { BudgetUsage } from "./BudgetUsage";
import {
  categoryLabel,
  money,
  type BudgetReportRow,
  type Snapshot,
} from "@finance/shared";

export function BudgetReportRows({
  rows,
  data,
  month,
  through,
}: {
  rows: BudgetReportRow[];
  data: Snapshot;
  month: string;
  through: string;
}) {
  return (
    <div
      className="divide-y"
      role="list"
      aria-label="Category budget performance"
    >
      <div
        className="hidden grid-cols-[minmax(8rem,1.3fr)_12rem_repeat(5,minmax(4.5rem,1fr))] items-end gap-3 pb-3 text-right text-xs text-muted-foreground xl:grid [&>span+span]:border-l [&>span+span]:border-border/40 [&>span+span]:pl-3"
        aria-hidden="true"
      >
        <span className="text-left">Category</span>
        <span className="text-left">
          Used + bills <span className="block text-xs">150% max</span>
        </span>
        <span>Budget</span>
        <span>Actual</span>
        <span>Under / over</span>
        <span>Upcoming bills</span>
        <span>After bills</span>
      </div>
      {rows.map((row) => {
        const category = data.categories.find(
          (item) => item.id === row.categoryId,
        );
        const name = category
          ? categoryLabel(category, data.categories)
          : "Uncategorised";
        const available = row.availableCents;
        const url = `/transactions?category=${row.categoryId === "uncategorised" ? "none" : row.categoryId}&kind=expense&from=${month}-01&to=${through < month + "-01" ? month + "-01" : through}`;
        return (
          <div
            key={row.categoryId}
            role="listitem"
            aria-label={`${name} budget performance`}
            className="py-4"
          >
            <div className="grid items-center gap-4 xl:grid-cols-[minmax(8rem,1.3fr)_12rem_repeat(5,minmax(4.5rem,1fr))] xl:gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CategoryIcon
                    category={category}
                    categories={data.categories}
                    small
                  />
                  {name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.budgetCents === null
                    ? "No budget set"
                    : row.overridden
                      ? "Monthly override"
                      : "Planned allowance"}
                </p>
              </div>
              <div className="xl:flex xl:self-stretch xl:items-center xl:border-l xl:border-border/40 xl:pl-3">
                <BudgetUsage row={row} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm tabular-nums sm:grid-cols-5 xl:contents xl:[&>div]:flex xl:[&>div]:self-stretch xl:[&>div]:flex-col xl:[&>div]:justify-center xl:[&>div]:border-l xl:[&>div]:border-border/40 xl:[&>div]:pl-3">
                <div className="xl:text-right">
                  <dt className="text-xs text-muted-foreground xl:sr-only">
                    Budget
                  </dt>
                  <dd>
                    {row.budgetCents === null ? "—" : money(row.budgetCents)}
                  </dd>
                </div>
                <div className="xl:text-right">
                  <dt className="text-xs text-muted-foreground xl:sr-only">
                    Actual
                  </dt>
                  <dd>
                    <Link
                      aria-label={`View ${name} actual transactions`}
                      className="text-primary underline underline-offset-4"
                      to={url}
                    >
                      {money(row.actualCents)}
                    </Link>
                  </dd>
                </div>
                <div className="xl:text-right">
                  <dt className="text-xs text-muted-foreground xl:sr-only">
                    Under / over
                  </dt>
                  <dd
                    className={
                      row.varianceCents !== null && row.varianceCents < 0
                        ? "text-rose-700"
                        : "text-emerald-700"
                    }
                  >
                    {row.varianceCents === null
                      ? "—"
                      : `${money(Math.abs(row.varianceCents))} ${row.varianceCents < 0 ? "over" : "under"}`}
                  </dd>
                </div>
                <div className="xl:text-right">
                  <dt className="text-xs text-muted-foreground xl:sr-only">
                    Upcoming bills
                  </dt>
                  <dd>{money(row.upcomingCents)}</dd>
                </div>
                <div className="xl:text-right">
                  <dt className="text-xs text-muted-foreground xl:sr-only">
                    After bills
                  </dt>
                  <dd
                    className={
                      available !== null && available < 0
                        ? "font-medium text-rose-700"
                        : ""
                    }
                  >
                    {available === null ? "—" : money(available)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        );
      })}
    </div>
  );
}
