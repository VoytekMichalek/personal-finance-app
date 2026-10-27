import { useState } from "react";
import {
  accountHistory,
  categoryColour,
  categoryLabel,
  displayDate,
  expenseReport,
  identityColour,
  money,
  type Account,
  type Snapshot,
} from "@finance/shared";
import { Card, Field, Input, SectionTitle } from "../common/primitives";
import { BalanceChart } from "../common/Chart";
import { CategoryChip } from "../common/EntityChip";
import { Button } from "../ui/button";
import { ExpenseDetail } from "../expenses/ExpenseDetail";

export function AccountInsights({
  data,
  account,
}: {
  data: Snapshot;
  account: Account;
}) {
  const [from, setFrom] = useState(account.openingDate);
  const [to, setTo] = useState(data.today);
  const [detail, setDetail] = useState<{ id: string; title: string } | null>(
    null,
  );
  const valid = Boolean(
    from && to && from <= to && to <= data.today && to >= account.openingDate,
  );
  const history = accountHistory(
    account,
    data.transactions,
    valid ? from : data.today,
    valid ? to : "",
  );
  const filters = { accountId: account.id, from: history.from, to };
  const report = expenseReport(data, filters);
  const max = Math.max(
    1,
    ...report.categories.map((category) => Math.abs(category.amountCents)),
  );
  return (
    <>
      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(account.openingDate);
              setTo(data.today);
            }}
          >
            All history
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(data.today.slice(0, 4) + "-01-01");
              setTo(data.today);
            }}
          >
            This year
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(data.today.slice(0, 7) + "-01");
              setTo(data.today);
            }}
          >
            This month
          </Button>
        </div>
        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
          <Field label="History from">
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="History to">
            <Input
              type="date"
              value={to}
              min={from}
              max={data.today}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
        {!valid && (
          <p role="alert" className="mt-3 text-sm text-amber-800">
            Choose a date range covering this account, ending on or before
            today.
          </p>
        )}
      </Card>
      {valid && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Balance before period", history.openingCents],
              ["Money in", history.moneyInCents],
              ["Money out", history.moneyOutCents],
              ["Net change", history.netCents],
              ["Closing balance", history.closingCents],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {money(Number(value))}
                </p>
              </Card>
            ))}
          </div>
          <Card className="mb-5">
            <SectionTitle>Balance over time</SectionTitle>
            <p className="mb-4 text-xs text-muted-foreground">
              {displayDate(history.from)} – {displayDate(to)} · Daily closing
              balances from recorded activity. Money in and out includes
              transfers; this is not an income or spending total.
            </p>
            <BalanceChart
              points={history.points}
              label={account.name + " historical balance"}
              step
            />
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer py-2">
                View balance values
              </summary>
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left">
                  <caption className="sr-only">Daily closing balances</caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.points.map((point) => (
                      <tr key={point.date}>
                        <td className="py-1">{displayDate(point.date)}</td>
                        <td className="text-right tabular-nums">
                          {money(point.balanceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="mt-3 text-xs text-muted-foreground">
              Missing imports or an incorrect opening balance affect this
              history. Compare it with your bank’s balances.
            </p>
          </Card>
          <Card>
            <SectionTitle>Spending by category</SectionTitle>
            <p className="mb-4 text-sm">
              {money(report.totalCents)} net expenses ·{" "}
              {money(report.spendingCents)} spent · {money(report.refundCents)}{" "}
              refunded
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Refunds reduce spending. Income and transfers are excluded. Select
              a category to see its trend and transactions for this period.
            </p>
            <div className="space-y-4">
              {report.categories.map((group) => {
                const category = data.categories.find(
                  (item) => item.id === group.id,
                );
                const label = category
                  ? categoryLabel(category, data.categories)
                  : "Uncategorised";
                const colour = category
                  ? categoryColour(category, data.categories)
                  : identityColour("category:none");
                return (
                  <button
                    key={group.id}
                    className="block w-full rounded-lg p-2 text-left hover:bg-muted"
                    aria-label={`${label}: ${money(group.amountCents)}, ${group.count} transactions`}
                    onClick={() => setDetail({ id: group.id, title: label })}
                  >
                    <span className="mb-2 flex flex-wrap justify-between gap-2">
                      <CategoryChip
                        categoryId={category?.id ?? null}
                        categories={data.categories}
                      />
                      <span className="text-sm tabular-nums">
                        {money(group.amountCents)} · {group.count}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="block h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(Math.abs(group.amountCents) / max) * 100}%`,
                          backgroundColor: colour,
                        }}
                      />
                    </span>
                    {group.amountCents < 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Refunds exceed spending in this period
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!report.rows.length && (
              <p className="text-sm text-muted-foreground">
                No spending recorded in this period.
              </p>
            )}
          </Card>
          {detail && (
            <ExpenseDetail
              data={data}
              filters={{
                ...filters,
                detail: { group: "categories", id: detail.id },
              }}
              title={detail.title}
              onClose={() => setDetail(null)}
            />
          )}
        </>
      )}
    </>
  );
}
