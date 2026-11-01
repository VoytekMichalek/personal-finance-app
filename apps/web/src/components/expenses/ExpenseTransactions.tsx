import { matchingSavedRules } from "../transactions/matched-rules";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  matchingTransferTransactions,
  suggestRememberedRule,
  type Snapshot,
  type Transaction,
  type ExpenseFilters,
} from "@finance/shared";
import { RememberTransaction } from "../transactions/RememberTransaction";
import { Button } from "../ui/button";
import { ExpenseTransactionRow, expenseColumns } from "./ExpenseTransactionRow";

const pageSize = 10;
export function ExpenseTransactions({
  rows,
  data,
  filters,
}: {
  rows: Transaction[];
  data: Snapshot;
  filters: ExpenseFilters;
}) {
  const ruleMatches = matchingSavedRules(data, rows);
  const [params, setParams] = useSearchParams();
  const pageKey = filters.detail ? "detailPage" : "expensePage";
  const page = Math.max(0, Number(params.get(pageKey)) || 0);
  const setPage = (page: number) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (page) next.set(pageKey, String(page));
        else next.delete(pageKey);
        return next;
      },
      { replace: true },
    );
  const [remembering, setRemembering] = useState<{
    id: string;
    afterVersion?: number;
  }>();
  const rememberedRow = data.transactions.find(
    (row) =>
      row.id === remembering?.id &&
      (remembering.afterVersion === undefined ||
        (row.version > remembering.afterVersion && row.kind === "transfer")),
  );
  const offerSimilarTransfers = (row: Transaction) => {
    const matches = matchingTransferTransactions(
      rows,
      row,
      suggestRememberedRule(row.description),
    );
    if (matches.some((item) => item.id !== row.id && item.kind !== "transfer"))
      setRemembering({ id: row.id, afterVersion: row.version });
  };
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  const sorted = [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);
  return (
    <div className="@container">
      {rememberedRow && (
        <RememberTransaction
          key={rememberedRow.id}
          row={rememberedRow}
          afterTypeChange={remembering?.afterVersion !== undefined}
          data={data}
          rows={rows}
          filters={{ expenses: filters }}
          close={() => setRemembering(undefined)}
        />
      )}
      {!rows.length ? (
        <p className="py-6 text-sm text-muted-foreground">
          No transactions in this selection.
        </p>
      ) : (
        <>
          <div
            className={`hidden gap-3 border-b bg-muted/40 px-3 py-2.5 text-[11px] font-medium text-muted-foreground @min-[1000px]:grid ${expenseColumns}`}
            aria-hidden="true"
          >
            <span>Transaction</span>
            <span>Account</span>
            <span>Type</span>
            <span>Category</span>
            <span>Belongs to</span>
            <span className="text-right">Net expense</span>
            <span className="text-right">Actions</span>
          </div>
          <ol aria-label="Expense transactions" className="divide-y">
            {visible.map((row) => (
              <ExpenseTransactionRow
                key={row.id}
                row={row}
                matchesRule={ruleMatches.has(row.id)}
                data={data}
                onRemember={() => setRemembering({ id: row.id })}
                onTransferred={() => offerSimilarTransfers(row)}
              />
            ))}
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
        </>
      )}
    </div>
  );
}
