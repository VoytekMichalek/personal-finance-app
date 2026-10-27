import { CategoryChip, PersonChip } from "../common/EntityChip";
import { Link } from "react-router-dom";
import {
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
          return (
            <article
              key={row.id}
              className="flex items-start justify-between gap-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{row.description}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {displayDate(row.date)} ·{" "}
                  <CategoryChip
                    categoryId={row.categoryId}
                    categories={data.categories}
                  />{" "}
                  <PersonChip owner={row.owner} people={data.people} />{" "}
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
