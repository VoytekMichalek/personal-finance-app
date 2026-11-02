import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { budgetTrend, money, type Snapshot } from "@finance/shared";
import { Card } from "../common/primitives";
import { VisualTitle } from "../common/VisualTitle";
import { ChartViewTabs } from "../common/ChartViewTabs";
import { monthLabel } from "../ui/month-picker";
import { Button } from "../ui/button";

export function BudgetTrend({
  data,
  month,
  onMonth,
}: {
  data: Snapshot;
  month: string;
  onMonth: (month: string) => void;
}) {
  const [view, setView] = useState<"graph" | "table">("graph");
  const id = useId();
  const points = budgetTrend(data, month);
  return (
    <Card className="min-w-0">
      <VisualTitle
        title="Budget vs actual over time"
        context="Six calendar months of effective budgets and recorded expenses less refunds, including unbudgeted spending. The current month shows actuals through today; future months have no actuals yet. Upcoming bills are not recorded actuals."
        action={<ChartViewTabs id={id} value={view} onChange={setView} />}
      />
      <div
        id={`${id}-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${view}`}
      >
        {view === "graph" ? (
          <>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-sm bg-blue-200" />
                Budget
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2.5 rounded-sm bg-primary" />
                Actual
              </span>
              <span>Current month is partial</span>
            </div>
            <div
              role="img"
              aria-label="Monthly budget and actual spending comparison; use Table for exact amounts"
              className="h-64 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={points}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#f0f1f2" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) =>
                      new Intl.DateTimeFormat("en-AU", {
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(String(value) + "-01T00:00:00Z"))
                    }
                  />
                  <YAxis
                    width={60}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => money(Number(value), true)}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      money(Number(value)),
                      name === "budgetCents" ? "Budget" : "Actual",
                    ]}
                    labelFormatter={(value) => monthLabel(String(value))}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar
                    dataKey="budgetCents"
                    fill="#bfdbfe"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="actualCents"
                    fill="#007aff"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table
              aria-label="Monthly budget and actual spending"
              className="w-full text-left text-xs tabular-nums"
            >
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-3">Month</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Under / over</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.month} className="border-b last:border-0">
                    <th className="py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-0 text-xs text-primary"
                        onClick={() => onMonth(point.month)}
                      >
                        {monthLabel(point.month)}
                      </Button>
                    </th>
                    <td className="text-right">{money(point.budgetCents)}</td>
                    <td className="text-right">{money(point.actualCents)}</td>
                    <td
                      className={`text-right ${point.varianceCents < 0 ? "text-rose-700" : "text-emerald-700"}`}
                    >
                      {money(Math.abs(point.varianceCents))}{" "}
                      {point.varianceCents < 0 ? "over" : "under"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
