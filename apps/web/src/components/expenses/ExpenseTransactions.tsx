import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  displayDate,
  money,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { CategoryChip, PersonChip } from "../common/EntityChip";
import { Button } from "../ui/button";

const pageSize = 10;
export function ExpenseTransactions({
  rows,
  data,
}: {
  rows: Transaction[];
  data: Snapshot;
}) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  const sorted = [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);
  if (!rows.length)
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No transactions in this selection.
      </p>
    );
  return (
    <div className="@container">
      <div
        className="hidden grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-4 border-b bg-muted/40 px-3 py-2.5 text-[11px] font-medium text-muted-foreground @min-[640px]:grid"
        aria-hidden="true"
      >
        <span>Date</span>
        <span>Transaction / account</span>
        <span>Category / person</span>
        <span className="text-right">Net expense</span>
      </div>
      <ol aria-label="Expense transactions" className="divide-y">
        {visible.map((row) => {
          const refund = row.kind === "refund";
          const Icon = refund ? ArrowDownLeft : ArrowUpRight;
          return (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 text-sm @min-[640px]:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_7rem] @min-[640px]:gap-x-4 @min-[640px]:px-3"
            >
              <time
                dateTime={row.date}
                className="col-span-2 text-xs text-muted-foreground @min-[640px]:col-span-1 @min-[640px]:pt-1"
              >
                {displayDate(row.date)}
              </time>
              <div className="min-w-0">
                <p className="flex items-start gap-2 font-medium">
                  <Icon
                    aria-hidden="true"
                    size={15}
                    className={`mt-0.5 hidden shrink-0 @min-[640px]:block ${refund ? "text-emerald-600" : "text-muted-foreground"}`}
                  />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {row.description}
                  </span>
                </p>
                <Link
                  className="mt-1 inline-block max-w-full break-words text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-primary"
                  to={"/accounts/" + row.accountId}
                >
                  {data.accounts.find((account) => account.id === row.accountId)
                    ?.name ?? "Account"}
                </Link>
              </div>
              <div className="col-start-1 row-start-3 flex min-w-0 flex-wrap gap-1.5 text-xs [overflow-wrap:anywhere] @min-[640px]:col-start-auto @min-[640px]:row-start-auto">
                <CategoryChip
                  categoryId={row.categoryId}
                  categories={data.categories}
                />
                <PersonChip owner={row.owner} people={data.people} />
              </div>
              <div
                className={`col-start-2 row-start-2 text-right font-medium tabular-nums @min-[640px]:col-start-auto @min-[640px]:row-start-auto ${refund ? "text-emerald-700" : ""}`}
              >
                {money(-row.amountCents)}
                {refund && (
                  <span className="mt-0.5 block text-[11px] font-normal">
                    Refund
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p role="status" className="text-xs text-muted-foreground">
          {current * pageSize + 1}–
          {Math.min((current + 1) * pageSize, rows.length)} of {rows.length}{" "}
          transactions
        </p>
        {rows.length > pageSize && (
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous transactions"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={15} />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next transactions"
              disabled={current === lastPage}
              onClick={() => setPage(current + 1)}
            >
              Next
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
