import { Link } from "react-router-dom";
import {
  categoryLabel,
  displayDate,
  money,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
export function ExpenseTransactions({
  rows,
  data,
}: {
  rows: Transaction[];
  data: Snapshot;
}) {
  return (
    <div className="divide-y">
      {[...rows]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row) => {
          const category = data.categories.find((c) => c.id === row.categoryId);
          return (
            <article
              key={row.id}
              className="flex items-start justify-between gap-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{row.description}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {displayDate(row.date)} ·{" "}
                  {category
                    ? categoryLabel(category, data.categories)
                    : "Uncategorised"}{" "}
                  ·{" "}
                  {row.owner === "household"
                    ? "Household"
                    : (data.people.find((p) => p.id === row.owner)?.name ??
                      "Former member")}{" "}
                  ·{" "}
                  <Link
                    className="text-primary"
                    to={"/accounts/" + row.accountId}
                  >
                    {data.accounts.find((a) => a.id === row.accountId)?.name}
                  </Link>
                </p>
              </div>
              <span
                className={
                  "shrink-0 tabular-nums " +
                  (row.kind === "refund" ? "text-emerald-700" : "")
                }
              >
                {money(-row.amountCents)}
                {row.kind === "refund" && (
                  <span className="block text-right text-[10px]">Refund</span>
                )}
              </span>
            </article>
          );
        })}
      {!rows.length && (
        <p className="py-6 text-sm text-muted-foreground">
          No transactions in this selection.
        </p>
      )}
    </div>
  );
}
