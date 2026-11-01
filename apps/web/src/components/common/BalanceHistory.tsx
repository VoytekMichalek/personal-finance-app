import { useId, useState, type ReactNode } from "react";
import { displayDate, money } from "@finance/shared";
import { BalanceChart } from "./Chart";
import { ChartViewTabs } from "./ChartViewTabs";
export function BalanceHistory({
  points,
  label,
  valueLabel = "Balance",
  controls,
}: {
  points: { date: string; balanceCents: number }[];
  label: string;
  valueLabel?: string;
  controls?: ReactNode;
}) {
  const id = useId();
  const [view, setView] = useState<"graph" | "table">("graph");
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>{controls}</div>
        <ChartViewTabs id={id} value={view} onChange={setView} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${view}`}
        aria-labelledby={`${id}-tab-${view}`}
      >
        {view === "graph" ? (
          <BalanceChart points={points} label={label} valueLabel={valueLabel} />
        ) : (
          <div className="max-h-96 overflow-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{label}</caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">{valueLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {points.map((p) => (
                  <tr key={p.date}>
                    <td className="p-3">{displayDate(p.date)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {money(p.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
