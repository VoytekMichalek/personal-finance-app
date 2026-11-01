import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { displayDate, money, type Snapshot } from "@finance/shared";
import { TransactionCategory } from "./TransactionCategory";

export function RecentTransactions({ data }: { data: Snapshot }) {
  return (
    <ol aria-label="Recent transactions" className="divide-y">
      {data.transactions.slice(0, 5).map((row) => (
        <li key={row.id} className="flex items-start gap-3 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {row.amountCents > 0 ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <Link
              to={"/transactions?detail=" + row.id}
              className="block text-xs font-medium break-words hover:text-primary hover:underline"
            >
              {row.description}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <TransactionCategory row={row} categories={data.categories} />
              <time
                dateTime={row.date}
                className="text-[10px] text-muted-foreground"
              >
                {displayDate(row.date)}
              </time>
            </div>
          </div>
          <span
            className={
              "shrink-0 text-xs font-semibold tabular-nums " +
              (row.kind !== "transfer" && row.amountCents > 0
                ? "text-emerald-700"
                : "")
            }
          >
            {row.amountCents > 0 ? "+" : ""}
            {money(row.amountCents)}
          </span>
        </li>
      ))}
    </ol>
  );
}
