import { ChartViewTabs } from "./ChartViewTabs";
import { useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  categoryColour,
  categoryLabel,
  displayDate,
  expenseCategoryTrend,
  identityColour,
  money,
  type ExpenseCategoryPoint,
  type ExpenseInterval,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";

export function ExpenseCategoryChart({
  rows,
  data,
  from,
  to,
}: {
  rows: Transaction[];
  data: Snapshot;
  from: string;
  to: string;
}) {
  const viewId = useId();
  const [view, setView] = useState<"graph" | "table">("graph");
  const [interval, setInterval] = useState<ExpenseInterval>("month");
  const { categoryIds, points } = useMemo(
    () => expenseCategoryTrend(rows, from, to, interval),
    [rows, from, to, interval],
  );
  const series = categoryIds.map((id) => {
    const category = data.categories.find((item) => item.id === id);
    return {
      id,
      name: category
        ? categoryLabel(category, data.categories)
        : "Uncategorised",
      colour: category
        ? categoryColour(category, data.categories)
        : identityColour("category:none"),
    };
  });
  const period = (date: string) =>
    new Intl.DateTimeFormat("en-AU", {
      ...(interval === "month"
        ? ({ month: "short", year: "numeric" } as const)
        : ({ day: "numeric", month: "short" } as const)),
      timeZone: "UTC",
    }).format(new Date(date + "T00:00:00Z"));
  const range = (point: ExpenseCategoryPoint) =>
    point.from === point.to
      ? displayDate(point.from)
      : `${displayDate(point.from)} – ${displayDate(point.to)}`;

  return (
    <Card className="mb-5 min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Expenses over time</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Stacked by category · refunds deducted
            {interval === "week" ? " · weeks start Monday" : ""}
          </p>
        </div>
        <div
          role="group"
          aria-label="Chart interval"
          className="flex gap-1 rounded-xl bg-muted/60 p-1"
        >
          {(["month", "week", "day"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={interval === value ? "default" : "ghost"}
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <ChartViewTabs id={viewId} value={view} onChange={setView} />
      </div>
      {!rows.length ? (
        <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No expenses in this selection.
        </p>
      ) : (
        <>
          <div
            role="tabpanel"
            id={`${viewId}-panel-graph`}
            aria-labelledby={`${viewId}-tab-graph`}
            hidden={view !== "graph"}
          >
            {view === "graph" && (
              <>
                <div
                  key={interval + from + to}
                  role="region"
                  aria-label={`Expenses by category and ${interval}`}
                  tabIndex={0}
                  className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div
                    className="h-64 w-full"
                    style={{ minWidth: Math.max(280, points.length * 32) }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={points}
                        stackOffset="sign"
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="#e8ebef"
                          strokeDasharray="3 3"
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={period}
                          interval="preserveStartEnd"
                          minTickGap={32}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          width={64}
                          tickFormatter={(value) => money(Number(value), true)}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Tooltip
                          cursor={{ fill: "#94a3b815" }}
                          content={({ active, label }) => {
                            const point = points.find(
                              (item) => item.date === label,
                            );
                            if (!active || !point) return null;
                            return (
                              <div className="max-h-64 max-w-72 overflow-y-auto rounded-xl border bg-white p-3 text-xs shadow-md">
                                <p className="mb-2 font-medium">
                                  {range(point)}
                                </p>
                                {series.map(
                                  (item, index) =>
                                    point.amounts[index] !== 0 && (
                                      <div
                                        key={item.id}
                                        className="flex items-start justify-between gap-4 py-1"
                                      >
                                        <span className="flex min-w-0 items-center gap-2">
                                          <span
                                            className="h-2 w-2 shrink-0 rounded-sm"
                                            style={{ background: item.colour }}
                                          />
                                          {item.name}
                                        </span>
                                        <span className="shrink-0 tabular-nums">
                                          {money(point.amounts[index] ?? 0)}
                                        </span>
                                      </div>
                                    ),
                                )}
                                <div className="mt-2 flex justify-between gap-4 border-t pt-2 font-semibold">
                                  <span>Net expenses</span>
                                  <span>{money(point.amountCents)}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        {series.map((item, index) => (
                          <Bar
                            key={item.id}
                            name={item.name}
                            dataKey={(point: ExpenseCategoryPoint) =>
                              point.amounts[index]
                            }
                            stackId="expenses"
                            fill={item.colour}
                            maxBarSize={44}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {points.length > 8 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scroll the chart horizontally to see more periods.
                  </p>
                )}
                <ul
                  aria-label="Chart categories"
                  className="mt-4 grid max-h-40 grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-2 overflow-y-auto text-xs text-muted-foreground"
                >
                  {series.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <span
                        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: item.colour }}
                      />
                      <span className="min-w-0 leading-4 [overflow-wrap:anywhere]">
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div
            role="tabpanel"
            id={`${viewId}-panel-table`}
            aria-labelledby={`${viewId}-tab-table`}
            hidden={view !== "table"}
            className="text-xs text-muted-foreground"
          >
            <div
              className="max-h-64 overflow-auto"
              tabIndex={0}
              role="region"
              aria-label="Chart values"
            >
              <table className="w-full text-left">
                <caption className="sr-only">
                  Expenses by category and {interval}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-4">
                      Period
                    </th>
                    {series.map((item) => (
                      <th key={item.id} scope="col" className="px-3 text-right">
                        {item.name}
                      </th>
                    ))}
                    <th scope="col" className="px-3 text-right">
                      Net expenses
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.date} className="border-t">
                      <th
                        scope="row"
                        className="py-2 pr-4 font-normal whitespace-nowrap"
                      >
                        {range(point)}
                      </th>
                      {point.amounts.map((amount, index) => (
                        <td
                          key={series[index]!.id}
                          className="px-3 text-right tabular-nums whitespace-nowrap"
                        >
                          {money(amount)}
                        </td>
                      ))}
                      <td className="px-3 text-right font-medium tabular-nums whitespace-nowrap">
                        {money(point.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
