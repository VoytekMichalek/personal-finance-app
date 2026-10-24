import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  expenseReport,
  expenseTrend,
  displayDate,
  money,
  type ExpenseFilters,
  type Snapshot,
} from "@finance/shared";
import { Dialog } from "../ui/dialog";
import { ExpenseTransactions } from "./ExpenseTransactions";
export function ExpenseDetail({
  data,
  filters,
  title,
  onClose,
}: {
  data: Snapshot;
  filters: ExpenseFilters;
  title: string;
  onClose: () => void;
}) {
  const report = expenseReport(data, filters);
  const points = expenseTrend(report.rows, filters.from, filters.to);
  const daily =
    (Date.parse(filters.to) - Date.parse(filters.from)) / 86_400_000 < 62;
  const period = (date: string) =>
    new Intl.DateTimeFormat(
      "en-AU",
      daily
        ? { day: "numeric", month: "short", timeZone: "UTC" }
        : { month: "short", year: "numeric", timeZone: "UTC" },
    ).format(new Date(date + "T00:00:00Z"));
  const account = data.accounts.find((a) => a.id === filters.accountId)?.name;
  const person =
    filters.owner === "household"
      ? "Household"
      : data.people.find((p) => p.id === filters.owner)?.name;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={[
        displayDate(filters.from) + " – " + displayDate(filters.to),
        account,
        person,
      ]
        .filter(Boolean)
        .join(" · ")}
      className="max-w-3xl"
    >
      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/60 p-4">
        {[
          ["Net expenses", report.totalCents],
          ["Spending", report.spendingCents],
          ["Refunds", report.refundCents],
        ].map(([label, cents]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-base font-semibold tabular-nums sm:text-xl">
              {money(Number(cents))}
            </p>
          </div>
        ))}
      </div>
      <h2 className="mt-6 font-semibold">
        {daily ? "Daily" : "Monthly"} spending trend
      </h2>
      <div
        role="img"
        aria-label={title + " spending trend"}
        className="mt-4 h-52 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#f0f1f2" />
            <XAxis
              dataKey="date"
              tickFormatter={period}
              interval="preserveStartEnd"
              axisLine={false}
              tickLine={false}
              minTickGap={30}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              width={58}
              tickFormatter={(v) => money(Number(v), true)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: "#f5f7fa" }}
              labelFormatter={(v) => period(String(v))}
              formatter={(v) => [money(Number(v)), "Net expenses"]}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Bar
              dataKey="amountCents"
              maxBarSize={32}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {points.map((p) => (
                <Cell
                  key={p.date}
                  fill={p.amountCents < 0 ? "#059669" : "#007aff"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">View trend values</summary>
        <div className="max-h-44 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Net expenses by {daily ? "day" : "month"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="text-right">
                  Net expenses
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="py-1">{period(p.date)}</td>
                  <td className="text-right tabular-nums">
                    {money(p.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <h2 className="mt-6 mb-2 font-semibold">
        Transactions · {report.rows.length}
      </h2>
      <ExpenseTransactions rows={report.rows} data={data} />
    </Dialog>
  );
}
