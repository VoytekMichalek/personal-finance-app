import { Link } from "react-router-dom";
import {
  displayDate,
  money,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { AccountIdentity } from "../accounts/AccountIdentity";
import { PersonChip } from "../common/EntityChip";
import { TransactionCategory } from "../transactions/TransactionCategory";
import { TransactionType } from "../transactions/TransactionType";
import { RememberButton } from "../transactions/RememberButton";

export const expenseColumns =
  "@min-[1000px]:grid-cols-[minmax(12rem,2fr)_minmax(7rem,1fr)_10rem_minmax(7rem,1fr)_minmax(6rem,1fr)_5rem_8rem]";

export function ExpenseTransactionRow({
  row,
  data,
  onRemember,
  matchesRule,
  onTransferred,
}: {
  row: Transaction;
  data: Snapshot;
  onRemember: () => void;
  matchesRule: boolean;
  onTransferred: () => void;
}) {
  const refund = row.kind === "refund";
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 py-4 text-sm @min-[1000px]:px-3 ${expenseColumns}`}
    >
      <div className="min-w-0">
        <p className="font-medium break-words [overflow-wrap:anywhere]">
          {row.description}
        </p>
        <time
          dateTime={row.date}
          className="mt-1 block text-xs text-muted-foreground"
        >
          {displayDate(row.date)}
        </time>
      </div>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-start gap-2 @min-[1000px]:contents">
        <Link
          className="max-w-full rounded-full focus-visible:outline-primary"
          to={"/accounts/" + row.accountId}
        >
          <AccountIdentity
            account={data.accounts.find((a) => a.id === row.accountId)}
            institutions={data.institutions}
          />
        </Link>
        <TransactionType row={row} data={data} onTransferred={onTransferred} />
        <TransactionCategory row={row} categories={data.categories} />
        <PersonChip owner={row.owner} people={data.people} />
      </div>
      <div
        className={`col-start-2 row-start-1 self-start text-right font-medium tabular-nums @min-[1000px]:col-start-auto @min-[1000px]:row-start-auto @min-[1000px]:self-auto ${refund ? "text-emerald-700" : ""}`}
      >
        {money(-row.amountCents)}
        {refund && (
          <span className="mt-0.5 block text-[11px] font-normal">Refund</span>
        )}
      </div>
      <div className="col-span-2 flex justify-end @min-[1000px]:col-span-1">
        <RememberButton
          matchesRule={matchesRule}
          row={row}
          onClick={onRemember}
        />
      </div>
    </li>
  );
}
