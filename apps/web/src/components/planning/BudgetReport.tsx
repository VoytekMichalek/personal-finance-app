import { useSearchParams, Link } from "react-router-dom";
import { useState } from "react";
import {
  budgetReport,
  categoryLabel,
  displayDate,
  monthSchema,
  money,
  type Snapshot,
} from "@finance/shared";
import { Card, Empty } from "../common/primitives";
import { VisualTitle } from "../common/VisualTitle";
import { MonthPicker } from "../ui/month-picker";
import { Button } from "../ui/button";
import { BudgetTrend } from "./BudgetTrend";
import { BudgetReportRows } from "./BudgetReportRows";

export function BudgetReport({ data }: { data: Snapshot }) {
  const [params, setParams] = useSearchParams();
  const month =
    monthSchema.safeParse(params.get("month")).data ?? data.today.slice(0, 7);
  const setMonth = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("month", value);
        return next;
      },
      { replace: true },
    );
  const [filter, setFilter] = useState("all");
  const report = budgetReport(data, month);
  const name = (id: string) => {
    const category = data.categories.find((item) => item.id === id);
    return category
      ? categoryLabel(category, data.categories)
      : "Uncategorised";
  };
  const rows = report.rows
    .filter(
      (row) =>
        filter === "all" ||
        (filter === "unbudgeted"
          ? row.budgetCents === null
          : row.varianceCents !== null && row.varianceCents < 0),
    )
    .sort(
      (a, b) =>
        (a.availableCents ?? -a.actualCents - a.upcomingCents) -
          (b.availableCents ?? -b.actualCents - b.upcomingCents) ||
        name(a.categoryId).localeCompare(name(b.categoryId)),
    );
  const period =
    month > data.today.slice(0, 7)
      ? "Future plan · no recorded actuals yet"
      : report.to <= data.today
        ? "Completed calendar month"
        : `Month to date through ${displayDate(data.today)}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Budget vs actual
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {period} · Whole household
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MonthPicker
            aria-label="Report month"
            value={month}
            onChange={setMonth}
            className="w-52"
          />
          <Button asChild variant="secondary">
            <Link to={`/plan?tab=budgets&month=${month}`}>Edit budgets</Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Budget", report.budgetCents, "Includes this month's overrides"],
          [
            "Actual spending",
            report.actualCents,
            "Recorded expenses, less refunds",
          ],
          [
            "Upcoming bills",
            report.upcomingCents,
            "Scheduled, not yet recorded",
          ],
          [
            "Available after bills",
            report.availableCents,
            "Budget − actual − upcoming bills",
          ],
        ].map(([label, value, caption]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`mt-3 text-xl font-semibold sm:text-2xl tabular-nums ${Number(value) < 0 ? "text-rose-700" : ""}`}
            >
              {money(Number(value))}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p>
          </Card>
        ))}
      </div>
      <BudgetTrend data={data} month={month} onMonth={setMonth} />
      <Card className="min-w-0">
        <VisualTitle
          title="Category performance"
          context="Actual spending includes refunds and excludes transfers. Used + bills shows actual spending plus upcoming bills as a percentage of the budget, on a fixed 0–150% scale with a 100% marker. Green is within budget; red is over. Variance is budget minus actual. Available after bills also subtracts unmatched scheduled bills in this category. Each category, including subcategories, has its own allowance."
          action={
            <div
              role="group"
              aria-label="Budget report filter"
              className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1"
            >
              {[
                ["all", "All categories"],
                ["over", `Over budget (${report.overBudgetCount})`],
                ["unbudgeted", "Unbudgeted"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "default" : "ghost"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value!)}
                >
                  {label}
                </Button>
              ))}
            </div>
          }
        />
        {rows.length ? (
          <BudgetReportRows
            rows={rows}
            data={data}
            month={month}
            through={report.through}
          />
        ) : (
          <Empty
            title={
              filter === "all"
                ? "No activity or budgets this month"
                : "No matching categories"
            }
            description="Choose another month, or show all categories."
            action={
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Show all categories
              </Button>
            }
          />
        )}
        <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
          {money(report.unbudgetedCents)} of recorded spending has no budget.
          Totals include unbudgeted categories. Recurring bills consume their
          category's allowance; they are not added on top of the budget.
          Negative available amounts show a shortfall.
        </p>
      </Card>
    </div>
  );
}
