import { VisualTitle } from "../common/VisualTitle";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  balanceOutlook,
  displayDate,
  money,
  type Snapshot,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { ChartViewTabs } from "../common/ChartViewTabs";

export function BalanceOutlook({ data }: { data: Snapshot }) {
  const id = useId();
  const [view, setView] = useState<"graph" | "table">("graph");
  const history = useMemo(() => balanceOutlook(data), [data]);
  const current = history.points.find((p) => p.date === data.today)!;
  const closing = history.points.at(-1)!;
  const label = `Whole-household available balance. Six months of recorded history to ${displayDate(data.today)}, then three months projected to ${displayDate(history.to)}. Projected balance ${money(closing.projectedCents!)}.`;
  return (
    <Card>
      <VisualTitle
        title="Household balance & outlook"
        context={`Whole household · bank and cash, less credit owed. Recorded history uses opening balances and transactions. ${history.firstRecorded && history.firstRecorded > history.from ? `History available from ${displayDate(history.firstRecorded)}. ` : ""}The dotted projection uses scheduled income, bills and remaining budgets. Unbudgeted, unscheduled expenses are not included.`}
        action={
          <Link className="text-xs text-primary" to="/plan?tab=forecast">
            Explore forecast
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {money(current.projectedCents!)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Projected in 3 months</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {money(closing.projectedCents!)}
          </p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-4 text-xs text-muted-foreground"
          aria-label="Chart legend"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="w-6 border-t-2 border-primary"
            />
            Recorded
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="w-6 border-t-2 border-dotted border-primary"
            />
            Projected
          </span>
        </div>
        <ChartViewTabs id={id} value={view} onChange={setView} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${view}`}
        aria-labelledby={`${id}-tab-${view}`}
      >
        {view === "graph" ? (
          <div role="img" aria-label={label} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history.points}
                margin={{ top: 24, right: 15, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#f0f1f2" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                  ticks={history.points
                    .filter((p) => p.date.endsWith("-01"))
                    .map((p) => p.date)}
                  tick={{ fontSize: 10, fill: "#646c76" }}
                  tickFormatter={(date) =>
                    new Intl.DateTimeFormat("en-AU", {
                      month: "short",
                      year: "2-digit",
                      timeZone: "UTC",
                    }).format(new Date(String(date) + "T00:00:00Z"))
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={62}
                  tick={{ fontSize: 10, fill: "#646c76" }}
                  tickFormatter={(value: number) =>
                    Math.abs(value) >= 100000
                      ? `$${Math.round(value / 100000)}k`
                      : money(value, true)
                  }
                />
                <Tooltip
                  formatter={(value, name) => [
                    money(Number(value)),
                    name === "actualCents"
                      ? "Recorded balance"
                      : "Projected balance",
                  ]}
                  labelFormatter={(date) => displayDate(String(date))}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e8e9ec",
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  x={data.today}
                  stroke="#a4a8b0"
                  label={{
                    value: "Today",
                    position: "top",
                    fontSize: 11,
                    fill: "#646c76",
                  }}
                />
                <Line
                  type="linear"
                  dataKey="actualCents"
                  stroke="#007aff"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="projectedCents"
                  stroke="#007aff"
                  strokeWidth={2.5}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="max-h-64 overflow-auto rounded-xl border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{label}</caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Basis</th>
                  <th className="p-3 text-right">Available balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.points.map((p) => (
                  <tr key={p.date}>
                    <td className="p-3 whitespace-nowrap">
                      {displayDate(p.date)}
                    </td>
                    <td className="p-3">
                      {p.date > data.today
                        ? "Projected"
                        : p.actualCents === null
                          ? "No records"
                          : "Recorded"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {p.actualCents === null && p.projectedCents === null
                        ? "—"
                        : money(p.actualCents ?? p.projectedCents!)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!history.firstRecorded && (
        <Link to="/accounts" className="mt-2 inline-block text-xs text-primary">
          Add an account to start your balance history
        </Link>
      )}
    </Card>
  );
}
